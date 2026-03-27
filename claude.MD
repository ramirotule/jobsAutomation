Quiero que actúes como arquitecto senior de automatizaciones y desarrollador full stack, experto en n8n, scraping responsable, integraciones web, matching de CVs, scoring de vacantes y creación de apps web para job hunting.

Necesito que me diseñes y, en la medida de lo posible, me generes la base de un sistema para automatizar la búsqueda de empleo según mi perfil profesional.
El objetivo es que el sistema lea mi CV, entienda mis skills y experiencia, busque vacantes en distintos portales y me entregue automáticamente oportunidades relevantes con sus links de postulación.

Objetivo del sistema

Quiero un flujo que haga esto:

Buscar empleos en múltiples fuentes como:

LinkedIn

Glassdoor

Indeed

Workana

Computrabajo

Bumeran

Get on Board

RemoteOK

Wellfound

otras fuentes que consideres útiles para perfiles tech

Leer mi CV y extraer:

título profesional

seniority

stack técnico

años de experiencia

industrias

tipo de trabajo deseado

modalidad preferida

nivel de inglés

Comparar cada vacante contra mi perfil y asignar un score de match

Filtrar resultados irrelevantes

Guardar automáticamente los resultados en una base o app

Mostrar:

título del puesto

empresa

fuente

ubicación

modalidad

salario si existe

seniority

stack requerido

score de match

motivo del match

link directo para postular

fecha de publicación

Permitir marcar estados:

pendiente

revisar

postulado

descartado

entrevista

Idealmente disparar alertas por:

email

Telegram

WhatsApp

panel web

Importante

Quiero que priorices una solución realista, mantenible y robusta.
No quiero una idea teórica. Quiero una propuesta técnica concreta.

Restricciones y criterio técnico

Si una plataforma no permite scraping estable o tiene muchas trabas, proponé alternativas más seguras:

APIs oficiales

feeds

Google Jobs

búsquedas en Google con operadores avanzados

integraciones vía RSS

email parsing

Si la postulación automática total es riesgosa o poco estable, proponé un enfoque semiautomático

No inventes APIs inexistentes

Indicá claramente qué parte sería:

100% automatizable

semiautomatizable

no recomendable automatizar

Lo que necesito que me entregues

Quiero que me devuelvas todo esto bien estructurado:

1. Propuesta de arquitectura

Decime cuál de estas dos opciones conviene más y por qué:

Opción A: workflow en n8n

Opción B: aplicación web propia

Opción C: arquitectura híbrida entre n8n + app web

2. MVP recomendado

Definí un MVP concreto que pueda construirse rápido y escalar luego.

3. Flujo funcional completo

Describí paso a paso cómo sería el proceso:

ingreso de CV

parsing del CV

definición de criterios de búsqueda

búsqueda por fuentes

normalización de vacantes

scoring de match

almacenamiento

notificaciones

seguimiento de postulaciones

4. Modelo de datos

Proponé tablas o colecciones para:

users

resumes

search_profiles

job_sources

job_posts

job_matches

applications

alerts

activity_logs

Incluí campos sugeridos.

5. Algoritmo de matching

Quiero una lógica de scoring clara.
Por ejemplo:

coincidencia de título

coincidencia de skills

seniority

modalidad remota/híbrida/presencial

ubicación

idioma

salario

tipo de contrato

Mostrame una fórmula o pseudocódigo de scoring.

6. Implementación en n8n

Si recomendás n8n:

proponé los nodos exactos

orden del workflow

triggers

transformaciones

deduplicación

almacenamiento

alertas

manejo de errores

rate limiting

retries

logs

Si podés, generá una primera versión del workflow en formato estructurado o pseudo-JSON para n8n.

7. Implementación como app web

Si recomendás app web:

proponé stack concreto

frontend

backend

base de datos

auth

scheduler

scraping/integrations layer

panel de oportunidades

panel de postulaciones

dashboard de estadísticas

Mi preferencia general es usar tecnologías modernas y productivas.
Podés sugerir algo como:

Next.js

Supabase

PostgreSQL

cron jobs / background workers

APIs externas

scraping controlado cuando corresponda

8. UI mínima recomendada

Describí pantallas mínimas:

login

carga de CV

perfil profesional editable

tablero de vacantes

detalle de vacante

tablero de postulaciones

configuración de alertas

9. Roadmap por fases

Dividilo en fases:

Fase 1: MVP

Fase 2: mejoras

Fase 3: automatización avanzada

Fase 4: IA y personalización

10. Riesgos y límites

Explicá claramente:

límites técnicos

límites legales o de términos de uso

problemas de scraping

cambios de DOM

captchas

bloqueos por IP

confiabilidad de datos

duplicados

falsos positivos en el matching

11. Recomendación final

Terminá diciendo qué harías vos si tuvieras que construir esto hoy para un desarrollador frontend con perfil React / React Native, buscando empleo de forma eficiente y sostenible.

Contexto del usuario

Voy a proporcionarte mi CV para que lo uses como base del matching.
Quiero que el sistema esté orientado a búsquedas de puestos como:

Frontend Developer

React Developer

React Native Developer

JavaScript Developer

TypeScript Developer

Y posiblemente también:

Full Stack con foco frontend

Mobile Developer

Entregable esperado

Quiero que me respondas con:

una arquitectura recomendada

un MVP realista

el diseño técnico

flujo funcional

modelo de datos

pseudocódigo de matching

propuesta n8n o app web

y, si es posible, una primera base de implementación

No me des una explicación genérica.
Quiero una respuesta práctica, concreta y orientada a construirlo.:∑;::
