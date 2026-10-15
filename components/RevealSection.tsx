"use client";

import { motion, useReducedMotion } from "framer-motion";

export function RevealSection({ children, className }: { children: React.ReactNode; className: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.section className={className} initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.45, ease: "easeOut" }}>{children}</motion.section>;
}

export function MotionCard({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className="cms-motion-card" whileHover={reduceMotion ? undefined : { y: -4 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }} transition={{ duration: 0.18, ease: "easeOut" }}>{children}</motion.div>;
}
