# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev      # Dev server → http://localhost:8080
bun run build    # Production build
bun run lint     # ESLint
```

> Use `bun` (not npm) — the project has `bun.lock` and npm has peer-dep conflicts with `react-day-picker` + `date-fns@4`.

## Stack

- **React 18 + Vite 5 + TypeScript**
- **React Router v6** — SPA routing via `src/App.tsx`
- **Tailwind CSS v3 + shadcn/ui** (Radix-based, standard `asChild` pattern)
- **Supabase** (`@supabase/supabase-js`) — client at `src/integrations/supabase/client.ts`, generated types at `src/integrations/supabase/types.ts`
- **TanStack Query v5** — all data fetching
- **react-hook-form + zod** — forms and validation
- **@dnd-kit** — drag-and-drop (deal variants, pipeline)
- **html2pdf.js + pdfjs-dist** — PDF generation and display

## Project Structure

```
src/
  App.tsx                        # All routes defined here
  pages/                         # One file per route/page
  components/                    # Feature components + ui/ (shadcn)
    dashboard/                   # Dashboard widget cards
    statistics/                  # Stats charts and tables
    ui/                          # shadcn/ui primitives
  hooks/                         # Custom hooks
  integrations/supabase/         # Supabase client + generated types
  lib/                           # Pure utilities (pricing, PDF, phone, SPAYD, etc.)
  assets/                        # Logos, images
```

## Key Domain Concepts

- **Deal** — central entity; has services (flights, hotels, golf), variants (price options), travellers, payments, documents, contracts, vouchers
- **Voucher** — travel voucher generated from a deal; PDF-exportable
- **Contract** — client contract with digital signature (`SignContract` public page)
- **Public pages** — `/offer/:token`, `/hotels`, `/hotel/:id`, `/accounting/:token` — unauthenticated, shareable links

## Auth & Permissions

- Auth via Supabase Auth (email/password + MFA)
- `useAuth` hook (`src/hooks/useAuth.tsx`) — session state
- `useUserRole` / `useUserPermissions` — role-based access
- `ProtectedRoute` wraps authenticated pages
- `useDataScope` — filters data by user/agency scope

## Supabase

- URL and keys in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`)
- Always use the typed client from `src/integrations/supabase/client.ts`
- Types are auto-generated — do not edit `src/integrations/supabase/types.ts` by hand

## Important Utilities

| File | Purpose |
|------|---------|
| `src/lib/servicePrice.ts` | Price calculation per service type |
| `src/lib/voucherPdfBuilder.ts` | Voucher PDF assembly |
| `src/lib/spayd.ts` | Czech SPAYD payment QR string |
| `src/lib/supplierDuplicates.ts` | Duplicate supplier detection |
| `src/lib/imageCompression.ts` | Client-side image compression before upload |
