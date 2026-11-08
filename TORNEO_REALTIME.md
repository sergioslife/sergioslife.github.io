# Torneo Commander — arquitectura en tiempo real (GitHub Pages)

## Resumen
- **Anfitrión (`torneo.html`)**: gestión local existente (localStorage) + publicación opcional del estado vivo de la ronda/mesas a un backend en tiempo real.
- **Invitado / Companion (`companion.html`)**: vista móvil liviana. Se une por `?session=<codigo>&table=<mesa>&player=<id>` o selector. Lee estado del torneo/mesa y escribe contadores de vida/comandante/secundarios de su jugador.
- **Sincronización**: adaptador con Firestore (recomendado para GitHub Pages) y fallback `BroadcastChannel`/`localStorage` para pruebas en el mismo navegador.

## Firebase (producción)
1. Crea un proyecto en Firebase Console y habilita **Cloud Firestore**.
2. Copia la configuración web en `js/torneo/firebase-config.js` (ver plantilla).
3. Reglas iniciales (ajustar para producción):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /torneoSessions/{sessionId} {
      allow read: if true;
      allow write: if request.resource.data.keys().hasAny(['hostSecretHash']) == false
                   || resource == null; // simplificado: endurecer con auth/claims
      match /tables/{tableId} {
        allow read, write: if true; // endurecer: validar session/token/jugador
      }
    }
  }
}
```
4. Para privacidad real del anfitrión, usa **Firebase Auth** + reglas por `hostUid` (GitHub Pages no puede ocultar credenciales cliente; Firestore Rules son el control de acceso).

## Estructura modular
- `torneo.html` / `torneo.js` / `torneo.css`: host (existente, extendido con puente).
- `companion.html` / `css/companion.css` / `js/torneo/companion.js`: companion móvil.
- `js/torneo/firebase-config.js`: config (no commitear secretos reales en repos públicos si aplica; Firebase web config es identificador público, las reglas protegen datos).
- `js/torneo/sync.js`: capa de datos (Firestore/BroadcastChannel).
- `js/torneo/host-bridge.js`: publica estado host → sesión/mesa.
- `js/torneo/companion-model.js`: lógica pura de contadores/daño comandante.

## Modelo de datos (sesión)
`torneoSessions/{sessionId}`: `{ tournamentName, status, roundNumber, roundDurationSec, roundStartedAt, roundPausedDurationMs, roundPausedAt, hostUpdatedAt }`
`torneoSessions/{sessionId}/tables/{tableId}`: `{ tableIndex, players:[{id,name,life,poison,energy,experience,storm,commanderDamage:{[opponentPlayerId]:{commanderName,damage}}}], turnSecondsPerPlayer, activePlayerId }`
