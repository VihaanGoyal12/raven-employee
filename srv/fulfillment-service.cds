using raven.fulfillment as fulfillment from '../db/fulfillment-schema';
using raven.sales as sales from '../db/sales-schema';

service FulfillmentService @(path: 'fulfillment') {

    @readonly
    entity Customers as projection on sales.Customers;

    @readonly
    entity SalesOrders as projection on sales.SalesOrders {
        *,
        customer : redirected to Customers,
        items : redirected to SalesOrderItems,
        reservations : Association to many StockReservations on reservations.salesOrder = $self,

        virtual null as order : String(20),

        case
            when status = 'Approved' then 5
            when status = 'StockConfirmed' then 2
            when status = 'Dispatched' then 3
            else 0
        end as statusCriticality : Integer,

        case
            when status = 'Approved' then true
            else false
        end as canReserve : Boolean,

        case
            when status = 'StockConfirmed' then true
            else false
        end as canDispatch : Boolean
    } actions {
        action reserveStock() returns String;
        action dispatchOrder() returns String;
    };

    @readonly
    entity SalesOrderItems as projection on sales.SalesOrderItems;

    @readonly
    entity StockReservations as projection on fulfillment.StockReservations {
        *,
        stockItem.product.name as productName : String(100),
        stockItem.warehouse.name as warehouseName : String(60),
        salesOrder : redirected to SalesOrders
    };

    @readonly
    @cds.redirection.target: false
    entity OrderFulfillmentSummary as select from sales.SalesOrders {
        key status,
        count(*) as orderCount : Integer
    } group by status;
}
