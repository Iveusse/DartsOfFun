// Count Up : 8 volées de 3 fléchettes, on additionne tout, le plus haut score gagne.
export class CountUpGame {
  constructor({ players = ['Toi', 'Gérard'], rounds = 8 } = {}) {
    this.kind = 'countup';
    this.names = players;
    this.rounds = rounds;
    this.round = 1;
    this.scores = players.map(() => 0);
    this.current = 0;
    this.dartsInTurn = 0;
    this.turnHits = [];
    this.totalDarts = players.map(() => 0);
    this.finished = false;
  }

  get over() {
    return this.finished;
  }

  get winner() {
    if (!this.finished) return null;
    const [a, b] = this.scores;
    if (a === b) return -1; // égalité
    return a > b ? 0 : 1;
  }

  display(i) {
    return String(this.scores[i]);
  }

  info() {
    return `Count Up : manche ${Math.min(this.round, this.rounds)}/${this.rounds}`;
  }

  // part de la barre de progression (0 à 1)
  progress(i) {
    return Math.min(1, this.scores[i] / (this.rounds * 3 * 40));
  }

  throwDart(hit) {
    const player = this.current;
    this.scores[player] += hit.score;
    this.turnHits.push(hit);
    this.dartsInTurn += 1;
    this.totalDarts[player] += 1;
    const turnOver = this.dartsInTurn >= 3;
    const turnTotal = this.turnHits.reduce((s, h) => s + h.score, 0);
    const lastOfMatch = turnOver && player === this.scores.length - 1 && this.round >= this.rounds;
    if (lastOfMatch) this.finished = true;
    return { player, hit, bust: false, win: lastOfMatch, turnOver, turnTotal };
  }

  nextTurn() {
    if (this.over) return;
    this.current = (this.current + 1) % this.scores.length;
    if (this.current === 0) this.round += 1;
    this.dartsInTurn = 0;
    this.turnHits = [];
  }
}
