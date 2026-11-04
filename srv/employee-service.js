import cds from '@sap/cds';

export default cds.service.impl(async function () {
    const { Employees } = this.entities;

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    this.before('CREATE', Employees, async (req) => {
        const { email, employeeCode } = req.data;

        if (!email || !EMAIL_RE.test(email)) {
            return req.error(
                400,
                `'${email}' is not a valid email address`,
                'email'
            );
        }

        const duplicate = await SELECT.one
            .from(Employees)
            .where({ employeeCode });

        if (duplicate) {
            return req.error(
                409,
                `employeeCode '${employeeCode}' already exists`,
                'employeeCode'
            );
        }
    });
});
