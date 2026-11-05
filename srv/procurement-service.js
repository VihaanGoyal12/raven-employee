
import cds from '@sap/cds';

export default cds.service.impl(async function () {

    const { PurchaseOrders, Suppliers } = this.entities;

    this.before('CREATE', PurchaseOrders, async (req) => {

        const { supplier_ID, items = [] } = req.data;

        // Validate items and calculate line totals
        let total = 0;

        for (const item of items) {

            if (item.quantity <= 0) {
                return req.reject(400, 'Quantity must be greater than 0');
            }

            if (item.unitPrice <= 0) {
                return req.reject(400, 'Unit price must be greater than 0');
            }

            item.lineTotal = item.quantity * item.unitPrice;

            total += item.lineTotal;
        }

        // Set server-calculated total
        req.data.totalAmount = total;

        // Find supplier
        const supplier = await SELECT.one
            .from(Suppliers)
            .where({ ID: supplier_ID });

        if (!supplier) {
            return req.reject(404, 'Supplier not found');
        }

        // Check supplier credit limit
        if (total > supplier.creditLimit) {
            return req.reject(
                422,
                `Purchase order total ${total} exceeds supplier credit limit ${supplier.creditLimit}`
            );
        }

    });

});
