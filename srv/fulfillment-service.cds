
using raven.fulfillment as fulfillment from '../db/fulfillment-schema';

service FulfillmentService {

    @readonly
    @requires: 'FulfillmentManager'
    entity StockReservations as projection on fulfillment.StockReservations;

}
