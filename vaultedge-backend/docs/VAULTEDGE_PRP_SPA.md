# VaultEdge Product Requirements Prompt (PRP) - Español (SPA)

Esta es la versión con sufijo SPA del documento maestro de requerimientos. Contenido completo original en español (pre‑sufijo) permanece como referencia histórica hasta su eliminación. Use esta versión para alineación bilingüe junto con `VAULTEDGE_PRP_EN.md`.

(Resumen)
- Vision, Alcance, Personas, Requisitos Funcionales y No Funcionales, Modelo de Datos, API, Reglas, Seguridad, Auditoría, Algoritmos, Accesibilidad, i18n, Configuración, Testing, Métricas, Performance Budgets, Roadmap, Asunciones, Riesgos, Prompt Integrador, Checklist, Glosario.

Para la descripción exhaustiva (tablas y ejemplos JSON), consulte la versión EN equivalente o el archivo histórico si sigue presente.

## Adenda de Cambios — 2025-08-12

- Búsqueda unificada en el Log de Auditoría (filtro en Mensaje con icono).
- Menú lateral reordenado; evento de refresco en dashboard; se quita refresco duplicado en cabecera.
- Página “Reportar un Bug” con captura de entorno y borradores de sesión.
- Mejora de tablas: zebra azul claro, tipografías más pequeñas, densidad mayor; árbol de carpetas más compacto con carpeta activa destacada.
- Creación de SafeBox: selección de tipo de seguridad (una/dos llaves) y capacidad; dashboard respeta la capacidad.
- Validaciones de capacidad antes de subir/importar; reemplazo considera delta de tamaño.
- Importar Carpeta: selector robusto (File System Access API con fallback), resolución de conflictos por archivo (Reemplazar / Conservar ambos / Omitir) con “aplicar a todos”, validación cuando "Incluir subcarpetas" está desactivado y no hay archivos elegibles; creación del contenedor con tratamiento idempotente.
- Operaciones cancelables (subir, reemplazar, descargar, importar) con AbortController; Cancelar y progreso solo en popups (sin duplicar en la página).
- Endurecimiento de seguridad en backend: sesiones sin estado, cabeceras CSP y XSS, BCrypt, manejo global de excepciones.
- Documentación actualizada (READMEs, Overviews y PRP del SPA).

Última actualización: 2025-08-12.
