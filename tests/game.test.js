import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAt, segmentPoint, ORDER } from '../src/board.js';
import { X01Game } from '../src/game.js';
import { swipeToHit, THROW_CONFIG } from '../src/throw.js';
import { chooseTarget, aiThrow } from '../src/ai.js';

const noRandom = () => 0.5; // sans effet ici : le tremblement est coupé (wobble: 0)
const quiet = { ...THROW_CONFIG, wobble: 0 };

test('centre et anneaux', () => {
  assert.equal(scoreAt(0, 0).score, 50);
  assert.equal(scoreAt(0, 11).score, 25);
  assert.equal(scoreAt(0, 103).label, 'T20');
  assert.equal(scoreAt(0, 103).score, 60);
  assert.equal(scoreAt(0, 166).label, 'D20');
  assert.equal(scoreAt(0, 134).label, 'S20');
  assert.equal(scoreAt(0, 171).ring, 'miss');
});

test('numéros dans le bon ordre, sens horaire depuis le haut', () => {
  assert.equal(scoreAt(0, 134).number, 20);
  assert.equal(scoreAt(134, 0).number, 6); // à droite
  assert.equal(scoreAt(0, -134).number, 3); // en bas
  assert.equal(scoreAt(-134, 0).number, 11); // à gauche
  // petit décalage horaire depuis le haut : on passe sur le 1
  assert.equal(scoreAt(30, 130).number, 1);
});

test('segmentPoint retombe sur la bonne zone pour tous les secteurs', () => {
  for (const n of ORDER) {
    assert.equal(scoreAt(...Object.values(segmentPoint(n, 'single'))).label, `S${n}`);
    const t = segmentPoint(n, 'treble');
    assert.equal(scoreAt(t.x, t.y).label, `T${n}`);
    const d = segmentPoint(n, 'double');
    assert.equal(scoreAt(d.x, d.y).label, `D${n}`);
  }
});

test('X01 : décompte et fin de volée', () => {
  const g = new X01Game({ start: 201 });
  const t20 = scoreAt(0, 103);
  g.throwDart(t20);
  g.throwDart(t20);
  const e = g.throwDart(t20);
  assert.equal(e.turnOver, true);
  assert.equal(e.turnTotal, 180);
  assert.equal(g.scores[0], 21);
  g.nextTurn();
  assert.equal(g.current, 1);
  assert.equal(g.scores[1], 201);
});

test('X01 : bust remet le score de début de volée', () => {
  const g = new X01Game({ start: 40 });
  g.throwDart(scoreAt(0, 103)); // 60 > 40 : bust direct
  assert.equal(g.scores[0], 40);
  const g2 = new X01Game({ start: 50 });
  g2.throwDart(scoreAt(0, 134)); // 20 -> 30
  const e = g2.throwDart(scoreAt(0, 103)); // 60 > 30 : bust
  assert.equal(e.bust, true);
  assert.equal(g2.scores[0], 50);
});

test('X01 : victoire en sortie libre', () => {
  const g = new X01Game({ start: 20 });
  const e = g.throwDart(scoreAt(0, 134));
  assert.equal(e.win, true);
  assert.equal(g.over, true);
  assert.equal(g.winner, 0);
});

test('X01 : double out obligatoire', () => {
  const g = new X01Game({ start: 40, doubleOut: true });
  assert.equal(g.throwDart(scoreAt(0, 134)).remaining, 20); // S20
  const e = g.throwDart(scoreAt(0, 134)); // S20 pour finir : refusé
  assert.equal(e.bust, true);
  assert.equal(g.scores[0], 40);

  const g2 = new X01Game({ start: 40, doubleOut: true });
  assert.equal(g2.throwDart(scoreAt(0, 166)).win, true); // D20

  const g3 = new X01Game({ start: 21, doubleOut: true });
  assert.equal(g3.throwDart(scoreAt(0, 134)).bust, true); // 21 - 20 = 1 : bust
});

test('lancer : vitesse idéale et swipe droit visent le centre', () => {
  const hit = swipeToHit({ dx: 0, dy: 500, speed: THROW_CONFIG.idealSpeed }, noRandom, quiet);
  assert.equal(hit.x, 0);
  assert.equal(hit.y, 0);
  assert.equal(hit.hint, '');
});

test('lancer : trop fort monte, trop mou descend, penché va de côté', () => {
  const fast = swipeToHit({ dx: 0, dy: 500, speed: THROW_CONFIG.idealSpeed * 1.4 }, noRandom, quiet);
  assert.ok(fast.y > 0);
  assert.match(fast.hint, /trop fort/);
  const slow = swipeToHit({ dx: 0, dy: 500, speed: THROW_CONFIG.idealSpeed * 0.6 }, noRandom, quiet);
  assert.ok(slow.y < 0);
  assert.match(slow.hint, /trop mou/);
  const right = swipeToHit({ dx: 200, dy: 500, speed: THROW_CONFIG.idealSpeed }, noRandom, quiet);
  assert.ok(right.x > 0);
  assert.match(right.hint, /droite/);
});

test('adversaire : choix de cible', () => {
  assert.deepEqual(chooseTarget(201, false), { number: 20, ring: 'treble' });
  assert.deepEqual(chooseTarget(16, false), { number: 16, ring: 'single' });
  assert.deepEqual(chooseTarget(32, true), { number: 16, ring: 'double' });
  assert.deepEqual(chooseTarget(50, true), { number: 25, ring: 'bull' });
});

test('adversaire : sans erreur il touche sa cible', () => {
  let i = 0;
  const seq = [0.5, 0.5];
  const p = aiThrow({ remaining: 201, doubleOut: false, sigma: 0 }, () => seq[i++ % 2]);
  assert.equal(scoreAt(p.x, p.y).label, 'T20');
});
