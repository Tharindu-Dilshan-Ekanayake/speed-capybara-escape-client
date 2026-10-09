# +1 Speed Duck Escape — client

React + three.js (react-three-fiber) client for the Bloxity Legion platform.

```bash
npm install
npm run dev        # http://localhost:5173 - talks to ws://localhost:2567 (run the server repo)
npm run build      # production build (joins through the Bloxity matchmaker)
npm run sync-shared   # copy src/shared/* into the server repo after editing game rules
```

- `src/shared/` — **canonical** game data, economy rules, course layout and the lobby simulation
  (`lobbyLogic.js`). The server runs the same files; offline mode runs them in the browser.
- `src/game/` — scene, custom character controller (`physics.js`), ducks, avatar, world.
- `src/ui/` — HUD, panels, loading screen, touch controls.
- `src/net/` — matchmaker + Colyseus connection, offline fallback.

Players are always their Bloxity account (or a guest) — there is no login/logout UI.
If the server can't be reached, the lobby and all stages stay playable offline.

Deploy: push to `dev` / `main`; `.github/workflows/deploy.yml` uploads the build
(needs the `LEGION_DEPLOY_TOKEN` repo secret). Set `DEV_TOOLS` in `src/shared/gameData.js`
to `true` locally for the stage-jump dev panel messages.
