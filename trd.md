# Technical Requirements Document (TRD)
## EmailHub — Technical Architecture, Specifications & Engineering Standards

**Document Version:** 1.0.0  
**Status:** Approved  

---

## 1. System Technology Stack

| Layer | Primary Technology | Secondary / Alternatives | Rational / Details |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js v20+ / v22.x LTS | TypeScript 5.x | Strict type safety, high concurrency I/O. |
| **Framework** | Next.js 14+ / 15 (App Router) | React 18 / 19 | Server Actions, API Route Handlers, SSR/SSG. |
| **Styling** | Tailwind CSS + CSS Modules | Radix UI primitives | Highly responsive, dark/light theme tokens, fast rendering. |
| **Database** | SQLite (Dev/Standalone) & PostgreSQL (Production) | Prisma ORM 5.x | Portable schema migrations, type-safe queries, zero external server friction. |
| **Background Processing** | Persistent Queue Engine + BullMQ / Redis driver | In-DB Transactional Outbox | Guarantees zero dropped jobs, pause/resume, rate limiting, and retry policies. |
| **SMTP Delivery** | Nodemailer with AWS SES SMTP credentials | AWS SDK for SES v3 | STARTTLS (port 587), connection pooling, retry with exponential backoff. |
| **HTML Sanitization** | DOMPurify / sanitize-html | jsdom | Strips `<script>`, inline event handlers, javascript: URIs. |
| **Security & Auth** | Iron-session / JWT session cookies | bcryptjs / Argon2 | Stateless signed session cookies, CSRF protection, constant-time token validation. |
| **Charts** | Recharts / Chart.js | Lucide React | Lightweight SVG charting for delivery and engagement trends. |

---

## 2. Technical Component Specifications

### 2.1 SMTP Client Architecture
- **Transport:** Nodemailer SMTP pool transport.
- **Host:** `AWS_SES_SMTP_HOST` (e.g., `ujz58nc6cr4g.fips.yxbq.mail-manager-smtp.amazonaws.com`).
- **Port:** `587`.
- **Security:** `secure: false`, `requireTLS: true` (enforces STARTTLS with full certificate verification).
- **Authentication:** PLAIN / LOGIN with `AWS_SES_SMTP_USERNAME` and `AWS_SES_SMTP_PASSWORD`.
- **Pool Settings:** `pool: true`, `maxConnections: 5`, `maxMessages: 100`, `rateLimit: 14` (messages/sec).
- **Retry Mechanism:** Failed submissions with 4xx SMTP codes (transient) retried up to 3 times with exponential backoff (`2^attempt * 1000ms + jitter`). 5xx codes (permanent) immediately fail the message and trigger bounce suppression.

### 2.2 Background Job & Sending Engine (Dual-Mode)
1. **Persistent Database Outbox Queue (`SendQueue`):**
   - Implemented using database-backed transactional status: `pending`, `processing`, `completed`, `failed`, `skipped`.
   - Polling worker with atomic row locking (`SELECT ... FOR UPDATE` in PostgreSQL or atomic update state in SQLite: `UPDATE jobs SET status='processing' WHERE id=(SELECT id FROM jobs WHERE status='pending' LIMIT 1)`).
   - Capable of running embedded inside Next.js server runtime without external daemons, or as a standalone Node.js worker process.
2. **BullMQ / Redis Adapter (Optional Flag):**
   - When `REDIS_URL` is set, jobs are routed via Redis queues with distributed concurrency control.

### 2.3 Email Personalization Engine
- **Grammar & Tokenizer:** Regular expression scanner: `/\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g`.
- **Token Resolution Order:**
  1. Direct contact properties (`name`, `firstName`, `lastName`, `email`, `department`, `organization`, `jobTitle`).
  2. Custom attributes dictionary (`customAttributes[key]`).
  3. Default fallback value (if `|fallback` specified).
  4. Empty string or configured global fallback (`""`).
- **HTML Escaping:** All interpolated values passed through `escapeHtml()`:
  - `&` -> `&amp;`
  - `<` -> `&lt;`
  - `>` -> `&gt;`
  - `"` -> `&quot;`
  - `'` -> `&#39;`

### 2.4 Pre-Send Validation Engine
- **Step 1: Normalization:** `email.trim().toLowerCase()`.
- **Step 2: Syntax Check:** Strict RFC 5322 regex validation.
- **Step 3: Disposable Domain Check:** Lookup against 4,000+ domain hashset (`mailinator.com`, `guerrillamail.com`, `tempmail.com`, etc.).
- **Step 4: DNS MX Resolution:** `dns.promises.resolveMx(domain)` with fallback to `resolve4(domain)` (RFC 5321 fallback).
- **Step 5: Role-based Detection:** Regex test against common prefix aliases (`admin`, `info`, `support`, `contact`, `sales`, `billing`, `help`, `jobs`, `security`).

### 2.5 Deliverability & Suppression Enforcement
- **Query Structure:**
  ```sql
  SELECT id, category, reason FROM suppression_entries WHERE email = :normalizedEmail LIMIT 1;
  ```
- **Execution Hook:** Executed synchronously in the send worker immediately before `transporter.sendMail()`.
- **Action on Match:**
  - Status updated to `skipped`.
  - Recipient log created with `skipReason = "Recipient suppressed: " + entry.category`.
  - Campaign counter `skippedCount` incremented.
  - Zero network packets transmitted to AWS SMTP.

### 2.6 Open & Click Tracking Pipeline
- **Pixel Endpoint:** `GET /api/track/open/[trackingId]`
  - Emits HTTP 200 with headers:
    - `Content-Type: image/gif`
    - `Cache-Control: no-cache, no-store, must-revalidate, private`
    - `Pragma: no-cache`
    - `Expires: 0`
  - Payload: Base64 43-byte transparent GIF.
  - Asynchronously updates `email_messages.openedAt` (if null) and logs `email_events (type: open)`.
- **Click Endpoint:** `GET /api/track/click/[linkId]`
  - Looks up original target URL in `email_links`.
  - Logs `email_events (type: click)`.
  - Emits HTTP 302 redirect to `targetUrl`.
  - Validates `targetUrl` begins with `http://` or `https://` to prevent open-redirect vulnerabilities.

---

## 3. Security Specifications

1. **Authentication Session:** Encrypted cookie using 256-bit AES encryption (`iron-session`).
2. **Credential Redaction:** Sensitive environment variables (`AWS_SES_SMTP_PASSWORD`, `DATABASE_URL`) explicitly redacted from all logging endpoints.
3. **Cross-Site Scripting (XSS):**
   - Sanitized HTML preview via `DOMPurify`.
   - Content Security Policy (CSP) headers configured on all administrative endpoints.
4. **Rate Limiting:** IP-based and user-based throttling on login attempts (max 5 failures per 15 minutes).
