export interface AntiCheatResult {
  flagged: boolean;
  reason?: string;
}

export interface KeystrokeEvent {
  char: string;
  index: number;
  correct: boolean;
  tsOffset: number;
  serverReceiveTime: number;
}

const MAX_WPM = 300;
const MIN_INTERVAL_MS = 20;
const MAX_CLIENT_SERVER_DRIFT_MS = 5000;
const ZERO_VARIANCE_THRESHOLD = 5;
const ZERO_VARIANCE_MIN_KEYSTROKES = 20;

export function analyzeKeystrokes(
  keystrokes: KeystrokeEvent[],
  text: string,
  netWpm: number,
  durationSecs: number,
): AntiCheatResult {
  if (netWpm > MAX_WPM) {
    return { flagged: true, reason: `WPM exceeds maximum (${netWpm} > ${MAX_WPM})` };
  }

  if (keystrokes.length < 5) {
    return { flagged: false };
  }

  const intervals: number[] = [];
  for (let i = 1; i < keystrokes.length; i++) {
    const prev = keystrokes[i - 1]!;
    const curr = keystrokes[i]!;
    const interval = curr.tsOffset - prev.tsOffset;
    if (interval > 0) intervals.push(interval);
  }

  const sustainedUnder20 = intervals.filter(iv => iv < MIN_INTERVAL_MS).length;
  if (sustainedUnder20 > intervals.length * 0.3 && intervals.length > 10) {
    return { flagged: true, reason: 'Inhuman keystroke intervals detected' };
  }

  if (intervals.length >= ZERO_VARIANCE_MIN_KEYSTROKES) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < ZERO_VARIANCE_THRESHOLD && mean > 0) {
      return { flagged: true, reason: 'Zero-variance timing pattern (bot signature)' };
    }
  }

  let outOfOrder = 0;
  for (let i = 1; i < keystrokes.length; i++) {
    if ((keystrokes[i]!.index ?? 0) < (keystrokes[i - 1]!.index ?? 0) - 2) {
      outOfOrder++;
    }
  }
  if (outOfOrder > keystrokes.length * 0.1) {
    return { flagged: true, reason: 'Keystroke sequence does not match text order' };
  }

  const serverDrifts = keystrokes.filter(
    ks => Math.abs(ks.serverReceiveTime - ks.tsOffset) > MAX_CLIENT_SERVER_DRIFT_MS,
  );
  if (serverDrifts.length > keystrokes.length * 0.2) {
    return { flagged: true, reason: 'Excessive client-server timestamp drift' };
  }

  return { flagged: false };
}

export function updateTrustScore(currentScore: number, flagged: boolean): number {
  if (flagged) {
    return Math.max(0, currentScore - 0.2);
  }
  return Math.min(1, currentScore + 0.01);
}

export function shouldAutoban(trustScore: number): boolean {
  return trustScore < 0.3;
}
