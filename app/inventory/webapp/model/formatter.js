sap.ui.define([], function () {
    "use strict";

    const LOW = 20;
    const CRITICAL = 10;
    const FULL = 100;

    return {
        LOW: LOW,
        CRITICAL: CRITICAL,
        FULL: FULL,

        /**
         * Returns ValueState based on stock quantity
         * >= 20: Success (In Stock)
         * 10–19: Warning (Low Stock)
         * < 10:  Error   (Critical)
         */
        state: function (iQuantity) {
            const q = Number(iQuantity) || 0;
            if (q < CRITICAL) {
                return "Error";
            }
            if (q < LOW) {
                return "Warning";
            }
            return "Success";
        },

        /**
         * Percentage for ProgressIndicator (0 - 100)
         */
        percent: function (iQuantity) {
            const q = Number(iQuantity) || 0;
            return Math.min(100, Math.max(0, Math.round((q / FULL) * 100)));
        },

        /**
         * Localized status text for ObjectStatus
         */
        statusText: function (iQuantity) {
            const q = Number(iQuantity) || 0;
            let oBundle;
            try {
                if (typeof this.getOwnerComponent === "function" && this.getOwnerComponent()) {
                    oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                } else if (typeof this.getModel === "function" && this.getModel("i18n")) {
                    oBundle = this.getModel("i18n").getResourceBundle();
                }
            } catch (e) {
                // Ignore and fall back to English defaults
            }

            if (q < CRITICAL) {
                return oBundle ? oBundle.getText("statusCritical") : "Critical";
            }
            if (q < LOW) {
                return oBundle ? oBundle.getText("statusLow") : "Low Stock";
            }
            return oBundle ? oBundle.getText("statusInStock") : "In Stock";
        }
    };
});

