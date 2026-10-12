// Cricket : on ferme le 20, 19, 18, 17, 16, 15 et le bull (3 marques chacun).
// Les marques en trop marquent des points tant que l'adversaire n'a pas fermé le numéro.
export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25];

export class CricketGame {
  constructor({ players = ['Toi', 'Gérard'], maxRounds = 20 } = {}) {
    this.kind = 'cricket';
    this.names = players;
    this.maxRounds = maxRounds;
    this.round = 1;
    this.marks = players.map(() => Object.fromEntries(CRICKET_NUMBERS.map((n) => [n, 0])));
    this.scores = players.map(() => 0);
    this.current = 0;
    this.dartsInTurn = 0;
    this.turnHits = [];
    this.totalDarts = players.map(() => 0);
    this.winner = null;
    this.finished = false;
  }

  get over() {
    return this.finished;
  }

  closed(player, n) {
    return this.marks[player][n] >= 3;
  }

  allClosed(player) {
    return CRICKET_NUMBERS.every((n) => this.closed(player, n));
  }

  display(i) {
    return String(this.scores[i]);
  }

  info() {
    return `Cricket : manche ${Math.min(this.round, this.maxRounds)}/${this.maxRounds}`;
  }

  progress(i) {
    const total = CRICKET_NUMBERS.reduce((s, n) => s + Math.min(3, this.marks[i][n]), 0);
    return total / (CRICKET_NUMBERS.length * 3);
  }

  // marques d'un hit : 0 si le numéro ne compte pas. Le bull extérieur vaut 1, le bull 2.
  static marksOf(hit) {
    if (!CRICKET_NUMBERS.includes(hit.number)) return 0;
    return hit.multiplier;
  }

  throwDart(hit) {
    const player = this.current;
    const other = 1 - player;
    this.turnHits.push(hit);
    this.dartsInTurn += 1;
    this.totalDarts[player] += 1;

    const m = CricketGame.marksOf(hit);
    let points = 0;
    let closedNow = false;
    if (m > 0) {
      const n = hit.number;
      const before = this.marks[player][n];
      this.marks[player][n] = before + m;
      const extra = Math.max(0, before + m - Math.max(3, before));
      if (before < 3 && before + m >= 3) closedNow = true;
      if (extra > 0 && !this.closed(other, n)) {
        points = extra * n;
        this.scores[player] += points;
      }
    }

    // victoire : tout fermé et au moins autant de points que l'adversaire
    let win = false;
    if (this.allClosed(player) && this.scores[player] >= this.scores[other]) win = true;

    const turnOver = win || this.dartsInTurn >= 3;
    const lastOfMatch = !win && turnOver && player === this.scores.length - 1 && this.round >= this.maxRounds;
    if (win) {
      this.winner = player;
      this.finished = true;
    } else if (lastOfMatch) {
      this.finished = true;
      const [a, b] = this.scores;
      this.winner = a === b ? -1 : a > b ? 0 : 1;
    }
    return { player, hit, bust: false, win: this.finished, marks: m, points, closedNow, turnOver, turnTotal: points };
  }

  nextTurn() {
    if (this.over) return;
    this.current = (this.current + 1) % this.scores.length;
    if (this.current === 0) this.round += 1;
    this.dartsInTurn = 0;
    this.turnHits = [];
  }
}
