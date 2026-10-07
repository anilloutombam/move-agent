# Move Desk

Move Desk is a prototype move-in and move-out workflow for residential communities. Residents create requests through a conversational interface, the request is checked against community-specific policies, and an administrator reviews the submitted request.

**Live demo:** [Move Desk](https://web-two-self-q0689vup1t.vercel.app/login)

## What it does

- Resident and admin workflows
- Move-in and move-out request creation
- Natural-language information collection
- Community-specific, versioned policy checks
- Slot availability checks
- Explicit confirmation before request submission
- Admin approval, rejection, and requests for more information
- Role-based API authorization
- Request history and audit events

The LLM is used for understanding user messages and choosing from a restricted set of tools. Authorization, policy validation, state transitions, confirmation checks, and persistence are handled by the backend rather than delegated to the model.

## Tech stack

**Frontend**
- Next.js
- React
- TypeScript

**Backend**
- Fastify
- TypeScript
- Zod
- JWT

**Data**
- PostgreSQL
- Prisma

**LLM**
- Groq
- Deterministic mock provider

## Local setup

### Requirements

- Node.js 22+
- pnpm
- Docker Desktop or PostgreSQL

Clone the repository and install dependencies:

```bash
git clone https://github.com/anilloutombam/move-agent.git
cd move-agent
pnpm install
```

Start PostgreSQL:

```bash
docker compose up -d
```

Create the API environment file:

```bash
cp api/.env.example api/.env
```

Run migrations and seed the database:

```bash
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma db seed
```

Start the API:

```bash
pnpm dev:api
```

Start the web app in another terminal:

```bash
pnpm dev:web
```

The web app runs at:

```text
http://localhost:3000
```

API health check:

```text
http://localhost:4000/health
```

## Demo accounts

Authentication is email-only for the prototype.

| Role | Email |
| --- | --- |
| Resident | `demo@demo.com` |
| Admin | `admin@admin.com` |

## LLM configuration

The project runs without an external LLM by default.

```env
LLM_PROVIDER=mock
LLM_MODEL=deterministic-mock-v1
```

To use Groq for the natural-language flow, update `api/.env`:

```env
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=your-key
```

Restart the API after changing the provider.

Do not commit `api/.env` or API keys.

## Demo walkthrough

1. Continue as **Resident** and start a new conversation.
2. Choose a date at least three days from today.
3. Send:

   > I want to move in on YYYY-MM-DD at 10:00. I need the elevator and I have a driving licence as identity proof.

4. Review the information collected by the assistant.
5. Send:

   > confirm submit

6. Sign out and continue as **Admin**.
7. Open the submitted request and start the review.
8. Approve, reject, or request more information.
9. Return as **Resident** and open the request from history to see the updated status.

## Policy configuration

Community policies are stored as versioned database records. They define things such as:

- Notice period
- Moving hours
- Required documents
- Elevator requirements
- Slot capacity
- Admin approval requirements

A request keeps the policy version that was active when it was created. A later policy change therefore does not change the rules used for an existing request.

Policies are seeded for this prototype. Policy management through the UI is not implemented.

## Request lifecycle

```text
DRAFT
  -> COLLECTING_INFORMATION
  -> READY_TO_SUBMIT
  -> SUBMITTED
  -> UNDER_REVIEW
       -> APPROVED
       -> REJECTED
       -> INFO_REQUESTED
            -> UNDER_REVIEW
```

The API only accepts valid role-specific transitions.

Request submission and administrative decisions require explicit confirmation. The LLM cannot directly change request status or bypass these checks.

## Validation

Type-check the API:

```bash
pnpm --filter api typecheck
```

Run API tests:

```bash
pnpm --filter api test
```

Lint the web app:

```bash
pnpm --filter web lint
```

Build the web app:

```bash
pnpm --filter web exec next build --webpack
```

## Prototype limitations

- Authentication is email-only and is intended for the demo.
- Documents are represented by document types; binary file upload and storage are not implemented.
- Community policies are seeded rather than managed through the UI.
- Email, SMS, and push notifications are not implemented.
- Groq free-tier requests may be rate-limited.
- Production use would require stronger authentication, secret management, monitoring, durable document storage, and production infrastructure.