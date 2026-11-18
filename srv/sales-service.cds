
using raven.sales as sales from '../db/sales-schema';

service SalesService @(path: 'sales') {

    entity Customers as projection on sales.Customers;

    @odata.draft.enabled
    entity SalesOrders as projection on sales.SalesOrders {
        *,
        items : redirected to SalesOrderItems,

        virtual null as order             : String(20),
        virtual null as canApprove        : Boolean,

        case
            when status = 'Approved' then 3
            else 5
        end as statusCriticality          : Integer
    }
    actions {
        action approveOrder() returns String;
        action reserveStock() returns String;
        action dispatchOrder() returns String;
    };

    entity SalesOrderItems as projection on sales.SalesOrderItems;

    @readonly
    @cds.redirection.target: false
    entity OrderFulfillmentSummary as select from sales.SalesOrders {
        key status,
        count(*) as orderCount : Integer
    } group by status;
}