# Soufflé Bakery Studio

A full-stack operations MVP for a Japanese cheesecake bakery. It includes a responsive Next.js console, REST API routes, and a local SQLite database seeded with demo data on first run.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The database is created at `data/souffle.sqlite` the first time an API route is used. Set `SOUFFLE_DB_PATH` to choose another location and set `SESSION_SECRET` to a long random value outside local demos.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Manager | `manager@souffle.jp` | `souffle2026` |
| Employee | `employee@souffle.jp` | `souffle2026` |
| Customer | `customer@souffle.jp` | `souffle2026` |

Demo passwords are intentionally public and must not be reused in a deployed environment. Employee passwords are stored as scrypt hashes. Sessions use signed, HTTP-only cookies.

## Modules

- Orders: custom cake lines, special instructions, confirmation codes, order status, customer tracking, and promotion discounts.
- Payments: cash change calculation, simulated card authorization, duplicate-payment protection, and receipt generation.
- Employees: profiles, accounts, schedules, and paycheck records; managers can create and deactivate accounts.
- Inventory: quantity updates, manager-controlled reorder thresholds, and low-stock alerts.
- Promotions: draft/share lifecycle, edit/delete, and order discounts.
- Reports: date-filtered sales, inventory and loyalty metrics, daily sales, best sellers, browser print-to-PDF, and CSV export.

## REST API

All endpoints except login require a signed-in account. Manager-only endpoints return `403` for other roles.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Sign in with email/password |
| `GET`, `DELETE` | `/api/auth/session` | Read or clear current session |
| `GET` | `/api/dashboard` | Role-filtered console data |
| `GET`, `POST` | `/api/orders` | List or create orders |
| `PATCH` | `/api/orders/:id` | Update order status / request cancellation |
| `GET`, `POST` | `/api/payments` | List payments or pay an order; returns receipt |
| `GET`, `PATCH` | `/api/inventory` | Read or update stock quantities |
| `GET`, `POST` | `/api/promotions` | List or create promotions |
| `PATCH`, `DELETE` | `/api/promotions/:id` | Share, draft, edit, or delete |
| `GET`, `POST` | `/api/employees` | List staff or create an account |
| `GET`, `PATCH`, `DELETE` | `/api/employees/:id` | View profile/payroll, update, or deactivate |
| `GET` | `/api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | Date-filtered manager report; add `format=csv` to export |

## Notes

- Card payment is a local demo authorization only. No card details are collected or sent to a payment processor.
- This MVP uses a single local SQLite file and one seeded flagship store. It is not configured for serverless or multi-store production deployment.
- Loyalty points are issued after successful payment at one point per ¥100. Redemption tracking is represented in the reporting model but is not exposed as a checkout workflow yet.
- Validate with `npm run build` and `npm run lint`.