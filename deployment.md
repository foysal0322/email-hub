# Deployment & Operations Guide
## EmailHub — Deployment, Configuration, AWS SES Setup, and Operations

**Document Version:** 1.0.0  
**Status:** Approved  

---

## 1. Quick Start / Local Run

### 1.1 Prerequisites
- Node.js 20+ / 22+ LTS
- npm or pnpm
- Valid AWS SES SMTP Credentials (or Mail-Manager credentials provided in `smtp-credentials.csv`)

### 1.2 Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure the following variables are configured:
```env
# Application Base URL (Used for open tracking pixel and click redirects)
APP_BASE_URL=http://localhost:3000

# NextAuth / Session Secret (Generate via: openssl rand -base64 32)
SESSION_SECRET=super-secret-random-32-character-string-min-length

# Database Connection (Default: portable SQLite file or PostgreSQL connection)
DATABASE_URL="file:./dev.db"

# AWS SES SMTP Configuration (from smtp-credentials.csv)
AWS_SES_SMTP_HOST=ujz58nc6cr4g.fips.yxbq.mail-manager-smtp.amazonaws.com
AWS_SES_SMTP_PORT=587
AWS_SES_SMTP_USERNAME=inp-awalp2xcurrgakrl2uj6mtha
AWS_SES_SMTP_PASSWORD=Nsu01_Sm1P_2026
AWS_SES_REGION=us-east-1

# Default Sender Identity
EMAIL_FROM_NAME="EmailHub Admin"
EMAIL_FROM_ADDRESS=notifications@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com

# Admin Default Credentials (seeded on initial boot)
ADMIN_EMAIL=admin@emailhub.local
ADMIN_PASSWORD=AdminPassword123!
```

### 1.3 Database Setup & Seed
```bash
npx prisma generate
npx prisma db push
npm run seed
```

### 1.4 Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in with the configured admin credentials.

---

## 2. Production Docker Deployment

A complete multi-container `docker-compose.yml` is provided for running EmailHub with PostgreSQL and Redis:

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://emailhub:secure_pg_pass@postgres:5432/emailhub_prod
      - REDIS_URL=redis://redis:6379
      - APP_BASE_URL=https://emailhub.yourdomain.com
      - SESSION_SECRET=${SESSION_SECRET}
      - AWS_SES_SMTP_HOST=${AWS_SES_SMTP_HOST}
      - AWS_SES_SMTP_PORT=${AWS_SES_SMTP_PORT}
      - AWS_SES_SMTP_USERNAME=${AWS_SES_SMTP_USERNAME}
      - AWS_SES_SMTP_PASSWORD=${AWS_SES_SMTP_PASSWORD}
      - AWS_SES_REGION=${AWS_SES_REGION}
      - EMAIL_FROM_NAME=${EMAIL_FROM_NAME}
      - EMAIL_FROM_ADDRESS=${EMAIL_FROM_ADDRESS}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: emailhub
      POSTGRES_PASSWORD: secure_pg_pass
      POSTGRES_DB: emailhub_prod
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

---

## 3. AWS SES & Mail-Manager Production Checklist

1. **Verify Sender Domain or Email Identity:**
   - In AWS SES Console -> **Verified Identities**, verify your domain `yourdomain.com` or email address.
   - Configure DKIM (CNAME records provided by AWS).
   - Configure SPF: Add `include:amazonses.com` to your domain TXT record.
   - Configure DMARC: Add `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com` TXT record at `_dmarc.yourdomain.com`.
2. **Move Out of SES Sandbox:**
   - Submit an SES limit increase / production access request in the AWS Console.
   - While in Sandbox mode, SES only permits sending to pre-verified recipient emails.
3. **Configure Amazon SNS for Delivery & Bounce Feedback:**
   - Create an Amazon SNS Topic `emailhub-ses-events`.
   - In SES Configuration Sets -> Event Destinations, enable:
     - `Sends`, `Deliveries`, `Bounces`, `Complaints`.
   - Add an HTTPS Subscription pointing to `https://emailhub.yourdomain.com/api/webhooks/ses`.
   - EmailHub automatically confirms the subscription upon receiving the first SNS handshake.

---

## 4. Maintenance, Backup & Operational Health

- **Health Check Endpoint:** `GET /api/health` returns status of Database, SMTP connectivity, and Queue.
- **Database Backup (PostgreSQL):**
  ```bash
  pg_dump -U emailhub -h localhost emailhub_prod | gzip > backup_$(date +%Y%m%d).sql.gz
  ```
- **Database Backup (SQLite):**
  ```bash
  sqlite3 dev.db ".backup 'backup_$(date +%Y%m%d).db'"
  ```
- **SMTP Diagnostics:**
  - Accessible directly in the UI under **Settings -> SMTP Diagnostics** or via `POST /api/settings/smtp-test`.
