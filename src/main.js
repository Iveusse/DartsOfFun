import { createScene } from './scene.js';
import { scoreAt } from './board.js';
import { X01Game } from './game.js';
import { CountUpGame } from './modes/countup.js';
import { ShanghaiGame } from './modes/shanghai.js';
import { CricketGame, CRICKET_NUMBERS } from './modes/cricket.js';
import { AIM_CONFIG, FIXED_PHASES, aimToHit, clampToRadius, releaseLead, swayAt } from './throw.js';
import { aiTarget, aiThrowAt } from './ai.js';
import { calloutForGame } from './jokes.js';
import { CHAPTERS, rewardFor } from './story.js';
import { dartById, FLIGHTS, flightIndex } from './darts.js';
import * as store from './save.js';
import { initScreens, showMenu, hideScreens } from './screens.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const glCanvas = $('gl');
const scene = createScene(glCanvas);

// ---------- Visée : on fait glisser la fléchette, on relâche pour lancer ----------

let waiting = null; // resolve() de la promesse en attente d'un lancer
let aiming = null; // { t0, fx, fy, trail }

// réglages de la fléchette équipée (chacune a ses compromis)
function dartCfg() {
  const d = dartById(store.load().dart);
  return {
    cfg: { ...AIM_CONFIG, lift: AIM_CONFIG.lift * d.lift, leadSeconds: AIM_CONFIG.leadSeconds * d.lead },
    stability: d.stability,
  };
}

function applyStyle() {
  scene.setFlightStyle(FLIGHTS[flightIndex(store.load().flight)].colors);
}

function currentAim() {
  const held = (performance.now() - aiming.t0) / 1000;
  const board = clampToRadius(scene.screenToBoard(aiming.fx, aiming.fy - AIM_CONFIG.fingerOffsetPx));
  const { cfg, stability } = dartCfg();
  const sway = swayAt(held, FIXED_PHASES, cfg, stability);
  return { held, board, shown: { x: board.x + sway.x, y: board.y + sway.y } };
}

function aimTick() {
  if (!aiming) return;
  const { board, shown } = currentAim();
  scene.setAim(shown.x, shown.y);
  // on garde les 200 dernières ms du doigt pour mesurer sa vitesse au lâcher
  const now = performance.now();
  aiming.trail.push({ t: now, x: board.x, y: board.y });
  while (aiming.trail.length > 2 && now - aiming.trail[0].t > 200) aiming.trail.shift();
  requestAnimationFrame(aimTick);
}

// Vitesse du doigt (mm/s) sur les ~100 dernières ms.
function fingerVelocity(endPoint) {
  const now = performance.now();
  const ref = aiming.trail.find((p) => now - p.t <= 100);
  if (!ref) return { x: 0, y: 0 };
  const dt = (now - ref.t) / 1000;
  if (dt < 0.02) return { x: 0, y: 0 };
  return { x: (endPoint.x - ref.x) / dt, y: (endPoint.y - ref.y) / dt };
}

glCanvas.addEventListener('pointerdown', (e) => {
  if (!waiting || aiming) return;
  glCanvas.setPointerCapture(e.pointerId);
  aiming = {
    t0: performance.now(),
    fx: e.clientX,
    fy: e.clientY,
    trail: [],
  };
  setHint('');
  scene.setAimActive(true);
  aimTick();
});

glCanvas.addEventListener('pointermove', (e) => {
  if (!aiming) return;
  aiming.fx = e.clientX;
  aiming.fy = e.clientY;
});

function release(cancelled) {
  if (!aiming) return;
  const { held, board } = currentAim();
  const { cfg, stability } = dartCfg();
  const lead = releaseLead(fingerVelocity(board), cfg);
  aiming = null;

  if (cancelled || !waiting) {
    scene.setAimActive(false);
    return;
  }
  const resolve = waiting;
  waiting = null;
  resolve(aimToHit(board, held, lead, FIXED_PHASES, cfg, stability));
}
glCanvas.addEventListener('pointerup', () => release(false));
glCanvas.addEventListener('pointercancel', () => release(true));

function awaitThrow() {
  return new Promise((resolve) => {
    waiting = resolve;
  });
}

// ---------- Interface ----------

let game = null;
let config = null;
let matchId = 0;

const setHint = (text) => { $('hint').textContent = text; };
const setCallout = (text) => { $('callout').textContent = text; };

const SYMBOLS = ['·', '/', '✕', '◎'];

function renderMarks() {
  const box = $('marks');
  if (game.kind !== 'cricket') {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.innerHTML = CRICKET_NUMBERS.map((n) => {
    const closed = game.closed(0, n) && game.closed(1, n);
    return `<div class="col ${closed ? 'closed' : ''}"><b>${n === 25 ? 'B' : n}</b>
      <span class="me">${SYMBOLS[Math.min(3, game.marks[0][n])]}</span><br>
      <span class="opp">${SYMBOLS[Math.min(3, game.marks[1][n])]}</span></div>`;
  }).join('');
}

function renderScores() {
  game.names.forEach((name, i) => {
    $(`name-${i}`).textContent = name;
    $(`score-${i}`).textContent = game.display(i);
    $(`card-${i}`).classList.toggle('active', game.current === i && !game.over);
  });
  $('info').textContent = game.info();
  renderMarks();
}

function renderDots() {
  const dots = $('dots').children;
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].classList.toggle('used', i < game.dartsInTurn);
  }
}

function showModal({ title, text, coins, actions }) {
  $('modal-title').textContent = title;
  $('modal-text').textContent = text;
  $('modal-coins').textContent = coins;
  const box = $('modal-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.ghost) b.className = 'ghost';
    b.addEventListener('click', a.run);
    box.appendChild(b);
  }
  $('modal').hidden = false;
}

function createGame(c) {
  const players = ['Toi', c.opponent];
  if (c.mode === 'countup') return new CountUpGame({ players, rounds: c.rounds || 8 });
  if (c.mode === 'shanghai') return new ShanghaiGame({ players, rounds: c.rounds || 7 });
  if (c.mode === 'cricket') return new CricketGame({ players });
  return new X01Game({ start: c.start, players, doubleOut: !!c.doubleOut });
}

// ---------- Déroulement de la partie ----------

async function playMatch(c) {
  config = c;
  const id = ++matchId;
  game = createGame(c);
  scene.clearDarts();
  hideScreens();
  $('modal').hidden = true;
  $('menuBtn').hidden = false;
  setCallout('');
  setHint('');
  renderScores();
  renderDots();

  while (!game.over) {
    const player = game.current;
    const human = player === 0;
    renderScores();
    renderDots();
    $('help').classList.toggle('hidden', !human);

    let turnOver = false;
    while (!turnOver) {
      let pos;
      if (human) {
        scene.showHand(true);
        pos = await awaitThrow();
        if (id !== matchId || !pos) return;
        await scene.flyDart(pos, { fromHand: true });
      } else {
        scene.showHand(false);
        await sleep(800);
        if (id !== matchId) return;
        pos = aiThrowAt(aiTarget(game), c.sigma);
        await scene.flyDart(pos);
      }
      if (id !== matchId) return;

      const hit = scoreAt(pos.x, pos.y);
      const event = game.throwDart(hit);
      renderScores();
      renderDots();
      setCallout(calloutForGame(game, event));

      turnOver = event.turnOver;
      await sleep(turnOver ? 1700 : 550);
      if (id !== matchId) return;
    }

    scene.clearDarts();
    if (game.over) break;
    game.nextTurn();
    setCallout('');
    setHint('');
  }

  scene.showHand(false);
  renderScores();
  $('help').classList.add('hidden');
  finishMatch();
}

function finishMatch() {
  const w = game.winner;
  const result = w === 0 ? 'win' : w === -1 ? 'draw' : 'lose';
  const coins = rewardFor(config.reward, result);
  store.addCoins(coins);
  const story = config.chapter !== undefined ? CHAPTERS[config.chapter] : null;
  if (story && result === 'win') store.completeChapter(config.chapter);

  const title = result === 'win' ? 'Victoire !' : result === 'draw' ? 'Égalité' : 'Défaite…';
  let text;
  if (story) text = result === 'win' ? story.win : result === 'lose' ? story.lose : 'Personne ne gagne, tout le monde commande une tournée.';
  else text = result === 'win' ? `Tu bats ${config.opponent}.` : result === 'draw' ? 'Égalité parfaite.' : `${config.opponent} gagne cette fois.`;

  const actions = [];
  const next = story && result === 'win' ? config.chapter + 1 : -1;
  if (next >= 0 && next < CHAPTERS.length) actions.push({ label: 'Chapitre suivant', run: () => startChapter(next) });
  actions.push({ label: story && result !== 'win' ? 'Réessayer' : 'Rejouer', ghost: next >= 0, run: () => playMatch(config) });
  actions.push({ label: 'Menu', ghost: true, run: toMenu });
  showModal({ title, text, coins: `+${coins} pièces`, actions });
}

function startChapter(i) {
  const c = CHAPTERS[i];
  playMatch({ ...c, chapter: i });
}

function toMenu() {
  matchId += 1;
  if (waiting) {
    const r = waiting;
    waiting = null;
    r(null);
  }
  aiming = null;
  scene.setAimActive(false);
  scene.showHand(false);
  scene.clearDarts();
  $('modal').hidden = true;
  $('menuBtn').hidden = true;
  $('help').classList.add('hidden');
  $('marks').hidden = true;
  $('info').textContent = '';
  setCallout('');
  showMenu();
}

$('menuBtn').addEventListener('click', toMenu);

initScreens({
  playChapter: startChapter,
  playQuick: (c) => playMatch(c),
  styleChanged: applyStyle,
});

applyStyle();
toMenu();
