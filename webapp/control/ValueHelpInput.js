/**
 * @fileoverview Custom Value Help Input Control
 * @module control/ValueHelpInput
 */
sap.ui.define(
  [
    "sap/ui/core/Control",
    "sap/m/Input",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Label",
    "sap/ui/model/json/JSONModel",
    "cloudrunway/control/ValueHelpManager",
    "cloudrunway/control/ValueHelpService",
  ],
  function (Control, Input, Column, ColumnListItem, Label, JSONModel, ValueHelpManager, ValueHelpService) {
    "use strict";

    const ValueHelpInput = Control.extend("cloudrunway.control.ValueHelpInput", {
      metadata: {
        properties: {
          value: {
            type: "string",
            defaultValue: "",
          },
          valueHelpType: {
            type: "string",
            defaultValue: "contactPerson", // 'contactPerson' | 'employee'
          },
          accountId: {
            type: "string",
            defaultValue: "",
          },
          selectedItem: {
            type: "object",
            defaultValue: null,
          },
          enabled: {
            type: "boolean",
            defaultValue: true,
          },
          visible: {
            type: "boolean",
            defaultValue: true,
          },
          width: {
            type: "sap.ui.core.CSSSize",
            defaultValue: "100%",
          },
          required: {
            type: "boolean",
            defaultValue: false,
          },
          valueState: {
            type: "string",
            defaultValue: "None",
          },
          valueStateText: {
            type: "string",
            defaultValue: "",
          },
          placeholder: {
            type: "string",
            defaultValue: "",
          },
        },
        aggregations: {
          _inputField: {
            type: "sap.m.Input",
            multiple: false,
            visibility: "hidden",
          },
        },
        events: {
          valueSelected: {
            parameters: {
              value: {
                type: "string",
              },
              selectedItem: {
                type: "object",
              },
            },
          },
          change: {
            parameters: {
              value: {
                type: "string",
              },
            },
          },
        },
      },

      /**
       * Initialize the control
       */
      init: function () {
        const that = this;

        // Create internal Input control
        this._oInput = new Input({
          showValueHelp: true,
          showSuggestion: true,
          liveChange: this._onLiveChange.bind(this),
          valueHelpRequest: this._onValueHelpRequest.bind(this),
          suggest: this._onSuggestionRequest.bind(this),
          suggestionItemSelected: this._onSuggestionItemSelected.bind(this),
          value: this.getValue(),
          enabled: this.getEnabled(),
          visible: this.getVisible(),
          width: this.getWidth(),
          required: this.getRequired(),
          valueState: this.getValueState(),
          valueStateText: this.getValueStateText(),
          placeholder: this.getPlaceholder(),
          filterSuggests: false,
          suggestionColumns: this._getSuggestionColumns(),
        });

        // Create suggestion model
        const oSuggestionModel = new JSONModel({
          results: [],
          type: this.getValueHelpType(),
        });
        this._oInput.setModel(oSuggestionModel, "suggestionModel");

        // Create suggestion template
        const oSuggestionTemplate = this._getSuggestionTemplate();
        this._oInput.bindAggregation("suggestionRows", "suggestionModel>/results", oSuggestionTemplate);

        // Set aggregations
        this.setAggregation("_inputField", this._oInput);

        // Resolve display value if value is set and it's an ID
        if (this.getValue() && this.getValue().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          this._resolveDisplayValueForInput();
        }
      },

      /**
       * Called after rendering - check if selectedItem is available
       */
      onAfterRendering: function () {
        const oSelectedItem = this.getSelectedItem();
        
        // Update Input control if selectedItem is available
        if (this._oInput) {
          if (oSelectedItem && oSelectedItem.formattedName) {
            this._oInput.setValue(oSelectedItem.formattedName);
          } else if (this.getValue() && this.getValue().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // If value is an ID, try to resolve
            this._resolveDisplayValueForInput();
          }
        }
      },

      /**
       * Gets suggestion columns based on type
       * @returns {Array} Array of Column controls
       * @private
       */
      _getSuggestionColumns: function () {
        const aColumns = [
          new Column({
            header: new Label({
              text: "Name",
            }),
            width: "40%",
          }),
        ];

        if (this.getValueHelpType() === "contactPerson") {
          aColumns.push(
            new Column({
              header: new Label({
                text: "Title",
              }),
              width: "30%",
            })
          );
        } else {
          aColumns.push(
            new Column({
              header: new Label({
                text: "Display ID",
              }),
              width: "30%",
            })
          );
        }

        aColumns.push(
          new Column({
            header: new Label({
              text: "Email",
            }),
            width: "30%",
          })
        );

        return aColumns;
      },

      /**
       * Gets suggestion template
       * @returns {sap.m.ColumnListItem} Template for suggestions
       * @private
       */
      _getSuggestionTemplate: function () {
        const sType = this.getValueHelpType();
        const aCells = [
          new Text({
            text: "{suggestionModel>formattedName}",
            tooltip: "{suggestionModel>formattedName}",
          }),
        ];

        if (sType === "contactPerson") {
          aCells.push(
            new Text({
              text: "{suggestionModel>functionalTitleName}",
              tooltip: "{suggestionModel>functionalTitleName}",
            })
          );
        } else {
          aCells.push(
            new Text({
              text: "{suggestionModel>employeeDisplayId}",
              tooltip: "{suggestionModel>employeeDisplayId}",
            })
          );
        }

        aCells.push(
          new Text({
            text: "{= ${suggestionModel>eMail} || ${suggestionModel>workplaceAddress/eMail} || ''}",
            tooltip: "{= ${suggestionModel>eMail} || ${suggestionModel>workplaceAddress/eMail} || ''}",
          })
        );

        return new ColumnListItem({
          cells: aCells,
        });
      },

      /**
       * Handles live change event
       * @param {sap.ui.base.Event} oEvent - Event object
       * @private
       */
      _onLiveChange: function (oEvent) {
        const sValue = oEvent.getParameter("value");
        this.setValue(sValue);
        this.fireEvent("change", {
          value: sValue,
        });
      },

      /**
       * Handles value help request
       * @param {sap.ui.base.Event} oEvent - Event object
       * @private
       */
      _onValueHelpRequest: function (oEvent) {
        const that = this;
        const sType = this.getValueHelpType();
        const sTitle = sType === "contactPerson" ? "Select Contact Person" : "Select Employee";
        const sPlaceholder = sType === "contactPerson" ? "Search by name or email..." : "Search by name or email...";

        ValueHelpManager.openValueHelpDialog({
          type: sType,
          title: sTitle,
          searchPlaceholder: sPlaceholder,
          tableTitle: "Results",
          accountId: this.getAccountId(),
          initialSearch: this.getValue(),
          controller: this._getController(),
          onSelect: function (oSelectedItem) {
            that._handleSelection(oSelectedItem);
          },
        });
      },

      /**
       * Handles suggestion request
       * @param {sap.ui.base.Event} oEvent - Event object
       * @private
       */
      _onSuggestionRequest: function (oEvent) {
        const that = this;
        const sValue = oEvent.getParameter("suggestValue");
        const oSuggestionModel = this._oInput.getModel("suggestionModel");

        if (!sValue || sValue.length < 2) {
          oSuggestionModel.setProperty("/results", []);
          return;
        }

        // Debounce search
        clearTimeout(this._suggestionTimeout);
        this._suggestionTimeout = setTimeout(function () {
          const sType = that.getValueHelpType();
          let oPromise;

          if (sType === "contactPerson") {
            oPromise = ValueHelpService.fetchContactPersons(sValue, that.getAccountId());
          } else {
            oPromise = ValueHelpService.fetchEmployees(sValue);
          }

          oPromise
            .then(function (aResults) {
              oSuggestionModel.setProperty("/results", aResults);
            })
            .catch(function (oError) {
              console.error("Error fetching suggestions:", oError);
              oSuggestionModel.setProperty("/results", []);
            });
        }, 300);
      },

      /**
       * Handles suggestion item selection
       * @param {sap.ui.base.Event} oEvent - Event object
       * @private
       */
      _onSuggestionItemSelected: function (oEvent) {
        const oSelectedRow = oEvent.getParameter("selectedRow");
        const oContext = oSelectedRow.getBindingContext("suggestionModel");
        const oSelectedItem = oContext.getObject();

        this._handleSelection(oSelectedItem);
      },

      /**
       * Handles selection from dialog or suggestion
       * @param {Object} oSelectedItem - Selected item object
       * @private
       */
      _handleSelection: function (oSelectedItem) {
        const sDisplayValue = oSelectedItem.formattedName || "";
        this.setValue(sDisplayValue);
        this.setSelectedItem(oSelectedItem);

        this.fireEvent("valueSelected", {
          value: sDisplayValue,
          selectedItem: oSelectedItem,
        });
      },

      /**
       * Resolves display value from ID for Input control (edit mode)
       * @private
       */
      _resolveDisplayValueForInput: function () {
        const that = this;
        const sValue = this.getValue();
        const sType = this.getValueHelpType();

        // Try to resolve from selectedItem first (prioritize bound selectedItem)
        const oSelectedItem = this.getSelectedItem();
        if (oSelectedItem && oSelectedItem.formattedName) {
          if (this._oInput) {
            this._oInput.setValue(oSelectedItem.formattedName);
          }
          return;
        }

        // If no value, don't resolve
        if (!sValue) {
          return;
        }

        // Resolve from API
        let oPromise;
        if (sType === "contactPerson") {
          oPromise = ValueHelpService.resolveContactPersonById(sValue, this.getAccountId());
        } else {
          oPromise = ValueHelpService.resolveEmployeeById(sValue);
        }

        oPromise.then(function (oResolved) {
          if (oResolved && oResolved.formattedName && that._oInput) {
            that._oInput.setValue(oResolved.formattedName);
            // Only update selectedItem if it's not already set (avoid overwriting bound value)
            if (!that.getSelectedItem()) {
              that.setSelectedItem(oResolved);
            }
          }
        }).catch(function (oError) {
          console.error("Error resolving display value for input:", oError);
        });
      },


      /**
       * Gets the controller instance
       * @returns {sap.ui.core.mvc.Controller} Controller instance
       * @private
       */
      _getController: function () {
        let oParent = this.getParent();
        while (oParent) {
          if (oParent.getController && oParent.getController()) {
            return oParent.getController();
          }
          oParent = oParent.getParent();
        }
        return null;
      },

      /**
       * Override setValue to update internal controls
       * @param {string} sValue - New value
       * @returns {this} this for chaining
       */
      setValue: function (sValue) {
        this.setProperty("value", sValue, true);
        if (this._oInput) {
          // If we have selectedItem with formattedName, use that instead of ID
          const oSelectedItem = this.getSelectedItem();
          if (oSelectedItem && oSelectedItem.formattedName) {
            this._oInput.setValue(oSelectedItem.formattedName);
          } else if (sValue && sValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            // If value is an ID and we don't have selectedItem yet, try to resolve
            this._resolveDisplayValueForInput();
          } else {
            this._oInput.setValue(sValue);
          }
        }
        return this;
      },

      /**
       * Override setSelectedItem to update display when object is set via binding
       * @param {Object|null} oSelectedItem - Selected item object
       * @returns {this} this for chaining
       */
      setSelectedItem: function (oSelectedItem) {
        // Convert empty string to null to match property type
        const oValue = oSelectedItem === "" || oSelectedItem === undefined ? null : oSelectedItem;
        this.setProperty("selectedItem", oValue, true);
        
        // Update Input control with formattedName if available
        if (this._oInput && oValue && oValue.formattedName) {
          this._oInput.setValue(oValue.formattedName);
        }
        
        return this;
      },

      /**
       * Override setEnabled
       * @param {boolean} bEnabled - Enabled flag
       * @returns {this} this for chaining
       */
      setEnabled: function (bEnabled) {
        this.setProperty("enabled", bEnabled, true);
        if (this._oInput) {
          this._oInput.setEnabled(bEnabled);
        }
        return this;
      },

      /**
       * Override setVisible
       * @param {boolean} bVisible - Visible flag
       * @returns {this} this for chaining
       */
      setVisible: function (bVisible) {
        this.setProperty("visible", bVisible, true);
        if (this._oInput) {
          this._oInput.setVisible(bVisible);
        }
        return this;
      },

      /**
       * Renderer function
       * @param {sap.ui.core.RenderManager} oRM - Render manager
       * @param {sap.ui.core.Control} oControl - Control instance
       */
      renderer: function (oRM, oControl) {
        oRM.openStart("div", oControl);
        oRM.class("cloudrunwayValueHelpInput");
        oRM.openEnd();

        // Render Input control
        oRM.renderControl(oControl.getAggregation("_inputField"));

        oRM.close("div");
      },
    });

    return ValueHelpInput;
  }
);
