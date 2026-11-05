
using raven.procurement as proc from '../db/procurement-schema';

service ProcurementService {
    entity Suppliers as projection on proc.Suppliers;

    entity PurchaseOrders as projection on proc.PurchaseOrders {
        *,
        items : redirected to PurchaseOrderItems
    };

    entity PurchaseOrderItems as projection on proc.PurchaseOrderItems;
}
