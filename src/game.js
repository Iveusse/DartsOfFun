// Règles du X01 (201, 301, ... 701). Module pur, testable avec node.

export class X01Game {
  constructor({ start = 201, players = ['Toi', 'Gérard'], doubleOut = false } = {}) {
    this.start = start;
    this.names = players;
    this.doubleOut = doubleOut;
    this.scores = players.map(() => start);
    this.current = 0;
    this.dartsInTurn = 0;
    this.turnStart = start;
    this.turnHits = [];
    this.winner = null;
    this.totalDarts = players.map(() => 0);
  }

  get over() {
    return this.winner !== null;
  }

  get dartsLeft() {
    return 3 - this.dartsInTurn;
  }

  // `hit` vient de scoreAt() : { score, isDouble, label, ... }
  throwDart(hit) {
    if (this.over) throw new Error('La partie est terminée');

    const player = this.current;
    const next = this.scores[player] - hit.score;
    this.turnHits.push(hit);
    this.dartsInTurn += 1;
    this.totalDarts[player] += 1;

    let bust = false;
    let win = false;
    if (next < 0) {
      bust = true;
    } else if (this.doubleOut && (next === 1 || (next === 0 && !hit.isDouble))) {
      bust = true;
    } else if (next === 0) {
      win = true;
    }

    if (bust) {
      this.scores[player] = this.turnStart;
    } else {
      this.scores[player] = next;
    }
    if (win) this.winner = player;

    const turnOver = bust || win || this.dartsInTurn >= 3;
    const turnTotal = bust ? 0 : this.turnHits.reduce((sum, h) => sum + h.score, 0);

    return {
      player,
      hit,
      bust,
      win,
      turnOver,
      turnTotal,
      remaining: this.scores[player],
    };
  }

  nextTurn() {
    if (this.over) return;
    this.current = (this.current + 1) % this.scores.length;
    this.dartsInTurn = 0;
    this.turnHits = [];
    this.turnStart = this.scores[this.current];
  }
}
