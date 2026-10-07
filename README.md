# Move Desk

Move Desk is a prototype move-in and move-out workflow for residential communities. Residents create requests through a conversational interface. A deterministic policy engine validates each request, and an administrator reviews and acts on submitted requests.

## What the prototype covers

- Resident and administrator experiences
- Move-in and move-out request creation
- Natural-language information collection
- Community-specific, versioned policy checks
- Explicit confirmation before submission and administrative decisions
- Role-scoped agent tools and API authorization
- Request history and audit events
- Approval, rejection, and requests for more information

The LLM interprets natural language and selects allowed tools. Authorization, policy decisions, state transitions, confirmation checks, and persistence are handled by backend code.

## Technology

- Next.js App Router, React, and TypeScript
- Fastify, TypeScript, and Zod
- PostgreSQL and Prisma
- Groq or a deterministic mock LLM provider
- JWT authentication with `RESIDENT` and `ADMIN` roles

## Local setup

Requirements:

- Node.js 22 or later
- pnpm
- Docker Desktop, or a local PostgreSQL instance

Install dependencies and prepare the database:

```bash
pnpm install
docker compose up -d
cp api/.env.example api/.env
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma db seed
```

Start the API and web app in separate terminals:

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000). The API health endpoint is [http://localhost:4000/health](http://localhost:4000/health).

## Demo accounts

Authentication is email-only in this prototype.

| Role | Email |
| --- | --- |
| Resident | `demo@demo.com` |
| Administrator | `admin@admin.com` |

## LLM configuration

The default configuration does not require an API key:

```env
LLM_PROVIDER=mock
LLM_MODEL=deterministic-mock-v1
```

For the full natural-language demonstration, set the following values in `api/.env`:

```env
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=your-key
```

Restart the API after changing the provider. Do not commit `api/.env` or a real API key. Groq free-tier accounts may return HTTP 429 when their rate limit is reached.

## Demo walkthrough

1. Continue as Resident and start a new conversation.
2. Choose a date at least three days from today, then send:

   > I want to move in on YYYY-MM-DD at 10:00. I need the elevator and I have a driving licence as identity proof.

3. Review the assistant's summary and send:

   > confirm submit

4. Sign out and continue as Admin.
5. Open the submitted request and start its review.
6. Approve or reject the request using the explicit confirmation requested by the assistant.
7. Return as Resident and open the request from history to see the decision.

## Policy configuration

Community policies are stored as versioned database records and seeded for this prototype. They define notice periods, moving hours, required documents, elevator requirements, and slot capacity. Requests retain the policy version used when they were created.

There is no policy-management screen in the prototype. In production, policy changes would use an administrator-only, audited publishing workflow.

## Request lifecycle

```text
Draft
  -> Collecting information
  -> Ready to submit
  -> Submitted
  -> Under review
  -> Approved / Rejected / Information requested
```

Only valid role-specific transitions are accepted. Sensitive actions require explicit confirmation in the current conversation turn.

## Validation

```bash
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter web lint
pnpm --filter web exec next build --webpack
```

## Prototype limitations

- Authentication is email-only and intended only for demonstration.
- Documents are recorded as declared document types; binary file upload and storage are not implemented.
- Policy configuration is seeded rather than managed through the UI.
- Notifications are shown through request status and audit history; email, SMS, and push delivery are not implemented.
- The Groq free tier can rate-limit requests.
- Production use would require stronger authentication, secret management, monitoring, and durable file storage.
