"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function HeroCopy() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="relative">
      <motion.p variants={item} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent-fg backdrop-blur">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-accent" />
        </span>
        Floodlights on till midnight
      </motion.p>
      <h1 className="mt-6 font-display text-[clamp(4rem,13vw,9.5rem)] font-black uppercase leading-[0.82] tracking-tight">
        <motion.span variants={item} className="block">
          Book the
        </motion.span>
        <motion.span variants={item} className="block">
          pitch.
        </motion.span>
        <motion.span variants={item} className="block text-accent-fg">
          Bring the
        </motion.span>
        <motion.span variants={item} className="block text-accent-fg">
          nutmeg.
        </motion.span>
      </h1>
      <motion.p variants={item} className="mt-6 max-w-md text-lg text-muted">
        Hourly slots on three turfs. Hold yours for five minutes, pay, and split it with the squad before kick-off.
      </motion.p>
      <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/turfs">
            Find a slot <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/games">Join an open game</Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}
