# Event Registration & Ticketing System

A serverless event registration and check-in system built on **AWS** with a **React/TanStack Start** frontend hosted on **AWS Amplify**.

## Architecture

```
GitHub (TerryBinful/event-with-me)
  │
  ├── GitHub Actions → SAM Deploy (backend/)
  └── AWS Amplify Hosting (frontend, auto-deploy on push)

AWS Stack (backend/template.yaml)
  ├── Cognito User Pool (auth + staff roles)
  ├── API Gateway REST API + Cognito Authorizer
  ├── Lambda Functions (Node.js 20)
  │     POST   /events
  │     GET    /events
  │     PUT    /events/{eventId}
  │     POST   /events/{eventId}/register      (public)
  │     GET    /events/{eventId}/registrations
  │     POST   /events/{eventId}/walk-in
  │     GET    /registrations/{email}
  │     PUT    /registrations/{id}
  │     DELETE /registrations/{id}
  │     POST   /registrations/{id}/checkin
  │     POST   /registrations/{id}/print
  │     GET    /audit
  ├── DynamoDB (Events, Registrations, AuditLogs)
  ├── SNS Topic (confirmation emails)
  ├── CloudWatch Alarms (error rate > 5%)
  └── AWS Budgets ($1/month free-tier alert)
```

## First-time setup

### 1. Deploy the backend

```bash
cd backend
npm install
sam build
sam deploy --guided
# Stack name: event-with-me-prod
# Region: <your-region>
# Confirm changes: Y
```

Note the outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`.

### 2. Create the first admin user

```bash
# Replace values with your own
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

### 3. Configure the frontend

Create `.env` from `.env.example` and fill in the SAM outputs:

```
VITE_API_URL=https://...execute-api...amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=...
VITE_COGNITO_CLIENT_ID=...
VITE_AWS_REGION=...
```

### 4. Connect Amplify Hosting

1. Go to **AWS Amplify Console → New app → Host web app**
2. Connect to GitHub repo `TerryBinful/event-with-me`, branch `main`
3. Amplify auto-detects `amplify.yml`
4. Add the 4 environment variables above in **App settings → Environment variables**
5. Deploy

### 5. Set up GitHub Actions secrets

In GitHub repo **Settings → Secrets → Actions**, add:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

The CI/CD pipeline (`.github/workflows/deploy.yml`) will:
- Run Lambda unit tests on every push/PR to `backend/`
- Build and deploy via SAM on push to `main`

## Cognito groups (roles)

| Group | Access |
|---|---|
| `Admin` | Full access — events, staff, reports, settings, audit |
| `RegistrationOfficer` | Walk-in registration, participants |
| `CheckinOfficer` | Check-in, walk-in (limited) |

## Running locally

```bash
npm install        # or: bun install
cp .env.example .env   # fill in your values
npm run dev        # starts at http://localhost:3000
```

## Badge printing (XPrinter XP-DT427B)

Badge is **100mm × 60mm landscape**. In Chrome print dialog:
1. Paper size: 100mm × 60mm landscape
2. Margins: None
3. Uncheck "Headers and footers"

## Project structure

```
backend/                  AWS SAM backend
  template.yaml           All AWS infrastructure
  events/                 Lambda: createEvent, listEvents, updateEvent
  registrations/          Lambda: register, list, checkIn, walkIn, delete, print, audit
  shared/                 db.mjs, response.mjs, ids.mjs, auth.mjs
  __tests__/              Jest unit tests

src/
  lib/
    api-client.ts         All API calls (replaces Supabase)
    auth/cognito-client.ts Cognito sign-in/out/session
    hooks/use-auth.ts     Cognito session + role hooks
  routes/                 TanStack file-based routes
  components/             UI components

.github/workflows/
  deploy.yml              CI/CD: test → SAM build → SAM deploy

amplify.yml               Amplify Hosting build config
```
