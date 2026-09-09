/* ===========================================================
   Trail Quest

   A pass-and-play race for 2-8 players on one phone.

   A turn is: play any gear you are holding, roll the die, move,
   then draw the card for the space you landed on. Some cards
   tell you what happens. Most hand you a choice.

   The choices that matter most are about timing: gear sits in
   your hands until you decide the moment is right.
   =========================================================== */

"use strict";

/* ---------------- Board ---------------- */

const COLS = 5;

// The trail repeats this rhythm between the start and the flag.
const PATTERN = [
  "trail", "risk", "gear", "trouble", "trail",
  "shortcut", "risk", "trail", "trouble", "gear",
  "trail", "rest", "risk", "trail"
];

// Fewer players get a longer trail. Two people racing over a short board is
// over in four turns each, which is not enough game to make a decision in.
// Eight people over a long board is an afternoon.
function boardLengthFor(count) {
  if (count <= 3) return 40;
  if (count <= 5) return 35;
  return 30;
}

function buildBoard(length) {
  const board = new Array(length);
  board[0] = "start";
  board[length - 1] = "finish";
  for (let i = 1; i < length - 1; i += 1) board[i] = PATTERN[(i - 1) % PATTERN.length];
  return board;
}

let SPACES = buildBoard(30);
let FINISH = SPACES.length - 1;

const SPACE_INFO = {
  start: { icon: "🚩", name: "Start" },
  finish: { icon: "🏁", name: "Flag" },
  trail: { icon: "🌲", name: "Trail" },
  risk: { icon: "🎲", name: "Risk" },
  trouble: { icon: "⚠️", name: "Trouble" },
  gear: { icon: "🎒", name: "Gear" },
  rest: { icon: "💤", name: "Rest" },
  shortcut: { icon: "⏩", name: "Shortcut" }
};

const SHORTCUT_JUMP = 3;
const BUMP_BACK = 2;
const SPRINT_COST = 2;
const SPRINT_BONUS = 3;
const HAND_LIMIT = 2;
const BOOTS_STEPS = 6;
const ROPE_BONUS = 3;
const GUST_BACK = 4;

const GEAR = {
  boots: { icon: "🥾", name: "Fast Boots", blurb: "Skip the die, move exactly " + BOOTS_STEPS },
  rope: { icon: "🪢", name: "Rope", blurb: "Roll and add " + ROPE_BONUS },
  gust: { icon: "💨", name: "Gust", blurb: "Send any player back " + GUST_BACK },
  charm: { icon: "🍀", name: "Lucky Charm", blurb: "Ignore one Trouble card" }
};

const COLORS = [
  "#7c3aed", "#f97316", "#0f9c8d", "#e0374a",
  "#2563eb", "#ca8a04", "#db2777", "#0891b2"
];

/* ---------------- Card helpers ----------------
   Cards call these. Each applies the effect and writes a line of
   plain English into the turn log, so the cards stay readable.  */

let log = [];

function say(text) {
  log.push(text);
}

function walk(player, amount) {
  // Only the player taking the turn may cross the flag, so a card can
  // never hand somebody else the win while their back is turned.
  const ceiling = player === current() ? FINISH : FINISH - 1;
  const before = player.pos;
  player.pos = Math.max(0, Math.min(ceiling, player.pos + amount));
  return player.pos - before;
}

function fwd(player, amount) {
  const moved = walk(player, amount);
  if (moved > 0) say(player.name + " moves ahead " + moved + " to space " + (player.pos + 1) + ".");
  else say(player.name + " cannot go any further forward.");
}

function back(player, amount) {
  const moved = -walk(player, -amount);
  if (moved > 0) say(player.name + " slides back " + moved + " to space " + (player.pos + 1) + ".");
  else say(player.name + " is already at the start.");
}

function gain(player, amount) {
  player.energy += amount;
  say(player.name + " takes " + amount + " energy.");
}

function spend(player, amount) {
  const lost = Math.min(player.energy, amount);
  player.energy -= lost;
  if (lost > 0) say(player.name + " spends " + lost + " energy.");
}

function drain(player, amount) {
  const lost = amount === Infinity ? player.energy : Math.min(player.energy, amount);
  player.energy -= lost;
  if (lost > 0) say(player.name + " loses " + lost + " energy.");
  else say(player.name + " had no energy to lose.");
}

function takeGear(player, kind) {
  player.hand.push(kind);
  say(player.name + " picks up the " + GEAR[kind].icon + " " + GEAR[kind].name + ".");
}

function dropGear(player, kind) {
  const at = player.hand.indexOf(kind);
  if (at >= 0) player.hand.splice(at, 1);
}

function roomInHand(player) {
  return player.hand.length < HAND_LIMIT;
}

const needsRoom = { need: roomInHand, why: "Your hands are full" };

function rivals(player) {
  return state.players.filter((other) => other !== player);
}

function leaderOf(player) {
  return rivals(player).reduce((best, x) => (!best || x.pos > best.pos ? x : best), null);
}

function lastOf(player) {
  return rivals(player).reduce((worst, x) => (!worst || x.pos < worst.pos ? x : worst), null);
}

function nearestAhead(player) {
  return rivals(player)
    .filter((x) => x.pos > player.pos)
    .reduce((best, x) => (!best || x.pos < best.pos ? x : best), null);
}

function hasEnergy(amount) {
  return (player) => player.energy >= amount;
}

/* ---------------- The decks ----------------
   One option is an instruction. Two options is a decision.   */

const CARDS = {
  trail: [
    {
      title: "Downhill Stretch",
      text: "The path tips downhill and your legs do the rest.",
      options: [{ label: "Let it run", sub: "Move ahead 4", run: (p) => fwd(p, 4) }]
    },
    {
      title: "Fork in the Road",
      text: "One path is quicker. The other goes past the supply hut.",
      options: [
        { label: "Take the quick path", sub: "Move ahead 5", run: (p) => fwd(p, 5) },
        {
          label: "Go past the hut",
          sub: "Move ahead 2, take 2 energy",
          run: (p) => { fwd(p, 2); gain(p, 2); }
        }
      ]
    },
    {
      title: "Wild Berries",
      text: "A whole bush of them, and nobody else has noticed.",
      options: [{ label: "Fill your pack", sub: "Take 3 energy", run: (p) => gain(p, 3) }]
    },
    {
      title: "Friendly Hiker",
      text: "Someone at the back of the pack is lost and asks for your map.",
      options: [
        { label: "Keep walking", sub: "Move ahead 3", run: (p) => fwd(p, 3) },
        {
          label: "Hand over the map",
          sub: "Last place moves 5, you take 3 energy",
          run: (p) => {
            const straggler = lastOf(p);
            if (straggler) fwd(straggler, 5);
            gain(p, 3);
          }
        }
      ]
    },
    {
      title: "Gear Cache",
      text: "Someone left a pair of very good boots in a dry box under a rock.",
      options: [
        Object.assign(
          { label: "Take the boots", sub: GEAR.boots.icon + " " + GEAR.boots.blurb, run: (p) => takeGear(p, "boots") },
          needsRoom
        ),
        { label: "Leave them, take supplies", sub: "Take 4 energy", run: (p) => gain(p, 4) }
      ]
    },
    {
      title: "Scenic Route",
      text: "The long way round is slow, but there is food growing the whole way.",
      options: [
        { label: "Take the long way", sub: "Move ahead 1, take 4 energy", run: (p) => { fwd(p, 1); gain(p, 4); } },
        { label: "Straight on", sub: "Move ahead 5", run: (p) => fwd(p, 5) }
      ]
    },
    {
      title: "Second Wind",
      text: "You were finished ten minutes ago. Apparently not.",
      options: [
        { label: "Roll and run", sub: "Move ahead whatever you roll", roll: (p, value) => fwd(p, value) }
      ]
    },
    {
      title: "Share the Map",
      text: "You could copy the route for everyone behind you. It would cost you time.",
      options: [
        { label: "Keep it to yourself", sub: "Move ahead 5", run: (p) => fwd(p, 5) },
        {
          label: "Share it",
          sub: "Move ahead 2, everyone behind you moves 3",
          run: (p) => {
            fwd(p, 2);
            rivals(p).filter((x) => x.pos < p.pos).forEach((x) => fwd(x, 3));
          }
        }
      ]
    },
    {
      title: "Tailwind",
      text: "The wind gets behind you and pushes.",
      options: [{ label: "Ride it", sub: "Move ahead 6", run: (p) => fwd(p, 6) }]
    },
    {
      title: "Trade Places",
      text: "The hiker in front offers to swap packs, and positions with it.",
      options: [
        {
          label: "Swap with them",
          sub: "Change places with the player just ahead",
          need: (p) => !!nearestAhead(p),
          why: "Nobody is ahead of you",
          run: (p) => {
            const target = nearestAhead(p);
            const mine = p.pos;
            p.pos = target.pos;
            target.pos = mine;
            say(p.name + " swaps places with " + target.name + ".");
          }
        },
        { label: "Walk on", sub: "Move ahead 3", run: (p) => fwd(p, 3) }
      ]
    },
    {
      title: "Windfall",
      text: "The valley funnels the wind into something you could aim.",
      options: [
        Object.assign(
          { label: "Bottle the gust", sub: GEAR.gust.icon + " " + GEAR.gust.blurb, run: (p) => takeGear(p, "gust") },
          needsRoom
        ),
        { label: "Just shelter", sub: "Take 3 energy", run: (p) => gain(p, 3) }
      ]
    },
    {
      title: "Four-Leaf Clover",
      text: "Growing right in the middle of the path, which feels like a sign.",
      options: [
        Object.assign(
          { label: "Pick it", sub: GEAR.charm.icon + " " + GEAR.charm.blurb, run: (p) => takeGear(p, "charm") },
          needsRoom
        ),
        { label: "Walk on", sub: "Take 3 energy", run: (p) => gain(p, 3) }
      ]
    },
    {
      title: "Coil of Rope",
      text: "Good rope, neatly coiled, hanging on a branch.",
      options: [
        Object.assign(
          { label: "Take the rope", sub: GEAR.rope.icon + " " + GEAR.rope.blurb, run: (p) => takeGear(p, "rope") },
          needsRoom
        ),
        { label: "Leave it and push on", sub: "Move ahead 3", run: (p) => fwd(p, 3) }
      ]
    },
    {
      title: "Abandoned Pack",
      text: "Left by the side of the trail, still full.",
      options: [{ label: "Take it", sub: "Take 4 energy", run: (p) => gain(p, 4) }]
    }
  ],

  risk: [
    {
      title: "Rope Bridge",
      text: "It sags in the middle and two of the planks are missing.",
      options: [
        {
          label: "Dash across",
          sub: "Roll 3 or more to move 7, else nothing",
          roll: (p, value) => {
            if (value >= 3) { say("Rolled " + value + ". Across in seconds."); fwd(p, 7); }
            else { say("Rolled " + value + ". You freeze halfway and edge back."); drain(p, 1); }
          }
        },
        { label: "Walk around", sub: "Move ahead 4, no risk", run: (p) => fwd(p, 4) }
      ]
    },
    {
      title: "River Crossing",
      text: "Cold, fast, and deeper than it looks. There is a ferry, for a price.",
      options: [
        {
          label: "Wade in",
          sub: "Roll 4 or more to move 8, else back 2",
          roll: (p, value) => {
            if (value >= 4) { say("Rolled " + value + ". You pick a good line and stride across."); fwd(p, 8); }
            else { say("Rolled " + value + ". The current wins."); back(p, 2); }
          }
        },
        {
          label: "Pay the ferry",
          sub: "Spend 2 energy, move ahead 5",
          need: hasEnergy(2),
          why: "You need 2 energy",
          run: (p) => { spend(p, 2); fwd(p, 5); }
        }
      ]
    },
    {
      title: "Steep Climb",
      text: "There is no way round this one. Only up.",
      options: [
        {
          label: "Start climbing",
          sub: "Roll 4 or more to move 7, else move 1",
          roll: (p, value) => {
            if (value >= 4) { say("Rolled " + value + ". You go up it like a goat."); fwd(p, 7); }
            else { say("Rolled " + value + ". Slow going."); fwd(p, 1); }
          }
        }
      ]
    },
    {
      title: "Storm Front",
      text: "Black clouds stacking over the ridge. There is a hut right here.",
      options: [
        {
          label: "Push through it",
          sub: "Roll even to move 8, odd to go back 2",
          roll: (p, value) => {
            if (value % 2 === 0) { say("Rolled " + value + ". You walk out the far side of it."); fwd(p, 8); }
            else { say("Rolled " + value + ". The storm turns you around."); back(p, 2); }
          }
        },
        { label: "Wait it out", sub: "Take 4 energy", run: (p) => gain(p, 4) }
      ]
    },
    {
      title: "Lucky Coin",
      text: "Someone dropped it on the path a long time ago.",
      options: [
        {
          label: "Flip it",
          sub: "Roll 4 or more for 6 energy, else nothing",
          roll: (p, value) => {
            if (value >= 4) { say("Rolled " + value + ". Your luck holds."); gain(p, 6); }
            else say("Rolled " + value + ". Not your day.");
          }
        },
        { label: "Just pocket it", sub: "Take 2 energy", run: (p) => gain(p, 2) }
      ]
    },
    {
      title: "Night Hike",
      text: "You could get a lot done in the dark, if you do not walk off anything.",
      options: [
        {
          label: "Keep walking",
          sub: "Roll 2 or more to move 6, roll 1 to go back 4",
          roll: (p, value) => {
            if (value >= 2) { say("Rolled " + value + ". You make good ground in the dark."); fwd(p, 6); }
            else { say("Rolled a 1. You walk in a circle for an hour."); back(p, 4); }
          }
        },
        { label: "Sleep until light", sub: "Take 3 energy", run: (p) => gain(p, 3) }
      ]
    },
    {
      title: "Double or Nothing",
      text: "The kind of gamble you regret either way.",
      options: [
        {
          label: "Go for it",
          sub: "Roll 4 or more to move 9, else nothing at all",
          roll: (p, value) => {
            if (value >= 4) { say("Rolled " + value + ". Enormous."); fwd(p, 9); }
            else say("Rolled " + value + ". Nothing at all.");
          }
        },
        { label: "Walk on sensibly", sub: "Move ahead 4", run: (p) => fwd(p, 4) }
      ]
    },
    {
      title: "Old Rope Swing",
      text: "It would clear the whole gully. It is also very old rope.",
      options: [
        {
          label: "Swing across",
          sub: "Roll 3 or more to move 7, else back 3",
          roll: (p, value) => {
            if (value >= 3) { say("Rolled " + value + ". It holds."); fwd(p, 7); }
            else { say("Rolled " + value + ". It does not hold."); back(p, 3); }
          }
        },
        { label: "Climb down and up", sub: "Move ahead 2", run: (p) => fwd(p, 2) }
      ]
    },
    {
      title: "Treasure Map",
      text: "Probably nonsense. Probably.",
      options: [
        {
          label: "Dig where it says",
          sub: "Roll 5 or more to move 10, else nothing",
          roll: (p, value) => {
            if (value >= 5) { say("Rolled " + value + ". There is a whole path under the moss."); fwd(p, 10); }
            else say("Rolled " + value + ". You dig a hole for no reason.");
          }
        },
        { label: "Sell it at the hut", sub: "Take 5 energy", run: (p) => gain(p, 5) }
      ]
    },
    {
      title: "Race the Leader",
      text: "You can see them up ahead. You could probably catch them.",
      options: [
        {
          label: "Chase them down",
          sub: "Roll 4 or more to pull level, else back 3",
          roll: (p, value) => {
            const front = leaderOf(p);
            if (value < 4) { say("Rolled " + value + ". You burn out trying."); back(p, 3); return; }
            if (front && front.pos > p.pos) {
              say("Rolled " + value + ". You reel " + front.name + " right in.");
              walk(p, front.pos - 1 - p.pos);
              say(p.name + " pulls up just behind them on space " + (p.pos + 1) + ".");
            } else {
              say("Rolled " + value + ". Nobody to chase, so you just fly.");
              fwd(p, 5);
            }
          }
        },
        { label: "Wave them on", sub: "Move ahead 3", run: (p) => fwd(p, 3) }
      ]
    }
  ],

  trouble: [
    {
      title: "Lost the Trail",
      text: "The path just stops. A guide back at the hut knows the way.",
      options: [
        { label: "Backtrack", sub: "Go back 3", run: (p) => back(p, 3) },
        {
          label: "Pay the guide",
          sub: "Spend 3 energy, stay where you are",
          need: hasEnergy(3),
          why: "You need 3 energy",
          run: (p) => { spend(p, 3); say(p.name + " is pointed back onto the trail."); }
        }
      ]
    },
    {
      title: "Twisted Ankle",
      text: "One loose rock is all it takes.",
      options: [{ label: "Limp back", sub: "Go back 2", run: (p) => back(p, 2) }]
    },
    {
      title: "Bear!",
      text: "It is very interested in what you are carrying.",
      options: [
        { label: "Run for it", sub: "Go back 4", run: (p) => back(p, 4) },
        {
          label: "Drop your pack",
          sub: "Lose all energy and all gear",
          run: (p) => {
            drain(p, Infinity);
            if (p.hand.length) {
              say(p.name + " leaves the gear behind too.");
              p.hand.length = 0;
            }
          }
        }
      ]
    },
    {
      title: "Heavy Rain",
      text: "It comes down on the whole valley at once.",
      options: [
        {
          label: "Everyone gets soaked",
          sub: "Every player goes back 1",
          run: (p) => {
            back(p, 1);
            rivals(p).forEach((x) => { walk(x, -1); });
            say("Everyone else slips back 1 too.");
          }
        }
      ]
    },
    {
      title: "Wrong Turn",
      text: "You have been walking confidently in the wrong direction.",
      options: [
        { label: "Walk it back", sub: "Go back 4", run: (p) => back(p, 4) },
        {
          label: "Rest and reset",
          sub: "Stay here, but miss your next turn",
          run: (p) => { p.skipTurn = true; say(p.name + " sits down and will miss a turn."); }
        }
      ]
    },
    {
      title: "Snapped Strap",
      text: "Half your supplies are spread across the path behind you.",
      options: [{ label: "Gather what you can", sub: "Lose 2 energy", run: (p) => drain(p, 2) }]
    },
    {
      title: "Rockslide",
      text: "The way ahead is buried. You could scramble over it, carefully.",
      options: [
        { label: "Take the long way", sub: "Go back 3", run: (p) => back(p, 3) },
        {
          label: "Scramble over",
          sub: "Roll 4 or more and nothing happens, else back 6",
          roll: (p, value) => {
            if (value >= 4) say("Rolled " + value + ". Over it without a scratch.");
            else { say("Rolled " + value + ". It shifts under you."); back(p, 6); }
          }
        }
      ]
    },
    {
      title: "Bog",
      text: "Ankle deep and getting deeper. Dry ground lies back the way you came.",
      options: [
        { label: "Wade through it", sub: "Go back 2", run: (p) => back(p, 2) },
        { label: "Camp on the edge", sub: "Stay put and take 2 energy", run: (p) => gain(p, 2) }
      ]
    },
    {
      title: "Map Blown Away",
      text: "It goes over the ridge. Now you are as lost as the last person out here.",
      options: [
        {
          label: "Start again",
          sub: "Swap places with whoever is last",
          run: (p) => {
            const straggler = lastOf(p);
            if (straggler && straggler.pos < p.pos) {
              const mine = p.pos;
              p.pos = straggler.pos;
              straggler.pos = mine;
              say(p.name + " swaps places with " + straggler.name + ".");
            } else {
              say("You are already the last one out here. Nothing changes.");
            }
          }
        }
      ]
    },
    {
      title: "Mosquitoes",
      text: "They find whoever is out in front and stay with them.",
      options: [
        {
          label: "Watch them swarm",
          sub: "Whoever is in the lead goes back 3",
          run: (p) => {
            const front = leaderOf(p);
            const target = front && front.pos > p.pos ? front : p;
            say("They go straight for " + target.name + ".");
            if (target === p) back(p, 3);
            else { walk(target, -3); say(target.name + " is driven back 3."); }
          }
        }
      ]
    }
  ],

  gear: [
    {
      title: "Supply Drop",
      text: "A crate split open across the path. You can carry one thing out of it.",
      options: [
        Object.assign({ label: "Take the boots", sub: GEAR.boots.icon + " " + GEAR.boots.blurb, run: (p) => takeGear(p, "boots") }, needsRoom),
        Object.assign({ label: "Take the rope", sub: GEAR.rope.icon + " " + GEAR.rope.blurb, run: (p) => takeGear(p, "rope") }, needsRoom)
      ]
    },
    {
      title: "Trailhead Store",
      text: "One shelf, two things on it, and the owner is watching you closely.",
      options: [
        Object.assign({ label: "Buy the charm", sub: GEAR.charm.icon + " " + GEAR.charm.blurb, run: (p) => takeGear(p, "charm") }, needsRoom),
        Object.assign({ label: "Buy the boots", sub: GEAR.boots.icon + " " + GEAR.boots.blurb, run: (p) => takeGear(p, "boots") }, needsRoom)
      ]
    },
    {
      title: "Wind Trap",
      text: "A gap in the rocks where the wind howls through. You could bottle it.",
      options: [
        Object.assign({ label: "Bottle the gust", sub: GEAR.gust.icon + " " + GEAR.gust.blurb, run: (p) => takeGear(p, "gust") }, needsRoom),
        { label: "Just shelter here", sub: "Take 4 energy", run: (p) => gain(p, 4) }
      ]
    },
    {
      title: "Ranger's Hut",
      text: "Nobody home, but there is a note saying to help yourself to one item.",
      options: [
        Object.assign({ label: "Take the rope", sub: GEAR.rope.icon + " " + GEAR.rope.blurb, run: (p) => takeGear(p, "rope") }, needsRoom),
        Object.assign({ label: "Take the charm", sub: GEAR.charm.icon + " " + GEAR.charm.blurb, run: (p) => takeGear(p, "charm") }, needsRoom)
      ]
    },
    {
      title: "Left Behind",
      text: "Somebody dropped their whole kit here and did not come back for it.",
      options: [
        Object.assign({ label: "Take the gust", sub: GEAR.gust.icon + " " + GEAR.gust.blurb, run: (p) => takeGear(p, "gust") }, needsRoom),
        { label: "Take the supplies", sub: "Take 5 energy", run: (p) => gain(p, 5) }
      ]
    },
    {
      title: "Swap Meet",
      text: "Two hikers going the other way will trade you almost anything.",
      options: [
        Object.assign({ label: "Trade for boots", sub: GEAR.boots.icon + " " + GEAR.boots.blurb, run: (p) => takeGear(p, "boots") }, needsRoom),
        { label: "Trade for supplies", sub: "Take 4 energy, move ahead 2", run: (p) => { gain(p, 4); fwd(p, 2); } }
      ]
    }
  ]
};

/* ---------------- State ---------------- */

const state = {
  players: [],
  turn: 0,
  phase: "roll", // roll | card | target | result
  card: null,
  lastRoll: 0,
  pendingGear: -1,
  busy: false,
  over: false
};

const piles = { trail: [], risk: [], trouble: [], gear: [] };
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
  turnEnergy: document.getElementById("turnEnergy"),
  board: document.getElementById("board"),
  roster: document.getElementById("roster"),
  stage: document.getElementById("stage"),
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

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

function drawCard(kind) {
  if (!piles[kind].length) piles[kind] = shuffle(CARDS[kind].slice());
  return piles[kind].pop();
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
    localStorage.setItem("trailquest.players", JSON.stringify({ count: names.length, names: names }));
  } catch (err) {
    /* private mode or full storage. Not worth interrupting the game over. */
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

/* ---------------- Starting a game ---------------- */

function startGame(names) {
  SPACES = buildBoard(boardLengthFor(names.length));
  FINISH = SPACES.length - 1;

  state.players = names.map((name, i) => ({
    name: name,
    color: COLORS[i],
    initial: name.charAt(0).toUpperCase(),
    pos: 0,
    energy: 1,
    hand: [],
    skipTurn: false
  }));
  state.turn = 0;
  state.phase = "roll";
  state.card = null;
  state.lastRoll = 0;
  state.pendingGear = -1;
  state.busy = false;
  state.over = false;

  Object.keys(piles).forEach((kind) => { piles[kind] = shuffle(CARDS[kind].slice()); });

  log = [state.players[0].name + " starts. Roll the die."];

  els.setup.classList.add("hidden");
  els.over.classList.add("hidden");
  els.game.classList.remove("hidden");

  render();
  window.scrollTo(0, 0);
}

/* ---------------- Rendering ---------------- */

function render() {
  renderTurnbar();
  renderBoard();
  renderRoster();
  renderStage();
}

function renderTurnbar() {
  const player = current();
  els.turnDot.style.background = player.color;
  els.turnName.textContent = player.name;
  const carried = player.hand.map((k) => GEAR[k].icon).join("");
  els.turnEnergy.textContent = "⚡ " + player.energy + (carried ? "  " + carried : "");
}

function renderBoard() {
  clear(els.board);

  for (let i = 0; i < SPACES.length; i += 1) {
    const row = Math.floor(i / COLS);
    const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
    const kind = SPACES[i];

    const tile = el("div", "tile sp-" + kind);
    tile.style.gridRow = String(row + 1);
    tile.style.gridColumn = String(col + 1);

    tile.appendChild(el("span", "tile-num", String(i + 1)));
    tile.appendChild(el("span", "tile-icon", SPACE_INFO[kind].icon));

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
    const carried = p.hand.map((k) => GEAR[k].icon).join("");
    chip.appendChild(el("span", "chip-pos", (p.pos + 1) + " · ⚡" + p.energy + (carried ? " " + carried : "")));
    els.roster.appendChild(chip);
    if (isActive) activeChip = chip;
  });

  // With 6-8 players the strip scrolls, so hint at it and keep the
  // active player in view rather than off the edge.
  const overflowing = els.roster.scrollWidth > els.roster.clientWidth + 1;
  els.roster.classList.toggle("scrollable", overflowing);

  if (overflowing && activeChip && typeof activeChip.offsetLeft === "number") {
    els.roster.scrollLeft =
      activeChip.offsetLeft - els.roster.clientWidth / 2 + activeChip.offsetWidth / 2;
  }
}

function logBlock() {
  const wrap = el("div", "log");
  log.forEach((line) => wrap.appendChild(el("p", "log-line", line)));
  return wrap;
}

function button(label, sub, className, onClick, disabledReason) {
  const btn = el("button", "act " + (className || ""));
  btn.type = "button";
  btn.appendChild(el("span", null, label));
  if (sub) btn.appendChild(el("span", "act-sub", disabledReason || sub));
  if (state.busy || disabledReason) btn.disabled = true;
  else btn.addEventListener("click", onClick);
  return btn;
}

function renderStage() {
  clear(els.stage);

  if (state.phase === "card" && state.card) {
    els.stage.appendChild(cardView(state.card));
    return;
  }

  const head = el("div", "readout");
  if (state.lastRoll) head.appendChild(dieView(state.lastRoll));
  head.appendChild(logBlock());
  els.stage.appendChild(head);

  const actions = el("div", "actions");

  if (state.phase === "target") {
    actions.appendChild(el("p", "prompt", "Who gets the gust?"));
    rivals(current()).forEach((target) => {
      actions.appendChild(
        button(
          target.name,
          "On space " + (target.pos + 1) + ", send back " + GUST_BACK,
          "",
          () => useGust(target)
        )
      );
    });
    els.stage.appendChild(actions);
    return;
  }

  if (state.phase === "roll") {
    const player = current();

    actions.appendChild(button("Roll the die", "Move what you roll", "big", () => takeRoll(0)));

    if (player.energy >= SPRINT_COST) {
      actions.appendChild(
        button(
          "Sprint",
          "Spend " + SPRINT_COST + " energy, add " + SPRINT_BONUS,
          "risky",
          () => takeRoll(SPRINT_BONUS, true)
        )
      );
    }

    player.hand.forEach((kind, index) => {
      if (kind === "charm") return; // the charm plays itself when trouble lands
      actions.appendChild(
        button(
          "Use " + GEAR[kind].icon + " " + GEAR[kind].name,
          GEAR[kind].blurb,
          "gear",
          () => playGear(index)
        )
      );
    });

    if (player.hand.indexOf("charm") >= 0) {
      actions.appendChild(el("p", "prompt", "🍀 Your lucky charm waits for a Trouble card."));
    }
  } else {
    const next = state.players[(state.turn + 1) % state.players.length];
    actions.appendChild(button("Next: " + next.name, "Pass the phone", "big", nextTurn));
  }

  els.stage.appendChild(actions);
}

function cardView(card) {
  const wrap = el("div", "card card-" + card.deck);
  wrap.appendChild(el("p", "card-deck", SPACE_INFO[card.deck].icon + " " + SPACE_INFO[card.deck].name));
  wrap.appendChild(el("h3", "card-title", card.title));
  wrap.appendChild(el("p", "card-text", card.text));

  const opts = el("div", "actions");
  let playable = 0;

  card.options.forEach((option, index) => {
    const blocked = option.need && !option.need(current()) ? option.why : null;
    if (!blocked) playable += 1;
    opts.appendChild(
      button(option.label, option.sub, index === 0 ? "big" : "", () => chooseOption(option), blocked)
    );
  });

  // Two pieces of gear on one card can both be out of reach when your hands
  // are full. Never leave a turn with nowhere to go.
  if (playable === 0) {
    opts.appendChild(
      button("Walk on by", "Nothing here you can carry", "", () =>
        chooseOption({ run: (p) => say(p.name + " has no room and leaves it behind.") })
      )
    );
  }

  // A charm turns any Trouble card into a decision: spend it now, or save it
  // for something worse later.
  if (card.deck === "trouble" && current().hand.indexOf("charm") >= 0) {
    opts.appendChild(
      button("Use 🍀 Lucky Charm", "Ignore this card entirely", "gear", () =>
        chooseOption({
          run: (p) => {
            dropGear(p, "charm");
            say(p.name + " spends the lucky charm and walks away clean.");
          }
        })
      )
    );
  }

  wrap.appendChild(opts);
  return wrap;
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

function dieView(value) {
  const die = el("div", "die");
  PIP_LAYOUT[value].forEach((cell) => {
    const pip = el("span", "pip");
    pip.style.gridRow = String(Math.ceil(cell / 3));
    pip.style.gridColumn = String(((cell - 1) % 3) + 1);
    die.appendChild(pip);
  });
  return die;
}

function rollDie(done) {
  const value = d6();

  if (reducedMotion()) {
    state.lastRoll = value;
    done(value);
    return;
  }

  state.busy = true;
  let ticks = 0;
  const spin = setInterval(() => {
    ticks += 1;
    state.lastRoll = d6();
    render();
    if (ticks >= 4) {
      clearInterval(spin);
      state.lastRoll = value;
      state.busy = false;
      done(value);
    }
  }, 80);
}

/* ---------------- Taking a turn ---------------- */

function advanceAndLand(player, steps) {
  player.pos = Math.min(FINISH, player.pos + steps);
  if (player.pos >= FINISH) return finish(player);
  bump(player);
  landOn(player);
}

function takeRoll(bonus, paysSprint) {
  if (state.busy || state.over) return;
  const player = current();
  if (paysSprint && player.energy < SPRINT_COST) return;

  log = [];
  if (paysSprint) {
    player.energy -= SPRINT_COST;
    say(player.name + " spends " + SPRINT_COST + " energy to sprint.");
  }

  rollDie((value) => {
    const total = value + bonus;
    say(
      player.name + " rolled " + value +
      (bonus ? " and adds " + bonus + " for " + total : "") + "."
    );
    advanceAndLand(player, total);
  });
}

function playGear(index) {
  if (state.busy || state.over) return;
  const player = current();
  const kind = player.hand[index];
  if (!kind) return;

  if (kind === "gust") {
    state.pendingGear = index;
    state.phase = "target";
    render();
    return;
  }

  player.hand.splice(index, 1);

  if (kind === "boots") {
    log = [];
    say(player.name + " pulls on the fast boots and strides " + BOOTS_STEPS + ".");
    advanceAndLand(player, BOOTS_STEPS);
    return;
  }

  if (kind === "rope") {
    log = [];
    say(player.name + " uses the rope to haul up the trail.");
    takeRoll(ROPE_BONUS, false);
  }
}

function useGust(target) {
  if (state.busy || state.over) return;
  const player = current();
  if (state.pendingGear >= 0) player.hand.splice(state.pendingGear, 1);
  state.pendingGear = -1;

  log = [];
  walk(target, -GUST_BACK);
  say(player.name + " lets the gust go at " + target.name + ".");
  say(target.name + " is blown back to space " + (target.pos + 1) + ".");
  say("Now roll.");

  state.phase = "roll";
  render();
}

function bump(player) {
  state.players.forEach((other) => {
    if (other === player || other.pos !== player.pos) return;
    walk(other, -BUMP_BACK);
    say(player.name + " lands on " + other.name + " and knocks them back " + BUMP_BACK + ".");
  });
}

function landOn(player) {
  const kind = SPACES[player.pos];

  if (kind === "shortcut") {
    player.pos = Math.min(FINISH, player.pos + SHORTCUT_JUMP);
    say("A shortcut. Jump " + SHORTCUT_JUMP + " ahead to space " + (player.pos + 1) + ".");
    if (player.pos >= FINISH) return finish(player);
    return endTurnPhase();
  }

  if (kind === "rest") {
    say("A rest stop. Nothing happens here.");
    return endTurnPhase();
  }

  if (kind === "trail" || kind === "risk" || kind === "trouble" || kind === "gear") {
    const card = drawCard(kind);
    state.card = { deck: kind, title: card.title, text: card.text, options: card.options };
    state.phase = "card";
    render();
    return;
  }

  endTurnPhase();
}

function chooseOption(option) {
  if (state.busy || state.over) return;
  const player = current();
  state.card = null;
  state.phase = "result";

  if (option.roll) {
    render();
    rollDie((value) => {
      option.roll(player, value);
      afterCard(player);
    });
    return;
  }

  option.run(player);
  afterCard(player);
}

function afterCard(player) {
  if (player.pos >= FINISH) return finish(player);
  endTurnPhase();
}

function endTurnPhase() {
  state.phase = "result";
  state.card = null;
  render();
}

function nextTurn() {
  if (state.over) return;
  state.turn = (state.turn + 1) % state.players.length;
  state.lastRoll = 0;
  state.card = null;
  state.pendingGear = -1;

  const player = current();
  log = [];

  if (player.skipTurn) {
    player.skipTurn = false;
    say(player.name + " is still sitting down and misses this turn.");
    state.phase = "result";
  } else {
    say(player.name + "'s turn. Roll the die.");
    state.phase = "roll";
  }

  render();
}

/* ---------------- Finish ---------------- */

function finish(winner) {
  state.over = true;
  state.phase = "result";
  state.card = null;
  render();

  els.winnerLine.textContent = winner.name + " wins!";
  els.winnerSub.textContent = log.length ? log[log.length - 1] : "First to the flag.";

  clear(els.standings);
  state.players
    .slice()
    .sort((a, b) => b.pos - a.pos)
    .forEach((p) => {
      const li = el("li");
      li.appendChild(el("strong", null, p.name));
      li.appendChild(
        document.createTextNode(
          p === winner ? " reached the flag" : " stopped on space " + (p.pos + 1)
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
