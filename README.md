# DukaanHub API

NestJS backend for the DukaanHub Expo app. It mirrors the app's Supabase-shaped
domain (snake_case fields and lowercase enums) so the mobile client can switch
from mock/Supabase data to this API with minimal mapping.

- **Stack:** NestJS 11, Prisma 6, PostgreSQL, Passport JWT, Socket.IO, Swagger
- **Base URL:** `http://localhost:4000/api/v1`
- **Swagger UI:** `http://localhost:4000/docs`

## Requirements

- Node.js **>= 20.11** (`.nvmrc` pins the tested 22.14.0)
- PostgreSQL **14+**
- npm 9+

## Quick start

```bash
cd DukaanHub-Backend
cp .env.example .env          # then edit DATABASE_URL + JWT secrets
npm install
docker compose up -d db       # or point DATABASE_URL at your own Postgres
npm run prisma:migrate        # create the schema
npm run db:seed               # demo users, storefronts, products, coupons, ads
npm run start:dev
```

`npm install` runs `prisma generate` automatically.

### Demo accounts

Password for every seeded account: `Password123!`

| Role   | Email                    |
| ------ | ------------------------ |
| admin  | `admin@dukaanhub.local`  |
| seller | `seller@dukaanhub.local` |
| seller | `seller2@dukaanhub.local`|
| seller | `seller3@dukaanhub.local`|
| buyer  | `buyer@dukaanhub.local`  |
| buyer  | `buyer2@dukaanhub.local` |

## Environment

See [`.env.example`](./.env.example) for every variable.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (min 16 chars) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Token lifetimes (`15m`, `7d`) |
| `CORS_ORIGINS` | Comma-separated origins, or `*` |
| `PUBLIC_BASE_URL` | Prefix used for uploaded file URLs |
| `UPLOAD_DIR` | Local upload directory (served at `/uploads`) |
| `MAX_UPLOAD_MB` | Maximum upload size |
| `PAYMENT_WEBHOOK_SECRET` | HMAC secret for `POST /payments/webhook` |
| `PAYMENTS_AUTO_CONFIRM` | Allow buyers to self-confirm internal payments |
| `FREE_DELIVERY_THRESHOLD` / `DELIVERY_FEE` / `HANDLING_FEE` | Order pricing |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Rate limit window (seconds) and request count |

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint (TypeScript) |
| `npm test` | Unit tests (Jest) |
| `npm run test:e2e` | End-to-end tests (no database required) |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:deploy` | Apply migrations in production |
| `npm run prisma:studio` | Browse data |
| `npm run db:push` | Push schema without a migration |
| `npm run db:seed` | Run `prisma/seed.ts` |

## API overview

All routes are prefixed with `/api/v1`. Protected routes use
`Authorization: Bearer <accessToken>`. List endpoints return:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 }
}
```

### Auth (`/auth`)

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password, phone? }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/refresh` | `{ refreshToken }` — rotates the token |
| POST | `/auth/logout` | Revokes a refresh token |
| GET | `/auth/me` | Current user |

### Users (`/users`)

`GET /users/me`, `PATCH /users/me`.

### Businesses (`/businesses`)

`GET /businesses` (search, category, featured, sort), `GET /businesses/trending`,
`GET /businesses/mine`, `GET /businesses/slug/:slug`, `GET /businesses/:id`,
`POST /businesses` (promotes buyer → seller), `PATCH /businesses/:id`,
`DELETE /businesses/:id` (owner/admin).

### Categories (`/categories`)

`GET /categories`, `GET /categories/tree`, `GET /categories/:id`; admin CRUD.

### Products

`GET /businesses/:business_id/products`, `GET /products/:id`,
`GET /businesses/:business_id/products/manage`, `POST /businesses/:business_id/products`,
`PATCH /products/:id`, `PATCH /products/:id/stock`, `DELETE /products/:id`.

### Orders (`/orders`)

`POST /orders` (prices and totals are computed server-side), `GET /orders`
(buyer's orders), `GET /orders/seller` (orders across the seller's businesses),
`GET /orders/:id`, `PATCH /orders/:id/status`, `POST /orders/:id/cancel`.

Status flow: `pending → confirmed → processing → shipped → delivered`, with
cancellation allowed from `pending`, `confirmed` and `processing`.

### Payments (`/orders/:order_id/payments`)

| Method | Route | Notes |
| --- | --- | --- |
| POST | `/intent` | Create an internal payment intent (returns UPI URI for `upi`) |
| POST | `/confirm` | Seller confirms external payments; buyer only when `PAYMENTS_AUTO_CONFIRM=true` |
| GET | `/` | List attempts (buyer, seller or admin) |

Webhook: `POST /payments/webhook` with header
`x-dukaanhub-signature: sha256=<hmac>` over the raw JSON body and secret
`PAYMENT_WEBHOOK_SECRET`. Body:
`{ "reference": "...", "status": "paid" | "failed" | "refunded" }`.

### Chat (`/orders/:order_id/messages`)

Chat is scoped to an order and accessible to the buyer, the storefront owner and
admins. Supports text, images, replies, mentions and priority flags. New messages
are broadcast over Socket.IO and as notifications.

### Pages (`/pages`)

Public: `GET /businesses/:business_id/pages`,
`GET /businesses/:business_id/pages/:slug`.

Owner/admin: `GET /businesses/:business_id/pages/manage`,
`POST /businesses/:business_id/pages`, `GET /pages/:id`, `PATCH /pages/:id`,
`DELETE /pages/:id`.

### Ads (`/ads`)

Public: `GET /ads?placement=home|business|search|carousel`, `GET /ads/:id`.
Owner/admin: `GET /ads/mine`, `POST /ads`, `PATCH /ads/:id`, `DELETE /ads/:id`.
Storefront owners can only manage ads for their own business; only admins can
create platform-wide ads (no `business_id`).

### Uploads (`/uploads`)

`POST /uploads` (multipart field `file`) and `POST /uploads/multiple`
(field `files`, up to 10). Images (`jpeg`, `png`, `webp`, `gif`, `avif`) and PDFs
are accepted. Files are written to `UPLOAD_DIR` and served from `/uploads/...`.

### Health

`GET /health` (under the `/api/v1` prefix) is public and returns
`status: ok|degraded` plus database state. The process starts even when
PostgreSQL is unavailable so tooling and health checks still work.

## Realtime (Socket.IO)

Connect to the server root with an optional access token:

```ts
io('http://localhost:4000', { auth: { token: accessToken } });
```

Rooms: `user:<id>`, `business:<id>`, `order:<id>` and `public`.

Client → server: `business:join`, `business:leave`, `order:join`, `order:leave`,
`chat:typing`.

Server → client: `order:update`, `business:update`, `product:stock`,
`notification:new`, `chat:message`, `chat:typing`, `authenticated`.

## Data model

Prisma models live in [`prisma/schema.prisma`](./prisma/schema.prisma):
`User`, `RefreshToken`, `Business`, `Category`, `Product`, `Order`, `OrderItem`,
`Payment`, `ChatMessage`, `BusinessPage`, `Ad`, `Coupon`.

Money is stored as `Decimal(12, 2)` and serialized to plain numbers in API
responses. Prices and order totals are always calculated on the server.

## Production notes

- Replace local disk uploads with S3/Supabase Storage by swapping
  `UploadsService.save`.
- Set strong JWT and webhook secrets; never reuse the example values.
- Run `npm run prisma:deploy` before starting the API.
- The included `Dockerfile` builds the app and runs migrations on boot;
  `docker-compose.yml` provisions PostgreSQL and a persistent upload volume.

## License

MIT — see [`LICENSE`](./LICENSE).
