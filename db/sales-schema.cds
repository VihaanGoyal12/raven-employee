namespace raven.sales;

entity Customers {
    key ID : UUID;
    name : String(100) @mandatory;
    customerType : String(20) @mandatory;
}

entity SalesOrders {
    key ID : UUID;
    orderNumber  : String(10) @readonly;
    customer : Association to Customers @mandatory;
    orderDate : Date default $now;
    status : String(20) default 'New';
    grossAmount : Decimal(15,2) @mandatory;
    discountPercent : Decimal(5,2) @readonly;
    netAmount : Decimal(15,2) @readonly;

    items : Composition of many SalesOrderItems
        on items.parent = $self;
}

entity SalesOrderItems {
    key ID : UUID;
    parent : Association to SalesOrders;
    product : String(100) @mandatory;
    quantity : Integer @mandatory;
    unitPrice : Decimal(15,2) @mandatory;
}
