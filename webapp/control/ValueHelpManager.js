/**
 * @fileoverview Value Help Manager for managing dialog instances and selection logic
 * @module control/ValueHelpManager
 */
sap.ui.define(
  [
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "cloudrunway/control/ValueHelpService",
    "sap/m/MessageBox",
  ],
  function (Fragment, JSONModel, ValueHelpService, MessageBox) {
    "use strict";

    const ValueHelpManager = {
      // Store dialog instances
      _dialogs: {},

      /**
       * Opens the value help dialog
       * @param {Object} oConfig - Configuration object
       * @param {string} oConfig.type - 'contactPerson' | 'employee'
       * @param {string} oConfig.title - Dialog title
       * @param {string} oConfig.searchPlaceholder - Placeholder for search field
       * @param {string} oConfig.accountId - Account ID for contact person filtering
       * @param {Function} oConfig.onSelect - Callback function when item is selected
       * @param {sap.ui.core.mvc.Controller} oConfig.controller - Controller instance
       * @param {string} oConfig.initialSearch - Initial search value
       */
      openValueHelpDialog: function (oConfig) {
        const that = this;
        const sDialogId = `valueHelpDialog_${oConfig.type}`;

        // Helper function to open and initialize dialog
        const openDialog = function (oDialog) {
          const oModel = oDialog.getModel("valueHelpModel");
          
          // Clear any previous selection in the table
          const oTable = oDialog.getContent()[0].getItems()[1]; // VBox -> Table
          if (oTable && oTable.removeSelections) {
            oTable.removeSelections();
          }

          // Initialize model with searchText from initialSearch
          oModel.setData({
            title: oConfig.title || "Select Value",
            searchPlaceholder: oConfig.searchPlaceholder || "Search...",
            tableTitle: oConfig.tableTitle || "Results",
            searchText: oConfig.initialSearch || "",
            results: [],
            resultsCount: "0 items",
            hasSelection: false,
            selectedItem: null,
            type: oConfig.type,
            accountId: oConfig.accountId,
            isLoading: false,
          });

          // Store callback
          oDialog._onSelectCallback = oConfig.onSelect;
          oDialog._controller = oConfig.controller;

          // Open dialog
          oDialog.open();

          // Perform initial search if provided
          if (oConfig.initialSearch) {
            that._performSearch(oDialog, oConfig.initialSearch);
          } else {
            // Load initial data
            that._performSearch(oDialog, "");
          }
        };

        // Check if dialog already exists
        if (this._dialogs[sDialogId]) {
          openDialog(this._dialogs[sDialogId]);
        } else {
          // Create dialog first, then open it
          this._createDialog(oConfig, sDialogId).then(function () {
            openDialog(that._dialogs[sDialogId]);
          });
        }
      },

      /**
       * Creates a dialog instance
       * @param {Object} oConfig - Configuration object
       * @param {string} sDialogId - Dialog ID
       * @private
       */
      _createDialog: function (oConfig, sDialogId) {
        const that = this;
        const oController = oConfig.controller;

        // Create a temporary controller object for the fragment
        // We'll store the dialog reference after it's created
        const oFragmentController = {
          _oDialog: null, // Will be set after dialog creation
          
          onValueHelpSearch: function (oEvent) {
            const sSearch = oEvent.getParameter("query") || oEvent.getSource().getValue();
            const oDialog = this._oDialog || oEvent.getSource().getParent().getParent().getParent();
            that._performSearch(oDialog, sSearch);
          },
          onValueHelpSearchLiveChange: function (oEvent) {
            const sSearch = oEvent.getParameter("newValue");
            clearTimeout(that._searchTimeout);
            that._searchTimeout = setTimeout(function () {
              const oDialog = oFragmentController._oDialog || oEvent.getSource().getParent().getParent().getParent();
              that._performSearch(oDialog, sSearch);
            }, 500);
          },
          onValueHelpSelectionChange: function (oEvent) {
            const oTable = oEvent.getSource();
            const oDialog = this._oDialog || oTable.getParent().getParent().getParent();
            const oSelectedItem = oTable.getSelectedItem();
            const oModel = oDialog.getModel("valueHelpModel");

            if (oSelectedItem) {
              const oContext = oSelectedItem.getBindingContext("valueHelpModel");
              if (oContext) {
                const oData = oContext.getObject();
                oModel.setProperty("/selectedItem", oData);
                oModel.setProperty("/hasSelection", true);
                oModel.refresh(true);
              }
            } else {
              oModel.setProperty("/selectedItem", null);
              oModel.setProperty("/hasSelection", false);
              oModel.refresh(true);
            }
          },
          onValueHelpItemPress: function (oEvent) {
            const oItem = oEvent.getSource();
            const oTable = oItem.getParent();
            oTable.setSelectedItem(oItem);
            // Trigger selection change to update hasSelection
            const oDialog = this._oDialog || oTable.getParent().getParent().getParent();
            const oModel = oDialog.getModel("valueHelpModel");
            const oContext = oItem.getBindingContext("valueHelpModel");
            if (oContext) {
              const oData = oContext.getObject();
              oModel.setProperty("/selectedItem", oData);
              oModel.setProperty("/hasSelection", true);
              oModel.refresh(true);
            }
          },
          onValueHelpOk: function (oEvent) {
            const oDialog = this._oDialog || oEvent.getSource().getParent();
            const oModel = oDialog.getModel("valueHelpModel");
            const oSelectedItem = oModel.getProperty("/selectedItem");

            if (oSelectedItem && oDialog._onSelectCallback) {
              oDialog._onSelectCallback(oSelectedItem);
            }

            oDialog.close();
          },
          onValueHelpCancel: function (oEvent) {
            const oDialog = this._oDialog || oEvent.getSource().getParent();
            oDialog.close();
          },
        };

        // Create unique fragment ID to avoid duplicate ID errors
        const sFragmentId = `${oController.getView().getId()}_${sDialogId}`;
        
        // Check if fragment already exists
        const oExistingDialog = Fragment.byId(oController.getView().getId(), sFragmentId);
        if (oExistingDialog) {
          // Fragment already exists, just return it
          oFragmentController._oDialog = oExistingDialog;
          that._dialogs[sDialogId] = oExistingDialog;
          return Promise.resolve(oExistingDialog);
        }

        return Fragment.load({
          id: oController.getView().getId(),
          fragmentId: sFragmentId,
          name: "cloudrunway.control.ValueHelpDialog",
          controller: oFragmentController,
        }).then(function (oDialog) {
          // Store dialog reference in fragment controller for easy access
          oFragmentController._oDialog = oDialog;
          
          // Create and set model
          const oModel = new JSONModel({});
          oDialog.setModel(oModel, "valueHelpModel");

          // Add dialog to controller's dependents
          oController.getView().addDependent(oDialog);

          // Store dialog
          that._dialogs[sDialogId] = oDialog;
          
          return oDialog;
        });
      },

      /**
       * Performs search and updates dialog
       * @param {sap.m.Dialog} oDialog - Dialog instance
       * @param {string} sSearch - Search term
       * @private
       */
      _performSearch: function (oDialog, sSearch) {
        const oModel = oDialog.getModel("valueHelpModel");
        const sType = oModel.getProperty("/type");
        const sAccountId = oModel.getProperty("/accountId");

        oModel.setProperty("/isLoading", true);

        let oPromise;
        if (sType === "contactPerson") {
          oPromise = ValueHelpService.fetchContactPersons(sSearch, sAccountId);
        } else if (sType === "employee") {
          oPromise = ValueHelpService.fetchEmployees(sSearch);
        } else {
          oModel.setProperty("/isLoading", false);
          return;
        }

        oPromise
          .then(function (aResults) {
            oModel.setProperty("/results", aResults);
            oModel.setProperty(
              "/resultsCount",
              aResults.length === 1 ? "1 item" : `${aResults.length} items`
            );
            oModel.setProperty("/isLoading", false);
          })
          .catch(function (oError) {
            console.error("Error performing search:", oError);
            oModel.setProperty("/isLoading", false);
            oModel.setProperty("/results", []);
            oModel.setProperty("/resultsCount", "0 items");
          });
      }
    }

    return ValueHelpManager;
  }
);
