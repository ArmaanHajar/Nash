import { useMemo, useState } from 'react';
import {
  ACTION_LABEL,
  Action,
  POSITIONS,
  Position,
  RANKS_HIGH_FIRST,
  buildActionMatrix,
  handLabel,
} from '../preflop/chart';

export const PreflopChart = () => {
  const [pos, setPos] = useState<Position>('EP');
  const matrix = useMemo(() => buildActionMatrix(pos), [pos]);

  return (
    <div className="chart-wrap">
      <div className="chart-header">
        <div className="chart-header-text">
          <h2 className="chart-title">Preflop Chart</h2>
          <p className="chart-sub">
            6-max cash · 100bb deep. Suited (s) above the diagonal, offsuit (o) below, pairs on the diagonal. Big blind chart assumes facing a 3× open.
          </p>
        </div>
        <div className="chart-positions">
          {POSITIONS.map(p => (
            <button
              key={p.id}
              className={`pos-btn${pos === p.id ? ' active' : ''}`}
              onClick={() => setPos(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot raise" />Raise
          <span className="legend-info" data-tooltip="Open the pot with a raise (~2.5–3× big blind). This is your strongest action — you want to build the pot and narrow the field with a value-heavy range.">i</span>
        </span>
        <span className="legend-item">
          <span className="legend-dot call" />Call / limp
          <span className="legend-info" data-tooltip="If facing a raise, flat-call to see the flop. If unopened, limp in (just call the big blind). These hands have showdown value or playability but aren't strong enough to raise.">i</span>
        </span>
        <span className="legend-item">
          <span className="legend-dot mix" />Raise or call (marginal)
          <span className="legend-info" data-tooltip="A borderline hand. Default to raising if the table is passive or you're in late position; default to calling (or folding) against tight opponents or aggressive 3-bettors.">i</span>
        </span>
        <span className="legend-item">
          <span className="legend-dot fold" />Fold
          <span className="legend-info" data-tooltip="Muck it. The hand isn't strong or playable enough from this position to invest chips preflop.">i</span>
        </span>
      </div>

      <div className="chart-grid-scroll">
        <table className="chart-grid">
          <thead>
            <tr>
              <th></th>
              {RANKS_HIGH_FIRST.map(r => <th key={r}>{r === 'T' ? '10' : r}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, r) => (
              <tr key={r}>
                <th>{RANKS_HIGH_FIRST[r] === 'T' ? '10' : RANKS_HIGH_FIRST[r]}</th>
                {row.map((action, c) => {
                  const label = handLabel(r, c).replace('T', '10');
                  return (
                    <td key={c} className={`action-${action as Action}`}>
                      <div className="grid-cell">
                        <span className="hand-label">{label}</span>
                        <span className="action-label">{ACTION_LABEL[action]}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
