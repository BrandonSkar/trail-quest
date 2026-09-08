/* ===========================================================
   Trail Quest
   A pass-and-play race for 2-8 players on one phone.

   Each turn you make one decision:
     - Move 1, 2 or 3   safe and exact, so you can pick your landing tile
     - Push your luck   roll again and again, but a 1 wipes the whole turn
   =========================================================== */

"use strict";

/* ---------------- Board ---------------- */

const COLS = 5;
const BOARD_SIZE = 35;          // tiles 0..34
const FINISH = BOARD_SIZE - 1;  // tile 34

const EFFECTS = {
  boost:  { icon: "⚡",        tag: "BOOST"  },
  pit:    { icon: "🕳️", tag: "PIT"    },
  shield: { icon: "🛡️", tag: "SHIELD" },
  warp:   { icon: "🌀",  tag: "WARP"   }
};

const TILE_EFFECT = {
  3: "boost", 12: "boost", 20: "boost", 28: "boost",
  6: "pit", 16: "pit", 24: "pit", 31: "pit",
  8: "shield", 18: "shield", 27: "shield",
  13: "warp", 26: "warp"
};

const BOOST_STEPS = 3;
const PIT_STEPS = 4;
const SHOVE_STEPS = 3;

const COLORS = [
  "#7c3aed", "#f97316", "#0f9c8d", "#e0374a",
  "#2563eb", "#ca8a04", "#db2777", "#0891b2"
];

/* ---------------- State ---------------- */

const state = {
  players: [],
  turn: 0,         // index of the player whose turn it is
  banked: 0,       // steps stacked up so far this turn by pushing
  phase: "choose", // choose | pushing | end
  busy: false,     // true while the die is animating
  over: false
};

let playerCount = 4;

/* ---------------- Elements ---------------- */

const els = {
  setup: document.getElementById("setupScreen"),
  game: document.getElementById("gameScreen"),
  over: document.getElementById("overScreen"),
  minus: document.getElementById("minusBtn"),
  plus: document.getElementById("plusBtn"),
  countLabel: document.getElementById("countLabel"),
  nameList: document.getElementById("nameList"),
  start: document.getElementById("startBtn"),
  quit: document.getElementById("quitBtn"),
  turnDot: document.getElementById("turnDot"),
  turnName: document.getElementById("turnName"),
  turnMeta: document.getElementById("turnMeta"),
  board: document.getElementById("board"),
  roster: document.getElementById("roster"),
  die: document.getElementById("die"),
  message: document.getElementById("message"),
  actions: document.getElementById("actions"),
  winnerLine: document.getElementById("winnerLine"),
  winnerSub: document.getElementById("winnerSub"),
  standings: document.getElementById("standings"),
  rematch: document.getElementById("rematchBtn"),
  newPlayers: document.getElementById("newPlayersBtn")
};

/* ---------------- Small helpers ---------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function d6() {
  return 1 + Math.floor(Math.random() * 6);
}

function current() {
  return state.players[state.turn];
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ---------------- Setup screen ---------------- */

function loadSaved() {
  try {
    const raw = localStorage.getItem("trailquest.players");
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.names) || typeof saved.count !== "number") return null;
    return saved;
  } catch (err) {
    return null;
  }
}

function save(names) {
  try {
    localStorage.setItem(
      "trailquest.players",
      JSON.stringify({ count: names.length, names: names })
    );
  } catch (err) {
    /* private mode, or storage is full. Not worth interrupting the game. */
  }
}

function renderNameInputs(prefill) {
  const existing = [...els.nameList.querySelectorAll(".name-input")].map((i) => i.value);
  clear(els.nameList);
  els.countLabel.textContent = String(playerCount);
  els.minus.disabled = playerCount <= 2;
  els.plus.disabled = playerCount >= 8;

  for (let i = 0; i < playerCount; i += 1) {
    const row = el("div", "name-row");
    const dot = el("span", "dot");
    dot.style.background = COLORS[i];

    const input = el("input", "name-input");
    input.type = "text";
    input.maxLength = 12;
    input.autocomplete = "off";
    input.placeholder = "Player " + (i + 1);
    input.setAttribute("aria-label", "Name for player " + (i + 1));
    input.value = (prefill && prefill[i]) || existing[i] || "";

    row.appendChild(dot);
    row.appendChild(input);
    els.nameList.appendChild(row);
  }
}

function collectNames() {
  return [...els.nameList.querySelectorAll(".name-input")].map((input, i) => {
    const typed = input.value.trim();
    return typed || "Player " + (i + 1);
  });
}

/* ---------------- Game start ---------------- */

function startGame(names) {
  state.players = names.map((name, i) => ({
    name: name,
    color: COLORS[i],
    initial: name.charAt(0).toUpperCase(),
    pos: 0,
    shields: 0
  }));
  state.turn = 0;
  state.banked = 0;
  state.phase = "choose";
  state.busy = false;
  state.over = false;

  els.setup.classList.add("hidden");
  els.over.classList.add("hidden");
  els.game.classList.remove("hidden");
  els.die.hidden = true;

  setMessage(state.players[0].name + " starts. Take a safe step, or push your luck.");
  render();
  window.scrollTo(0, 0);
}

/* ---------------- Rendering ---------------- */

function render() {
  renderTurnbar();
  renderBoard();
  renderRoster();
  renderActions();
}

function renderTurnbar() {
  const player = current();
  els.turnDot.style.background = player.color;
  els.turnName.textContent = player.name;
  const shields = player.shields > 0 ? "  🛡️" + player.shields : "";
  els.turnMeta.textContent = "Tile " + (player.pos + 1) + " of " + BOARD_SIZE + shields;
}

function ghostTile() {
  if (state.phase !== "pushing" || state.banked <= 0) return -1;
  return Math.min(FINISH, current().pos + state.banked);
}

function renderBoard() {
  clear(els.board);
  const ghost = ghostTile();

  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const row = Math.floor(i / COLS);
    const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);

    const tile = el("div", "tile");
    tile.style.gridRow = String(row + 1);
    tile.style.gridColumn = String(col + 1);

    if (i === 0) tile.classList.add("start");
    if (i === FINISH) tile.classList.add("finish");
    if (i === ghost) tile.classList.add("ghost");

    tile.appendChild(el("span", "tile-num", String(i + 1)));

    let icon = "";
    if (i === FINISH) icon = "🏁";
    else if (TILE_EFFECT[i]) icon = EFFECTS[TILE_EFFECT[i]].icon;
    if (icon) tile.appendChild(el("span", "tile-icon", icon));

    const here = state.players.filter((p) => p.pos === i);
    if (here.length) {
      const wrap = el("div", "tile-tokens");
      here.forEach((p) => {
        const token = el("span", "token", p.initial);
        token.style.background = p.color;
        if (p === current() && !state.over) token.classList.add("is-turn");
        wrap.appendChild(token);
      });
      tile.appendChild(wrap);
    }

    els.board.appendChild(tile);
  }
}

function renderRoster() {
  clear(els.roster);
  let activeChip = null;

  state.players.forEach((p, i) => {
    const isActive = i === state.turn && !state.over;
    const chip = el("div", "chip" + (isActive ? " active" : ""));
    const dot = el("span", "dot");
    dot.style.background = p.color;
    chip.appendChild(dot);
    chip.appendChild(el("span", null, p.name));
    const shields = p.shields > 0 ? " 🛡️" + p.shields : "";
    chip.appendChild(el("span", "chip-pos", (p.pos + 1) + shields));
    els.roster.appendChild(chip);
    if (isActive) activeChip = chip;
  });

  // With 6-8 players the strip scrolls, so hint at it and keep the
  // active player in view instead of letting them sit off the edge.
  const overflowing = els.roster.scrollWidth > els.roster.clientWidth + 1;
  els.roster.classList.toggle("scrollable", overflowing);

  if (overflowing && activeChip && typeof activeChip.offsetLeft === "number") {
    els.roster.scrollLeft =
      activeChip.offsetLeft - els.roster.clientWidth / 2 + activeChip.offsetWidth / 2;
  }
}

/* Describes what is waiting on the tile a move would end on. */
function previewTags(target) {
  if (target >= FINISH) return "FINISH";
  const tags = [];
  const effect = TILE_EFFECT[target];
  if (effect) tags.push(EFFECTS[effect].tag);
  if (state.players.some((p) => p !== current() && p.pos === target)) tags.push("SHOVE");
  return tags.length ? tags.join(" + ") : "SAFE";
}

function actionButton(label, sub, className, onClick) {
  const btn = el("button", "act " + (className || ""));
  btn.type = "button";
  btn.appendChild(el("span", null, label));
  btn.appendChild(el("span", "act-sub", sub));
  if (state.busy) btn.disabled = true;
  else btn.addEventListener("click", onClick);
  return btn;
}

function renderActions() {
  clear(els.actions);

  if (state.phase === "choose") {
    const row = el("div", "step-row");
    [1, 2, 3].forEach((n) => {
      const target = Math.min(FINISH, current().pos + n);
      row.appendChild(
        actionButton("Move " + n, previewTags(target), "", () => takeStep(n))
      );
    });
    els.actions.appendChild(row);
    els.actions.appendChild(
      actionButton("Push your luck", "Roll the die", "risky", pushRoll)
    );
    return;
  }

  if (state.phase === "pushing") {
    const target = Math.min(FINISH, current().pos + state.banked);
    els.actions.appendChild(
      actionButton("Stop, move " + state.banked, previewTags(target), "big", stopPushing)
    );
    els.actions.appendChild(
      actionButton("Roll again", "A 1 loses " + state.banked, "risky", pushRoll)
    );
    return;
  }

  // phase === "end"
  const next = state.players[(state.turn + 1) % state.players.length];
  els.actions.appendChild(
    actionButton("Next: " + next.name, "Pass the phone", "big", nextTurn)
  );
}

function setMessage(text) {
  els.message.textContent = text;
}

/* ---------------- Die ---------------- */

const PIP_LAYOUT = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

function drawDie(value) {
  clear(els.die);
  PIP_LAYOUT[value].forEach((cell) => {
    const pip = el("span", "pip");
    pip.style.gridRow = String(Math.ceil(cell / 3));
    pip.style.gridColumn = String(((cell - 1) % 3) + 1);
    els.die.appendChild(pip);
  });
}

function rollDie(done) {
  const value = d6();
  els.die.hidden = false;
  els.die.classList.remove("bust");

  if (reducedMotion()) {
    drawDie(value);
    done(value);
    return;
  }

  state.busy = true;
  renderActions();
  els.die.classList.add("rolling");

  let ticks = 0;
  const spin = setInterval(() => {
    ticks += 1;
    drawDie(d6());
    if (ticks >= 4) {
      clearInterval(spin);
      drawDie(value);
      els.die.classList.remove("rolling");
      state.busy = false;
      done(value);
    }
  }, 80);
}

/* ---------------- Turn actions ---------------- */

function takeStep(n) {
  if (state.busy || state.over) return;
  els.die.hidden = true;
  resolveMove(n, current().name + " steps " + n + ".");
}

function pushRoll() {
  if (state.busy || state.over) return;

  rollDie((value) => {
    const player = current();

    if (value === 1) {
      els.die.classList.add("bust");
      const lost = state.banked;
      state.banked = 0;
      state.phase = "end";
      setMessage(
        lost > 0
          ? player.name + " rolled a 1 and lost all " + lost + " steps. Ouch."
          : player.name + " rolled a 1 straight away and goes nowhere."
      );
      render();
      return;
    }

    state.banked += value;
    state.phase = "pushing";
    setMessage(
      "Rolled " + value + ". " + player.name + " has " + state.banked + " steps stacked up."
    );
    render();
  });
}

function stopPushing() {
  if (state.busy || state.over) return;
  const steps = state.banked;
  state.banked = 0;
  resolveMove(steps, current().name + " banks " + steps + " steps.");
}

/* ---------------- Move resolution ---------------- */

function resolveMove(steps, opening) {
  const player = current();
  const notes = [opening];

  player.pos = Math.min(FINISH, player.pos + steps);

  if (player.pos >= FINISH) return finish(player, notes);

  applyTileEffect(player, notes);

  if (player.pos >= FINISH) return finish(player, notes);

  applyShove(player, notes);

  state.phase = "end";
  setMessage(notes.join(" "));
  render();
}

function applyTileEffect(player, notes) {
  const effect = TILE_EFFECT[player.pos];
  if (!effect) return;

  if (effect === "boost") {
    player.pos = Math.min(FINISH, player.pos + BOOST_STEPS);
    notes.push("⚡ Boost, " + BOOST_STEPS + " tiles further.");
    return;
  }

  if (effect === "pit") {
    if (player.shields > 0) {
      player.shields -= 1;
      notes.push("🕳️ A pit, but the shield holds.");
    } else {
      player.pos = Math.max(0, player.pos - PIT_STEPS);
      notes.push("🕳️ Straight into a pit, back " + PIT_STEPS + ".");
    }
    return;
  }

  if (effect === "shield") {
    player.shields += 1;
    notes.push("🛡️ Picked up a shield.");
    return;
  }

  if (effect === "warp") {
    // Swap with whoever is furthest ahead. Never hurts the player who lands here.
    let leader = null;
    state.players.forEach((other) => {
      if (other !== player && (!leader || other.pos > leader.pos)) leader = other;
    });

    if (leader && leader.pos > player.pos) {
      const mine = player.pos;
      player.pos = leader.pos;
      leader.pos = mine;
      notes.push("🌀 Warp. Swapped places with " + leader.name + ".");
    } else {
      notes.push("🌀 The warp fizzles out. Nobody is ahead.");
    }
  }
}

function applyShove(player, notes) {
  state.players.forEach((other) => {
    if (other === player || other.pos !== player.pos) return;

    if (other.shields > 0) {
      other.shields -= 1;
      notes.push(other.name + " blocks the shove with a shield.");
    } else {
      other.pos = Math.max(0, other.pos - SHOVE_STEPS);
      notes.push(other.name + " gets shoved back " + SHOVE_STEPS + ".");
    }
  });
}

function nextTurn() {
  if (state.over) return;
  state.turn = (state.turn + 1) % state.players.length;
  state.banked = 0;
  state.phase = "choose";
  els.die.hidden = true;
  setMessage(current().name + "'s turn. Step safely, or push your luck.");
  render();
}

/* ---------------- Finish ---------------- */

function finish(winner, notes) {
  state.over = true;
  state.phase = "end";
  render();

  els.winnerLine.textContent = winner.name + " wins!";
  els.winnerSub.textContent = notes.length > 1 ? notes.slice(1).join(" ") : "First to the flag.";

  clear(els.standings);
  state.players
    .slice()
    .sort((a, b) => b.pos - a.pos)
    .forEach((p) => {
      const li = el("li");
      li.appendChild(el("strong", null, p.name));
      li.appendChild(
        document.createTextNode(
          p === winner ? " reached the flag" : " stopped on tile " + (p.pos + 1)
        )
      );
      els.standings.appendChild(li);
    });

  els.game.classList.add("hidden");
  els.over.classList.remove("hidden");
  window.scrollTo(0, 0);
}

/* ---------------- Wiring ---------------- */

els.minus.addEventListener("click", () => {
  if (playerCount > 2) {
    playerCount -= 1;
    renderNameInputs();
  }
});

els.plus.addEventListener("click", () => {
  if (playerCount < 8) {
    playerCount += 1;
    renderNameInputs();
  }
});

els.start.addEventListener("click", () => {
  const names = collectNames();
  save(names);
  startGame(names);
});

els.quit.addEventListener("click", () => {
  if (!window.confirm("End this game and go back to setup?")) return;
  state.over = true;
  els.game.classList.add("hidden");
  els.setup.classList.remove("hidden");
  window.scrollTo(0, 0);
});

els.rematch.addEventListener("click", () => {
  startGame(state.players.map((p) => p.name));
});

els.newPlayers.addEventListener("click", () => {
  els.over.classList.add("hidden");
  els.setup.classList.remove("hidden");
  window.scrollTo(0, 0);
});

const saved = loadSaved();
if (saved) playerCount = Math.min(8, Math.max(2, saved.count));
renderNameInputs(saved ? saved.names : null);
