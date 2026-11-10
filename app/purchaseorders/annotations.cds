using ProcurementService as service from '../../srv/procurement-service';

annotate service.PurchaseOrders with @(
    UI.HeaderInfo: {
        TypeName       : 'Purchase Order',
        TypeNamePlural : 'Purchase Orders',
        Title          : { Value: poNumber },
        Description    : { Value: supplier.name }
    },
    UI.SelectionFields: [
        supplier_ID,
        status,
        orderDate
    ],
    UI.LineItem: [
        { Value: poNumber, Label: 'PO Number' },
        { Value: supplier_ID, Label: 'Supplier' },
        { Value: orderDate, Label: 'Order Date' },
        { Value: status, Criticality: statusCriticality, Label: 'Status' },
        { Value: totalAmount, Label: 'Total Amount' }
    ],
    UI.HeaderFacets: [
        {
            $Type  : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#CreditLimit'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#TotalAmount'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#Status'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Target : '@UI.DataPoint#OrderDate'
        }
    ],
    UI.DataPoint #CreditLimit : {
        Value : supplier.creditLimit,
        Title : 'Supplier Credit Limit'
    },
    UI.DataPoint #TotalAmount : {
        Value : totalAmount,
        Title : 'Total Amount'
    },
    UI.DataPoint #Status : {
        Value       : status,
        Title       : 'Status',
        Criticality : statusCriticality
    },
    UI.DataPoint #OrderDate : {
        Value : orderDate,
        Title : 'Order Date'
    },
    UI.FieldGroup #General : {
        Data: [
            { Value: poNumber, Label: 'PO Number' },
            { Value: supplier_ID, Label: 'Supplier' },
            { Value: orderDate, Label: 'Order Date' },
            { Value: status, Criticality: statusCriticality, Label: 'Status' },
            { Value: totalAmount, Label: 'Total Amount' }
        ]
    },
    UI.Facets: [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneralInfo',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#General'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'ItemsSection',
            Label  : 'Items',
            Target : 'items/@UI.LineItem'
        }
    ]
);

annotate service.PurchaseOrders with {
    poNumber    @mandatory @Common.Label: 'PO Number';
    supplier    @(
        Common.Label           : 'Supplier',
        Common.Text            : supplier.name,
        Common.TextArrangement : #TextOnly,
        Common.ValueList       : {
            CollectionPath : 'Suppliers',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterInOut',
                    LocalDataProperty : supplier_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'creditLimit'
                }
            ]
        }
    );
    totalAmount @(
        Common.Label         : 'Total Amount',
        Measures.ISOCurrency : 'INR'
    );
};

annotate service.PurchaseOrderItems with @(
    UI.LineItem: [
        { Value: productName, Label: 'Product' },
        { Value: quantity, Label: 'Quantity' },
        { Value: unitPrice, Label: 'Unit Price' },
        { Value: lineTotal, Label: 'Line Total' }
    ],
    Common.SideEffects #RecalculateTotals: {
        SourceProperties : [
            quantity,
            unitPrice
        ],
        TargetProperties : [
            'lineTotal',
            'parent/totalAmount'
        ]
    }
);

annotate service.PurchaseOrderItems with {
    productName @mandatory @Common.Label: 'Product';
    quantity    @mandatory @Common.Label: 'Quantity';
    unitPrice   @mandatory @Common.Label: 'Unit Price' @Measures.ISOCurrency: 'INR';
    lineTotal   @readonly  @Common.Label: 'Line Total' @Measures.ISOCurrency: 'INR';
};

annotate service.Suppliers with {
    creditLimit @Common.Label: 'Credit Limit' @Measures.ISOCurrency: 'INR';
};

