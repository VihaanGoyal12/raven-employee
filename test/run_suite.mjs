import http from 'http';
import cds from '@sap/cds';

const BASE = 'http://localhost:4004';

const authHeaders = {
  admin: 'Basic ' + Buffer.from('admin:pass').toString('base64'),
  SalesUser: 'Basic ' + Buffer.from('sally:pass').toString('base64'),
  SalesManager: 'Basic ' + Buffer.from('max:pass').toString('base64'),
  FulfillmentManager: 'Basic ' + Buffer.from('alex:pass').toString('base64'),
};

async function req(method, path, body, auth = authHeaders.admin) {
  const headers = { 'Accept': 'application/json' };
  if (auth) headers['Authorization'] = auth;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, data: json, text };
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ ${testName} - ${details}`);
    failed++;
  }
}

async function run() {
  console.log("============================================================");
  console.log("🚀 EXECUTING COMPLETE END-TO-END SUITE (DAYS 1 TO 5)");
  console.log("============================================================\n");

  // DAY 1: EMPLOYEE SERVICE
  console.log("📁 [DAY 1] Employee & Department Lifecycle");
  const deptRes = await req('POST', '/odata/v4/employee/Departments', {
    name: 'Logistics',
    costCenter: 'LOG001'
  });
  assert(deptRes.status === 201 && deptRes.data.ID, 'Create Department (201)');
  const deptId = deptRes.data?.ID;

  const getDepts = await req('GET', '/odata/v4/employee/Departments');
  assert(getDepts.status === 200 && Array.isArray(getDepts.data?.value), 'Get Departments (200)');

  const empCode = 'EMP_' + Date.now().toString().slice(-4);
  const empRes = await req('POST', '/odata/v4/employee/Employees', {
    employeeCode: empCode,
    firstName: 'Dev',
    lastName: 'Tester',
    email: 'dev.tester@example.com',
    phone: '9876543210',
    dateOfJoining: '2026-11-01',
    department_ID: deptId,
    status: 'Active'
  });
  assert(empRes.status === 201 && empRes.data.ID, `Create Employee ${empCode} (201)`);
  const empId = empRes.data?.ID;

  const dupEmp = await req('POST', '/odata/v4/employee/Employees', {
    employeeCode: empCode,
    firstName: 'Copy',
    lastName: 'Cat',
    email: 'copy@example.com'
  });
  assert(dupEmp.status === 409, 'Duplicate employeeCode rejection (409)', dupEmp.text);

  const invalidEmail = await req('POST', '/odata/v4/employee/Employees', {
    employeeCode: 'EMP_INV',
    firstName: 'Bad',
    lastName: 'Email',
    email: 'not-an-email'
  });
  assert(invalidEmail.status === 400, 'Invalid email format rejection (400)', invalidEmail.text);

  const patchEmp = await req('PATCH', `/odata/v4/employee/Employees(${empId})`, {
    phone: '1112223333'
  });
  assert(patchEmp.status === 200 && patchEmp.data.phone === '1112223333', 'Update Employee phone (200)');

  const delEmp = await req('DELETE', `/odata/v4/employee/Employees(${empId})`);
  assert(delEmp.status === 204, 'Delete Employee (204)');

  const getDeleted = await req('GET', `/odata/v4/employee/Employees(${empId})`);
  assert(getDeleted.status === 404, 'Verify deleted Employee is 404');


  // DAY 2: PROCUREMENT SERVICE
  console.log("\n📁 [DAY 2] Procurement & Purchase Order Business Rules");
  const suppRes = await req('POST', '/odata/v4/procurement/Suppliers', {
    name: 'Apex Components Ltd',
    creditLimit: 50000.00
  });
  assert(suppRes.status === 201 && suppRes.data.ID, 'Create Supplier (201)');
  const suppId = suppRes.data?.ID;

  const getSupp = await req('GET', '/odata/v4/procurement/Suppliers');
  assert(getSupp.status === 200 && getSupp.data?.value?.length > 0, 'Get Suppliers list (200)');

  const poRes = await req('POST', '/odata/v4/procurement/PurchaseOrders', {
    poNumber: 'PO-' + Date.now().toString().slice(-4),
    supplier_ID: suppId,
    items: [
      { productName: 'Laptop', quantity: 1, unitPrice: 30000 },
      { productName: 'Mouse', quantity: 2, unitPrice: 500 }
    ]
  });
  assert(poRes.status === 201 && Number(poRes.data.totalAmount) === 31000, 'Create PO with items & calculated total (201, total=31000)');
  const poId = poRes.data?.ID;

  const getPo = await req('GET', `/odata/v4/procurement/PurchaseOrders(${poId})?$expand=items`);
  assert(getPo.status === 200 && getPo.data?.items?.length === 2, 'Get PO with expanded line items (200)');

  const creditFail = await req('POST', '/odata/v4/procurement/PurchaseOrders', {
    poNumber: 'PO-EXCEED',
    supplier_ID: suppId,
    items: [
      { productName: 'Server Rack', quantity: 1, unitPrice: 60000 }
    ]
  });
  assert(creditFail.status === 422, 'Exceed supplier credit limit rejection (422)', creditFail.text);

  const qtyFail = await req('POST', '/odata/v4/procurement/PurchaseOrders', {
    poNumber: 'PO-BADQTY',
    supplier_ID: suppId,
    items: [
      { productName: 'Cables', quantity: 0, unitPrice: 100 }
    ]
  });
  assert(qtyFail.status === 400, 'Invalid line item quantity rejection (400)', qtyFail.text);

  const noSuppFail = await req('POST', '/odata/v4/procurement/PurchaseOrders', {
    poNumber: 'PO-NOSUPP',
    supplier_ID: '00000000-0000-0000-0000-000000000000',
    items: [
      { productName: 'Laptop', quantity: 1, unitPrice: 1000 }
    ]
  });
  assert(noSuppFail.status === 404, 'Non-existent supplier rejection (404)', noSuppFail.text);


  // DAY 3: INVENTORY SERVICE
  console.log("\n📁 [DAY 3] Inventory & Warehouse Stock Operations");
  const whRes = await req('GET', '/odata/v4/inventory/Warehouses');
  assert(whRes.status === 200 && whRes.data?.value?.length >= 2, 'Get Warehouses (200)');
  const whDelhi = '06a2b02a-eede-49d0-8a56-7659c73bb0a1';
  const whNoida = '70026cba-6d43-4207-b4c0-fb1ba0a7c3b9';

  const prodRes = await req('GET', '/odata/v4/inventory/Products');
  assert(prodRes.status === 200 && prodRes.data?.value?.length >= 1, 'Get Products (200)');
  const laptopId = '017d960a-a927-4183-b153-340518fc0569';

  const stockItemsRes = await req('GET', '/odata/v4/inventory/StockItems');
  assert(stockItemsRes.status === 200 && stockItemsRes.data?.value?.length > 0, 'Get StockItems (200)');

  const summaryRes = await req('GET', '/odata/v4/inventory/StockSummary');
  assert(summaryRes.status === 200 && summaryRes.data?.value?.length > 0, 'Get StockSummary analytical view (200)');

  const availRes = await req('GET', `/odata/v4/inventory/getStockAvailability(warehouse=${whDelhi},product=${laptopId})`);
  assert(availRes.status === 200 && typeof availRes.data?.value === 'number', `getStockAvailability for Delhi Laptop (200)`);
  const initialDelhiQty = availRes.data.value;

  const transferRes = await req('POST', '/odata/v4/inventory/transferStock', {
    fromWarehouse: whDelhi,
    toWarehouse: whNoida,
    product: laptopId,
    quantity: 1
  });
  assert(transferRes.status === 200, 'transferStock 1 unit from Delhi to Noida (200)', transferRes.text);

  const transferOver = await req('POST', '/odata/v4/inventory/transferStock', {
    fromWarehouse: whDelhi,
    toWarehouse: whNoida,
    product: laptopId,
    quantity: 9999
  });
  assert(transferOver.status === 422, 'transferStock excessive quantity rejection (422)', transferOver.text);

  const transferSame = await req('POST', '/odata/v4/inventory/transferStock', {
    fromWarehouse: whDelhi,
    toWarehouse: whDelhi,
    product: laptopId,
    quantity: 1
  });
  assert(transferSame.status === 400, 'transferStock same source and destination rejection (400)', transferSame.text);


  // DAY 4: SALES SERVICE & DISCOUNT LOGIC
  console.log("\n📁 [DAY 4] Sales Service, Discount Rules & Manager Approval");
  const regularCustId = '11111111-1111-4111-8111-111111111111';
  const premiumCustId = '22222222-2222-4222-8222-222222222222';

  const unauthRes = await req('GET', '/odata/v4/sales/SalesOrders', undefined, null);
  assert(unauthRes.status === 401, 'Unauthenticated GET SalesOrders blocked (401)');

  const authGet = await req('GET', '/odata/v4/sales/SalesOrders', undefined, authHeaders.SalesUser);
  assert(authGet.status === 200, 'SalesUser GET SalesOrders allowed (200)');

  const regOrder = await req('POST', '/odata/v4/sales/SalesOrders', {
    customer_ID: regularCustId,
    grossAmount: 8000.00
  }, authHeaders.SalesUser);
  assert(
    regOrder.status === 201 && Number(regOrder.data.discountPercent) === 5 && Number(regOrder.data.netAmount) === 7600,
    'Regular Customer Order > 5000 gets 5% discount (netAmount=7600)'
  );

  const premOrder = await req('POST', '/odata/v4/sales/SalesOrders', {
    customer_ID: premiumCustId,
    grossAmount: 12000.00
  }, authHeaders.SalesUser);
  assert(
    premOrder.status === 201 && Number(premOrder.data.discountPercent) === 15 && Number(premOrder.data.netAmount) === 10200,
    'Premium Customer Order > 10000 gets 15% discount (netAmount=10200)'
  );
  const testOrderId = premOrder.data.ID;

  const badAmount = await req('POST', '/odata/v4/sales/SalesOrders', {
    customer_ID: regularCustId,
    grossAmount: 0
  }, authHeaders.SalesUser);
  assert(badAmount.status === 400, 'Gross amount <= 0 rejection (400)', badAmount.text);

  const userApprove = await req('POST', `/odata/v4/sales/SalesOrders(${testOrderId})/SalesService.approveOrder`, {}, authHeaders.SalesUser);
  assert(userApprove.status === 403, 'SalesUser forbidden from approveOrder (403)');

  const mgrApprove = await req('POST', `/odata/v4/sales/SalesOrders(${testOrderId})/SalesService.approveOrder`, {}, authHeaders.SalesManager);
  assert(mgrApprove.status === 200, 'SalesManager approved order successfully (200)', mgrApprove.text);

  const reApprove = await req('POST', `/odata/v4/sales/SalesOrders(${testOrderId})/SalesService.approveOrder`, {}, authHeaders.SalesManager);
  assert(reApprove.status === 409, 'Only new orders can be approved (409)', reApprove.text);


  // DAY 5: ORDER FULFILLMENT & INVENTORY DEDUCTION WORKFLOW
  console.log("\n📁 [DAY 5] Order Fulfillment Workflow (Reserve -> Dispatch -> Deduct)");
  const fullOrderRes = await req('POST', '/odata/v4/sales/SalesOrders', {
    customer_ID: regularCustId,
    grossAmount: 6000.00,
    items: [
      { product: 'Laptop', quantity: 1, unitPrice: 3000.00 }
    ]
  }, authHeaders.SalesUser);
  assert(fullOrderRes.status === 201 && fullOrderRes.data.ID, 'Create SalesOrder with items (product=Laptop, qty=1)');
  const fulfillmentOrderId = fullOrderRes.data.ID;

  const earlyReserve = await req(
    'POST',
    `/odata/v4/sales/SalesOrders(${fulfillmentOrderId})/SalesService.reserveStock`,
    {},
    authHeaders.FulfillmentManager
  );
  assert(earlyReserve.status === 409, 'Cannot reserve stock before order is approved (409)', earlyReserve.text);

  const aprRes = await req(
    'POST',
    `/odata/v4/sales/SalesOrders(${fulfillmentOrderId})/SalesService.approveOrder`,
    {},
    authHeaders.SalesManager
  );
  assert(aprRes.status === 200, 'SalesManager approved fulfillment order (200)');

  const resStock = await req(
    'POST',
    `/odata/v4/sales/SalesOrders(${fulfillmentOrderId})/SalesService.reserveStock`,
    {},
    authHeaders.FulfillmentManager
  );
  assert(resStock.status === 200, 'FulfillmentManager reserveStock succeeded (200)', resStock.text);

  const chkOrder = await req('GET', `/odata/v4/sales/SalesOrders(${fulfillmentOrderId})`, undefined, authHeaders.SalesUser);
  assert(chkOrder.data?.status === 'StockConfirmed', `SalesOrder status transitioned to StockConfirmed (${chkOrder.data?.status})`);

  const getResv = await req('GET', `/odata/v4/fulfillment/StockReservations`, undefined, authHeaders.FulfillmentManager);
  assert(getResv.status === 200 && getResv.data?.value?.some(r => r.salesOrder_ID === fulfillmentOrderId), 'StockReservations contains reserved allocation');

  const dispatchRes = await req(
    'POST',
    `/odata/v4/sales/SalesOrders(${fulfillmentOrderId})/SalesService.dispatchOrder`,
    {},
    authHeaders.FulfillmentManager
  );
  assert(dispatchRes.status === 200, 'FulfillmentManager dispatchOrder succeeded (200)', dispatchRes.text);

  const finalOrder = await req('GET', `/odata/v4/sales/SalesOrders(${fulfillmentOrderId})`, undefined, authHeaders.SalesUser);
  assert(finalOrder.data?.status === 'Dispatched', `SalesOrder status is Dispatched (${finalOrder.data?.status})`);

  const summaryFulfill = await req('GET', '/odata/v4/sales/OrderFulfillmentSummary', undefined, authHeaders.SalesUser);
  assert(summaryFulfill.status === 200 && summaryFulfill.data?.value?.length > 0, 'OrderFulfillmentSummary returned grouped counts (200)');

  console.log("\n============================================================");
  console.log(`🏁 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) process.exit(1);
}

run();
