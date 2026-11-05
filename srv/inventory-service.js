import cds from '@sap/cds';

const { SELECT, UPDATE, INSERT } = cds.ql;

export default cds.service.impl(function () {

    this.on('transferStock', async (req) => {

        const { fromWarehouse, toWarehouse, product, quantity } = req.data;

        // Validate quantity
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return req.reject(400, 'Transfer quantity must be greater than zero.');
        }

        // Prevent transferring to the same warehouse
        if (fromWarehouse === toWarehouse) {
            return req.reject(400, 'Source and destination warehouses must be different.');
        }

        // Start transaction
        const tx = cds.transaction(req);

        // Find stock in source warehouse
        const sourceStock = await tx.run(
            SELECT.one.from('raven.inventory.StockItems')
                .where({
                    warehouse_ID: fromWarehouse,
                    product_ID: product
                })
        );

        // Check available stock
        if (!sourceStock || sourceStock.quantity < quantity) {
            return req.reject(422, 'Insufficient stock in the source warehouse.');
        }

        // Deduct stock from source warehouse
        await tx.run(
            UPDATE('raven.inventory.StockItems')
                .set({ quantity: sourceStock.quantity - quantity })
                .where({ ID: sourceStock.ID })
        );

        // Check whether the product already exists in destination warehouse
        const destinationStock = await tx.run(
            SELECT.one.from('raven.inventory.StockItems')
                .where({
                    warehouse_ID: toWarehouse,
                    product_ID: product
                })
        );

        if (destinationStock) {

            // Increase existing destination stock
            await tx.run(
                UPDATE('raven.inventory.StockItems')
                    .set({ quantity: destinationStock.quantity + quantity })
                    .where({ ID: destinationStock.ID })
            );

        } else {

            // Create a new stock record in destination warehouse
            await tx.run(
                INSERT.into('raven.inventory.StockItems').entries({
                    ID: cds.utils.uuid(),
                    warehouse_ID: toWarehouse,
                    product_ID: product,
                    quantity: quantity
                })
            );

        }

        return `Successfully transferred ${quantity} units.`;
    });


    this.on('getStockAvailability', async (req) => {

        const { warehouse, product } = req.data;

        const tx = cds.transaction(req);

        const stockItem = await tx.run(
            SELECT.one.from('raven.inventory.StockItems')
                .where({
                    warehouse_ID: warehouse,
                    product_ID: product
                })
        );

        return stockItem ? stockItem.quantity : 0;
    });

});