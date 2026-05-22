# Prisma + PostgreSQL Quick Start

## 1) Install dependencies

npm install prisma @prisma/client
npm install -D ts-node

## 2) Initialize and generate

npx prisma generate

## 3) Run first migration

npx prisma migrate dev --name init_softturn

## 4) Apply migrations in production

npx prisma migrate deploy

## 5) Seed initial data

npm run prisma:seed

## 6) Open Prisma Studio

npx prisma studio
