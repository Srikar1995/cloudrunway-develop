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
              businessScenario: "",
              terminationOrigin: "",
              riskReason: "",
              requestor: {},
              responsible: {},
              receiptDate: "",
              effectData: "",
              AttachmentsList: [],
              taCreateMessages: [],
              loading: false
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

        if (!sTerminationOrigin || !sTerminationRequester || !sTerminationResponsible || !sTerminationReceiptDate || !sTerminationEffectiveDate) {
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
          businessScenario: sBusinessScenario,
          terminationType: "Standard",
          renewalType: "Auto",
          status: "InProcess",
          contractEndDate: Formatter.formatDate(oTerminationModel.getProperty("/contractEndDate")),//"2025-12-31"
          terminationEffectiveDate: sTerminationEffectiveDate,
          terminationReceiptDate: sTerminationReceiptDate,
          terminationRequester: sTerminationRequester?.id,
          terminationResponsible: sTerminationResponsible?.id,
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
    };
  }
);
