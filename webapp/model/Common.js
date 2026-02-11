sap.ui.define([
  "cloudrunway/model/Constants",
  "cloudrunway/model/Formatter"
], function (Constants, Formatter) {
  "use strict";

  return {
    // Constants
    businessScenarioCustomerInitiated: "Z01",
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
     * Validate 60-day notice period for EU Data Act scenarios
     * @param {string} sTRD - Termination Receipt Date in "yyyy-MM-dd" format
     * @param {string} sTED - Termination Effective Date in "yyyy-MM-dd" format
     * @returns {object} - { isValid: boolean, errorMessage: string }
     */
    validateEUDA60DayNotice: function (sTRD, sTED) {
      if (!sTRD || !sTED) {
        return { isValid: true, errorMessage: "" };
      }

      const oTRD = new Date(sTRD);
      const oTED = new Date(sTED);
      const iDaysDiff = Math.floor((oTED - oTRD) / (1000 * 60 * 60 * 24));

      if (iDaysDiff < this.noticePeriodDays) {
        return {
          isValid: false,
          errorMessage: this.getLocalTextByi18nValue("EUDA60DAYNOTICE")
        };
      }

      return { isValid: true, errorMessage: "" };
    },

    /**
     * Validate that TED is within valid range (>= TRD + 60 days and <= CED)
     * @param {string} sTED - Termination Effective Date in "yyyy-MM-dd" format
     * @param {string} sTRD - Termination Receipt Date in "yyyy-MM-dd" format
     * @param {string} sCED - Contract End Date in "yyyy-MM-dd" format
     * @returns {object} - { isValid: boolean, errorMessage: string }
     */
    validateTEDRange: function (sTED, sTRD, sCED) {
      if (!sTED || !sTRD || !sCED) {
        return { isValid: true, errorMessage: "" };
      }

      const oTED = new Date(sTED);
      const oTRD = new Date(sTRD);
      const oCED = new Date(sCED);

      // Calculate minimum TED (TRD + 60 days)
      const oMinTED = new Date(oTRD);
      oMinTED.setDate(oMinTED.getDate() + this.noticePeriodDays);

      if (oTED < oMinTED) {
        return {
          isValid: false,
          errorMessage: this.getLocalTextByi18nValue("EUDA60DAYNOTICE")
        };
      }

      if (oTED > oCED) {
        const sFormattedCED = Formatter.formatDateForDisplay(sCED);
        const sErrorMessage = this.getLocalTextByi18nValue("TEDNOTEDITABLECUSTOMER");
        return {
          isValid: false,
          errorMessage: sErrorMessage.replace("dd.mmm.yy", sFormattedCED)
        };
      }

      return { isValid: true, errorMessage: "" };
    },

    /**
     * Validate all mandatory fields and return field-level error states
     * @param {object} oData - Data object containing field values
     * @param {boolean} bIsRetracted - Whether status is "Retracted" (optional, for update flow)
     * @returns {object} - Object with field-level error states
     */
    validateMandatoryFields: function (oData, bIsRetracted) {
      const oFieldErrors = {};
      const sMandatoryError = this.getLocalTextByi18nValue("MANDATORYFIELDREQUIRED");

      // Validate status (only for update flow)
      if (bIsRetracted !== undefined && !oData.status) {
        oFieldErrors.status = {
          valueState: "Error",
          valueStateText: sMandatoryError
        };
      }

      // Validate terminationOrigin
      if (!oData.terminationOrigin) {
        oFieldErrors.terminationOrigin = {
          valueState: "Error",
          valueStateText: sMandatoryError
        };
      }

      // Validate terminationRequester
      // Handle both object format (from update) and direct property access (from create)
      const oRequester = oData.terminationRequester || oData.requestor;
      if (!oRequester || (typeof oRequester === "object" && !oRequester.defaultExternalContactId)) {
        oFieldErrors.terminationRequester = {
          valueState: "Error",
          valueStateText: sMandatoryError
        };
      }

      // Validate terminationResponsible
      // Handle both object format (from update) and direct property access (from create)
      const oResponsible = oData.terminationResponsible || oData.responsible;
      if (!oResponsible || (typeof oResponsible === "object" && !oResponsible.employeeDisplayId)) {
        oFieldErrors.terminationResponsible = {
          valueState: "Error",
          valueStateText: sMandatoryError
        };
      }

      // Validate terminationReceiptDate
      const sReceiptDate = oData.terminationReceiptDate || oData.receiptDate;
      if (!sReceiptDate) {
        oFieldErrors.terminationReceiptDate = {
          valueState: "Error",
          valueStateText: sMandatoryError
        };
      }

      // Validate terminationEffectiveDate
      const sEffectiveDate = oData.terminationEffectiveDate || oData.effectData;
      if (!sEffectiveDate) {
        oFieldErrors.terminationEffectiveDate = {
          valueState: "Error",
          valueStateText: sMandatoryError
        };
      }

      // Validate retraction fields if status is Retracted
      if (bIsRetracted) {
        if (!oData.retractionReason) {
          oFieldErrors.retractionReason = {
            valueState: "Error",
            valueStateText: sMandatoryError
          };
        }
        if (!oData.retractionReceivedDate) {
          oFieldErrors.retractionReceivedDate = {
            valueState: "Error",
            valueStateText: sMandatoryError
          };
        }
      }

      return oFieldErrors;
    }
  };
});
