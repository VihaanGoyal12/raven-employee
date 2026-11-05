namespace raven.inventory;

entity Warehouses {
    key ID : UUID;
    name : String(60) @mandatory;
    location : String(80);
}

entity Products {
    key ID : UUID;
    sku : String(20) @mandatory;
    name : String(100) @mandatory;
}

entity StockItems {
    key ID : UUID;
    warehouse : Association to Warehouses @mandatory;
    product : Association to Products @mandatory;
    quantity : Integer @mandatory @assert.range: [0, 1000000];
}

@readonly
entity StockSummary as select from StockItems {
    key product.name as productName : String(100),
    sum(quantity) as totalQuantity : Integer
} group by product.name;