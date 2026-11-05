using raven.sales as sales from '../db/sales-schema';

service SalesService {
    entity Customers as projection on sales.Customers;

    @requires: 'SalesUser'
    entity SalesOrders as projection on sales.SalesOrders
        {
            *,
            items: redirected to SalesOrderItems
        }
        actions {
            @requires: 'SalesManager'
            action approveOrder() returns String;
        };

    entity SalesOrderItems as projection on sales.SalesOrderItems;
}
