sap.ui.define([
  "cloudrunway/model/Constants",
  "cloudrunway/model/Formatter"
], function (Constants, Formatter) {
  "use strict";

  return {
    // Constants
    businessScenarioCustomerInitiated: "Z01",
    businessScenarioCustomerInitiatedBkey: "CustomerPartnerInitiatedFullTermination",
    businessScenarioEUDataAct: "Z07",
    statusInProcess: "InProcess",
    euDataActCoverageFullyCovered: "FC",
    noticePeriodDays: 60,

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
