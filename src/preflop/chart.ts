// Preflop opening chart by position (6-max cash, 100bb deep).
// Ported from the standalone HTML chart.

export const RANKS_HIGH_FIRST = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
export type ChartRank = typeof RANKS_HIGH_FIRST[number];

export type Position = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Action = 'raise' | 'call' | 'mix' | 'fold';

export const POSITIONS: { id: Position; label: string }[] = [
  { id: 'EP',  label: 'Early position (UTG)' },
  { id: 'MP',  label: 'Middle position' },
  { id: 'CO',  label: 'Cut-off' },
  { id: 'BTN', label: 'Button (late)' },
  { id: 'SB',  label: 'Small blind' },
  { id: 'BB',  label: 'Big blind (vs raise)' },
];

const RAISE: Action = 'raise';
const CALL:  Action = 'call';
const MIX:   Action = 'mix';
const FOLD:  Action = 'fold';

const getAction = (
  pos: Position,
  suited: boolean,
  pair: boolean,
  hi: number,
  lo: number,
): Action => {
  const gap = lo - hi;

  if (pos === 'EP') {
    if (pair) {
      if (hi <= 3) return RAISE;
      if (hi <= 5) return RAISE;
      if (hi <= 7) return MIX;
      return FOLD;
    }
    if (suited) {
      if (hi === 0 && lo <= 3) return RAISE;
      if (hi === 0 && lo === 4) return MIX;
      if (hi === 1 && lo === 2) return RAISE;
      if (hi === 1 && lo === 3) return MIX;
      if (hi === 0 && lo <= 7) return CALL;
      return FOLD;
    }
    if (hi === 0 && lo === 1) return RAISE;
    if (hi === 0 && lo === 2) return MIX;
    if (hi === 0 && lo === 3) return CALL;
    return FOLD;
  }

  if (pos === 'MP') {
    if (pair) {
      if (hi <= 5) return RAISE;
      if (hi <= 7) return MIX;
      if (hi === 8) return CALL;
      return FOLD;
    }
    if (suited) {
      if (hi === 0 && lo <= 3) return RAISE;
      if (hi === 0 && lo <= 5) return MIX;
      if (hi === 0 && lo <= 7) return CALL;
      if (hi === 1 && lo <= 2) return RAISE;
      if (hi === 1 && lo <= 4) return MIX;
      if (hi === 2 && lo <= 4) return MIX;
      if (hi === 3 && lo === 4) return CALL;
      return FOLD;
    }
    if (hi === 0 && lo === 1) return RAISE;
    if (hi === 0 && lo <= 3) return MIX;
    if (hi === 0 && lo === 4) return CALL;
    if (hi === 1 && lo === 2) return MIX;
    return FOLD;
  }

  if (pos === 'CO') {
    if (pair) {
      if (hi <= 6) return RAISE;
      if (hi <= 8) return MIX;
      if (hi <= 9) return CALL;
      return FOLD;
    }
    if (suited) {
      if (hi === 0 && lo <= 5) return RAISE;
      if (hi === 0 && lo <= 8) return MIX;
      if (hi === 0 && lo <= 10) return CALL;
      if (hi === 1 && lo <= 3) return RAISE;
      if (hi === 1 && lo <= 6) return MIX;
      if (hi === 2 && lo <= 4) return RAISE;
      if (hi === 2 && lo <= 6) return MIX;
      if (hi === 3 && lo <= 5) return MIX;
      if (hi === 4 && lo === 5) return CALL;
      if (hi === 5 && lo === 6) return CALL;
      return FOLD;
    }
    if (hi === 0 && lo <= 2) return RAISE;
    if (hi === 0 && lo <= 5) return MIX;
    if (hi === 0 && lo <= 7) return CALL;
    if (hi === 1 && lo === 2) return RAISE;
    if (hi === 1 && lo <= 4) return MIX;
    if (hi === 2 && lo === 3) return MIX;
    return FOLD;
  }

  if (pos === 'BTN') {
    if (pair) {
      if (hi <= 8) return RAISE;
      if (hi <= 10) return MIX;
      return CALL;
    }
    if (suited) {
      if (hi === 0) {
        if (lo <= 8) return RAISE;
        if (lo <= 10) return MIX;
        return CALL;
      }
      if (hi === 1) {
        if (lo <= 4) return RAISE;
        if (lo <= 7) return MIX;
        if (lo <= 9) return CALL;
        return FOLD;
      }
      if (hi === 2) {
        if (lo <= 5) return RAISE;
        if (lo <= 7) return MIX;
        return FOLD;
      }
      if (hi === 3) {
        if (lo <= 6) return MIX;
        return FOLD;
      }
      if (hi === 4 && lo <= 7) return MIX;
      if (hi === 5 && lo <= 8) return MIX;
      if (hi === 6 && lo === 8) return CALL;
      if (hi === 7 && lo === 9) return CALL;
      return FOLD;
    }
    if (hi === 0 && lo <= 3) return RAISE;
    if (hi === 0 && lo <= 7) return MIX;
    if (hi === 0 && lo <= 9) return CALL;
    if (hi === 1 && lo <= 3) return RAISE;
    if (hi === 1 && lo <= 6) return MIX;
    if (hi === 2 && lo <= 4) return MIX;
    if (hi === 3 && lo === 4) return CALL;
    return FOLD;
  }

  if (pos === 'SB') {
    if (pair) {
      if (hi <= 5) return RAISE;
      if (hi <= 8) return MIX;
      return CALL;
    }
    if (suited) {
      if (hi === 0 && lo <= 7) return RAISE;
      if (hi === 0) return MIX;
      if (hi === 1 && lo <= 3) return RAISE;
      if (hi === 1 && lo <= 7) return MIX;
      if (hi === 2 && lo <= 4) return RAISE;
      if (hi === 2 && lo <= 7) return MIX;
      if (hi === 3 && lo <= 5) return MIX;
      if (hi === 4 && lo === 5) return MIX;
      if (hi === 5 && lo === 6) return CALL;
      if (hi <= 7 && gap === 1) return CALL;
      return FOLD;
    }
    if (hi === 0 && lo <= 2) return RAISE;
    if (hi === 0 && lo <= 6) return MIX;
    if (hi === 0 && lo <= 9) return CALL;
    if (hi === 1 && lo <= 3) return MIX;
    if (hi === 1 && lo <= 6) return CALL;
    if (hi === 2 && lo === 3) return MIX;
    if (hi === 2 && lo === 4) return CALL;
    if (hi === 3 && lo === 4) return CALL;
    return FOLD;
  }

  if (pos === 'BB') {
    if (pair) {
      if (hi <= 2) return RAISE;
      if (hi <= 4) return MIX;
      if (hi <= 8) return CALL;
      if (hi <= 10) return MIX;
      return FOLD;
    }
    if (suited) {
      if (hi === 0 && lo === 1) return RAISE;
      if (hi === 0 && lo <= 3) return MIX;
      if (hi === 0 && lo <= 8) return CALL;
      if (hi === 0 && lo <= 10) return MIX;
      if (hi === 0) return CALL;
      if (hi === 1 && lo <= 2) return MIX;
      if (hi === 1 && lo <= 6) return CALL;
      if (hi === 2 && lo <= 3) return MIX;
      if (hi === 2 && lo <= 6) return CALL;
      if (hi === 3 && lo <= 6) return CALL;
      if (hi === 4 && lo <= 7) return CALL;
      if (hi === 5 && lo <= 8) return CALL;
      if (hi === 6 && lo <= 9) return MIX;
      if (hi === 7 && lo === 9) return CALL;
      return FOLD;
    }
    if (hi === 0 && lo === 1) return MIX;
    if (hi === 0 && lo <= 3) return CALL;
    if (hi === 0 && lo <= 7) return CALL;
    if (hi === 0 && lo <= 9) return MIX;
    if (hi === 1 && lo <= 3) return CALL;
    if (hi === 1 && lo <= 6) return MIX;
    if (hi === 2 && lo <= 4) return CALL;
    if (hi === 3 && lo === 4) return CALL;
    if (hi === 4 && lo === 5) return MIX;
    return FOLD;
  }

  return FOLD;
};

export const buildActionMatrix = (pos: Position): Action[][] => {
  const m: Action[][] = [];
  for (let r = 0; r < 13; r++) {
    m[r] = [];
    for (let c = 0; c < 13; c++) {
      const suited = r < c;
      const pair = r === c;
      const hi = pair ? r : Math.min(r, c);
      const lo = pair ? r : Math.max(r, c);
      m[r][c] = getAction(pos, suited, pair, hi, lo);
    }
  }
  return m;
};

export const handLabel = (r: number, c: number): string => {
  if (r === c) return RANKS_HIGH_FIRST[r] + RANKS_HIGH_FIRST[c];
  if (r < c) return RANKS_HIGH_FIRST[r] + RANKS_HIGH_FIRST[c] + 's';
  return RANKS_HIGH_FIRST[c] + RANKS_HIGH_FIRST[r] + 'o';
};

export const ACTION_LABEL: Record<Action, string> = {
  raise: 'Raise',
  call: 'Call',
  mix: 'Mix',
  fold: 'Fold',
};
