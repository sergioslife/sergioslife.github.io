# Torneo Commander — arquitectura tiempo real (GitHub Pages)

## Capas
- **Host/admin (`torneo.html` + `torneo.js`)**: fuente de verdad del torneo (jugadores, rondas, emparejamientos, puntuación). Persiste localmente en `localStorage` (`commander-tournaments`). Publica sesión/mesas a Firestore y **solo consume** `officialReport` enviado por la mesa.
- **Mesa invitada táctil (`mesa.html`, compat `companion.html`)**: vista 2x2 sincronizada estilo companion (Lifetap/MTG Companion). Estado cosmético en tiempo real: vida, veneno, experiencia, impuesto de comandante, daño de comandante por oponente/fuente nombrada, turno activo, tiempos usados. Al finalizar envía **resultado oficial** al host.
- **Sync (`js/torneo/sync.js`)**: Firestore (producción) o `BroadcastChannel`+`localStorage` (demo mismo navegador). `patchTable` fusiona estado compartido para no borrar `live/turn` al republicar metadatos.

## Estado dividido
**A. Tiempo real / persistencia ligera (`torneoSessions/{session}/tables/{tableId}`)**
- `live.{playerId}`: `life`, `poison`, `energy`, `experience`, `commanderTax`, `commanderDamage.{opponentId}.{commanderName,damage}`, `eliminated`, `elimination`, `timeUsedSec`.
- `turn`: `index`, `activePlayerId`, `startedAt` (turno activo; indicador visual + “Pasar turno” horario).
- Sesión: `roundDurationSec`, `roundStartedAt`, `roundPausedDurationMs`, `roundPausedAt`.

**B. Impacto oficial al torneo (host)**
Solo `officialReport` con `status:"submitted"`:
- `placements[]`: `playerId`, `placement` (1º–4º), `elimination`.
- `timeConsumedSec{playerId}` y `totalDurationSec`.
- `reason`: `eliminations | global-timeout | manual`.

`host-bridge` suscribe mesas activas; `app.applyOfficialTableReport` en `torneo.js` calcula puntos con `getPointsForPosition/scoring`, escribe `table.results`/duraciones, marca `table.completed` y actualiza standings. No se guardan en el host cambios cosméticos continuos de vida/comandante.

## Derrotas automáticas (mesa)
- Vida `<= 0`, veneno `>= 10`, daño de comandante `>= 21` de una misma fuente: se marca eliminado visualmente y se registra condición.
- Tiempo global agotado / 3 eliminaciones: habilita envío de resultado oficial (confirmación manual para evitar falsos positivos; puede automatizarse con regla estricta si se desea).
- Tiempo por turno/jugador se acumula mientras el jugador tiene turno activo.

## Firebase
Config: `js/torneo/firebase-config.js`. Firestore Rules (prueba): permitir `read,write` en `torneoSessions/{sessionId}` y `tables/{tableId}`. Producción: Firebase Auth + reglas por host/sesión; validar que invitados solo modifiquen `live/turn` y que `officialReport` sea controlado (idealmente Cloud Function) si se requiere integridad fuerte.

## Rutas
- Host: `torneo.html`
- Mesa: `mesa.html?session=<CODIGO>&table=<tableId>` (`companion.html` redirige conservando query)
