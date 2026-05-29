import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import { Card, cardStr, suitOf } from '../poker/cards';
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

  const beatLines = present
    .map(n => `- ${n}: ${breakdown.byCategory[n]} combos`)
    .join('\n');

  const texture = boardTextureNotes(board);

  const system = `You are a concise poker coach. The user is training to recognize which hand categories beat them on a given board. Combo counts come from exhaustive enumeration and are authoritative — do not recompute or second-guess them. Explain *why* specific hand categories are possible given the board texture and which villain holdings make them. Keep responses under 6 sentences. No combinatorics math; just plain-English board reading.`;

  const user = `Street: ${street}
Hero hole cards: ${describeCards(hero)}
Board: ${describeCards(board)}${texture ? ` (${texture})` : ''}

Hand categories that currently beat hero (with combo counts):
${beatLines || '(none — hero has the nuts)'}

The user FAILED to identify these categories: ${missed.length ? missed.join(', ') : '(none)'}
The user INCORRECTLY selected these categories (they are not possible): ${wrong.length ? wrong.join(', ') : '(none)'}

Coach the user. If they missed categories, explain what board features make those hands possible and what villain holdings get there. If they had false positives, explain why those hands are impossible here. If they got everything right, briefly affirm and point out the biggest threat to watch on future streets.`;

  return { system, user };
};
