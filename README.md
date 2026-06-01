# Nash

Nash is a browser-based Texas Hold'em training app for one specific skill: spotting every hand category that currently beats you.

The app deals random hero hole cards and a board, asks you to select the categories that can beat your current hand, then reveals the exact villain combo counts by category. After the reveal, an optional local AI coach named Doyle can summarize what you missed or marked incorrectly.

Live site: https://nash-3zx.pages.dev

## Features

- Random Hold'em hand generation across flop, turn, and river
- Exact enumeration of all remaining two-card villain combinations
- Category-level quiz flow for High Card through Royal Flush
- Combo counts and sample villain holdings for every category that beats you
- Running score across the session
- Optional in-browser coaching powered by WebLLM and WebGPU
- No backend service required

## Tech Stack

- React 18
- TypeScript
- Vite
- `@mlc-ai/web-llm` for the optional browser-local coach model

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## How To Play

1. Review your two hole cards and the current board.
2. Select every hand category that has at least one possible villain combo beating you.
3. Click `Reveal`.
4. Review missed, wrong, and correct categories.
5. Open a revealed category to inspect example villain combos.
6. Continue to the next street or start a new hand.

The quiz is category-based, not combo-by-combo. If any villain holding in a category beats you, that category should be selected.

## AI Coach

The `Ask Doyle` button appears after a reveal. It loads `Llama-3.2-1B-Instruct-q4f16_1-MLC` through WebLLM and runs locally in the browser.

Notes:

- Requires a browser with WebGPU support, such as recent desktop Chrome or Edge.
- The first load downloads the model assets and can be large.
- Coaching is optional; the core poker answers come from deterministic enumeration, not the language model.
- No API key or server is required for the coach.

## Project Structure

```text
src/
  App.tsx              Main game UI and quiz flow
  main.tsx             React entry point
  styles.css           Table, cards, HUD, and responsive styling
  llm/
    coach.ts           WebLLM loading and coach prompt construction
  poker/
    cards.ts           Card representation, parsing, deck, and shuffle helpers
    eval.ts            Five-to-seven card hand evaluator
    enumerate.ts       Villain combo enumeration and category breakdowns
public/
  background.jpg       Table background image
```

## Poker Logic

Cards are represented as numbers from `0` to `51`, with rank and suit derived from the card index. For each quiz state, the app:

1. Scores the hero's best hand from hole cards plus the current board.
2. Builds the remaining deck after removing hero and board cards.
3. Enumerates every two-card villain holding.
4. Scores each villain hand against the same board.
5. Buckets every hand that beats hero by made-hand category.

This makes the reveal deterministic and independent of the AI coach.

## Available Scripts

```bash
npm run dev      # Start Vite in development mode
npm run build    # Type-check and create a production build
npm run preview  # Serve the production build locally
```
