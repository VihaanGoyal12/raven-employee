namespace raven.fulfillment;

using raven.sales as sales from './sales-schema';
using raven.inventory as inv from './inventory-schema';

entity StockReservations {
    key ID       : UUID;
    salesOrder   : Association to sales.SalesOrders @mandatory;
    stockItem    : Association to inv.StockItems @mandatory;
    reservedQty  : Integer @mandatory;
    status       : String(20) default 'Reserved';
}
