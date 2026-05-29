import { Card, fullDeck } from './cards';
import { evaluate, HAND_NAMES } from './eval';

export interface BeatBreakdown {
  byCategory: Record<string, number>;
  combosByCategory: Record<string, [Card, Card][]>;
  totalBeating: number;
  totalCombos: number;
}

// Given hero hole cards and 3/4/5 board cards, enumerate all 2-card villain
// combos from the remaining deck and bucket the ones that currently beat hero.
export const enumerateBeats = (
  hero: [Card, Card],
  board: Card[],
): BeatBreakdown => {
  const dead = new Set<number>([hero[0], hero[1], ...board]);
  const remaining: Card[] = fullDeck().filter(c => !dead.has(c));

  const heroScore = evaluate([hero[0], hero[1], ...board]).score;

  const byCategory: Record<string, number> = {};
  const combosByCategory: Record<string, [Card, Card][]> = {};
  for (const name of HAND_NAMES) {
    byCategory[name] = 0;
    combosByCategory[name] = [];
  }

  let totalCombos = 0;
  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      totalCombos++;
      const v1 = remaining[i], v2 = remaining[j];
      const villain = evaluate([v1, v2, ...board]);
      if (villain.score > heroScore) {
        const name = HAND_NAMES[villain.category];
        byCategory[name]++;
        combosByCategory[name].push([v1, v2]);
      }
    }
  }

  let totalBeating = 0;
  for (const n of HAND_NAMES) totalBeating += byCategory[n];

  return { byCategory, combosByCategory, totalBeating, totalCombos };
};
