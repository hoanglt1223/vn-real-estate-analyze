# VN Real Estate Analyze — Project Rules (pnpm 10, Vite 7, Vercel Serverless)

## Goals

- Migrate to `pnpm@10` as the package manager
- Upgrade frontend tooling to `Vite 7`
- Migrate Express REST API to Vercel Serverless functions (`api/**`)
- Operate local-first with no database dependency (ephemeral serverless runtime)

---

## Project Structure

- Client root is `client` with Vite config resolving aliases
  - `vite.config.ts:17` sets `@` to `client/src`
  - `vite.config.ts:24` sets `root` to `client`
  - `vite.config.ts:26` outputs to `dist/public` (matches Vercel `outputDirectory`)
- Server currently runs Express with middleware dev integration
  - `server/index.ts:63` enables Vite middlewares in development
  - `server/vite.ts:69` serves static assets in production from `dist/public`
- Shared types and schema live under `shared` (drizzle types present but optional)
  - `shared/schema.ts:19` defines `propertyAnalyses`

---

## Package Manager & Node Rules

- Use `pnpm@10.x` and record it in `package.json` via `packageManager: "pnpm@10.x"`
- Prefer Node.js `>=20` locally; Vercel uses Node 18/20 depending on runtime
- Lockfile must be committed; installs use `pnpm install --frozen-lockfile`
- Disallow `npm` and `yarn` in CI/Deploy

---

## Scripts & Tooling (Vite 7)

- Frontend development runs with Vite 7
  - Add `dev:client: vite dev`
- Build artifacts
  - Add `build:client: vite build`
  - Add `build:vercel: vite build` (used by `vercel.json:21`)
- Preview static
  - Add `start:client: vite preview --outDir dist/public`
- Express-specific build remains only for local legacy mode
  - Current `package.json:6-12` bundles `server/index.ts` via esbuild; deprecate for serverless deploys

---

## Serverless API Migration Rules

- Each Express endpoint becomes a standalone file under `api/**`
- Map endpoints using current Express definitions in `server/routes.ts`
  - `POST /api/analyze-property` → `api/analyze-property.ts`
  - `GET /api/analysis/[id]` → `api/analysis/[id].ts`
  - `GET /api/recent-analyses` → `api/recent-analyses.ts`
  - `GET /api/properties` → `api/properties.ts`
  - `PUT /api/properties/[id]` → `api/properties/[id].ts`
  - `DELETE /api/properties/[id]` → `api/properties/[id].ts`
  - `GET /api/locations/search` → `api/locations/search.ts`
  - `POST /api/locations/geocode` → `api/locations/geocode.ts`
- Handler signature for Node functions
  - Default export async function `(req, res)` for `@vercel/node`
  - Parse JSON body safely; validate with `zod` like in `server/routes.ts:11-17`
- Reuse pure service modules from `server/services/**`
  - `calculatePropertyMetrics` and `assessRisks` remain unchanged
  - `fetchAmenities`, `fetchInfrastructure`, `scrapeMarketPrices`, `analyzeProperty`
- Avoid Express-only middleware and `setupVite` in serverless
  - Dev-only Vite middleware (`server/vite.ts`) is not used on Vercel

---

## Local-First Data Rules (No DB)

- Do not set `DATABASE_URL` in Vercel; use in-memory paths
  - `server/storage.ts:181` selects `MemStorage` when `DATABASE_URL` is unset
- Ephemeral runtime: do not rely on server-side persistence
  - Remove or gate calls to `storage.createPropertyAnalysis` on serverless
  - Let the client own persistence via Local Storage/IndexedDB + React Query cache
- Caching
  - Favor client-side caching with TanStack Query
  - If server response caching is added, use stateless HTTP cache headers; no file writes on Vercel
- Drizzle ORM is optional; keep it disabled in serverless
  - `server/db.ts:8` throws when `DATABASE_URL` is missing; do not import in functions
  - Gate imports behind runtime checks or use a serverless-only `MemStorage`

---

## Validation & Types

- Continue using `zod` for request validation
  - Example schema `server/routes.ts:11-17`
- Maintain shared types in `shared` and import with Vite aliases
  - `tsconfig.json:17-21` defines `paths` for `@` and `@shared`

---

## Vercel Deployment Rules

- `vercel.json` drives routing and build
  - `vercel.json:1-4` sets version and function config
  - `vercel.json:21` uses `buildCommand: pnpm run build:vercel`
  - `vercel.json:23` sets `outputDirectory: dist/public`
- Ensure `api/**` exists; Vercel automatically builds Node functions from those files
- Use environment variables only for external APIs (Mapbox, OpenAI)
  - Do not commit secrets; configure in Vercel Project Settings

---

## Migration Checklist

1. Add `"packageManager": "pnpm@10.x"` to `package.json`
2. Upgrade `vite` to `^7.x` and `@vitejs/plugin-react` compatible version
3. Add scripts: `dev:client`, `build:client`, `build:vercel`, `start:client`
4. Create `api/**` files to mirror Express endpoints; copy handler logic from `server/routes.ts`
5. Remove Express-only dev middleware from serverless deploy path
6. Ensure no `drizzle` imports in serverless functions; rely on `MemStorage` or client persistence
7. Verify `dist/public` is produced by `vite build` and served by Vercel
8. Configure required env vars in Vercel (Mapbox, OpenAI) without database

---

## Developer Workflow

- Local client dev: `pnpm dev:client`
- Local Express dev (legacy): `pnpm dev` (runs `tsx server/index.ts` per `package.json:6`)
- Build for deploy: `pnpm build:vercel`
- Preview static build locally: `pnpm start:client`

---

## Notes

- Keep `client` + `shared` pure/portable; serverless functions should import only pure services
- Replit-specific plugins in `vite.config.ts` are gated by `NODE_ENV !== "production"`; preserve gating but ensure Vite 7 compatibility
