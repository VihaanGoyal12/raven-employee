import cds from '@sap/cds';

const { SELECT, INSERT, UPDATE } = cds.ql;

export default cds.service.impl(async function () {
    const { SalesOrders } = this.entities;
    const { Products, StockItems } = cds.entities('raven.inventory');
    const { StockReservations } = cds.entities('raven.fulfillment');

    // Sequential order number resolution
    const orderNumberCache = new Map();

    function resolveOrderNumber(id) {
        if (!id) return 'SO-1001';
        if (!orderNumberCache.has(id)) {
            const nextNum = 1001 + orderNumberCache.size;
            orderNumberCache.set(id, `SO-${nextNum}`);
        }
        return orderNumberCache.get(id);
    }

    cds.on('served', async () => {
        try {
            const db = await cds.connect.to('db');
            const { SalesOrders: dbSalesOrders } = db.entities('raven.sales');
            const allOrders = await db.run(
                SELECT.from(dbSalesOrders).columns('ID').orderBy('orderDate asc', 'ID asc')
            );
            if (allOrders && allOrders.length > 0) {
                let startNum = 1001;
                for (const ord of allOrders) {
                    if (ord.ID && !orderNumberCache.has(ord.ID)) {
                        orderNumberCache.set(ord.ID, `SO-${startNum++}`);
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    });

    this.after('READ', SalesOrders, (rows) => {
        for (const o of [].concat(rows ?? [])) {
            if (o && typeof o === 'object') {
                o.order = resolveOrderNumber(o.ID);
            }
        }
    });

    // Day 5 Fulfillment Action: Reserve Stock
    this.on('reserveStock', SalesOrders, async (req) => {
        const { ID } = req.params[0] || req.data;
        const tx = cds.transaction(req);

        const { SalesOrders: dbOrders, SalesOrderItems: dbItems } = cds.entities('raven.sales');

        const order = await tx.run(
            SELECT.one.from(dbOrders).where({ ID })
        );

        if (!order) {
            return req.reject(404, 'Sales order not found');
        }

        if (order.status !== 'Approved') {
            return req.reject(
                409,
                'Stock can only be reserved after order approval'
            );
        }

        const orderItems = await tx.run(
            SELECT.from(dbItems).where({ parent_ID: ID })
        );

        if (!orderItems.length) {
            return req.reject(422, 'Sales order has no items');
        }

        const demand = new Map();
        for (const item of orderItems) {
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                return req.reject(
                    422,
                    `Invalid quantity for product ${item.product}`
                );
            }
            demand.set(
                item.product,
                (demand.get(item.product) || 0) + item.quantity
            );
        }

        const products = await tx.run(SELECT.from(Products));
        const productByName = new Map(
            products.map(product => [product.name, product.ID])
        );

        const stockItems = await tx.run(SELECT.from(StockItems));
        const reservations = await tx.run(
            SELECT.from(StockReservations).where({ status: 'Reserved' })
        );

        const reservedByStock = new Map();
        for (const reservation of reservations) {
            reservedByStock.set(
                reservation.stockItem_ID,
                (reservedByStock.get(reservation.stockItem_ID) || 0) + reservation.reservedQty
            );
        }

        const newReservations = [];

        for (const [productName, requiredQty] of demand) {
            const productID = productByName.get(productName);
            if (!productID) {
                return req.reject(
                    422,
                    `Product not found in inventory: ${productName}`
                );
            }

            const matchingStock = stockItems
                .filter(stock => stock.product_ID === productID)
                .sort((a, b) =>
                    a.warehouse_ID.localeCompare(b.warehouse_ID) ||
                    a.ID.localeCompare(b.ID)
                );

            let remaining = requiredQty;
            for (const stock of matchingStock) {
                const alreadyReserved = reservedByStock.get(stock.ID) || 0;
                const available = stock.quantity - alreadyReserved;
                if (available <= 0) continue;

                const allocate = Math.min(available, remaining);
                if (allocate > 0) {
                    newReservations.push({
                        salesOrder_ID: ID,
                        stockItem_ID: stock.ID,
                        reservedQty: allocate,
                        status: 'Reserved'
                    });
                    remaining -= allocate;
                }
                if (remaining === 0) break;
            }

            if (remaining > 0) {
                return req.reject(
                    422,
                    `Insufficient stock for ${productName}. Required: ${requiredQty}, available: ${requiredQty - remaining}`
                );
            }
        }

        await tx.run(
            INSERT.into(StockReservations).entries(newReservations)
        );

        await tx.run(
            UPDATE(dbOrders)
                .set({ status: 'StockConfirmed' })
                .where({ ID })
        );

        return `Stock reserved successfully. ${newReservations.length} reservation(s) created.`;
    });

    // Day 5 Fulfillment Action: Dispatch Order
    this.on('dispatchOrder', SalesOrders, async (req) => {
        const { ID } = req.params[0] || req.data;
        const tx = cds.transaction(req);

        const { SalesOrders: dbOrders } = cds.entities('raven.sales');

        const order = await tx.run(
            SELECT.one.from(dbOrders).where({ ID })
        );

        if (!order) {
            return req.reject(404, 'Sales order not found');
        }

        if (order.status !== 'StockConfirmed') {
            return req.reject(
                409,
                'Only stock-confirmed orders can be dispatched'
            );
        }

        const reservations = await tx.run(
            SELECT.from(StockReservations).where({
                salesOrder_ID: ID,
                status: 'Reserved'
            })
        );

        if (!reservations.length) {
            return req.reject(
                409,
                'No active stock reservations found for this order'
            );
        }

        const reservedByStock = new Map();
        for (const reservation of reservations) {
            const stockID = reservation.stockItem_ID;
            reservedByStock.set(
                stockID,
                (reservedByStock.get(stockID) || 0) + reservation.reservedQty
            );
        }

        const stockIDs = [...reservedByStock.keys()];
        const stockItems = await tx.run(
            SELECT.from(StockItems).where({ ID: { in: stockIDs } })
        );

        const stockByID = new Map(stockItems.map(stock => [stock.ID, stock]));

        for (const [stockID, reservedQty] of reservedByStock) {
            const stock = stockByID.get(stockID);
            if (!stock || stock.quantity < reservedQty) {
                return req.reject(
                    409,
                    `Stock is insufficient for reservation ${stockID}`
                );
            }
        }

        for (const [stockID, reservedQty] of reservedByStock) {
            const stock = stockByID.get(stockID);
            await tx.run(
                UPDATE(StockItems)
                    .set({ quantity: stock.quantity - reservedQty })
                    .where({ ID: stockID })
            );
        }

        await tx.run(
            UPDATE(StockReservations)
                .set({ status: 'Fulfilled' })
                .where({ salesOrder_ID: ID, status: 'Reserved' })
        );

        await tx.run(
            UPDATE(dbOrders)
                .set({ status: 'Dispatched' })
                .where({ ID })
        );

        return 'Order dispatched successfully';
    });
});
