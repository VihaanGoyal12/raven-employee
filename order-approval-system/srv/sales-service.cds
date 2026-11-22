using raven.sales as sales from '../db/schema';

service SalesService @(path: 'sales') {

    entity Customers as projection on sales.Customers;

    @odata.draft.enabled
    entity SalesOrders as projection on sales.SalesOrders {
        *,
        items : redirected to SalesOrderItems,

        // Order alias matching PDF Page 3 ("Order" column header in table)
        orderNumber as order : String(50),

        case
            when status = 'Approved' then 3        // Green
            when status = 'PendingApproval' then 2  // Orange
            when status = 'InFinanceReview' then 2  // Orange
            when status = 'Rejected' then 1         // Red
            else 0                                  // Grey / Neutral
        end as statusCriticality : Integer
    }
    actions {
        // Triggers BPA workflow instance
        action sendToHoDForApproval() returns {
            success : Boolean;
            message : String;
            workflowInstanceId : String;
        };
        // Object Page manual approve if permitted in business rules
        action approve() returns String;
    };

    entity SalesOrderItems as projection on sales.SalesOrderItems;

    // Direct callback action for BPA "Create odata v4" activities
    action updateWorkflowStatus(
        orderId             : UUID,
        status              : String(30),
        hodComment          : String(500),
        financeComment      : String(500),
        workflowInstanceId  : String(100)
    ) returns {
        success : Boolean;
        message : String;
    };
}
