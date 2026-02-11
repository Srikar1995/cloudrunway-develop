sap.ui.define([
    "sap/m/plugins/UploadSetwithTable",
	"sap/ui/core/format/DateFormat",
	"cloudrunway/control/ValueHelpService",
], function (UploadSetwithTable, DateFormat, ValueHelpService) {
	"use strict";
	return {
        getIconSrc: function(mediaType, fileName) {
			return UploadSetwithTable.getIconForFileType(mediaType, fileName);
		},
		// enableCreateTA: function (terminationOrigin, requestor, responsible, receiptDate, effectData, attachmentsList) {
		// 	if ( terminationOrigin && requestor && responsible && receiptDate && effectData && attachmentsList?.length ) {
		// 		return true;
		// 	}
		// 	return false;
		// },
		getValueDescr: function (aValues, sKey) {
			const selectedValue = aValues?.find((oValue)=>oValue.key === sKey);
			if (selectedValue && selectedValue.text) {
				return selectedValue.text;
			}
			return sKey;
		},
		getTAStatusState: function (sStatus) {
			if (sStatus === "Retracted") {
				return "Error";
			}
			return "Information";
		},
		getCreateVisible: function (taList, bValisOpp) {
			return true;
			if (!bValisOpp || (taList?.some(item => item.status === "InProcess"))) {
				return false;
			}
			return true;
		},
		formatDate: function (sDateValue, sDateFormat) {
			if (!sDateFormat) {
				sDateFormat === "yyyy-MM-dd";
			}
			if (sDateValue) {
				const sValue = new Date(sDateValue);
				const dDateFormat = DateFormat.getDateInstance({
					pattern: sDateFormat,
					UTC: true
				});
				return dDateFormat.format(sValue);
			}
			return "";
		},
		/**
		 * Resolves employee ID to formatted name
		 * Note: This formatter uses the resolved name from model (set by controller)
		 * @param {string} sId - Employee ID
		 * @param {string} sResolvedName - Resolved name from model
		 * @returns {string} Formatted name or ID if not resolved
		 */
		resolveEmployeeName: function (sId, sResolvedName) {
			if (sResolvedName) {
				return sResolvedName;
			}
			if (!sId) {
				return "";
			}
			// Return ID as fallback
			return sId;
		},
		/**
		 * Resolves contact person ID to formatted name
		 * Note: This formatter uses the resolved name from model (set by controller)
		 * @param {string} sResolvedName - Resolved name from model
		 * @param {string} sId - Contact person ID
		 * @returns {string} Formatted name or ID if not resolved
		 */
		resolveContactPersonName: function (sId, sResolvedName) {
			if (sResolvedName) {
				return sResolvedName;
			}
			if (!sId) {
				return "";
			}
			// Return ID as fallback
			return sId;
		},
		getBackendKey: function (aValues, sKey) {
			const selectedValue = aValues?.find((oValue)=>oValue.key === sKey);
			if (selectedValue && selectedValue.bkey) {
				return selectedValue.bkey;
			}
			return sKey;
		},
    };
});