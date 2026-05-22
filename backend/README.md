# SoftTurn Backend (NestJS + PostgreSQL)

This folder contains starter backend assets for SoftTurn.

## Stack

- NestJS (application layer)
- PostgreSQL (primary database)
- Prisma ORM

## Important

- PostgreSQL is the source database for all environments.
- Prisma schema is the source of truth for data model.
- SQL file in `sql/` contains recommended indexes and tuning helpers.

## Next Steps

1. Initialize NestJS project (`npm init -y` and install Nest deps).
2. Install Prisma and generate client.
3. Set `DATABASE_URL` for PostgreSQL.
4. Run first migration from `prisma/schema.prisma`.
5. Start implementing services/controllers based on `OPENAPI_DRAFT_SOFTTURN.yaml`.

## Implemented Sprint 1 Scope

- Auth endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- Users endpoints: list/create/update/deactivate/reset-password
- Workplaces and shifts: `GET /api/v1/workplaces/my-available`, `POST /api/v1/operator-shifts/start`, `POST /api/v1/operator-shifts/end`
- Tickets flow: create/list/current/next/start/complete/cancel/redirect/events
- Notifications: templates CRUD, delivery logs, provider test send, ticket-triggered sends (Viber -> SMS fallback)
- Display: public queue payload, display settings read/update, TTS test endpoint
- Analytics: KPI summary, dashboard, waiting/service time, operators rating, export dataset
- Audit: `GET /api/v1/audit`, `GET /api/v1/audit/entity/:entityType/:entityId`

## Local Run

1. Copy `.env.example` to `.env` and set PostgreSQL credentials.
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npx prisma migrate dev --name init_softturn`
5. Start app in dev mode: `npm run start:dev`

## Tests

- Run unit tests: `npm run test`

## Manual API Verification

- Use [SMOKE_TEST.md](SMOKE_TEST.md) for end-to-end API smoke flow.

## Auth for Protected Endpoints

Protected endpoints require bearer token:
- `Authorization: Bearer <accessToken>`

Get access token via:
- `POST /api/v1/auth/login`
