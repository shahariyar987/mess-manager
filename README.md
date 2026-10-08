# Messmate

Messmate is a responsive Next.js + TypeScript dashboard for running a shared household mess. It includes member and admin workflows for meal logging, expense tracking, balances, and monthly snapshots.

## Run locally

Requirements: Node.js 18.17+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The application ships with a polished local demo dataset, so it runs without any external service. Actions in the demo (adding expenses, logging meals, settling balances) update the local session state.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Add production RLS policies for your membership model before enabling real writes. The schema separates messes, members, meals, expenses, and immutable monthly snapshots and is designed for Supabase Auth user IDs.

The current UI intentionally keeps the demo fallback available when environment variables are not configured. A production integration can swap the local actions for Supabase queries without changing the workflows.

## Build and deploy

```bash
npm run build
npm run start
```

Deploy on Vercel by importing the repository and adding the two `NEXT_PUBLIC_SUPABASE_*` environment variables. No secrets are committed to this repository.

## Included workflows

- Responsive overview with spending trend, cost per meal, house balance, activity, and daily meal status.
- Meal calendar and breakfast/lunch/dinner logging.
- Expense ledger with categories and add-expense form.
- Member shares, balance settlement action, and admin/member roles in the database schema.
- Monthly close-ready snapshot schema for storing calculated totals. Close a month after entering maid, electricity, Wi-Fi, and gas in `shared_bills`; the per-meal rate is `commodity cost / total approved meals`, and each member's payable amount is `meals × rate + (shared bills / people) + room rent`. Snapshots store the due date (the 10th of the following month) so closed months remain immutable for reporting.
- Supabase schema includes member IDs/rent, the 2.5-meal default, member meal-adjustment requests with admin approval states, commodity expenses, shared bills, monthly snapshots, and membership/admin RLS policies.

## Operating rules

The demo uses the same calculation model as the production schema: admins are seeded as fixed household operators, members start at 2.5 meals/day, and adjustments are intended to be submitted by members and approved by an admin before a close. Expenses must include a commodity name and date so the monthly ledger can be audited. Before closing, enter all shared bills and take a snapshot; do not edit a closed snapshot.
