# Gem Merchant

Browser tabletop game for 2–4 players: collect gems, buy developments, attract nobles.

## Local development

```bash
cp .env.example .env.local
# SESSION_SECRET must be set. MongoDB is optional for local practice.
npm install
npm test
npm run dev
```

- Web: http://localhost:3100
- WebSocket: ws://localhost:3001/ws
- Practice table: http://localhost:3100/game/local (engine runs in the browser)

MongoDB is required for games to survive a server restart. Start one with:

```bash
docker compose up mongo -d
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js + WebSocket server |
| `npm test` | Game engine tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build` | Production Next.js build |

## Architecture

Rules live in `game-engine/` (no React). The WebSocket server is authoritative. The browser only requests actions. MongoDB stores `games`, `gameMoves`, and `gameResults`.

## Production

**Vercel + a separate game server (Railway/Render) + MongoDB Atlas:** follow [docs/deploy.md](docs/deploy.md).

**Single server:** see `docker-compose.yml`, `nginx/nginx.conf`, and `docs/backup.md`.

Set `SESSION_SECRET` to a long random value. Never commit `.env.local`.
Use HTTPS and `wss://` behind Nginx.

## Originality

Gem Merchant is an original game in the gem-collecting, card-building genre. It is not affiliated
with or endorsed by the publishers of any commercial board game. The name, card prices, patrons,
artwork and interface are original to this project; only general game mechanics (which are not
protected) are shared with the genre.
