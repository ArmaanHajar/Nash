import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { Card, cardStr, rankOf, suitOf, RANKS } from '../poker/cards';
import { BeatBreakdown } from '../poker/enumerate';
import { HAND_NAMES } from '../poker/eval';

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

let enginePromise: Promise<MLCEngine> | null = null;

export interface InitProgress {
  text: string;
  progress: number; // 0..1
}

export const loadCoach = (
  onProgress: (p: InitProgress) => void,
): Promise<MLCEngine> => {
  if (enginePromise) return enginePromise;
  enginePromise = CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (r: InitProgressReport) => {
      onProgress({ text: r.text, progress: r.progress });
    },
  });
  return enginePromise;
};

export const isWebGPUSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

const SUIT_NAMES = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANK_PLURAL = [
  'Twos','Threes','Fours','Fives','Sixes','Sevens','Eights','Nines','Tens',
  'Jacks','Queens','Kings','Aces',
];
const RANK_SINGULAR = [
  'Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
  'Jack','Queen','King','Ace',
];

const describeCards = (cards: Card[]): string =>
  cards.map(c => {
    const s = cardStr(c);
    return `${s[0]}${SUIT_NAMES[suitOf(c)][0]}`; // e.g. "Ah"
  }).join(' ');

const boardTextureNotes = (board: Card[]): string => {
  const suitCounts = [0, 0, 0, 0];
  for (const c of board) suitCounts[suitOf(c)]++;
  const maxSuit = Math.max(...suitCounts);
  const notes: string[] = [];
  if (maxSuit >= 3) notes.push(`monotone-leaning (${maxSuit} ${SUIT_NAMES[suitCounts.indexOf(maxSuit)]})`);
  else if (maxSuit === 2) notes.push('two-tone');
  return notes.join(', ');
};

// For each "wrong" category the user selected, produce a one-line deterministic
// reason it's impossible. Gives Doyle ground truth instead of letting the 1B
// model invent reasoning.
const explainImpossible = (category: string, board: Card[]): string => {
  const rankCounts = new Array<number>(13).fill(0);
  const suitCounts = [0, 0, 0, 0];
  for (const c of board) { rankCounts[rankOf(c)]++; suitCounts[suitOf(c)]++; }
  const maxSuit = Math.max(...suitCounts);
  const hasPair = rankCounts.some(n => n >= 2);
  const hasTrips = rankCounts.some(n => n >= 3);
  const boardRanks = board.map(c => RANKS[rankOf(c)]).sort();

  // For straights, check whether ANY 5-card window can be filled from board + any 2 cards.
  // Board has 3-5 cards. A straight needs 5 in a row; villain contributes up to 2.
  // So we need at least 3 board ranks within some 5-rank window.
  const rankMask = rankCounts.reduce((m, n, i) => n > 0 ? m | (1 << i) : m, 0);
  const aceLow = rankMask | ((rankMask & (1 << 12)) ? 1 << -1 : 0); // unused, just for clarity
  void aceLow;
  let maxInWindow = 0;
  for (let h = 4; h <= 12; h++) {
    let count = 0;
    for (let r = h - 4; r <= h; r++) if (rankMask & (1 << r)) count++;
    if (count > maxInWindow) maxInWindow = count;
  }
  // wheel window
  let wheelCount = 0;
  for (const r of [12, 0, 1, 2, 3]) if (rankMask & (1 << r)) wheelCount++;
  if (wheelCount > maxInWindow) maxInWindow = wheelCount;

  void hasPair; void hasTrips;
  switch (category) {
    case 'Pair':
    case 'Two Pair':
    case 'Three of a Kind':
    case 'Full House':
    case 'Four of a Kind':
      // These are almost always possible unless evaluator says hero already beats them all.
      // Realistically these are rarely "impossible" — usually user is right they exist but hero dominates.
      return `${category} would just need the right villain cards. The reason it doesn't beat you here is that your own hand already outranks any ${category.toLowerCase()} villain can make on this board.`;
    case 'Straight':
      if (maxInWindow < 3) {
        return `Straight is impossible. The board ranks (${boardRanks.join(', ')}) are too spread out — no 5-card window contains 3 board cards, so villain's 2 cards can't bridge the gaps.`;
      }
      return `Straight is mathematically possible on this board, but your hand beats every straight villain can make.`;
    case 'Flush':
      if (maxSuit < 3) {
        return `Flush is impossible. The board only has ${maxSuit} cards of any single suit — you need at least 3 of one suit on the board for villain to complete a flush with 2 hole cards.`;
      }
      return `A flush is possible on this board, but your hand beats it.`;
    case 'Straight Flush':
    case 'Royal Flush': {
      if (maxSuit < 3) return `${category} is impossible. No suit has 3+ cards on the board.`;
      // Find the flushy suit and check consecutive within it
      const flushSuit = suitCounts.indexOf(maxSuit);
      const suitedRanks = board.filter(c => suitOf(c) === flushSuit).map(c => rankOf(c));
      const suitMask = suitedRanks.reduce((m, r) => m | (1 << r), 0);
      let maxSuited = 0;
      for (let h = 4; h <= 12; h++) {
        let n = 0; for (let r = h - 4; r <= h; r++) if (suitMask & (1 << r)) n++;
        if (n > maxSuited) maxSuited = n;
      }
      if (maxSuited < 3) {
        return `${category} is impossible. The suited board cards aren't close enough together to make a 5-card straight flush.`;
      }
      if (category === 'Royal Flush') {
        const royalMask = (1<<8)|(1<<9)|(1<<10)|(1<<11)|(1<<12); // T,J,Q,K,A
        const hasRoyal = (suitMask & royalMask);
        const royalNeeded = 5 - Math.min(2, board.filter(c => suitOf(c) === flushSuit && rankOf(c) >= 8).length);
        if (!hasRoyal || royalNeeded > 2) {
          return `Royal Flush is impossible. The board doesn't have enough Ten-through-Ace cards of the same suit for villain to complete it with 2 hole cards.`;
        }
      }
      return `${category} is technically possible, but your hand beats it.`;
    }
    case 'High Card':
      return `You already have a made hand (a pair or better), so a villain holding only High Card can never outrank you.`;
    default:
      return `${category} doesn't beat you on this board.`;
  }
};

// For each "missed" category the user failed to identify, produce a one-line
// deterministic explanation of which board feature makes it possible.
const explainPossible = (category: string, board: Card[]): string => {
  const rankCounts = new Array<number>(13).fill(0);
  const suitCounts = [0, 0, 0, 0];
  for (const c of board) { rankCounts[rankOf(c)]++; suitCounts[suitOf(c)]++; }
  const pairedRanks: number[] = [];
  const tripRanks: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] >= 3) tripRanks.push(r);
    else if (rankCounts[r] === 2) pairedRanks.push(r);
  }
  const maxSuit = Math.max(...suitCounts);
  const flushSuitIdx = suitCounts.indexOf(maxSuit);
  const topBoardRank = (() => {
    for (let r = 12; r >= 0; r--) if (rankCounts[r] > 0) return r;
    return 0;
  })();

  switch (category) {
    case 'Full House': {
      if (tripRanks.length > 0) {
        return `The board has three ${RANK_PLURAL[tripRanks[0]]}, so any villain with a pocket pair makes a full house.`;
      }
      if (pairedRanks.length > 0) {
        const p = pairedRanks[0];
        const pp = RANK_PLURAL[p];
        const pSing = RANK_SINGULAR[p];
        const singles: number[] = [];
        for (let r = 12; r >= 0; r--) if (rankCounts[r] === 1) singles.push(r);
        if (singles.length > 0) {
          const pocketList = singles.map(r => `pocket ${RANK_PLURAL[r]}`).join(' or ');
          return `The board pairs ${pp}, so any villain holding ${pocketList}, or a ${pSing} plus another matching board card, makes a full house.`;
        }
        return `The board pairs ${pp}, so any villain with a ${pSing} plus another matching board card makes a full house.`;
      }
      return `A full house needs the board to pair up first.`;
    }
    case 'Four of a Kind': {
      if (pairedRanks.length > 0) {
        const pr = RANK_SINGULAR[pairedRanks[0]];
        return `The board pairs ${RANK_PLURAL[pairedRanks[0]]}, so a villain holding pocket ${pr}s makes quads.`;
      }
      return `Quads require the board to pair a rank that villain also holds.`;
    }
    case 'Three of a Kind': {
      if (pairedRanks.length > 0) {
        const pr = RANK_PLURAL[pairedRanks[0]];
        return `The board pairs ${pr}, so any villain with a ${RANK_SINGULAR[pairedRanks[0]]} in their hand makes trips.`;
      }
      return `A villain holding a pocket pair matching any board card (a "set") makes three of a kind.`;
    }
    case 'Two Pair': {
      if (pairedRanks.length > 0) {
        return `The board is already paired, so any villain who also pairs another board card has two pair.`;
      }
      return `Villain makes two pair by hitting two different board cards with their hole cards.`;
    }
    case 'Pair': {
      return `Almost any villain hand pairs at least one of the board cards.`;
    }
    case 'Straight': {
      // Find the lowest straight high-card whose window includes >=3 board ranks
      const rankMask = rankCounts.reduce((m, n, i) => n > 0 ? m | (1 << i) : m, 0);
      for (let h = 4; h <= 12; h++) {
        let inWindow: number[] = [];
        for (let r = h - 4; r <= h; r++) if (rankMask & (1 << r)) inWindow.push(r);
        if (inWindow.length >= 3) {
          const ranks = inWindow.map(r => RANK_SINGULAR[r]).join(', ');
          return `The board has ${ranks} within a 5-card window, so villain holding the gap-fillers completes a straight.`;
        }
      }
      // wheel
      const wheel = [12, 0, 1, 2, 3].filter(r => rankCounts[r] > 0);
      if (wheel.length >= 3) {
        return `The board has wheel cards (${wheel.map(r => RANK_SINGULAR[r]).join(', ')}), so villain can complete A-2-3-4-5.`;
      }
      return `A straight is possible somewhere on this board.`;
    }
    case 'Flush': {
      if (maxSuit >= 3) {
        return `The board has three ${SUIT_NAMES[flushSuitIdx]}, so any villain with two ${SUIT_NAMES[flushSuitIdx]} in their hand makes a flush.`;
      }
      return `Two-tone board with a flush draw — villain can still arrive at a flush by the river.`;
    }
    case 'Straight Flush':
    case 'Royal Flush': {
      if (maxSuit >= 3) {
        const suited = board.filter(c => suitOf(c) === flushSuitIdx)
          .map(c => RANK_SINGULAR[rankOf(c)]).join(', ');
        return `Three ${SUIT_NAMES[flushSuitIdx]} on the board (${suited}), and they're close enough to make a ${category.toLowerCase()} with the right suited villain cards.`;
      }
      return `${category} reachable with the right suited connectors.`;
    }
    case 'High Card': {
      return `A villain can hold an overcard (above your ${RANK_SINGULAR[topBoardRank]}) for a higher high-card hand.`;
    }
    default:
      return `${category} is possible on this board.`;
  }
};

export const buildCoachPrompt = (
  hero: [Card, Card],
  board: Card[],
  street: string,
  breakdown: BeatBreakdown,
  userSelections: Set<string>,
): { system: string; user: string } => {
  const present = HAND_NAMES.filter(n => breakdown.byCategory[n] > 0);
  const missed = present.filter(n => !userSelections.has(n));
  const wrong = HAND_NAMES.filter(n => userSelections.has(n) && breakdown.byCategory[n] === 0);
  const texture = boardTextureNotes(board);

  const system = `You are Doyle, a sharp poker coach speaking directly to a player. Address the player as "you" or "your". NEVER use the words "the student", "the player", or "the user" — always say "you" or "your". NEVER apologize, never write in first person ("I"). No advice ("you should...", "you need to improve...", "remember to..."). When multiple errors share the same board feature (e.g. a paired board enabling several hands), group them together — don't list each separately. CRITICAL: do NOT name any specific card ranks or suits that are not in the brief — use only the wording the brief gives you. Do NOT invent new reasons about hole cards, Aces, face-down cards, or anything not in the brief.`;

  let task: string;
  if (missed.length === 1) {
    const m = missed[0];
    const reason = explainPossible(m, board);
    task = `Brief: you missed "${m}". Reason: ${reason}

Write EXACTLY ONE sentence that starts with "You missed ${m} —" and rephrases the reason above. No advice, no summary.`;
  } else if (missed.length > 1) {
    const reasons = missed.map(m => `- ${m}: ${explainPossible(m, board)}`).join('\n');
    task = `Brief: you missed ${missed.length} categories: ${missed.join(', ')}.

Reasons:
${reasons}

Write 2 to 3 sentences. Start with "You missed ${missed.join(', ')}." Then GROUP categories that share the same board feature (e.g. a paired board enables Two Pair, Three of a Kind, Full House, and Four of a Kind all at once — explain those together in one sentence, not separately). Use ONLY the wording from the reasons above. No advice, no first person, no inventing cards.`;
  } else if (wrong.length === 1) {
    const w = wrong[0];
    const reason = explainImpossible(w, board);
    task = `Brief: you marked "${w}", but ${w} is impossible on this board. Reason: ${reason}

Write EXACTLY ONE sentence that starts with "${w} isn't possible here —" and rephrases the reason above. No advice, no summary, no mention of face-down cards.`;
  } else if (wrong.length > 1) {
    const reasons = wrong.map(w => `- ${w}: ${explainImpossible(w, board)}`).join('\n');
    task = `Brief: you incorrectly marked ${wrong.length} categories that aren't possible: ${wrong.join(', ')}.

Reasons:
${reasons}

Write 2 to 3 sentences explaining why none of those are possible here. Group categories with the same underlying reason together. Use ONLY the wording from the reasons above. No advice, no first person.`;
  } else {
    task = `Brief: you got every category right. Write EXACTLY ONE sentence naming the single biggest threat as the next card comes. No advice.`;
  }

  const user = `Street: ${street}
Your hole cards: ${describeCards(hero)}
Board: ${describeCards(board)}${texture ? ` (${texture})` : ''}

${task}`;

  return { system, user };
};
