sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (Controller, MessageToast, MessageBox, History) {
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
                parameters: { $expand: "customer,items" }
            });
        },

        // ─── Formatters ────────────────────────────────────────────────────────

        formatOrderTitle: function (sOrderNumber) {
            return sOrderNumber ? "Order: " + sOrderNumber : "Order Details";
        },

        formatAmount: function (fVal) {
            if (fVal == null || fVal === undefined) return "0.00";
            return parseFloat(fVal).toFixed(2);
        },

        formatPercent: function (fVal) {
            if (fVal == null || fVal === undefined) return "0.00";
            return parseFloat(fVal).toFixed(2);
        },

        formatLineTotal: function (iQty, fPrice) {
            const q = parseFloat(iQty) || 0;
            const p = parseFloat(fPrice) || 0;
            return (q * p).toFixed(2);
        },

        formatDate: function (sDate) {
            if (!sDate) return "";
            try {
                const oDate = new Date(sDate);
                return oDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            } catch (e) {
                return sDate;
            }
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
            switch (sType) {
                case "Enterprise": return "Success";
                case "Premium":    return "Information";
                default:           return "None";
            }
        },

        canSendToHoD: function (sStatus) {
            return sStatus === "New" || sStatus === "Rejected";
        },

        canEdit: function (sStatus) {
            return sStatus === "New";
        },

        hasComments: function (sHOD, sFinance) {
            return !!(sHOD || sFinance);
        },

        // ─── Actions ───────────────────────────────────────────────────────────

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("List", {}, true);
            }
        },

        onApprove: function () {
            const oContext = this.getView().getBindingContext();
            const sOrderId = oContext.getProperty("ID");
            const oModel = this.getView().getModel();
            const oOperation = oModel.bindContext(
                "/SalesOrders(" + sOrderId + ")/SalesService.approve(...)"
            );

            oOperation.execute().then(function () {
                MessageToast.show("Order approved successfully!");
                oModel.refresh();
            }).catch(function (oError) {
                MessageBox.error("Approval failed: " + (oError.message || String(oError)));
            });
        },

        onSendToHoD: function () {
            const oContext = this.getView().getBindingContext();
            const sOrderId = oContext.getProperty("ID");
            const sOrderNumber = oContext.getProperty("orderNumber");
            const oModel = this.getView().getModel();

            const oOperation = oModel.bindContext(
                "/SalesOrders(" + sOrderId + ")/SalesService.sendToHoDForApproval(...)"
            );

            MessageToast.show("Sending to HoD for approval...");
            oOperation.execute().then(function (oResult) {
                MessageBox.success("Order " + sOrderNumber + " sent to HoD.\nWorkflow Instance: " + (oResult?.workflowInstanceId || "N/A"));
                oModel.refresh();
            }).catch(function (oError) {
                MessageBox.error("Failed: " + (oError.message || String(oError)));
            });
        }

    });
});
