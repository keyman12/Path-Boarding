# Path Boarding Frontend (Next.js)

Next.js App Router frontend for merchant boarding with Path branding (section 8 of plan).

## Setup

```bash
npm install
```

**Local (Mac) development:** Copy `.env.example` to `.env.local` (or create `.env.local` with):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For **AWS deployment** (same-origin, no CORS), see [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```

## Structure

- `app/` – App Router: `layout.tsx`, `page.tsx`, `board/[token]/` (boarding flow placeholder), `globals.css` (Path design tokens).
- `components/` – Reusable components (breadcrumb, steps to be added).
- `lib/api.ts` – API client for backend.
- `lib/design-tokens.ts` – Path colours and typography.
- `public/logo-path.png` – Path logo (from Path Design).

Path brand: primary green `#297D2D`, secondary red/coral `#FF5252`, Poppins (headings), Roboto (body). See plan section 8 and `Path Design/Path Brand Guidelines.png`.
