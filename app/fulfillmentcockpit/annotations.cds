using FulfillmentService from '../../srv/fulfillment-service';

// ─── FulfillmentService.SalesOrders Annotations ─────────────────────────────

annotate FulfillmentService.SalesOrders with @(
    // Read-only on order master data (no create, edit, delete)
    Capabilities : {
        InsertRestrictions : { Insertable : false },
        UpdateRestrictions : { Updatable : false },
        DeleteRestrictions : { Deletable : false }
    },

    // Header info
    UI.HeaderInfo : {
        TypeName       : 'Fulfillment Order',
        TypeNamePlural : 'Fulfillment Orders',
        Title          : { Value : order },
        Description    : { Value : customer.name }
    },

    // Default selection fields for filter bar
    UI.SelectionFields : [
        status,
        customer_ID,
        orderDate
    ],

    // Default SelectionVariant for Actionable Warehouse Orders
    UI.SelectionVariant #DefaultActionableOrders : {
        Text : 'Actionable Orders',
        SelectOptions : [
            {
                PropertyName : status,
                Ranges : [
                    { Sign : #I, Option : #EQ, Low : 'Approved' },
                    { Sign : #I, Option : #EQ, Low : 'StockConfirmed' }
                ]
            }
        ]
    },

    // List Report Line Items
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : order,                Label : 'Order' },
        { $Type : 'UI.DataField', Value : customer.name,        Label : 'Customer' },
        { $Type : 'UI.DataField', Value : orderDate,            Label : 'Order Date' },
        { $Type : 'UI.DataField', Value : grossAmount,          Label : 'Gross Amount' },
        { $Type : 'UI.DataField', Value : netAmount,            Label : 'Net Amount' },
        {
            $Type                     : 'UI.DataField',
            Value                     : status,
            Label                     : 'Status',
            Criticality               : statusCriticality,
            CriticalityRepresentation : #WithoutIcon
        },
        {
            $Type              : 'UI.DataFieldForAction',
            Action             : 'FulfillmentService.reserveStock',
            Label              : 'Reserve Stock',
            InvocationGrouping : #Isolated
        },
        {
            $Type              : 'UI.DataFieldForAction',
            Action             : 'FulfillmentService.dispatchOrder',
            Label              : 'Dispatch Order',
            InvocationGrouping : #Isolated
        }
    ],

    // Object Page Header Facets
    UI.HeaderFacets : [
        { $Type : 'UI.ReferenceFacet', Target : '@UI.DataPoint#Status' },
        { $Type : 'UI.ReferenceFacet', Target : '@UI.DataPoint#Gross' },
        { $Type : 'UI.ReferenceFacet', Target : '@UI.DataPoint#Net' }
    ],

    UI.DataPoint #Status : {
        Value       : status,
        Title       : 'Fulfillment Status',
        Criticality : statusCriticality
    },
    UI.DataPoint #Gross : {
        Value : grossAmount,
        Title : 'Gross Amount'
    },
    UI.DataPoint #Net : {
        Value : netAmount,
        Title : 'Net Amount'
    },

    // Object Page Header Action Buttons
    UI.Identification : [
        {
            $Type  : 'UI.DataFieldForAction',
            Action : 'FulfillmentService.reserveStock',
            Label  : 'Reserve Stock'
        },
        {
            $Type  : 'UI.DataFieldForAction',
            Action : 'FulfillmentService.dispatchOrder',
            Label  : 'Dispatch Order'
        }
    ],

    // Object Page Body Facets
    UI.Facets : [
        {
            $Type  : 'UI.CollectionFacet',
            Label  : 'Order Overview',
            Facets : [
                { $Type : 'UI.ReferenceFacet', Target : '@UI.FieldGroup#OrderDetails', Label : 'Order Details' }
            ]
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Order Items',
            Target : 'items/@UI.LineItem'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Stock Reservations',
            Target : 'reservations/@UI.LineItem'
        }
    ],

    UI.FieldGroup #OrderDetails : {
        Data : [
            { $Type : 'UI.DataField', Value : order,                Label : 'Order Number' },
            { $Type : 'UI.DataField', Value : customer.name,        Label : 'Customer Name' },
            { $Type : 'UI.DataField', Value : orderDate,            Label : 'Order Date' },
            { $Type : 'UI.DataField', Value : status,               Label : 'Fulfillment Status', Criticality : statusCriticality },
            { $Type : 'UI.DataField', Value : grossAmount,          Label : 'Gross Amount' },
            { $Type : 'UI.DataField', Value : netAmount,            Label : 'Net Amount' }
        ]
    }
);

// ── Operation Availability and Side Effects ────────────────────────────────

annotate FulfillmentService.SalesOrders actions {
    reserveStock @(
        Core.OperationAvailable : in.canReserve,
        Common.SideEffects : {
            TargetEntities : [
                in,
                in.reservations
            ],
            TargetProperties : [
                'in/status',
                'in/statusCriticality',
                'in/canReserve',
                'in/canDispatch'
            ]
        }
    );

    dispatchOrder @(
        Core.OperationAvailable : in.canDispatch,
        Common.SideEffects : {
            TargetEntities : [
                in,
                in.reservations
            ],
            TargetProperties : [
                'in/status',
                'in/statusCriticality',
                'in/canReserve',
                'in/canDispatch'
            ]
        }
    );
};

// ── SalesOrderItems Line Item ──────────────────────────────────────────────

annotate FulfillmentService.SalesOrderItems with @(
    Capabilities : {
        InsertRestrictions : { Insertable : false },
        UpdateRestrictions : { Updatable : false },
        DeleteRestrictions : { Deletable : false }
    },
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : product,   Label : 'Product' },
        { $Type : 'UI.DataField', Value : quantity,  Label : 'Quantity' },
        { $Type : 'UI.DataField', Value : unitPrice, Label : 'Unit Price' }
    ]
);

// ── StockReservations Line Item ────────────────────────────────────────────

annotate FulfillmentService.StockReservations with @(
    Capabilities : {
        InsertRestrictions : { Insertable : false },
        UpdateRestrictions : { Updatable : false },
        DeleteRestrictions : { Deletable : false }
    },
    UI.LineItem : [
        { $Type : 'UI.DataField', Value : productName,   Label : 'Product' },
        { $Type : 'UI.DataField', Value : warehouseName, Label : 'Warehouse' },
        { $Type : 'UI.DataField', Value : reservedQty,   Label : 'Reserved Quantity' },
        {
            $Type                     : 'UI.DataField',
            Value                     : status,
            Label                     : 'Reservation Status',
            Criticality               : #Positive,
            CriticalityRepresentation : #WithoutIcon
        }
    ]
);

// ── Field-level value helps & text arrangements ────────────────────────────

annotate FulfillmentService.SalesOrders with {
    customer @(
        Common.Text : customer.name,
        Common.TextArrangement : #TextOnly,
        Common.ValueList : {
            CollectionPath : 'Customers',
            Parameters : [
                { $Type : 'Common.ValueListParameterOut', LocalDataProperty : customer_ID, ValueListProperty : 'ID' },
                { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'name' },
                { $Type : 'Common.ValueListParameterDisplayOnly', ValueListProperty : 'customerType' }
            ]
        }
    );
};
