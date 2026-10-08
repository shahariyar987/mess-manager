# Messmate

Messmate is a responsive Next.js + TypeScript dashboard for running a shared household mess. It includes member and admin workflows for meal logging, expense tracking, balances, and monthly snapshots.

## Run locally

Requirements: Node.js 18.17+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app starts with zero members, expenses, meals, bills, and balances. Local login uses the two fixed demo admins `Akaba` / `akaba` and `Shahariyar` / `shahariyar@37`. Admins register normal member accounts and set their room rents; members cannot edit rent. Local mode persists accounts, member records, daily meal logs, settings, community messages/rules, bills, requests, and the all-time commodity ledger in browser `localStorage`.

## Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Add production RLS policies for your membership model before enabling real writes. The schema separates messes, members, meals, expenses, and immutable monthly snapshots and is designed for Supabase Auth user IDs.

If Supabase variables are not configured, local browser mode is used so the complete workflow remains runnable. Local mode is suitable for evaluation or a single browser only; it is not a secure multi-device authentication system. For production, enable Supabase Auth and replace the local persistence calls with Supabase queries using the provided RLS schema.

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
- Monthly close-ready snapshot schema for storing calculated totals. Close a month after entering maid, electricity, Wi-Fi, and gas in `shared_bills`; the per-meal rate is `commodity cost / total approved meals`. Each person's final payable amount is `(consumed meals × meal rate) − that person's commodity contribution + room rent + (shared bills / people)`. Contributions are derived from ledger expenses recorded by that member, and the final snapshot/member cards display the contribution explicitly. Snapshots store the due date (the 10th of the following month) so closed months remain immutable for reporting.
- Supabase schema includes member IDs/rent, the 2.5-meal default, member meal-adjustment requests with admin approval states, commodity expenses, shared bills, monthly snapshots, and membership/admin RLS policies.
- Registration and login are available immediately in local mode. The fixed admin credentials are demo-only and must be replaced with secure Supabase Auth before public deployment. Admins can register member usernames/passwords and edit member rents; member accounts are never granted rent-editing controls. Every commodity record is retained in the all-time ledger and can be filtered by year.
- The Meals page is an admin-editable daily log-book for every member/admin with month navigation and consistent monthly totals; members receive a read-only view.
- Settings saves local currency, notification, and table-density preferences. Help center includes workflow FAQs and support guidance.
- Notice & community provides a persisted group chat for all signed-in users. Admins can pin one message and add/delete shared mess rules; everyone can view them.
- Settings includes a local password-change flow requiring the current password, a matching new-password confirmation, and persisted success/error feedback. Members includes a confirmed admin-only delete action; fixed admins and the current admin cannot be deleted, and a deletion removes that member's local account, member record, meal logs, and requests.
- Meals opens on the current calendar month by default. Selecting another month shows its archived log-book while preserving prior/future month data and calculations.

## Operating rules

The app starts empty rather than seeding demo values. Members start at a zero consumed-meal balance; the configured 2.5 default is used when meal logging is connected to production data. Expenses must include a commodity name and date so the all-time ledger can be audited. Before closing, enter all shared bills and take a snapshot; do not edit a closed snapshot.
