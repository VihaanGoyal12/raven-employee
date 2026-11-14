sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("raven.fulfillment.summary.controller.Main", {
        onInit: function () {
            // Local view model for KPIs and chart
            var oViewModel = new JSONModel({
                totalOrders: 0,
                dispatchedRate: "0.0%",
                actionableCount: 0,
                newCount: 0,
                dispatchedCount: 0,
                chartData: []
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Configure VizFrame properties
            this._setupVizFrame();

            // Load fulfillment summary data
            this._loadSummaryData();
        },

        _setupVizFrame: function () {
            var oVizFrame = this.byId("statusVizFrame");
            if (!oVizFrame) return;

            oVizFrame.setVizProperties({
                plotArea: {
                    dataLabel: {
                        visible: true
                    },
                    colorPalette: ["#0070f2", "#e9730c", "#2b7d2b", "#bb0000"]
                },
                title: {
                    visible: true,
                    text: "Order Counts by Fulfillment Status"
                },
                legend: {
                    visible: true
                },
                categoryAxis: {
                    title: {
                        visible: true,
                        text: "Status"
                    }
                },
                valueAxis: {
                    title: {
                        visible: true,
                        text: "Number of Orders"
                    }
                }
            });
        },

        _loadSummaryData: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oViewModel = this.getView().getModel("viewModel");
            var that = this;

            // Read OrderFulfillmentSummary from OData V4 service
            var oListBinding = oModel.bindList("/OrderFulfillmentSummary");

            oListBinding.requestContexts().then(function (aContexts) {
                var aData = aContexts.map(function (oCtx) {
                    return oCtx.getObject();
                });

                var total = 0;
                var dispatched = 0;
                var actionable = 0;
                var newOrders = 0;

                aData.forEach(function (item) {
                    var count = Number(item.orderCount) || 0;
                    total += count;
                    if (item.status === "Dispatched") {
                        dispatched += count;
                    } else if (item.status === "Approved" || item.status === "StockConfirmed") {
                        actionable += count;
                    } else if (item.status === "New") {
                        newOrders += count;
                    }

                    // Map status to ValueState for badge
                    if (item.status === "Dispatched") {
                        item.state = "Success";
                    } else if (item.status === "StockConfirmed") {
                        item.state = "Warning";
                    } else if (item.status === "Approved") {
                        item.state = "Information";
                    } else {
                        item.state = "None";
                    }
                });

                // Calculate percentage for each status
                aData.forEach(function (item) {
                    var count = Number(item.orderCount) || 0;
                    item.percent = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                });

                var rate = total > 0 ? ((dispatched / total) * 100).toFixed(1) + "%" : "0.0%";

                oViewModel.setProperty("/totalOrders", total);
                oViewModel.setProperty("/dispatchedRate", rate);
                oViewModel.setProperty("/actionableCount", actionable);
                oViewModel.setProperty("/newCount", newOrders);
                oViewModel.setProperty("/dispatchedCount", dispatched);
                oViewModel.setProperty("/chartData", aData);
            }).catch(function (err) {
                console.error("Failed to load OrderFulfillmentSummary:", err);
            });
        },

        onRefresh: function () {
            this._loadSummaryData();
            MessageToast.show("Fulfillment summary data refreshed");
        }
    });
});
