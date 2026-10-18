# Product Requirements Document (PRD)
## EmailHub — Self-Hosted Production-Ready Email Campaign & Analytics Platform

**Document Version:** 1.0.0  
**Status:** Approved  
**Author:** Lead Product Manager & Senior Architect  
**Target Release:** Production v1.0  

---

## 1. Executive Summary & Vision

### 1.1 Problem Statement
Modern businesses and marketers face high monthly subscription costs, arbitrary sending limits, and strict vendor lock-in with platforms such as Mailchimp, SendGrid, and Klaviyo. Conversely, sending directly via cloud infrastructure like Amazon SES provides high deliverability at roughly $0.10 per 1,000 emails, but lacks an intuitive user interface, contact management, campaign scheduling, deliverability protection (automatic suppression), rich email editing, and real-time engagement analytics.

### 1.2 Product Vision
**EmailHub** is an enterprise-grade, self-hosted email campaign management and analytics platform powered by Amazon SES. It combines the deliverability and cost-efficiency of AWS SES with the rich user experience of top-tier SaaS tools. It enables organizations to manage contacts, import large datasets with custom metadata, author responsive emails, execute scheduled multi-recipient campaigns, enforce global suppression lists (hard bounces, complaints, unsubscribes), and track engagement metrics in real time.

---

## 2. Core User Personas

| Persona | Role | Key Objectives | Pain Points Addressed |
| :--- | :--- | :--- | :--- |
| **Marketing Lead** | Campaign Manager | Create beautiful newsletters, segment contacts, insert dynamic tags, analyze CTR and CTOR. | Eliminates expensive per-seat or per-contact SaaS pricing. |
| **Deliverability Engineer** | Technical Admin | Maintain high sender reputation (>99%), enforce automated bounce/complaint suppression, verify DNS/MX. | Eliminates risk of sending to stale/bounced lists that could suspend AWS SES accounts. |
| **Operations / Support** | One-Off Sender | Send transactional or personalized 1-to-1 operational notices with reliable audit trails. | Centralized audit log and deliverability verification for single messages. |
| **System Administrator** | DevOps / SRE | Deploy via Docker / VPS, monitor queue health, inspect logs, execute database backups. | Transparent, self-contained architecture with health checks and zero external proprietary dependencies. |

---

## 3. High-Level Feature Scope

### 3.1 Authentication & Security
- Secure single-tenant administrator session authentication.
- Password hashing using modern cryptographic standards (Argon2 / bcrypt / scrypt).
- HTTP-only, SameSite secure session cookies.
- Role-ready authorization architecture with zero public registration.
- Absolute isolation of AWS credentials on the server side (never exposed to browser bundles).

### 3.2 Contact Management & Imports
- **Rich Contact Schema:** Email, Full Name, First Name, Last Name, Department, Organization, Job Title, Phone, Custom JSON Attributes, Subscription Status, Validation Status, Bounce Count.
- **Drag-and-Drop Ingestion:** Support for both CSV and JSON formats.
- **Intelligent Field Mapping:** Auto-detection of common column aliases (e.g., `email`, `dept_name`, `designation`).
- **Data Validation & Sanitization:** Detection of duplicates, syntax errors, and malformed entries with downloadable row-by-row error logs.
- **Lists & Tags:** Group contacts into static lists or dynamic tags for granular targeting.
- **Audience Export:** Export contacts with active filter criteria to CSV.

### 3.3 Email Validation Pipeline
- Pre-send multi-layer validation engine:
  1. Safe whitespace trimming and address normalization.
  2. RFC 5322 syntax validation.
  3. Domain MX and DNS resolution checks.
  4. Disposable / temporary email domain blocklist.
  5. Role-based address detection (e.g., `admin@`, `support@`, `sales@`).
- Validation status caching to prevent redundant external DNS lookups.
- Configurable campaign policy for handling `unknown` or unresolvable validation states.

### 3.4 Centralized Suppression Engine (Deliverability Safeguard)
- **Shared Global Registry:** Single source of truth for blocked recipients across all campaigns and single-send workflows.
- **Suppression Categories:**
  - `hard_bounce`: Permanent recipient failure (blocks all future sends).
  - `soft_bounce`: Transient failure (suppressed after threshold of consecutive failures).
  - `complaint`: Spam complaint reported by ISP feedback loops.
  - `unsubscribe`: Explicit recipient opt-out.
  - `admin_suppression`: Manual administrative block.
  - `invalid_syntax`: Malformed address.
- **Mandatory Pre-Send Guard:** Atomic pre-send verification ensuring no suppressed email ever reaches AWS SES SMTP.
- **SES Feedback Integration:** Webhook/SNS event ingestion for automated bounce and complaint categorization.

### 3.5 Email Authoring & Personalization
- **Rich Text & Code Editor:** Responsive formatting (headings, lists, alignments, fonts, colors, buttons/CTAs, dividers, images).
- **Template Library:** Built-in starter templates for Announcements, Newsletters, Invitations, and Operational Notices; capability to save any draft as a template.
- **Dynamic Personalization:** Syntax support for `{{name}}`, `{{dept_name}}`, `{{designation}}`, with fallback syntax `{{name|there}}`.
- **Live Preview & Test Sends:** Preview dynamic rendering using real contact data before scheduling.
- **HTML Sanitization:** Strict DOMPurify/sanitization preventing script injection or unsafe attributes.

### 3.6 Campaign Lifecycle & Sending Engine
- **5-Step Campaign Wizard:** Details -> Audience Selection -> Template Design -> Pre-send Validation -> Schedule & Send.
- **State Machine:** `draft` -> `scheduled` -> `queued` -> `sending` -> `paused` -> `completed` / `cancelled` / `failed`.
- **Background Queue Processing:** Rate-limited worker with exponential backoff and jitter for transient errors.
- **Concurrency & Throttle Control:** Sends throttled to match AWS SES rate limits (e.g., 14 emails/sec or configured custom rate).
- **Idempotency & Deduplication:** Prevents duplicate sends even on worker restart or timeout.

### 3.7 Engagement Tracking & Real-Time Analytics
- **Open Tracking:** 1x1 transparent tracking pixel with deduplication for Unique vs. Total opens.
- **Click Tracking:** Signed redirection links preventing open redirects while capturing click counts, device info, and timestamps.
- **Unsubscribe System:** RFC 8058 compliant `List-Unsubscribe` / `List-Unsubscribe-Post` headers and one-click unsubscribe landing page.
- **Analytics Dashboard:**
  - Top-line KPI metrics: Attempted, Accepted, Delivered, Failed, Bounces, Complaints, Opens, Clicks, CTR, CTOR, Delivery Rate, Bounce Rate, Unsubscribe Rate.
  - Trend charts: Delivery over time, engagement timeline, top-performing links, and campaign comparisons.

---

## 4. Key Performance Indicators (KPIs) & Success Metrics

1. **Deliverability Rate:** > 98.5% on valid audience lists.
2. **Bounce Rate Ceiling:** Kept strictly below AWS SES 5.0% threshold (with warning at >2.0%).
3. **Complaint Rate Ceiling:** Kept strictly below AWS SES 0.1% threshold.
4. **Queue Throughput:** Capable of sustained 10-50 emails/second without CPU throttling or memory bloat.
5. **Zero Duplicate Deliveries:** 100% idempotency enforcement across retries.
6. **Zero Suppressed Sends:** 100% intercept rate for suppressed recipients prior to SMTP socket open.

---

## 5. Non-Functional Requirements

- **Reliability:** Graceful worker recovery on process restarts without lost jobs or double-sends.
- **Security:** Zero plaintext secrets in version control; TLS 1.2+ enforced for all SMTP and HTTPS connections.
- **Auditability:** Complete recipient-level history tracking send attempts, message IDs, status transitions, and error logs.
- **Usability:** Clean SaaS design system with dark/light mode, clear typography, responsive layouts, and zero non-functional controls.
