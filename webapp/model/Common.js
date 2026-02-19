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
    /**
     * Validate that Termination Receipt Date (TRD) is not in the future
     * @param {string} sTRD - Termination Receipt Date in "yyyy-MM-dd" format
     * @returns {object} - { isValid: boolean, errorMessage: string }
     */
    validateTRDNotFuture: function (sTRD) {
      if (!sTRD) {
        return { isValid: true, errorMessage: "" };
      }
      const oToday = new Date();
      oToday.setHours(0, 0, 0, 0);
      const oTRD = new Date(sTRD);
      oTRD.setHours(0, 0, 0, 0);
      if (oTRD > oToday) {
        return {
          isValid: false,
          errorMessage: this.getLocalTextByi18nValue("TRDFUTURENOTALLOWED")
        };
      }
      return { isValid: true, errorMessage: "" };
    },

    /**
     * Validate that Termination Effective Date (TED) is within contract range (>= start, <= end)
     * @param {string} sTED - Termination Effective Date in "yyyy-MM-dd" format
     * @param {string} sContractStartDate - Contract Start Date in "yyyy-MM-dd" format
     * @param {string} sContractEndDate - Contract End Date in "yyyy-MM-dd" format
     * @returns {object} - { isValid: boolean, errorMessage: string }
     */
    validateTEDWithinContractRange: function (sTED, sContractStartDate, sContractEndDate) {
      if (!sTED || !sContractStartDate || !sContractEndDate) {
        return { isValid: true, errorMessage: "" };
      }
      const oTED = new Date(sTED);
      oTED.setHours(0, 0, 0, 0);
      const oStart = new Date(sContractStartDate);
      oStart.setHours(0, 0, 0, 0);
      const oEnd = new Date(sContractEndDate);
      oEnd.setHours(0, 0, 0, 0);
      if (oTED < oStart || oTED > oEnd) {
        const sFormattedStart = Formatter.formatDate(sContractStartDate, "dd.MMM.yy");
        const sFormattedEnd = Formatter.formatDate(sContractEndDate, "dd.MMM.yy");
        const sMessage = this.getLocalTextByi18nValue("TEDRANGEERROR", [sFormattedStart, sFormattedEnd]);
        return { isValid: false, errorMessage: sMessage };
      }
      return { isValid: true, errorMessage: "" };
    }
  };
});
