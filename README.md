# Trail Quest

A pass-and-play board game for **2 to 8 players** on a single phone. No install, no accounts,
no server. Open the page, type everyone's name, and pass the phone around.

Built for roughly ages 8 to 20. The rules fit on one screen, and a player who thinks about
their choices wins noticeably more often than one who does not.

**Play it: https://brandonskar.github.io/trail-quest/**

## A turn

1. **Roll the die** and watch your piece walk that many spaces.
2. **Draw the card** for the space you land on. Some cards tell you what happens. Most give
   you a choice.
3. **Pass the phone.**

## Pieces

Everyone picks an animal before the game starts. Colour still comes from the seat, so two
players who choose similar animals are never hard to tell apart on the board. Pieces already
taken are locked in the picker, and your choice is remembered for next time.

## The board

The trail is a scrolling track that follows whoever is playing, so the board can be big enough
to read on a phone without shrinking the spaces. Pieces walk space by space rather than
teleporting, stand at the foot of a space so the icon stays visible, and fan out when several
share a square. There is a mute button in the corner for the sound effects.

## The spaces

| Space | What it deals |
| --- | --- |
| 🌲 Trail | Good news, usually with a choice about how greedy to be. |
| 🎲 Risk | A gamble. Take the safe option, or roll for a bigger prize. |
| ⚠️ Trouble | A setback. You normally pick *how* you suffer. |
| 🎒 Gear | Pick one item to carry. |
| 💤 Rest | Nothing happens. |
| ⏩ Shortcut | Jump 3 ahead, no card. |

Land on another player and you knock them back 2. Only your die roll triggers a space, so a
card that moves you never sets off another card.

## Energy and gear

**Energy ⚡** is the currency cards trade in. Spend 2 of it to **sprint**, adding 3 to your roll.
Some Trouble cards let you buy your way out of them. Energy is worth nothing at the finish
line, so spend it.

**Gear** is the part worth thinking about, because you decide *when* it happens. You can carry
two pieces at once.

| Gear | Effect |
| --- | --- |
| 🥾 Fast Boots | Skip the die and move exactly 6. Useful when a bad roll would ruin you. |
| 🪢 Rope | Roll and add 3. |
| 💨 Gust | Send any player you choose back 4, then take your turn. |
| 🍀 Lucky Charm | When a Trouble card lands, throw it away instead. |

## Board length

Fewer players get a longer trail, so a two-player game is not over in four turns each and an
eight-player game is not an afternoon.

| Players | Spaces | Typical game |
| --- | --- | --- |
| 2 to 3 | 40 | 3 to 4 minutes |
| 4 to 5 | 35 | 5 minutes |
| 6 to 8 | 30 | 6 to 7 minutes |

## Running it locally

Plain HTML, CSS and JavaScript. No build step, no dependencies. Open `index.html`, or serve
the folder:

```bash
npx serve .
```

## Publishing

Push to `main`. The workflow in `.github/workflows/pages.yml` deploys on every push. Pages only
needs switching on once, under **Settings** then **Pages**, with **Source** set to
**GitHub Actions**.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The three screens: setup, game, results. |
| `styles.css` | Mobile-first styling, including a dark theme. |
| `script.js` | Board generation, the four card decks, and every rule. |
| `.github/workflows/pages.yml` | Deploys the site to GitHub Pages. |
