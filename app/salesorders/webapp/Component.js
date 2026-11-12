sap.ui.define(
    ["sap/fe/core/AppComponent"],
    function (AppComponent) {
        "use strict";

        return AppComponent.extend("raven.sales.salesorders.Component", {
            metadata: {
                manifest: "json",
                interfaces: ["sap.ui.core.IAsyncContentCreation"]
            }
        });
    }
);
