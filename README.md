# Snake Game

Neon-themed Snake game for desktop and mobile.

## Run

```powershell
cd E:\codex\snake-game
python -m http.server 8080
```

Open `http://localhost:8080`.

## Controls

- Desktop: `Arrow Keys` or `W A S D`
- Start/Play Again: `Enter` or on-screen button
- Pause/Resume: `Space` or pause button
- Mobile: swipe on board + on-screen direction buttons

## Settings

- Speed
- Show Grid
- Wrap At Walls
- Sound Enabled

## Save Data

- High score, low score, and games played are saved in `localStorage`.

## Deploy

- Vercel: uses `vercel.json`
- Netlify: uses `netlify.toml`
- GitHub Pages: use branch deploy from root (`/`) with `.nojekyll`
