# Trail Quest

A pass-and-play board game for **2 to 8 players** on a single phone. No install, no accounts,
no server. Open the page, type everyone's name, and pass the phone around.

Built for roughly ages 8 to 20: the rules fit in one screen, but the push-your-luck decision
stays interesting for older players.

## The game

Race along a 35 tile trail. First player to reach the flag wins. On your turn you pick one thing:

- **Move 1, 2 or 3** — safe and exact, so you can choose the tile you land on.
- **Push your luck** — roll the die over and over, stacking up steps. Roll a **1** and you lose
  every step you stacked that turn.

Each action button previews what is waiting on the tile you would land on, so the choice is a real
one rather than a guess.

### Tiles

| Tile | Effect |
| --- | --- |
| ⚡ Boost | Jump 3 more tiles forward. |
| 🕳️ Pit | Fall back 4 tiles. |
| 🛡️ Shield | Take one. It blocks the next pit or shove. |
| 🌀 Warp | Swap places with whoever is in the lead. |

Land on another player and you **shove** them back 3 tiles, unless they spend a shield.

Tile effects never chain, so a boost that drops you onto a pit leaves you safe.

A game runs about 2 minutes with 2 players and about 6 minutes with 8.

## Running it locally

Everything is plain HTML, CSS and JavaScript with no build step and no dependencies. Open
`index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Publishing to GitHub Pages

Push to `main`. The workflow in `.github/workflows/pages.yml` deploys the site on every push,
so you only need to switch Pages on once:

1. Open the repository on GitHub.
2. Go to **Settings** then **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The site then lives at `https://<username>.github.io/<repository>/`, or at
`https://<username>.github.io/` if the repository is named `<username>.github.io`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure for the three screens: setup, game, results. |
| `styles.css` | Mobile-first styling, including a dark theme. |
| `script.js` | Board layout, turn flow, and every rule. |
| `.github/workflows/pages.yml` | Deploys the site to GitHub Pages. |
