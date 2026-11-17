
using raven.sales as sales from '../db/sales-schema';

service SalesService @(path: 'sales') {

    @requires: 'authenticated-user'
    entity Customers as projection on sales.Customers;

    @restrict: [
        { grant: 'READ',          to: ['authenticated-user', 'SalesUser', 'SalesManager', 'FulfillmentManager'] },
        { grant: 'CREATE',        to: ['authenticated-user', 'SalesUser'] },
        { grant: 'approveOrder',  to: ['authenticated-user', 'SalesManager'] },
        { grant: 'reserveStock',  to: ['authenticated-user', 'FulfillmentManager'] },
        { grant: 'dispatchOrder', to: ['authenticated-user', 'FulfillmentManager'] }
    ]
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
        @requires: 'SalesManager'
        action approveOrder() returns String;

        @requires: 'FulfillmentManager'
        action reserveStock() returns String;

        @requires: 'FulfillmentManager'
        action dispatchOrder() returns String;
    };

    @restrict: [
        { grant: 'READ',   to: ['SalesUser', 'SalesManager', 'FulfillmentManager'] },
        { grant: 'CREATE', to: 'SalesUser' }
    ]
    entity SalesOrderItems as projection on sales.SalesOrderItems;

    @readonly
    @cds.redirection.target: false
    @requires: 'authenticated-user'
    entity OrderFulfillmentSummary as select from sales.SalesOrders {
        key status,
        count(*) as orderCount : Integer
    } group by status;
}