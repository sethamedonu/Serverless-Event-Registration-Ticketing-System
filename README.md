# Event Registration & Ticketing System

A fully serverless AWS-native event registration and ticketing system that replaces a manual Microsoft Forms + Excel workflow. The system has two distinct user-facing surfaces:

- **Public registration portal** — attendees self-register for events
- **Coordinator console** — staff manage events, check in attendees, print badges, and run reports

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
│                                                                  │
│   Attendee Browser          Coordinator Browser                  │
│   (register, view)          (dashboard, check-in, reports)       │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              AWS AMPLIFY HOSTING                                  │
│         (React/TanStack Start SPA — static files)                │
│         Auto-deploys from GitHub main branch                     │
│         Serves: /, /register, /auth, /dashboard, etc.           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTPS API calls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              AWS API GATEWAY (REST API)                          │
│                                                                  │
│  Public endpoints (no auth):                                     │
│    GET  /events                                                  │
│    POST /events/{eventId}/register                               │
│                                                                  │
│  Protected endpoints (Cognito JWT required):                     │
│    POST   /events                                                │
│    PUT    /events/{eventId}                                      │
│    GET    /events/{eventId}/registrations                        │
│    POST   /events/{eventId}/walk-in                              │
│    GET    /registrations/{email}                                 │
│    PUT    /registrations/{id}                                    │
│    DELETE /registrations/{id}                                    │
│    POST   /registrations/{id}/checkin                            │
│    POST   /registrations/{id}/print                              │
│    GET    /audit                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   COGNITO    │  │   LAMBDA     │  │   DYNAMODB   │
│  AUTHORIZER  │  │  FUNCTIONS   │  │   TABLES     │
│              │  │  (Node 20)   │  │              │
│ Validates    │  │              │  │ Events       │
│ JWT tokens   │  │ Business     │  │ Registrations│
│ Extracts     │  │ logic for    │  │ AuditLogs    │
│ user groups  │  │ each endpoint│  │              │
└──────────────┘  └──────┬───────┘  └──────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌───────┐ ┌────────────┐
        │   SNS    │ │  CW   │ │  BUDGETS   │
        │  TOPIC   │ │ LOGS  │ │            │
        │          │ │ ALARMS│ │ $1/month   │
        │ Confirm- │ │       │ │ free tier  │
        │ ation    │ │ Error │ │ alert      │
        │ emails   │ │ rate  │ │            │
        └──────────┘ └───────┘ └────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    CI/CD PIPELINE                                │
│                                                                  │
│  GitHub Push → GitHub Actions                                    │
│    ├── Run Jest tests (backend/__tests__/)                       │
│    ├── SAM build                                                 │
│    └── SAM deploy → CloudFormation → AWS Stack                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer-by-Layer Technical Breakdown

### 1. Frontend — React/TanStack Start on Amplify

The frontend is a Single Page Application built with TanStack Start (React 19 + Vite). It is deployed as static files to AWS Amplify Hosting.

**How auth works on the frontend:**
- `src/lib/auth/cognito-client.ts` uses the `amazon-cognito-identity-js` SDK
- On sign-in, Cognito returns 3 tokens: **ID token**, **Access token**, **Refresh token**
- The ID token is a JWT stored in `localStorage` via the Cognito SDK
- Every API call attaches it as `Authorization: Bearer <idToken>`
- The JWT payload contains `cognito:groups` — the frontend reads this to determine role (`Admin`, `RegistrationOfficer`, `CheckinOfficer`) and shows/hides nav items accordingly
- `src/lib/hooks/use-auth.ts` exposes `isAdmin`, `isRegOfficer`, `isCheckinOfficer` booleans derived from the token groups

**How data flows:**
- `src/lib/api-client.ts` is the single source of truth for all HTTP calls
- It reads `VITE_API_URL` from env vars to know the API Gateway base URL
- TanStack Query caches responses, handles loading/error states, and auto-refetches

**Amplify Hosting:**
- Connected to the GitHub repo `TerryBinful/event-with-me`
- On every push to `main`, Amplify pulls the code, runs `bun run build`, and serves the `dist/` folder
- Environment variables (`VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, etc.) are injected at build time via the Amplify console

---

### 2. Authentication — AWS Cognito

Cognito is the identity layer for all coordinator staff. Attendees do not need accounts.

**User Pool structure:**
```
Cognito User Pool: event-with-me-prod
  │
  ├── Users (staff accounts — email + password)
  │
  └── Groups
        ├── Admin               → full system access
        ├── RegistrationOfficer → walk-in + participants
        └── CheckinOfficer      → check-in only
```

**Token flow:**
```
Browser                    Cognito
  │                           │
  │── signIn(email, pass) ───▶│
  │◀── { idToken, accessToken, refreshToken } ──│
  │                           │
  │── API call + Bearer idToken ──▶ API Gateway
                                        │
                                   Cognito Authorizer
                                   validates token signature
                                   extracts sub, email, groups
                                        │
                                   Lambda receives
                                   event.requestContext
                                   .authorizer.claims
```

**Role enforcement:**
- API Gateway's Cognito Authorizer rejects any request with an invalid or expired token before it reaches Lambda
- Inside Lambda, `shared/auth.mjs` reads `claims["cognito:groups"]` and checks `isAdmin()` for admin-only operations
- The frontend also enforces roles visually (hides nav items, redirects) but the real enforcement is in Lambda

---

### 3. API Gateway

A REST API (not HTTP API) is used because it supports the Cognito Authorizer natively and integrates cleanly with SAM.

**Key design decisions:**
- `GET /events` and `POST /events/{eventId}/register` have `Auth: NONE` — public endpoints for attendees
- All other endpoints require a valid Cognito JWT
- CORS is configured at the API level to allow `*` origin (tighten to the Amplify domain in production)
- Each endpoint maps 1:1 to a Lambda function — no shared handler routing

---

### 4. Lambda Functions

11 functions, all Node.js 20 ESM modules. Each function is small and single-purpose.

**Shared modules (`backend/shared/`):**

| Module | Purpose |
|---|---|
| `db.mjs` | DynamoDB DocumentClient singleton + table name env vars |
| `response.mjs` | Standard HTTP response helpers (`ok`, `created`, `badRequest`, etc.) with CORS headers |
| `ids.mjs` | UUID generator + registration number formatter (`SUMMIT-0001`) |
| `auth.mjs` | Extract caller identity from Cognito claims, `isAdmin()` check, audit log writer |

**Request lifecycle inside a Lambda:**
```
API Gateway event
      │
      ▼
1. OPTIONS check → return CORS headers immediately
2. Extract caller from event.requestContext.authorizer.claims
3. Parse + validate request body / path parameters
4. DynamoDB operation (Get, Put, Update, Delete, Query, Scan)
5. Write audit log entry (fire-and-forget)
6. Return standardised JSON response
```

**IAM permissions** — each Lambda has the minimum required DynamoDB policy:
- Read-only Lambdas → `DynamoDBReadPolicy`
- Write Lambdas → `DynamoDBCrudPolicy`
- Only `registerParticipant` has `SNSPublishMessagePolicy`

---

### 5. DynamoDB

Three tables, all using PAY_PER_REQUEST billing (free tier friendly, no capacity planning needed).

**Events table:**
```
PK: eventId (UUID)
Attributes: name, date, venue, description, registrationOpen,
            primaryColor, accentColor, logoUrl, showQr,
            showRegistrationNumber, badgeFontSize,
            createdAt, updatedAt
```

**Registrations table:**
```
PK: registrationId (UUID)

GSI 1: email-eventId-index
  PK: email, SK: eventId
  → Used for duplicate email check on registration
  → Used for GET /registrations/{email}

GSI 2: eventId-createdAt-index
  PK: eventId, SK: createdAt
  → Used for GET /events/{eventId}/registrations
  → Returns registrations sorted newest-first

Attributes: registrationNumber, fullName, organisation, email,
            phone, position, registrationType (online|walk_in),
            checkedInAt, checkedInBy, badgePrintedAt,
            badgePrintCount, createdBy, createdAt, updatedAt
```

**AuditLogs table:**
```
PK: id (UUID)
Attributes: action, entity, entityId, actorId, actorLabel,
            meta (JSON), createdAt
```

---

### 6. SNS — Confirmation Emails

When `registerParticipant` runs successfully, it publishes a JSON message to the SNS topic `event-confirmations-prod` containing the attendee's name, email, registration number, event name, date and venue.

> The topic exists but has no subscriber yet — a confirmation email Lambda needs to be built and subscribed (see Step 5 in the setup checklist below).

---

### 7. CloudWatch

- Log groups are automatically created for every Lambda function by AWS
- Two alarms are defined in `backend/template.yaml`:
  - `ApiErrorAlarm` — triggers if API Gateway 5xx errors exceed 5 in a 5-minute window
  - `LambdaErrorAlarm` — triggers if Lambda errors exceed 10 in a 5-minute window
- Alarms currently have no notification action — wire them to an SNS email topic (see Step 6 below)

---

### 8. AWS Budgets

A `$1/month` budget is defined. When actual spend exceeds 80% ($0.80), it publishes to the SNS confirmation topic. This keeps the system within the AWS free tier and alerts before any meaningful cost is incurred.

---

### 9. CI/CD Pipeline — GitHub Actions

```
Push to main (backend/** files)
        │
        ▼
Job 1: test
  - Checkout code
  - Node 20 setup
  - npm ci (backend/package.json)
  - Jest unit tests (backend/__tests__/)
        │
        ▼ (only if tests pass AND branch is main)
Job 2: deploy
  - Configure AWS credentials (from GitHub Secrets)
  - Install SAM CLI
  - sam build
  - sam deploy --stack-name event-with-me-prod
  - Print CloudFormation stack outputs to GitHub summary
```

Frontend deployment is handled entirely by Amplify — it watches the GitHub repo independently and deploys on every push to `main`, no GitHub Actions involvement needed.

---

## First-Time Setup

### Step 1 — AWS Account & IAM

Create a dedicated IAM user for GitHub Actions deployments:

```
AWS Console → IAM → Users → Create user
  Name: github-actions-deployer
  Access type: Programmatic access
  Permissions: AdministratorAccess
  → Save Access Key ID + Secret Access Key
```

Add to GitHub repo **Settings → Secrets → Actions**:
```
AWS_ACCESS_KEY_ID     = <from IAM>
AWS_SECRET_ACCESS_KEY = <from IAM>
AWS_REGION            = us-east-1
```

---

### Step 2 — Deploy the Backend (SAM)

```bash
# Install SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

cd backend
npm install
sam build
sam deploy --guided

# Prompts:
#   Stack name:       event-with-me-prod
#   Region:           us-east-1
#   Stage parameter:  prod
#   Confirm changes:  Y
#   Allow IAM roles:  Y
#   Save samconfig:   Y
```

Note the 4 output values after deploy:
```
ApiUrl           → https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
UserPoolId       → us-east-1_XXXXXXXXX
UserPoolClientId → xxxxxxxxxxxxxxxxxxxxxxxxxx
AwsRegion        → us-east-1
```

---

### Step 3 — Create the First Admin User

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@yourorg.com \
  --temporary-password Admin@1234 \
  --user-attributes Name=name,Value="Admin User"

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <UserPoolId> \
  --username admin@yourorg.com \
  --group-name Admin
```

The admin signs in at `/auth` and is prompted by Cognito to set a permanent password on first login.

---

### Step 4 — Connect AWS Amplify Hosting

```
AWS Console → Amplify → New app → Host web app
  → GitHub → TerryBinful/event-with-me → branch: main
  → Amplify detects amplify.yml automatically
  → App settings → Environment variables → Add:
      VITE_API_URL              = <ApiUrl from SAM output>
      VITE_COGNITO_USER_POOL_ID = <UserPoolId from SAM output>
      VITE_COGNITO_CLIENT_ID    = <UserPoolClientId from SAM output>
      VITE_AWS_REGION           = <your region>
  → Save and deploy
```

---

### Step 5 — Activate Confirmation Emails (SNS → SES)

**5a. Verify a sender email in SES:**
```
AWS Console → SES → Verified identities → Create identity
  → Email address: noreply@yourorg.com
  → Click the verification link sent to your inbox
```

**5b. Create a confirmation email Lambda** (`backend/notifications/sendConfirmationEmail.mjs`):
- Triggered by SNS topic `event-confirmations-prod`
- Parses the JSON message payload
- Calls `SESClient.sendEmail()` with a formatted HTML body
- Add to `template.yaml` with an `SNS` event source pointing to `ConfirmationTopic`

---

### Step 6 — Wire CloudWatch Alarm Notifications

Add an ops alert SNS topic to `backend/template.yaml` and subscribe your email:

```yaml
OpsAlertTopic:
  Type: AWS::SNS::Topic
  Properties:
    TopicName: !Sub event-ops-alerts-${Stage}
    Subscription:
      - Protocol: email
        Endpoint: ops@yourorg.com

# Then add AlarmActions to both existing alarms:
AlarmActions:
  - !Ref OpsAlertTopic
```

---

### Step 7 — Tighten IAM Permissions (Production)

Replace `AdministratorAccess` on the GitHub Actions IAM user with a scoped policy covering only CloudFormation, S3 (SAM artifacts), Lambda, API Gateway, DynamoDB, Cognito, SNS, IAM, and Budgets.

---

### Step 8 — Custom Domain (Optional)

```
AWS Console → Amplify → your app → Domain management
  → Add domain: events.yourorg.com
  → Amplify provisions SSL via ACM automatically
  → Update CORS AllowOrigin in template.yaml to your domain
```

---

## Cognito Groups (Roles)

| Group | Access |
|---|---|
| `Admin` | Full access — events, staff, reports, settings, audit |
| `RegistrationOfficer` | Walk-in registration, participants |
| `CheckinOfficer` | Check-in, walk-in (limited) |

---

## Running Locally

```bash
npm install        # or: bun install
cp .env.example .env   # fill in your values
npm run dev        # starts at http://localhost:3000
```

---

## Badge Printing (XPrinter XP-DT427B)

Badge is **100mm × 60mm landscape**. In Chrome print dialog:
1. Paper size: 100mm × 60mm landscape
2. Margins: None
3. Uncheck "Headers and footers"

---

## Project Structure

```
backend/                  AWS SAM backend
  template.yaml           All AWS infrastructure (IaC)
  events/                 Lambda: createEvent, listEvents, updateEvent
  registrations/          Lambda: register, list, checkIn, walkIn,
                                  delete, update, print, audit
  shared/                 db.mjs, response.mjs, ids.mjs, auth.mjs
  __tests__/              Jest unit tests

src/
  lib/
    api-client.ts         All API calls to API Gateway
    auth/
      cognito-client.ts   Cognito sign-in/out/session/reset
    hooks/
      use-auth.ts         Cognito session + role hooks
  routes/                 TanStack file-based routes
  components/             UI components

.github/workflows/
  deploy.yml              CI/CD: test → SAM build → SAM deploy

amplify.yml               Amplify Hosting build config
.env.example              Required environment variables
```

---

## Setup Checklist

```
Infrastructure
  ☐ Create IAM user for GitHub Actions
  ☐ Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION to GitHub Secrets
  ☐ Run sam deploy --guided from backend/
  ☐ Note the 4 SAM output values

Auth
  ☐ Create first admin user via AWS CLI
  ☐ Test sign-in at /auth

Frontend
  ☐ Connect Amplify Hosting to GitHub repo
  ☐ Add 4 environment variables in Amplify console
  ☐ Verify frontend loads and calls the API

Emails (optional)
  ☐ Verify sender email in SES
  ☐ Build sendConfirmationEmail Lambda
  ☐ Subscribe Lambda to SNS topic

Monitoring
  ☐ Add OpsAlertTopic to template.yaml
  ☐ Wire CloudWatch alarms to SNS email notifications

Security
  ☐ Scope down IAM policy for GitHub Actions user
  ☐ Restrict CORS AllowOrigin to Amplify domain

Custom domain (optional)
  ☐ Configure custom domain in Amplify
  ☐ Update CORS in template.yaml
```
