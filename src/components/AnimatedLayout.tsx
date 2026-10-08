"use client";

import { motion } from "motion/react";
import React from "react";

// Fade in from below — use for cards, sections
export function FadeIn({ 
  children, 
  delay = 0,
  duration = 0.4,
  className = "",
  y = 12
}: { 
  children: React.ReactNode; 
  delay?: number;
  duration?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Stagger children — use for card grids
export function StaggerContainer({ 
  children, 
  staggerDelay = 0.06,
  className = ""
}: { 
  children: React.ReactNode; 
  staggerDelay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Individual stagger child
export function StaggerItem({ 
  children, 
  className = ""
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Smooth number counter animation
export function AnimatedNumber({ 
  value, 
  prefix = "", 
  suffix = "",
  formatFn,
}: { 
  value: number; 
  prefix?: string; 
  suffix?: string;
  formatFn?: (val: number) => string;
}) {
  const [displayValue, setDisplayValue] = React.useState(0);
  const prevValueRef = React.useRef(0);
  
  React.useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;
    
    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }
    
    const duration = 600; // ms
    const startTime = performance.now();
    
    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      setDisplayValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
  }, [value]);
  
  const formatted = formatFn ? formatFn(displayValue) : displayValue.toFixed(3);
  return <>{prefix}{formatted}{suffix}</>;
}

// Page wrapper with fade transition
export function PageTransition({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
