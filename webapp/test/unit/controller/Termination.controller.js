/*global QUnit*/

sap.ui.define([
	"cloudrunway/controller/Termination.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Termination Controller");

	QUnit.test("I should test the Termination controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
