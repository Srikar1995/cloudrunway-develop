# Termination App

## Description

---

## JIRA
- [ARTPUBCL-1661](https://jira.tools.sap/browse/ARTPUBCL-1661)
- [ITSOMEGA-2157](https://jira.tools.sap/browse/ITSOMEGA-2157)
- [Figma-UX](https://www.figma.com/proto/SJml2AKpTQzWSEY8ZvU91g/Petr-Workspace?node-id=4002-6731&t=pRhIfuXKC%E2%80%A6)
-  [UI mockup discussion](https://sap-my.sharepoint.com/personal/petr_fordey_sap_com/_layouts/15/stream.aspx?id=%2Fpersonal%2Fpetr_fordey_sap_com%2FDocuments%2FRecordings%2FARTPUBCL-1661+UX+mockup+review-20250929_133145-Meeting+Recording.mp4&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D&startedResponseCatch=true&referrer=StreamWebApp.Web&referrerScenario=AddressBarCopied.view.6fd52dd4-05f6-4319-85e5-a2375b9baf69)

## Repository
- [Termination Web GitHub Repo](https://github.tools.sap/ies-sales-cpq/terminationweb.git)

## Termination Tool URLs
- **Dev**  [Dev](https://sapit-sales-dev-camel.launchpad.cfapps.eu10.hana.ondemand.com/a49d541b-f71a-48fd-8442-403853f5a631.cloudrunway.cloudrunway-1.0.0/index.html)
- **QA**  
- **Prod**  

## Developer Instructions

### Prerequisites
- SAP Business Application Studio / VS Code with CAP extensions  
  BAS URL: [SAP BAS](https://sapit-sales-dev-camel.eu10cf.applicationstudio.cloud.sap/index.html?externalRedirect=true)  
- Node.js >= 20 (LTS recommended)  
- npm  

### Clone the Repository
```bash
git clone https://github.tools.sap/ies-sales-cpq/terminationweb.git
```

### Running the Termination Application Locally

1. **Install dependencies**  
   ```bash
   npm install
   ```

2. **Start the Termination application in watch mode**  
   - For local Termination Web environment:  
     ```bash
     npm run start-local
     ```

App will be available at [https://port8080-workspaces-ws-l79sm.eu10.applicationstudio.cloud.sap/index.html](https://port8080-workspaces-ws-l79sm.eu10.applicationstudio.cloud.sap/index.html) by default.
