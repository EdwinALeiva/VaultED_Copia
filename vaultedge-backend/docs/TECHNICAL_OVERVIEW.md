# VaultEdge Backend — Technical Overview

Date: 2025-08-16

## Architecture

- Spring Boot 3.5, Java 21
- Stateless API with Spring Security
- BCrypt password hashing
- CORS for local dev (Vite on 5173/5174)
- Global exception handling

## Key Modules

- `SecurityConfig.java`
  - Disables CSRF for API use
  - CORS config
  - Stateless sessions
  - Basic permit rules for demo endpoints (`/api/login`, `/api/hello`, `/api/storage/**` for local dev)
  - CSP and X-XSS-Protection headers
  - BCrypt PasswordEncoder bean

- `AuthController.java`
  - POST `/api/login` with generic failure responses to prevent enumeration
  - BCrypt match for stored hashes; fallback for demo plaintext

- `GlobalExceptionHandler.java`
  - Generic error responses; server logs hold details

- `HelloController.java`
  - Simple health endpoint

- `I18nController.java` (NUEVO)
  - GET `/api/i18n/catalog?lang=xx` devuelve catálogo plano de claves → valores
  - GET `/api/i18n/languages` lista idiomas habilitados (en, es, fr)

- `I18nService.java` (NUEVO)
  - Carga `classpath:i18n/messages*.properties` (resource bundles)
  - Fusiona overrides almacenados en BD (tabla `translation` vía `TranslationRepository`)
  - Devuelve `Map<String,String>` ordenado para consumo frontend

## Security Posture (Recent Additions)

- Stateless sessions to avoid server-side session fixation
- Strong password hashing using BCrypt
- Default CSP to limit sources
- XSS protection header for legacy clients
- Avoid detailed error responses to clients
- Explicit `permitAll` para `/api/i18n/**` (catálogo e idiomas) para permitir selección de idioma antes de login

## Local Run

```
mvn spring-boot:run
```

Port: 8081

## Future Work

- JWT or opaque token-based authentication
- Tighten storage endpoints and add authorization rules
- OpenAPI documentation
- Internacionalización avanzada:
  - Reglas de pluralización por locale (usar `Intl.PluralRules` en FE; parametrización en BE si es necesario)
  - Endpoint de administración de traducciones (crear/actualizar) con auth
  - Soporte de formateo de fechas/números según locale (Intl.* en FE / `Locale` en BE)
  - Extracción automatizada de claves (scan FE) para evitar faltantes

## Internationalization Overview (New)

| Aspecto | Implementación Actual |
|---------|-----------------------|
| Bundles | `src/main/resources/i18n/messages.properties`, `messages_es.properties`, `messages_fr.properties` |
| Endpoint catálogo | `/api/i18n/catalog` (query param `lang` o `Accept-Language`) |
| Idiomas habilitados | `/api/i18n/languages` → en, es, fr |
| Fallback | Frontend mantiene `FALLBACK_MESSAGES` mínimos (login, dashboard, algunos labels) |
| Overrides dinámicos | `TranslationRepository` (BD) sobre-escribe claves de bundle |
| Cache cliente | LocalStorage (`vaultedge:i18n:catalog:<lang>`) + invalidación implícita por clave completa |
| Selección idioma | Frontend `I18nContext` expone `switchLanguage(lang)` y persiste preferencia |
| Pluralización | Convención `.one` / `.other` en claves críticas (p.ej. `safeBoxDetail.toasts.filesDeleted`) |
| Interpolación | Marcadores `{variable}` reemplazados en FE (simple `replace`) y en BE vía `MessageSource` si se usa directamente |

### Flujo de Carga de Traducciones
1. Usuario abre aplicación (no autenticado) → `I18nContext` determina `lang` (localStorage o default `en`).
2. Llama `/api/i18n/catalog?lang=<code>`.
3. Mezcla resultado con `FALLBACK_MESSAGES` → re-render UI.
4. Selector de idioma (ahora muestra EN / ES / FR) dispara `switchLanguage` → repite proceso.

### Próximas Mejoras Sugeridas
- Añadir hash/versión en respuesta del catálogo para invalidar caches selectivamente.
- Incorporar `Intl.DateTimeFormat` y `Intl.NumberFormat` en formateos (tamaños, fechas, porcentajes) centralizados.
- Script CI para detectar claves huérfanas o faltantes entre locales.
- UI interna de edición de traducciones escribiendo overrides a BD.

## Frontend Alignment (Resumen Rápido)
El frontend ahora tiene una localización extensa del componente más complejo (`SafeBoxDetail`) incluyendo toasts y flujos de subida / importación, con soporte básico de pluralización. La adición de francés (fr) está lista y habilitada en el dropdown.
