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

    // Day 9: Stable, sequential order numbers (SO-1001, SO-1002, etc.)
    const orderNumberCache = new Map();

    function resolveOrderNumber(id) {
        if (!id) return 'SO-001';
        if (!orderNumberCache.has(id)) {
            const nextNum = String(1 + orderNumberCache.size).padStart(3, '0');
            orderNumberCache.set(id, `SO-${nextNum}`);
        }
        return orderNumberCache.get(id);
    }

    this.after('READ', SalesOrders, (rows, req) => {
        const isManager = true;
        for (const o of [].concat(rows ?? [])) {
            if (o && typeof o === 'object') {
                o.order = resolveOrderNumber(o.ID);
                o.canApprove = isManager && o.status !== 'Approved';
            }
        }
    });

    // Initialize seed data and clean SO-001..SO-007 mapping on startup
    cds.on('served', async () => {
        try {
            const db = await cds.connect.to('db');
            const { SalesOrders: dbSalesOrders, SalesOrderItems: dbSalesOrderItems, Customers: dbCustomers } = db.entities('raven.sales');
            const { StockReservations: dbStockReservations } = db.entities('raven.fulfillment');
            const { StockItems: dbStockItems } = db.entities('raven.inventory');

            // 1. Ensure Customers exist
            if (dbCustomers) {
                const customers = await db.run(SELECT.from(dbCustomers));
                if (!customers || customers.length === 0) {
                    await db.run(INSERT.into(dbCustomers).entries([
                        { ID: '11111111-1111-4111-8111-111111111111', name: 'Acme Regular', customerType: 'Regular' },
                        { ID: '22222222-2222-4222-8222-222222222222', name: 'Premium Corp', customerType: 'Premium' },
                        { ID: '33333333-3333-4333-8333-333333333333', name: 'Small Business', customerType: 'Regular' }
                    ]));
                }
            }

            // 2. Ensure SalesOrders & SalesOrderItems exist
            if (dbSalesOrders && dbSalesOrderItems) {
                const existingOrders = await db.run(SELECT.from(dbSalesOrders));
                if (!existingOrders || existingOrders.length === 0) {
                    const seedOrders = [
                        { ID: 'a1111111-1111-4111-8111-111111111111', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-01', status: 'New', grossAmount: 1200.00, discountPercent: 10.00, netAmount: 1080.00 },
                        { ID: 'a2222222-2222-4222-8222-222222222222', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-02', status: 'Dispatched', grossAmount: 800.00, discountPercent: 10.00, netAmount: 720.00 },
                        { ID: 'a3333333-3333-4333-8333-333333333333', customer_ID: '22222222-2222-4222-8222-222222222222', orderDate: '2026-11-03', status: 'Approved', grossAmount: 5000.00, discountPercent: 0.00, netAmount: 5000.00 },
                        { ID: 'a4444444-4444-4444-8444-444444444444', customer_ID: '22222222-2222-4222-8222-222222222222', orderDate: '2026-11-04', status: 'StockConfirmed', grossAmount: 300.00, discountPercent: 0.00, netAmount: 300.00 },
                        { ID: 'a5555555-5555-4555-8555-555555555555', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-05', status: 'Dispatched', grossAmount: 1500.00, discountPercent: 10.00, netAmount: 1350.00 },
                        { ID: 'a6666666-6666-4666-8666-666666666666', customer_ID: '22222222-2222-4222-8222-222222222222', orderDate: '2026-11-06', status: 'Dispatched', grossAmount: 700.00, discountPercent: 0.00, netAmount: 700.00 },
                        { ID: 'a7777777-7777-4777-8777-777777777777', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-07', status: 'Approved', grossAmount: 3000.00, discountPercent: 0.00, netAmount: 3000.00 }
                    ];
                    await db.run(INSERT.into(dbSalesOrders).entries(seedOrders));

                    const seedItems = [
                        { ID: 'b1111111-1111-4111-8111-111111111111', parent_ID: 'a1111111-1111-4111-8111-111111111111', product: 'Laptop', quantity: 2, unitPrice: 500.00 },
                        { ID: 'b1111111-1111-4111-8111-111111111112', parent_ID: 'a1111111-1111-4111-8111-111111111111', product: 'Mouse', quantity: 10, unitPrice: 20.00 },
                        { ID: 'b2222222-2222-4222-8222-222222222221', parent_ID: 'a2222222-2222-4222-8222-222222222222', product: 'Mouse', quantity: 40, unitPrice: 20.00 },
                        { ID: 'b3333333-3333-4333-8333-333333333331', parent_ID: 'a3333333-3333-4333-8333-333333333333', product: 'Laptop', quantity: 10, unitPrice: 500.00 },
                        { ID: 'b4444444-4444-4444-8444-444444444441', parent_ID: 'a4444444-4444-4444-8444-444444444444', product: 'Laptop', quantity: 1, unitPrice: 300.00 },
                        { ID: 'b5555555-5555-4555-8555-555555555551', parent_ID: 'a5555555-5555-4555-8555-555555555555', product: 'Laptop', quantity: 3, unitPrice: 500.00 },
                        { ID: 'b6666666-6666-4666-8666-666666666661', parent_ID: 'a6666666-6666-4666-8666-666666666666', product: 'Laptop', quantity: 1, unitPrice: 500.00 },
                        { ID: 'b6666666-6666-4666-8666-666666666662', parent_ID: 'a6666666-6666-4666-8666-666666666666', product: 'Mouse', quantity: 10, unitPrice: 20.00 },
                        { ID: 'b7777777-7777-4777-8777-777777777771', parent_ID: 'a7777777-7777-4777-8777-777777777777', product: 'Laptop', quantity: 60, unitPrice: 50.00 }
                    ];
                    await db.run(INSERT.into(dbSalesOrderItems).entries(seedItems));
                }
            }

            // 3. Ensure StockReservations exists for SO-004
            if (dbStockReservations) {
                const existingRes = await db.run(SELECT.from(dbStockReservations));
                if (!existingRes || existingRes.length === 0) {
                    let stockItemId = 'a2d8bd94-09bf-49be-8ca9-943248559d93';
                    if (dbStockItems) {
                        const stockItem = await db.run(SELECT.one.from(dbStockItems));
                        if (stockItem && stockItem.ID) stockItemId = stockItem.ID;
                    }
                    await db.run(INSERT.into(dbStockReservations).entries([
                        {
                            ID: 'c4444444-4444-4444-8444-444444444441',
                            salesOrder_ID: 'a4444444-4444-4444-8444-444444444444',
                            stockItem_ID: stockItemId,
                            reservedQty: 1,
                            status: 'Reserved'
                        }
                    ]));
                }
            }

            // 4. Update orderNumberCache
            const allOrders = await db.run(
                SELECT.from(dbSalesOrders).columns('ID').orderBy('orderDate asc', 'ID asc')
            );
            if (allOrders && allOrders.length > 0) {
                let startNum = 1;
                for (const ord of allOrders) {
                    if (ord.ID) {
                        const numStr = String(startNum++).padStart(3, '0');
                        orderNumberCache.set(ord.ID, `SO-${numStr}`);
                    }
                }
            }
        } catch (e) {
            console.error('[sales-service] Error initializing seed data:', e);
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
