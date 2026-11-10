sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../model/formatter"
], function (Controller, JSONModel, MessageToast, MessageBox, formatter) {
    "use strict";

    return Controller.extend("raven.inventory.controller.Overview", {
        formatter: formatter,

        onInit: function () {
            // Initialize local JSON view model for UI state
            const oViewModel = new JSONModel({
                kpi: {
                    warehouses: 0,
                    products: 0,
                    totalUnits: 0,
                    lowStock: 0
                },
                transfer: {
                    from: null,
                    to: null,
                    product: null,
                    quantity: 1,
                    available: null
                },
                check: {
                    warehouse: null,
                    product: null,
                    result: null
                }
            });
            this.getView().setModel(oViewModel, "view");
        },

        onAfterRendering: function () {
            // Load KPIs once view and models are attached and rendered
            this._loadKpis();
        },

        /**
         * Open the Transfer Stock dialog (lazy-load fragment once)
         */
        onOpenTransfer: async function () {
            if (!this._transferDialog) {
                this._transferDialog = await this.loadFragment({
                    name: "raven.inventory.fragment.TransferDialog"
                });
            }
            this._vm().setProperty("/transfer", {
                from: null,
                to: null,
                product: null,
                quantity: 1,
                available: null
            });
            this._transferDialog.open();
        },

        /**
         * Triggered when Source Warehouse or Product changes in the Transfer dialog
         * Invokes the unbound OData V4 function getStockAvailability
         */
        onSourceOrProductChange: async function () {
            const t = this._vm().getProperty("/transfer");
            if (!t.from || !t.product) {
                this._vm().setProperty("/transfer/available", null);
                return;
            }

            try {
                const oModel = this.getView().getModel();
                // Create deferred operation binding for unbound function
                const oFn = oModel.bindContext("/getStockAvailability(...)");
                oFn.setParameter("warehouse", t.from);
                oFn.setParameter("product", t.product);

                await oFn.execute();

                const oBoundContext = oFn.getBoundContext();
                const iAvailable = oBoundContext ? oBoundContext.getProperty("value") : 0;
                this._vm().setProperty("/transfer/available", typeof iAvailable === "number" ? iAvailable : 0);
            } catch (oError) {
                console.error("Failed to query stock availability:", oError);
                this._vm().setProperty("/transfer/available", null);
            }
        },

        /**
         * Confirm and execute the stock transfer
         * Invokes the unbound OData V4 action transferStock
         */
        onConfirmTransfer: async function () {
            const t = this._vm().getProperty("/transfer");
            const oModel = this.getView().getModel();

            // Create deferred operation binding for unbound action
            const oAction = oModel.bindContext("/transferStock(...)");
            oAction.setParameter("fromWarehouse", t.from);
            oAction.setParameter("toWarehouse", t.to);
            oAction.setParameter("product", t.product);
            oAction.setParameter("quantity", parseInt(t.quantity, 10) || 1);

            try {
                await oAction.execute();
                const oBoundContext = oAction.getBoundContext();
                const sMessage = oBoundContext ? oBoundContext.getProperty("value") : null;

                MessageToast.show(sMessage || "Stock transfer completed successfully.");
                this._transferDialog.close();

                // Refresh model data without reloading browser page
                this.onRefresh();
            } catch (oError) {
                // Surface backend error text (e.g. 422 Insufficient stock)
                let sErrorText = oError.message || "An unexpected error occurred during transfer.";
                if (oError.error && oError.error.message) {
                    sErrorText = oError.error.message;
                }
                MessageBox.error(sErrorText);
            }
        },

        onCancelTransfer: function () {
            if (this._transferDialog) {
                this._transferDialog.close();
            }
        },

        /**
         * Open the Check Availability dialog (stretch goal action)
         */
        onOpenCheckAvailability: async function () {
            if (!this._checkDialog) {
                this._checkDialog = await this.loadFragment({
                    name: "raven.inventory.fragment.CheckAvailabilityDialog"
                });
            }
            this._vm().setProperty("/check", {
                warehouse: null,
                product: null,
                result: null
            });
            this._checkDialog.open();
        },

        /**
         * Invokes getStockAvailability for Check Availability dialog
         */
        onCheckParamsChange: async function () {
            const c = this._vm().getProperty("/check");
            if (!c.warehouse || !c.product) {
                this._vm().setProperty("/check/result", null);
                return;
            }

            try {
                const oModel = this.getView().getModel();
                const oFn = oModel.bindContext("/getStockAvailability(...)");
                oFn.setParameter("warehouse", c.warehouse);
                oFn.setParameter("product", c.product);

                await oFn.execute();

                const oBoundContext = oFn.getBoundContext();
                const iAvailable = oBoundContext ? oBoundContext.getProperty("value") : 0;
                this._vm().setProperty("/check/result", typeof iAvailable === "number" ? iAvailable : 0);
            } catch (oError) {
                console.error("Failed to check availability:", oError);
                this._vm().setProperty("/check/result", null);
            }
        },

        onCloseCheckAvailability: function () {
            if (this._checkDialog) {
                this._checkDialog.close();
            }
        },

        /**
         * Refresh OData V4 model and recalculate KPI values
         */
        onRefresh: function () {
            const oModel = this.getView().getModel();
            if (oModel) {
                oModel.refresh();
            }
            this._loadKpis();
        },

        /**
         * Calculates KPI counts dynamically from InventoryService
         */
        _loadKpis: async function () {
            const oModel = this.getView().getModel();
            if (!oModel) {
                return;
            }

            const countEntity = async (sPath) => {
                try {
                    const oList = oModel.bindList(sPath, null, [], [], { $count: true });
                    await oList.requestContexts(0, 1);
                    const oHeader = oList.getHeaderContext();
                    return oHeader ? (oHeader.getProperty("$count") || 0) : 0;
                } catch (e) {
                    console.error("Failed count on " + sPath + ":", e);
                    return 0;
                }
            };

            try {
                const iWarehouses = await countEntity("/Warehouses");
                const iProducts = await countEntity("/Products");

                const oSummaryList = oModel.bindList("/StockSummary");
                const aSummaryContexts = await oSummaryList.requestContexts(0, 100);
                const aSummary = aSummaryContexts.map(c => c.getObject());

                const iTotalUnits = aSummary.reduce((sum, r) => sum + (Number(r.totalQuantity) || 0), 0);
                const iLowStock = aSummary.filter(r => (Number(r.totalQuantity) || 0) < formatter.LOW).length;

                this._vm().setProperty("/kpi", {
                    warehouses: iWarehouses,
                    products: iProducts,
                    totalUnits: iTotalUnits,
                    lowStock: iLowStock
                });
            } catch (e) {
                console.error("Failed calculating KPIs:", e);
            }
        },

        _vm: function () {
            return this.getView().getModel("view");
        }
    });
});

