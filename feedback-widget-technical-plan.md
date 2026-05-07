# FeedbackKit — Technical Implementation Plan

> A lightweight customer feedback & visual bug reporter SaaS. Built with Next.js + Nest.js. Beats Usersnap on price ($19/mo vs $69/mo), Hotjar on weight (<30KB widget), and Sentry on simplicity (one `<script>` tag).

---

## Table of Contents

1. [Product Scope (MVP)](#1-product-scope-mvp)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack & Why](#3-tech-stack--why)
4. [Repo Structure (Monorepo)](#4-repo-structure-monorepo)
5. [Database Schema (Prisma)](#5-database-schema-prisma)
6. [The Widget — The Hard Part](#6-the-widget--the-hard-part)
7. [The API (Nest.js)](#7-the-api-nestjs)
8. [The Dashboard (Next.js)](#8-the-dashboard-nextjs)
9. [Integrations (Slack / Linear / GitHub)](#9-integrations-slack--linear--github)
10. [Auth & Multi-tenancy](#10-auth--multi-tenancy)
11. [Billing (Lemon Squeezy)](#11-billing-lemon-squeezy)
12. [Phased Implementation — Week by Week](#12-phased-implementation--week-by-week)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Cost Estimate](#14-cost-estimate)
15. [Pre-Launch Checklist](#15-pre-launch-checklist)

---

## 1. Product Scope (MVP)

**What ships in v1.0:**

- Customers (the SaaS users) sign up, create a project, get a public key
- They paste a `<script>` tag on their site
- End-users (their visitors) click a feedback button → choose Bug / Feature / General → optionally screenshot the page → annotate with rectangles, arrows, text, and a blur tool → submit
- Customer sees feedback in a dashboard inbox with full context (URL, browser, OS, screen size, console errors, end-user info)
- Forward to Slack channel / Linear issue / GitHub issue with one click (or auto)
- Email notification on new feedback

**What's NOT in v1.0** (planned for v1.1+):

- NPS surveys, in-app messaging, public roadmap, video recording, session replay, multi-language, white-labeling.

Discipline matters here. Usersnap got bloated. Stay surgical.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER'S WEBSITE                           │
│   <script src="cdn.feedbackkit.io/v1/widget.js">              │
│                            │                                    │
│                            ▼                                    │
│   ┌──────────────────────────────────────────────────┐         │
│   │  Widget (Shadow DOM, ~25KB gzipped)              │         │
│   │  ├─ Launcher button                              │         │
│   │  ├─ Modal (feedback form)                        │         │
│   │  ├─ Screenshot capture (html-to-image)           │         │
│   │  └─ Annotator (HTML Canvas)                      │         │
│   └──────────────────────────────────────────────────┘         │
└────────────────────────┬───────────────┬────────────────────────┘
                         │               │
              POST feedback    PUT screenshot (presigned)
                         │               │
                         ▼               ▼
┌──────────────────────────┐    ┌─────────────────────┐
│   API (Nest.js)          │    │  Cloudflare R2      │
│   api.feedbackkit.io     │    │  (object storage)   │
│   ├─ /v1/widget/*        │    └─────────────────────┘
│   ├─ /v1/dashboard/*     │
│   ├─ /v1/integrations/*  │              ▲
│   ├─ /v1/billing/webhook │              │ signed URL
│   └─ /v1/auth/*          │──────────────┘
└──┬──────┬─────────┬──────┘
   │      │         │
   │      │         └──► BullMQ jobs ──► Resend (email), Slack, Linear, GitHub APIs
   │      │
   │      └──► Redis (Upstash)  — queue + cache
   │
   ▼
┌──────────────────────┐
│  PostgreSQL          │
│  (Neon / Supabase)   │
└──────────────────────┘

┌──────────────────────────────┐    ┌──────────────────────────────┐
│  Dashboard (Next.js 15)      │    │  Marketing Site (Next.js)    │
│  app.feedbackkit.io          │    │  feedbackkit.io              │
│  ├─ Inbox, project settings  │    │  ├─ Landing, pricing, docs   │
│  ├─ Integrations, billing    │    │  └─ Auth pages               │
│  └─ Calls API via fetch      │    └──────────────────────────────┘
└──────────────────────────────┘
```

**Three deployable units, three subdomains:**

- `feedbackkit.io` — Marketing + auth (Next.js, Vercel)
- `app.feedbackkit.io` — Dashboard (Next.js, Vercel)
- `api.feedbackkit.io` — API (Nest.js, Railway/Fly.io)
- `cdn.feedbackkit.io` — Widget bundle (Cloudflare R2 + Cloudflare CDN)

Marketing + dashboard can live in one Next.js app initially; split later if needed.

---

## 3. Tech Stack & Why

| Layer | Choice | Why |
|-------|--------|-----|
| **Monorepo** | Turborepo + pnpm | Fast, simple, good Vercel integration |
| **Frontend (dashboard + marketing)** | Next.js 15 (App Router) | Your learning goal; SSR for marketing/SEO; RSCs for dashboard performance |
| **UI** | Tailwind v4 + shadcn/ui | Modern, copy-paste components, no lock-in |
| **Forms** | React Hook Form + Zod | Industry standard, great TS inference |
| **Server state** | TanStack Query | Caching, optimistic updates, background refetch |
| **Tables** | TanStack Table | Headless, fully customizable |
| **Charts** | Recharts | Simple, good enough for MVP analytics |
| **Backend** | Nest.js 10+ | Your learning goal; modular DI, perfect for SaaS scale |
| **DB** | PostgreSQL via Prisma | Best DX in TS land; migrations + types in one |
| **Background jobs** | BullMQ + Redis | Battle-tested, plays well with Nest.js |
| **Auth** | Auth.js (NextAuth v5) on dashboard, JWT-shared with Nest.js | Fastest path; supports Google/GitHub OAuth + email/password |
| **File storage** | Cloudflare R2 | S3-compatible, **zero egress fees** (huge for image-heavy product) |
| **Email** | Resend | Best modern DX, generous free tier |
| **Real-time** | Server-Sent Events (SSE) | Simpler than websockets; good enough for live inbox updates |
| **Billing** | **Lemon Squeezy** | Merchant of Record — handles tax/VAT globally; pays out via Wise/Payoneer (Egypt-friendly) |
| **Widget runtime** | **Preact + esbuild** | 3KB runtime, React-like API, tiny bundle |
| **Screenshot** | `html-to-image` | Smaller and more modern than html2canvas |
| **Annotation** | HTML Canvas (custom) | Full control, no library bloat |
| **Hosting (Next.js)** | Vercel | Best Next.js deployment; free tier covers early traffic |
| **Hosting (Nest.js)** | **Railway** (or Fly.io) | Simple Docker deploy, $5/mo plan, includes Postgres + Redis |
| **DNS / CDN** | Cloudflare | Free, fast, built-in protection |
| **DB hosting** | **Neon** | Generous free tier, branching for previews |
| **Redis hosting** | **Upstash** | Free tier, REST API option, BullMQ-compatible |
| **Monitoring** | Sentry (errors) + Better Stack (uptime) | Both have free tiers |
| **Analytics** | PostHog (cloud free tier) | Product analytics + feature flags |

### Why these choices specifically for you

- **Lemon Squeezy over Stripe**: From past conversations you already understand Payoneer for receiving US payments from Egypt. Lemon Squeezy is the cleanest path — they handle global tax compliance and pay out internationally.
- **Preact over React for the widget**: Your dashboard React skills transfer directly (same hooks, same JSX), but the widget bundle stays tiny. This matters because customers reject heavy widgets.
- **Cloudflare R2 over S3**: Image-heavy product. R2's zero egress fee saves real money once you grow.
- **Nest.js modular pattern**: Each feature (auth, projects, feedback, integrations, billing) becomes its own module. Excellent for learning Nest.js DI patterns properly.

---

## 4. Repo Structure (Monorepo)

```
feedbackkit/
├── apps/
│   ├── web/                      # Next.js — marketing + dashboard
│   │   ├── app/
│   │   │   ├── (marketing)/      # / , /pricing, /docs
│   │   │   ├── (auth)/           # /login, /signup
│   │   │   └── (dashboard)/      # /app/[orgSlug]/...
│   │   └── ...
│   │
│   └── api/                      # Nest.js
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── projects/
│       │   │   ├── feedback/
│       │   │   ├── integrations/
│       │   │   ├── widget/        # public widget endpoints
│       │   │   ├── billing/
│       │   │   └── uploads/
│       │   ├── common/            # guards, interceptors, filters
│       │   ├── jobs/              # BullMQ workers
│       │   └── main.ts
│       └── prisma/
│           └── schema.prisma
│
├── packages/
│   ├── widget/                   # The embed widget
│   │   ├── src/
│   │   │   ├── index.ts          # entry: mounts launcher
│   │   │   ├── modal/            # feedback form UI (Preact)
│   │   │   ├── screenshot/       # html-to-image wrapper
│   │   │   ├── annotator/        # canvas annotation engine
│   │   │   └── api/              # API client
│   │   └── build.config.ts       # esbuild config — outputs widget.js
│   │
│   ├── sdk-react/                # React/Next.js convenience wrapper
│   │   └── src/Widget.tsx
│   │
│   ├── shared/                   # Types, Zod schemas, constants
│   │   └── src/
│   │       ├── feedback.schema.ts
│   │       └── api.types.ts
│   │
│   └── db/                       # Prisma client + migrations
│       └── prisma/
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

The `packages/shared` contains your Zod schemas. Both `apps/web` (forms) and `apps/api` (DTO validation) import the same schemas. Single source of truth, no drift. This pattern alone is worth the monorepo overhead.

---

## 5. Database Schema (Prisma)

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Identity ──────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())

  memberships   OrgMember[]
  sessions      Session[]
  accounts      Account[]   // OAuth accounts
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  provider          String  // 'google' | 'github'
  providerAccountId String
  accessToken       String? @db.Text
  refreshToken      String? @db.Text
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ─── Tenancy ───────────────────────────────────────────

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  plan        Plan     @default(FREE)
  createdAt   DateTime @default(now())

  members         OrgMember[]
  projects        Project[]
  subscription    Subscription?
}

model OrgMember {
  id     String @id @default(cuid())
  orgId  String
  userId String
  role   Role   @default(MEMBER)

  org    Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user   User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([orgId, userId])
}

// ─── Product ───────────────────────────────────────────

model Project {
  id             String   @id @default(cuid())
  orgId          String
  name           String
  publicKey      String   @unique  // pk_live_xxx — used by widget
  allowedOrigins String[]          // CORS allowlist
  themeColor     String?           // widget customization
  createdAt      DateTime @default(now())

  org           Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  feedbacks     Feedback[]
  integrations  Integration[]
}

model Feedback {
  id              String         @id @default(cuid())
  projectId       String
  type            FeedbackType
  status          FeedbackStatus @default(NEW)
  priority        Priority?
  title           String?
  body            String         @db.Text

  // Visual
  screenshotKey   String?        // R2 object key
  annotations     Json?          // [{type:'rect', x,y,w,h, color}, ...]

  // Page context (auto-captured by widget)
  pageUrl         String?
  pageTitle       String?
  userAgent       String?
  browser         String?
  os              String?
  screenWidth     Int?
  screenHeight    Int?
  viewportWidth   Int?
  viewportHeight  Int?
  consoleLogs     Json?          // last N console messages
  networkErrors   Json?          // failed requests

  // End-user identification (passed by SDK)
  endUserId       String?
  endUserEmail    String?
  endUserName     String?
  endUserMetadata Json?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  project         Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  externalRefs    ExternalRef[]
  comments        Comment[]

  @@index([projectId, createdAt])
  @@index([projectId, status])
}

model Comment {
  id          String   @id @default(cuid())
  feedbackId  String
  userId      String
  body        String   @db.Text
  createdAt   DateTime @default(now())

  feedback    Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
}

model ExternalRef {
  id          String        @id @default(cuid())
  feedbackId  String
  provider    IntProvider
  externalId  String
  url         String
  createdAt   DateTime      @default(now())

  feedback    Feedback      @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
}

model Integration {
  id            String      @id @default(cuid())
  projectId     String
  provider      IntProvider
  config        Json        // {channelId, teamId, repoId, ...}
  accessToken   String      @db.Text  // encrypted at rest
  refreshToken  String?     @db.Text
  expiresAt     DateTime?
  enabled       Boolean     @default(true)

  project       Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, provider])
}

// ─── Billing ───────────────────────────────────────────

model Subscription {
  id                      String   @id @default(cuid())
  orgId                   String   @unique
  lemonSubscriptionId     String   @unique
  lemonCustomerId         String
  status                  String   // active, past_due, cancelled
  plan                    Plan
  currentPeriodEnd        DateTime
  createdAt               DateTime @default(now())

  org                     Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
}

// ─── Enums ─────────────────────────────────────────────

enum Plan          { FREE STARTER GROWTH PRO }
enum Role          { OWNER ADMIN MEMBER }
enum FeedbackType  { BUG FEATURE GENERAL PRAISE }
enum FeedbackStatus{ NEW IN_PROGRESS RESOLVED ARCHIVED }
enum Priority      { LOW MEDIUM HIGH URGENT }
enum IntProvider   { LINEAR GITHUB SLACK NOTION }
```

---

## 6. The Widget — The Hard Part

This is where the most interesting engineering lives. Take it seriously.

### 6.1 Distribution

```html
<!-- Customer pastes this on their site -->
<script async src="https://cdn.feedbackkit.io/v1/widget.js"
        data-project="pk_live_abc123"></script>
```

For React/Next.js customers, ship a thin wrapper:

```tsx
// packages/sdk-react/src/Widget.tsx
import { useEffect } from 'react'

export function FeedbackKit({ projectKey, user }: Props) {
  useEffect(() => {
    if (window.FeedbackKit) return  // already loaded
    const script = document.createElement('script')
    script.src = 'https://cdn.feedbackkit.io/v1/widget.js'
    script.async = true
    script.dataset.project = projectKey
    document.body.appendChild(script)
  }, [projectKey])

  useEffect(() => {
    window.FeedbackKit?.identify(user)
  }, [user])

  return null
}
```

### 6.2 Bundle structure

The widget runs on **someone else's website**. Three rules to live by:

1. **Never pollute the global scope** beyond a single `window.FeedbackKit` namespace.
2. **Never let your CSS leak** into their page, or theirs into yours. Use **Shadow DOM**.
3. **Never block their main thread.** Async script, lazy-load heavy libs (annotation, screenshot).

```ts
// packages/widget/src/index.ts
class FeedbackKitWidget {
  private projectKey: string
  private shadowRoot: ShadowRoot
  private host: HTMLElement

  constructor(projectKey: string) {
    this.projectKey = projectKey
    this.host = document.createElement('div')
    this.host.id = 'fk-host'
    this.shadowRoot = this.host.attachShadow({ mode: 'closed' })
    document.body.appendChild(this.host)
    this.renderLauncher()
    this.fetchConfig()
  }

  private async fetchConfig() {
    const res = await fetch(`https://api.feedbackkit.io/v1/widget/config`, {
      headers: { 'X-Project-Key': this.projectKey }
    })
    // theme color, allowed types, custom labels, etc.
  }

  private renderLauncher() {
    // Render Preact <Launcher /> into shadowRoot
  }

  // Public API
  open() { /* ... */ }
  identify(user: { id, email, name, metadata }) { /* ... */ }
  setMetadata(meta: object) { /* ... */ }
}

// Self-init from <script data-project="...">
const script = document.currentScript as HTMLScriptElement
const key = script?.dataset.project
if (key) {
  ;(window as any).FeedbackKit = new FeedbackKitWidget(key)
}
```

### 6.3 Screenshot capture

`html-to-image` (~10KB minified) runs in the browser, walks the DOM, and produces a `Blob`/`dataURL`. **Lazy-load it** — don't include in the initial bundle.

```ts
// packages/widget/src/screenshot/capture.ts
export async function captureScreen(target: HTMLElement = document.body): Promise<Blob> {
  const { toBlob } = await import('html-to-image')  // lazy
  const blob = await toBlob(target, {
    backgroundColor: '#ffffff',
    pixelRatio: window.devicePixelRatio,
    filter: (node) => {
      // Don't capture our own widget
      return !(node as Element).closest?.('#fk-host')
    },
  })
  if (!blob) throw new Error('Screenshot capture failed')
  return blob
}
```

**Known limits to communicate to users:**

- Cross-origin images without CORS headers will fail (render placeholders for these).
- Some CSS (e.g. complex `backdrop-filter`) won't render.
- Iframes from other origins are not capturable — you'll get a blank rect.

For premium users, offer a **fallback path** using `navigator.mediaDevices.getDisplayMedia` (real browser screenshot, requires user permission). v1.1 feature.

### 6.4 Annotation engine

Build it on raw HTML Canvas. ~200 lines of TypeScript. Tools to ship in v1:

- **Rectangle** (highlight)
- **Arrow** (point at things)
- **Text** (with auto-sized background pill)
- **Blur** (mask sensitive data — critical for adoption)

State model:

```ts
type Annotation =
  | { type: 'rect'; x: number; y: number; w: number; h: number; color: string }
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: 'text'; x: number; y: number; content: string; color: string }
  | { type: 'blur'; x: number; y: number; w: number; h: number; intensity: number }

interface AnnotatorState {
  annotations: Annotation[]
  selected: number | null
  tool: 'select' | 'rect' | 'arrow' | 'text' | 'blur'
  history: Annotation[][]   // for undo
}
```

Render approach:

- One canvas with the screenshot drawn at the bottom
- Annotations re-rendered on every state change
- Mouse/touch handlers compute new annotation, push to state
- Final export: re-render to a new canvas → `toBlob()` → upload

**Persist annotations as JSON** alongside the image. Lets the dashboard re-render them on top of the screenshot, so the customer can edit later.

### 6.5 Page context capture

This is what makes feedback actually useful:

```ts
function capturePageContext() {
  return {
    pageUrl: location.href,
    pageTitle: document.title,
    userAgent: navigator.userAgent,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    consoleLogs: getBufferedConsoleLogs(),    // see below
    networkErrors: getBufferedNetworkErrors(),
  }
}
```

**Console log buffering** — patch `console.log/warn/error` at widget init to push into a ring buffer (last 50 messages). Send the buffer when feedback is submitted.

**Network error capture** — wrap `fetch` and `XMLHttpRequest` to record failures (status >= 400). Same ring buffer pattern.

**Both must be opt-in** for the customer (privacy/PII concerns) — they configure this from the dashboard.

### 6.6 Upload pipeline

Don't proxy image bytes through your API — that's slow, expensive, and limits scale. Use **presigned URLs**:

```
1. Widget: POST /v1/widget/feedback (no image yet, returns feedbackId + presignedUrl)
2. Widget: PUT presignedUrl (direct to R2, with Content-Type)
3. Widget: PATCH /v1/widget/feedback/:id (mark image uploaded)
```

Backend issues presigned URLs with 5-minute TTL, scoped to a single object key.

### 6.7 Build & deploy

```ts
// packages/widget/build.config.ts
import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2018',
  outfile: 'dist/widget.js',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.API_URL': '"https://api.feedbackkit.io"',
  },
})
```

Deploy: upload `dist/widget.js` to Cloudflare R2 + put Cloudflare CDN in front. **Version the path** (`/v1/widget.js`) so you can ship breaking changes without breaking existing customers.

**Bundle size budget: 30KB gzipped.** Measure on every build. Fail CI if exceeded.

---

## 7. The API (Nest.js)

### 7.1 Module structure

Each module is a folder under `src/modules/`. Standard Nest.js layout:

```
modules/feedback/
├── feedback.module.ts
├── feedback.controller.ts        # REST endpoints
├── feedback.service.ts           # business logic
├── feedback.repository.ts        # Prisma queries
├── dto/
│   ├── create-feedback.dto.ts    # imports Zod from packages/shared
│   └── list-feedback.dto.ts
└── guards/
    └── project-key.guard.ts      # validates X-Project-Key header
```

### 7.2 Key endpoints

**Public (widget) — auth via `X-Project-Key`:**

```
GET    /v1/widget/config              → theme, labels, types
POST   /v1/widget/feedback            → creates feedback, returns presigned URL
PATCH  /v1/widget/feedback/:id        → mark screenshot uploaded
```

**Authenticated (dashboard) — auth via session cookie + JWT:**

```
GET    /v1/projects                   → list user's projects
POST   /v1/projects                   → create
GET    /v1/projects/:id/feedback      → paginated, filtered inbox
PATCH  /v1/feedback/:id               → update status / priority / assignee
POST   /v1/feedback/:id/comments      → add internal comment
POST   /v1/feedback/:id/forward       → push to Linear/GitHub/Slack
GET    /v1/projects/:id/integrations  → list configured integrations
POST   /v1/integrations/:provider/connect    → OAuth start
GET    /v1/integrations/:provider/callback   → OAuth callback
DELETE /v1/integrations/:id           → disconnect

GET    /v1/feedback/:id/stream        → SSE for real-time updates
```

**Webhooks:**

```
POST   /v1/billing/webhook/lemon      → subscription events
```

### 7.3 Critical patterns

**Project-key guard for widget endpoints:**

```ts
@Injectable()
export class ProjectKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const key = req.headers['x-project-key']
    if (!key) throw new UnauthorizedException()

    const project = await this.prisma.project.findUnique({ where: { publicKey: key } })
    if (!project) throw new UnauthorizedException()

    // Verify origin against allowedOrigins
    const origin = req.headers.origin
    if (project.allowedOrigins.length && !project.allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Origin not allowed')
    }

    req.project = project
    return true
  }
}
```

**Rate limiting**: `@nestjs/throttler` per project key — e.g., 100 submissions/min/project. Prevent abuse from a buggy customer site spamming you.

**Validation pipeline**: shared Zod schemas + `nestjs-zod`:

```ts
// In packages/shared
export const createFeedbackSchema = z.object({
  type: z.enum(['BUG', 'FEATURE', 'GENERAL', 'PRAISE']),
  body: z.string().min(1).max(5000),
  pageUrl: z.string().url().optional(),
  // ...
})

// In api
import { createFeedbackSchema } from '@feedbackkit/shared'
import { createZodDto } from 'nestjs-zod'
export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}
```

### 7.4 Background jobs (BullMQ)

When feedback is created, queue downstream work:

```ts
// On feedback creation
await this.queue.add('feedback.created', { feedbackId })

// Worker
@Processor('feedback.created')
async handle(job) {
  const fb = await this.feedbackService.findOne(job.data.feedbackId)
  await Promise.allSettled([
    this.email.sendNotification(fb),
    this.slack.maybeForward(fb),
    this.linear.maybeForward(fb),
    this.github.maybeForward(fb),
  ])
}
```

`Promise.allSettled` is intentional — one failing integration shouldn't block the others. Each integration also has its own retry config in BullMQ.

---

## 8. The Dashboard (Next.js)

### 8.1 Routes

```
app/
├── (marketing)/
│   ├── page.tsx                  # /
│   ├── pricing/page.tsx
│   └── docs/[[...slug]]/page.tsx
│
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── verify/page.tsx
│
└── (dashboard)/
    └── [orgSlug]/
        ├── layout.tsx            # sidebar nav
        ├── page.tsx              # overview
        ├── projects/
        │   ├── page.tsx          # list
        │   └── [projectId]/
        │       ├── page.tsx      # inbox (default view)
        │       ├── feedback/[id]/page.tsx
        │       ├── settings/page.tsx
        │       ├── integrations/page.tsx
        │       └── install/page.tsx     # install instructions
        ├── billing/page.tsx
        ├── team/page.tsx
        └── account/page.tsx
```

### 8.2 Core screens to build

1. **Inbox** — filterable feedback table (by type, status, priority, search). Live updates via SSE.
2. **Feedback detail** — screenshot with annotations re-rendered on top, page context, console logs, action buttons (forward to Linear, comment, change status).
3. **Install** — copy-paste `<script>` snippet + framework-specific examples (Next.js, React, Vue, plain HTML).
4. **Integrations** — connect cards (Slack, Linear, GitHub) with OAuth flow + per-integration config.
5. **Project settings** — name, allowed origins (CORS), theme color, what to capture (consoleLogs on/off, etc.).
6. **Team** — invite members, set roles.
7. **Billing** — current plan, usage, upgrade CTA, invoice history.

### 8.3 Patterns to use (good for sharpening Next.js)

- **RSC for everything readonly** (inbox list, settings forms initial state). Keep client components surgical.
- **Server Actions** for mutations (with optimistic updates via TanStack Query for the table).
- **Parallel routes** (`@inbox` slot) for the feedback detail modal that can also be deep-linked.
- **Intercepting routes** for the modal-vs-page pattern on `/feedback/[id]`.
- **Streaming with Suspense** for the dashboard so the layout loads instantly.

---

## 9. Integrations (Slack / Linear / GitHub)

All three follow the same pattern: OAuth dance → store encrypted access token → forward feedback as needed.

**OAuth flow:**

```
1. User clicks "Connect Slack" on /integrations
2. Browser → /v1/integrations/slack/connect?projectId=X
3. Server stores `state` (signed) → redirects to Slack OAuth URL
4. User approves on Slack
5. Slack redirects to /v1/integrations/slack/callback?code=Y&state=Z
6. Server validates state, exchanges code for access_token
7. Encrypts and stores in Integration table
8. Redirects user back to /[org]/projects/[id]/integrations
```

**Token encryption**: AES-256-GCM with a key in env (rotated periodically). Use Node's `crypto` module. Never store plain access tokens.

**Per-provider specifics:**

| Provider | OAuth scope | Action |
|----------|-------------|--------|
| **Slack** | `chat:write`, `channels:read` | Post to a chosen channel as a Slack message with screenshot preview |
| **Linear** | OAuth `read,write` | Create issue in chosen team with title/description from feedback |
| **GitHub** | `repo` (or `public_repo`) | Create issue in chosen repo with body + screenshot link |

Build them in this order: **Slack first** (highest demand, simplest API), Linear second, GitHub third.

---

## 10. Auth & Multi-tenancy

### 10.1 Auth flow

Use **Auth.js (NextAuth v5)** in `apps/web`. Config:

- Email/password with verification (via Resend)
- Google OAuth
- GitHub OAuth
- Session stored in Postgres via Prisma adapter

### 10.2 Sharing auth between Next.js and Nest.js

Two options. Pick one:

**Option A — JWT (recommended)**: Auth.js issues a JWT on login; dashboard sends it as `Authorization: Bearer ...` to Nest.js. Nest.js validates with the same secret.

**Option B — Cookie + same-domain**: Both apps on the same root domain (`feedbackkit.io` and `api.feedbackkit.io`); Auth.js writes a cookie at `.feedbackkit.io`; Nest.js reads it. Simpler but couples the deploys.

Option A is more flexible and is the standard pattern. Go with it.

### 10.3 Multi-tenancy

- A **User** can belong to many **Organizations** via **OrgMember**.
- A **Project** belongs to one **Organization**.
- Every authenticated request resolves the active org from the URL slug (`/app/[orgSlug]/...`).
- Backend guards enforce: "the requesting user must be a member of the org that owns the project."

Write **one base guard** (`OrgMembershipGuard`) and apply it everywhere. Never trust the client to send the correct orgId.

---

## 11. Billing (Lemon Squeezy)

### 11.1 Pricing tiers (suggested)

| Plan | Price | Limits | Target |
|------|-------|--------|--------|
| **Free** | $0 | 1 project, 50 submissions/mo, FeedbackKit branding | Try-before-you-buy |
| **Starter** | $19/mo | 3 projects, 1k submissions/mo, no branding | Solo founders |
| **Growth** | $49/mo | 10 projects, 10k submissions/mo, integrations | Small teams |
| **Pro** | $99/mo | Unlimited projects, 50k submissions/mo, priority support | Agencies |

Annual discount: 20% off. Always.

### 11.2 Implementation

1. Create products in Lemon Squeezy dashboard, one variant per plan.
2. From the dashboard's `/billing/upgrade` page, redirect to Lemon's hosted checkout with `?checkout[custom][org_id]=xxx` so the webhook knows which org to attach.
3. Lemon webhooks fire `subscription_created`, `subscription_updated`, `subscription_cancelled` to your Nest.js endpoint.
4. Verify the signature, then upsert the `Subscription` record and bump the org's `plan`.
5. Enforce plan limits in middleware: count projects/submissions on each call, block over-limit with 402 Payment Required.

```ts
// On every feedback creation:
const usage = await this.usage.getCurrentMonth(project.orgId)
const limit = PLAN_LIMITS[org.plan].submissionsPerMonth
if (usage >= limit) {
  throw new HttpException('Plan limit reached', 402)
}
```

---

## 12. Phased Implementation — Week by Week

Realistic for one developer working ~20-25 hrs/week. Adjust to your pace.

### Week 1 — Foundation

- [ ] Initialize Turborepo + pnpm workspace, set up `apps/web`, `apps/api`, `packages/{widget,shared,db,sdk-react}`
- [ ] Configure ESLint, Prettier, TypeScript shared config across packages
- [ ] Set up Prisma schema (the one above), initial migration on Neon
- [ ] Boot Nest.js with health endpoint, hooked to Postgres
- [ ] Boot Next.js with marketing landing page placeholder
- [ ] Set up GitHub Actions: build, lint, type-check on PR
- [ ] Deploy: API → Railway, Web → Vercel
- [ ] Buy domain, set up Cloudflare DNS

### Week 2 — Auth + Org/Project CRUD

- [ ] Auth.js setup (email/password + Google) on Next.js
- [ ] JWT shared secret with Nest.js, validation guard
- [ ] Organization creation on signup, slug routing
- [ ] Projects CRUD: create, list, settings page (name, allowed origins, theme)
- [ ] Generate `pk_live_*` public keys (use `nanoid`)
- [ ] Install page with copy-paste snippet

### Week 3 — Widget v0 (text-only feedback)

- [ ] Widget bundling pipeline with esbuild
- [ ] Shadow DOM mounting, launcher button (Preact)
- [ ] Modal with type selector (Bug/Feature/General) + text body
- [ ] API call to `/v1/widget/feedback` with `X-Project-Key`
- [ ] Project key guard + origin allowlist + rate limiting on Nest.js side
- [ ] Page context auto-capture (URL, viewport, UA)
- [ ] Inbox view in dashboard: list feedback with filters
- [ ] Feedback detail view (text only for now)

### Week 4 — Visual capture + annotation

- [ ] Lazy-load `html-to-image` in widget; capture flow
- [ ] Custom canvas annotator: rect, arrow, text, blur tools, undo
- [ ] Presigned URL endpoint for R2 upload
- [ ] Two-phase create: feedback → upload → patch
- [ ] Dashboard: render screenshot with annotations overlaid
- [ ] Console log + network error buffering in widget (opt-in)

### Week 5 — Real-time + comments + polish

- [ ] SSE endpoint for inbox live updates
- [ ] Internal comments on feedback
- [ ] Status / priority / assignee UI
- [ ] Email notifications via Resend (digest + instant) — BullMQ-driven
- [ ] User identification: SDK method + endUser fields in DB
- [ ] React/Next.js SDK package (`@feedbackkit/react`)

### Week 6 — Integrations

- [ ] Slack OAuth + channel picker + message formatter (Block Kit)
- [ ] Linear OAuth + team picker + issue creation
- [ ] GitHub OAuth + repo picker + issue creation
- [ ] Token encryption (AES-256-GCM)
- [ ] Per-feedback "Forward to..." button + auto-forward rules

### Week 7 — Billing + plan enforcement

- [ ] Lemon Squeezy account, products, variants
- [ ] Checkout redirect from upgrade page
- [ ] Webhook receiver + signature verification
- [ ] Plan limit enforcement (project count, monthly submissions)
- [ ] Billing page: current plan, usage, invoices, change plan, cancel
- [ ] Customer portal link via Lemon Squeezy

### Week 8 — Polish, docs, launch prep

- [ ] Marketing site: landing, pricing, features pages
- [ ] Docs site: install guides per framework, API reference, changelog
- [ ] Onboarding flow: post-signup checklist (create project → install widget → invite team)
- [ ] Sentry for the API, error boundary on dashboard
- [ ] Better Stack uptime monitor
- [ ] Privacy policy, ToS, DPA template (use Termly or write your own)
- [ ] Email templates polish
- [ ] Demo video (Loom)

### Week 9 — Beta + Launch

- [ ] Recruit 5-10 beta users from Indie Hackers / r/SaaS / Twitter
- [ ] Iterate on feedback for ~2 weeks
- [ ] Product Hunt launch with 24-hr engagement plan
- [ ] Indie Hackers post
- [ ] Reddit posts in r/SaaS, r/webdev, r/Entrepreneur
- [ ] Submit to startup directories (Beta List, Launching Next, etc.)

---

## 13. Infrastructure & Deployment

| Service | Provider | Tier |
|---------|----------|------|
| Marketing + Dashboard | Vercel | Hobby (free) → Pro at scale |
| API | Railway | Hobby ($5/mo) → Pro at scale |
| Postgres | Neon | Free (3GB, branches) → Scale |
| Redis | Upstash | Free → Pay-as-you-go |
| Object storage | Cloudflare R2 | 10GB free, $0.015/GB after |
| CDN | Cloudflare | Free |
| Email | Resend | 3k/mo free → $20/mo for 50k |
| DNS | Cloudflare | Free |
| Domain | Namecheap or Cloudflare Registrar | ~$10/yr |
| Sentry | Sentry | Developer (free) |
| Better Stack | Better Stack | Free |
| PostHog | PostHog Cloud | 1M events/mo free |

**CI/CD**:

- Push to `main` → Vercel auto-deploys `apps/web`
- Push to `main` → GitHub Actions builds Docker image for `apps/api` → Railway auto-deploys
- Push to `main` (with widget changes) → GitHub Actions builds widget → uploads to R2 with versioned path
- DB migrations: `prisma migrate deploy` runs as a Railway pre-deploy hook

---

## 14. Cost Estimate

**Pre-revenue (months 1-3, free tiers):**

| Item | Cost |
|------|------|
| Domain | $10/yr |
| Railway (API + Redis) | $5-10/mo |
| Everything else | $0 |
| **Total** | **~$10/mo** |

**Post-revenue (paying customers, scaled tiers):**

| Item | Cost |
|------|------|
| Vercel Pro | $20/mo |
| Railway Pro | $20/mo |
| Neon Scale | $19/mo |
| Resend | $20/mo |
| Sentry Team | $26/mo |
| **Total** | **~$105/mo** |

Break-even: **~6 paid Starter customers** ($19 × 6 = $114/mo).

---

## 15. Pre-Launch Checklist

### Legal / Trust
- [ ] Privacy policy, Terms of Service, DPA
- [ ] Cookie consent on marketing site (your own GDPR banner — eat your own dog food)
- [ ] Document data retention (when do you delete feedback? Default 12 months on free)
- [ ] Subprocessors page (list R2, Resend, Neon, etc.)

### Security
- [ ] All access tokens encrypted at rest
- [ ] HTTPS everywhere, HSTS preload
- [ ] CORS strictly scoped
- [ ] Rate limiting on every public endpoint
- [ ] CSP headers on dashboard
- [ ] Penetration test the widget endpoint specifically (it's exposed to the world)
- [ ] No secrets in client-side bundles (audit before every deploy)

### Performance
- [ ] Widget bundle <30KB gzipped (verified in CI)
- [ ] Widget loads async, never blocks customer's TTI
- [ ] API p95 latency <300ms
- [ ] Lighthouse 90+ on marketing pages

### Onboarding
- [ ] Empty states for inbox ("no feedback yet — try clicking the button on your install page")
- [ ] Sample feedback created automatically on first project
- [ ] Slack invite link in welcome email
- [ ] First-week drip emails with product tips

### Discovery
- [ ] Schema.org SoftwareApplication structured data on landing
- [ ] Open Graph images for every page (your widget will help you debug these later — meta!)
- [ ] Submit to Hacker News, Indie Hackers, Product Hunt (don't all-at-once)
- [ ] Twitter / X presence — build in public from week 1

---

## Final Notes

**Order of difficulty per phase:**
- Easy: weeks 1, 2, 7 (CRUD + standard SaaS plumbing)
- Medium: weeks 3, 5, 6 (widget basics, real-time, integrations)
- Hard: week 4 (annotation engine, screenshot edge cases)

**The two things that will give you trouble:**
1. **Cross-origin screenshots** — third-party images without CORS headers. Plan for graceful degradation.
2. **Widget performance on slow customer sites** — audit on a throttled connection regularly.

**The thing that will surprise you with how easy it is:** Nest.js modular architecture. Once you grok DI, every feature becomes a copy-paste of the previous module's structure. Use the CLI: `nest g module foo`, `nest g controller foo`, `nest g service foo`.

**The thing that will surprise you with how hard it is:** the annotation tool. Budget 4-5 days for it, not 2.

Ship the widget tag visible on your own marketing site from Day 1. Eat your own dog food. The first 100 pieces of feedback you collect will improve the product more than any external research.

---

*Built for solo founders who'd rather ship than plan. Now stop reading and `pnpm create turbo@latest`.*
