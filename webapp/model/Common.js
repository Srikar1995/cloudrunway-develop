sap.ui.define([
  "cloudrunway/model/Constants",
  "sap/ui/core/format/DateFormat"
], function (Constants, DateFormat) {
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
        const oDateFormatter = DateFormat.getDateInstance({ pattern: "dd.MMM.yy", UTC: true });
        const sFormattedStart = oDateFormatter.format(new Date(sContractStartDate));
        const sFormattedEnd = oDateFormatter.format(new Date(sContractEndDate));
        const sMessage = this.getLocalTextByi18nValue("TEDRANGEERROR", [sFormattedStart, sFormattedEnd]);
        return { isValid: false, errorMessage: sMessage };
      }
      return { isValid: true, errorMessage: "" };
    },

    /**
     * Validate mandatory fields and return field-level error object for binding.
     * Used for both create (oData with requestor, responsible, receiptDate, effectData/effectDate) and update (oData with status, terminationRequester, etc.).
     * @param {object} oData - Form data (create or update shape)
     * @param {object} [options] - { isRetracted: boolean } for update when status is Retracted
     * @returns {object} - { fieldName: { valueState: "Error", valueStateText: string }, ... }
     */
    validateMandatoryFields: function (oData, options) {
      const oFieldErrors = {};
      const sMsg = this.getLocalTextByi18nValue("MANDATORYFIELDREQUIRED");
      const bIsRetracted = options && options.isRetracted === true;

      function setError(fieldName) {
        oFieldErrors[fieldName] = { valueState: "Error", valueStateText: sMsg };
      }

      // Create: terminationOrigin, requestor, responsible, receiptDate, effectData/effectDate
      if (bIsRetracted === undefined || oData.requestor !== undefined) {
        if (!oData.terminationOrigin || (typeof oData.terminationOrigin === "string" && oData.terminationOrigin.trim() === "")) {
          setError("terminationOrigin");
        }
        const oReq = oData.terminationRequester || oData.requestor || oData.requesterObject;
        const hasRequester = oReq && ((typeof oReq === "string" && oReq.trim() !== "") || (typeof oReq === "object" && (oReq.defaultExternalContactId || oReq.employeeDisplayId)));
        if (!hasRequester) {
          setError("terminationRequester");
        }
        const oResp = oData.terminationResponsible || oData.responsible || oData.responsibleObject;
        const hasResponsible = oResp && ((typeof oResp === "string" && oResp.trim() !== "") || (typeof oResp === "object" && oResp.employeeDisplayId));
        if (!hasResponsible) {
          setError("terminationResponsible");
        }
        const sReceipt = oData.terminationReceiptDate || oData.receiptDate;
        if (!sReceipt || (typeof sReceipt === "string" && sReceipt.trim() === "")) {
          setError("terminationReceiptDate");
        }
        const sEffect = oData.terminationEffectiveDate || oData.effectData || oData.effectDate;
        if (!sEffect || (typeof sEffect === "string" && sEffect.trim() === "")) {
          setError("terminationEffectiveDate");
        }
        return oFieldErrors;
      }

      // Update: status, terminationOrigin, requester, responsible, receiptDate, effectiveDate, optional retraction
      if (!oData.status || (typeof oData.status === "string" && oData.status.trim() === "")) {
        setError("status");
      }
      if (!oData.terminationOrigin || (typeof oData.terminationOrigin === "string" && oData.terminationOrigin.trim() === "")) {
        setError("terminationOrigin");
      }
      const oReqU = oData.terminationRequester || oData.requesterObject;
      const hasRequesterU = oReqU && ((typeof oReqU === "string" && oReqU.trim() !== "") || (typeof oReqU === "object" && (oReqU.defaultExternalContactId || oReqU.employeeDisplayId)));
      if (!hasRequesterU) {
        setError("terminationRequester");
      }
      const oRespU = oData.terminationResponsible || oData.responsibleObject;
      const hasResponsibleU = oRespU && ((typeof oRespU === "string" && oRespU.trim() !== "") || (typeof oRespU === "object" && oRespU.employeeDisplayId));
      if (!hasResponsibleU) {
        setError("terminationResponsible");
      }
      const sReceiptU = oData.terminationReceiptDate;
      if (!sReceiptU || (typeof sReceiptU === "string" && sReceiptU.trim() === "")) {
        setError("terminationReceiptDate");
      }
      const sEffectU = oData.terminationEffectiveDate;
      if (!sEffectU || (typeof sEffectU === "string" && sEffectU.trim() === "")) {
        setError("terminationEffectiveDate");
      }
      if (bIsRetracted) {
        if (!oData.retractionReason || (typeof oData.retractionReason === "string" && oData.retractionReason.trim() === "")) {
          oFieldErrors.retractionReason = {
            valueState: "Error",
            valueStateText: this.getLocalTextByi18nValue("RETRACTIONREASONMISSING")
          };
        }
        if (!oData.retractionReceivedDate || (typeof oData.retractionReceivedDate === "string" && oData.retractionReceivedDate.trim() === "")) {
          oFieldErrors.retractionReceivedDate = {
            valueState: "Error",
            valueStateText: this.getLocalTextByi18nValue("RETRACTIONRECEIPTDATE_MISSING")
          };
        }
      }
      return oFieldErrors;
    }
  };
});
