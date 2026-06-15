# GoFileRoom Export Methods — Reference Report

**Platform**: Thomson Reuters GoFileRoom  
**Date**: June 2026  

---

## Overview

GoFileRoom provides several ways to get data out of the system, ranging from simple one-click UI exports to full programmatic API access. The right method depends on whether you need document files, metadata, workflow data, or a complete inventory.

---

## Method 1: Search Results Export (Metadata → CSV)

**What you get**: A CSV file of document index fields (metadata) for all documents returned by a search — client name, document type, date, and any other fields your firm has configured.

**How to do it**:
- **Classic Search**: Run a search → click **Options** → select **Export List**
- **Enhanced Search**: Run a search → click the **Export** button in the ribbon

**Best for**: Getting a structured list of what documents exist, filtered by client, date range, document type, etc.

**Limits**: No stated record limit. Output columns are determined by your firm's configured index fields.

**Format**: CSV (comma-delimited)

---

## Method 2: Bulk Document Download (Files → ZIP)

**What you get**: The actual document files (PDFs, Word docs, etc.) packaged into a ZIP archive.

**How to do it**:
1. Run a search to find the documents you want
2. Check the boxes next to multiple documents in the search results
3. Click **Export** — the system packages them into a ZIP for download

**Best for**: Downloading a batch of actual files for offline use, migration, or sharing.

**Limits**:
- **1 GB maximum per download batch** — split larger exports into multiple batches
- Requires the **"Allow Export of Multiple Documents"** permission — must be granted by a GoFileRoom administrator
- Exported files are copies; changes to exported copies are not synced back to GoFileRoom
- File names use the index values configured by your firm's administrator

**Format**: ZIP archive

---

## Method 3: FirmFlow Report Export (Workflow Data → CSV / PDF / Excel)

**What you get**: Structured workflow data — task status, assignments, due dates, completion rates, engagement progress, etc.

**How to do it**:
1. Run any FirmFlow report
2. Click **Options** → **Export Report** (for spreadsheet) or **Export Report to PDF**
3. Alternatively, open directly in Microsoft Excel

**Best for**: Exporting engagement workflow status, tracking deadlines, audit progress, or building dashboards from FirmFlow data.

**Limits**:
- **250,000 records maximum** per export
- For exports between 20,000–250,000 records, the system prompts for GoFileRoom index values and saves the file back into GoFileRoom first — then you download it from there

**Formats**: CSV, PDF, or direct Excel open

---

## Method 4: FirmFlow Deliverables List Export (→ CSV)

**What you get**: A CSV of the deliverables list for a FirmFlow workflow — all deliverable items, their status, and related fields.

**How to do it**: Navigate to a FirmFlow folder → export the deliverables list as CSV

**Best for**: Bulk management of workflow deliverables; the exported CSV can be edited and re-imported to update deliverables in bulk.

**Format**: CSV

---

## Method 5: Bulk FirmFlow Folder Import/Update (→ XLSX)

**What you get**: A two-way bulk operation for FirmFlow folder data using an Excel template.

**How to do it**:
1. Download the Thomson Reuters bulk import spreadsheet template
2. Populate it with folder/engagement data
3. Use the Bulk Import or Bulk Update feature in FirmFlow

**Best for**: Updating large numbers of FirmFlow folders at once; also useful as a data model reference for what fields GoFileRoom stores per folder.

**Note**: This is primarily an *import* feature, but the template structure reveals the full data schema for FirmFlow folders.

**Format**: XLSX (Excel)

---

## Method 6: Practice CS GoFileRoom Export Report (→ Excel)

**What you get**: A cross-reference report linking Practice CS project data to documents stored in GoFileRoom.

**How to do it**: From Practice CS for Projects → print the GoFileRoom Export Report → export to Excel

**Best for**: Firms using both Practice CS and GoFileRoom who want to correlate project/billing data with stored documents.

**Format**: Excel

---

## Method 7: Full Migration Manifest (All Docs → Spreadsheet)

**What you get**: A complete structured inventory of every document in GoFileRoom — file names, all index/metadata fields, and the GoFileRoom Document ID for every document.

**How to get it**:
- Contact **Thomson Reuters Technical Services** and request document migration services
- TR provides a review spreadsheet before migration and a final manifest spreadsheet after migration completes
- This is the most comprehensive metadata export available — effectively a full database dump of document metadata

**Best for**: Full data inventory, migrating away from GoFileRoom, compliance audits, or building a complete index of everything stored in the system.

**Format**: Spreadsheet (Excel)

**Note**: This is typically done in the context of a migration project (e.g., migrating from network storage, FileCabinet CS, or CCH into GoFileRoom, or vice versa). Contact TR to discuss whether a standalone manifest export is available.

---

## Method 8: REST API (Programmatic — Most Flexible)

**What you get**: Programmatic access to documents, metadata, users, and FirmFlow workflow data via standard HTTP calls.

**Scope**: 75+ endpoints covering:
- Document ingestion and retrieval
- Document search and indexing
- User and group management
- FirmFlow workflow assignments and status
- Organization reporting
- BI / data visualization tool connectivity

**Authentication**: API key (issued by Thomson Reuters) + OAuth2  
**Rate limit**: 10,000 requests per hour per firm  
**Base URLs**:
- Documents/storage: `https://m.services.gofileroom.com/`
- Client portal: `https://cc-services.gofileroom.com/`

**How to get access**:
1. Register at [developerportal.thomsonreuters.com](https://developerportal.thomsonreuters.com/)
2. Call **1-800-968-0600** (select GoFileRoom support) to request an API key
3. Review the full OpenAPI/Swagger spec: [developerportal.thomsonreuters.com/gofileroom-firmflow-api](https://developerportal.thomsonreuters.com/gofileroom-firmflow-api)

**Best for**: Large-scale or automated data extraction, building custom integrations, feeding data into AI tools or BI dashboards, recurring scheduled exports.

---

## Method 9: Microsoft Power Automate (No-Code API Access)

**What you get**: The same API capabilities as Method 8, but through a point-and-click no-code connector — no programming required.

**Connector**: Thomson Reuters GoFileRoom is an **official certified connector** on the Microsoft Power Platform.

**What you can automate**:
- Add and retrieve documents
- Search for documents by index fields
- Manage user accounts and groups
- Get, create, edit, and delete FirmFlow workflows
- Trigger exports based on events (new document, workflow completion, etc.)

**Also works with**: Microsoft Power Apps and Azure Logic Apps (same connector)

**Documentation**:
- [Microsoft Learn — GoFileRoom Connector](https://learn.microsoft.com/en-us/connectors/gofileroom/)
- [TR Help — Power Automate GoFileRoom Connector](https://www.thomsonreuters.com/en-us/help/gofileroom/api/microsoft-power-automate-gofileroom-connector)

**Best for**: Firms already on Microsoft 365 who want automated exports or integrations without writing code.

---

## Method 10: Zapier Integration

**What you get**: GoFileRoom connected to 2,000+ web apps via Zapier triggers and actions.

**Officially supported by Thomson Reuters.**  
Focuses primarily on user and group management automation rather than document-level operations.

**Documentation**: [cs.thomsonreuters.com — Integration with Zapier](https://cs.thomsonreuters.com/ua/gfr/cs_us_en/kb/integration-with-zapier.htm)

**Best for**: Simple workflow automation connecting GoFileRoom to other cloud tools (Slack notifications, spreadsheet logging, CRM updates, etc.).

---

## Summary Comparison

| Method | What You Export | Format | Limit | Requires |
|---|---|---|---|---|
| Search Results Export | Document metadata | CSV | None stated | UI access |
| Bulk Document Download | Actual files | ZIP | 1 GB/batch | Admin permission |
| FirmFlow Report Export | Workflow/engagement data | CSV, PDF, Excel | 250,000 records | Run-report access |
| Deliverables List Export | FirmFlow deliverables | CSV | — | FirmFlow access |
| Bulk Folder Update | FirmFlow folder data | XLSX | — | FirmFlow access |
| Practice CS Export Report | Project ↔ document crossref | Excel | — | Practice CS + GFR |
| Migration Manifest | All docs + all metadata | Spreadsheet | None | TR Technical Services |
| REST API | Everything | JSON / any | 10K req/hr | API key from TR |
| Power Automate | Docs, users, workflows | Any | API rate limits | Microsoft 365 + API key |
| Zapier | Users, groups | Varies | Zapier plan limits | Zapier account |

---

## Recommended Starting Points

**Quick one-time export**: Use **Search Results Export** (CSV) for metadata + **Bulk Document Download** (ZIP) for the actual files.

**Full data inventory**: Contact TR Technical Services for a **Migration Manifest** — the most complete option.

**Recurring/automated export**: Set up the **Power Automate connector** (fastest no-code path) or use the **REST API** directly for custom integrations.

**Feeding data into AI tools**: The **REST API** + a tool like [Composio](https://composio.dev/tools/gofileroom/all) is the most direct path to connecting GoFileRoom data to LLMs like Claude for analysis, summarization, or classification.

---

*Sources: Thomson Reuters Help Center, TR Developer Portal, Microsoft Learn, CS Professional Suite documentation*
