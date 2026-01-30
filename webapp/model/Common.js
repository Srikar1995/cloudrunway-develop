sap.ui.define(["cloudrunway/model/Constants"], function (Constants) {
  "use strict";

  return {
    getAppComponent: function () {
      return sap.ui.getCore().getComponent(Constants.getComponentId());
    },
    getLocalTextByi18nValue: function (i18nValue, placeHolderArray) {
      const oI18nModel = this.getAppComponent().getModel("i18n");
      if (placeHolderArray && placeHolderArray.length > 0) {
        const oBundle = oI18nModel.getResourceBundle();
        return oBundle.getText(i18nValue, placeHolderArray);
      }
      return oI18nModel.getProperty(i18nValue);
    },
  };
});
