import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, cardStr, fullDeck, shuffle, suitOf } from './poker/cards';
import { HAND_NAMES } from './poker/eval';
import { enumerateBeats } from './poker/enumerate';
import { buildCoachPrompt, isWebGPUSupported, loadCoach } from './llm/coach';
import { PreflopChart } from './components/PreflopChart';

type Tab = 'trainer' | 'chart';

const MOBILE_BREAKPOINT = 820;
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

type Street = 'flop' | 'turn' | 'river';
type Phase = 'guessing' | 'revealed';

interface Hand {
  hero: [Card, Card];
  flop: [Card, Card, Card];
  turn: Card;
  river: Card;
}

const dealHand = (): Hand => {
  const d = shuffle(fullDeck());
  return {
    hero: [d[0], d[1]],
    flop: [d[2], d[3], d[4]],
    turn: d[5],
    river: d[6],
  };
};

const boardForStreet = (h: Hand, s: Street): Card[] => {
  if (s === 'flop') return [...h.flop];
  if (s === 'turn') return [...h.flop, h.turn];
  return [...h.flop, h.turn, h.river];
};

const SUIT_GLYPH = ['♣', '♦', '♥', '♠'];
const isRed = (c: Card) => suitOf(c) === 1 || suitOf(c) === 2;
const rankGlyph = (s: string) => (s[0] === 'T' ? '10' : s[0]);

const CardView = ({ c, small = false }: { c: Card | null; small?: boolean }) => {
  const cls = `card${small ? ' small' : ''}${c !== null && isRed(c) ? ' red' : ''}${c === null ? ' placeholder' : ''}`;
  if (c === null) return <div className={cls}><span className="rank">?</span><span className="suit">?</span></div>;
  const s = cardStr(c);
  const rank = rankGlyph(s);
  return (
    <div className={cls}>
      <span className={`rank${rank === '10' ? ' ten' : ''}`}>{rank}</span>
      <span className="suit">{SUIT_GLYPH[suitOf(c)]}</span>
    </div>
  );
};

// Big hole-card view with rank in two corners and a big pip background
const HoleCardView = ({ c }: { c: Card }) => {
  const red = isRed(c);
  const s = cardStr(c);
  const rank = rankGlyph(s);
  const suit = SUIT_GLYPH[suitOf(c)];
  const rankCls = `rank${rank === '10' ? ' ten' : ''}`;
  return (
    <div className={`card-lg${red ? ' red' : ''}`}>
      <div className="corner top">
        <span className={rankCls}>{rank}</span>
        <span className="suit">{suit}</span>
      </div>
      <div className="pip">{suit}</div>
      <div className="corner bottom">
        <span className={rankCls}>{rank}</span>
        <span className="suit">{suit}</span>
      </div>
    </div>
  );
};

const STREET_ORDER: Street[] = ['flop', 'turn', 'river'];
const STREET_LABEL: Record<Street, string> = { flop: 'Flop', turn: 'Turn', river: 'River' };
const MAX_COMBOS_SHOWN = 24;

export const App = () => {
  const [tab, setTab] = useState<Tab>('trainer');
  return (
    <>
      <nav className="tabs-bar">
        <span className="tabs-brand">NASH</span>
        <div className="tabs">
          <button
            className={`tab${tab === 'trainer' ? ' active' : ''}`}
            onClick={() => setTab('trainer')}
          >
            Trainer
          </button>
          <button
            className={`tab${tab === 'chart' ? ' active' : ''}`}
            onClick={() => setTab('chart')}
          >
            Preflop Chart
          </button>
        </div>
      </nav>
      {tab === 'trainer' ? <Trainer /> : <PreflopChart />}
    </>
  );
};

const Trainer = () => {
  const isMobile = useIsMobile();
  const [hand, setHand] = useState<Hand>(() => dealHand());
  const [street, setStreet] = useState<Street>('flop');
  const [phase, setPhase] = useState<Phase>('guessing');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealedCat, setRevealedCat] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const [coachStatus, setCoachStatus] = useState<'idle' | 'loading' | 'ready' | 'thinking' | 'error'>('idle');
  const [coachLoadText, setCoachLoadText] = useState('');
  const [coachLoadProgress, setCoachLoadProgress] = useState(0);
  const [coachOutput, setCoachOutput] = useState('');
  const coachAbortRef = useRef<AbortController | null>(null);

  const board = boardForStreet(hand, street);
  const breakdown = useMemo(() => enumerateBeats(hand.hero, board), [hand, street]);

  const presentCategories = HAND_NAMES.filter(n => breakdown.byCategory[n] > 0);

  const toggle = (name: string) => {
    if (phase !== 'guessing') return;
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelected(next);
  };

  const reveal = () => {
    const correctSet = new Set(presentCategories);
    let correct = 0;
    for (const n of HAND_NAMES) {
      const guessed = selected.has(n);
      const isPresent = correctSet.has(n);
      if (guessed === isPresent) correct++;
    }
    setScore(s => ({ correct: s.correct + correct, total: s.total + HAND_NAMES.length }));
    setPhase('revealed');
  };

  const askCoach = async () => {
    if (!isWebGPUSupported()) {
      setCoachStatus('error');
      setCoachOutput('WebGPU is not available in this browser. Try Chrome or Edge on desktop.');
      return;
    }
    setCoachOutput('');
    coachAbortRef.current?.abort();
    coachAbortRef.current = new AbortController();
    try {
      if (coachStatus !== 'ready') {
        setCoachStatus('loading');
        await loadCoach((p) => {
          setCoachLoadText(p.text);
          setCoachLoadProgress(p.progress);
        });
      }
      setCoachStatus('thinking');
      const engine = await loadCoach(() => {});
      const { system, user } = buildCoachPrompt(hand.hero, board, street, breakdown, selected);
      const chunks = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: true,
        temperature: 0.15,
        max_tokens: 220,
      });
      let acc = '';
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        acc += delta;
        setCoachOutput(acc);
      }
      setCoachStatus('ready');
    } catch (e) {
      setCoachStatus('error');
      setCoachOutput(e instanceof Error ? e.message : String(e));
    }
  };

  const nextStreet = () => {
    const idx = STREET_ORDER.indexOf(street);
    if (idx < STREET_ORDER.length - 1) {
      setStreet(STREET_ORDER[idx + 1]);
      setSelected(new Set());
      setRevealedCat(null);
      setCoachOutput('');
      setPhase('guessing');
    }
  };

  const newHand = () => {
    setHand(dealHand());
    setStreet('flop');
    setSelected(new Set());
    setRevealedCat(null);
    setCoachOutput('');
    setPhase('guessing');
  };

  const streetIdx = STREET_ORDER.indexOf(street);

  return (
    <div className={`scene${isMobile ? ' mobile' : ''}`}>
      {/* HUD top */}
      <div className="hud-top">
        <div className="brand">
          <small>WHAT BEATS YOU?</small>
        </div>
        <div className="hud-pills">
          <span className="pill">{STREET_LABEL[street]}</span>
          <span className="pill muted">
            {score.total > 0
              ? `${score.correct}/${score.total}  ·  ${Math.round((score.correct / score.total) * 100)}%`
              : 'New session'}
          </span>
        </div>
      </div>

      {/* Felt + board + chips, all in 3D perspective */}
      <div className="felt-wrap">
        <div className="felt">
          <div className="felt-title">— Dealer —</div>
          <div className="dealer-button">D</div>
          <div className="chip-stack left">
            <div className="chip-coin black" />
            <div className="chip-coin blue" />
            <div className="chip-coin" />
            <div className="chip-coin green" />
          </div>
          <div className="chip-stack right">
            <div className="chip-coin" />
            <div className="chip-coin blue" />
            <div className="chip-coin black" />
            <div className="chip-coin green" />
          </div>
          <div className="board">
            {hand.flop.map((c, i) => <CardView key={i} c={c} />)}
            <CardView c={streetIdx >= 1 ? hand.turn : null} />
            <CardView c={streetIdx >= 2 ? hand.river : null} />
          </div>
        </div>
      </div>

      {/* Hero hole cards in foreground */}
      <div className="hero-zone">
        <div className="hole-cards">
          <HoleCardView c={hand.hero[0]} />
          <HoleCardView c={hand.hero[1]} />
        </div>
      </div>

      {/* Action panel — glass HUD, top-right */}
      <div className="action-panel">
        <h2 className="action-title">What beats you?</h2>
        <div className="action-prompt">
          Select every hand category that currently has you beat on the {STREET_LABEL[street].toLowerCase()}.
        </div>

        <div className="cat-list">
          {HAND_NAMES.map(name => {
            const combos = breakdown.byCategory[name];
            const isPresent = combos > 0;
            const isSelected = selected.has(name);
            let cls = 'cat';
            if (phase === 'revealed') {
              cls += ' locked';
              if (isPresent && isSelected) cls += ' correct';
              else if (isPresent && !isSelected) cls += ' missed';
              else if (!isPresent && isSelected) cls += ' wrong';
            }
            const showInfo = phase === 'revealed' && isPresent;
            const isOpen = revealedCat === name;
            const combosForCat = breakdown.combosByCategory[name];
            return (
              <div key={name} className={cls}>
                <label className="cat-row">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={phase === 'revealed'}
                    onChange={() => toggle(name)}
                  />
                  <span className="cat-name">{name}</span>
                  {phase === 'revealed' && (
                    <span className="cat-badge">
                      {combos} {combos === 1 ? 'combo' : 'combos'}
                    </span>
                  )}
                  {showInfo && (
                    <button
                      type="button"
                      className={`info-btn${isOpen ? ' active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setRevealedCat(isOpen ? null : name);
                      }}
                      title="Show example hands"
                    >
                      i
                    </button>
                  )}
                </label>
                {isOpen && (
                  <div className="combo-reveal">
                    <div className="combo-list">
                      {combosForCat.slice(0, MAX_COMBOS_SHOWN).map(([a, b], i) => (
                        <div key={i} className="combo-row">
                          <CardView c={a} small />
                          <CardView c={b} small />
                        </div>
                      ))}
                    </div>
                    {combosForCat.length > MAX_COMBOS_SHOWN && (
                      <div className="combo-more">
                        +{combosForCat.length - MAX_COMBOS_SHOWN} more combos
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {phase === 'revealed' && (
          <div className="summary">
            <strong>{breakdown.totalBeating}</strong> of <strong>{breakdown.totalCombos}</strong> villain combos beat you
            {' '}({((breakdown.totalBeating / breakdown.totalCombos) * 100).toFixed(1)}%).
          </div>
        )}

        {phase === 'revealed' && !isMobile && (
          <div className="coach-panel">
            <div className="coach-header">
              <span className="coach-title">Doyle</span>
              {(coachStatus === 'idle' || coachStatus === 'ready' || coachStatus === 'error') && (
                <button className="secondary coach-btn" onClick={askCoach}>
                  {coachOutput ? 'Ask again' : 'Ask Doyle'}
                </button>
              )}
              {coachStatus === 'thinking' && (
                <span className="coach-status">thinking…</span>
              )}
            </div>
            {coachStatus === 'loading' && (
              <div className="coach-loading">
                <div className="coach-loading-text">{coachLoadText || 'Loading Llama 3.2 1B (first time only, ~600MB)…'}</div>
                <div className="coach-progress">
                  <div className="coach-progress-bar" style={{ width: `${Math.round(coachLoadProgress * 100)}%` }} />
                </div>
              </div>
            )}
            {coachOutput && (
              <div className={`coach-output${coachStatus === 'error' ? ' error' : ''}`}>
                {coachOutput}
              </div>
            )}
          </div>
        )}

        <div className="actions">
          {phase === 'guessing' && (
            <button onClick={reveal}>Reveal</button>
          )}
          {phase === 'revealed' && street !== 'river' && (
            <button onClick={nextStreet}>
              Deal {STREET_LABEL[STREET_ORDER[streetIdx + 1]]}
            </button>
          )}
          {phase === 'revealed' && street === 'river' && (
            <button onClick={newHand}>New hand</button>
          )}
          <button className="secondary" onClick={newHand}>Skip</button>
        </div>
      </div>
    </div>
  );
};
