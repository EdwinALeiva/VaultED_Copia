# VaultEdge Product Requirements Prompt (PRP)

Master requirements document designed so a human team **or a generative AI** can (re)implement the VaultEdge platform end‑to‑end with minimal ambiguity. Includes scope, data model, APIs, functional & non‑functional requirements, security, observability, testing, roadmap, algorithms and an integration prompt. All elements are structured to map directly to code.

> Baseline state captured: current implementation (filesystem demo + usage metrics + per‑SafeBox & user consolidated audit) as of 2025-08-09.

## Delta Addendum — 2025-08-12

This addendum documents UX, security, and functional refinements implemented today. It augments, but does not replace, the main PRP sections below.

### UX and Workflow Improvements
- Audit Log: consolidated search into a single inline Message filter with filter icon; removed next/prev controls.
- Sidebar/Dashboard: reordered menu and added dashboard refresh event; removed duplicate refresh from Dashboard header.
- Report a Bug: new page with environment capture, session drafts, and close/submit flows.
- Table readability: sky‑blue zebra striping, smaller fonts for date/size columns, denser rows; FileTree font reduced; active folder emphasized.

### Safe Box Creation & Metadata
- New Safe Box captures security type (single/dual key) and capacity selection; dashboard respects selected size.

### Capacity Enforcement
- Client‑side capacity checks before uploads and folder imports via `ensureCapacityForDelta`. Replacement considers size delta between old and new files.

### Import Folder Flow
- Robust folder picker: prefers File System Access API with fallback to `<input webkitdirectory>`; emulates `webkitRelativePath` for consistency.
- Per‑file conflict prompting with options Replace / Keep both / Skip and "Apply to all".
- Validation when Include subfolders is off: aborts with message if no files qualify in a selected subfolder.
- Container folder auto‑creation with graceful handling if it already exists.

### Cancellable Operations & Feedback
- All long‑running operations (upload, replace, download, import) are cancellable via AbortController.
- Cancel buttons and progress bars are shown in the relevant popups only; duplicate inline page controls removed.

### Security Hardening (Backend)
- Stateless sessions, CSP + XSS protection headers, BCrypt hashing, and global exception handling producing generic client messages.

### Documentation
- Updated frontend and backend READMEs; added Technical Overviews and a PRP product‑readiness summary for the SPA.

---
## 1. Product Vision
**VaultEdge** is a digital "SafeBox" platform where each user creates SafeBoxes (logical containers) to store files and folders. The system offers:
- Hierarchical organization (folders / subfolders) per SafeBox.
- Usage & capacity metrics per SafeBox (deterministic demo quotas; future configurable quotas).
- Detailed audit of actions (create safebox, create folder, upload, delete) consolidated at user level.
- Download single files or packaged ZIP of a path or selection.

Future objective: migrate from local filesystem to object storage (S3 / Blob), add robust authentication (JWT), real quotas, file versioning and fine‑grained access policies.

---
## 2. Scope
### In Scope (MVP + Extended Demo)
1. User management (basic entity + demo plaintext login).
2. Create & list SafeBoxes per user.
3. File tree: folders and files with metadata (size, modifiedAt, optional originalDate sidecar).
4. Upload, delete, and download files.
5. Usage metrics (usedBytes, fileCount, capacityBytes).
6. Audit (user + safebox) combined via endpoint.
7. ZIP download (full folder path or selection of files).
8. React UI: Dashboard, SafeBox Detail, Upload, New SafeBox, Audit Log.

### Near Future Phases
- Secure auth (BCrypt + JWT + refresh tokens).
- Presigned URLs (upload/download) with object storage.
- Simple versioning (retention of last N versions).
- Logical delete & retention policies.
- Roles (USER, ADMIN), delegation, invitations.

### Out of Scope (Now)
- Application‑level encryption (delegated to infra storage).
- OCR, full‑text indexing, antivirus, classification, public sharing.
- Real push/email notifications.

---
## 3. Personas
| Persona | Description | Key Needs |
|---------|-------------|-----------|
| End User | Manages own SafeBoxes | Upload, organize, download, usage & audit visibility |
| Admin (future) | Monitors global usage | Reports, quotas, aggregated audit |
| Auditor (future) | Compliance / forensic | Read‑only event access |

---
## 4. Functional Requirements
### 4.1 Users
- FR-U1: Create user with unique username & password (hash later, plaintext now).
- FR-U2: Login returns simple message (demo) or tokens (future).

### 4.2 SafeBoxes
- FR-SB1: Create SafeBox (name non‑empty, unique within user). Collision -> 409 (future enforcement).
- FR-SB2: List SafeBoxes alphabetically.
- FR-SB3: Fetch usage metrics for all SafeBoxes in one request.
- FR-SB4: Fetch usage for a single SafeBox.

### 4.3 File Structure
- FR-F1: Create subfolder (validate: no `..`, no absolute paths, no illegal chars).
- FR-F2: Upload file (multipart) with relative path (auto-create intermediate directories).
- FR-F3: Store optional original timestamp (epoch ms) in sidecar `<file>.orig`.
- FR-F4: Delete file (idempotent; if missing -> 204).
- FR-F5: Build full tree (exclude sidecars) with folders first then files sorted by name.
- FR-F6: Download single file preserving filename.
- FR-F7: Download ZIP of a path (folder or file) or selection of files (POST list).

### 4.4 Usage / Capacity
- FR-Use1: For each SafeBox return `{safeBoxName, usedBytes, fileCount, capacityBytes}`.
- FR-Use2: Demo capacity = deterministic hash(name) mapping to {1GB,3GB,5GB,25GB,100GB,1TB}.
- FR-Use3: Demo does NOT block over‑quota (future enforcement).

### 4.5 Audit
- FR-A1: Record events: CREATE_SAFEBOX, CREATE_FOLDER <folder>, UPLOAD_FILE <relativePath>, DELETE_FILE <relativePath>.
- FR-A2: Write `<safebox>.log` lines `ISO + space + message`.
- FR-A3: Duplicate event in `usuario.log` with prefix `<safebox>: message` (CREATE_SAFEBOX echoed or same message style).
- FR-A4: Combined endpoint merges all `.log` + `usuario.log`, parse, classify scope (USER/SAFEBOX), sort descending.
- FR-A5: Optional `limit` applied post-sort.

### 4.6 UI
- FR-UI1: Dashboard shows SafeBoxes + progress bar % usage + alerts (>=80% warn, >=95% critical).
- FR-UI2: SafeBox Detail: tree & list; actions upload, delete, create folder.
- FR-UI3: Audit Log: table (timestamp, scope, safebox, message) + scope filter + text search.
- FR-UI4: Upload view with relative path input and file picker.
- FR-UI5: New SafeBox simple form.

---
## 5. Non Functional Requirements
| Category | Requirement |
|----------|-------------|
| Performance | List SafeBoxes + usage <500 ms (≤200). Tree (5k nodes) <2 s server. |
| Scalability | Abstract storage to swap filesystem → object store without external API change. |
| Reliability | Idempotent actions where applicable (delete, ensure user). |
| Observability | Future structured logs + metrics (Actuator). |
| Portability | Multi-stage Docker. |
| Security | Path sanitization, future JWT + BCrypt, CORS restriction. |
| Maintainability | Clear service/controller layering. |
| Testability | Deterministic capacity + parseable audit format. |

---
## 6. Data Model (Current & Target)
### Current (Simplified)
- User: `id (UUID)`, `username`, `password` (plaintext demo)
- Storage (filesystem): Directory structure per user / safebox + sidecars `.orig` + `.log` files.

### Target DB (Future)
| Table | Key Fields |
|-------|-----------|
| users | id, username, password_hash, created_at |
| safeboxes | id, user_id, name, created_at, capacity_bytes (override) |
| nodes | id, safebox_id, parent_id, type(file/folder), name, size, created_at, modified_at, original_date, policy |
| audit_logs | id, user_id, safebox_id, action, path, details, created_at |

Indexes: users.username UNIQUE; safeboxes(user_id,name) UNIQUE; nodes(safebox_id,parent_id,name); audit_logs(user_id, created_at DESC).

---
## 7. API Specification (Current Demo)
Base URL Backend: `http://localhost:8081`

### Auth
| Method | Path | Body | Responses | Notes |
|--------|------|------|-----------|-------|
| POST | /api/login | `{username,password}` | 200 text / 401 / 404 | Demo; future JWT |

### Hello
| GET | /api/hello | – | 200 text | Health ping |

### Storage
| Method | Path | Params | Body | 200 Payload | Description |
|--------|------|--------|------|-------------|-------------|
| POST | /api/storage/users/{userId} | – | – | text | Ensure user root |
| GET | /api/storage/users/{userId}/safeboxes | – | – | `["SB1",...]` | List SafeBoxes |
| POST | /api/storage/users/{userId}/safeboxes?name=SB | name query | – | text | Create SafeBox + log |
| GET | /api/storage/users/{userId}/safeboxes/usage | – | – | `[{safeBoxName,...}]` | Usage all |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/usage | – | – | `{...}` | Usage one |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/tree | – | – | Node JSON | Full tree |
| POST | /api/storage/users/{userId}/safeboxes/{sb}/folders?name=folder | name | – | text | Create subfolder |
| POST | /api/storage/users/{userId}/safeboxes/{sb}/files | path form, file, originalDateMs? | multipart | file path | Upload |
| DELETE | /api/storage/users/{userId}/safeboxes/{sb}/files?path=rel | path | – | 204 | Delete file |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/files?path=rel | path | – | bytes | Download file |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/download/zip?path=rel | path? | – | zip bytes | ZIP path |
| POST | /api/storage/users/{userId}/safeboxes/{sb}/download/zip | – | `{paths:[...]}` | zip bytes | ZIP selection |
| GET | /api/storage/users/{userId}/audit?limit=500 | limit? | – | `[AuditEntry]` | Combined audit |

### Key JSON Structures
Node:
```json
{
  "type":"folder|file",
  "name":"Docs",
  "path":"docs/notes.txt",
  "size":1234,
  "modifiedAt":"2025-08-09T12:00:00Z",
  "createdAt":"2025-08-09T11:59:00Z",
  "originalDate":"2025-08-01T10:00:00Z",
  "children":[ ... ]
}
```
AuditEntry:
```json
{
  "scope":"USER|SAFEBOX",
  "safeBoxName":"Photos",
  "timestamp":"2025-08-09T12:34:56.789Z",
  "message":"UPLOAD_FILE imgs/cat.png"
}
```
SafeBoxUsage:
```json
{
  "safeBoxName":"Docs",
  "usedBytes":2048,
  "fileCount":8,
  "capacityBytes":5368709120
}
```

---
## 8. Business Rules & Validation
| Rule | Description | Error |
|------|-------------|-------|
| R1 | `safeBoxName` non empty, no `/` or `..` | 400 |
| R2 | `folderName` same constraints | 400 |
| R3 | `relativePath` must not escape base after normalization | 400/403 |
| R4 | Empty file upload -> 400 (configurable) | 400 |
| R5 | `limit` >0 and reasonable (≤5000) | 400 |
| R6 | Duplicate SafeBox per user -> 409 (future) | 409 |

---
## 9. Security (Current → Target)
### Current (Demo)
- Storage endpoints `permitAll`; plaintext passwords; CORS open to 5173/5174.

### Target
| Item | Implement |
|------|-----------|
| Password Hash | BCrypt (≥10 rounds) |
| Auth | JWT Access (15m) + Refresh (7d) / revocation store |
| Transport | HTTPS (reverse proxy) |
| CORS | Environment specific origins |
| Headers | HSTS, X-Content-Type-Options, X-Frame-Options:DENY, CSP baseline |
| Rate Limiting | Bucket (IP + user) for sensitive endpoints |
| Input Hardening | Validate path traversal, file size, allowed MIME |
| Secrets | Env vars / secret manager |

---
## 10. Audit & Logging
| Aspect | Requirement |
|--------|------------|
| Granularity | Event per mutating action |
| Timestamp | ISO 8601 UTC (Instant.now()) |
| Demo Persistence | Plain `.log` files in user folder |
| Consolidation | `usuario.log` echoes SafeBox events |
| Future DB | `audit_logs` table indexed by user + date |
| Rotation (future) | Daily roll + compression + retention N days |
| Correlation | Add requestId to logs (future) |

---
## 11. Key Algorithms
### 11.1 Deterministic Capacity
```
options = [1GB,3GB,5GB,25GB,100GB,1TB]
hash = fold chars with base 31
index = abs(hash) % options.length
capacity = options[index]
```
### 11.2 Tree Construction
- DFS `Files.walkFileTree(base)`.
- Ignore `.orig` files.
- Create folder nodes lazily; attach children; sort (folders first then name).
### 11.3 Audit Read
- List `*.log` in user root.
- Parse first space -> timestamp, remainder -> message.
- Scope: `usuario.log` => USER else SAFEBOX (filename without `.log`).
- Sort descending ISO timestamp; apply limit.

---
## 12. Accessibility (A11y)
| Area | Requirement |
|------|------------|
| Navigation | Icon buttons need `aria-label` |
| Contrast | ≥ 4.5:1 |
| Focus | Visible focus outline |
| Audit Table | Proper `<th>` headers, roles |

---
## 13. Internationalization (Future)
- Externalized string catalogs (JSON) with `en` fallback.
- Date formatting via Intl; backend always UTC ISO.

---
## 14. Configuration Variables
| Variable | Demo | Future |
|----------|------|--------|
| server.port | 8081 | Env PORT |
| spring.datasource.url | local postgres | Env / secrets |
| storage.root | Local path | S3 bucket prefix |
| LOG_LEVEL | DEBUG security | INFO prod |
| JWT_SECRET | (none) | Secret manager |
| MAX_UPLOAD_MB | unlimited | Config (e.g. 512) |

---
## 15. Error Format (Future)
Adopt RFC 7807 Problem Details example.

---
## 16. Testing Strategy
| Level | Targets | Tools |
|-------|---------|-------|
| Unit (BE) | StorageService (tree, usage, audit parse) | JUnit + Mockito |
| Integration (BE) | Controllers/Repos | SpringBootTest + Testcontainers |
| Unit (FE) | Components (Dashboard, AuditLog) | React Testing Library |
| E2E (FE) | User flows | Cypress / Playwright |
| Contract | OpenAPI vs impl | openapi-diff / schemathesis |

Acceptance Examples:
- Upload file -> Audit UPLOAD_FILE visible < 1s
- Tree excludes `.orig` always
- Usage `usedBytes` equals sum of file sizes

---
## 17. Metrics & Observability (Future)
| Metric | Description |
|--------|------------|
| safebox_files_total | File count per safebox |
| safebox_bytes_used | Bytes used (gauge) |
| uploads_total | Counter of uploads |
| audit_events_total | Counter of audit events |
| request_latency_ms | Histogram by endpoint |

---
## 18. Performance Budgets
| Operation | Budget |
|-----------|--------|
| List SafeBoxes + usage (200) | < 500 ms |
| Tree (5k nodes) | < 2 s |
| Audit fetch (5k entries) | < 600 ms |
| ZIP gen (100MB / 500 files) | < 8 s |

---
## 19. Evolution Roadmap (Phase Summary)
1. Cleanup + modals + Set selection
2. Axios + React Query + MSW
3. Security (BCrypt + JWT) + Flyway baseline
4. Object storage + presigned URLs + streaming ZIP
5. Observability + rate limiting
6. CI/CD + containerization
7. Roles, versioning, retention policies

---
## 20. Assumptions
- One‑to‑many: User → SafeBoxes, SafeBox → Nodes
- No nested SafeBoxes (only folders inside a SafeBox)
- Max single file size in demo <1GB
- Server clock reliable (NTP); originalDate sidecar accepted as client truth

---
## 21. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Path traversal | Escape root | Normalize + startsWith(base) check |
| Audit log growth | IO degradation | Rotation + DB storage |
| Plaintext passwords | Security breach | Migrate to BCrypt ASAP |
| Unlimited upload size | Disk exhaustion | MAX_UPLOAD_MB + streaming |

---
## 22. Integrator Prompt (For AI)
"""
You are an engineer. Implement VaultEdge per this PRP:
- Backend: Spring Boot 3.1.5, Java 21. Implement endpoints in section 7. Use a filesystem StorageService with configurable root.
- Audit: log events (CREATE_SAFEBOX, CREATE_FOLDER, UPLOAD_FILE, DELETE_FILE) to `<safebox>.log` and `usuario.log` (`ISO_INSTANT + ' ' + message`).
- Usage: compute bytes & file count excluding `.orig`; deterministic capacity (section 11.1).
- Tree: recursive walk producing folder/file nodes (exclude `.orig`).
- Endpoints: EXACT names & params per table. Validation rules section 8. Demo error responses plain text.
- Frontend: React + Vite + Tailwind. Screens section 4.6. Call real endpoints for list, usage, tree, upload, delete, audit.
- Security: Leave endpoints `permitAll` now; insert TODOs for JWT.
Deliver: runnable with `mvn spring-boot:run` and `npm start`.
"""

---
## 23. MVP Completion Checklist
| Item | Status |
|------|--------|
| Storage APIs implemented | ✅ |
| Per SafeBox usage | ✅ |
| Combined audit | ✅ |
| File tree | ✅ |
| ZIP download | ✅ |
| UI Dashboard + SafeBox + Audit | ✅ |
| Real security (hash/JWT) | ⏳ |
| Object storage | ⏳ |
| Automated tests | ⏳ |

---
## 24. Glossary
| Term | Definition |
|------|-----------|
| SafeBox | Logical root container for a user's files |
| Sidecar `.orig` | Companion file with original timestamp epoch ms |
| AuditEntry | Action event record (user or safebox scope) |
| Deterministic Capacity | Quota derived from hashed name |

---
## 25. License / Internal Use
Internal planning & implementation guide. Not an end‑user legal terms document.

---
_Last updated: 2025-08-12._
