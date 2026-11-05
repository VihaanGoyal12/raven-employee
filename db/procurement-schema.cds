
namespace raven.procurement;

entity Suppliers {
    key ID          : UUID;
    name            : String(100) @mandatory;
    creditLimit     : Decimal(15,2) @mandatory;
}

entity PurchaseOrders {
    key ID          : UUID;
    poNumber        : String(20) @mandatory;
    supplier        : Association to Suppliers @mandatory;
    orderDate       : Date default $now;
    status          : String(20) default 'Draft';
    totalAmount     : Decimal(15,2) @readonly;

    items           : Composition of many PurchaseOrderItems
                      on items.parent = $self;
}

entity PurchaseOrderItems {
    key ID          : UUID;
    parent          : Association to PurchaseOrders;
    productName     : String(100) @mandatory;
    quantity        : Integer @mandatory @assert.range: [1, 100000];
    unitPrice       : Decimal(15,2) @mandatory;
    lineTotal       : Decimal(15,2) @readonly;
}
