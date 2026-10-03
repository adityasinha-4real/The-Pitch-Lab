import type { HeatCell } from "@/server/db/repo";
import { formatHour } from "@/domain/time";

const ROWS = [1, 2, 3, 4, 5, 6, 0];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday × hour grid. Accessible as a table; colour is never the only signal (each cell carries its %). */
export function Heatmap({ cells }: { cells: HeatCell[] }) {
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const at = (dow: number, hour: number) => cells.find((c) => c.dow === dow && c.hour === hour);

  return (
    <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Occupancy heatmap, scrolls sideways">
      <table className="w-full min-w-[720px] border-separate border-spacing-1" data-testid="heatmap">
        <caption className="sr-only">Percentage of turf-hours booked by weekday and hour</caption>
        <thead>
          <tr>
            <td />
            {hours.map((h) => (
              <th key={h} scope="col" className="pb-1 text-[0.65rem] font-semibold text-muted">
                {h % 3 === 0 ? formatHour(h).replace(" ", "") : <span className="sr-only">{formatHour(h)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((dow) => (
            <tr key={dow}>
              <th scope="row" className="pr-2 text-left text-xs font-semibold text-muted">
                {DAY[dow]}
              </th>
              {hours.map((h) => {
                const c = at(dow, h);
                const pct = c && c.slots ? Math.round((c.booked / c.slots) * 100) : 0;
                return (
                  <td
                    key={h}
                    title={`${DAY[dow]} ${formatHour(h)}: ${pct}% booked`}
                    className="h-9 rounded-md text-center align-middle text-[0.6rem] font-bold"
                    style={{
                      background: pct ? `color-mix(in oklab, var(--accent) ${18 + pct * 0.82}%, var(--surface-2))` : "var(--surface-2)",
                      color: pct >= 50 ? "var(--accent-ink)" : "var(--muted)",
                    }}
                  >
                    <span className="num">{pct ? pct : ""}</span>
                    <span className="sr-only">{pct ? "% booked" : "0% booked"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted" aria-hidden>
        <span>Quiet</span>
        {[0, 25, 50, 75, 100].map((p) => (
          <span key={p} className="h-3 w-6 rounded" style={{ background: p ? `color-mix(in oklab, var(--accent) ${18 + p * 0.82}%, var(--surface-2))` : "var(--surface-2)" }} />
        ))}
        <span>Packed</span>
      </div>
    </div>
  );
}
