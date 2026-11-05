using raven.inventory as inv from '../db/inventory-schema';

service InventoryService {

    entity Warehouses as projection on inv.Warehouses;

    entity Products as projection on inv.Products;

    entity StockItems as projection on inv.StockItems;

    entity StockSummary as projection on inv.StockSummary;

    action transferStock(
        fromWarehouse : UUID,
        toWarehouse : UUID,
        product : UUID,
        quantity : Integer
    ) returns String;

    function getStockAvailability(
        warehouse : UUID,
        product : UUID
    ) returns Integer;

}