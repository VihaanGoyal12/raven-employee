sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("orderapproval.salesorders.controller.List", {

        onInit: function () {
            const oTable = this.byId("salesOrdersTable");
            const oView = this.getView();

            oView.setModel(new sap.ui.model.json.JSONModel({ selectedOrder: null }), "listPage");

            oTable.attachUpdateFinished(function (oEvent) {
                const iCount = oEvent.getParameter("total") ?? 0;
                this.byId("tableTitle").setText("Sales Orders (" + iCount + ")");
            }.bind(this));
        },

        // ─── Formatters ────────────────────────────────────────────────────────

        formatAmount: function (fVal) {
            if (fVal === null || fVal === undefined) return "0.00";
            return Number(fVal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },

        formatPercent: function (fVal) {
            if (fVal === null || fVal === undefined) return "0.00";
            return Number(fVal).toFixed(2);
        },

        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "Approved":          return "Success";   // Green
                case "PendingApproval":
                case "InFinanceReview":   return "Warning";   // Orange
                case "Rejected":          return "Error";     // Red
                default:                  return "Information";
            }
        },

        formatStatusIcon: function (sStatus) {
            switch (sStatus) {
                case "Approved":          return "sap-icon://sys-enter-2";
                case "PendingApproval":   return "sap-icon://pending";
                case "InFinanceReview":   return "sap-icon://activity-2";
                case "Rejected":          return "sap-icon://error";
                default:                  return "sap-icon://status-new";
            }
        },

        formatTypeState: function (sType) {
            return sType === "Premium" ? "Warning" : "Information";
        },

        // ─── Selection ─────────────────────────────────────────────────────────

        onSelectionChange: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const bSelected = oItem && oItem.getSelected();
            this.getView().getModel("listPage").setProperty("/selectedOrder", bSelected ? oItem.getBindingContext().getObject() : null);
            this.byId("btnSendToHoD").setEnabled(bSelected);
        },

        // ─── Send to HoD ────────────────────────────────────────────────────────

        onSendToHoD: function () {
            const oTable = this.byId("salesOrdersTable");
            const oItem = oTable.getSelectedItem();
            if (!oItem) {
                MessageBox.warning("Please select an order first.");
                return;
            }
            const oOrder = oItem.getBindingContext().getObject();
            if (oOrder.status !== "New" && oOrder.status !== "Rejected") {
                MessageBox.warning("Only 'New' or 'Rejected' orders can be submitted for approval.\n\nCurrent status: " + oOrder.status);
                return;
            }
            MessageBox.confirm(
                "Send order '" + oOrder.orderNumber + "' to the Head of Department for approval?",
                {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._doSendToHoD(oOrder.ID, oOrder.orderNumber, oItem.getBindingContext());
                        }
                    }.bind(this)
                }
            );
        },

        _doSendToHoD: function (sOrderId, sOrderNumber, oContext) {
            const oModel = this.getView().getModel();
            const oOperation = oModel.bindContext(
                "/SalesOrders(" + sOrderId + ")/SalesService.sendToHoDForApproval(...)"
            );
            MessageToast.show("Submitting order " + sOrderNumber + " to BPA workflow...");
            oOperation.execute().then(function (oResult) {
                MessageBox.success(
                    "Order '" + sOrderNumber + "' has been sent to HoD for approval.\n\nWorkflow Instance: " +
                    (oResult?.workflowInstanceId || "N/A")
                );
                oModel.refresh();
            }).catch(function (oError) {
                MessageBox.error("Failed to start approval workflow.\n\n" + (oError.message || String(oError)));
            });
        },

        // ─── Navigation ────────────────────────────────────────────────────────

        onItemPress: function (oEvent) {
            const oItem = oEvent.getSource();
            const oCtx = oItem.getBindingContext();
            const sId = oCtx.getProperty("ID");
            this.getOwnerComponent().getRouter().navTo("Detail", { orderId: encodeURIComponent(sId) });
        },

        // ─── Create Order ───────────────────────────────────────────────────────

        onCreateOrder: function () {
            if (!this._oCreateDialog) {
                this._oCreateDialog = sap.ui.xmlfragment(
                    "orderapproval.salesorders.view.CreateOrderDialog",
                    this
                );
                this.getView().addDependent(this._oCreateDialog);
            }
            // Reset form model
            const oFormModel = new sap.ui.model.json.JSONModel({
                orderNumber: "ORD-" + Date.now(),
                customer_ID: "",
                orderDate: new Date().toISOString().slice(0, 10),
                grossAmount: 0,
                product: "",
                quantity: 1,
                unitPrice: 0,
                requestedBy: "vihaangoyal31@gmail.com",
                requestedByEmail: "vihaangoyal31@gmail.com"
            });
            this._oCreateDialog.setModel(oFormModel, "form");
            this._oCreateDialog.open();
        },

        onCreateConfirm: function () {
            const oModel = this.getView().getModel();
            const oFormData = this._oCreateDialog.getModel("form").getData();

            if (!oFormData.customer_ID || !oFormData.grossAmount || !oFormData.product) {
                MessageBox.warning("Please fill in all required fields: Customer, Gross Amount, and Product.");
                return;
            }

            const oListBinding = oModel.bindList("/SalesOrders");
            const oContext = oListBinding.create({
                orderNumber: oFormData.orderNumber,
                customer_ID: oFormData.customer_ID,
                orderDate: oFormData.orderDate,
                grossAmount: parseFloat(oFormData.grossAmount),
                requestedBy: oFormData.requestedBy,
                requestedByEmail: oFormData.requestedByEmail,
                items: [{
                    product: oFormData.product,
                    quantity: parseInt(oFormData.quantity),
                    unitPrice: parseFloat(oFormData.unitPrice)
                }]
            });

            oContext.created().then(function () {
                MessageToast.show("Order " + oFormData.orderNumber + " created successfully.");
                this._oCreateDialog.close();
                oModel.refresh();
            }.bind(this)).catch(function (oError) {
                MessageBox.error("Failed to create order.\n\n" + oError.message);
            });
        },

        onCreateCancel: function () {
            this._oCreateDialog.close();
        },

        // ─── Delete Order ───────────────────────────────────────────────────────

        onDeleteOrder: function () {
            const oTable = this.byId("salesOrdersTable");
            const oItem = oTable.getSelectedItem();
            if (!oItem) {
                MessageBox.warning("Please select an order to delete.");
                return;
            }
            const sOrderNumber = oItem.getBindingContext().getProperty("orderNumber");
            MessageBox.confirm("Delete order '" + sOrderNumber + "'? This cannot be undone.", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oItem.getBindingContext().delete().then(function () {
                            MessageToast.show("Order deleted.");
                            this.getView().getModel("listPage").setProperty("/selectedOrder", null);
                            this.byId("btnSendToHoD").setEnabled(false);
                        }.bind(this)).catch(function (oError) {
                            MessageBox.error("Failed to delete order: " + oError.message);
                        });
                    }
                }.bind(this)
            });
        },

        // ─── Filtering ─────────────────────────────────────────────────────────

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            this._applyFilters(sQuery);
        },

        onFilterChange: function () {
            const sQuery = this.byId("searchField").getValue() || "";
            this._applyFilters(sQuery);
        },

        _applyFilters: function (sSearch) {
            const oTable = this.byId("salesOrdersTable");
            const oBinding = oTable.getBinding("items");
            const aFilters = [];

            if (sSearch) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("orderNumber", FilterOperator.Contains, sSearch),
                        new Filter("customer/name", FilterOperator.Contains, sSearch)
                    ],
                    and: false
                }));
            }

            const sStatus = this.byId("filterEditingStatus").getSelectedKey();
            if (sStatus && sStatus !== "All") {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            const sType = this.byId("filterType").getSelectedKey();
            if (sType) {
                aFilters.push(new Filter("customer/customerType", FilterOperator.EQ, sType));
            }

            const sCustomer = this.byId("filterCustomer").getValue();
            if (sCustomer) {
                aFilters.push(new Filter("customer/name", FilterOperator.Contains, sCustomer));
            }

            oBinding.filter(aFilters.length ? new Filter({ filters: aFilters, and: true }) : []);
        },

        onAdaptFilters: function () {
            MessageToast.show("Adapt Filters panel — configure in Fiori Launchpad.");
        }
    });
});
