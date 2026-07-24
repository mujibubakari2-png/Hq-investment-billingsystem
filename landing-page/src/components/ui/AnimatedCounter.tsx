"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";

interface AnimatedCounterProps {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  decimals?: number;
}

export default function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 2,
  decimals = 0,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [displayed, setDisplayed] = useState(0);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0.2 });

  useEffect(() => {
    if (isInView) {
      motionVal.set(target);
    }
  }, [isInView, target, motionVal]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      setDisplayed(v);
    });
    return unsubscribe;
  }, [spring]);

  const formatted =
    decimals > 0
      ? displayed.toFixed(decimals)
      : Math.round(displayed).toLocaleString();

  return (
    <span ref={ref} aria-label={`${prefix}${target.toLocaleString()}${suffix}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}
