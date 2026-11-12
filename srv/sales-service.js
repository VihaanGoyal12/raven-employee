import cds from '@sap/cds';

const { SELECT, INSERT, UPDATE } = cds.ql;

export default cds.service.impl(async function () {
    const { SalesOrders, Customers, SalesOrderItems } = this.entities;

    const { Products, StockItems } = cds.entities('raven.inventory');
    const { StockReservations } = cds.entities('raven.fulfillment');

    // Day 4: Discount calculation (HANA + SQLite compatible)
    this.before('CREATE', SalesOrders, async (req) => {
        const { customer_ID, grossAmount } = req.data;

        if (!grossAmount || grossAmount <= 0) {
            return req.error(400, 'grossAmount must be > 0');
        }

        const customer = await SELECT.one
            .from(Customers)
            .where({ ID: customer_ID });

        if (!customer) {
            return req.error(404, 'Customer not found');
        }

        let discountPercent;

        if (cds.env.requires.db.kind === 'sqlite') {
            // SQLite equivalent of CALC_DISCOUNT
            if (customer.customerType === 'Premium' && grossAmount > 10000) {
                discountPercent = 15;
            } else if (customer.customerType === 'Premium' && grossAmount > 5000) {
                discountPercent = 10;
            } else if (customer.customerType === 'Regular' && grossAmount > 5000) {
                discountPercent = 5;
            } else {
                discountPercent = 0;
            }
        } else {
            // Original HANA stored procedure
            const result = await cds.run(
                `CALL "CALC_DISCOUNT"(
                    CUSTOMERTYPE => ?,
                    GROSSAMOUNT => ?,
                    DISCOUNTPERCENT => ?
                )`,
                [customer.customerType, grossAmount]
            );

            discountPercent = Number(result.DISCOUNTPERCENT);
        }

        req.data.discountPercent = discountPercent;
        req.data.netAmount =
            grossAmount * (1 - discountPercent / 100);
    });

    // Day 9: Populate canApprove and human-readable order number (SO-1001, etc.)
    const orderNumberCache = new Map();
    let nextOrderNum = 1001;

    this.after('READ', SalesOrders, (rows, req) => {
        const isManager = req.user && typeof req.user.is === 'function' ? req.user.is('SalesManager') : false;
        for (const o of [].concat(rows ?? [])) {
            if (o && typeof o === 'object') {
                if (o.ID) {
                    if (!orderNumberCache.has(o.ID)) {
                        orderNumberCache.set(o.ID, `SO-${nextOrderNum++}`);
                    }
                    o.order = orderNumberCache.get(o.ID);
                } else if (!o.order) {
                    o.order = `SO-${nextOrderNum++}`;
                }
                o.canApprove = isManager && o.status !== 'Approved';
            }
        }
    });

    // Auto-seed sample sales orders if the table is empty
    cds.on('served', async () => {
        try {
            const db = await cds.connect.to('db');
            const { SalesOrders: dbSalesOrders, Customers: dbCustomers } = db.entities('raven.sales');
            const existing = await db.run(SELECT.one`count(*) as cnt`.from(dbSalesOrders));
            if (!existing || Number(existing.cnt) === 0) {
                const customers = await db.run(SELECT.from(dbCustomers));
                if (customers && customers.length > 0) {
                    const c1 = customers[0].ID;
                    const c2 = customers[1] ? customers[1].ID : c1;
                    const c3 = customers[2] ? customers[2].ID : c1;

                    await db.run(INSERT.into(dbSalesOrders).entries([
                        { ID: 'a1111111-1111-4111-8111-111111111111', customer_ID: c1, orderDate: '2026-10-25', status: 'New', grossAmount: 4000.00, discountPercent: 0.00, netAmount: 4000.00 },
                        { ID: 'a2222222-2222-4222-8222-222222222222', customer_ID: c2, orderDate: '2026-10-26', status: 'Approved', grossAmount: 6000.00, discountPercent: 10.00, netAmount: 5400.00 },
                        { ID: 'a3333333-3333-4333-8333-333333333333', customer_ID: c3, orderDate: '2026-10-27', status: 'New', grossAmount: 3500.00, discountPercent: 0.00, netAmount: 3500.00 },
                        { ID: 'a4444444-4444-4444-8444-444444444444', customer_ID: c2, orderDate: '2026-10-28', status: 'New', grossAmount: 12000.00, discountPercent: 15.00, netAmount: 10200.00 },
                        { ID: 'a5555555-5555-4555-8555-555555555555', customer_ID: c2, orderDate: '2026-10-29', status: 'Approved', grossAmount: 15000.00, discountPercent: 15.00, netAmount: 12750.00 },
                        { ID: 'a6666666-6666-4666-8666-666666666666', customer_ID: c1, orderDate: '2026-11-01', status: 'New', grossAmount: 2500.00, discountPercent: 0.00, netAmount: 2500.00 }
                    ]));
                }
            }
        } catch (e) {
            // Non-critical: table might already have records or during migration
        }
    });

    // Day 4: Commercial approval
    this.on('approveOrder', SalesOrders, async (req) => {
        // With @odata.draft.enabled, req.params[0] is { ID, IsActiveEntity }
        const { ID } = req.params[0];

        const tx = cds.transaction(req);

        const order = await tx.run(
            SELECT.one.from(SalesOrders).where({ ID })
        );

        if (!order) {
            return req.reject(404, 'Sales order not found');
        }

        if (order.status !== 'New') {
            return req.reject(409, 'Only new orders can be approved');
        }

        await tx.run(
            UPDATE(SalesOrders)
                .set({ status: 'Approved' })
                .where({ ID })
        );

        return 'Order approved';
    });

    // Day 5: Reserve stock across available warehouses
    this.on('reserveStock', SalesOrders, async (req) => {
        const { ID } = req.params[0];
        const tx = cds.transaction(req);

        const order = await tx.run(
            SELECT.one.from(SalesOrders).where({ ID })
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
            SELECT.from(SalesOrderItems)
                .where({ parent_ID: ID })
        );

        if (!orderItems.length) {
            return req.reject(422, 'Sales order has no items');
        }

        // Aggregate demand for repeated product names
        const demand = new Map();

        for (const item of orderItems) {
            if (
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0
            ) {
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

        const products = await tx.run(
            SELECT.from(Products)
        );

        const productByName = new Map(
            products.map(product => [product.name, product.ID])
        );

        const stockItems = await tx.run(
            SELECT.from(StockItems)
        );

        const reservations = await tx.run(
            SELECT.from(StockReservations)
                .where({ status: 'Reserved' })
        );

        // Calculate quantities already reserved for each stock record
        const reservedByStock = new Map();

        for (const reservation of reservations) {
            reservedByStock.set(
                reservation.stockItem_ID,
                (reservedByStock.get(reservation.stockItem_ID) || 0)
                    + reservation.reservedQty
            );
        }

        // Validate and calculate every allocation before inserting anything
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
                const alreadyReserved =
                    reservedByStock.get(stock.ID) || 0;

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
                    `Insufficient stock for ${productName}. ` +
                    `Required: ${requiredQty}, available: ${requiredQty - remaining}`
                );
            }
        }

        // All products have sufficient stock. Insert reservations atomically.
        await tx.run(
            INSERT.into(StockReservations).entries(newReservations)
        );

        await tx.run(
            UPDATE(SalesOrders)
                .set({ status: 'StockConfirmed' })
                .where({ ID })
        );

        return `Stock reserved successfully. ${newReservations.length} reservation(s) created.`;
    });

    // Day 5: Dispatch order and deduct physical stock
    this.on('dispatchOrder', SalesOrders, async (req) => {
        const { ID } = req.params[0];
        const tx = cds.transaction(req);

        const order = await tx.run(
            SELECT.one.from(SalesOrders).where({ ID })
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

        // Aggregate reservations by stock record
        const reservedByStock = new Map();

        for (const reservation of reservations) {
            const stockID = reservation.stockItem_ID;

            reservedByStock.set(
                stockID,
                (reservedByStock.get(stockID) || 0)
                    + reservation.reservedQty
            );
        }

        // Fetch all affected stock records
        const stockIDs = [...reservedByStock.keys()];

        const stockItems = await tx.run(
            SELECT.from(StockItems).where({
                ID: { in: stockIDs }
            })
        );

        const stockByID = new Map(
            stockItems.map(stock => [stock.ID, stock])
        );

        // Validate all stock before performing any updates
        for (const [stockID, reservedQty] of reservedByStock) {
            const stock = stockByID.get(stockID);

            if (!stock || stock.quantity < reservedQty) {
                return req.reject(
                    409,
                    `Stock is insufficient for reservation ${stockID}`
                );
            }
        }

        // Deduct physical stock
        for (const [stockID, reservedQty] of reservedByStock) {
            const stock = stockByID.get(stockID);

            await tx.run(
                UPDATE(StockItems)
                    .set({ quantity: stock.quantity - reservedQty })
                    .where({ ID: stockID })
            );
        }

        // Mark reservations as fulfilled
        await tx.run(
            UPDATE(StockReservations)
                .set({ status: 'Fulfilled' })
                .where({
                    salesOrder_ID: ID,
                    status: 'Reserved'
                })
        );

        // Update order status
        await tx.run(
            UPDATE(SalesOrders)
                .set({ status: 'Dispatched' })
                .where({ ID })
        );

        return 'Order dispatched and stock deducted successfully';
    });
});
