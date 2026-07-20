# Summit Registration & Check-in System

Production-ready registration, check-in, and badge-printing system for the
**National Banking College Summit**. Built on TanStack Start, React 19,
Tailwind v4, shadcn/ui, and Lovable Cloud (Supabase).

## Features

- **Public landing** with hero, about, event details, and CTA
- **Public registration** with unique auto-generated numbers (`SUMMIT-0001`)
  and a success page
- **Coordinator console** (protected) with:
  - **Dashboard** — live stats (total, checked-in, pending, walk-ins, today) + recent activity
  - **Participants** — searchable, sortable, filterable table with print / edit / delete
  - **Walk-in registration** — fast reception form → badge in one click
  - **Check-in** — distraction-free search / open / check-in / print
  - **Badge preview + printing** — 100 × 60 mm landscape (XPrinter XP-DT427B), print CSS, react-to-print
  - **Reports** — Attendance / Registration / Walk-in exports as CSV, Excel, PDF
  - **Staff management** — admin creates staff, assigns roles, disables accounts, sends password resets
  - **Event settings** — event name, date, venue, logo URL, brand colours, registration open flag, badge options
  - **Audit log** — every important action captured
- **Role-Based Access Control** — `admin`, `registration_officer`, `checkin_officer`
- Row-Level Security on every table
- Responsive, animated, accessible, dark-mode ready

## First administrator

The **first user to sign up** on `/auth` automatically becomes the
administrator (via a database trigger on `auth.users`). Additional staff
are created from **Staff → Add staff** by that administrator, with a
temporary password and role.

## Environment variables

Managed automatically by Lovable Cloud (already populated in `.env`):

- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by staff-management server functions

## Badge printing (XPrinter XP-DT427B)

The badge is exactly **100 mm × 60 mm landscape**. In Chrome:

1. Open a badge preview and click **Print badge**.
2. Set paper size to **100mm × 60mm landscape** in the print dialog.
3. Set margins to **None**.
4. **Uncheck** "Headers and footers".
5. Select your XPrinter XP-DT427B as the destination.

The dedicated print CSS (`src/styles.css`) enforces `@page { size: 100mm 60mm landscape; margin: 0 }`
and hides all non-badge content.

## Deployment

The app targets Cloudflare Workers via TanStack Start. To publish, use the
Lovable **Publish** button. If deploying to Vercel:

```
bun install
bun run build
```

Set the same env vars above in your host. The service-role key must remain
server-only — never expose it to the client.

## Security notes

- Every protected route sits under `_authenticated/` and is gated client-side
  by `supabase.auth.getUser()`; every write is additionally guarded by RLS.
- Public registration only works when `event_settings.registration_open` is true,
  and only `online` rows with no staff fields can be inserted by anon.
- Roles are stored in `public.user_roles`, checked via `has_role()` SECURITY DEFINER — never on `profiles`.
- Client & server both validate input with Zod.

## Project structure

```
src/
  routes/             file-based routes (public + _authenticated/)
  components/         reusable UI: app-shell, site-chrome, participant-badge, logo, ui/*
  lib/
    hooks/use-auth.ts session + role hooks
    audit.ts          audit-log helper
    staff.functions.ts createServerFn admin actions
  integrations/supabase/  auto-generated cloud clients
  assets/logo.png     event crest (uploaded)
  styles.css          design tokens + print CSS
```
