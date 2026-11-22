sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("orderapproval.salesorders.controller.Detail", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Detail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            const sOrderId = decodeURIComponent(oEvent.getParameter("arguments").orderId);
            this.getView().bindElement({
                path: "/SalesOrders(" + sOrderId + ")",
                parameters: { $expand: "customer,items" },
                events: {
                    dataReceived: this._onDataReceived.bind(this)
                }
            });
        },

        _onDataReceived: function (oEvent) { return; // disabled
            const oData = oEvent.getParameter("data");
            if (!oData) {
                MessageBox.error("Order not found.");
                this.onNavBack();
            }
        },

        // ─── Formatters ────────────────────────────────────────────────────────

        formatOrderTitle: function (sOrderNumber) {
            return sOrderNumber ? "Order: " + sOrderNumber : "Order Details";
        },

        formatAmount: function (fVal) {
            if (fVal === null || fVal === undefined) return "0.00";
            return Number(fVal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },

        formatPercent: function (fVal) {
            if (fVal === null || fVal === undefined) return "0.00";
            return Number(fVal).toFixed(2);
        },

        formatLineTotal: function (iQty, fPrice) {
            if (!iQty || !fPrice) return "0.00";
            return Number(iQty * fPrice).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },

        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "Approved":          return "Success";
                case "PendingApproval":
                case "InFinanceReview":   return "Warning";
                case "Rejected":          return "Error";
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

        canSendToHoD: function (sStatus) {
            return sStatus === "New" || sStatus === "Rejected";
        },

        canEdit: function (sStatus) {
            return sStatus === "New";
        },

        hasComments: function (sHodComment, sFinanceComment) {
            return !!(sHodComment || sFinanceComment);
        },

        // ─── Actions ───────────────────────────────────────────────────────────

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("List");
        },

        onSendToHoD: function () {
            const oCtx = this.getView().getBindingContext();
            if (!oCtx) return;
            const oOrder = oCtx.getObject();
            MessageBox.confirm(
                "Send order '" + oOrder.orderNumber + "' to the Head of Department for approval?",
                {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._doSendToHoD(oOrder.ID, oOrder.orderNumber);
                        }
                    }.bind(this)
                }
            );
        },

        _doSendToHoD: function (sOrderId, sOrderNumber) {
            const oModel = this.getView().getModel();
            const oOperation = oModel.bindContext(
                "/SalesOrders(" + sOrderId + ")/SalesService.sendToHoDForApproval(...)"
            );
            MessageToast.show("Submitting to BPA workflow...");
            oOperation.execute().then(function (oResult) {
                MessageBox.success(
                    "Order '" + sOrderNumber + "' sent to HoD for approval.\n\n" +
                    "Workflow Instance ID: " + (oResult?.workflowInstanceId || "N/A") + "\n\n" +
                    "The approver will receive a task in SAP Build Process Automation."
                );
                oModel.refresh();
            }).catch(function (oError) {
                MessageBox.error("Failed to start workflow.\n\n" + (oError.message || String(oError)));
            });
        },

        onEdit: function () {
            MessageToast.show("Edit mode — available for 'New' status orders.");
        },

        onDelete: function () {
            const oCtx = this.getView().getBindingContext();
            if (!oCtx) return;
            const sOrderNumber = oCtx.getProperty("orderNumber");
            MessageBox.confirm("Delete order '" + sOrderNumber + "'? This cannot be undone.", {
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oCtx.delete().then(function () {
                            MessageToast.show("Order deleted.");
                            this.onNavBack();
                        }.bind(this)).catch(function (oError) {
                            MessageBox.error("Failed to delete: " + oError.message);
                        });
                    }
                }.bind(this)
            });
        },

        onAddItem: function () {
            MessageToast.show("Add item — available in edit mode.");
        }
    });
});
