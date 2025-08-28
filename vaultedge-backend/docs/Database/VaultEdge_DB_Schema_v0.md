# VaultEdge – Database Schema & Table Structure (Authoritative Reference)
**Version:** 2025-08-15 (update: generalized files; digital signing module added)  
**Scope:** Structural documentation only (no SQL).  
**Applies to:** VaultEdge demo (React + Spring Boot 3), PostgreSQL target.

---

## 1. Design Principles
- **Zero-knowledge custody:** metadata only in DB; encrypted blobs in object storage; AES keys never stored in plaintext.
- **Dual-key control:** download/replace/delete require **client + provider** key authorization (policy-driven).
- **Auditability first:** every sensitive action produces an immutable audit record.
- **Multitenant-ready:** organizations (tenants), vaults, and safeboxes modeled explicitly.
- **File-agnostic:** Vault stores **any file type** (PDF, Office, XML, CSV, ZIP, images, audio, video, etc.).
- **Parametric & code-driven:** operational behaviors controlled by configuration values and code tables (see annotations in each entity).
- **E-sign, multi-party, blockchain-backed (future module):** N-party signing workflows with optional notarization on blockchain.

> Note: Login uses **username** (not email). Email is stored and verified separately.

---

## 2. High-Level Logical Model
Domains and key entities:

- **Identity & Access:** `users`, `user_auth_providers`, `user_mfa`, `roles`, `permissions`, `vault_members`, `safebox_participants`
- **Tenanting & Grouping:** `organizations`, `vaults`, `vault_settings`
- **Safebox Core:** `safeboxes`, `safebox_status`, `keys`, `safebox_policies`
- **Content & Versions:** `files`, `file_versions`, `file_type`, `content_crypto`
- **Audit & Observability:** `audit_logs`, `audit_action_type`, `key_rotation_events`
- **Plans & Billing:** `plans`, `subscriptions`, `invoices`, `payments`
- **Notifications & Ops:** `notifications`, `incident_tickets`
- **Digital Signing (future-ready):** `e_sign_workflows`, `e_sign_participants`, `e_sign_events`, optional `e_sign_artifacts`
- **Blockchain (MVP++):** `blockchain_tx`
- **Configuration & Codes:** `config`, plus all *_type/status tables

---

## 3. ER Overview (textual)
- `organizations (1) ──< vaults (n)`  
- `vaults (1) ──< safeboxes (n)`  
- `users (n) ──< vault_members (n)` with role in vault  
- `users (n) ──< safebox_participants (n)` with role in safebox  
- `safeboxes (1) ──< files (n)`  
- `files (1) ──< file_versions (n)`  
- `file_versions (1) ──1 content_crypto (1)` (per version crypto metadata)  
- `users (1) ──< keys (n)`; `safeboxes (1) ──< keys (n)` (bind user key to safebox scope)  
- `audit_action_type (1) ──< audit_logs (n)` with optional refs to user/safebox/file/version  
- `plans (1) ──< subscriptions (n)`; `subscriptions (1) ──< invoices (n)` ──< `payments (n)`  
- **Digital signing:** `file_versions (1) ──< e_sign_workflows (n)` ──< `e_sign_participants (n)`; `e_sign_workflows (1) ──< e_sign_events (n)`; optional links to `blockchain_tx`

---

## 4. Table Structures (no SQL)

### 4.1 Identity & Access
#### `users`
- **PK:** `id` (UUID)
- **Columns:** `username` (UQ), `email` (UQ), `email_verified` (bool), `password_hash` (text), `first_name`, `last_name`, `status` (Codes), timestamps.
- **Indexes:** UQ(username), UQ(email), IX(status)
- **Parametric:** password policy + lock thresholds via `config`

#### `user_auth_providers`
- **PK:** `id` (UUID) — **FK:** `user_id → users.id`
- **Columns:** `provider` (Codes), `provider_user_id`, `linked_at`

#### `user_mfa`
- **PK:** `id` (UUID) — **FK:** `user_id → users.id`
- **Columns:** `type` (Codes), `secret_ref`, `enabled`, `recovery_codes_hash`
- **Parametric:** MFA requirement per scope via `config`

#### `roles`, `permissions`, `vault_members`, `safebox_participants`
- As previously defined (RBAC by scope). Cached perms on participants for speed; canonical perms in `permissions`.

---

### 4.2 Tenanting & Grouping
#### `organizations`, `vaults`, `vault_settings`
- As previously defined; `vault_settings` controls per-vault quotas and grace defaults (Parametric).

---

### 4.3 Safebox Core
#### `safeboxes`
- **PK:** `id` (UUID) — **FKs:** `vault_id`, `status_id`, `primary_client_id`
- **Columns:** `name`, `description`, `quota_bytes`, `used_bytes` (denorm), billing dates (`due_date`, `grace_until`, `blocked_at`), timestamps.
- **Parametric:** quotas and grace derived from plan/config.

#### `safebox_status` (codes)
- Codes: `ACTIVE`, `PAST_DUE`, `GRACE`, `BLOCKED`, `DELETED`.

#### `keys`
- **PK:** `id` (UUID)
- **FKs:** `user_id`, `safebox_id` (nullable for user-global)
- **Columns:** `algo` (Codes), `public_key_pem`, `fingerprint` (UQ), `status`, timestamps.
- **Parametric:** allowed algos via `config`

#### `safebox_policies`
- **PK/FK:** `safebox_id`
- **Columns:** `allow_read_with_single_key` (bool), `require_two_keys_for_download` (bool, default true), `require_two_keys_for_delete` (bool, default true), `allowed_file_types` (array/text), `max_file_size_bytes` (bigint).
- **Parametric:** all values configurable per safebox; defaults at vault/org/global.

---

### 4.4 Content & Versions (File-agnostic)
#### `files`
- **PK:** `id` (UUID)
- **FKs:** `safebox_id → safeboxes.id`, `file_type_id → file_type.id`, `created_by → users.id`
- **Columns:** `current_version` (int), `name`, `content_type` (MIME), `size_bytes` (denorm latest), `created_at`
- **Indexes:** (`safebox_id`,`name` UQ), `created_at`

#### `file_versions`
- **PK:** `id` (UUID)
- **FKs:** `file_id → files.id`, `uploaded_by → users.id`
- **Columns:** `version_no` (int), `object_key` (storage ref), `sha256` (integrity), `size_bytes`, `uploaded_at`, `status` ('available','soft_deleted'), `metadata` (jsonb for arbitrary file metadata; optional previews, page counts, etc.).
- **Indexes:** (`file_id`,`version_no` UQ)

#### `content_crypto` (per version)
- **PK/FK:** `file_version_id → file_versions.id`
- **Columns:** `aes_algo` ('AES-256-GCM'), `aes_encrypted_for_client` (text), `aes_encrypted_for_provider` (text), `nonce`, `tag`.
- **Parametric:** cipher suites via `config`

#### `file_type` (codes)
- **Purpose:** coarse-grained categorization and policy control (allow/deny, previews).  
- **Examples (suggested seeds):** `PDF`, `OFFICE_DOC`, `OFFICE_SHEET`, `OFFICE_SLIDE`, `IMAGE`, `AUDIO`, `VIDEO`, `ARCHIVE_ZIP`, `CSV`, `XML`, `JSON`, `PLAINTEXT`, `CONTRACT`, `OTHER`.

---

### 4.5 Security, Audit & Observability
#### `audit_action_type` (codes)
- Examples: `LOGIN`, `UPLOAD`, `DOWNLOAD`, `DELETE`, `BOX_CREATE`, `BOX_STATUS_CHANGE`, `MFA_SETUP`, `KEY_ROTATE`, `ACCESS_DENIED`, `E_SIGN_START`, `E_SIGN_SIGNED`, `E_SIGN_COMPLETE`, `E_SIGN_REVOKE`.

#### `audit_logs`
- **PK:** `id` (UUID)
- **FKs:** `action_type_id`, optional `user_id`, `safebox_id`, `file_id`, `file_version_id`
- **Columns:** `result`, `ip`, `user_agent`, `details` (jsonb), `created_at`
- **Parametric:** retention policy via `config`

#### `key_rotation_events`
- As previously defined.

---

### 4.6 Plans & Billing
- `plans`, `subscriptions`, `invoices`, `payments` — unchanged conceptually. Billing per **SafeBox**; grace → block flow. Parametric grace days/quotas/pricing.

---

### 4.7 Notifications & Ops
- `notifications`, `incident_tickets` — unchanged.

---

### 4.8 Digital Signing (N‑party, blockchain-ready)
> New domain supporting documents inside SafeBoxes to be digitally signed by two or more parties, with optional on-chain notarization. Signatures themselves may be stored as artifacts; hashes and receipts anchored to blockchain.

#### `e_sign_workflows`
- **PK:** `id` (UUID)
- **FKs:** `safebox_id → safeboxes.id`, `file_version_id → file_versions.id`, `created_by → users.id`
- **Columns:**  
  - `status` ('draft','in_progress','completed','canceled','expired') (**Codes**)  
  - `mode` ('parallel','sequential') (**Codes**)  
  - `expires_at` (timestamp, nullable)  
  - `blockchain_network` (e.g., 'polygon','arbitrum','none') (**Codes/Parametric**)  
  - `on_chain_policy` ('none','final_receipt','per_signature') (**Codes**)  
  - `metadata` (jsonb: signing reason, document hash at start, canonicalization method)

#### `e_sign_participants`
- **PK:** `id` (UUID)
- **FKs:** `workflow_id → e_sign_workflows.id`, optional `user_id → users.id` (nullable for external signers)
- **Columns:** `display_name`, `email` (nullable if internal), `role` ('signer','approver','viewer'), `order_index` (for sequential flows), `public_key_ref` (optional DID/KMS ref), `status` ('pending','completed','declined','revoked')

#### `e_sign_events`
- **PK:** `id` (UUID)
- **FKs:** `workflow_id → e_sign_workflows.id`, `participant_id → e_sign_participants.id`, optional `file_version_id → file_versions.id`, optional `blockchain_tx_id → blockchain_tx.id`
- **Columns:** `event_type` ('invited','viewed','signed','declined','revoked','completed') (**Codes**),  
  `signature_alg` (e.g., 'ECDSA-secp256k1','Ed25519'), `signature_hash` (char 64), `signature_envelope_ref` (storage key/URI), `created_at`, `details` (jsonb)

#### `e_sign_artifacts` (optional)
- **PK:** `id` (UUID)
- **FKs:** `workflow_id → e_sign_workflows.id`, optional `participant_id → e_sign_participants.id`
- **Columns:** `artifact_type` ('signed_pdf','cades','notarization_receipt','evidence_summary'), `object_key`, `sha256`, `created_at`

---

### 4.9 Blockchain (MVP++)
#### `blockchain_tx`
- **PK:** `id` (UUID)
- **FKs:** optional `file_version_id`, optional `audit_id`
- **Columns:** `network` ('polygon','arbitrum', ...), `tx_hash`, `payload_hash`, `created_at`, `confirmed_at`, `status` ('submitted','confirmed','failed'), `tx_type` ('notarization','signature') (**Codes**)
- **Parametric:** allowed networks via `config`

---

### 4.10 Configuration & Codes
#### `config`
- **PK:** `id` (UUID)
- **Columns:** `scope` ('global','org','vault','safebox','user'), `scope_ref` (UUID nullable), `key`, `value`, `type`, `effective_from`, `effective_to`
- **Examples:**  
  - `SECURITY.MFA_REQUIRED` (bool)  
  - `CRYPTO.ALLOWED_ALGOS` (json)  
  - `UPLOAD.MAX_SIZE_MB` (int)  
  - `BILLING.GRACE_DAYS` (int)  
  - `E_SIGN.DEFAULT_EXPIRY_DAYS` (int)  
  - `E_SIGN.DEFAULT_BLOCKCHAIN` ('polygon'|'none')  
  - `E_SIGN.ON_CHAIN_POLICY` ('none'|'final_receipt'|'per_signature')

---

## 5. Codes (additions for billing)
- `payment_method_type` — CARD, PAYPAL, BANK_TRANSFER, WALLET
- `payment_brand` — VISA, MASTERCARD, AMEX, DISCOVER, UNIONPAY, DINERS, JCB, PAYPAL, APPLE_PAY, GOOGLE_PAY, ACH, SEPA, WIRE
- `payment_funding` — credit, debit, prepaid
- `billing_profile_scope` — org, vault, user
- `payment_status` — succeeded, failed, refunded, requires_action

---

## 6. Configuration (selected keys for billing)
- `BILLING.ACCEPTED_METHODS` (json; per scope) — e.g., `["CARD","PAYPAL"]`
- `BILLING.ACCEPTED_CARD_BRANDS` (json; per scope) — e.g., `["VISA","MASTERCARD","AMEX"]`
- `BILLING.DEFAULT_PROVIDER` — e.g., `stripe`
- `BILLING.RETRY_POLICY` — json for dunning strategy
- `BILLING.TAX_RULES` — json; region-dependent

---

## 7. Privacy & Compliance Notes (billing)
- **PCI DSS:** never store PAN or CVV; store PSP **tokens** and non-sensitive metadata only.  
- **Immutability:** snapshot payer details & method brand on `invoices`/`payments` for consistent audit trails.  
- **Scoping:** acceptance rules may differ by **org/vault** via `config`.

---