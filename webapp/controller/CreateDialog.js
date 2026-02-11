sap.ui.define(
  ["sap/ui/model/json/JSONModel",
    "cloudrunway/model/Common",
    "cloudrunway/model/Formatter"],
  function (JSONModel, Common, Formatter) {
    "use strict";
    return {
      openCreateTermination: function () {
        const oView = this.getView();
        const oTerminationModel = oView.getModel("terminationModel");
        oTerminationModel.setProperty("/taMessages",[]);
        const oPrevalidationData = oTerminationModel.getProperty("/preValidationData");
        if (!oPrevalidationData.canCreateTermination) {
          const sMessage = oPrevalidationData?.validationResults.find((validation)=>!validation.passed).message;
          oTerminationModel.setProperty("/taMessages", [
              {
                message: sMessage,
                type: "Error",
              },
            ])
        } else {
          if (!this._pDialog) {
            const oCreateModel = new JSONModel({
              businessScenario: oTerminationModel.getProperty("/oppBusinessScenario"),
              terminationOrigin: "",
              riskReason: oTerminationModel.getProperty("/oppRenewalRiskReason"),
              requestor: {},
              responsible: {},
              receiptDate: "",
              effectData: "",
              AttachmentsList: [],
              taCreateMessages: [],
              loading: false,
              fieldErrors: {}
            });
            this._pDialog = sap.ui.xmlfragment(
              "cloudrunway.view.fragments.CreateDialog",
              this
            );
            this._pDialog.setModel(oCreateModel, "createModel");
            oView.addDependent(this._pDialog);
          }
          this._pDialog.open();
          oTerminationModel.setProperty("/createOpen", true);
        }
      },
      onAddAttachment: function () {
        const oView = this.getView();
        const oCreateModel = this._pDialog.getModel("createModel");
        // Create a hidden file input
        const oFileInput = document.createElement("input");
        oFileInput.type = "file";
        oFileInput.accept = ".pdf";
        oFileInput.multiple = true;
        oFileInput.onchange = (event) => {
          const oFile = event.target.files;
          if (!oFile?.length) return;
          const oExistingFiles =
            oCreateModel.getProperty("/AttachmentsList") ?? [];
          oCreateModel.setProperty("/AttachmentsList", [
            ...oExistingFiles,
            ...oFile,
          ]);
        };
        oFileInput.click();
      },
      onDeleteAttachment: function (oEvent) {
        const oCreateModel = this._pDialog.getModel("createModel");
        const oExistingFiles = oCreateModel.getProperty("/AttachmentsList");
        const oSelectedPath = oEvent
          .getSource()
          .getBindingContext("createModel")
          .getPath();
        const selectedIndex = parseInt(oSelectedPath.split("/").pop(), 10);
        oExistingFiles.splice(selectedIndex, 1);
        oCreateModel.setProperty("/AttachmentsList", oExistingFiles);
      },
      onSubmitTermination: function () {
        const oView = this.getView();
        const oTerminationModel = oView.getModel("terminationModel");
        const oCreateModel = this._pDialog.getModel("createModel");
        let nonPdfExists = false;
        this.CreateDialog._clearMessages.call(this);
        const aFiles = oCreateModel.getProperty("/AttachmentsList")
        const sBusinessScenario = oCreateModel.getProperty("/businessScenario");
        const sBusinessScenarioPkey = Formatter.getBackendKey(oTerminationModel.getProperty("/BusinessScenarioList"), sBusinessScenario);
        const sOrigin = oTerminationModel.getProperty("/oppOrigin");
        const sRenewalType = sOrigin === "ZC3" ? "Auto" : "Active";
        const sTerminationOrigin =
          oCreateModel.getProperty("/terminationOrigin");
        const sRenewalRiskReason = oCreateModel.getProperty("/riskReason");
        const sTerminationRequester = oCreateModel.getProperty("/requestor");
        const sTerminationResponsible =
          oCreateModel.getProperty("/responsible");
        const sTerminationReceiptDate =
          oCreateModel.getProperty("/receiptDate");
        const sTerminationEffectiveDate =
          oCreateModel.getProperty("/effectData");
        const sCED = oTerminationModel.getProperty("/contractEndDate");

        // Validate mandatory fields and set field-level errors
        // Convert model properties to data object for validation
        const oData = {
          terminationOrigin: oCreateModel.getProperty("/terminationOrigin"),
          requestor: oCreateModel.getProperty("/requestor"),
          responsible: oCreateModel.getProperty("/responsible"),
          receiptDate: oCreateModel.getProperty("/receiptDate"),
          effectData: oCreateModel.getProperty("/effectData")
        };
        const oFieldErrors = Common.validateMandatoryFields(oData);
        
        // Validate TRD not in future
        if (sTerminationReceiptDate) {
          const oTRDValidation = Common.validateTRDNotFuture(sTerminationReceiptDate);
          if (!oTRDValidation.isValid) {
            oFieldErrors.terminationReceiptDate = {
              valueState: "Error",
              valueStateText: oTRDValidation.errorMessage
            };
          }
        }
        
        // Validate EU Data Act 60-day notice if applicable
        if (sBusinessScenario === Common.businessScenarioEUDataAct && sTerminationReceiptDate && sTerminationEffectiveDate) {
          const oEUDAValidation = Common.validateEUDA60DayNotice(sTerminationReceiptDate, sTerminationEffectiveDate);
          if (!oEUDAValidation.isValid) {
            oFieldErrors.terminationEffectiveDate = {
              valueState: "Error",
              valueStateText: oEUDAValidation.errorMessage
            };
          }
        }
        
        // Validate TED range (>= TRD + 60 days and <= CED)
        if (sTerminationReceiptDate && sTerminationEffectiveDate && sCED) {
          const oTEDRangeValidation = Common.validateTEDRange(sTerminationEffectiveDate, sTerminationReceiptDate, sCED);
          if (!oTEDRangeValidation.isValid) {
            oFieldErrors.terminationEffectiveDate = {
              valueState: "Error",
              valueStateText: oTEDRangeValidation.errorMessage
            };
          }
        }
        
        // Set field errors in model
        oCreateModel.setProperty("/fieldErrors", oFieldErrors);
        
        // Check if there are any field errors
        const bHasFieldErrors = Object.keys(oFieldErrors).length > 0;
        if (bHasFieldErrors) {
          // Keep existing message strip for backward compatibility
          oCreateModel.setProperty("/taCreateMessages", [{ message: Common.getLocalTextByi18nValue("MANDATORYERROR"), type: "Error" }]);
          return;
        }

        if (!aFiles?.length) {
          oCreateModel.setProperty("/taCreateMessages", [{ message: Common.getLocalTextByi18nValue("ATTACHMENTERROR"), type: "Error" }]);
          return;
        }

        nonPdfExists = aFiles.some(element => element.type !== "application/pdf");
        if (nonPdfExists) {
          oCreateModel.setProperty("/taCreateMessages", [{ message: Common.getLocalTextByi18nValue("ATTACHMENTTYPEERROR"), type: "Error" }]);
          return;
        }

        const oPayload = {
          displayId: "UI5-" + Date.now(),
          source: "BTP-Termination-App",
          terminationOrigin: sTerminationOrigin,
          businessScenario: sBusinessScenarioPkey,
          // terminationType: "Standard",
          renewalType: sRenewalType,
          status: "InProcess",
          contractEndDate: Formatter.formatDate(oTerminationModel.getProperty("/contractEndDate"), "yyyy-MM-dd"),//"2025-12-31"
          terminationEffectiveDate: sTerminationEffectiveDate,
          terminationReceiptDate: sTerminationReceiptDate,
          terminationRequester: sTerminationRequester?.defaultExternalContactId,
          terminationResponsible: sTerminationResponsible?.employeeDisplayId,
          renewalRiskReason: sRenewalRiskReason || null,
          opportunityId: oTerminationModel.getProperty("/OpportunityID"),
          subscriptionContractId: oTerminationModel.getProperty("/subscriptionContractId")
        };

        this.CreateDialog._submitTerminationToBackend.call(this, oPayload);
      },
      _submitTerminationToBackend: function (oPayload) {
        const that = this;
        const oODataModel = that.getView().getModel("terminationModelV4");
        const oCreateModel = this._pDialog.getModel("createModel");
        if (!oODataModel) {
          sap.m.MessageBox.error("OData V4 model not found.");
          return;
        }

        oCreateModel.setProperty("/loading", false);
        const oListBinding = oODataModel.bindList("/TerminationRequests",
          null,
          null,
          null,
          {
            $$groupId: "$direct"
          });
        oListBinding.attachCreateCompleted((oEvent) => {
          if (!oEvent.getParameter("success")) {
            const oMessages = oODataModel.getMessagesByPath("");
            const oMessage = oMessages[oMessages?.length - 1];
            if (oMessage) {
              oCreateModel.setProperty("/taCreateMessages", [{ message: oMessage.message, type: oMessage.type }]);
            }
          }
          oCreateModel.setProperty("/loading", false);
        });
        const oContext = oListBinding.create(oPayload);

        oContext
          .created()
          .then(
            async function (oCreatedData, oResponse) {
              const oCreatedObject = oContext.getObject();
              const sNewTerminationId = oCreatedObject.ID;
              try {
                await that.CreateDialog._uploadAllAttachments.call(
                  that,
                  sNewTerminationId
                );
                // Clear field errors after successful creation
                const oCreateModel = that._pDialog.getModel("createModel");
                if (oCreateModel) {
                  oCreateModel.setProperty("/fieldErrors", {});
                }
                that.CreateDialog.onCloseTerminationDialog.call(that);
                that._readTerminations();
              } catch (err) {
                sap.m.MessageBox.error(
                  err.message || "Error uploading attachments."
                );
              }
            })
          .catch(function (oError) {
            sap.m.MessageBox.error(
              oError.message || "Error submitting termination."
            );
          });
      },
      _uploadAllAttachments: async function (sTerminationId) {
        const oCreateModel = this._pDialog.getModel("createModel");
        const aFiles = oCreateModel.getProperty("/AttachmentsList") || [];

        for (const fileObj of aFiles) {
          await this.CreateDialog._uploadAttachment.call(
            this,
            fileObj,
            sTerminationId
          );
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
          mimeType: oFile.type || "application/octet-stream",
          note: "Uploaded via UI",
          // content: oFile
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
            return that.CreateDialog._uploadAttachmentContent.call(that, oAttachment, oFile);
            // return Promise.resolve();
          })
          .catch((err) => {
            console.error("Upload failed:", err);
            throw err;
          });
      },
      _uploadAttachmentContent: async function (oAttachment, oFile) {
        const oODataModel = this.getView().getModel("terminationModelV4");
        let sAttachmentKey;
        if (oAttachment.up__ID && oAttachment.ID) {
          const sUpId = this._formatKey(oAttachment.up__ID);
          const sId = this._formatKey(oAttachment.ID);
          sAttachmentKey = `up__ID=${sUpId},ID=${sId}`;
        } else {
          sAttachmentKey = `ID=${this._formatKey(oAttachment.ID)}`;
        }

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
            "Content-Type": "application/octet-stream",
          },
          credentials: "include", // This should use the session from the model's create() call
          body: fileBuffer,
        });

        // 204 is success
        if (res.status === 204 || res.status === 200 || res.ok) {
          console.log("Upload response status:", res.status);
          console.log("File uploaded successfully");
          return res;
        } else {
          const errText = await res.text();
          throw new Error(`Upload failed (${res.status}): ${errText}`);
        }
      },
      onCloseTerminationDialog: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        this._pDialog.close();
        oTerminationModel.setProperty("/createOpen", false);
      },
      _clearMessages: function () {
        const oCreateModel = this._pDialog.getModel("createModel");
        const oODataModelV4 = this.getView().getModel("terminationModelV4");
        oCreateModel.setProperty("/taCreateMessages", []);
        oODataModelV4.setMessages([]);
      },
      
      
      /**
       * Handler for Termination Receipt Date (TRD) change event
       * Currently no action - validation happens only on save/create
       * @param {object} oEvent - Change event
       */
      onTRDChange: function (oEvent) {
        // Commented out: Validation on field change - errors should only show on save/create
        // const oCreateModel = this._pDialog.getModel("createModel");
        // const sTRD = oEvent.getParameter("value");
        // const oValidation = Common.validateTRDNotFuture(sTRD);
        // 
        // // Update field error state
        // if (!oValidation.isValid) {
        //   oCreateModel.setProperty("/fieldErrors/terminationReceiptDate", {
        //     valueState: "Error",
        //     valueStateText: oValidation.errorMessage
        //   });
        // } else {
        //   // Clear error if field is valid
        //   oCreateModel.setProperty("/fieldErrors/terminationReceiptDate", {
        //     valueState: "None",
        //     valueStateText: ""
        //   });
        // }
      },
      
      /**
       * Handler for Termination Effective Date (TED) change event
       * @param {object} oEvent - Change event
       */
      onTEDChange: function (oEvent) {
        const oCreateModel = this._pDialog.getModel("createModel");
        const oTerminationModel = this.getView().getModel("terminationModel");
        const sTED = oEvent.getParameter("value");
        const sTRD = oCreateModel.getProperty("/receiptDate");
        const sBusinessScenario = oCreateModel.getProperty("/businessScenario");
        const sCED = oTerminationModel.getProperty("/contractEndDate");
        
        // Validate EU Data Act 60-day notice if applicable
        if (sBusinessScenario === Common.businessScenarioEUDataAct && sTRD && sTED) {
          const oValidation = Common.validateEUDA60DayNotice(sTRD, sTED);
          if (!oValidation.isValid) {
            oCreateModel.setProperty("/fieldErrors/terminationEffectiveDate", {
              valueState: "Error",
              valueStateText: oValidation.errorMessage
            });
            return;
          }
        }
        
        // Validate TED range (>= TRD + 60 days and <= CED)
        if (sTRD && sTED && sCED) {
          const oRangeValidation = Common.validateTEDRange(sTED, sTRD, sCED);
          if (!oRangeValidation.isValid) {
            oCreateModel.setProperty("/fieldErrors/terminationEffectiveDate", {
              valueState: "Error",
              valueStateText: oRangeValidation.errorMessage
            });
            return;
          }
        }
        
        // Clear error if valid
        oCreateModel.setProperty("/fieldErrors/terminationEffectiveDate", {
          valueState: "None",
          valueStateText: ""
        });
      },
      
      /**
       * Handler for termination origin change event
       * Currently no action - errors are only shown on save/create
       * @param {object} oEvent - Change event
       */
      onTerminationOriginChange: function (oEvent) {
        // Commented out: Error clearing on field change - errors should only show on save/create
        // const oCreateModel = this._pDialog.getModel("createModel");
        // const sValue = oEvent.getParameter("selectedItem")?.getKey();
        // if (sValue) {
        //   oCreateModel.setProperty("/fieldErrors/terminationOrigin", {
        //     valueState: "None",
        //     valueStateText: ""
        //   });
        // }
      },
    };
  }
);
