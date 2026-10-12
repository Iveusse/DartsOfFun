import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAt, segmentPoint, ORDER } from '../src/board.js';
import { X01Game } from '../src/game.js';
import { AIM_CONFIG, aimToHit, clampToRadius, releaseLead, swayAmplitude, swayAt } from '../src/throw.js';
import { chooseTarget, aiThrow } from '../src/ai.js';


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

test('visée : la dérive grandit avec le temps et reste bornée', () => {
  assert.ok(swayAmplitude(0) < swayAmplitude(2));
  assert.ok(swayAmplitude(2) < swayAmplitude(10));
  assert.equal(swayAmplitude(10), AIM_CONFIG.swayMax);
  for (let t = 0; t < 8; t += 0.25) {
    const s = swayAt(t);
    const a = swayAmplitude(t);
    assert.ok(Math.abs(s.x) <= a + 1e-9 && Math.abs(s.y) <= a + 1e-9);
  }
});

test('visée : une fléchette plus stable dérive moins', () => {
  assert.ok(swayAmplitude(3, AIM_CONFIG, 2) < swayAmplitude(3, AIM_CONFIG, 1));
});

test('visée : le même geste donne exactement le même tir', () => {
  const lead = releaseLead({ x: 120, y: -40 });
  const a = aimToHit({ x: 10, y: -20 }, 1.5, lead);
  const b = aimToHit({ x: 10, y: -20 }, 1.5, lead);
  assert.deepEqual(a, b);
});

test('visée : sans dérive ni élan, l\'impact est le point visé', () => {
  const cfg = { ...AIM_CONFIG, swayStart: 0, swayMax: 0, drop: 0 };
  const target = segmentPoint(20, 'treble');
  const hit = aimToHit(target, 3, { x: 0, y: 0 }, undefined, cfg);
  assert.equal(scoreAt(hit.x, hit.y).label, 'T20');
});

test('visée : la pointe sur le T20 ne donne pas un T20, la cloche retombe plus bas', () => {
  const target = segmentPoint(20, 'treble');
  const hit = aimToHit(target, 0);
  assert.ok(hit.y < target.y);
  assert.notEqual(scoreAt(hit.x, hit.y).label, 'T20');
  // en visant plus haut du bon écart, on retrouve le T20
  const corrected = aimToHit({ x: target.x, y: target.y + AIM_CONFIG.drop }, 0);
  assert.equal(scoreAt(corrected.x, corrected.y).label, 'T20');
});

test('visée : l\'élan prolonge le mouvement du doigt, avec un plafond', () => {
  const small = releaseLead({ x: 100, y: 0 });
  assert.ok(small.x > 0 && small.y === 0);
  const big = releaseLead({ x: 5000, y: 5000 });
  assert.ok(Math.abs(Math.hypot(big.x, big.y) - AIM_CONFIG.maxLead) < 1e-9);
  assert.deepEqual(releaseLead({ x: 0, y: 0 }), { x: 0, y: 0 });
});

test('visée : on reste dans le rayon autorisé', () => {
  const p = clampToRadius({ x: 600, y: 0 });
  assert.equal(Math.round(Math.hypot(p.x, p.y)), AIM_CONFIG.maxRadius);
  const q = clampToRadius({ x: 10, y: 10 });
  assert.deepEqual(q, { x: 10, y: 10 });
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
