# VaultEdge Technical Plan (Demo → Production)

This single document tracks the agreed technology stack, current functionality, demo-mode improvements, and the roadmap to evolve VaultEdge from demo to a production-ready, cloud-native application. It will be updated at end-of-day or on request.

---

## 1) Vision and Principles
- Deliver a clean, fast demo now, with a frictionless path to production.
- Follow Twelve-Factor principles (config via env, stateless services, ephemeral storage).
- Security by default: least privilege, no plaintext secrets, proper token handling.
- Cloud-native: containers, health probes, metrics, and automated CI/CD.

---

## 2) Current Architecture Snapshot (as-is)

### Frontend (vaultedge-frontend)
- Vite + React 19, Tailwind CSS
- Routing: react-router-dom 7
- Notifications: react-hot-toast
- Icons: lucide-react
- PDF generation: jsPDF (session summary)
- State: React Context for auth (very light)
- i18n: Custom `I18nContext` (FALLBACK_MESSAGES + catálogo remoto `/api/i18n/catalog`), idiomas activos: en, es, fr (plural `.one/.other`), cache LocalStorage
- Demo data: `src/services/mockApi.js`
- Key screens/components:
  - `Dashboard` – lists SafeBoxes
  - `SafeBoxDetail` – folder tree, file list, actions (add/update/delete/download)
  - `FileTree` – recursive tree
  - `LoginForm` – demo login
  - `TopNav` / `SideMenu`

Known gaps and quick opportunities:
- Download button in toolbar passes an array into a single-file handler.
- File metadata in `FileTree` is shown but not backed by mock data consistently.
- Selection set uses arrays with O(n) membership checks.
- Uses window.prompt for rename/add; better UX with a small modal.
- Credentials are logged in console during login (demo only, but remove).

### Backend (vaultedge-backend)
- Spring Boot 3.1.5 (Java 21)
- Starters: Web, Data JPA, Security; DB: PostgreSQL; Lombok; DevTools
- Simple `AuthController` with plaintext password comparison
- `I18nController` + `I18nService` para catálogo y lista de idiomas (en, es, fr) con overrides desde BD
- GlobalExceptionHandler with plain string responses
- `User` entity with unique username, ID as UUID
- `application.properties` contains local DB creds and default Spring Security user

Known gaps and quick opportunities:
- Plaintext password handling (critical for production)
- Faltan reglas plural avanzadas (Intl.PluralRules) y formateo regional de fechas/números
- No JWT / session management for real auth flows
- No Flyway migrations; schema managed via `ddl-auto=update`
- No service layer or DTOs; controllers couple directly to entities
- No OpenAPI docs or actuator endpoints enabled

---

## 3) Technology Stack (baseline + target)

### Frontend
- Baseline: React 19 + Vite + Tailwind, React Router, react-hot-toast, lucide-react, jsPDF
- Target adds:
  - TypeScript (optional but recommended)
  - Intl.PluralRules + helper plural genérico (reemplazar convención manual `.one/.other` a futuro)
  - HTTP: axios with interceptors
  - Data fetching: TanStack Query (React Query)
  - Mocking: MSW (Mock Service Worker) to replace `mockApi` seamlessly
  - Component UX: Headless UI / Radix for accessible modals, dropdowns
  - Virtualized lists for large tables (react-virtual)

### Backend
- Baseline: Spring Boot 3.x, Java 21, JPA, Security, PostgreSQL
- Target adds:
  - Spring Boot parent BOM for dependency alignment
  - Endpoint versión/hash catálogo i18n (cache bust) futuro
  - Flyway for DB migrations
  - Password hashing with BCrypt + `PasswordEncoder`
  - JWT-based stateless auth (access + refresh) OR secure cookie sessions
  - CORS per environment, and security headers (HSTS, X-Content-Type-Options, etc.)
  - springdoc-openapi-ui for API docs (/swagger-ui.html)
  - Observability: Micrometer + Prometheus, Actuator health/metrics
  - Problem Details (RFC 7807) style error responses
  - Service layer + DTO mapping (MapStruct optional)
  - Testcontainers for integration tests

### Data and Storage
- Primary DB: PostgreSQL (managed cloud in prod)
- File content: Object storage (S3/Azure Blob/GCS) with presigned URLs
- Caching layer (future): Redis for rate limiting/sessions/queues if needed

### DevOps
- Containers: multi-stage Dockerfiles for frontend/backend
- Local dev: docker-compose (frontend + backend + Postgres + pgAdmin + MSW)
- CI/CD: GitHub Actions (build, test, lint, security scan, image push, deploy)
- Environments: dev, staging, prod with environment-specific config via env vars

---

## 4) Demo-Mode Enhancements (Investor polish)

- UX
  - Loading/skeleton states on Dashboard and SafeBoxDetail
  - Localización completa SafeBoxDetail (EN/ES/FR) (COMPLETADO)
  - Sticky toolbar for file actions; breadcrumbs for folders
  - Replace `prompt()` with modal dialogs for add/rename; inline validation
  - Improve PDF: title, app logo, date, selected folder name, counts
  - Optional: dark mode toggle

- Functionality polish
  - Fix toolbar Download: support multi-file zip via JSZip (demo only)
  - Selection performance: use `Set` and `useMemo`
  - Consistent file metadata across tree and table (single enrichment strategy)
  - Stable IDs with `uuid` instead of `Date.now()`

- Safety hygiene
  - Remove console logs for credentials/errors; keep toasts and structured error UI
  - Simulate httpOnly cookie auth (or keep access token in-memory in context)

- Developer experience
  - Introduce axios client + React Query data hooks (`useSafeBoxes`, `useFiles`)
  - Script de extracción/verificación de claves i18n (PENDIENTE)
  - Environment-driven API base URL (`VITE_API_BASE_URL`)
  - MSW to mock real API endpoints with realistic delays and error cases

---

## 5) Production-Ready Roadmap (phased)

Phase 0 — Cleanup and UX polish (demo)
- Fix toolbar download bug; add `handleDownloadSelected()`
- Switch selection to `Set`; memoize derived values; stable IDs
- Replace prompts with modal components; basic validation
- Internationalización núcleo (EN/ES/FR) para componentes críticos (COMPLETADO)
- Align file metadata between tree and table

Phase 1 — API client + MSW
- Add axios + interceptors; centralize baseURL from env
- Add React Query; convert screens to `useQuery`/`useMutation`
- Replace `mockApi.js` with MSW handlers that mirror real endpoints

Phase 2 — Security foundation
- Backend: add BCrypt `PasswordEncoder`, remove plaintext comparisons
- Introduce JWT-based auth; issue access/refresh tokens; add auth filter
- Configure CORS and add security headers; remove default `spring.security.user.*`

Phase 3 — Persistence and layering
- Add Flyway; write V1__init.sql for `users`, `safeboxes`, `nodes`, `audit_logs`
- Introduce service layer + DTO mapping; Problem Details error responses
- Add Testcontainers-based integration tests

Phase 4 — File handling
- Object storage integration; presigned URLs for upload/download
- Multipart uploads for large files; server-side ZIP streaming for directories/tree

Phase 5 — Observability & rate limiting
- Actuator health (readiness/liveness) + metrics
- Structured JSON logs; correlation IDs
- Optional: Bucket4j or similar for simple rate limiting

Phase 6 — DevOps & delivery
- Multi-stage Dockerfiles; docker-compose for local dev
- GitHub Actions: build, test, lint, SCA scan, container scan, deploy
- Environment promotion (dev → staging → prod)

Phase 7 — Cloud infra
- Managed Postgres; object storage bucket; app hosting (K8s/ECS/AKS/Fly/Azure Web App)
- Secrets management (Vault/Azure Key Vault/Secrets Manager) + rotation

---

## 6) API Surface (target, minimal)
- POST `/api/auth/login` → issue access/refresh token (or set httpOnly cookie)
- POST `/api/auth/refresh` → rotate tokens
- GET `/api/safeboxes` → list
- POST `/api/safeboxes` → create
- GET `/api/safeboxes/{id}/tree` → folder/file tree
- POST `/api/files` → request presigned upload (returns upload URL and metadata)
- GET `/api/files/{id}/download` → redirect/stream download (presigned)
- POST `/api/zip` → server-side archive for directory/tree (stream)
- GET `/api/audit` → paginated audit events
 - GET `/api/i18n/catalog?lang=xx` → catálogo de traducciones (plano)
 - GET `/api/i18n/languages` → idiomas habilitados
- POST `/api/storage/safeboxes` → create safebox (demo)
- GET `/api/storage/safeboxes` → list safeboxes for user (demo)
- POST `/api/storage/safeboxes/{id}/nodes` → create node (folder/file) (demo)
- GET `/api/storage/safeboxes/{id}/nodes` → list nodes in safebox (demo)
- DELETE `/api/storage/safeboxes/{id}` → delete safebox (demo)
- DELETE `/api/storage/nodes/{id}` → delete node (file/folder) (demo)

OpenAPI docs at `/v3/api-docs` and `/swagger-ui.html`.

---

## 7) Data Model (minimal, extendable)
- User: id (UUID), username (unique), email, passwordHash, firstName, lastName, role, createdAt
- SafeBox: id, name, ownerId, createdAt
- Node (folder/file): id, safeboxId, parentId (nullable), type, name, size, metadata, createdAt, modifiedAt, policy
- AuditLog: id, userId, action, targetType, targetId, details, ip, createdAt

Managed via Flyway migrations; soft-delete optional.

---

## 8) Security Checklist (baseline)
- Password hashing with BCrypt; never log secrets
- JWT or cookie sessions with proper SameSite/Secure/httpOnly
- CORS limited to known origins per environment
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP)
- Validation & sanitation on all inputs; centralized exception handling (Problem Details)
- Principle of least privilege for DB and cloud roles

---

## 9) Observability and Health
- Actuator: `/actuator/health` (readiness/liveness), `/actuator/metrics`
- Micrometer + Prometheus scraping
- Structured JSON logs; trace/correlation IDs across requests

---

## 10) Testing Strategy
- Backend: unit (services), integration (controllers/repos) with Testcontainers
- Frontend: unit (components), integration (React Testing Library), e2e (Playwright/Cypress)
- Contract tests (optional): OpenAPI-driven client generation and validation

---

## 11) DevOps and Environments
- `.env`/env vars for config; no secrets in repo
- Dockerfiles (multi-stage) for FE/BE; docker-compose for local dev (Postgres, pgAdmin)
- CI: build/test/lint; CD: image push and environment deploy

---

## 12) Known Issues (as of now)
- FE: Toolbar Download passes an array to a single-file `handleDownload`. Needs `handleDownloadSelected()`
- FE: FileTree metadata display doesn’t match mock data; either enrich tree or hide
- FE: Selection uses arrays; should use `Set` for performance
- FE: Login logs credentials (demo). Remove logs
- BE: Plaintext password comparison; no JWT; properties contain default user credentials; no Flyway
- FE: Falta helper plural generalizado (uso manual de `.one/.other`)
- FE: Algunos textos siguen en FALLBACK_MESSAGES y no centralizados en bundles

---

## 13) Update Cadence
- This document will be updated at end of working day or on request when notable improvements are made.

---

## 14) Next Actions (recommended)
1) Frontend: fix download handler + selection Set; add basic modals for add/rename
2) Introduce axios + React Query + MSW; migrate screens to data hooks
3) Backend: add PasswordEncoder + JWT skeleton + OpenAPI; prep Flyway baseline
4) i18n: agregar helper plural (Intl.PluralRules) + script verificador de claves + endpoint hash catálogo

When you signal the start of the “real app” phase, we’ll begin Phase 2–4 tasks and wire to managed Postgres and object storage.

---

## Update (Demo Cloud Storage Simulation)
- Added filesystem-backed storage simulation at `storage.root` (Windows path to OneDrive) to emulate cloud object storage per user.
- Backend APIs under `/api/storage`:
  - Ensure user root, create/list safeboxes, build directory tree, create subfolders
  - Upload, download, delete files using safe, normalized paths
- Frontend wiring (initial):
  - Dashboard lists safeboxes from backend for the logged-in user
  - SafeBoxDetail loads tree for selected safebox, supports add (upload demo file) and delete via backend
- Security: CORS enabled for Vite dev; endpoints open in demo (to be secured later with JWT/cookies)

## Documentation Index
- VAULTEDGE_TECH_PLAN.md (this file): overview, roadmap, updates
- docs/backend/README_STORAGE_SIM.md: demo storage design, endpoints, path rules
