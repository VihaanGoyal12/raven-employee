sap.ui.define(
    ["sap/fe/core/AppComponent"],
    function (AppComponent) {
        "use strict";

        return AppComponent.extend("raven.fulfillment.cockpit.Component", {
            metadata: {
                manifest: "json",
                interfaces: ["sap.ui.core.IAsyncContentCreation"]
            }
        });
    }
);
