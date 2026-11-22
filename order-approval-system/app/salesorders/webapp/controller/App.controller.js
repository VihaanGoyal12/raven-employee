sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";
    return Controller.extend("orderapproval.salesorders.controller.App", {
        onInit: function () {
            const oView = this.getView();
            const sContentDensityClass = this.getOwnerComponent().getContentDensityClass();
            oView.addStyleClass(sContentDensityClass);
        }
    });
});
