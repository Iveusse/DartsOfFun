import { createScene } from './scene.js';
import { scoreAt } from './board.js';
import { X01Game } from './game.js';
import { AIM_CONFIG, aimToHit, clampToRadius, newPhases, swayAt } from './throw.js';
import { aiThrow } from './ai.js';
import { calloutFor } from './jokes.js';

// --- Réglages de la partie (étape 1 : un seul match en 201) ---
const MATCH = {
  start: 201,
  players: ['Toi', 'Gérard'],
  doubleOut: false, // sortie libre pour commencer, on pourra l'activer plus tard
  opponentSigma: 32, // mm : plus petit = adversaire plus fort
};

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const glCanvas = $('gl');
const scene = createScene(glCanvas);

// ---------- Visée : on fait glisser la fléchette, on relâche pour lancer ----------

let waiting = null; // resolve() de la promesse en attente d'un lancer
let aiming = null; // { t0, phases, fx, fy, point }

function currentAim() {
  const held = (performance.now() - aiming.t0) / 1000;
  const board = clampToRadius(scene.screenToBoard(aiming.fx, aiming.fy - AIM_CONFIG.fingerOffsetPx));
  const sway = swayAt(held, aiming.phases);
  return { held, board, shown: { x: board.x + sway.x, y: board.y + sway.y } };
}

function aimTick() {
  if (!aiming) return;
  const { shown } = currentAim();
  scene.setAim(shown.x, shown.y);
  requestAnimationFrame(aimTick);
}

glCanvas.addEventListener('pointerdown', (e) => {
  if (!waiting || aiming) return;
  glCanvas.setPointerCapture(e.pointerId);
  aiming = {
    t0: performance.now(),
    phases: newPhases(),
    fx: e.clientX,
    fy: e.clientY,
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
  const phases = aiming.phases;
  aiming = null;

  if (cancelled || !waiting) {
    scene.setAimActive(false);
    return;
  }
  const resolve = waiting;
  waiting = null;
  resolve(aimToHit(board, held, phases));
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

function setHint(text) {
  $('hint').textContent = text;
}

function setCallout(text) {
  $('callout').textContent = text;
}

function renderScores() {
  game.names.forEach((name, i) => {
    $(`name-${i}`).textContent = name;
    $(`score-${i}`).textContent = String(game.scores[i]);
    $(`card-${i}`).classList.toggle('active', game.current === i && !game.over);
  });
}

function renderDots() {
  const dots = $('dots').children;
  for (let i = 0; i < dots.length; i += 1) {
    dots[i].classList.toggle('used', i < game.dartsInTurn);
  }
}

function showModal(title, text) {
  $('modal-title').textContent = title;
  $('modal-text').textContent = text;
  $('modal').hidden = false;
}

// ---------- Déroulement de la partie ----------

async function playMatch() {
  game = new X01Game(MATCH);
  scene.clearDarts();
  $('modal').hidden = true;
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
        await scene.flyDart(pos, { fromHand: true });
      } else {
        scene.showHand(false);
        await sleep(800);
        pos = aiThrow({
          remaining: game.scores[player],
          doubleOut: game.doubleOut,
          sigma: MATCH.opponentSigma,
        });
        await scene.flyDart(pos);
      }

      const hit = scoreAt(pos.x, pos.y);
      const event = game.throwDart(hit);
      renderScores();
      renderDots();
      setCallout(calloutFor(event, game.names));

      turnOver = event.turnOver;
      await sleep(turnOver ? 1700 : 550);
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
  const won = game.winner === 0;
  showModal(
    won ? 'Victoire !' : 'Défaite…',
    won
      ? `Tu gagnes en ${game.totalDarts[0]} fléchettes. Gérard demande la revanche.`
      : `${game.names[1]} gagne en ${game.totalDarts[1]} fléchettes. Le pub se moque de toi.`,
  );
}

$('again').addEventListener('click', playMatch);

playMatch();
