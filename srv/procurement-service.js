import cds from '@sap/cds';

export default cds.service.impl(async function () {
    const { PurchaseOrders, PurchaseOrderItems, Suppliers } = this.entities;
    const db = await cds.connect.to('db');

    // Live line total calculation and item-level validation
    this.before(['CREATE', 'UPDATE', 'PATCH'], [PurchaseOrderItems, PurchaseOrderItems.drafts], async (req) => {
        const { quantity, unitPrice, ID } = req.data;
        if (quantity !== undefined && quantity <= 0) {
            return req.reject(400, 'Quantity must be greater than 0');
        }
        if (unitPrice !== undefined && unitPrice < 0) {
            return req.reject(400, 'Unit price must not be negative');
        }

        if (quantity !== undefined || unitPrice !== undefined) {
            const cur = ID ? await db.run(SELECT.one.from(req.target).where({ ID })) : null;
            const q = quantity ?? cur?.quantity ?? 0;
            const p = unitPrice ?? cur?.unitPrice ?? 0;
            req.data.lineTotal = q * p;
        }
    });

    // Update parent PO totalAmount live after item changes in draft or active state
    this.after(['CREATE', 'UPDATE', 'DELETE'], [PurchaseOrderItems, PurchaseOrderItems.drafts], async (data, req) => {
        const isDraft = req.target?.name?.endsWith('.drafts');
        let parent_ID = req.data?.parent_ID || data?.parent_ID;
        if (!parent_ID && req.data?.ID) {
            const item = await db.run(SELECT.one.from(req.target).columns('parent_ID').where({ ID: req.data.ID })).catch(() => null);
            parent_ID = item?.parent_ID;
        }
        if (parent_ID) {
            const itemsTbl = isDraft ? PurchaseOrderItems.drafts : PurchaseOrderItems;
            const poTbl = isDraft ? PurchaseOrders.drafts : PurchaseOrders;
            const items = await db.run(SELECT.from(itemsTbl).where({ parent_ID })).catch(() => []);
            const total = items.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
            await db.run(UPDATE(poTbl).set({ totalAmount: total }).where({ ID: parent_ID })).catch(() => {});
        }
    });

    // Validation and total calculation on PurchaseOrders (active CREATE & UPDATE, including draft activation)
    this.before(['CREATE', 'UPDATE'], PurchaseOrders, async (req) => {
        let { supplier_ID, items } = req.data;
        const poId = req.data.ID;

        // If items are not passed in payload, fetch from draft (priority during activation) or active DB
        if (!items || items.length === 0) {
            if (poId) {
                items = await db.run(SELECT.from(PurchaseOrderItems.drafts).where({ parent_ID: poId })).catch(() => []);
                if (!items || items.length === 0) {
                    items = await db.run(SELECT.from(PurchaseOrderItems).where({ parent_ID: poId }));
                }
            }
        }

        // Validate items and calculate line totals
        let total = 0;
        if (items && items.length > 0) {
            for (const item of items) {
                if (item.quantity <= 0) {
                    return req.reject(400, 'Quantity must be greater than 0');
                }
                if (item.unitPrice < 0) {
                    return req.reject(400, 'Unit price must not be negative');
                }
                item.lineTotal = item.quantity * item.unitPrice;
                total += item.lineTotal;
            }
        }

        req.data.totalAmount = total;

        // Determine supplier_ID if not in req.data
        if (!supplier_ID && poId) {
            const draftPo = await db.run(SELECT.one.from(PurchaseOrders.drafts).where({ ID: poId })).catch(() => null);
            supplier_ID = draftPo?.supplier_ID;
            if (!supplier_ID) {
                const existing = await db.run(SELECT.one.from(PurchaseOrders).where({ ID: poId }));
                supplier_ID = existing?.supplier_ID;
            }
        }

        if (supplier_ID) {
            const supplier = await db.run(SELECT.one.from(Suppliers).where({ ID: supplier_ID }));
            if (!supplier) {
                return req.reject(404, 'Supplier not found');
            }
            if (total > supplier.creditLimit) {
                return req.reject(
                    422,
                    `Purchase order total ${total} exceeds supplier credit limit ${supplier.creditLimit}`
                );
            }
        }
    });
});
