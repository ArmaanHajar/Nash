import { Card, fullDeck, rankOf } from './cards';
import { evaluate, HAND_NAMES } from './eval';

const RANK_SINGULAR = [
  'Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
  'Jack','Queen','King','Ace',
];
const RANK_PLURAL = [
  'Twos','Threes','Fours','Fives','Sixes','Sevens','Eights','Nines','Tens',
  'Jacks','Queens','Kings','Aces',
];

// Returns the category index for hero's best hand from the given board.
// Distinguishes Royal Flush (9) from Straight Flush (8) using the packed score.
export const categoryOf = (hero: [Card, Card], board: Card[]): number => {
  const r = evaluate([hero[0], hero[1], ...board]);
  if (r.category === 8) {
    const sfHigh = Math.floor(r.score / 65536) % 16;
    if (sfHigh === 12) return 9; // Royal Flush
  }
  return r.category;
};

// Plain-English description of hero's current made hand.
// e.g. "Pair of Aces", "Two Pair, Aces and Kings", "Flush", "Full House, Sevens full of Queens".
export const describeMadeHand = (hero: [Card, Card], board: Card[]): string => {
  const all = [hero[0], hero[1], ...board];
  const rankCounts = new Array<number>(13).fill(0);
  for (const c of all) rankCounts[rankOf(c)]++;

  const cat = categoryOf(hero, board);

  const pairs: number[] = [];
  const trips: number[] = [];
  const quads: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] === 4) quads.push(r);
    else if (rankCounts[r] === 3) trips.push(r);
    else if (rankCounts[r] === 2) pairs.push(r);
  }
  const highRank = (() => {
    for (let r = 12; r >= 0; r--) if (rankCounts[r] > 0) return r;
    return 0;
  })();

  switch (cat) {
    case 0: return `High Card: ${RANK_SINGULAR[highRank]}`;
    case 1: return pairs.length ? `Pair of ${RANK_PLURAL[pairs[0]]}` : 'Pair';
    case 2:
      if (pairs.length >= 2) return `Two Pair, ${RANK_PLURAL[pairs[0]]} and ${RANK_PLURAL[pairs[1]]}`;
      return 'Two Pair';
    case 3: return trips.length ? `Three of a Kind: ${RANK_PLURAL[trips[0]]}` : 'Three of a Kind';
    case 4: return 'Straight';
    case 5: return 'Flush';
    case 6: {
      if (trips.length >= 1 && pairs.length >= 1) {
        return `Full House, ${RANK_PLURAL[trips[0]]} full of ${RANK_PLURAL[pairs[0]]}`;
      }
      if (trips.length >= 2) {
        return `Full House, ${RANK_PLURAL[trips[0]]} full of ${RANK_PLURAL[trips[1]]}`;
      }
      return 'Full House';
    }
    case 7: return quads.length ? `Four of a Kind: ${RANK_PLURAL[quads[0]]}` : 'Four of a Kind';
    case 8: return 'Straight Flush';
    case 9: return 'Royal Flush';
    default: return HAND_NAMES[cat];
  }
};

// Returns the index (0..9) of the highest category hero can REACH by the river.
// On flop: enumerates all C(remaining,2) turn+river combos.
// On turn: tries each remaining card as the river.
// On river: returns the current category.
export const bestPossibleCategory = (
  hero: [Card, Card],
  board: Card[],
): number => {
  if (board.length === 5) return categoryOf(hero, board);

  const dead = new Set<number>([hero[0], hero[1], ...board]);
  const remaining = fullDeck().filter(c => !dead.has(c));

  let max = -1;
  if (board.length === 3) {
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const cat = categoryOf(hero, [...board, remaining[i], remaining[j]]);
        if (cat > max) max = cat;
        if (max === 9) return 9;
      }
    }
  } else if (board.length === 4) {
    for (const c of remaining) {
      const cat = categoryOf(hero, [...board, c]);
      if (cat > max) max = cat;
      if (max === 9) return 9;
    }
  }
  return max;
};
