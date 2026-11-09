sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"raven/employeedirectory/employees/test/integration/pages/EmployeesList.gen",
	"raven/employeedirectory/employees/test/integration/pages/EmployeesObjectPage.gen"
], function (JourneyRunner, EmployeesListGenerated, EmployeesObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('raven/employeedirectory/employees') + '/test/flp.html#app-preview',
        pages: {
			onTheEmployeesListGenerated: EmployeesListGenerated,
			onTheEmployeesObjectPageGenerated: EmployeesObjectPageGenerated
        },
        async: true
    });

    return runner;
});

