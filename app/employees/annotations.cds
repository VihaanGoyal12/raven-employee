using EmployeeService as service from '../../srv/employee-service';

annotate service.Employees with @(
    UI.HeaderInfo: {
        TypeName       : 'Employee',
        TypeNamePlural : 'Employees',
        Title          : { Value: fullName },
        Description    : { Value: employeeCode }
    },
    UI.SelectionFields: [
        department_ID,
        status,
        dateOfJoining
    ],
    UI.LineItem: [
        { Value: employeeCode },
        { Value: fullName, Label: 'Name' },
        { Value: email },
        { Value: department_ID },
        { Value: dateOfJoining },
        { Value: status, Criticality: statusCriticality }
    ],
    UI.HeaderFacets: [
        { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Header' }
    ],
    UI.FieldGroup #Header : {
        Data: [
            { Value: department_ID },
            { Value: status, Criticality: statusCriticality },
            { Value: dateOfJoining },
            { Value: department.costCenter, Label: 'Cost Center' }
        ]
    },
    UI.FieldGroup #General : {
        Data: [
            { Value: employeeCode },
            { Value: firstName },
            { Value: lastName },
            { Value: department_ID },
            { Value: dateOfJoining },
            { Value: status, Criticality: statusCriticality }
        ]
    },
    UI.FieldGroup #Contact : {
        Data: [
            { Value: email },
            { Value: phone }
        ]
    },
    UI.Facets: [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'General',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#General'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'Contact',
            Label  : 'Contact',
            Target : '@UI.FieldGroup#Contact'
        }
    ]
);

annotate service.Employees with {
    department @(
        Common.Text            : department.name,
        Common.TextArrangement : #TextOnly,
        Common.ValueList       : {
            CollectionPath : 'Departments',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : department_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'costCenter'
                }
            ]
        }
    );
    status @(
        Common.ValueListWithFixedValues : true,
        Common.ValueList               : {
            CollectionPath : 'EmployeeStatuses',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : status,
                    ValueListProperty : 'code'
                }
            ]
        }
    );
    statusCriticality @UI.Hidden;
};
