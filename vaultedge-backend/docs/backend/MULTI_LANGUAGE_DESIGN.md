# VaultEdge Multi-Language (i18n) Design

## 1. Goals
- Provide end-to-end internationalization (i18n) across backend and frontend.
- Support rapid addition of new languages and runtime overrides without redeploy.
- Keep English (`en`) as canonical source; allow Spanish (`es`) as fully localized example.
- Ensure consistent key naming and interpolation placeholders shared by backend + frontend.
- Avoid heavy client-side i18n libraries initially (lightweight context) while keeping migration path open.

## 2. High-Level Architecture
```
+-------------+          HTTP (REST)           +-----------------+         Local Cache
| Frontend    |  GET /api/i18n/catalog?lang=es | Spring Boot API |  -->  ResourceBundle + DB overrides
| React (Vite)|  Accept-Language: es           | I18nController  |        (MessageSource / JPA)
+-------------+ ------------------------------> +-----------------+
       |                                                 |
       |  provides t(key,{vars}) via I18nContext         | loads base i18n/messages*.properties
       |  caches catalogs (localStorage)                 | merges DB "translations" overrides
       v                                                 v
 UI Components -----------------> useI18n() ----> translation lookup
```

## 3. Key Components & Classes
### Backend
| Layer | Element | Purpose |
|-------|---------|---------|
| Controller | `I18nController` | Exposes `/api/i18n/catalog` and `/api/i18n/languages` endpoints for the frontend. |
| Service | `I18nService` | Loads base property bundles + merges database overrides. Provides catalog map & resolve helper. |
| Model | `Translation` | JPA entity representing override entries (language, optional namespace, key, value). |
| Repository | `TranslationRepository` | JPA access to translations table (find by language). |
| Resources | `src/main/resources/i18n/messages*.properties` | Canonical message bundles for each language (en, es, fr, pt, de placeholders). |
| Spring Infra | `MessageSource` (auto-config) | Underlying mechanism for parameterized message lookups. |

### Frontend
| Layer | Element | Purpose |
|-------|---------|---------|
| Context | `I18nContext.jsx` | React context giving `t()`, `switchLanguage()`, current `lang`, messages, available languages. |
| Storage | `localStorage` | Caches selected language & full catalog JSON to reduce network calls. |
| Fetch | `/api/i18n/catalog` | Retrieves merged catalog for chosen language. |
| Components | e.g., `LoginForm`, `Dashboard`, `RightPanel`, `Vaults`, `AuditLog`, etc. | Consume `t(key, vars)` to render localized text. |

## 4. Message Source Strategy
1. Baseline messages defined in property files (e.g., `messages.properties`, `messages_es.properties`).
2. At runtime `I18nService.getCatalog(locale)` loads `ResourceBundle` for target locale.
3. Database overrides (table `translations`) are fetched and merged (override semantics: DB wins).
4. Resulting merged catalog returned as a flat `Map<String,String>` to the client.
5. Frontend merges received catalog with a minimal English fallback set (`FALLBACK_MESSAGES`) ensuring early render even before network completes.

## 5. Endpoints
### GET `/api/i18n/catalog?lang=<code>`
- Query param `lang` (optional) or `Accept-Language` header drives locale resolution.
- Returns JSON: `{ "locale": "es", "messages": { "login.title": "Inicio de sesión...", ... } }`.
- Locale resolution order: explicit `lang` > first in `Accept-Language` > default `en`.

### GET `/api/i18n/languages`
- Returns allowed languages list (currently English + Spanish) for UI selector.

## 6. Locale Resolution Logic
```
resolveLocale(langParam, acceptHeader):
  if langParam present -> Locale.forLanguageTag(langParam)
  else if Accept-Language present -> first segment
  else -> ENGLISH
```

## 7. Translation Keys & Namespacing
- Dotted notation: `<domain>.<section>.<label>` (e.g., `dashboard.box.usage.critical`).
- Groupings introduced as feature sets added: `rightPanel.*`, `vaults.*`, `settings.global.*`, `auditLog.*`.
- Consistent singular/plural forms where needed (`vaults.boxes.singular`, `vaults.boxes.plural`).
- Placeholders use `{name}` syntax and are replaced client-side (simple regex) or server side via `MessageSource` when needed.

## 8. Placeholder / Interpolation Rules
- Frontend: `t('dashboard.box.usage.aria', { percent: 42 })` yields `"Usage 42%"`.
- All placeholder keys must match exactly inside braces; multiple occurrences supported.
- Backend: `I18nService.resolve(key, locale, args...)` (currently minimal usage) supports traditional `MessageSource` patterns (`{0}`, `{1}`) if we extend; right now client handles most interpolation.

## 9. Database Override Model
`Translation` entity fields:
- `languageCode` (e.g., `en`, `es`)
- `namespace` (optional grouping, non-enforced)
- `translationKey` (unique within language combined index)
- `value` (text, up to 1000 chars)
- `updatedAt` (timestamp)

Index: `(languageCode, translationKey)` for fast retrieval.

Override Flow:
1. Admin inserts/updates a row to tweak wording without touching code.
2. Next catalog fetch merges override (DB value replaces property file entry).
3. Frontend refresh or language switch picks up change (manual reload if cached).

## 10. Caching Strategy
- Browser localStorage stored under key `vaultedge:i18n:catalog:<lang>`.
- On language switch: optimistic use of cached catalog (immediate UI update) then network fetch to refresh.
- Fallback merge order on client: `{...FALLBACK_MESSAGES, ...loadedCatalog}`.
- Server side currently no explicit cache; relies on JVM resource bundle caching (default) + quick DB query.

## 11. Adding a New Language
Steps:
1. Copy `messages.properties` to `messages_<lang>.properties` (e.g., `messages_fr.properties`).
2. Translate keys (may begin with partial subset; missing fall back to English at client).
3. (Optional) Add language entry to `/api/i18n/languages` list (controller static list).
4. Deploy backend – new bundle auto-discovered.
5. Frontend language switcher now displays new language (after step 3); user selects to load catalog.
6. (Optional) Insert DB overrides for live copy edits.

## 12. Handling Missing Keys
- Client returns the key itself if absent from merged map (visible marker of gap).
- Fallback set ensures critical navigation not blank.
- Planned enhancement: Logging missing keys to an endpoint for collection.

## 13. Error Handling & Resilience
- Failed catalog fetch: existing messages remain; `error` state set (components may choose to display a small notice).
- If localStorage quota errors occur, silently ignored.
- Invalid or corrupt JSON in cache: runtime try/catch prevents crash and refetches.

## 14. Performance Considerations
- Catalog size kept modest (flat map) – single HTTP request per language switch or first load.
- TreeMap on backend yields deterministic ordering (useful for diffing & debugging).
- Potential future optimization: ETag / If-Modified-Since to prevent re-downloading unchanged catalogs.

## 15. Security Considerations
- Read-only endpoints (no auth needed initially). If future languages become user-specific, can gate or sign responses.
- No sensitive data in messages; safe to cache client side.

## 16. Frontend Migration Path
- Current lightweight solution can be swapped with `i18next` or `react-intl` by:
  - Replacing `I18nContext` implementation with wrapper over chosen lib.
  - Retaining same key set for minimal component churn.
- Interpolation placeholders already compatible with common i18n libs (adjust pattern if needed).

## 17. Known Gaps / TODO
- Remaining components pending localization: `SafeBoxDetail.jsx`, `Companies.jsx`, `CompanySelector.jsx`.
- Spanish file contains a few encoding artifacts (e.g., mojibake in disclaimer, question mark) to clean.
- Support form keys currently store bilingual mixed text (`support.*`) – should separate per language.
- No automated static scan for stray literals yet.
- No caching headers/ETag support (could add for large catalogs).

## 18. Example Flow (Spanish Switch)
1. User selects "Español" in UI.
2. `switchLanguage('es')` updates state & localStorage.
3. Cached Spanish catalog (if present) merged & UI re-renders immediately.
4. Async fetch `/api/i18n/catalog?lang=es` returns latest; messages updated if changed.
5. Toast messages, navigation labels, forms now rendered in Spanish; pending areas still show English keys or text until localized.

## 19. Sample JSON Response
```json
{
  "locale": "es",
  "messages": {
    "app.title": "VaultEdge",
    "login.title": "Inicio de sesión en VaultEdge",
    "dashboard.title": "Panel",
    "vaults.panel.title": "Bóvedas"
    // ... trimmed
  }
}
```

## 20. Extending Runtime Overrides
- Add admin UI to CRUD `Translation` rows.
- Introduce optimistic cache invalidation (increment a version value; include in catalog response).
- If version differs, force refetch on clients.

## 21. Testing Strategy
- Manual: Switch languages & verify representative pages and toasts.
- Automated (future): Jest snapshot tests calling a mock `t()` catalog; integration test hitting `/api/i18n/catalog` for each supported language ensuring required key set completeness.
- Lint script (future): scan source for hard-coded English strings not wrapped by `t()`.

## 22. Key Design Choices Recap
- Flat map per language simplifies client merge & avoids nested path ambiguity.
- DB override layer lets product/content teams adjust phrasing without full redeploy.
- Lightweight custom context avoids early dependency lock-in while delivering immediate value.
- Progressive localization: components opt-in; missing keys obvious (shows key) for rapid iteration.

---
Prepared: 2025-08-16
