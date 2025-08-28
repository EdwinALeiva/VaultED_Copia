# VaultEdge – Data Dictionary (Authoritative Reference)
**Version:** 2025-08-15 (update: generalized files; digital signing module added)  
**Scope:** Column-level definitions, constraints, enumerations, parameterization flags. No SQL included.

---

## Legend
- **PK**: Primary Key, **FK**: Foreign Key, **NN**: Not Null, **UQ**: Unique
- **Type**: Conceptual type for PostgreSQL target
- **Parametric?**: Value controlled via `config` or plan
- **Codes?**: Driven by a code table
- **Default**: Default value if any

---

## 1) Identity & Access

### `users`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | Surrogate PK |
| username | varchar(80) | ✓ | ✓ |  | Login handle (authentication) |
| email | varchar(255) | ✓ | ✓ |  | Contact email; verification |
| email_verified | boolean | ✓ |  | false | Email confirmation flag |
| password_hash | text | ✓ |  |  | Bcrypt/Argon2 hash |
| first_name | varchar(120) |  |  |  | Given name |
| last_name | varchar(120) |  |  |  | Family name |
| status | varchar(32) | ✓ |  | 'active' | Account status (Codes) |
| created_at | timestamp | ✓ |  | now | Creation time |
| updated_at | timestamp |  |  |  | Update time |
| last_login_at | timestamp |  |  |  | Last successful login |

### `user_auth_providers`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| user_id (FK) | UUID | ✓ |  |  | → users.id |
| provider | varchar(40) | ✓ |  |  | 'local','google','github' (Codes) |
| provider_user_id | varchar(255) | ✓ |  |  | External subject id |
| linked_at | timestamp | ✓ |  | now | When linked |

### `user_mfa`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| user_id (FK) | UUID | ✓ |  |  | → users.id |
| type | varchar(16) | ✓ |  |  | 'TOTP','email_otp' (Codes) |
| secret_ref | varchar(255) | ✓ |  |  | KMS/secret manager reference |
| enabled | boolean | ✓ |  | false | MFA active flag |
| recovery_codes_hash | text |  |  |  | Hash of recovery codes |

### `roles`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | smallint | ✓ | ✓ |  | PK; small set |
| scope | varchar(16) | ✓ |  |  | 'vault','safebox','global' |
| code | varchar(40) | ✓ | ✓ |  | Machine key (e.g., BOX_MANAGER) |
| name | varchar(80) | ✓ |  |  | Human label |
| description | text |  |  |  | |

### `permissions`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| role_id (FK) | smallint | ✓ |  |  | → roles.id |
| permission_code | varchar(40) | ✓ |  |  | e.g., BOX_DOWNLOAD |
**PK:** (role_id, permission_code)

### `vault_members`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| vault_id (FK) | UUID | ✓ |  |  | → vaults.id |
| user_id (FK) | UUID | ✓ |  |  | → users.id |
| role_id (FK) | smallint | ✓ |  |  | → roles.id(scope='vault') |
| added_by | UUID |  |  |  | User who invited |
| added_at | timestamp | ✓ |  | now | Invite time |
| status | varchar(16) | ✓ |  | 'active' | 'active','invited','removed' (Codes) |

### `safebox_participants`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| safebox_id (FK) | UUID | ✓ |  |  | → safeboxes.id |
| user_id (FK) | UUID | ✓ |  |  | → users.id |
| role_id (FK) | smallint | ✓ |  |  | → roles.id(scope='safebox') |
| can_read | boolean | ✓ |  | true | Cached permission |
| can_download | boolean | ✓ |  | false | Cached permission |
| can_upload | boolean | ✓ |  | false | Cached permission |

---

## 2) Tenanting & Grouping

### `organizations`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| name | varchar(160) | ✓ |  |  | Legal name |
| slug | varchar(80) | ✓ | ✓ |  | URL slug |
| status | varchar(16) | ✓ |  | 'active' | Lifecycle |
| billing_email | varchar(255) |  |  |  | Invoicing contact |
| country | varchar(2) |  |  |  | ISO-3166 |
| created_at | timestamp | ✓ |  | now | |

### `vaults`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| org_id (FK) | UUID |  |  |  | → organizations.id (nullable for personal) |
| owner_user_id (FK) | UUID | ✓ |  |  | → users.id |
| name | varchar(160) | ✓ |  |  | |
| description | text |  |  |  | |
| storage_tier | varchar(16) | ✓ |  | 'cold' | 'cold','standard','dynamic' (Codes) |
| created_at | timestamp | ✓ |  | now | |

### `vault_settings`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| vault_id (FK/PK) | UUID | ✓ | ✓ |  | → vaults.id |
| default_grace_days | int | ✓ |  | 60 | Grace period days |
| default_box_quota_bytes | bigint | ✓ |  | 1073741824 | Per-box quota |
| max_boxes | int |  |  |  | Soft cap |

---

## 3) Safebox Core

### `safeboxes`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| vault_id (FK) | UUID | ✓ |  |  | → vaults.id |
| status_id (FK) | smallint | ✓ |  |  | → safebox_status.id |
| primary_client_id (FK) | UUID | ✓ |  |  | → users.id |
| name | varchar(160) | ✓ |  |  | |
| description | text |  |  |  | |
| quota_bytes | bigint | ✓ |  |  | Box storage limit |
| used_bytes | bigint | ✓ |  | 0 | Denormalized usage |
| due_date | date |  |  |  | Billing due date |
| grace_until | date |  |  |  | Grace period end |
| blocked_at | timestamp |  |  |  | When access was blocked |
| created_at | timestamp | ✓ |  | now | |
| updated_at | timestamp |  |  |  | |

### `safebox_status` (codes)
| id | code | name | description |
|---|---|---|---|
| smallint | varchar(24) | varchar(80) | text |

### `keys`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| user_id (FK) | UUID | ✓ |  |  | → users.id |
| safebox_id (FK) | UUID |  |  |  | → safeboxes.id (nullable) |
| algo | varchar(16) | ✓ |  | 'RSA-4096' | Algorithm (Codes) |
| public_key_pem | text | ✓ |  |  | Public key only |
| fingerprint | varchar(128) | ✓ | ✓ |  | SHA-256 or similar |
| status | varchar(16) | ✓ |  | 'active' | |
| created_at | timestamp | ✓ |  | now | |
| rotated_at | timestamp |  |  |  | |

### `safebox_policies`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| safebox_id (FK/PK) | UUID | ✓ | ✓ |  | → safeboxes.id |
| allow_read_with_single_key | boolean | ✓ |  | false | View-only metadata allowed |
| require_two_keys_for_download | boolean | ✓ |  | true | Enforce 2 keys |
| require_two_keys_for_delete | boolean | ✓ |  | true | Enforce 2 keys |
| allowed_file_types | text/json |  |  |  | Whitelist |
| max_file_size_bytes | bigint |  |  |  | Upload cap |

---

## 4) Content & Versions (File-agnostic)

### `files`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| safebox_id (FK) | UUID | ✓ |  |  | → safeboxes.id |
| file_type_id (FK) | smallint | ✓ |  |  | → file_type.id |
| created_by (FK) | UUID | ✓ |  |  | → users.id |
| current_version | int | ✓ |  | 1 | Latest version number |
| name | varchar(255) | ✓ |  |  | Filename |
| content_type | varchar(255) |  |  |  | MIME type (e.g., application/pdf) |
| size_bytes | bigint |  |  |  | Denormalized from latest version |
| created_at | timestamp | ✓ |  | now | |

### `file_versions`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| file_id (FK) | UUID | ✓ |  |  | → files.id |
| version_no | int | ✓ |  |  | Monotonic per file |
| object_key | varchar(512) | ✓ |  |  | Storage location/key |
| sha256 | char(64) | ✓ |  |  | Integrity hash of content |
| size_bytes | bigint | ✓ |  |  | Size for this version |
| uploaded_by (FK) | UUID | ✓ |  |  | → users.id |
| uploaded_at | timestamp | ✓ |  | now | |
| status | varchar(16) | ✓ |  | 'available' | |
| metadata | jsonb |  |  |  | Arbitrary metadata (pages, EXIF, etc.) |

### `content_crypto`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| file_version_id (FK/PK) | UUID | ✓ | ✓ |  | → file_versions.id |
| aes_algo | varchar(16) | ✓ |  | 'AES-256-GCM' | |
| aes_encrypted_for_client | text | ✓ |  |  | Wrapped AES key |
| aes_encrypted_for_provider | text | ✓ |  |  | Wrapped AES key |
| nonce | bytea/base64 | ✓ |  |  | IV/nonce |
| tag | bytea/base64 | ✓ |  |  | GCM tag |

### `file_type` (codes)
| id | code | name | description |
|---|---|---|---|
| smallint | varchar(24) | varchar(80) | text |
**Suggested codes:** PDF, OFFICE_DOC, OFFICE_SHEET, OFFICE_SLIDE, IMAGE, AUDIO, VIDEO, ARCHIVE_ZIP, CSV, XML, JSON, PLAINTEXT, CONTRACT, OTHER

---

## 5) Audit & Observability

### `audit_action_type` (codes)
| id | code | name |
|---|---|---|
| smallint | varchar(40) | varchar(80) |
**Suggested codes (additions):** E_SIGN_START, E_SIGN_SIGNED, E_SIGN_COMPLETE, E_SIGN_REVOKE

### `audit_logs`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| action_type_id (FK) | smallint | ✓ |  |  | → audit_action_type.id |
| user_id (FK) | UUID |  |  |  | → users.id |
| safebox_id (FK) | UUID |  |  |  | → safeboxes.id |
| file_id (FK) | UUID |  |  |  | → files.id |
| file_version_id (FK) | UUID |  |  |  | → file_versions.id |
| result | varchar(16) | ✓ |  | 'SUCCESS' | 'SUCCESS','FAIL','BLOCKED' |
| ip | inet |  |  |  | Client IP |
| user_agent | text |  |  |  | Browser/Agent |
| details | jsonb |  |  |  | Extra metadata (e.g., policy decisions) |
| created_at | timestamp | ✓ |  | now | |

### `key_rotation_events`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| key_id (FK) | UUID | ✓ |  |  | → keys.id |
| performed_by (FK) | UUID |  |  |  | → users.id |
| old_fingerprint | varchar(128) | ✓ |  |  | |
| new_fingerprint | varchar(128) | ✓ |  |  | |
| rotated_at | timestamp | ✓ |  | now | |
| reason | text |  |  |  | |

---

## 6) Plans & Billing (revised)

### `plans`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | smallint | ✓ | ✓ |  | PK |
| code | varchar(24) | ✓ | ✓ |  | Plan code |
| max_boxes | int | ✓ |  |  | |
| box_quota_bytes | bigint | ✓ |  |  | |
| storage_tier_default | varchar(16) | ✓ |  | 'cold' | |
| grace_days | int | ✓ |  | 60 | |
| price_monthly_cents | int | ✓ |  |  | |
| price_annual_cents | int | ✓ |  |  | |

### `billing_profiles`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| scope | varchar(8) | ✓ |  | 'org' | 'org','vault','user' |
| scope_ref | UUID | ✓ |  |  | FK-like ref to payer entity |
| display_name | varchar(160) | ✓ |  |  | Name appearing on invoices |
| email | varchar(255) |  |  |  | Billing email |
| tax_id | varchar(48) |  |  |  | VAT/GST/EIN |
| address_json | jsonb |  |  |  | Postal address |
| default_payment_method_id (FK) | UUID |  |  |  | → payment_methods.id |
| created_at | timestamp | ✓ |  | now | |

### `payment_methods`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| billing_profile_id (FK) | UUID | ✓ |  |  | → billing_profiles.id |
| provider | varchar(24) | ✓ |  |  | 'stripe','manual' |
| provider_token | varchar(255) | ✓ |  |  | Tokenized reference from PSP |
| method_type_code | varchar(24) | ✓ |  | 'CARD' | (Codes) CARD, PAYPAL, BANK_TRANSFER, WALLET |
| brand_code | varchar(24) | ✓ |  | 'VISA' | (Codes) VISA, MASTERCARD, AMEX, PAYPAL, ACH, SEPA, etc. |
| last4 | char(4) |  |  |  | Card last 4 (nullable) |
| exp_month | smallint |  |  |  | Card expiration month |
| exp_year | smallint |  |  |  | Card expiration year |
| funding | varchar(16) |  |  |  | 'credit','debit','prepaid' (Codes) |
| label | varchar(160) |  |  |  | Friendly name |
| status | varchar(16) | ✓ |  | 'active' | 'active','inactive' |
| created_at | timestamp | ✓ |  | now | |

### `subscriptions`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| org_id (FK) | UUID |  |  |  | → organizations.id |
| vault_id (FK) | UUID |  |  |  | → vaults.id |
| safebox_id (FK) | UUID |  |  |  | → safeboxes.id |
| billing_profile_id (FK) | UUID | ✓ |  |  | → billing_profiles.id |
| plan_id (FK) | smallint | ✓ |  |  | → plans.id |
| status | varchar(16) | ✓ |  | 'active' | |
| current_period_start | timestamp |  |  |  | |
| current_period_end | timestamp |  |  |  | |
| due_date | date |  |  |  | |
| grace_until | date |  |  |  | |

### `invoices`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| subscription_id (FK) | UUID | ✓ |  |  | → subscriptions.id |
| amount_cents | int | ✓ |  |  | |
| currency | varchar(8) | ✓ |  | 'USD' | |
| status | varchar(16) | ✓ |  | 'open' | |
| billing_profile_snapshot | jsonb |  |  |  | Immutable payer info used at issue time |
| due_at | timestamp |  |  |  | |
| issued_at | timestamp | ✓ |  | now | |
| closed_at | timestamp |  |  |  | |

### `payments`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| invoice_id (FK) | UUID | ✓ |  |  | → invoices.id |
| payment_method_id (FK) | UUID |  |  |  | → payment_methods.id (nullable) |
| provider | varchar(24) | ✓ |  |  | 'stripe','manual' |
| provider_charge_id | varchar(80) |  |  |  | PSP charge/capture id |
| amount_cents | int | ✓ |  |  | |
| currency | varchar(8) | ✓ |  | 'USD' | |
| status | varchar(24) | ✓ |  | 'succeeded' | 'succeeded','failed','refunded','requires_action' |
| method_type_code | varchar(24) | ✓ |  |  | Snapshot of type used |
| brand_code | varchar(24) |  |  |  | Snapshot of brand (VISA, PAYPAL, etc.) |
| last4 | char(4) |  |  |  | Snapshot of card last4 |
| exp_month | smallint |  |  |  | Snapshot of expiration month |
| exp_year | smallint |  |  |  | Snapshot of expiration year |
| funding | varchar(16) |  |  |  | 'credit','debit','prepaid' |
| receipt_url | varchar(512) |  |  |  | Provider receipt |
| error_code | varchar(64) |  |  |  | On failures |
| error_message | text |  |  |  | On failures |
| paid_at | timestamp |  |  |  | Time of capture |

---

## Codes (billing additions)
- **payment_method_type**: CARD, PAYPAL, BANK_TRANSFER, WALLET  
- **payment_brand**: VISA, MASTERCARD, AMEX, DISCOVER, UNIONPAY, DINERS, JCB, PAYPAL, APPLE_PAY, GOOGLE_PAY, ACH, SEPA, WIRE  
- **payment_funding**: credit, debit, prepaid  
- **billing_profile_scope**: org, vault, user  
- **payment_status**: succeeded, failed, refunded, requires_action

---

## Config Keys (billing additions)
- `BILLING.ACCEPTED_METHODS` (json) — e.g., `["CARD","PAYPAL"]`  
- `BILLING.ACCEPTED_CARD_BRANDS` (json) — e.g., `["VISA","MASTERCARD","AMEX"]`  
- `BILLING.DEFAULT_PROVIDER` — e.g., `stripe`  
- `BILLING.RETRY_POLICY` — json (dunning strategy)  
- `BILLING.TAX_RULES` — json (per region)

---

## Compliance Notes
- **PCI DSS:** PSP tokenization; do not store PAN/CVV.  
- **Auditability:** keep immutable brand/type snapshots on `payments` and payer snapshot on `invoices`.

---

## 7) Notifications & Ops

### `notifications`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| user_id (FK) | UUID |  |  |  | → users.id |
| safebox_id (FK) | UUID |  |  |  | → safeboxes.id |
| channel | varchar(16) | ✓ |  | 'email' | 'email','web' |
| template_code | varchar(40) | ✓ |  |  | |
| payload | jsonb |  |  |  | Render variables |
| status | varchar(16) | ✓ |  | 'queued' | |
| created_at | timestamp | ✓ |  | now | |
| sent_at | timestamp |  |  |  | |

### `incident_tickets`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| safebox_id (FK) | UUID |  |  |  | → safeboxes.id |
| file_id (FK) | UUID |  |  |  | → files.id |
| opened_by (FK) | UUID | ✓ |  |  | → users.id |
| severity | varchar(16) | ✓ |  | 'low' | 'low','medium','high','critical' |
| status | varchar(16) | ✓ |  | 'open' | |
| title | varchar(160) | ✓ |  |  | |
| description | text |  |  |  | |
| created_at | timestamp | ✓ |  | now | |
| closed_at | timestamp |  |  |  | |

---

## 8) Digital Signing (N‑party, blockchain-ready)

### `e_sign_workflows`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| safebox_id (FK) | UUID | ✓ |  |  | → safeboxes.id |
| file_version_id (FK) | UUID | ✓ |  |  | → file_versions.id |
| created_by (FK) | UUID | ✓ |  |  | → users.id |
| status | varchar(16) | ✓ |  | 'draft' | 'draft','in_progress','completed','canceled','expired' |
| mode | varchar(16) | ✓ |  | 'parallel' | 'parallel','sequential' |
| expires_at | timestamp |  |  |  | Deadline |
| blockchain_network | varchar(16) |  |  | 'none' | 'polygon','arbitrum','none' |
| on_chain_policy | varchar(16) |  |  | 'final_receipt' | 'none','final_receipt','per_signature' |
| metadata | jsonb |  |  |  | Canonicalization, reasons, initial hash |

### `e_sign_participants`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| workflow_id (FK) | UUID | ✓ |  |  | → e_sign_workflows.id |
| user_id (FK) | UUID |  |  |  | → users.id (nullable for external) |
| display_name | varchar(160) | ✓ |  |  | |
| email | varchar(255) |  |  |  | Required if external |
| role | varchar(16) | ✓ |  | 'signer' | 'signer','approver','viewer' |
| order_index | int |  |  |  | Sequence for sequential mode |
| public_key_ref | varchar(255) |  |  |  | DID/KMS reference |
| status | varchar(16) | ✓ |  | 'pending' | 'pending','completed','declined','revoked' |

### `e_sign_events`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| workflow_id (FK) | UUID | ✓ |  |  | → e_sign_workflows.id |
| participant_id (FK) | UUID | ✓ |  |  | → e_sign_participants.id |
| file_version_id (FK) | UUID |  |  |  | → file_versions.id |
| blockchain_tx_id (FK) | UUID |  |  |  | → blockchain_tx.id |
| event_type | varchar(16) | ✓ |  | 'signed' | 'invited','viewed','signed','declined','revoked','completed' |
| signature_alg | varchar(24) |  |  |  | 'ECDSA-secp256k1','Ed25519', etc. |
| signature_hash | char(64) |  |  |  | Hash of signature payload |
| signature_envelope_ref | varchar(512) |  |  |  | Storage key/URI of signature artifact |
| details | jsonb |  |  |  | Extra metadata |
| created_at | timestamp | ✓ |  | now | |

### `e_sign_artifacts` (optional)
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| workflow_id (FK) | UUID | ✓ |  |  | → e_sign_workflows.id |
| participant_id (FK) | UUID |  |  |  | → e_sign_participants.id |
| artifact_type | varchar(32) | ✓ |  |  | 'signed_pdf','cades','notarization_receipt','evidence_summary' |
| object_key | varchar(512) | ✓ |  |  | Storage location |
| sha256 | char(64) | ✓ |  |  | Integrity hash |
| created_at | timestamp | ✓ |  | now | |

---

## 9) Blockchain (MVP++)

### `blockchain_tx`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| file_version_id (FK) | UUID |  |  |  | → file_versions.id |
| audit_id (FK) | UUID |  |  |  | → audit_logs.id |
| network | varchar(16) | ✓ |  | 'polygon' | |
| tx_hash | varchar(80) |  |  |  | Transaction hash |
| payload_hash | char(64) | ✓ |  |  | Hash anchored on-chain |
| tx_type | varchar(16) | ✓ |  | 'notarization' | 'notarization','signature' |
| created_at | timestamp | ✓ |  | now | |
| confirmed_at | timestamp |  |  |  | |
| status | varchar(16) | ✓ |  | 'submitted' | |

---

## 10) Configuration

### `config`
| Column | Type | NN | UQ | Default | Description |
|---|---|---|---|---|---|
| id | UUID | ✓ |  |  | PK |
| scope | varchar(16) | ✓ |  |  | 'global','org','vault','safebox','user' |
| scope_ref | UUID |  |  |  | Nullable reference per scope |
| key | varchar(120) | ✓ |  |  | Setting key |
| value | text | ✓ |  |  | Serialized value |
| type | varchar(8) | ✓ |  | 'string' | 'string','int','bool','json','bytes' |
| effective_from | timestamp |  |  |  | |
| effective_to | timestamp |  |  |  | |

**Examples:**  
- `SECURITY.MFA_REQUIRED=true (scope=global)`  
- `BILLING.GRACE_DAYS=60 (scope=vault)`  
- `UPLOAD.MAX_SIZE_MB=100 (scope=safebox)`  
- `CRYPTO.ALLOWED_ALGOS=["RSA-4096","ECC-P256"] (scope=global)`  
- `E_SIGN.DEFAULT_EXPIRY_DAYS=30 (scope=global)`  
- `E_SIGN.DEFAULT_BLOCKCHAIN="polygon"`  
- `E_SIGN.ON_CHAIN_POLICY="final_receipt"`

---

## 11) Enumerations (Suggested Seeds)
- `safebox_status`: ACTIVE, PAST_DUE, GRACE, BLOCKED, DELETED
- `file_type`: PDF, OFFICE_DOC, OFFICE_SHEET, OFFICE_SLIDE, IMAGE, AUDIO, VIDEO, ARCHIVE_ZIP, CSV, XML, JSON, PLAINTEXT, CONTRACT, OTHER
- `audit_action_type`: LOGIN, UPLOAD, DOWNLOAD, DELETE, BOX_CREATE, BOX_STATUS_CHANGE, MFA_SETUP, KEY_ROTATE, ACCESS_DENIED, E_SIGN_START, E_SIGN_SIGNED, E_SIGN_COMPLETE, E_SIGN_REVOKE
- `roles` (scope=vault): VAULT_OWNER, VAULT_MANAGER, VAULT_VIEWER
- `roles` (scope=safebox): BOX_OWNER, BOX_MANAGER, BOX_VIEWER, BOX_VIEW_NO_DL, BOX_AUDITOR
- `plans`: MICRO, BASIC, PRO, ENTERPRISE

---

## 12) Parameterization & Codes – Quick Map
- **Parameterizable via `config`:** MFA, allowed crypto algorithms, upload caps, grace days, quotas, default storage tier, role→permission overrides, audit retention, anomaly thresholds (alerts), **e-sign defaults** (expiry days, blockchain network, on-chain policy).
- **Codes (reference tables):** statuses, action types, file types, roles, plans, providers, e-sign event/status/mode codes.
