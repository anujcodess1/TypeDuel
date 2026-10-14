export interface ScoringInput {
  text: string;
  keystrokes: { char: string; index: number; correct: boolean; tsOffset: number }[];
  durationSecs: number;
  startedAt: number;
  finishedAt: number;
}

export interface ScoringResult {
  netWpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  wpmOverTime: { second: number; wpm: number }[];
}

export function computeScore(input: ScoringInput): ScoringResult {
  const { text, keystrokes, durationSecs } = input;

  let correctChars = 0;
  let incorrectChars = 0;
  const typedChars = new Map<number, boolean>();

  for (const ks of keystrokes) {
    const expected = text[ks.index];
    if (expected === undefined) continue;
    const isCorrect = ks.char === expected;
    typedChars.set(ks.index, isCorrect);
  }

  for (const [, correct] of typedChars) {
    if (correct) correctChars++;
    else incorrectChars++;
  }

  const totalChars = correctChars + incorrectChars;
  const accuracy = totalChars === 0 ? 0 : Math.round((correctChars / totalChars) * 1000) / 10;
  const rawWpm = Math.round((totalChars / 5) / (durationSecs / 60) * 10) / 10;
  const netWpm = Math.round((correctChars / 5) / (durationSecs / 60) * 10) / 10;

  const wpmOverTime = computeWpmOverTime(keystrokes, durationSecs);
  const consistency = computeConsistency(wpmOverTime);

  return { netWpm, rawWpm, accuracy, consistency, correctChars, incorrectChars, wpmOverTime };
}

function computeWpmOverTime(
  keystrokes: ScoringInput['keystrokes'],
  durationSecs: number,
): { second: number; wpm: number }[] {
  const buckets = new Map<number, number>();

  for (const ks of keystrokes) {
    if (!ks.correct) continue;
    const second = Math.min(Math.floor(ks.tsOffset / 1000), durationSecs - 1);
    buckets.set(second, (buckets.get(second) ?? 0) + 1);
  }

  const result: { second: number; wpm: number }[] = [];
  let cumChars = 0;

  for (let s = 0; s < durationSecs; s++) {
    cumChars += buckets.get(s) ?? 0;
    const wpm = s === 0 ? 0 : Math.round((cumChars / 5) / ((s + 1) / 60) * 10) / 10;
    result.push({ second: s + 1, wpm });
  }

  return result;
}

function computeConsistency(wpmOverTime: { wpm: number }[]): number {
  const wpms = wpmOverTime.filter(w => w.wpm > 0).map(w => w.wpm);
  if (wpms.length < 2) return 100;

  const mean = wpms.reduce((a, b) => a + b, 0) / wpms.length;
  const variance = wpms.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wpms.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : stdDev / mean;

  return Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));
}

export function computeElo(
  playerElo: number,
  opponentElo: number,
  won: boolean,
  isProvisional: boolean,
): number {
  const K = isProvisional ? 48 : 32;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual = won ? 1 : 0;
  const newElo = Math.round(playerElo + K * (actual - expected));
  return Math.max(0, newElo);
}
