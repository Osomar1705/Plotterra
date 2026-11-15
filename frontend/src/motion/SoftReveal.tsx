import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SOFT_EASE } from './policy';

export function SoftReveal({ children, className, delay = 0 }: {
  children: ReactNode; className?: string; delay?: number;
}) {
  const reduced = useReducedMotion();
  return <motion.div className={className}
    initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.06 }}
    transition={{ duration: reduced ? 0 : 0.46, delay: reduced ? 0 : Math.min(delay, 0.16), ease: SOFT_EASE }}>
    {children}
  </motion.div>;
}
