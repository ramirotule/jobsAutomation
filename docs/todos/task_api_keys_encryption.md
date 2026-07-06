# Implementación de Seguridad BYOK (Bring Your Own Key)

Este plan detalla la arquitectura para migrar de tokens almacenados en texto plano a una arquitectura de Encriptación del Lado del Servidor (Server-Side Encryption) usando AES-256-GCM.

## User Review Required

> [!WARNING]
> **Variable de Entorno Obligatoria**
> Vas a tener que generar y agregar una nueva variable de entorno `ENCRYPTION_KEY` (de 32 caracteres) en tu archivo `.env.local` y en tu plataforma de despliegue (ej. Vercel). Si se pierde esta llave, los tokens existentes se vuelven irrecuperables.

> [!IMPORTANT]
> **Migración de Datos**
> Como los tokens actuales están en texto plano, cuando hagamos este deploy, las llaves previas quedarán inservibles para los nuevos endpoints (porque van a intentar desencriptar un texto plano). Los usuarios van a tener que volver a ingresar sus APIs por primera y única vez. Como estamos en fase MVP, este comportamiento es aceptable.

## Open Questions

> [!NOTE]
> ¿Querés que escriba un script de migración para encriptar las llaves que ya están guardadas en texto plano en la base de datos, o no te molesta tener que pegar tus keys de nuevo en la UI? (Recomiendo lo segundo, es más rápido y limpio).

## Proposed Changes

---

### Módulo de Encriptación Core

#### [NEW] `apps/web/src/utils/encryption.ts`
Implementación de funciones criptográficas puras usando el módulo de Node.js `crypto`.
- `encrypt(text: string): string`: Recibe texto plano, devuelve texto cifrado en base64 con el IV incluido.
- `decrypt(encryptedText: string): string`: Recibe el cifrado y lo revierte usando la clave maestra `ENCRYPTION_KEY`.

---

### Endpoints (Servidor Seguro)

#### [NEW] `apps/web/src/app/api/tokens/route.ts`
Ruta dedicada para manejar los secretos sin exponerlos al cliente.
- **GET**: Consulta la tabla `search_profiles` para el usuario logueado y devuelve booleanos (ej: `{ has_gemini: true, has_apify: false }`). No devuelve los strings reales.
- **POST**: Recibe un payload con tokens en texto plano, los encripta usando la utilidad de encriptación y los guarda/actualiza en la base de datos.

#### [MODIFY] `apps/web/src/app/api/cv/extract/route.ts`
- Eliminar el parámetro `apiKey` del body.
- Buscar en base de datos la fila del usuario logueado (`supabase.auth.getUser()`).
- Desencriptar en memoria la key correspondiente al `provider` solicitado y hacer la llamada a la IA.

#### [MODIFY] `apps/web/src/app/api/linkedin-test/route.ts`
- Eliminar el parámetro `token` del body de la request.
- Consultar el `search_profile` del usuario logueado.
- Desencriptar `apify_key` para ejecutar las llamadas a la API de Apify de forma segura.

---

### UI & Frontend

#### [MODIFY] `apps/web/src/app/perfil/page.tsx`
- **Carga de Datos:** Dejar de popular los states de tokens directamente con las variables que vienen de Supabase. Fetch a `/api/tokens` para settear banderas booleanas.
- **Renderizado:** Si `has_gemini` es true, mostrar en el input un placeholder o valor simulado como `••••••••••••`.
- **Guardado:** Al hacer submit, enviar los valores que se hayan cambiado en los inputs hacia `POST /api/tokens`.

#### [MODIFY] `apps/web/src/app/buscar-empleo/page.tsx`
- Quitar el envío del `apify_key` (en texto plano) en el payload hacia la API de proxy de Linkedin. Depender exclusivamente del backend.

## Verification Plan

### Automated Tests
- No hay tests automatizados configurados para esta porción.

### Manual Verification
1. Generar la variable `ENCRYPTION_KEY` de 32 bytes y reinciar el server de desarrollo.
2. Ingresar a Perfil > Tokens. Pegar un token de Gemini y Apify y guardar.
3. Refrescar la página. Verificar que los inputs muestran un valor ofuscado y NO el token real.
4. Ir a la BD de Supabase (o revisar la terminal) y corroborar que el campo `gemini_key` está compuesto por caracteres ilegibles codificados en base64 y no dice `sk-...`.
5. Probar "Autocompletar Criterios con IA" en la pestaña de CV para asegurar que la desencriptación funciona (debería parsear el CV).
6. Ejecutar una búsqueda de empleo para asegurar que Apify también desencripta bien.
