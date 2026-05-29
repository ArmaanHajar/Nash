export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'] as const;
export const SUITS = ['c','d','h','s'] as const;
export type Rank = typeof RANKS[number];
export type Suit = typeof SUITS[number];

export type Card = number; // 0..51, index = rankIdx * 4 + suitIdx

export const rankOf = (c: Card): number => Math.floor(c / 4);
export const suitOf = (c: Card): number => c % 4;
export const makeCard = (rankIdx: number, suitIdx: number): Card => rankIdx * 4 + suitIdx;

export const cardStr = (c: Card): string => RANKS[rankOf(c)] + SUITS[suitOf(c)];
export const parseCard = (s: string): Card => {
  const r = RANKS.indexOf(s[0].toUpperCase() as Rank);
  const su = SUITS.indexOf(s[1].toLowerCase() as Suit);
  if (r < 0 || su < 0) throw new Error(`bad card: ${s}`);
  return makeCard(r, su);
};

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
