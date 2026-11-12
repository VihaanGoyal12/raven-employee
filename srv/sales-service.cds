
using raven.sales as sales from '../db/sales-schema';

service SalesService @(path: 'sales') {

    @requires: 'authenticated-user'
    entity Customers as projection on sales.Customers;

    @restrict: [
        { grant: 'READ',          to: ['SalesUser', 'SalesManager', 'FulfillmentManager'] },
        { grant: 'CREATE',        to: 'SalesUser' },
        { grant: 'approveOrder',  to: 'SalesManager' },
        { grant: 'reserveStock',  to: 'FulfillmentManager' },
        { grant: 'dispatchOrder', to: 'FulfillmentManager' }
    ]
    @odata.draft.enabled
    entity SalesOrders as projection on sales.SalesOrders {
        *,
        items : redirected to SalesOrderItems,

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
    @restrict: [
        { grant: 'READ', to: ['SalesUser', 'SalesManager', 'FulfillmentManager'] }
    ]
    entity OrderFulfillmentSummary as select from sales.SalesOrders {
        key status,
        count(*) as orderCount : Integer
    } group by status;
}