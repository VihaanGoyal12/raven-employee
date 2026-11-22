namespace raven.sales;

entity Customers {
    key ID           : UUID;
    name             : String(100) @mandatory;
    customerType     : String(20)  @mandatory; // 'Premium' or 'Regular'
}

entity SalesOrders {
    key ID              : UUID;
    orderNumber         : String(50)  @mandatory;
    customer            : Association to Customers @mandatory;
    orderDate           : Date default $now;
    status              : String(30) default 'New'; // 'New', 'PendingApproval', 'InFinanceReview', 'Approved', 'Rejected'
    grossAmount         : Decimal(15,2) default 0.00;
    discountPercent     : Decimal(5,2)  default 0.00;
    netAmount           : Decimal(15,2) default 0.00;
    hodComment          : String(500);
    financeComment      : String(500);
    workflowInstanceId  : String(100);
    requestedBy         : String(100) default 'vihaangoyal31@gmail.com';
    requestedByEmail    : String(100) default 'vihaangoyal31@gmail.com';

    items               : Composition of many SalesOrderItems
                            on items.parent = $self;
}

entity SalesOrderItems {
    key ID              : UUID;
    parent              : Association to SalesOrders;
    product             : String(100) @mandatory;
    quantity            : Integer     @mandatory;
    unitPrice           : Decimal(15,2) @mandatory;
}
