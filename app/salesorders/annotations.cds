using SalesService from '../../srv/sales-service';

// ─── SalesOrders ───────────────────────────────────────────────────────────

annotate SalesService.SalesOrders with @(

    // List Report / Object Page header
    UI.HeaderInfo: {
        TypeName       : 'Sales Order',
        TypeNamePlural : 'Sales Orders',
        Title          : { Value: orderNumber },
        Description    : { Value: status }
    },

    // List Report columns
    UI.LineItem: [
        { $Type: 'UI.DataField',                 Value: orderNumber,   Label: 'Order No.'  },
        { $Type: 'UI.DataField',                 Value: customer_ID,   Label: 'Customer'   },
        { $Type: 'UI.DataField',                 Value: orderDate,     Label: 'Order Date' },
        { $Type: 'UI.DataField',                 Value: grossAmount,   Label: 'Gross Amt'  },
        { $Type: 'UI.DataField',                 Value: discountPercent, Label: 'Discount %'},
        { $Type: 'UI.DataField',                 Value: netAmount,     Label: 'Net Amount' },
        { $Type: 'UI.DataFieldWithCriticality',  Value: status,        Label: 'Status',    Criticality: statusCriticality }
    ],

    // Filter bar fields
    UI.SelectionFields: [ customer_ID, status, orderDate ],

    // ── Object Page header KPIs ────────────────────────────────────────────
    UI.HeaderFacets: [
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#gross'        },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#discount'     },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#net'          },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#customerType' },
        { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#status'       }
    ],

    UI.DataPoint#gross: {
        Value : grossAmount,
        Title : 'Gross Amount'
    },
    UI.DataPoint#discount: {
        Value : discountPercent,
        Title : 'Discount %'
    },
    UI.DataPoint#net: {
        Value : netAmount,
        Title : 'Net Amount'
    },
    UI.DataPoint#customerType: {
        Value : customer.customerType,
        Title : 'Customer Type'
    },
    UI.DataPoint#status: {
        Value       : status,
        Title       : 'Status',
        Criticality : statusCriticality
    },

    // ── Approve action on Object Page header ──────────────────────────────
    UI.Identification: [
        {
            $Type  : 'UI.DataFieldForAction',
            Action : 'SalesService.approveOrder',
            Label  : 'Approve'
        }
    ],

    // ── Object Page body facets ───────────────────────────────────────────
    UI.Facets: [
        {
            $Type  : 'UI.CollectionFacet',
            Label  : 'General Information',
            Facets : [
                { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#general' }
            ]
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Order Items',
            Target : 'items/@UI.LineItem'
        }
    ],

    UI.FieldGroup#general: {
        Data: [
            { $Type: 'UI.DataField', Value: orderNumber,    Label: 'Order No.'   },
            { $Type: 'UI.DataField', Value: customer_ID,    Label: 'Customer'    },
            { $Type: 'UI.DataField', Value: orderDate,       Label: 'Order Date'  },
            { $Type: 'UI.DataField', Value: grossAmount,     Label: 'Gross Amount'},
            { $Type: 'UI.DataField', Value: discountPercent, Label: 'Discount %'  },
            { $Type: 'UI.DataField', Value: netAmount,       Label: 'Net Amount'  },
            { $Type: 'UI.DataFieldWithCriticality', Value: status, Label: 'Status', Criticality: statusCriticality }
        ]
    }
);

// ── Field-level annotations ────────────────────────────────────────────────

annotate SalesService.SalesOrders with {
    customer       @Common.Text: customer.name  @Common.TextArrangement: #TextOnly;
    discountPercent @Core.Computed: true;
    netAmount       @Core.Computed: true;
};

// Customer value help
annotate SalesService.SalesOrders with {
    customer @(Common.ValueList: {
        CollectionPath : 'Customers',
        Parameters     : [
            { $Type: 'Common.ValueListParameterOut',         LocalDataProperty: customer_ID, ValueListProperty: 'ID'           },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name'                                         },
            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'customerType'                                 }
        ]
    });
};

// ── approveOrder: OperationAvailable + SideEffects ────────────────────────

annotate SalesService.SalesOrders actions {
    approveOrder @(
        Core.OperationAvailable : { $edmJson: { $Path: 'in/canApprove' } },
        Common.SideEffects      : {
            TargetProperties: [
                'in/status',
                'in/canApprove',
                'in/statusCriticality'
            ]
        }
    );
};

// ─── SalesOrderItems ───────────────────────────────────────────────────────

annotate SalesService.SalesOrderItems with @(
    UI.LineItem: [
        { $Type: 'UI.DataField', Value: product,   Label: 'Product'    },
        { $Type: 'UI.DataField', Value: quantity,  Label: 'Quantity'   },
        { $Type: 'UI.DataField', Value: unitPrice, Label: 'Unit Price' }
    ]
);
