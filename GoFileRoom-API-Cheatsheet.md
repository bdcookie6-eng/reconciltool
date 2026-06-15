# GoFileRoom REST API — Cheat Sheet & Implementation Ideas

**Base URL (Documents)**: `https://m.services.gofileroom.com/`  
**Base URL (Client Portal)**: `https://cc-services.gofileroom.com/`  
**Auth**: API key in request header + OAuth2  
**Rate Limit**: 10,000 requests/hour per firm  
**Spec**: developerportal.thomsonreuters.com/gofileroom-firmflow-api  

---

## What the API Can Do

### Documents
| Action | What It Does |
|---|---|
| Search documents | Query by client, date range, doc type, any index field |
| Retrieve document | Download the actual file by Document ID |
| Upload / ingest document | Push a file into GoFileRoom with index metadata |
| Update document metadata | Change index fields on an existing document |
| Delete document | Remove a document |
| Archive document | Move to archive status |
| Get document history | Audit trail — who viewed/edited/downloaded |

### Document Search & Indexing
| Action | What It Does |
|---|---|
| Search by index fields | Client name, SSN/EIN, tax year, doc type, etc. |
| Full-text search | Search inside document contents (indexed docs) |
| Get index field definitions | See what fields your firm has configured |
| Get drawer/folder structure | Navigate the GoFileRoom file structure |

### Users & Groups
| Action | What It Does |
|---|---|
| List all users | Get every user in your firm |
| Create user | Add a new GoFileRoom user programmatically |
| Update user | Change roles, permissions, group membership |
| Deactivate user | Disable access without deleting |
| List groups | See all user groups |
| Create / update groups | Manage team structure |

### FirmFlow (Workflow)
| Action | What It Does |
|---|---|
| Get workflow folders | List all engagement/workflow folders |
| Create workflow folder | Start a new engagement workflow |
| Update folder | Change status, due dates, assignments |
| Get folder tasks | See all tasks/steps in an engagement |
| Assign tasks | Assign a task to a specific user |
| Complete / sign off task | Mark a step done |
| Get deliverables | List all deliverables for a workflow |
| Create deliverable | Add a new item to track |
| Get workflow status | Check overall progress of an engagement |

### Reporting & Organization
| Action | What It Does |
|---|---|
| Get organization info | Firm name, structure, drawer list |
| Run search reports | Pull structured data across multiple clients |
| Export to BI tools | Feed data into dashboards/analytics |

---

## Implementation Ideas

### 1. AI Document Assistant
**What it does**: Answer questions about client documents using AI  
**How it works**:
1. User asks: *"What did we file for Acme Corp in 2024?"*
2. API searches GoFileRoom by client name + tax year
3. Retrieves matching documents
4. AI (Claude, GPT, etc.) reads and summarizes them
5. Returns answer in plain English

**Stack**: GoFileRoom API → Python → Claude API  
**Complexity**: Medium  

---

### 2. Client Onboarding Automation
**What it does**: When a new client is added to your practice management system, automatically create their GoFileRoom drawer, folder structure, and FirmFlow workflow  
**How it works**:
1. New client created in Practice CS / your CRM
2. Webhook or scheduled job triggers
3. API creates GoFileRoom structure for that client
4. FirmFlow engagement folder created and assigned to the right team

**Stack**: Practice CS → Zapier or Python script → GoFileRoom API  
**Complexity**: Low-Medium  

---

### 3. Engagement Status Dashboard
**What it does**: Real-time dashboard showing all open engagements, their status, who's working on what, and what's overdue  
**How it works**:
1. Scheduled job (every hour or on-demand) calls FirmFlow API
2. Pulls all workflow folders + task statuses
3. Writes to a database or Google Sheet
4. Dashboard (Power BI, Tableau, Google Looker Studio) displays it

**Stack**: GoFileRoom API → Python → Google Sheets or SQL DB → dashboard  
**Complexity**: Low-Medium  

---

### 4. Automated Document Intake
**What it does**: Clients email documents → they're automatically indexed and uploaded to GoFileRoom under the right client/folder  
**How it works**:
1. Client emails a PDF to a monitored inbox
2. Script reads the email attachment
3. AI classifies the document (W-2, 1099, bank statement, etc.)
4. API uploads it to GoFileRoom with correct index fields pre-filled

**Stack**: Email (Gmail/Outlook API) → Python + AI classifier → GoFileRoom API  
**Complexity**: Medium-High  

---

### 5. Deadline & Due Date Alerts
**What it does**: Slack/email alerts when FirmFlow tasks are approaching deadlines or overdue  
**How it works**:
1. Daily job queries FirmFlow API for all tasks with due dates
2. Compares against today's date
3. Sends Slack message or email for anything due in the next 3 days or already overdue
4. Can also auto-escalate by reassigning tasks via the API

**Stack**: GoFileRoom API → Python → Slack API or SendGrid  
**Complexity**: Low  

---

### 6. AI-Powered Tax Organizer Review
**What it does**: Automatically check if a client's tax organizer is complete — flag missing documents  
**How it works**:
1. Query GoFileRoom for all documents filed under a client + tax year
2. Compare against a checklist (W-2, 1099s, mortgage interest, etc.)
3. AI identifies what's missing
4. Auto-send client a reminder listing exactly what's not in yet

**Stack**: GoFileRoom API → Python + Claude → email/SMS to client  
**Complexity**: Medium  

---

### 7. Document Retention & Compliance Cleanup
**What it does**: Enforce your firm's document retention policy automatically  
**How it works**:
1. API searches for documents older than your retention window (e.g., 7 years)
2. Generates a report of what's eligible for deletion
3. After human approval, API archives or deletes them in bulk
4. Logs every action for compliance records

**Stack**: GoFileRoom API → Python → approval email → bulk delete via API  
**Complexity**: Medium  

---

### 8. Cross-Client Search & Reporting
**What it does**: Answer questions that span your entire client base  
**Examples**:
- "Which clients are missing their 2024 tax documents?"
- "How many engagements are past due this week?"
- "Which staff member has the most open tasks?"

**How it works**:
1. API pulls data across all clients/folders
2. Aggregates into a report or feeds an AI chat interface
3. You ask questions in plain English; AI queries and summarizes

**Stack**: GoFileRoom API → Python → Claude or GPT → chat UI  
**Complexity**: Medium-High  

---

### 9. Reconciliation Tool Integration (Your Current Project)
**What it does**: Connect your bank reconciliation tool directly to GoFileRoom — auto-save completed reconciliations as indexed documents  
**How it works**:
1. User completes a bank rec in your tool
2. Your app generates the reconciliation report (PDF or Excel)
3. GoFileRoom API uploads it with client name, period, document type pre-filled
4. Shows up in GoFileRoom instantly, no manual filing needed

**Stack**: Your reconciltool → GoFileRoom API (upload endpoint)  
**Complexity**: Low — this is one API call  

---

### 10. Power BI / Analytics Data Feed
**What it does**: Pull GoFileRoom + FirmFlow data into Power BI for firm-wide KPI reporting  
**How it works**:
1. Python script runs nightly, hits GoFileRoom API
2. Writes structured data to SQL Server or Azure SQL
3. Power BI connects to that database
4. Dashboards show document volume, workflow throughput, staff utilization, etc.

**Stack**: GoFileRoom API → Python → SQL Server → Power BI  
**Complexity**: Medium  

---

## Quick Reference: Getting Started

```
1. Call TR:     1-800-968-0600 → request API key
2. Register:    developerportal.thomsonreuters.com
3. Read spec:   developerportal.thomsonreuters.com/gofileroom-firmflow-api
4. Test:        Load spec into Postman → authenticate → run a document search
5. Build:       Pick one implementation above and start there
```

## Authentication Header Example
```http
GET https://m.services.gofileroom.com/api/documents/search
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

## Lowest-Effort Starting Point
**Idea #5 (Due Date Alerts)** — only requires reading FirmFlow data and sending an email/Slack message. No document handling, no AI required. Could be built in a Python script in a day.

## Highest-Value Starting Point
**Idea #9 (Reconciliation Tool Integration)** — directly connects your existing tool to GoFileRoom. One API call saves every user manual filing time on every reconciliation they complete.

---

*Sources: Thomson Reuters Developer Portal, GoFileRoom Help Center, CS Professional Suite documentation*
