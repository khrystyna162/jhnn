# SoftTurn Backend Smoke Test

This guide verifies the core workflow against local API.

## 0) Prerequisites

1. Start PostgreSQL and set `DATABASE_URL` in `.env`.
2. Run migrations:

```bash
npx prisma migrate dev --name init_softturn
```

3. Seed initial data:

```bash
npm run prisma:seed
```

4. Start backend:

```bash
npm run start:dev
```

Base URL used below: `http://localhost:3000/api/v1`

## 1) Login as sysadmin

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"sysadmin@softturn.local","password":"Admin12345"}'
```

Save `accessToken` from response.

## 2) List organization tree

```bash
curl -s http://localhost:3000/api/v1/org/tree \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

Copy existing `branchId` from tree.

## 3) List available workplaces

```bash
curl -s http://localhost:3000/api/v1/workplaces/my-available \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

Copy `workplaceId`.

## 4) Start operator shift

```bash
curl -s -X POST http://localhost:3000/api/v1/operator-shifts/start \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"workplaceId":"<WORKPLACE_ID>"}'
```

## 5) Get available services for branch

```bash
curl -s "http://localhost:3000/api/v1/services/available-for-branch?branchId=<BRANCH_ID>" \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

Copy `serviceId`.

## 6) Create ticket

```bash
curl -s -X POST http://localhost:3000/api/v1/tickets \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"branchId":"<BRANCH_ID>","serviceTypeId":"<SERVICE_ID>","phone":"+380501112233","clientName":"Test Client"}'
```

Copy `ticketId` and `number`.

## 7) Get next ticket (FIFO)

```bash
curl -s -X POST http://localhost:3000/api/v1/tickets/next \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## 8) Start service

```bash
curl -s -X POST http://localhost:3000/api/v1/tickets/<TICKET_ID>/start \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## 9) Complete service

```bash
curl -s -X POST http://localhost:3000/api/v1/tickets/<TICKET_ID>/complete \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## 10) Verify ticket timeline

```bash
curl -s http://localhost:3000/api/v1/tickets/<TICKET_ID>/events \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

Expected event sequence includes: `CREATED`, `CALLED`, `STARTED`, `COMPLETED`.

## 11) Verify notification status

```bash
curl -s http://localhost:3000/api/v1/notifications/<TICKET_ID>/status \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

In `mock` mode, Viber may fail for numbers ending with `0`, then SMS fallback should appear.

## 12) Switch notification provider mode

```bash
curl -s -X POST http://localhost:3000/api/v1/system/notification-provider/switch \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"mode":"mock"}'
```
