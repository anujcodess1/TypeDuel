import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CountdownTimerProps {
  duration: number;
  isActive: boolean;
  onTimeUp: () => void;
}

export function CountdownTimer({ duration, isActive, onTimeUp }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  const tick = useCallback(() => {
    if (startTimeRef.current === null) return;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const remaining = Math.max(0, duration - elapsed);
    setTimeLeft(Math.ceil(remaining));

    if (remaining <= 0) {
      onTimeUpRef.current();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [duration]);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (!isActive) setTimeLeft(duration);
      startTimeRef.current = null;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, duration, tick]);

  const pct = (timeLeft / duration) * 100;
  const isWarning = timeLeft <= duration * 0.25;

  return (
    <div className="flex flex-col items-center gap-1" aria-live="polite" aria-label={`${timeLeft} seconds remaining`}>
      <span
        className={`font-mono text-5xl font-bold tabular-nums transition-colors ${
          isWarning ? 'text-error' : 'text-[var(--accent)]'
        }`}
      >
        {timeLeft}
      </span>
      <div className="w-20 progress-bar-track">
        <div
          className="progress-bar-fill transition-all"
          style={{
            width: `${pct}%`,
            background: isWarning ? 'var(--error)' : 'var(--accent)',
          }}
        />
      </div>
    </div>
  );
}
