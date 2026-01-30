sap.ui.define([
    "sap/m/plugins/UploadSetwithTable",
	"sap/ui/core/format/DateFormat",
], function (UploadSetwithTable, DateFormat) {
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
			const selectedValue = aValues.find((oValue)=>oValue.key === sKey);
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
		getCreateVisible: function (taList) {
			if (taList?.length) {
				const hasInprocess = taList.find((item)=>item.status === "InProcess");
				return hasInprocess ? false : true;
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
		}
    };
});