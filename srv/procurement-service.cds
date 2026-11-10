using raven.procurement as proc from '../db/procurement-schema';

@path: 'procurement'
@requires: 'any'
service ProcurementService {
    entity Suppliers as projection on proc.Suppliers;

    @odata.draft.enabled
    entity PurchaseOrders as projection on proc.PurchaseOrders {
        *,
        items : redirected to PurchaseOrderItems,
        case
            when status = 'Approved'  then 3
            when status = 'Submitted' then 5
            when status = 'Rejected'  then 1
            else 0
        end as statusCriticality : Integer
    };

    entity PurchaseOrderItems as projection on proc.PurchaseOrderItems;
}
