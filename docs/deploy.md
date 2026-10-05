# Deploying Gem Merchant (Vercel + a WebSocket host)

Gem Merchant is two programs:

| Part | What it does | Where it runs |
| --- | --- | --- |
| Website (Next.js) | Pages, the practice table, and `/api/*` routes that forward to the game server | **Vercel** |
| Game server (`server/index.ts`) | Always-on WebSocket server that runs every online game and saves it to MongoDB | **Railway** or **Render** (anything that keeps a Node process running) |
| Database | Keeps games alive across server restarts | **MongoDB Atlas** (free tier is fine) |

Vercel cannot run the game server: it only runs short-lived functions, and the game server must hold open connections.

The practice table (`/game/local`) runs entirely in the browser and works even without the game server.

## 1. MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/atlas.
2. **Database Access:** add a user and password.
3. **Network Access:** allow `0.0.0.0/0` (the game server's IP can change).
4. Copy the connection string, adding the database name:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/splendor`

## 2. A shared secret

Both hosts must use **the same** `SESSION_SECRET`. It signs each player's identity.

```bash
openssl rand -base64 48
```

The game server refuses to start in production with the example value from `.env.example`.

## 3. Game server on Railway (or Render)

### Railway

1. New project → Deploy from GitHub repo → pick this repository.
2. **Settings:**
   - Start command: `npm run start:ws`
   - Health check path: `/health`
3. **Variables:**

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `SESSION_SECRET` | the secret from step 2 |
   | `MONGODB_URI` | the Atlas string from step 1 |
   | `ALLOWED_ORIGINS` | your Vercel URL, e.g. `https://gem-merchant.vercel.app` (comma-separate several) |

   Don't set `WS_PORT`. Railway provides `PORT`, and the server uses it.
4. **Networking → Generate domain.** You get something like `gem-merchant-ws.up.railway.app`.

### Render (alternative)

1. Create a **Web Service** from the repository.
   - Build command: `npm ci`
   - Start command: `npm run start:ws`
   - Health check path: `/health`
2. Set the same variables as for Railway. Render also provides `PORT`.
3. Use a paid instance. Free instances sleep when idle, which disconnects players mid-game.

Check it works: `https://YOUR-WS-DOMAIN/health` should return `{"ok":true}`.

## 4. Website on Vercel

1. Import the repository in Vercel. The framework is detected as Next.js; keep the default build settings.
2. **Environment variables** (Production, and Preview if you use it):

   | Name | Value |
   | --- | --- |
   | `SESSION_SECRET` | the **same** secret as the game server |
   | `NEXT_PUBLIC_WS_URL` | `wss://YOUR-WS-DOMAIN/ws` |
   | `WS_INTERNAL_URL` | `https://YOUR-WS-DOMAIN` |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://gem-merchant.vercel.app` |

   The website never talks to MongoDB directly, so it doesn't need `MONGODB_URI`.
3. Deploy.

`NEXT_PUBLIC_*` values are baked in at build time. After changing them, redeploy.

## 5. Final check

1. Open the Vercel URL, go to **Create Game** and create a 2-player table.
2. Open the invite link in a private window and join.
3. Both players press Ready, then the host starts the game.
4. Refresh one tab mid-game: that player should get their seat back.

If a player sees "Connecting to the game…" forever:

- `NEXT_PUBLIC_WS_URL` is wrong, or the site wasn't redeployed after setting it.
- `ALLOWED_ORIGINS` on the game server doesn't exactly match the site's URL (scheme included, no trailing slash).
- `SESSION_SECRET` differs between the two hosts.

## How players are recognised across two domains

The website and the game server live on different domains, so the site's session cookie never reaches the game server:

1. When a page connects, it first calls `GET /api/session` on the website. That returns the player's signed session token and creates one if needed.
2. The page opens `wss://…/ws?token=…`.
3. The game server checks the signature with the shared `SESSION_SECRET`. The same player therefore keeps the same seat through refreshes and reconnects.

## Single-server alternative

`docker-compose.yml` and `nginx/nginx.conf` still let you run everything on one VPS instead. See the Production section of the README.
