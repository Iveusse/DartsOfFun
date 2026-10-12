import { createScene } from './scene.js';
import { scoreAt } from './board.js';
import { X01Game } from './game.js';
import { swipeToHit, THROW_CONFIG } from './throw.js';
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
const trailCanvas = $('trail');
const scene = createScene(glCanvas);

// ---------- Saisie du swipe ----------

let waiting = null; // resolve() de la promesse en attente d'un lancer
let dragging = false;
let points = [];

const trailCtx = trailCanvas.getContext('2d');

function resizeTrail() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  trailCanvas.width = window.innerWidth * dpr;
  trailCanvas.height = window.innerHeight * dpr;
  trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeTrail();
window.addEventListener('resize', resizeTrail);

function drawTrail() {
  trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (points.length < 2) return;
  trailCtx.lineCap = 'round';
  trailCtx.lineJoin = 'round';
  trailCtx.strokeStyle = 'rgba(242, 193, 78, 0.85)';
  trailCtx.lineWidth = 6;
  trailCtx.beginPath();
  trailCtx.moveTo(points[0].x, points[0].y);
  for (const p of points) trailCtx.lineTo(p.x, p.y);
  trailCtx.stroke();
}

function analyseSwipe(pts) {
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const height = window.innerHeight;
  const dy = first.y - last.y; // positif = vers le haut
  const dx = last.x - first.x;
  if (dy < THROW_CONFIG.minSwipe * height) return null;

  // vitesse sur les ~120 dernières ms, plus fidèle au geste final
  let ref = first;
  for (const p of pts) {
    if (p.t >= last.t - 120) {
      ref = p;
      break;
    }
  }
  let dt = last.t - ref.t;
  if (dt < 20) {
    ref = first;
    dt = Math.max(20, last.t - first.t);
  }
  const speed = Math.max(0.1, ((ref.y - last.y) / dt) * 1000 / height);
  return { dx, dy, speed };
}

glCanvas.addEventListener('pointerdown', (e) => {
  if (!waiting) return;
  dragging = true;
  points = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  glCanvas.setPointerCapture(e.pointerId);
});

glCanvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  drawTrail();
});

function endDrag(e, cancelled) {
  if (!dragging) return;
  dragging = false;
  if (!cancelled) points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  const swipe = cancelled ? null : analyseSwipe(points);
  points = [];
  drawTrail();

  if (swipe && waiting) {
    const resolve = waiting;
    waiting = null;
    resolve(swipe);
  } else if (!cancelled) {
    setHint('Swipe plus franc, vers le haut');
  }
}
glCanvas.addEventListener('pointerup', (e) => endDrag(e, false));
glCanvas.addEventListener('pointercancel', (e) => endDrag(e, true));

function awaitSwipe() {
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
        const swipe = await awaitSwipe();
        pos = swipeToHit(swipe);
        setHint(pos.hint ? `Ton lancer : ${pos.hint}` : '');
      } else {
        setHint('');
        await sleep(800);
        pos = aiThrow({
          remaining: game.scores[player],
          doubleOut: game.doubleOut,
          sigma: MATCH.opponentSigma,
        });
      }

      const hit = scoreAt(pos.x, pos.y);
      await scene.flyDart(pos);

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
