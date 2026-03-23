# WoW Guild Bot

Bot de Discord para gestionar una guild de World of Warcraft. Reclutamiento, raids, M+, integración con Blizzard API y Raider.IO.

## Requisitos

- Node.js 20+
- Un bot de Discord ([crear aquí](https://discord.com/developers/applications))
- (Opcional) App de Blizzard API ([crear aquí](https://develop.battle.net/))

## Setup

1. Clona el proyecto y entra a la carpeta
2. Instala dependencias:
   ```
   npm install
   ```
3. Copia `.env.example` a `.env` y llena los valores:
   ```
   cp .env.example .env
   ```
4. Configura tu bot en Discord Developer Portal:
   - Activa los intents: **Server Members**, **Message Content**
   - Genera URL de invitación con permisos: `Administrator`
   - Invita el bot a tu servidor
5. Ejecuta en modo desarrollo:
   ```
   npm run dev
   ```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Ejecuta el bot en modo desarrollo (tsx) |
| `npm run dev:watch` | Igual pero con auto-reload |
| `npm run build` | Compila TypeScript a JavaScript |
| `npm start` | Ejecuta la versión compilada |

## Estructura

```
src/
  index.ts          — Entry point
  config.ts         — Variables de entorno
  bot/
    client.ts       — Cliente de Discord
    commands/       — Slash commands
    events/         — Event handlers
    buttons/        — Button handlers
    modals/         — Modal form handlers
  api/
    blizzard.ts     — Blizzard API wrapper
    raiderio.ts     — Raider.IO API wrapper
  db/
    database.ts     — SQLite + migraciones
  utils/
    constants.ts    — Constantes (colores WoW, roles, etc.)
    embeds.ts       — Embed builders
```

## Comandos disponibles

- `/ping` — Latencia del bot
- `/help` — Lista de comandos
- `/info-guild` — Info general de la guild
- `/setup-server` — Configura roles y canales del Discord
- `/aplicar` — Formulario de aplicación a la guild
- `/crear-raid` — Crear evento de raid
- `/buscar-key` — Buscar grupo para M+
- `/personaje` — Lookup de personaje (Blizzard + Raider.IO)
- `/guild-progress` — Progreso de raid de la guild
- `/ranking-mplus` — Leaderboard de M+ de la guild
- `/afijos` — Afijos de M+ de la semana
