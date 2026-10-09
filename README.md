# +1 Speed Capybara Escape — client

React + three.js (react-three-fiber) client for the Bloxity Legion platform.
Game id: `1-speed-capybara-escape`.

```bash
npm install
npm run dev        # http://localhost:5173 - talks to ws://localhost:2567 (run the server repo)
npm run build      # production build (joins through the Bloxity matchmaker)
npm run sync-shared   # copy src/shared/* into the server repo after editing game rules
```

- `src/shared/` — **canonical** game data (capybaras, treadmills, 20 stages), economy rules,
  course layout (`course.js`) and the lobby simulation (`lobbyLogic.js`). The server runs the
  same files; offline mode runs them in the browser.
- `src/game/` — scene, custom character controller (`physics.js`), the capybara model
  (`Capybara.jsx`), rider, avatar, world.
- `src/ui/` — HUD, panels, loading screen, touch controls.
- `src/net/` — matchmaker + Colyseus connection, offline fallback.

Players are always their Bloxity account (or a guest) — there is no login/logout UI.
If the server can't be reached, the lobby and all stages stay playable offline.

## Deploy (GitHub Actions → Bloxity hosting)

1. Repo → Settings → Secrets and variables → Actions → **Secrets** tab → New secret
   **`LEGION_DEPLOY_TOKEN`** (the token from My Games).
2. Push to `dev` (→ `https://1-speed-capybara-escape.dev.play.bloxity.io`) or `main`
   (→ `https://1-speed-capybara-escape.play.bloxity.io`).

`.github/workflows/deploy.yml` lints, builds and uploads the zip. Set `DEV_TOOLS` in
`src/shared/gameData.js` to `true` locally for the stage-jump dev panel (keep it `false` when
you push).
