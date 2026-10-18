# Software Requirements Specification (SRS)
## EmailHub — Email Campaign & Analytics Platform

**Document Version:** 1.0.0  
**Standard:** IEEE 830-1998 Aligned  
**Status:** Approved  

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for **EmailHub**, a self-hosted email campaign management, validation, delivery, and analytics system utilizing Amazon SES SMTP.

### 1.2 Scope of the System
EmailHub manages subscriber lists, custom attributes, audience segmentation, email validation, template authoring, batch campaign sending, transactional 1-to-1 message dispatch, suppression enforcement, tracking of opens and clicks, and SES feedback telemetry.

---

## 2. Functional Requirements

### 2.1 Contact & List Management (CLM)
- **CLM-01:** System shall store contact records containing `email`, `firstName`, `lastName`, `fullName`, `organization`, `department`, `jobTitle`, `phone`, `customAttributes` (JSON), `status` (`subscribed`, `unsubscribed`, `bounced`, `complained`), and timestamps.
- **CLM-02:** System shall support CSV and JSON file imports via drag-and-drop or file picker up to 25MB.
- **CLM-03:** System shall automatically detect standard header names (`email`, `mail`, `name`, `full_name`, `dept`, `department`, `title`, `designation`) and present an interactive mapping interface for unmapped headers.
- **CLM-04:** System shall validate each row before insertion. Rows with syntax errors must be recorded in an import error log with row number and reason.
- **CLM-05:** System shall provide configurable duplicate handling: `skip`, `overwrite`, or `update_missing`.
- **CLM-06:** System shall allow assigning imported contacts to one or more static contact lists and applying tags.
- **CLM-07:** System shall support exporting contacts and filtered views to standard CSV format.

### 2.2 Email Validation Pipeline (EVP)
- **EVP-01:** System shall perform whitespace trimming, Unicode normalization, and RFC 5322 syntax validation.
- **EVP-02:** System shall verify domain DNS MX records using asynchronous DNS lookups with configurable timeout (default: 3000ms).
- **EVP-03:** System shall identify disposable/temporary domains against a curated in-memory blocklist (e.g., mailinator, tempmail, 10minutemail).
- **EVP-04:** System shall detect role-based addresses (`admin@`, `support@`, `billing@`, etc.).
- **EVP-05:** System shall cache validation outcomes in `email_validation_results` with a 30-day TTL to avoid repeat DNS lookups.
- **EVP-06:** System shall assign one of the following statuses: `valid_format`, `domain_valid`, `invalid`, `disposable`, `unknown`, `temporarily_unavailable`.
- **EVP-07:** Campaign audience builder shall enforce a selectable validation threshold policy (`strict`: require domain_valid; `moderate`: allow unknown; `permissive`: allow all except invalid).

### 2.3 Global Suppression & Deliverability Guard (GSD)
- **GSD-01:** System shall maintain a centralized `suppression_entries` table keyed on normalized email address.
- **GSD-02:** When an email encounters a hard bounce (SES status `Permanent`), the address shall be immediately and permanently added to `suppression_entries` with category `hard_bounce`.
- **GSD-03:** When an email encounters a spam complaint (SES status `Complaint`), the address shall be permanently added with category `complaint`.
- **GSD-04:** When a recipient clicks unsubscribe or submits a List-Unsubscribe request, the address shall be added with category `unsubscribe`.
- **GSD-05:** Soft bounces shall be tracked in `bounce_history`. Upon reaching `MAX_SOFT_BOUNCES` (default: 3), the address shall be automatically suppressed under `soft_bounce`.
- **GSD-06:** **Mandatory Atomic Pre-Send Intercept:** Prior to initiating an SMTP connection or submitting a message job, the worker must execute an atomic query against `suppression_entries`. If a record exists, the job must be transitioned directly to `skipped` with the suppression reason logged, without making an external network call.
- **GSD-07:** Admin unsuppression shall require explicit administrative confirmation, documented reason, and audit logging. Complaints and unsubscribes cannot be unsuppressed without explicit recipient re-opt-in documentation.

### 2.4 Campaign Lifecycle & Orchestration (CLO)
- **CLO-01:** Campaign builder shall follow a 5-step workflow:
  1. Metadata (Name, Description, Sender Name, Sender Email, Reply-To, Subject, Preheader).
  2. Audience (List selection, Tag filters, Exclusion rules, Live recipient count calculation).
  3. Content (Visual / HTML Editor, Template selection, Dynamic placeholder preview).
  4. Validation & Safeguard Review (Suppression check, Invalid count warning, Verification check).
  5. Schedule & Delivery (Immediate send, Scheduled time, Send rate throttle).
- **CLO-02:** System shall freeze the audience snapshot upon campaign launch (`campaign_audience_snapshots` and `campaign_recipients`).
- **CLO-03:** System shall support campaign states: `draft`, `scheduled`, `queued`, `sending`, `paused`, `completed`, `cancelled`, `failed`.
- **CLO-04:** User shall be able to pause an active sending campaign and resume it without duplicate sends.
- **CLO-05:** User shall be able to duplicate any existing campaign into a new draft.

### 2.5 Personalization & Template Engine (PTE)
- **PTE-01:** System shall parse placeholders in the format `{{variable_name}}` and `{{variable_name|fallback}}`.
- **PTE-02:** All contact standard fields (`{{name}}`, `{{email}}`, `{{dept_name}}`, `{{designation}}`, etc.) and arbitrary `customAttributes` keys must be accessible.
- **PTE-03:** All placeholder substitutions must be HTML-escaped by default to prevent XSS injection.
- **PTE-04:** Editor must render live preview using sample contact records from the selected audience.
- **PTE-05:** Preheader text must be injected via hidden email preview snippet block before the body content.

### 2.6 Single Email Dispatch (SED)
- **SED-01:** System shall provide a dedicated interface to dispatch an individual email.
- **SED-02:** Single sends shall allow typing an arbitrary email address or auto-completing from existing contacts.
- **SED-03:** Single sends must pass through the identical pre-send suppression and validation guard as campaign sends.
- **SED-04:** Single sends shall support dynamic placeholders if a contact is selected, live test send, and recipient-level audit tracking.

### 2.7 Engagement Tracking & Unsubscribe (ETU)
- **ETU-01:** System shall append a unique transparent 1x1 GIF tracking pixel (`/api/track/open/[trackingId]`) to all outbound HTML emails when open tracking is enabled.
- **ETU-02:** System shall rewrite all outbound HTTP/HTTPS links in email bodies to `/api/track/click/[linkId]` to record click timestamps, user agents, and IP addresses before issuing a 302 redirect.
- **ETU-03:** System shall compute both `total_opens` / `unique_opens` and `total_clicks` / `unique_clicks`.
- **ETU-04:** System shall inject RFC 2369 / RFC 8058 headers: `List-Unsubscribe: <https://[host]/api/unsubscribe?token=[token]>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- **ETU-05:** System shall provide an unauthenticated, secure unsubscribe landing page accessible via HMAC-signed token.

### 2.8 AWS SES SMTP Transport & Event Webhook (SES)
- **SES-01:** System shall connect to AWS SES SMTP via TLS 1.2 on port 587 using provided credentials.
- **SES-02:** System shall provide an admin-accessible SMTP connection test tool that verifies handshake, authentication, and returns diagnostic latency.
- **SES-03:** System shall ingest AWS SES event notifications (Send, Delivery, Bounce, Complaint, Open, Click) via `/api/webhooks/ses` (supporting Amazon SNS JSON notification payload).
- **SES-04:** System shall handle SNS subscription confirmation automatically (`Type: SubscriptionConfirmation`).
- **SES-05:** Event processing must be idempotent using provider `messageId` and event timestamps.

---

## 3. External Interface Requirements

### 3.1 User Interfaces
- Responsive web interface developed with Next.js App Router, Tailwind CSS, Lucide icons, and Shadcn-inspired clean aesthetics.
- Default light mode with full dark mode toggle.
- Comprehensive feedback: skeleton loaders, real-time toasts, and interactive confirmation modals.

### 3.2 Software Interfaces
- **Database:** Prisma ORM connecting to SQLite (local) / PostgreSQL (production).
- **Mail Transport:** Nodemailer configured for AWS SES SMTP with STARTTLS.
- **DNS Resolver:** Native Node.js `dns.promises` for MX and A record lookups.
