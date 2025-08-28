# Documento de Flujo de Pantallas – VaultEdge

Versión: 2025-08-16  
Cobertura: Frontend actual (Dashboard, SafeBoxDetail, Vaults, Audit Log, Soporte, Ajustes, i18n) + modales y sub‑flujos clave.

---
## 1. Objetivo
Proporcionar una vista unificada y navegable de:
- Pantallas principales y su jerarquía.
- Estados / sub‑pantallas (modales, drawers, overlays, toasts significativos).
- Puntos de decisión del usuario y ramificaciones.
- Interacciones multi‑idioma (EN / ES / FR habilitados).

Este documento sirve como referencia para UX, QA, desarrollo y futura documentación de usuario.

---
## 2. Nomenclatura y Convenciones
| Símbolo | Significado |
|---------|------------|
| [Pantalla] | Vista de ruta principal (route-level) |
| (Estado) | Estado interno / variante visual dentro de una pantalla |
| {Modal} | Diálogo modal | 
| <Drawer> | Panel lateral deslizable | 
| → | Transición de navegación estándar |
| ⇢ | Transición condicional / alternativa |
| ⟳ | Acción que recarga / reprocesa |
| ◎ | Evento backend / side effect |
| 🛈 | Nota / restricción |

---
## 3. Mapa General (Nivel Alto)
```
[Login] → [Dashboard] → [SafeBoxDetail] ─┬─ <Drawer: Ajustes SafeBox>
                                        │
                                        ├─ <Drawer: Detalle Archivo>
                                        │      ├─ (Tab Preview)
                                        │      ├─ (Tab Metadata)
                                        │      ├─ (Tab Versions – placeholder)
                                        │      └─ (Tab Audit – placeholder)
                                        │
                                        ├─ {Modal: Crear Carpeta}
                                        ├─ {Modal: Confirmar Ubicación Carpeta}
                                        ├─ {Modal: Subir Archivos}
                                        ├─ {Modal: Confirmar Subida}
                                        ├─ {Modal: Conflictos Subida}
                                        ├─ {Modal: Reemplazar Archivo}
                                        ├─ {Modal: Confirmar Reemplazo}
                                        ├─ {Modal: Reemplazo Masivo}
                                        ├─ {Modal: Confirmar Reemplazo Masivo}
                                        ├─ {Modal: Importar Carpeta}
                                        ├─ {Modal: Confirmar Importación}
                                        ├─ {Modal: Conflictos Importación}
                                        ├─ {Modal: Conflicto Importación (uno)}
                                        ├─ {Modal: Borrar Selección}
                                        └─ {Modal: Borrar Carpeta}

[Dashboard] ──→ [Vaults Panel] ─→ (Asociar / Mover SafeBoxes)
           ├─→ {Modal: Nueva SafeBox}
           ├─→ {Modal: Nuevo Usuario} (si habilitado en menú)
           ├─→ [Audit Log]
           ├─→ {Modal: Reportar Bug}
           ├─→ {Modal: Contacto / Soporte}
           └─→ [Ajustes Globales]

[Ajustes Globales] ⇢ (Cambio de Idioma) → (Recarga Catálogo i18n) → Re-render UI
```

---
## 4. Rutas Principales
| Ruta (estimada) | Pantalla | Descripción Corta |
|-----------------|----------|-------------------|
| `/login` | Login | Autenticación inicial. |
| `/` o `/dashboard` | Dashboard | Listado y resumen de SafeBoxes + métricas laterales. |
| `/boxes/:id` | SafeBoxDetail | Navegación jerárquica de carpetas y archivos. |
| `/vaults` (panel lateral) | Vaults Panel | Gestión de vaults y asociación de SafeBoxes. |
| `/audit` | Audit Log | Filtros + exportación + paginación. |
| `/settings` | Ajustes Globales | Preferencias globales (idioma). |

---
## 5. Flujo de Autenticación
1. Usuario llega a [Login].
2. Ingresa credenciales → Validación local mínima.
3. Submit → ◎ Backend valida.
4. Éxito → Redirección a [Dashboard].
5. Error → Toast / mensaje (i18n) + permanece en formulario.
6. Opcional: Registro (si implementado) / recuperación futura.

Estados:
- (Cargando) desactiva botón.
- (Error credenciales) muestra mensaje `login.error.invalidCredentials`.

---
## 6. Dashboard
Elementos:
- Barra de búsqueda (filtra localmente / server TBD).
- KPIs panel derecho (carga asincrónica; placeholders loading).
- Lista de SafeBoxes con sort (campos: Recent, Cap, Used, Free, Sec, Type, Name).
- Badges de estado (BLOCKED, GRACE, RENEWAL SOON) cuando aplique.
- Menú de acciones globales (Crear SafeBox, Subir Archivo, Ajustes, Facturación, Reportar Bug, Soporte, Nuevo Usuario (si), etc.).

Acciones Principales:
- Seleccionar SafeBox → Navega a [SafeBoxDetail].
- Abrir Vaults Panel.
- Abrir modales (Nueva SafeBox, Reportar Bug, Soporte, Nuevo Usuario).
- Cambiar idioma vía Ajustes Globales.

Estados Vacíos / Errores:
- Sin resultados búsqueda → mensaje `dashboard.empty.noMatches`.
- Errores de uso / boxes → toasts `dashboard.error.*`.

---
## 7. SafeBoxDetail – Estructura
Sub‑Zonas:
- Breadcrumb / Header (root / carpeta actual + meta).
- Panel lateral izquierdo de carpetas (creación, importación, ZIP download).
- Tabla de archivos (selección múltiple, acciones por fila). 
- Zona de drop (drag&drop) cuando vacía.
- Barra de acciones (Upload, Download Selected, Delete Selected).
- Drawers:
  - Ajustes SafeBox (propietario, vault, email summary, retention, utilitarios).
  - Detalle Archivo (tabs preview / metadata / versions placeholder / audit placeholder).

Modales y Flujos Clave:
1. Crear Carpeta → Confirmar Ubicación (si es anidada) → Resultado + toast.
2. Subir Archivos:
   - Selección (multi) → Confirmar Subida (lista + agregados) → Posible Conflicto (replace / keep both / skip; opción aplicar a todos) → Progreso (overlay) → Resumen (toast pluralizado con replaced/keptBoth/skipped).
3. Reemplazar Archivo (single) → Confirmar → Progreso → Toast éxito / error.
4. Reemplazo Masivo → Confirmar (muestra ignored) → Progreso → Toast.
5. Importar Carpeta (input folder) → Confirmar Ubicación + include subfolders → Escaneo → Conflictos (global o single) → Progreso → Toast final.
6. Eliminar Selección (archivos) → Confirmar → Toast `filesDeleted.one/other`.
7. Eliminar Carpeta (con contenido) → Confirmar → Progreso / Toast.
8. Renombrar Archivo/Carpeta (interacción doble click + inline + toasts).

Estados Temporales:
- (Loading files…) spinner mensaje `safeBoxDetail.loading`.
- (Empty folder) UI vacía con hint.
- (Upload/Replace/Import in progress) overlay con cancel.

Toasts (principales): renames, upload summary, replace/update, delete, import folder, errores de espacio, conflictos, etc.

---
## 8. Vaults Panel
Objetivo: Gestionar *vaults* y asociación de SafeBoxes.
Flujo:
1. Abrir panel → Lista de vaults (current, associated, available).
2. Crear vault (form simple: name + notification email).
3. Seleccionar (Add / Remove / Move) con validaciones.
4. Toasts de resultado (created, failedAddBox, boxesMoved...).

Reglas:
- Añadir mueve la SafeBox de su vault actual (mensaje de hint).
- Validación de nombre (<=20). Email básico.

---
## 9. Audit Log
Funciones:
- Filtros de timestamp range, scope, safebox, texto mensaje.
- Paginación (`pager.showing`, prev/next).
- Exportaciones multi‑formato (PDF, CSV, XML, MD) + toasts de éxito/error.
- Botón de summary email(s).

Estados:
- (Loading), (Empty), (NoResults tras filtro).

---
## 10. Modales Transversales
| Modal | Disparador | Decision Points |
|-------|-----------|-----------------|
| Nueva SafeBox | Dashboard menú | Validación nombre, tamaño, securityType |
| Reportar Bug | Menú global | Guardar borrador / Enviar / Cerrar sin guardar |
| Contacto / Soporte | Menú global | Campos condicionales (docArea, billingPeriod) |
| Nuevo Usuario | Menú global | Validaciones username/email/password |

---
## 11. Ajustes Globales
- Selector de idioma (EN, ES, FR).
- Guardar aplica preferencia (persistencia futura). 
- Cambio de idioma → refresca catálogo (`/api/i18n/catalog?lang=xx`) → UI re-render.

---
## 12. Flujo de Cambio de Idioma
```
[Ajustes Globales] → Usuario selecciona idioma → switchLanguage(lang)
    → (LocalStorage persiste clave) → Fetch catálogo
        → Merge con FALLBACK_MESSAGES → setMessages → Re-render árbol
            → (Toasts futuros ya usan nuevo idioma)
```
Consideraciones:
- Claves faltantes muestran la clave (ayuda a QA).
- Soporte plural simple (.one / .other) ya en toasts de archivos / upload.

---
## 13. Estados de Error / Vacíos Relevantes
| Contexto | Clave / Mensaje | Acción de Usuario |
|----------|-----------------|-------------------|
| Sin SafeBoxes tras filtro | dashboard.empty.noMatches | Ajustar búsqueda |
| SafeBox carpeta vacía | safeBoxDetail.empty.* | Subir o importar |
| Falta espacio | safeBoxDetail.toasts.notEnoughSpace | Aumentar capacidad (futuro) |
| Upload sin selección | safeBoxDetail.toasts.noFilesInFolderInput | Reintentar con carpeta válida |
| Import sin archivos | safeBoxDetail.toasts.noFilesToImport | Activar subfolders / seleccionar otra |
| Error carga boxes | dashboard.error.loadBoxes | Reintentar / revisar red |
| Error carga uso | dashboard.error.loadUsage | Reintentar |
| Error renombrar | safeBoxDetail.toasts.renameFailed | Verificar conflicto nombre |

---
## 14. Eventos Backend Clave (◎)
| Evento | Pantalla Origen | Resultado UX |
|--------|-----------------|--------------|
| GET /api/i18n/catalog | Global (on lang switch) | Cambia idioma |
| GET /api/i18n/languages | App init | Popular dropdown idiomas |
| CRUD SafeBoxes / Files (varios endpoints) | SafeBoxDetail | Actualización lista / toast |
| Export audit | Audit Log | Archivo descargado / toast |

---
## 15. Internacionalización
Idiomas activos: EN, ES, FR.  
Patrones:
- Interpolación `{var}`.
- Plural manual: `.one` / `.other`.
Próximos pasos sugeridos:
- Helper plural genérico en `I18nContext`.
- Externalizar formateo de números / fechas según locale (Intl API).

---
## 16. Riesgos / Gaps Actuales
| Área | Riesgo | Mitigación |
|------|--------|------------|
| Pluralización compleja | Sólo binaria | Implementar reglas por locale (ej. Intl.PluralRules) |
| Fecha / hora | Posible formato fijo EN | Introducir formateadores por idioma |
| Accesibilidad (a11y) | Falta revisión ARIA exhaustiva | Auditoría a11y posterior |
| Estados no cubiertos | Errores red backend variados | Mapear códigos → claves i18n |

---
## 17. Siguientes Extensiones Propuestas
1. Plano de estados para proceso de importación (diagrama de máquina). 
2. Integrar feature flags para módulos (Version History, File Audit por archivo) cuando se activen.
3. Añadir breadcrumbs de vault en Dashboard para jerarquías profundas.
4. Registro de métricas UX (tiempo de subida, errores por acción) → Telemetría.

---
## 18. Diagrama de Flujo Detallado (SafeBox – Subida / Conflictos)
```
Usuario selecciona archivos
  ↓
(Validación tamaño / espacio) ⇢ [Error notEnoughSpace] → Toast & Fin
  ↓ ok
Mostrar {Modal: Confirmar Subida}
  ↓ Confirmar
Detectar conflictos nombres
  ├─ Sin conflictos → Iniciar carga → Overlay Progreso → (Éxito) Toast Resumen
  └─ Con conflictos → {Modal: Conflictos}
         ├─ Acción global (Replace / KeepBoth / Skip) + ApplyAll → Aplicar → Cargar restantes
         └─ Sin ApplyAll → Iterar cada conflicto (opción single)
                   ↓
             Cargar lote (stream)
                   ↓
             Construir resumen (uploaded, replaced, keptBoth, skipped)
                   ↓
             Toast pluralizado
```

---
## 19. Diagrama ASCII – Eliminación Selección
```
Seleccionar N archivos
  ↓
{Modal: Borrar Selección}
  ↓ Confirmar
Eliminar (◎ backend) →
  ├─ Éxito → Toast filesDeleted.one|other
  └─ Error  → Toast deleteFailed
```

---
## 20. Referencias de Claves i18n Críticas
- Cambio de idioma: `settings.languageLabel`, `settings.global.*`
- Upload summary: `safeBoxDetail.toasts.uploadSummary.*`
- Eliminación plural: `safeBoxDetail.toasts.filesDeleted.(one|other)`
- Estados vacíos: `dashboard.empty.noMatches`, `safeBoxDetail.empty.*`

---
## 21. Apéndice – Lista Resumida de Modales
| Módulo | Modales |
|--------|---------|
| Dashboard | Nueva SafeBox, Nuevo Usuario, Reportar Bug, Soporte |
| SafeBoxDetail | Crear Carpeta, Confirmar Ubicación, Subir, Confirmar Subida, Conflictos Subida, Reemplazar, Confirmar Reemplazo, Reemplazo Masivo, Confirmar Reemplazo Masivo, Importar Carpeta, Confirmar Importación, Conflictos Importación, Conflicto Importación (uno), Borrar Selección, Borrar Carpeta |
| Vaults | Crear Vault |
| Audit Log | (Rangos de filtro emergentes) |

---
## 22. Conclusión
Este flujo consolida las interacciones actuales y prepara la base para QA estructurado, expansión de idiomas y futuras mejoras (telemetría, pluralización avanzada, accesibilidad). Mantener sincronizado este documento conforme se añadan endpoints, pantallas o estados.

Fin.
