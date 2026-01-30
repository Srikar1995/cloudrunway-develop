/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["cloudrunway/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
