import { cn } from "@/lib/utils";

type Variant = "box" | "ridge" | "rooftop";

const variantFor = (slug: string): Variant =>
  slug.includes("rabona") ? "ridge" : slug.includes("panenka") ? "rooftop" : "box";

/**
 * Aerial illustration of a turf, drawn with theme tokens so it reads as a
 * floodlit night pitch in dark mode and sunlit grass in light mode.
 */
export function TurfArt({ slug, className, title }: { slug: string; className?: string; title?: string }) {
  const v = variantFor(slug);
  const id = `art-${slug}`;
  const w = 640;
  const h = 400;
  const pitch = v === "ridge" ? { x: 70, y: 70, w: 500, h: 290 } : v === "rooftop" ? { x: 150, y: 120, w: 340, h: 240 } : { x: 130, y: 70, w: 380, h: 280 };
  const stripes = v === "ridge" ? 10 : 8;
  const cx = pitch.x + pitch.w / 2;
  const cy = pitch.y + pitch.h / 2;
  const boxW = pitch.w * 0.14;
  const boxH = pitch.h * 0.46;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("block size-full", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        {(
          [
            ["tl", "0", "0"],
            ["tr", "1", "0"],
            ["bl", "0", "1"],
            ["br", "1", "1"],
          ] as const
        ).map(([k, gx, gy]) => (
          <radialGradient key={k} id={`${id}-flood-${k}`} cx={gx} cy={gy} r="0.7">
            <stop offset="0%" stopColor="var(--art-light)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--art-light)" stopOpacity="0" />
          </radialGradient>
        ))}
        <clipPath id={`${id}-clip`}>
          <rect x={pitch.x} y={pitch.y} width={pitch.w} height={pitch.h} rx="6" />
        </clipPath>
      </defs>

      <rect width={w} height={h} fill="var(--art-ground)" />

      {v === "rooftop" && (
        <g fill="var(--art-skyline)">
          {[
            [0, 70, 50],
            [46, 40, 40],
            [82, 85, 60],
            [138, 55, 30],
            [164, 30, 48],
            [210, 75, 70],
            [276, 50, 36],
            [308, 20, 44],
            [348, 62, 58],
            [402, 38, 34],
            [432, 80, 62],
            [490, 46, 40],
            [526, 28, 52],
            [574, 66, 66],
          ].map(([x, top, bw]) => (
            <rect key={x} x={x} y={top} width={bw} height={110 - (top as number)} />
          ))}
          <rect x="0" y="108" width={w} height="4" fill="var(--art-board)" />
        </g>
      )}

      <g clipPath={`url(#${id}-clip)`}>
        <rect x={pitch.x} y={pitch.y} width={pitch.w} height={pitch.h} fill="var(--art-pitch)" />
        {Array.from({ length: stripes }, (_, i) =>
          i % 2 ? (
            <rect key={i} x={pitch.x + (i * pitch.w) / stripes} y={pitch.y} width={pitch.w / stripes} height={pitch.h} fill="var(--art-pitch-2)" />
          ) : null,
        )}
      </g>

      <g fill="none" stroke="var(--art-chalk)" strokeWidth="2.5">
        <rect x={pitch.x + 10} y={pitch.y + 10} width={pitch.w - 20} height={pitch.h - 20} rx="3" />
        <line x1={cx} y1={pitch.y + 10} x2={cx} y2={pitch.y + pitch.h - 10} />
        <circle cx={cx} cy={cy} r={pitch.h * 0.16} />
        <rect x={pitch.x + 10} y={cy - boxH / 2} width={boxW} height={boxH} />
        <rect x={pitch.x + pitch.w - 10 - boxW} y={cy - boxH / 2} width={boxW} height={boxH} />
      </g>
      <circle cx={cx} cy={cy} r="3.5" fill="var(--art-chalk)" />

      {/* Goals */}
      <g fill="var(--art-chalk)">
        <rect x={pitch.x + 2} y={cy - 22} width="8" height="44" rx="2" />
        <rect x={pitch.x + pitch.w - 10} y={cy - 22} width="8" height="44" rx="2" />
      </g>

      {/* Rebound boards for the cage */}
      {v === "box" && (
        <rect x={pitch.x - 8} y={pitch.y - 8} width={pitch.w + 16} height={pitch.h + 16} rx="12" fill="none" stroke="var(--art-board)" strokeWidth="8" />
      )}

      {/* Floodlight wash from each corner, then the pylons */}
      {(["tl", "tr", "bl", "br"] as const).map((k) => (
        <rect key={k} width={w} height={h} fill={`url(#${id}-flood-${k})`} />
      ))}
      {[
        [pitch.x - 26, pitch.y - 26],
        [pitch.x + pitch.w + 26, pitch.y - 26],
        [pitch.x - 26, pitch.y + pitch.h + 26],
        [pitch.x + pitch.w + 26, pitch.y + pitch.h + 26],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={(x as number) - 7} y={(y as number) - 7} width="14" height="14" rx="3" fill="var(--art-pylon)" />
          <circle cx={x} cy={y} r="3.5" fill="var(--art-light)" />
        </g>
      ))}

      {/* The ball, mid-nutmeg */}
      <g transform={`translate(${cx + pitch.w * 0.22} ${cy + pitch.h * 0.18})`}>
        <ellipse cx="2" cy="8" rx="9" ry="3" fill="rgb(0 0 0 / 0.25)" />
        <circle r="8" fill="#ffffff" stroke="rgb(0 0 0 / 0.25)" />
        <path d="M0 -3.5 l3.3 2.4 -1.3 3.9 h-4 l-1.3 -3.9z" fill="#111" />
      </g>
    </svg>
  );
}
