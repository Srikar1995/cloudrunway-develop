sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "cloudrunway/model/Formatter",
    "cloudrunway/controller/CreateDialog",
    "cloudrunway/model/Common",
    "cloudrunway/control/ValueHelpService",
  ],
  function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Fragment,
    formatter,
    CreateDialog,
    Common,
    ValueHelpService,
  ) {
    "use strict";
    
    return Controller.extend("cloudrunway.controller.Termination", {
      formatter: formatter,
      CreateDialog: CreateDialog,

      // Constants
      tempIdPrefix: "temp_",
      defaultMimeType: "application/octet-stream",
      pdfFileExtension: ".pdf",
      defaultFileName: "attachment",
      defaultCreatedBy: "Current User",
      httpStatusSuccess: 204,
      httpStatusOk: 200,

      onInit: function () {
        this._initialisation();
        this._readUrlParameters();
        this._loadDropdownValuesFromJson();
      },

      onAfterRendering: function () {
        this._preValidate();
      },

      _preValidate: function () {
        const oView = this.getView();
        const oODataModel = oView.getModel("terminationModelV4");
        const oTerminationModel = oView.getModel("terminationModel");
        const sOpportunityId = oTerminationModel.getProperty("/OpportunityID");

        const oActionBinding = oODataModel.bindContext(
          "/preValidateTerminationRequest(...)",
        );

        oActionBinding.setParameter("opportunityId", sOpportunityId);

        oActionBinding
          .execute()
          .then(() => {
            const oResult = oActionBinding.getBoundContext().getObject();
            const oActiveTAValidation = oResult.validationResults.find((obj) => obj.checkName === "ActiveTerminationCheck");
            oTerminationModel.setProperty("/preValidationData", oResult);
            this._readOppData();
            this._readTerminations();
          })
          .catch((oError) => {
            oTerminationModel.setProperty("/taMessages", [
              {
                message: oError.message,
                type: "Error",
              },
            ])
          });
      },

      _initialisation: function () {
        const oView = this.getView();
        const oTerminationModel = new JSONModel({
          OpportunityID: "",
          Path: "",
          BusinessScenario: "",
          TerminationOrigin: "",
          RenewalRiskReason: "Info from Renewal risk - unsupported",
          TerminationRequester: "",
          TerminationResponsible: "Preselected name",
          TerminationReceiptDate: null,
          TerminationEffectiveDate: null,
          Attachments: [],
          TerminationOriginList: [],
          TerminationStatusList: [],
          TerminationRetractionReasons: [],
          BusinessScenarioList: [],
          RenewalRiskReasonList: [],
          TerminationsList: [],
          activeTermination: {},
          activeTerminationEditMode: false,
          taMessages: [],
          taUpdateMessages: [],
          createOpen: false,
          validOpp: false,
          subscriptionContractId: "",
          oppRenewalRiskReason: "",
          oppBusinessScenario: "",
          oppOrigin: "",
          pendingAttachments: [],
          deletedAttachmentIds: [],
          originalAttachmentsList: [],
          mergedAttachmentsList: [],
          originalActiveTermination: null
        });
        oView.setModel(oTerminationModel, "terminationModel");
      },

      _readUrlParameters: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const urlParams = new URLSearchParams(window.location.search);

        const sOpportunityID = urlParams.get("OpportunityID");
        if (sOpportunityID) {
          oTerminationModel.setProperty("/OpportunityID", sOpportunityID);
        }
      },

      _loadDropdownValuesFromJson: function () {
        const oView = this.getView();
        const oTerminationModel = oView.getModel("terminationModel"); // main model
        const oLocalModel = new JSONModel("model/terminationMasterData.json");
        oLocalModel.attachRequestCompleted(() => {
          const oData = oLocalModel.getData();

          if (!oTerminationModel) {
            console.error("terminationModel is not available!");
            return;
          }

          const properties = [
            "TerminationRetractionReasons",
            "TerminationOriginList",
            "TerminationStatusList",
            "BusinessScenarioList",
            "RenewalRiskReasonList",
          ];

          properties.forEach(prop => {
            oTerminationModel.setProperty(`/${prop}`, oData[prop] || []);
          });
        });

        oLocalModel.attachRequestFailed(() => {
          MessageToast.show("Failed to load terminationMasterData.json");
        });
      },
      _readOppData: function () {
        const that = this;
        const oTerminationModel = this.getView().getModel("terminationModel");
        const sOppId = oTerminationModel.getProperty("/OpportunityID");
        const sOppReadUrl =
          sap.ui.require.toUrl("cloudrunway") +
          `/sapsalesservicecloudv2/opportunity-service/opportunities?$top=10&$filter=displayId eq '${sOppId}'`;
        $.ajax({
          url: sOppReadUrl,
          method: "GET",
          contentType: "application/json",
          success: function (oResult) {
            if (oResult?.value?.length) {
              const oData = oResult?.value[0];
              oTerminationModel.setProperty("/subscriptionContractId", oData.extensions?.Z_ContractDocId);
              oTerminationModel.setProperty("/oppRenewalRiskReason", oData.extensions?.Z_RenewalRiskReason);
              oTerminationModel.setProperty("/oppBusinessScenario", oData.extensions?.Z_BusinessScenario);
              oTerminationModel.setProperty("/oppAccountID", oData.account?.id);
              oTerminationModel.setProperty("/contractEndDate", oData.extensions?.Z_QuoteContractEndDate);
              oTerminationModel.setProperty("/oppOrigin", oData.source);
              // that._fetchContractDetails(oData.extensions?.Z_ContractDocId);
            } else {
              oTerminationModel.setProperty("/taMessages", [
                {
                  message: Common.getLocalTextByi18nValue("OPPNOTFOUND"),
                  type: "Error",
                },
              ]);
            }
          },
          error: function () {
            oTerminationModel.setProperty("/taMessages", [
              {
                message: Common.getLocalTextByi18nValue("OPPERROR"),
                type: "Error",
              },
            ]);
          },
        });
      },
      _fetchContractDetails: function (sContractID) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const sContractReadUrl =
          sap.ui.require.toUrl("cloudrunway") +
          `/sapsalesservicecloudv2/subscription-contract-service/subscriptionContractDocuments?$top=10&$filter=externalId.displayId eq '${sContractID}'`;
        $.ajax({
          url: sContractReadUrl,
          method: "GET",
          contentType: "application/json",
          success: function (oResult) {
            if (oResult?.value?.length) {
              const oData = oResult?.value[0];
              oTerminationModel.setProperty("/contractEndDate", oData.items[oData.items.length - 1].endDate);
            } else {
              oTerminationModel.setProperty("/taMessages", [
                {
                  message: Common.getLocalTextByi18nValue("CONTRACTNOTFOUND"),
                  type: "Error",
                },
              ]);
            }
          },
          error: function () {
            oTerminationModel.setProperty("/taMessages", [
              {
                message: Common.getLocalTextByi18nValue("CONTRACTERROR"),
                type: "Error",
              },
            ]);
          },
        });
      },
      _readTerminations: function () {
        const that = this;
        const oView = this.getView();
        const oODataModel = this.getView().getModel("terminationModelV4");
        const oTerminationModel = oView.getModel("terminationModel");
        const sOppId = oTerminationModel.getProperty("/OpportunityID");
        if (!oODataModel) {
          sap.m.MessageBox.error("OData V4 model not found.");
          return;
        }

        const oListBinding = oODataModel.bindList(
          "/TerminationRequests",
          undefined,
          undefined,
          [
            new sap.ui.model.Filter(
              "opportunityId",
              sap.ui.model.FilterOperator.EQ,
              sOppId
            ),
          ]
        );

        oListBinding
          .requestContexts()
          .then(
            async function (aContexts) {
              const aResults = aContexts.map((oCtx) => oCtx.getObject());
              if (aResults?.length) {
                const sortedResults = aResults.sort((a, b) => {
                  return new Date(b.modifiedAt) - new Date(a.modifiedAt);
                });
                
                // Resolve IDs to names for display in table
                for (const oTermination of sortedResults) {
                  if (oTermination.terminationResponsible) {
                    try {
                      const oEmployee = await ValueHelpService.resolveEmployeeById(oTermination.terminationResponsible);
                      if (oEmployee && oEmployee.formattedName) {
                        oTermination.terminationResponsibleResolved = oEmployee.formattedName;
                      }
                    } catch (oError) {
                      console.error("Error resolving employee:", oError);
                    }
                  }
                  // Resolve createdBy employeeDisplayId to formattedName
                  if (oTermination.createdBy) {
                    try {
                      const oCreatedByEmployee = await ValueHelpService.resolveEmployeeById(oTermination.createdBy);
                      if (oCreatedByEmployee && oCreatedByEmployee.formattedName) {
                        oTermination.createdByResolved = oCreatedByEmployee.formattedName;
                      }
                    } catch (oError) {
                      console.error("Error resolving createdBy employee:", oError);
                    }
                  }
                }
                
                oTerminationModel.setProperty(
                  "/TerminationsList",
                  sortedResults,
                );
                
                const oActiveTermination = { ...aResults[0] };
                // Resolve IDs for active termination display
                if (oActiveTermination.terminationRequester) {
                  try {
                    const oContact = await ValueHelpService.resolveContactPersonById(
                      oActiveTermination.terminationRequester,
                      oTerminationModel.getProperty("/oppAccountID")
                    );
                    if (oContact) {
                      oActiveTermination.requesterObject = oContact;
                    }
                  } catch (oError) {
                    console.error("Error resolving contact person:", oError);
                  }
                }
                if (oActiveTermination.terminationResponsible) {
                  try {
                    const oEmployee = await ValueHelpService.resolveEmployeeById(oActiveTermination.terminationResponsible);
                    if (oEmployee) {
                      oActiveTermination.responsibleObject = oEmployee;
                      oActiveTermination.terminationResponsibleResolved = oEmployee.formattedName;
                    }
                  } catch (oError) {
                    console.error("Error resolving employee:", oError);
                  }
                }
                
                oTerminationModel.setProperty("/activeTermination", oActiveTermination);
                that._readAttachments(aResults[0]);
              }
              oTerminationModel.setProperty(
                "/activeTerminationEditMode",
                false
              );
            }.bind(this)
          )
          .catch(function (oError) {
            console.error("No Terminations found");
          });
      },
      onTerminationSelect: async function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const selectedItem = oEvent
          .getSource()
          .getBindingContext("terminationModel")
          .getObject();
        
        const oActiveTermination = { ...selectedItem };
        
        // Resolve IDs to objects for display
        if (oActiveTermination.terminationRequester) {
          try {
            const oContact = await ValueHelpService.resolveContactPersonById(
              oActiveTermination.terminationRequester,
              oTerminationModel.getProperty("/oppAccountID")
            );
            if (oContact) {
              oActiveTermination.requesterObject = oContact;
            }
          } catch (oError) {
            console.error("Error resolving contact person:", oError);
          }
        }
        if (oActiveTermination.terminationResponsible) {
          try {
            const oEmployee = await ValueHelpService.resolveEmployeeById(oActiveTermination.terminationResponsible);
            if (oEmployee) {
              oActiveTermination.responsibleObject = oEmployee;
            }
          } catch (oError) {
            console.error("Error resolving employee:", oError);
          }
        }
        
        oTerminationModel.setProperty("/activeTermination", oActiveTermination);
        // Clear any pending state when selecting a different termination
        oTerminationModel.setProperty("/pendingAttachments", []);
        oTerminationModel.setProperty("/deletedAttachmentIds", []);
        // Clear original termination data
        oTerminationModel.setProperty("/originalActiveTermination", null);
        this._readAttachments(selectedItem);
        oTerminationModel.setProperty("/activeTerminationEditMode", false);
      },
      onTerminationEdit: function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const oActiveTermination = oTerminationModel.getProperty("/activeTermination");
        
        // Store original termination data for cancel functionality
        const oOriginalTermination = JSON.parse(JSON.stringify(oActiveTermination));
        oTerminationModel.setProperty("/originalActiveTermination", oOriginalTermination);
        
        // Create snapshot of current attachments list
        const aCurrentAttachments = oTerminationModel.getProperty("/AttachmentsList") || [];
        oTerminationModel.setProperty("/originalAttachmentsList", JSON.parse(JSON.stringify(aCurrentAttachments)));
        
        // Initialize pending state
        oTerminationModel.setProperty("/pendingAttachments", []);
        oTerminationModel.setProperty("/deletedAttachmentIds", []);
        
        // Update merged list
        this._getMergedAttachmentsList();
        
        oTerminationModel.setProperty("/activeTerminationEditMode", true);
      },
      onTerminationEditCancel: function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const oODataModel = this.getView().getModel("terminationModelV4");
        
        // Restore original termination data
        const oOriginalTermination = oTerminationModel.getProperty("/originalActiveTermination");
        if (oOriginalTermination) {
          oTerminationModel.setProperty("/activeTermination", JSON.parse(JSON.stringify(oOriginalTermination)));
        }
        
        // Restore original attachments list
        const aOriginalAttachments = oTerminationModel.getProperty("/originalAttachmentsList") || [];
        oTerminationModel.setProperty("/AttachmentsList", JSON.parse(JSON.stringify(aOriginalAttachments)));
        
        // Clear pending state
        oTerminationModel.setProperty("/pendingAttachments", []);
        oTerminationModel.setProperty("/deletedAttachmentIds", []);
        
        // Clear original termination data
        oTerminationModel.setProperty("/originalActiveTermination", null);
        
        // Update merged list
        this._getMergedAttachmentsList();
        
        oTerminationModel.setProperty("/activeTerminationEditMode", false);
        oODataModel.resetChanges("TerminationUpdateGroup");
      },
      onTerminationUpdate: async function (oEvent) {
        const that = this;
        const oTerminationModel = this.getView().getModel("terminationModel");
        this._clearMessages();
        const updatedData = oTerminationModel.getProperty("/activeTermination");
        const oODataModel = this.getView().getModel("terminationModelV4");

        // Check for attachment validation when status or date changes
        const oOriginalTermination = oTerminationModel.getProperty("/originalActiveTermination");
        const oOriginalStatus = oOriginalTermination ? oOriginalTermination.status : null;
        const oOriginalEffectiveDate = oOriginalTermination ? oOriginalTermination.terminationEffectiveDate : null;
        const aMergedAttachments = oTerminationModel.getProperty("/mergedAttachmentsList") || [];
        const bHasAttachments = aMergedAttachments.length > 0;

        // Check if status changed to Retracted
        const bStatusChangedToRetracted = 
          updatedData.status === "Retracted" && 
          oOriginalStatus !== "Retracted" && 
          !bHasAttachments;

        // Check if effective date changed
        const bEffectiveDateChanged = 
          updatedData.terminationEffectiveDate !== oOriginalEffectiveDate && 
          !bHasAttachments;

        if (bStatusChangedToRetracted) {
          oTerminationModel.setProperty("/taUpdateMessages", [
            { message: Common.getLocalTextByi18nValue("MISSINGRETRACTIONATTACHMENT"), type: "Error" }
          ]);
          return;
        }

        if (bEffectiveDateChanged) {
          oTerminationModel.setProperty("/taUpdateMessages", [
            { message: Common.getLocalTextByi18nValue("MISSINGSWITCHINGPERIODATTACHMENT"), type: "Error" }
          ]);
          return;
        }

        const isMandatoryFieldsEmpty =
          !updatedData.status ||
          !updatedData.terminationOrigin ||
          !updatedData.terminationRequester ||
          !updatedData.terminationResponsible ||
          !updatedData.terminationReceiptDate ||
          !updatedData.terminationEffectiveDate;

        const isRetractedFieldsEmpty =
          updatedData.status === "Retracted" &&
          (!updatedData.retractionReason ||
            !updatedData.retractionReceivedDate);

        if (isMandatoryFieldsEmpty || isRetractedFieldsEmpty) {
          oTerminationModel.setProperty("/taUpdateMessages", [
            { message: "Please enter all mandatory fields", type: "Error" },
          ]);
          return;
        }

        try {
          // Step 1: Upload all pending attachments
          const aPendingAttachments = oTerminationModel.getProperty("/pendingAttachments") || [];
          const aPendingToUpload = [...aPendingAttachments]; // Create a copy
          
          for (const oPendingAttachment of aPendingToUpload) {
            if (oPendingAttachment.file) {
              await this._uploadAttachment(oPendingAttachment.file, updatedData.ID);
              // Remove this pending attachment from the array after successful upload
              const aCurrentPending = oTerminationModel.getProperty("/pendingAttachments") || [];
              const aUpdatedPending = aCurrentPending.filter((oPending) => {
                return oPending.tempId !== oPendingAttachment.tempId && oPending.ID !== oPendingAttachment.ID;
              });
              oTerminationModel.setProperty("/pendingAttachments", aUpdatedPending);
            }
          }

          // Step 2: Delete all attachments marked for deletion
          const aDeletedIds = oTerminationModel.getProperty("/deletedAttachmentIds") || [];
          const aCurrentAttachments = oTerminationModel.getProperty("/AttachmentsList") || [];
          
          for (const oAttachment of aCurrentAttachments) {
            // Check if this attachment should be deleted
            let bShouldDelete = false;
            if (oAttachment.ID && aDeletedIds.includes(oAttachment.ID)) {
              bShouldDelete = true;
            }
            if (oAttachment.up__ID && oAttachment.ID) {
              const sCompoundKey = `${oAttachment.up__ID}_${oAttachment.ID}`;
              if (aDeletedIds.includes(sCompoundKey)) {
                bShouldDelete = true;
              }
            }
            
            if (bShouldDelete) {
              await this._deleteAttachmentFromDB(oAttachment);
            }
          }

          // Step 3: Extract IDs from objects if they exist
          let sRequesterId = updatedData.terminationRequester;
          let sResponsibleId = updatedData.terminationResponsible;
          
          // If we have objects stored, extract defaultExternalContactId from them
          if (updatedData.requesterObject && updatedData.requesterObject.defaultExternalContactId) {
            sRequesterId = updatedData.requesterObject.defaultExternalContactId;
          } else if (typeof updatedData.terminationRequester === "object" && updatedData.terminationRequester.defaultExternalContactId) {
            sRequesterId = updatedData.terminationRequester.defaultExternalContactId;
          }
          
          // If we have objects stored, extract employeeDisplayId from them
          if (updatedData.responsibleObject && updatedData.responsibleObject.employeeDisplayId) {
            sResponsibleId = updatedData.responsibleObject.employeeDisplayId;
          } else if (typeof updatedData.terminationResponsible === "object" && updatedData.terminationResponsible.employeeDisplayId) {
            sResponsibleId = updatedData.terminationResponsible.employeeDisplayId;
          }

          // Step 4: Save form data
          const oContextBinding = oODataModel.bindContext(
            `/TerminationRequests(ID='${updatedData.ID}')`,
            undefined,
            { $$updateGroupId: "TerminationUpdateGroup" }
          );
          const oCtx = oContextBinding.getBoundContext();
          oCtx.setProperty("status", updatedData.status);
          oCtx.setProperty("terminationOrigin", updatedData.terminationOrigin);
          oCtx.setProperty("terminationRequester", sRequesterId);
          oCtx.setProperty("terminationResponsible", sResponsibleId);
          oCtx.setProperty(
            "terminationReceiptDate",
            updatedData.terminationReceiptDate
          );
          oCtx.setProperty(
            "terminationEffectiveDate",
            updatedData.terminationEffectiveDate
          );
          if (updatedData.status === "Retracted") {
            oCtx.setProperty("retractionReason", updatedData.retractionReason);
            oCtx.setProperty(
              "retractionReceivedDate",
              updatedData.retractionReceivedDate
            );
          }
          
          await oODataModel.submitBatch("TerminationUpdateGroup");
          
          // Step 5: Clear pending attachments and deleted IDs
          oTerminationModel.setProperty("/pendingAttachments", []);
          oTerminationModel.setProperty("/deletedAttachmentIds", []);
          
          // Step 6: Refresh attachments from DB
          const oActiveTermination = oTerminationModel.getProperty("/activeTermination");
          await this._readAttachments(oActiveTermination);
          
          sap.m.MessageToast.show("Termination updated successfully.");
          this._readTerminations();
          oTerminationModel.setProperty("/activeTerminationEditMode", false);
        } catch (oError) {
          console.error("Error updating termination:", oError);
          sap.m.MessageBox.error(oError.message || "Update failed");
        }
      },
      _uploadAttachment: function (oFile, sTerminationId) {
        const that = this;
        const oODataModel = this.getView().getModel("terminationModelV4");
        if (!oODataModel) {
          return Promise.reject(new Error("OData V4 model not found."));
        }

        const oMetadata = {
          filename: oFile.name,
          mimeType: oFile.type || this.defaultMimeType,
          note: "Uploaded via UI",
        };

        const sTerminationKey = this._formatKey(sTerminationId);

        const oListBinding = oODataModel.bindList(
          `/TerminationRequests(ID=${sTerminationKey})/attachments`
        );
        const oContext = oListBinding.create(oMetadata);

        return oContext
          .created()
          .then(async (oCreatedData) => {
            const oAttachment = oContext.getObject();
            return that._uploadAttachmentContent(oAttachment, oFile);
          })
          .catch((err) => {
            console.error("Upload failed:", err);
            throw err;
          });
      },

      _uploadAttachmentContent: async function (oAttachment, oFile) {
        const oODataModel = this.getView().getModel("terminationModelV4");
        const sAttachmentKey = this._formatAttachmentKey(oAttachment);

        // Use /content endpoint for uploads
        const sPath = `/TerminationRequestAttachments(${sAttachmentKey})/content`;

        const sServiceUrl = oODataModel.getServiceUrl();
        const sFullUrl = sServiceUrl.replace(/\/$/, "") + sPath;

        const fileBuffer = await oFile.arrayBuffer();

        console.log("Uploading file:", {
          fullUrl: sFullUrl,
          size: fileBuffer.byteLength,
          fileName: oFile.name,
        });
        const res = await fetch(sFullUrl, {
          method: "PUT",
          headers: {
            "Content-Type": this.defaultMimeType,
          },
          credentials: "include", // This should use the session from the model's create() call
          body: fileBuffer,
        });

        // 204 is success
        if (res.status === this.httpStatusSuccess || res.status === this.httpStatusOk || res.ok) {
          console.log("Upload response status:", res.status);
          console.log("File uploaded successfully");
          return res;
        } else {
          const errText = await res.text();
          throw new Error(`Upload failed (${res.status}): ${errText}`);
        }
      },
      // ============================================
      // Helper Methods
      // ============================================

      /**
       * Formats OData key - quotes strings/GUIDs, leaves numbers as-is
       * @param {string} sKey - The key to format
       * @returns {string} Formatted key
       */
      _formatKey: function (sKey) {
        if (sKey === null || sKey === undefined) return sKey;
        // If numeric, return as-is; otherwise return quoted and escape single quotes
        if (/^[0-9]+$/.test(String(sKey))) {
          return sKey;
        }
        return "'" + String(sKey).replace(/'/g, "''") + "'";
      },

      /**
       * Formats attachment key for OData operations (handles compound and simple keys)
       * @param {object} oAttachment - Attachment object
       * @returns {string} Formatted attachment key
       */
      _formatAttachmentKey: function (oAttachment) {
        if (oAttachment.up__ID && oAttachment.ID) {
          // Compound key
          const sUpId = this._formatKey(oAttachment.up__ID);
          const sId = this._formatKey(oAttachment.ID);
          return `up__ID=${sUpId},ID=${sId}`;
        } else {
          // Simple key
          return `ID=${this._formatKey(oAttachment.ID)}`;
        }
      },

      /**
       * Merges existing attachments with pending attachments and filters deleted ones
       * Updates the mergedAttachmentsList in the model for UI binding
       * @returns {Array} Merged array of attachments
       */
      _getMergedAttachmentsList: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const aExistingAttachments = oTerminationModel.getProperty("/AttachmentsList") || [];
        const aPendingAttachments = oTerminationModel.getProperty("/pendingAttachments") || [];
        const aDeletedIds = oTerminationModel.getProperty("/deletedAttachmentIds") || [];

        // Filter out deleted attachments from existing list
        const aFilteredExisting = aExistingAttachments.filter((oAttachment) => {
          // Check if this attachment should be deleted
          if (oAttachment.ID && aDeletedIds.includes(oAttachment.ID)) {
            return false;
          }
          // For compound keys, check both IDs
          if (oAttachment.up__ID && oAttachment.ID) {
            const sCompoundKey = `${oAttachment.up__ID}_${oAttachment.ID}`;
            return !aDeletedIds.includes(sCompoundKey);
          }
          return true;
        });

        // Combine filtered existing with pending
        const aMerged = [...aFilteredExisting, ...aPendingAttachments];
        
        // Update the merged list in model for binding
        oTerminationModel.setProperty("/mergedAttachmentsList", aMerged);
        
        return aMerged;
      },

      /**
       * Clears update messages from the model
       */
      _clearMessages: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        oTerminationModel.setProperty("/taUpdateMessages", []);
      },

      // Read attachments metadata for a termination
      _readAttachments: function (oTermination) {
        const oView = this.getView();
        const oODataModel = oView.getModel("terminationModelV4");
        const oTerminationModel = oView.getModel("terminationModel");
        if (!oODataModel) {
          sap.m.MessageBox.error("OData V4 model not found.");
          return Promise.reject(new Error("OData V4 model not found."));
        }
        const sKey = this._formatKey(oTermination.ID);
        const sPath = `/TerminationRequests(ID=${sKey})/attachments`;

        const oListBinding = oODataModel.bindList(sPath);

        return oListBinding
          .requestContexts()
          .then(
            function (aContexts) {
              const aResults = aContexts.map((oCtx) => oCtx.getObject());
              // store on terminationModel so the UI can bind to /AttachmentsList
              oTerminationModel.setProperty("/AttachmentsList", aResults || []);
              // Update merged list for display
              this._getMergedAttachmentsList();
              return aResults;
            }.bind(this)
          )
          .catch(function (oError) {
            console.error("Error reading attachments:", oError);
            sap.m.MessageToast.show("Failed to read attachments.");
            return Promise.reject(oError);
          });
      },
      onUpload: function () {
        const oView = this.getView();
        const oTerminationModel = oView.getModel("terminationModel");
        const oCurrentTermination =
          oTerminationModel.getProperty("/activeTermination");

        if (!oCurrentTermination || !oCurrentTermination.ID) {
          MessageBox.error("No termination request selected");
          return;
        }

        // Create a hidden file input
        const oFileInput = document.createElement("input");
        oFileInput.type = "file";
        oFileInput.accept = this.pdfFileExtension;

        oFileInput.onchange = (event) => {
          const oFile = event.target.files[0];
          if (!oFile) return;

          // Generate a temporary ID for the pending attachment
          const sTempId = this.tempIdPrefix + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
          
          // Create a local attachment object
          const oPendingAttachment = {
            file: oFile,
            filename: oFile.name,
            mimeType: oFile.type || this.defaultMimeType,
            isPending: true,
            tempId: sTempId,
            ID: sTempId, // Use tempId as ID for binding purposes
            createdAt: new Date().toISOString(),
            createdBy: this.defaultCreatedBy // You may want to get this from user context
          };

          // Add to pending attachments
          const aPendingAttachments = oTerminationModel.getProperty("/pendingAttachments") || [];
          aPendingAttachments.push(oPendingAttachment);
          oTerminationModel.setProperty("/pendingAttachments", aPendingAttachments);

          // Update merged list for display
          this._getMergedAttachmentsList();
        };

        oFileInput.click();
      },


      onDownload: function (oEvent) {
        const oSource = oEvent.getSource();
        const oContext = oSource.getBindingContext("terminationModel");
        const oAttachment = oContext.getObject();

        this._downloadAttachment(oAttachment);
      },

      // Download binary for an attachment and trigger browser download
      _downloadAttachment: async function (oAttachment) {
        if (!oAttachment) {
          sap.m.MessageToast.show("Attachment not available.");
          return;
        }

        // Handle pending attachments (local files)
        if (oAttachment.isPending && oAttachment.file) {
          try {
            const blob = oAttachment.file;
            const fileName = oAttachment.filename || oAttachment.file.name || this.defaultFileName;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            sap.m.MessageToast.show("Download started");
            return;
          } catch (err) {
            console.error("Error downloading pending attachment:", err);
            sap.m.MessageBox.error(err.message || "Failed to download attachment.");
            return;
          }
        }

        if (!oAttachment.ID) {
          sap.m.MessageToast.show("Attachment not available.");
          return;
        }

        let sMediaLink =
          oAttachment["@odata.mediaReadLink"] ||
          oAttachment["@odata.mediaEditLink"];

        if (!sMediaLink) {
          // For downloads, we only need the ID part (not the full compound key)
          const sAttachmentId = this._formatKey(oAttachment.ID);
          const sAttachmentKey = `ID=${sAttachmentId}`;
          
          // Use /content endpoint for downloads
          sMediaLink = sap.ui.require.toUrl("cloudrunway") + `/terminationbackend/odata/v4/termination/TerminationRequests(${oAttachment.up__ID})/attachments(${sAttachmentKey})/content`;
        } else {
          // If server returned a relative media link, make sure it's using the same backend prefix
          if (!sMediaLink.startsWith("http") && !sMediaLink.startsWith("/")) {
            sMediaLink = sap.ui.require.toUrl("cloudrunway") + `/terminationbackend/odata/v4/termination/${sMediaLink}`;
          }
          // Ensure it has the endpoint suffix
          if (
            !sMediaLink.includes("$value") &&
            !sMediaLink.includes("/content")
          ) {
            // Default to /$value for downloads
            sMediaLink = sMediaLink.endsWith("/")
              ? sMediaLink + "$value"
              : sMediaLink + "/$value";
          }
        }

        try {
          console.log("Downloading attachment from:", sMediaLink);

          const res = await fetch(sMediaLink, {
            method: "GET",
            credentials: "same-origin",
          });

          if (!res.ok) {
            // If /$value fails with 502 or 404, try /content as fallback
            if (
              (res.status === 502 || res.status === 404) &&
              sMediaLink.includes("$value")
            ) {
              console.log("$value endpoint failed, trying /content endpoint");
              const sFallbackLink = sMediaLink.replace("/$value", "/content");
              const resFallback = await fetch(sFallbackLink, {
                method: "GET",
                credentials: "same-origin",
              });

              if (!resFallback.ok) {
                const text = await resFallback.text();
                throw new Error(
                  `Download failed (${resFallback.status}): ${text}`
                );
              }

              // Use fallback response
              const blob = await resFallback.blob();
              const fileName =
                oAttachment.filename || oAttachment.name || this.defaultFileName;
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
              sap.m.MessageToast.show("Download started");
              return;
            }

            const text = await res.text();
            throw new Error(`Download failed (${res.status}): ${text}`);
          }

          // Get the blob from response
          const blob = await res.blob();
          const fileName =
            oAttachment.filename || oAttachment.name || this.defaultFileName;

          // Create download link and trigger download
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          sap.m.MessageToast.show("Download started");
        } catch (err) {
          console.error("Attachment download error:", err);
          sap.m.MessageBox.error(
            err.message || "Failed to download attachment."
          );
        }
      },

      onDeleteAttachment: function (oEvent) {
        const oSource = oEvent.getSource();
        const oContext = oSource.getBindingContext("terminationModel");
        const oAttachment = oContext.getObject();
        const oTerminationModel = this.getView().getModel("terminationModel");

        if (!oAttachment) {
          sap.m.MessageToast.show("Attachment not available.");
          return;
        }

        // Check if it's a pending attachment (has isPending flag or tempId)
        if (oAttachment.isPending || (oAttachment.tempId && oAttachment.tempId.startsWith(this.tempIdPrefix))) {
          // Remove from pending attachments
          const aPendingAttachments = oTerminationModel.getProperty("/pendingAttachments") || [];
          const aFilteredPending = aPendingAttachments.filter((oPending) => {
            return oPending.tempId !== oAttachment.tempId && oPending.ID !== oAttachment.ID;
          });
          oTerminationModel.setProperty("/pendingAttachments", aFilteredPending);
        } else {
          // It's an existing attachment - mark for deletion
          const aDeletedIds = oTerminationModel.getProperty("/deletedAttachmentIds") || [];
          
          // Add ID to deleted list (handle compound keys)
          if (oAttachment.up__ID && oAttachment.ID) {
            const sCompoundKey = `${oAttachment.up__ID}_${oAttachment.ID}`;
            if (!aDeletedIds.includes(sCompoundKey)) {
              aDeletedIds.push(sCompoundKey);
            }
            // Also add individual IDs for simpler matching
            if (!aDeletedIds.includes(oAttachment.ID)) {
              aDeletedIds.push(oAttachment.ID);
            }
          } else if (oAttachment.ID && !aDeletedIds.includes(oAttachment.ID)) {
            aDeletedIds.push(oAttachment.ID);
          }
          
          oTerminationModel.setProperty("/deletedAttachmentIds", aDeletedIds);
        }

        // Update merged list to reflect changes
        this._getMergedAttachmentsList();
        
        sap.m.MessageToast.show("Attachment removed");
      },

      /**
       * Deletes attachment from database (for batch operations, doesn't refresh UI)
       * @param {object} oAttachment - Attachment object to delete
       * @returns {Promise} Promise that resolves on success, rejects on error
       */
      _deleteAttachmentFromDB: async function (oAttachment) {
        if (!oAttachment || !oAttachment.ID) {
          return Promise.reject(new Error("Attachment not available."));
        }

        const sAttachmentKey = this._formatAttachmentKey(oAttachment);

        const sDeleteUrl = sap.ui.require.toUrl("cloudrunway") + `/terminationbackend/odata/v4/termination/TerminationRequestAttachments(${sAttachmentKey})`;

        const res = await fetch(sDeleteUrl, {
          method: "DELETE",
          credentials: "same-origin",
        });

        // 204 No Content is a valid success response for DELETE
        if (res.status === this.httpStatusSuccess || res.status === this.httpStatusOk || res.ok) {
          console.log("Attachment deleted from DB (status:", res.status + ")");
          return Promise.resolve();
        } else {
          const errText = await res.text();
          return Promise.reject(new Error(`Delete failed (${res.status}): ${errText}`));
        }
      },

      _clearMessages: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        oTerminationModel.setProperty("/taUpdateMessages", []);
      },
      
      // ===== ValueHelpInput Event Handlers =====
      onRequesterSelected: function (oEvent) {
        const oSelectedItem = oEvent.getParameter("selectedItem");
        const oControl = oEvent.getSource();
        const oView = this.getView();
        const oTerminationModel = oView.getModel("terminationModel");

        // Check if we're in create dialog or edit mode
        if (oTerminationModel.getProperty("/createOpen")) {
          const oCreateModel = this._pDialog.getModel("createModel");
          oCreateModel.setProperty("/requestor", oSelectedItem);
        } else {
          // Edit mode - store object for later ID extraction
          const oActiveTermination = oTerminationModel.getProperty("/activeTermination");
          oActiveTermination.requesterObject = oSelectedItem;
          oTerminationModel.setProperty("/activeTermination", oActiveTermination);
        }
      },
      onRequesterChange: function (oEvent) {
        // Handle change event if needed
      },
      onResponsibleSelected: function (oEvent) {
        const oSelectedItem = oEvent.getParameter("selectedItem");
        const oControl = oEvent.getSource();
        const oView = this.getView();
        const oTerminationModel = oView.getModel("terminationModel");

        // Check if we're in create dialog or edit mode
        if (oTerminationModel.getProperty("/createOpen")) {
          const oCreateModel = this._pDialog.getModel("createModel");
          oCreateModel.setProperty("/responsible", oSelectedItem);
        } else {
          // Edit mode - store object for later ID extraction
          const oActiveTermination = oTerminationModel.getProperty("/activeTermination");
          oActiveTermination.responsibleObject = oSelectedItem;
          oTerminationModel.setProperty("/activeTermination", oActiveTermination);
        }
      },
      onResponsibleChange: function (oEvent) {
        // Handle change event if needed
      },
    });
  }
);
