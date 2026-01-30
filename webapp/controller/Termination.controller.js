sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "cloudrunway/model/Formatter",
    "cloudrunway/controller/CreateDialog",
    "cloudrunway/model/Common"
  ],
  function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Fragment,
    formatter,
    CreateDialog,
    Common
  ) {
    "use strict";
    /**
     * Main  Termination controller for Termination Web UI
     * @description
     * PoC -> This controller handles all functionality related to cloud runway termination processing,
     * including form binding, submission, validation, and attachment uploads.
     * @authors Showkath Naseem [I311690],
     * @version 1.0
     * @since 2025-10-21
     */
    return Controller.extend("cloudrunway.controller.Termination", {
      formatter: formatter,
      CreateDialog: CreateDialog,
      onInit: function () {
        this._initialisation();
        this._readUrlParameters();
        this._loadDropdownValuesFromJson();
      },

      onAfterRendering: function () {
        this._readOppData();
        this._readTerminations();
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
          ScenarioTypeList: [],
          TerminationOriginList: [],
          TerminationStatusList: [],
          TerminationRetractionReasons: [],
          TerminationsList: [],
          activeTermination: {},
          activeTerminationEditMode: false,
          taMessages: [],
          taUpdateMessages: [],
          createOpen: false,
        });
        oView.setModel(oTerminationModel, "terminationModel");
        oView.setModel(new JSONModel({}), "documents");
        
        // const oMessageManager = sap.ui.getCore().getMessageManager();
        // const oODataModelV4 = oView.getModel("terminationModelV4");
        // if (oODataModelV4) {
        //   oMessageManager.registerObject(oODataModelV4, true);
        // }
        // oMessageManager.getMessageModel().attachMessageChange(Common._onMessageChange, this);
      },

      _readUrlParameters: function () {
        //TODO I311690
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
        const oLocalModel = new JSONModel();
        oLocalModel.loadData("model/terminationMasterData.json");

        // Use arrow function to preserve context
        oLocalModel.attachRequestCompleted(() => {
          const oData = oLocalModel.getData();

          if (!oTerminationModel) {
            console.error("terminationModel is not available!");
            return;
          }
          oTerminationModel.setProperty(
            "/ScenarioTypeList",
            oData.ScenarioTypeList || []
          );
          oTerminationModel.setProperty(
            "/TerminationRetractionReasons",
            oData.TerminationRetractionReasons || []
          );
          oTerminationModel.setProperty(
            "/TerminationOriginList",
            oData.TerminationOriginList || []
          );
          oTerminationModel.setProperty(
            "/TerminationStatusList",
            oData.TerminationStatusList || []
          );
        });

        oLocalModel.attachRequestFailed(() => {
          MessageToast.show("Failed to load terminationMasterData.json");
        });
      },
      _fnErrorHandler: function (oEvent) {
          const oTerminationModel = this.getView().getModel("terminationModel");
          const oError = oEvent.getParameter("error");
          let sErrorMessage = "Error submitting termination.";
          if (oError) {
            if (oError.message) {
              sErrorMessage = oError.message;
            } else if (oError.error && oError.error.message) {
              sErrorMessage = oError.error.message;
              if (oError.error.code) {
                sErrorMessage = `Error ${oError.error.code}: ${sErrorMessage}`;
              }
            }
          }
      },
      _readOppData: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const sOppId = oTerminationModel.getProperty("/OpportunityID");
        const sExtension = sap.ui.require.toUrl("cloudrunway") + `/sapsalesservicecloudv2/opportunity-service/opportunities?$top=10&$filter=displayId eq '${sOppId}'`;
        $.ajax({
          url: sExtension,
          method: "GET",
          contentType: "application/json",
          success: function (oResult) {
            if (oResult?.value?.length) {

            } else {
              oTerminationModel.setProperty("/taMessages", [{ message: Common.getLocalTextByi18nValue("OPPNOTFOUND"), type: "Error" }]);
            }
          },
          error: function () {
            oTerminationModel.setProperty("/taMessages", [{ message: Common.getLocalTextByi18nValue("OPPERROR"), type: "Error" }]);
          }
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
            function (aContexts) {
              const aResults = aContexts.map((oCtx) => oCtx.getObject());
              if (aResults?.length) {
                const sortedResults = aResults.sort((a, b) => {
                  return new Date(b.modifiedAt) - new Date(a.modifiedAt);
                });
                oTerminationModel.setProperty("/TerminationsList", sortedResults);
                oTerminationModel.setProperty("/activeTermination", {...aResults[0]});
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
      onTerminationSelect: function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const selectedItem = oEvent
          .getSource()
          .getBindingContext("terminationModel")
          .getObject();
        oTerminationModel.setProperty("/activeTermination", {...selectedItem});
        this._readAttachments(selectedItem);
        oTerminationModel.setProperty("/activeTerminationEditMode", false);
      },
      onTerminationEdit: function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        oTerminationModel.setProperty("/activeTerminationEditMode", true);
      },
      onTerminationEditCancel: function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        const oODataModel = this.getView().getModel("terminationModelV4");
        oTerminationModel.setProperty("/activeTerminationEditMode", false);
        oODataModel.resetChanges("TerminationUpdateGroup");
      },
      onTerminationUpdate: function (oEvent) {
        const oTerminationModel = this.getView().getModel("terminationModel");
        this._clearMessages();
        const updatedData = oTerminationModel.getProperty("/activeTermination");
        const oODataModel = this.getView().getModel("terminationModelV4");

        const isMandatoryFieldsEmpty = !updatedData.status ||
                                        !updatedData.terminationOrigin ||
                                        !updatedData.terminationRequester ||
                                        !updatedData.terminationResponsible ||
                                        !updatedData.terminationReceiptDate ||
                                        !updatedData.terminationEffectiveDate;

        const isRetractedFieldsEmpty = updatedData.status === "Retracted" &&
                                       (!updatedData.retractionReason ||
                                        !updatedData.retractionReceivedDate);

        if (isMandatoryFieldsEmpty || isRetractedFieldsEmpty) {
          oTerminationModel.setProperty("/taUpdateMessages", [{ message: "Please enter all mandatory fields", type: "Error" }]);
          return;
        }
        const oContextBinding = oODataModel.bindContext(
          `/TerminationRequests(ID='${updatedData.ID}')`,
          undefined,
          { $$updateGroupId: "TerminationUpdateGroup" }
        );
        const oCtx = oContextBinding.getBoundContext();
        oCtx.setProperty("status", updatedData.status);
        oCtx.setProperty("terminationOrigin", updatedData.terminationOrigin);
        oCtx.setProperty(
          "terminationRequester",
          updatedData.terminationRequester
        );
        oCtx.setProperty(
          "terminationResponsible",
          updatedData.terminationResponsible
        );
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
        oODataModel
          .submitBatch("TerminationUpdateGroup")
          .then((oResult) => {
            if (oResult)
              sap.m.MessageToast.show("Termination updated successfully.");
            this._readTerminations();
          })
          .catch((oError) => {
            sap.m.MessageBox.error(oError.message || "Update failed");
          });
        oTerminationModel.setProperty("/activeTerminationEditMode", false);
      },
      _uploadAllAttachments: async function (sTerminationId) {
        const oDocsModel = this.getView().getModel("documents");
        const aFiles = oDocsModel.getProperty("/pendingFiles") || [];

        if (!aFiles.length) {
          return; // No attachments → done
        }

        // aFiles contains File objects (see onBeforeAddAttachment)
        for (const fileObj of aFiles) {
          await this._uploadAttachment(fileObj, sTerminationId);
        }

        // Clear pending list only after successful uploads
        oDocsModel.setProperty("/pendingFiles", []);
      },
      _uploadAttachment: function (oFile, sTerminationId) {
        const that = this;
        const oTerminationModel = this.getView().getModel("terminationModel");
        const activeTermination = oTerminationModel.getProperty("/activeTermination");

        console.log("oFile =", oFile);
        console.log("instanceof File:", oFile instanceof File);
        console.log("size =", oFile.size);

        const oODataModel = this.getView().getModel("terminationModelV4");
        if (!oODataModel) {
          return Promise.reject(new Error("OData V4 model not found."));
        }

        const oMetadata = {
          filename: oFile.name,
          mimeType: oFile.type || "application/octet-stream",
          note: "Uploaded via UI",
        };

        // Format termination key
        const sTerminationKey = this._formatKey(sTerminationId);

        // Use OData v4 model's create method (automatically handles CSRF)
        const oListBinding = oODataModel.bindList(
          `/TerminationRequests(ID=${sTerminationKey})/attachments`
        );
        const oContext = oListBinding.create(oMetadata);

        return oContext
          .created()
          .then(async (oCreatedData) => {
            const oAttachment = oContext.getObject();
            console.log("Attachment metadata created:", oAttachment);

            // Format attachment key
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

            // Get the model's service URL and construct full URL
            const sServiceUrl = oODataModel.getServiceUrl();
            const sFullUrl = sServiceUrl.replace(/\/$/, "") + sPath;

            // Convert File to ArrayBuffer
            const fileBuffer = await oFile.arrayBuffer();

            console.log("Uploading file:", {
              fullUrl: sFullUrl,
              size: fileBuffer.byteLength,
              fileName: oFile.name,
            });

            // Use fetch with the model's service URL
            // The model's create() call should have established the session
            // and cached the CSRF token, so credentials: "include" should work
            return fetch(sFullUrl, {
              method: "PUT",
              headers: {
                "Content-Type": "application/octet-stream",
              },
              credentials: "include", // This should use the session from the model's create() call
              body: fileBuffer,
            });
          })
          .then(async (res) => {
            // 204 is success
            if (res.status === 204 || res.status === 200 || res.ok) {
              console.log("Upload response status:", res.status);
              console.log("File uploaded successfully");
              that._readAttachments(activeTermination);
              return res;
            } else {
              const errText = await res.text();
              throw new Error(`Upload failed (${res.status}): ${errText}`);
            }
          })
          .catch((err) => {
            console.error("Upload failed:", err);
            throw err;
          });
      },
      onItemRemoved: async function (oEvent) {
        const sId = oEvent
          .getParameter("item")
          .getBindingContext("documents")
          .getProperty("ID");

        await fetch(
          `/terminationbackend/odata/v4/termination/TerminationRequestAttachments(${sId})`,
          {
            method: "DELETE",
            credentials: "same-origin",
          }
        );

        sap.m.MessageToast.show("Attachment deleted");
      },
      // Helper: quote OData key when needed (strings/GUIDs)
      _formatKey: function (sKey) {
        if (sKey === null || sKey === undefined) return sKey;
        // If numeric, return as-is; otherwise return quoted and escape single quotes
        if (/^[0-9]+$/.test(String(sKey))) {
          return sKey;
        }
        return "'" + String(sKey).replace(/'/g, "''") + "'";
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
        oFileInput.accept =
          ".pdf";

        oFileInput.onchange = (event) => {
          const oFile = event.target.files[0];
          if (!oFile) return;

          this._uploadAttachment(oFile, oCurrentTermination.ID);
        };

        oFileInput.click();
      },

      _uploadAttachmentMain: function (oFile, sTerminationId) {
        // Step 1: Create attachment metadata
        const oAttachmentMetadata = {
          filename: oFile.name,
          mimeType: oFile.type || "application/octet-stream",
          note: "Uploaded via UI",
        };

        fetch(
          `/odata/v4/termination/TerminationRequests('${sTerminationId}')/attachments`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(oAttachmentMetadata),
          }
        )
          .then((response) => {
            if (!response.ok) {
              return response.json().then((error) => {
                throw new Error(JSON.stringify(error));
              });
            }
            return response.json();
          })
          .then((oAttachment) => {
            console.log("Attachment metadata created:", oAttachment);

            // Step 2: Upload file content
            return this._uploadAttachmentContent(
              sTerminationId,
              oAttachment.ID,
              oFile
            );
          })
          .then(() => {
            MessageToast.show("Attachment uploaded successfully!");
            // Reload attachments
            this._loadAttachments(sTerminationId);
          })
          .catch((oError) => {
            console.error("Error uploading attachment:", oError);
            MessageBox.error(
              "Failed to upload attachment:\n\n" + oError.message
            );
          });
      },

      _uploadAttachmentContent: function (
        sTerminationId,
        sAttachmentId,
        oFile
      ) {
        return new Promise((resolve, reject) => {
          const oReader = new FileReader();

          oReader.onload = () => {
            const aBuffer = new Uint8Array(oReader.result);

            fetch(
              `/odata/v4/termination/TerminationRequests('${sTerminationId}')/attachments(ID='${sAttachmentId}')/content`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": oFile.type || "application/octet-stream",
                },
                body: aBuffer,
              }
            )
              .then((response) => {
                if (!response.ok) {
                  return response.text().then((text) => {
                    throw new Error(text || "Upload failed");
                  });
                }
                resolve();
              })
              .then(async (oAttachment) => {
                console.log("Attachment metadata created:", oAttachment);

                // 2) Upload file binary to $value
                const sUploadUrl = `/odata/v4/termination/TerminationRequestAttachments(${oAttachment.ID})/$value`;

                return fetch(sUploadUrl, {
                  method: "PUT",
                  headers: {
                    "Content-Type": oFile.type || "application/octet-stream",
                  },
                  body: oFile,
                });
              })
              .then((res) => {
                if (!res.ok) {
                  throw new Error("Failed to upload binary.");
                }
                console.log("File uploaded successfully");
              })
              .catch(reject);
          };

          oReader.onerror = () => {
            reject(new Error("Failed to read file"));
          };

          oReader.readAsArrayBuffer(oFile);
        });
      },

      onDownload: function (oEvent) {
        const oSource = oEvent.getSource();
        const oContext = oSource.getBindingContext("terminationModel");
        const oAttachment = oContext.getObject();

        this._downloadAttachment(oAttachment);
      },
      
      // Download binary for an attachment and trigger browser download
      _downloadAttachment: async function (oAttachment) {
        if (!oAttachment || !oAttachment.ID) {
          sap.m.MessageToast.show("Attachment not available.");
          return;
        }

        // Prefer server-provided media link if present
        let sMediaLink =
          oAttachment["@odata.mediaReadLink"] ||
          oAttachment["@odata.mediaEditLink"];

        // Build URL manually if server didn't provide a link
        if (!sMediaLink) {
          // Format attachment key - check if compound key (up__ID) or simple key (ID)
          let sAttachmentKey;
          if (oAttachment.up__ID && oAttachment.ID) {
            // Compound key
            const sUpId = this._formatKey(oAttachment.up__ID);
            const sId = this._formatKey(oAttachment.ID);
            sAttachmentKey = `ID=${sId}`;
          } else {
            // Simple key
            sAttachmentKey = `ID=${this._formatKey(oAttachment.ID)}`;
          }

          // Use /$value for downloads (standard OData v4 endpoint for reading media)
          // sMediaLink = `/terminationbackend/odata/v4/termination/TerminationRequestAttachments(${sAttachmentKey})/$value`;
          sMediaLink = `/terminationbackend/odata/v4/termination/TerminationRequests(${oAttachment.up__ID})/attachments(${sAttachmentKey})/content`;
        } else {
          // If server returned a relative media link, make sure it's using the same backend prefix
          if (!sMediaLink.startsWith("http") && !sMediaLink.startsWith("/")) {
            sMediaLink = `/terminationbackend/odata/v4/termination/${sMediaLink}`;
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
                oAttachment.filename || oAttachment.name || "attachment";
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
            oAttachment.filename || oAttachment.name || "attachment";

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

        if (!oAttachment || !oAttachment.ID) {
          sap.m.MessageBox.error("Attachment not available.");
          return;
        }

        sap.m.MessageBox.confirm(
          "Are you sure you want to delete this attachment?",
          {
            icon: sap.m.MessageBox.Icon.WARNING,
            title: "Confirm Delete",
            actions: [
              sap.m.MessageBox.Action.OK,
              sap.m.MessageBox.Action.CANCEL,
            ],
            onClose: (sAction) => {
              if (sAction === sap.m.MessageBox.Action.OK) {
                this._deleteAttachment(oAttachment);
              }
            },
          }
        );
      },

      _deleteAttachment: async function (oAttachment) {
        if (!oAttachment || !oAttachment.ID) {
          sap.m.MessageToast.show("Attachment not available.");
          return;
        }

        // Format attachment key - check if compound key (up__ID) or simple key (ID)
        let sAttachmentKey;
        if (oAttachment.up__ID && oAttachment.ID) {
          // Compound key
          const sUpId = this._formatKey(oAttachment.up__ID);
          const sId = this._formatKey(oAttachment.ID);
          sAttachmentKey = `up__ID=${sUpId},ID=${sId}`;
        } else {
          // Simple key
          sAttachmentKey = `ID=${this._formatKey(oAttachment.ID)}`;
        }

        const sDeleteUrl = `/terminationbackend/odata/v4/termination/TerminationRequestAttachments(${sAttachmentKey})`;

        try {
          console.log("Deleting attachment:", sDeleteUrl);

          const res = await fetch(sDeleteUrl, {
            method: "DELETE",
            credentials: "same-origin",
          });

          // 204 No Content is a valid success response for DELETE
          if (res.status === 204 || res.status === 200 || res.ok) {
            console.log(
              "Attachment deleted successfully (status:",
              res.status + ")"
            );
            sap.m.MessageToast.show("Attachment deleted successfully");

            // Refresh attachments list
            const oTerminationModel =
              this.getView().getModel("terminationModel");
            const oActiveTermination =
              oTerminationModel.getProperty("/activeTermination");
            if (oActiveTermination) {
              this._readAttachments(oActiveTermination);
            }
          } else {
            const errText = await res.text();
            throw new Error(`Delete failed (${res.status}): ${errText}`);
          }
        } catch (err) {
          console.error("Error deleting attachment:", err);
          sap.m.MessageBox.error(err.message || "Failed to delete attachment.");
        }
      },

      _clearMessages: function () {
        const oTerminationModel = this.getView().getModel("terminationModel");
        oTerminationModel.setProperty("/taUpdateMessages", []);
      }
    });
  }
);
