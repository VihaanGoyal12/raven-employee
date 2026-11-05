import cds from '@sap/cds';

export default cds.service.impl(async function () {
    const { SalesOrders, Customers } = this.entities;

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

        const result = await cds.run(
            `CALL "CALC_DISCOUNT"(
                CUSTOMERTYPE => ?,
                GROSSAMOUNT => ?,
                DISCOUNTPERCENT => ?
            )`,
            [customer.customerType, grossAmount]
        );

        const discountPercent = Number(result.DISCOUNTPERCENT);

        req.data.discountPercent = discountPercent;
        req.data.netAmount =
            grossAmount * (1 - discountPercent / 100);
    });

    this.on('approveOrder', SalesOrders, async (req) => {
        const { ID } = req.params[0];

        await UPDATE(SalesOrders)
            .set({ status: 'Approved' })
            .where({ ID });

        return 'Order approved';
    });
});