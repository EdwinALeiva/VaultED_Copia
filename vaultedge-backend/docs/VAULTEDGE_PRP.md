# VaultEdge Product Requirements Prompt (PRP)

Documento maestro de requerimientos diseñado para que un equipo humano **o una IA generativa** pueda implementar (o continuar) la plataforma VaultEdge end‑to‑end con el mínimo de ambigüedad. Incluye alcance, modelo de datos, APIs, requisitos funcionales y no funcionales, seguridad, observabilidad, pruebas y roadmap de extensiones. Todos los elementos están pensados para ser traducidos directamente a código.

> Estado base reflejado aquí: implementación actual (filesystem demo + métricas de uso + auditoría por archivos) al 2025-08-09.

---
## 1. Visión del Producto
**VaultEdge** es una plataforma tipo "SafeBox digital" donde cada usuario crea contenedores (SafeBoxes) para almacenar archivos y carpetas. El sistema ofrece:
- Organización jerárquica (carpetas / subcarpetas) por SafeBox.
- Cálculo de uso y capacidad por SafeBox (cuotas determinísticas demo; futuras cuotas configurables).
- Auditoría detallada de acciones (creación de safebox, carpetas, subida y eliminación de archivos) consolidada a nivel usuario.
- Descarga de archivos individuales o empaquetados (ZIP) de una ruta o conjunto de rutas.

Objetivo futuro: migrar de almacenamiento local (filesystem) a objeto (S3 / Blob), añadir autenticación robusta (JWT), cuotas reales, versionado de archivos y políticas de acceso fino.

---
## 2. Alcance (Scope)
### In-Scope (MVP + Demo Extendida)
1. Gestión de usuarios (entidad básica + login demo plaintext).
2. Creación y listado de SafeBoxes por usuario.
3. Árbol de ficheros: carpetas y archivos con metadatos (size, modifiedAt, originalDate opcional).
4. Subida, borrado y descarga de archivos.
5. Cálculo de métricas de uso (usedBytes, fileCount, capacityBytes).
6. Auditoría (usuario + safebox) combinada vía endpoint.
7. Descarga ZIP (carpeta completa o selección de archivos).
8. UI React para: Dashboard, Detalle SafeBox, Upload, Nuevo SafeBox, Audit Log.

### Futuro Cercano (Phase Next)
- Auth segura (BCrypt + JWT + refresh tokens).
- Presigned URLs (upload/download) en almacenamiento objeto.
- Versionado simple (retención N versiones).
- Borrado lógico y retención (retention policy).
- Roles (USER, ADMIN), delegación, invitaciones.

### Out of Scope (Ahora)
- Cifrado de datos en reposo gestionado a nivel app (se delega en almacenamiento infra).
- OCR, indexación full-text, antivirus, clasificación automática, sharing público.
- Notificaciones push / email reales.

---
## 3. Personas / Usuarios
| Persona | Descripción | Necesidades clave |
|---------|-------------|-------------------|
| End User | Usuario que gestiona sus SafeBoxes | Subir, organizar, descargar, ver uso y auditoría |
| Admin (futuro) | Monitorea uso global | Reportes, cuotas, auditoría agregada |
| Auditor (futuro) | Revisa conformidad | Acceso solo lectura a eventos |

---
## 4. Requisitos Funcionales Detallados
### 4.1 Usuarios
- RF-U1: Crear usuario con username único y password (hash futuro, plaintext demo actual).
- RF-U2: Login devuelve mensaje (demo) o tokens (futuro).

### 4.2 SafeBoxes
- RF-SB1: Crear SafeBox (nombre no vacío, único dentro del usuario). Colisión -> 409.
- RF-SB2: Listar SafeBoxes ordenados alfabéticamente.
- RF-SB3: Obtener métricas de todos (uso) en un solo request.
- RF-SB4: Obtener métricas de uno.

### 4.3 Estructura de Archivos
- RF-F1: Crear subcarpeta (validación: nombre sin `..`, ni rutas absolutas, ni caracteres ilegales). 
- RF-F2: Subir archivo (multipart) con ruta relativa (carpetas se crean implícitas).
- RF-F3: Guardar timestamp original opcional (epoch ms) en archivo sidecar `<file>.orig`.
- RF-F4: Eliminar archivo (si no existe -> 204 idempotente).
- RF-F5: Construir árbol completo (sin sidecars) con carpetas y archivos orden: carpetas primero luego archivos por nombre.
- RF-F6: Descargar archivo individual conservando nombre.
- RF-F7: Descargar ZIP de un path (carpeta o archivo) o selección de archivos (POST con lista).

### 4.4 Uso / Capacidades
- RF-Uso1: Para cada SafeBox devolver: `{safeBoxName, usedBytes, fileCount, capacityBytes}`.
- RF-Uso2: Capacidad demo = función determinística hash(nombre) -> set {1GB,3GB,5GB,25GB,100GB,1TB}.
- RF-Uso3: No exceder capacidad en demo (no se bloquea subida; futuro: prevenir si > quota).

### 4.5 Auditoría
- RF-A1: Registrar eventos:
  - CREATE_SAFEBOX
  - CREATE_FOLDER <folder>
  - UPLOAD_FILE <relativePath>
  - DELETE_FILE <relativePath>
- RF-A2: Guardar en `<safebox>.log` (una línea ISO + espacio + mensaje).
- RF-A3: Duplicar evento en `usuario.log` con prefijo `<safebox>:` excepto CREATE_SAFEBOX que va sin prefijo o con mismo formato actual.
- RF-A4: Endpoint combinado: mezclar todas las líneas `.log` + `usuario.log`, parsear, clasificar scope USER/SAFEBOX, ordenar desc.
- RF-A5: Parámetro `limit` (opcional) aplica slice tras ordenar.

### 4.6 UI
- RF-UI1: Dashboard muestra lista SafeBoxes + barra de progreso % uso + alerts (>=80% = warning, >=95% = critical).
- RF-UI2: SafeBox Detail: árbol y tabla o tarjetas (actual árbol + lista), acciones: subir, eliminar, crear carpeta.
- RF-UI3: Audit Log: tabla con (timestamp, scope, safebox, message) + filtro scope + búsqueda por texto.
- RF-UI4: Upload view con path relativo input y archivo.
- RF-UI5: Crear SafeBox simple form.

---
## 5. Requisitos No Funcionales
| Categoría | Requerimiento |
|-----------|---------------|
| Rendimiento | Listado de SafeBoxes + uso: < 500 ms con hasta 200 SafeBoxes (demo). Árbol de 5k nodos < 2 s. |
| Escalabilidad | Diseñar para mover storage a S3/Blob sin cambiar API externa. |
| Confiabilidad | Operaciones de escritura idempotentes donde aplica (delete, ensure user). |
| Observabilidad | Logs estructurados futuros + métricas (Actuator). |
| Portabilidad | Empaquetable en Docker multi-stage. |
| Seguridad | Evolución hacia JWT + BCrypt, CORS restringido, sanitización paths. |
| Mantenibilidad | Código separado en servicios (StorageService), entidades, controladores. |
| Testeabilidad | Métodos deterministas para capacity y auditoría parseable. |

---
## 6. Modelo de Datos (Actual + Target)
### Actual (Simplificado)
- User: `id (UUID)`, `username`, `password` (plaintext demo)
- Storage (filesystem): Estructura de carpetas por usuario / safebox / archivos + sidecars `.orig` + logs `.log`.

### Target DB (Futuro)
| Tabla | Campos clave |
|-------|--------------|
| users | id, username, password_hash, created_at |
| safeboxes | id, user_id, name, created_at, capacity_bytes (opcional override) |
| nodes | id, safebox_id, parent_id, type(file/folder), name, size, created_at, modified_at, original_date, policy |
| audit_logs | id, user_id, safebox_id, action, path, details, created_at |

Indices sugeridos: (users.username UNIQUE), (safeboxes.user_id,name UNIQUE), (nodes.safebox_id,parent_id,name), (audit_logs.user_id, created_at DESC).

---
## 7. API Especificación (Actual Demo)
Base URL Backend: `http://localhost:8081`

### Auth
| Método | Ruta | Body | Respuestas | Notas |
|--------|------|------|-----------|-------|
| POST | /api/login | `{username,password}` | 200 texto / 401 / 404 | Demo; futuro JWT |

### Hello
| GET | /api/hello | – | 200 texto | Health/simple ping |

### Storage
| Método | Ruta | Params | Body | 200 Payload | Descripción |
|--------|------|--------|------|-------------|-------------|
| POST | /api/storage/users/{userId} | – | – | texto | Ensure user root |
| GET | /api/storage/users/{userId}/safeboxes | – | – | `["SB1",...]` | Lista SafeBoxes |
| POST | /api/storage/users/{userId}/safeboxes?name=SB | name query | – | texto | Crea SafeBox + log |
| GET | /api/storage/users/{userId}/safeboxes/usage | – | – | `[{safeBoxName,...}]` | Uso todos |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/usage | – | – | `{...}` | Uso uno |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/tree | – | – | Node JSON | Árbol completo |
| POST | /api/storage/users/{userId}/safeboxes/{sb}/folders?name=folder | name query | – | texto | Crea subcarpeta |
| POST | /api/storage/users/{userId}/safeboxes/{sb}/files | path form, file multipart, originalDateMs optional | multipart | ruta archivo | Upload |
| DELETE | /api/storage/users/{userId}/safeboxes/{sb}/files?path=rel | path query | – | 204 | Delete archivo |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/files?path=rel | path query | – | bytes | Download archivo |
| GET | /api/storage/users/{userId}/safeboxes/{sb}/download/zip?path=rel | path opt | – | bytes zip | ZIP path |
| POST | /api/storage/users/{userId}/safeboxes/{sb}/download/zip | – | `{paths:[...]}` | bytes zip | ZIP selección |
| GET | /api/storage/users/{userId}/audit?limit=500 | limit opt | – | `[AuditEntry]` | Auditoría combinada |

### Estructuras JSON Clave
Node:
```json
{
  "type":"folder|file",
  "name":"Docs",
  "path":"docs/notes.txt", // relative within safebox
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
## 8. Reglas de Negocio y Validación
| Regla | Descripción | Error si falla |
|-------|-------------|---------------|
| R1 | `safeBoxName` no vacío, sin `/` ni `..` | 400 |
| R2 | `folderName` no vacío mismo criterio | 400 |
| R3 | `relativePath` al subir no escapa base (normalización) | 400 / 403 |
| R4 | Archivo vacío -> permitido (o 400 configurable) | 400 (actual) |
| R5 | Límite `limit` audit >0 y razonable (<=5000) | 400 |
| R6 | Duplicado de SafeBox en mismo usuario -> 409 (futuro) | 409 |

---
## 9. Seguridad (Estado Actual → Objetivo)
### Actual (Demo)
- Endpoints de storage `permitAll` (expuesto). Password sin hash. CORS abierto a 5173/5174.

### Objetivo
| Ítem | Implementar |
|------|-------------|
| Password Hash | BCrypt 10 rounds mínimo |
| Auth | JWT Access (15m) + Refresh (7d) / Revoke store |
| Transporte | HTTPS obligatorio (reverse proxy) |
| CORS | Orígenes por entorno (DEV, STAGE, PROD) |
| Headers | HSTS, X-Content-Type-Options, X-Frame-Options:DENY, CSP básica |
| Rate Limiting | Bucket (IP + userId) p/ endpoints sensibles |
| Input Hardening | Validar path traversal, tamaño de archivos, MIME permitido |
| Secrets | Variables de entorno / gestor (Vault) |

---
## 10. Auditoría y Logging
| Aspecto | Requisito |
|---------|-----------|
| Granularidad | Evento por cada operación mutadora |
| Timestamp | ISO 8601 UTC (Instant.now()) |
| Persistencia Demo | Archivos plano `.log` en carpeta usuario |
| Consolidación | `usuario.log` eco de eventos de cada safebox |
| Futuro DB | Tabla audit_logs con índices por user y fecha |
| Rotación (futuro) | Corte diario + compresión + retención N días |
| Correlación | Añadir requestId en logs app para trazar (futuro) |

---
## 11. Algoritmos Clave
### 11.1 Capacity Determinística
```
options = [1GB,3GB,5GB,25GB,100GB,1TB]
Hash = fold chars nombre con base 31
Index = abs(Hash) % options.length
capacity = options[Index]
```
### 11.2 Construcción de Árbol
- DFS Walk `Files.walkFileTree(base)`.
- Ignorar archivos con sufijo `.orig`.
- Para cada directorio crear Node folder si no existe en mapa.
- Orden: sort children por (type asc: folder antes) luego nombre lower.
### 11.3 Lectura Audit
- Listar `*.log` en root usuario.
- Leer líneas; parse: primer espacio -> timestamp, resto -> mensaje.
- Determinar scope: `usuario.log` => USER; otro => SAFEBOX (nombre = filename sin `.log`).
- Ordenar desc por timestamp string (ISO) → estable.
- Limitar si `limit` definido.

---
## 12. Accesibilidad (A11y)
| Área | Requisito |
|------|-----------|
| Navegación | Todos botones con `aria-label` si icon-only |
| Contraste | Ratio >= 4.5:1 (paleta a revisar) |
| Focus | Indicador visible (outline / ring) |
| Tabla audit | Cabeceras `<th>` y uso de roles adecuados |

---
## 13. Internacionalización (Futuro)
- i18n strings externalizadas (JSON) con fallback en `en`.
- Formatos de fecha mediante Intl; backend siempre UTC ISO.

---
## 14. Configuración (Variables / Properties)
| Variable | Demo | Futuro |
|----------|------|--------|
| server.port | 8081 | Env PORT |
| spring.datasource.url | jdbc:postgresql://localhost:5432/vaultedge_db | Secrets / env |
| storage.root | Path local | S3 bucket prefix | 
| LOG_LEVEL | DEBUG (security) | INFO (prod), sec logs separado |
| JWT_SECRET | (no) | Env / Secret Manager |
| MAX_UPLOAD_MB | (sin límite) | Env (ej. 512) |

---
## 15. Errores y Formato de Respuesta (Futuro)
Adoptar RFC 7807 Problem Details:
```json
{
  "type":"https://errors.vaultedge.io/invalid-path",
  "title":"Invalid path",
  "status":400,
  "detail":"Relative path escapes base directory",
  "instance":"/api/storage/users/u1/safeboxes/box/files"
}
```

---
## 16. Estrategia de Testing
| Nivel | Objetos | Herramientas |
|-------|---------|-------------|
| Unit (BE) | StorageService (tree, usage, audit parse) | JUnit + Mockito |
| Integration (BE) | Controladores (REST) | SpringBootTest + Testcontainers (Postgres) |
| Unit (FE) | Componentes (Dashboard, AuditLog) | React Testing Library |
| E2E (FE) | Flujos usuario (crear safebox, subir, ver audit) | Cypress / Playwright |
| Contract | Schemas OpenAPI vs implementation | openapi-diff / schemathesis |

Criterios Aceptación (ejemplos):
- Subir archivo -> Evento audit UPLOAD_FILE visible < 1s.
- Árbol excluye `.orig` siempre.
- Uso suma de archivos coincide con sumatoria sizes devueltos por árbol (prueba cruzada).

---
## 17. Métricas y Observabilidad (Futuro)
| Métrica | Descripción |
|---------|-------------|
| safebox_files_total | Número archivos por safebox |
| safebox_bytes_used | Bytes usados (gauge) |
| uploads_total | Counter uploads |
| audit_events_total | Counter eventos audit |
| request_latency_ms | Histograma por endpoint |

---
## 18. Performance Budgets
| Operación | Presupuesto |
|-----------|------------|
| Listar SafeBoxes + uso (200 boxes) | < 500 ms server | 
| Árbol (5k nodos) | < 2 s server | 
| Audit fetch (5k entries) | < 600 ms server | 
| ZIP generación (100 MB, 500 archivos) | < 8 s (streaming recomendado) |

---
## 19. Roadmap Evolutivo (Resumen Fases)
1. Limpieza + modales + Set selection.
2. Axios + React Query + MSW.
3. Seguridad (BCrypt + JWT) + Flyway baseline.
4. Objeto storage + presigned URLs + streaming ZIP.
5. Observabilidad + rate limiting.
6. CI/CD y empaquetado container.
7. Roles, versionado y políticas de retención.

---
## 20. Asunciones
- Uno a muchos: User -> SafeBoxes, SafeBox -> Nodos.
- No hay nested SafeBoxes (solo carpetas dentro de un SafeBox).
- Tamaño máximo archivo razonable (<1GB) en demo; se ajustará en objeto storage.
- Reloj servidor confiable (NTP); no se corrige timestamp entrante salvo originalDate sidecar.

---
## 21. Riesgos y Mitigaciones
| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Path traversal | Escalada a archivos fuera raíz | Normalizar + startsWith(base) + reject |
| Crecimiento audit .log | Degradación IO | Rotación y DB futura |
| Plaintext passwords (demo) | Brecha seguridad | Migrar ASAP a BCrypt |
| Falta límites tamaño subida | Exceso disco | Config MAX_UPLOAD_MB + streaming |

---
## 22. Ejemplo Prompt Integrador (Para IA)
"""
Eres un ingeniero. Implementa VaultEdge según PRP:
- Backend: Spring Boot 3.1.5, Java 21. APIs listadas en sección 7. Usa StorageService (filesystem) con raíz configurable.
- Auditoría: registra eventos definidos (CREATE_SAFEBOX, CREATE_FOLDER, UPLOAD_FILE, DELETE_FILE) en `<safebox>.log` y `usuario.log`. Formato `ISO_INSTANT + ' ' + mensaje`.
- Uso: calcular bytes y count de archivos (excluyendo `.orig`) + capacidad determinística (ver sección 11.1).
- Árbol: recorrer recursivamente, construir JSON con nodos folder/file. Excluir `.orig`.
- Endpoints: EXACTOS según tabla. Validaciones sección 8. Respuestas de error 400/404/401/409 simples (texto) en demo.
- Frontend: React + Vite + Tailwind, pantallas en sección 4.6. Llamar endpoints reales para: lista safeboxes, uso, árbol, upload, delete, audit.
- Seguridad: dejar endpoints `permitAll` excepto futuros (marcar TODO). No incluir contraseñas en logs.
Entrega: código listo para `mvn spring-boot:run` y `npm start` (en dev)."""

---
## 23. Checklist de Compleción MVP
| Ítem | Estado |
|------|--------|
| APIs storage implementadas | ✅ |
| Uso por safebox | ✅ |
| Auditoría combinada | ✅ |
| Árbol de archivos | ✅ |
| ZIP download | ✅ |
| UI Dashboard + SafeBox + Audit | ✅ |
| Seguridad real (hash/JWT) | ⏳ |
| Almacenamiento objeto | ⏳ |
| Tests automatizados | ⏳ |

---
## 24. Glosario
| Término | Definición |
|---------|-----------|
| SafeBox | Contenedor lógico (carpeta raíz) de archivos de un usuario |
| Sidecar `.orig` | Archivo acompañante con timestamp original epoch ms |
| AuditEntry | Registro de evento de acción del usuario o safebox |
| Capacity Determinística | Cuota inferida por hash del nombre |

---
## 25. Licencia / Uso Interno
Documento para planeación interna y guía de implementación. No incluye términos legales de uso final.

---
_Última actualización: 2025-08-09 (sincronizado con VAULTEDGE_TECH_PLAN)._
