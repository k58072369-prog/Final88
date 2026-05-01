# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Gemini AI via Replit AI Integrations (`@workspace/integrations-gemini-ai`)

## Applications

### Exam Night Review (`artifacts/exam-review`)
- **Purpose**: Interactive Arabic biology exam review app for Second Year Azhar students
- **Name**: مراجعة ليلة الامتحان – الثانية الأزهرية
- **Features**:
  - Full Arabic RTL interface with Tajawal font
  - PDF question extraction using Gemini vision AI (scanned PDF → questions)
  - Animated welcome modal with teacher image
  - Interactive exam interface with progress bar, card animations
  - Score/result screen with motivational messages
  - PWA support (manifest.json + service worker)
  - Footer: "تم التطوير بواسطة المبرمج أضم أيمن"

### API Server (`artifacts/api-server`)
- **Endpoint**: `/api`
- **Routes**:
  - `GET /api/healthz` — health check
  - `GET /api/exam/status` — PDF extraction progress (ready, processing, pages count)
  - `GET /api/exam/questions` — extracted exam questions grouped into sections
- **PDF Processing**: Uses `pdftoppm` to convert PDF pages to images, sends each page to Gemini vision for question extraction
- **PDF Source**: `attached_assets/امتحانات_أحياء٢ث_ت٢_المرشد٢٠٢٥_1777627228535.pdf`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
