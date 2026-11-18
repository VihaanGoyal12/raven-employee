import cds from '@sap/cds';

const { SELECT, INSERT } = cds.ql;

export async function ensureSeedData() {
    try {
        const { SalesOrders, Customers, SalesOrderItems } = cds.entities('raven.sales');
        const { StockReservations } = cds.entities('raven.fulfillment');

        if (!SalesOrders) return;

        const countResult = await cds.run(SELECT.one.from(SalesOrders).columns('count(*) as cnt'));
        const count = Number(countResult?.cnt ?? countResult?.CNT ?? 0);
        if (count > 0) return;

        // Ensure Customers exist
        if (Customers) {
            const custCount = await cds.run(SELECT.one.from(Customers).columns('count(*) as cnt'));
            if (Number(custCount?.cnt ?? custCount?.CNT ?? 0) === 0) {
                await cds.run(INSERT.into(Customers).entries([
                    { ID: '11111111-1111-4111-8111-111111111111', name: 'Acme Regular', customerType: 'Regular' },
                    { ID: '22222222-2222-4222-8222-222222222222', name: 'Premium Corp', customerType: 'Premium' },
                    { ID: '33333333-3333-4333-8333-333333333333', name: 'Small Business', customerType: 'Regular' }
                ]));
            }
        }

        // Insert Orders
        const seedOrders = [
            { ID: 'a1111111-1111-4111-8111-111111111111', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-01', status: 'New', grossAmount: 1200.00, discountPercent: 10.00, netAmount: 1080.00 },
            { ID: 'a2222222-2222-4222-8222-222222222222', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-02', status: 'Dispatched', grossAmount: 800.00, discountPercent: 10.00, netAmount: 720.00 },
            { ID: 'a3333333-3333-4333-8333-333333333333', customer_ID: '22222222-2222-4222-8222-222222222222', orderDate: '2026-11-03', status: 'Approved', grossAmount: 5000.00, discountPercent: 0.00, netAmount: 5000.00 },
            { ID: 'a4444444-4444-4444-8444-444444444444', customer_ID: '22222222-2222-4222-8222-222222222222', orderDate: '2026-11-04', status: 'StockConfirmed', grossAmount: 300.00, discountPercent: 0.00, netAmount: 300.00 },
            { ID: 'a5555555-5555-4555-8555-555555555555', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-05', status: 'Dispatched', grossAmount: 1500.00, discountPercent: 10.00, netAmount: 1350.00 },
            { ID: 'a6666666-6666-4666-8666-666666666666', customer_ID: '22222222-2222-4222-8222-222222222222', orderDate: '2026-11-06', status: 'Dispatched', grossAmount: 700.00, discountPercent: 0.00, netAmount: 700.00 },
            { ID: 'a7777777-7777-4777-8777-777777777777', customer_ID: '11111111-1111-4111-8111-111111111111', orderDate: '2026-11-07', status: 'Approved', grossAmount: 3000.00, discountPercent: 0.00, netAmount: 3000.00 }
        ];
        await cds.run(INSERT.into(SalesOrders).entries(seedOrders));

        // Insert Items
        if (SalesOrderItems) {
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
            await cds.run(INSERT.into(SalesOrderItems).entries(seedItems));
        }

        // Insert Stock Reservation for SO-004
        if (StockReservations) {
            await cds.run(INSERT.into(StockReservations).entries([
                {
                    ID: 'c4444444-4444-4444-8444-444444444441',
                    salesOrder_ID: 'a4444444-4444-4444-8444-444444444444',
                    stockItem_ID: 'a2d8bd94-09bf-49be-8ca9-943248559d93',
                    reservedQty: 1,
                    status: 'Reserved'
                }
            ]));
        }
        console.log('[seed] Successfully initialized 7 sales orders, items, and reservations');
    } catch (e) {
        console.error('[seed] Error ensuring seed data:', e);
    }
}
