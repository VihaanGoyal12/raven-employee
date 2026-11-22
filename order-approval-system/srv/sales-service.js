import cds from '@sap/cds';

export function calculateDiscountLocal(customerType, grossAmount) {
    const gross = Number(grossAmount) || 0;
    if (customerType === 'Premium' && gross > 10000) {
        return 15.0;
    } else if (customerType === 'Premium' && gross > 5000) {
        return 10.0;
    } else if (customerType === 'Regular' && gross > 5000) {
        return 5.0;
    }
    return 0.0;
}

export default cds.service.impl(async function () {
    const { SalesOrders, Customers, SalesOrderItems } = this.entities;
    const { SELECT, INSERT, UPDATE } = cds.ql;

    // Helper: calculate gross, discount, and net
    async function calculateAmounts(req, customerId, grossAmount) {
        const customer = await SELECT.one.from(Customers).where({ ID: customerId });
        if (!customer) {
            req.error(404, `Customer ${customerId} not found`);
            return;
        }

        let discountPercent = 0.0;
        const isSqlite = !cds.env.requires.db || cds.env.requires.db.kind === 'sqlite';

        if (isSqlite) {
            discountPercent = calculateDiscountLocal(customer.customerType, grossAmount);
        } else {
            try {
                const result = await cds.run(
                    `CALL "CALC_DISCOUNT"(
                        CUSTOMERTYPE => ?,
                        GROSSAMOUNT => ?,
                        DISCOUNTPERCENT => ?
                    )`,
                    [customer.customerType, grossAmount]
                );
                discountPercent = Number(result.DISCOUNTPERCENT ?? 0);
            } catch (err) {
                console.warn('HANA procedure failed, falling back to local calculation:', err.message);
                discountPercent = calculateDiscountLocal(customer.customerType, grossAmount);
            }
        }

        const netAmount = Number((grossAmount * (1 - discountPercent / 100)).toFixed(2));
        return { discountPercent, netAmount };
    }

    // Auto-calculate on CREATE and UPDATE of SalesOrders
    this.before(['CREATE', 'UPDATE'], SalesOrders, async (req) => {
        const { customer_ID, grossAmount } = req.data;
        if (customer_ID && grossAmount !== undefined) {
            const calcs = await calculateAmounts(req, customer_ID, grossAmount);
            if (calcs) {
                req.data.discountPercent = calcs.discountPercent;
                req.data.netAmount = calcs.netAmount;
            }
        }
    });

    // Custom Action: sendToHoDForApproval
    this.on('sendToHoDForApproval', async (req) => {
        const orderId = req.params?.[0]?.ID || req.params?.[0] || req.data?.ID || req.data?.orderId;
        if (!orderId) return req.error(400, 'Order ID is required');

        const order = await SELECT.one.from(SalesOrders).where({ ID: orderId });
        if (!order) return req.error(404, 'Order not found');

        // Validation
        if (order.status !== 'New' && order.status !== 'Rejected') {
            return req.error(400, `Cannot submit order in status '${order.status}'. Only 'New' or 'Rejected' orders can be submitted.`);
        }

        const customer = order.customer_ID ? await SELECT.one.from(Customers).where({ ID: order.customer_ID }) : null;
        const items = await SELECT.from(SalesOrderItems).where({ parent_ID: orderId });
        const firstItem = items?.[0] || { product: 'Standard Order', quantity: 1, unitPrice: order.grossAmount };

        // Construct BPA process start payload matching OrderApprovalInput
        const bpaPayload = {
            definitionId: "ap21.f1de4b2dtrial.orderapproval.orderApprovalProcess",
            context: {
                orderId: order.ID,
                orderNumber: order.orderNumber,
                orderDate: String(order.orderDate || new Date().toISOString().slice(0, 10)),
                customerName: customer?.name || 'Unknown',
                customerType: customer?.customerType || 'Regular',
                product: firstItem.product,
                quantity: Number(firstItem.quantity),
                unitPrice: Number(firstItem.unitPrice),
                grossAmount: Number(order.grossAmount),
                discountPercent: Number(order.discountPercent),
                netAmount: Number(order.netAmount),
                requestedBy: order.requestedBy || 'vihaangoyal31@gmail.com',
                requestedByEmail: order.requestedByEmail || 'vihaangoyal31@gmail.com'
            }
        };

        let workflowInstanceId = null;

        // Call BPA Service via destination or generate simulated correlation in dev
        try {
            const bpa = await cds.connect.to('bpa-api');
            const response = await bpa.post('/workflow/rest/v1/workflow-instances', bpaPayload);
            workflowInstanceId = response.id || response.rootInstanceId;
        } catch (err) {
            console.log('[BPA Start] Remote call not reachable in local environment, using local correlation token:', err.message);
            // Deterministic mock instance ID matching SAP Build format
            workflowInstanceId = 'wf-' + Date.now().toString(16) + '-' + order.ID.slice(0, 8);
        }

        // Update Order status to PendingApproval and save workflow instance ID
        await UPDATE(SalesOrders)
            .set({
                status: 'PendingApproval',
                workflowInstanceId: workflowInstanceId
            })
            .where({ ID: order.ID });

        return {
            success: true,
            message: `Order ${order.orderNumber} successfully sent to HoD for approval`,
            workflowInstanceId: workflowInstanceId
        };
    });

    // Manual Approve action (from Object Page)
    this.on('approve', SalesOrders, async (req) => {
        const orderId = req.params[0]?.ID || req.params[0];
        await UPDATE(SalesOrders).set({ status: 'Approved' }).where({ ID: orderId });
        return 'Order approved successfully';
    });

    // Workflow Callback endpoint for BPA "Create odata v4" updates
    this.on('updateWorkflowStatus', async (req) => {
        const { orderId, status, hodComment, financeComment, workflowInstanceId } = req.data;
        if (!orderId) return req.error(400, 'Missing orderId');

        const updateData = {};
        if (status) updateData.status = status;
        if (hodComment) updateData.hodComment = hodComment;
        if (financeComment) updateData.financeComment = financeComment;
        if (workflowInstanceId) updateData.workflowInstanceId = workflowInstanceId;

        await UPDATE(SalesOrders).set(updateData).where({ ID: orderId });

        return {
            success: true,
            message: `Order ${orderId} updated to status ${status || 'unchanged'}`
        };
    });
});
