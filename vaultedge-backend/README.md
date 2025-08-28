
# VaultEdge Backend

Spring Boot backend for the VaultEdge platform.

## Stack

- Java 21 + Spring Boot 3.5
- Spring Security (stateless)
- BCrypt password hashing
- CORS configured for local dev (Vite on 5173/5174)
- Global exception handling

## Features

- Auth: basic `/api/login` endpoint (demo-friendly, returns generic errors to prevent enumeration)
- Hello: `/api/hello` health endpoint
- Storage API endpoints (placeholder wiring for local development): `/api/storage/**`

## Security hardening (today’s changes)

- Stateless sessions (`SessionCreationPolicy.STATELESS`)
- Content-Security-Policy header with safe defaults
- X-XSS-Protection header for legacy browsers
- BCrypt password encoder
- Centralized exception handling with generic client messages

## Run locally

1. Ensure PostgreSQL is running on `localhost:5432` (if required by your setup)
2. From this folder, run:

```bash
mvn spring-boot:run
```

Default port: `8081`

Check: http://localhost:8081/api/hello

## API overview

- POST `/api/login` — request body: `{ username, password }` → 200 OK or 401
- GET  `/api/hello` — returns a simple string for health checks
- `/**/api/storage/**` — permitted during local dev (frontend demos). Secure in production.

## Next steps

- Replace demo auth with JWT/opaque tokens
- Lock down `api/storage/**` with authorization rules
- Add OpenAPI/Swagger docs for all endpoints

## Encryption & Key Management Roadmap (Phase 0)

The focused cryptography PRP is present in `docs/PRP-Cryptography and flow.txt`. Implementation has not started; below is the staged plan mapped to current backend state.

| Phase | Goal | Backend Work | Frontend Work | Status |
|-------|------|--------------|---------------|--------|
| 1 | Public Key Registry | Entity + repo + service + REST (`POST/GET /api/v1/keys`), fingerprint calc | Generate keypairs (in-browser), register public keys | Pending |
| 2 | Dual-Key Approval Domain | Tables (approval_request, approval_signature), signature verify (Ed25519) | Sign approval payloads | Pending |
| 3 | Manifest Skeleton | Emit static manifest.json on SafeBox create/migration | Display manifest summary | Pending |
| 4 | Encrypt/Wrap MVP | Accept encrypted uploads + store wraps (single SafeBox key) | Client AES-GCM encrypt + wrap | Pending |
| 5 | Multi-Recipient + Lazy Rewrap | Add recipient, lazy/batch rewrap endpoints | Trigger rewrap on access | Pending |
| 6 | Rotation & Revocation | Key status fields + rotation rules | UI to rotate keys | Pending |
| 7 | Policy & Enforcement | Dual-sign enforcement gates downloads | Provide dual approvals UI | Pending |

Initial prerequisite is Phase 1 (key registry). No database schema objects for crypto exist yet.

### Immediate Backend Tasks (Recommended Order)
1. Create `user_key` table: id (UUID), user_id, type (ENC|SIG), algo, pem (text), fingerprint, created_at, revoked_at (nullable).
2. Service to compute fingerprint: SHA-256 over DER/PEM bytes, base64url encode.
3. Validation layer enumerating supported algos: `Ed25519`, `X25519`, `RSA-4096` (optional), reject others.
4. Audit events: emit `KEY_REGISTERED` (structure placeholder until full audit store lands).

### Out of Scope (Now)
- Streaming chunk encryption, hash anchoring, hardware-backed keys.

See the PRP preface for deeper rationale and deferrals.
