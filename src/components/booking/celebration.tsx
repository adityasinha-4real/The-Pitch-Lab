"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

const COLORS = ["var(--accent)", "#ffffff", "#ffb547", "#7ad7ff", "var(--accent)"];

/** Goal! The net ripples out from the strike point and confetti bursts. Static tick under reduced motion. */
export function Celebration() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => {
        const angle = (i / 46) * Math.PI * 2 + (i % 3) * 0.2;
        const dist = 140 + ((i * 37) % 160);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.7 - 60,
          rotate: (i * 47) % 360,
          color: COLORS[i % COLORS.length]!,
          w: 6 + (i % 3) * 3,
          h: i % 2 ? 6 : 12,
          delay: (i % 6) * 0.02,
        };
      }),
    [],
  );

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="celebration">
      {/* Net mesh with ripples */}
      <svg className="absolute inset-0 size-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="net" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0 H14 M0 0 V14" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1" fill="none" />
          </pattern>
          <radialGradient id="net-fade">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="net-mask">
            <motion.circle
              cx="200"
              cy="150"
              initial={{ r: 0 }}
              animate={{ r: 260 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              fill="url(#net-fade)"
            />
          </mask>
        </defs>
        <motion.rect
          width="400"
          height="300"
          fill="url(#net)"
          mask="url(#net-mask)"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 1.2, duration: 1.2 }}
        />
        {[0, 0.15, 0.3].map((d) => (
          <motion.circle
            key={d}
            cx="200"
            cy="150"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            initial={{ r: 4, opacity: 0.9 }}
            animate={{ r: 220, opacity: 0 }}
            transition={{ delay: d, duration: 1.2, ease: "easeOut" }}
          />
        ))}
      </svg>
      {/* Confetti */}
      <div className="absolute left-1/2 top-1/2">
        {pieces.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block rounded-[2px]"
            style={{ width: p.w, height: p.h, background: p.color }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: p.x, y: [0, p.y, p.y + 220], rotate: p.rotate + 540, opacity: [1, 1, 0], scale: 1 }}
            transition={{ duration: 1.9, delay: p.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.45, 1] }}
          />
        ))}
      </div>
    </div>
  );
}
