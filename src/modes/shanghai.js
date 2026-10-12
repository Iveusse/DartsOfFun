// Shanghai : manche n = on vise le n. Chaque fléchette dans le n marque son score.
// Simple + double + triple du n dans la même volée = Shanghai, victoire immédiate.
export class ShanghaiGame {
  constructor({ players = ['Toi', 'Gérard'], rounds = 7 } = {}) {
    this.kind = 'shanghai';
    this.names = players;
    this.rounds = rounds;
    this.round = 1;
    this.scores = players.map(() => 0);
    this.current = 0;
    this.dartsInTurn = 0;
    this.turnHits = [];
    this.totalDarts = players.map(() => 0);
    this.finished = false;
    this.shanghaiBy = null;
  }

  get target() {
    return this.round;
  }

  get over() {
    return this.finished;
  }

  get winner() {
    if (!this.finished) return null;
    if (this.shanghaiBy !== null) return this.shanghaiBy;
    const [a, b] = this.scores;
    if (a === b) return -1;
    return a > b ? 0 : 1;
  }

  display(i) {
    return String(this.scores[i]);
  }

  info() {
    return `Shanghai : manche ${Math.min(this.round, this.rounds)}/${this.rounds}, vise le ${Math.min(this.round, this.rounds)}`;
  }

  progress(i) {
    return Math.min(1, this.scores[i] / (this.rounds * 18));
  }

  throwDart(hit) {
    const player = this.current;
    const good = hit.number === this.round;
    const points = good ? hit.score : 0;
    this.scores[player] += points;
    this.turnHits.push(hit);
    this.dartsInTurn += 1;
    this.totalDarts[player] += 1;

    const mults = new Set(this.turnHits.filter((h) => h.number === this.round).map((h) => h.multiplier));
    const shanghai = mults.has(1) && mults.has(2) && mults.has(3);
    const turnOver = shanghai || this.dartsInTurn >= 3;
    const lastOfMatch = turnOver && player === this.scores.length - 1 && this.round >= this.rounds;
    if (shanghai) {
      this.finished = true;
      this.shanghaiBy = player;
    } else if (lastOfMatch) {
      this.finished = true;
    }
    const turnTotal = this.turnHits.filter((h) => h.number === this.round).reduce((s, h) => s + h.score, 0);
    return { player, hit, bust: false, win: this.finished, shanghai, good, points, turnOver, turnTotal };
  }

  nextTurn() {
    if (this.over) return;
    this.current = (this.current + 1) % this.scores.length;
    if (this.current === 0) this.round += 1;
    this.dartsInTurn = 0;
    this.turnHits = [];
  }
}
