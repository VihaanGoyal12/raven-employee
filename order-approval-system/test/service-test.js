import test from 'node:test';
import assert from 'node:assert/strict';
import cds from '@sap/cds';

test('CAP SalesService Integration Tests', async (t) => {
    // Reconnect and ensure clean database
    const db = await cds.connect.to('db');
    const service = await cds.serve('SalesService').from('srv/sales-service');

    // Create a dedicated test order to ensure deterministic test runs
    const testOrderId = '99999999-9999-9999-9999-999999999999';
    await cds.run(cds.ql.DELETE.from('raven.sales.SalesOrders').where({ ID: testOrderId }));
    await cds.run(cds.ql.INSERT.into('raven.sales.SalesOrders').entries({
        ID: testOrderId,
        orderNumber: 'TEST-AUTOMATION',
        customer_ID: '11111111-1111-1111-1111-111111111111',
        orderDate: '2026-11-20',
        status: 'New',
        grossAmount: 5000.00,
        discountPercent: 0.00,
        netAmount: 5000.00,
        requestedBy: 'vihaangoyal31@gmail.com',
        requestedByEmail: 'vihaangoyal31@gmail.com'
    }));

    await t.test('Read SalesOrders with Draft/Projections', async () => {
        const orders = await service.read('SalesOrders');
        assert.ok(orders.length >= 11, 'Should read all seeded orders');
        const testOrder = orders.find(o => o.ID === testOrderId);
        assert.ok(testOrder, 'Test order should exist');
        assert.equal(testOrder.status, 'New');
        assert.equal(testOrder.grossAmount, 5000);
        assert.equal(testOrder.netAmount, 5000);
    });

    await t.test('sendToHoDForApproval transitions status from New to PendingApproval', async () => {
        const result = await service.send('sendToHoDForApproval', { orderId: testOrderId });
        assert.equal(result.success, true);
        assert.ok(result.workflowInstanceId, 'Workflow instance ID should be generated');

        const updated = await service.read('SalesOrders').where({ ID: testOrderId });
        assert.equal(updated[0].status, 'PendingApproval');
        assert.equal(updated[0].workflowInstanceId, result.workflowInstanceId);
    });

    await t.test('sendToHoDForApproval prevents re-submitting already PendingApproval order', async () => {
        await assert.rejects(
            async () => {
                await service.send('sendToHoDForApproval', { orderId: testOrderId });
            },
            /Cannot submit order in status 'PendingApproval'/
        );
    });

    await t.test('updateWorkflowStatus callback updates status and comments (BPA simulation)', async () => {
        // 1. Simulate HoD review sending to finance
        const financeReviewUpdate = await service.send('updateWorkflowStatus', {
            orderId: testOrderId,
            status: 'InFinanceReview',
            hodComment: 'Reviewed by HoD - sending to Finance for check',
            financeComment: null,
            workflowInstanceId: 'wf-mock-instance-123'
        });
        assert.equal(financeReviewUpdate.success, true);

        let orderState = (await service.read('SalesOrders').where({ ID: testOrderId }))[0];
        assert.equal(orderState.status, 'InFinanceReview');
        assert.equal(orderState.hodComment, 'Reviewed by HoD - sending to Finance for check');
        assert.equal(orderState.statusCriticality, 2, 'InFinanceReview criticality should be 2 (Orange)');

        // 2. Simulate Finance forwarding back and final HoD Approval
        const approvalUpdate = await service.send('updateWorkflowStatus', {
            orderId: testOrderId,
            status: 'Approved',
            hodComment: 'Approved upon Finance clearance',
            financeComment: 'Budget confirmed and cleared',
            workflowInstanceId: 'wf-mock-instance-123'
        });
        assert.equal(approvalUpdate.success, true);

        orderState = (await service.read('SalesOrders').where({ ID: testOrderId }))[0];
        assert.equal(orderState.status, 'Approved');
        assert.equal(orderState.statusCriticality, 3, 'Approved status criticality should be 3 (Green)');
        assert.equal(orderState.financeComment, 'Budget confirmed and cleared');
    });

    // Cleanup
    await cds.run(cds.ql.DELETE.from('raven.sales.SalesOrders').where({ ID: testOrderId }));
});
