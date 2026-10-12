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
  const cfg = { ...AIM_CONFIG, swayStart: 0, swayMax: 0, lift: 0 };
  const target = segmentPoint(20, 'treble');
  const hit = aimToHit(target, 3, { x: 0, y: 0 }, undefined, cfg);
  assert.equal(scoreAt(hit.x, hit.y).label, 'T20');
});

test('visée : la pointe sur le T20 ne donne pas un T20, la cloche monte plus haut', () => {
  const target = segmentPoint(20, 'treble');
  const hit = aimToHit(target, 0);
  assert.ok(hit.y > target.y);
  assert.notEqual(scoreAt(hit.x, hit.y).label, 'T20');
  // en posant la pointe plus bas du bon écart, on retrouve le T20
  const corrected = aimToHit({ x: target.x, y: target.y - AIM_CONFIG.lift }, 0);
  assert.equal(scoreAt(corrected.x, corrected.y).label, 'T20');
});

test('visée : pointe au centre et geste lent = environ le T20', () => {
  const hit = aimToHit({ x: 0, y: 0 }, 1);
  const label = scoreAt(hit.x, hit.y).label;
  assert.ok(['T20', 'S20'].includes(label), label);
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

import { CountUpGame } from '../src/modes/countup.js';
import { ShanghaiGame } from '../src/modes/shanghai.js';
import { CricketGame } from '../src/modes/cricket.js';

const h = (n, ring) => {
  const p = segmentPoint(n, ring);
  return scoreAt(p.x, p.y);
};

test('Count Up : 8 manches, le plus haut gagne', () => {
  const g = new CountUpGame({ rounds: 2 });
  for (let r = 0; r < 2; r += 1) {
    for (let p = 0; p < 2; p += 1) {
      for (let d = 0; d < 3; d += 1) g.throwDart(p === 0 ? h(20, 'treble') : h(1, 'single'));
      if (!g.over) g.nextTurn();
    }
  }
  assert.equal(g.over, true);
  assert.equal(g.scores[0], 360);
  assert.equal(g.scores[1], 6);
  assert.equal(g.winner, 0);
});

test('Shanghai : seul le numéro de la manche compte', () => {
  const g = new ShanghaiGame();
  g.throwDart(h(1, 'treble'));
  g.throwDart(h(2, 'treble'));
  assert.equal(g.scores[0], 3);
});

test('Shanghai : simple + double + triple = victoire immédiate', () => {
  const g = new ShanghaiGame();
  g.throwDart(h(1, 'single'));
  g.throwDart(h(1, 'double'));
  const e = g.throwDart(h(1, 'treble'));
  assert.equal(e.shanghai, true);
  assert.equal(g.over, true);
  assert.equal(g.winner, 0);
});

test('Cricket : fermer, puis marquer tant que l\'autre n\'a pas fermé', () => {
  const g = new CricketGame();
  g.throwDart(h(20, 'treble')); // ferme le 20
  assert.equal(g.closed(0, 20), true);
  assert.equal(g.scores[0], 0);
  g.throwDart(h(20, 'single')); // 1 marque en trop : 20 points
  assert.equal(g.scores[0], 20);
  g.nextTurn();
  g.throwDart(h(20, 'treble')); // l'adversaire ferme à son tour
  g.nextTurn();
  g.throwDart(h(20, 'single')); // plus de points : fermé des deux côtés
  assert.equal(g.scores[0], 20);
});

test('Cricket : le bull extérieur vaut 1 marque, le bull 2', () => {
  const g = new CricketGame();
  g.throwDart(scoreAt(0, 11));
  assert.equal(g.marks[0][25], 1);
  g.throwDart(scoreAt(0, 0));
  assert.equal(g.marks[0][25], 3);
});

test('Cricket : tout fermer avec plus de points = victoire', () => {
  const g = new CricketGame();
  for (const n of [20, 19, 18, 17, 16, 15]) {
    g.nextTurn(); g.nextTurn();
    g.dartsInTurn = 0;
    g.throwDart(h(n, 'treble'));
  }
  g.dartsInTurn = 0;
  const e = g.throwDart(scoreAt(0, 0)); // bull : 2 marques
  assert.equal(e.win, false);
  g.dartsInTurn = 0;
  const f = g.throwDart(scoreAt(0, 0));
  assert.equal(f.win, true);
  assert.equal(g.winner, 0);
});
