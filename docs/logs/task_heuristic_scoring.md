# Registro de Cambios: Motor de Scoring Heurístico

## Tareas Completadas

- `[x]` **Tarea 1: Algoritmo Base**
  - Creado `apps/web/src/utils/scoring.ts`.
  - Implementada función `calculateHeuristicScore` que recibe texto y perfil.
  - Soporte de Case-Insensitive y Límite de Frontera de Palabra (`\b`).
  - Penalizaciones por `blacklist_terms`.
  - Puntuaciones: +20 title, +10 primary, +5 secondary.

- `[x]` **Tarea 2: Reemplazo en la UI (Buscar Empleo)**
  - Modificado `apps/web/src/app/buscar-empleo/page.tsx`.
  - Removido fetch a `/api/linkedin-score`.
  - Integrado `calculateHeuristicScore` de forma síncrona en el bucle principal.
  - Removida la lógica anterior de `applyBlacklistFilter` (ahora cubierta por el scoring con puntuación negativa).
  - Actualizado el tipo de retorno a `ScoringResult` para mostrar qué términos matchean exactamente.
  - Modificado `PostCard` y `PostModal` para mostrar el desglose de los puntos en la UI mediante "badges".

## Tareas Pendientes
- `[x]` **Tarea 3: Revisión de la Extracción de CV**
  - Creado endpoint `/api/cv/extract` para extraer Criterios del CV utilizando un LLM.
  - Generación de JSON estructurado, eliminando soft skills y expandiendo de forma semántica con herramientas relacionadas del ecosistema.
  - Agregado el botón "Autocompletar Criterios con IA" en la interfaz de CV en Perfil.
  - Implementada la vista del `_reasoning` en la UI, mostrando la justificación de la IA para las tecnologías que escogió extraer.
  - Eliminado el directorio obsoleto `/api/linkedin-score`.
