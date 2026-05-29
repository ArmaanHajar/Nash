import { Card, rankOf, suitOf } from './cards';

export const HAND_NAMES = [
  'High Card','Pair','Two Pair','Three of a Kind','Straight',
  'Flush','Full House','Four of a Kind','Straight Flush',
] as const;
export type HandCategory = typeof HAND_NAMES[number];

// Returns a numeric score. Higher = better. Encodes category in top bits, then 5 tiebreaker ranks.
// score = cat * 16^5 + t1*16^4 + t2*16^3 + t3*16^2 + t4*16 + t5
const pack = (cat: number, tiebreakers: number[]): number => {
  let s = cat;
  for (let i = 0; i < 5; i++) {
    s = s * 16 + (tiebreakers[i] ?? 0);
  }
  return s;
};

export interface EvalResult {
  score: number;
  category: number; // 0..8 index into HAND_NAMES
}

// Evaluate best 5-card hand from 5-7 cards.
export const evaluate = (cards: Card[]): EvalResult => {
  const rankCounts = new Array<number>(13).fill(0);
  const suitCounts = new Array<number>(4).fill(0);
  const suitRankMask = new Array<number>(4).fill(0); // bitmask of ranks per suit
  let rankMask = 0;

  for (const c of cards) {
    const r = rankOf(c), s = suitOf(c);
    rankCounts[r]++;
    suitCounts[s]++;
    suitRankMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // Flush
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) { flushSuit = s; break; }

  // Straight flush
  if (flushSuit >= 0) {
    const m = suitRankMask[flushSuit] | ((suitRankMask[flushSuit] & (1 << 12)) ? 1 : 0) << 13; // wheel: A as -1
    // Use wheel trick: include bit at position -1 by checking A separately below
    const sfHigh = straightHigh(suitRankMask[flushSuit]);
    if (sfHigh >= 0) return { score: pack(8, [sfHigh]), category: 8 };
    void m;
  }

  // Quads
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] === 4) {
      let kicker = -1;
      for (let k = 12; k >= 0; k--) if (k !== r && rankCounts[k] > 0) { kicker = k; break; }
      return { score: pack(7, [r, kicker]), category: 7 };
    }
  }

  // Full house
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] === 3) trips.push(r);
    else if (rankCounts[r] === 2) pairs.push(r);
  }
  if (trips.length >= 2) return { score: pack(6, [trips[0], trips[1]]), category: 6 };
  if (trips.length === 1 && pairs.length >= 1) return { score: pack(6, [trips[0], pairs[0]]), category: 6 };

  // Flush
  if (flushSuit >= 0) {
    const top5 = topNFromMask(suitRankMask[flushSuit], 5);
    return { score: pack(5, top5), category: 5 };
  }

  // Straight
  const sHigh = straightHigh(rankMask);
  if (sHigh >= 0) return { score: pack(4, [sHigh]), category: 4 };

  // Trips
  if (trips.length === 1) {
    const kickers = topRanksExcluding(rankCounts, [trips[0]], 2);
    return { score: pack(3, [trips[0], ...kickers]), category: 3 };
  }

  // Two pair
  if (pairs.length >= 2) {
    const kicker = topRanksExcluding(rankCounts, [pairs[0], pairs[1]], 1)[0];
    return { score: pack(2, [pairs[0], pairs[1], kicker]), category: 2 };
  }

  // One pair
  if (pairs.length === 1) {
    const kickers = topRanksExcluding(rankCounts, [pairs[0]], 3);
    return { score: pack(1, [pairs[0], ...kickers]), category: 1 };
  }

  // High card
  const top5 = topRanksExcluding(rankCounts, [], 5);
  return { score: pack(0, top5), category: 0 };
};

// Returns the high rank index (0..12) of the best straight, or -1.
// rankMask: bit r set if rank r is present.
const straightHigh = (rankMask: number): number => {
  // Include wheel: treat A (bit 12) as also bit -1.
  const m = rankMask | ((rankMask & (1 << 12)) ? 1 : 0); // bit 0 doubles as the "low ace" anchor
  // Check from high to low: look for 5 consecutive bits ending at high h.
  // For h from 12 down to 4 (or 3 for wheel where high is 5 = rankIdx 3).
  for (let h = 12; h >= 4; h--) {
    const need = (1 << h) | (1 << (h - 1)) | (1 << (h - 2)) | (1 << (h - 3)) | (1 << (h - 4));
    if ((rankMask & need) === need) return h;
  }
  // Wheel: A-2-3-4-5 => high = 3 (rank '5')
  const wheelNeed = (1 << 12) | (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3);
  if ((m | rankMask) >= 0 && (rankMask & wheelNeed) === wheelNeed) return 3;
  return -1;
};

const topNFromMask = (mask: number, n: number): number[] => {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r);
  return out;
};

const topRanksExcluding = (counts: number[], exclude: number[], n: number): number[] => {
  const out: number[] = [];
  for (let r = 12; r >= 0 && out.length < n; r--) {
    if (counts[r] > 0 && !exclude.includes(r)) out.push(r);
  }
  return out;
};
