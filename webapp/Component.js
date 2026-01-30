sap.ui.define([
    "sap/ui/core/UIComponent",
    "cloudrunway/model/models",
    "cloudrunway/model/Constants"
], (UIComponent, models, Constants) => {
    "use strict";

    return UIComponent.extend("cloudrunway.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);
            Constants.setComponentId(this.getId());

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});