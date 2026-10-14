import { LRUCache } from 'lru-cache';

export const EASY_WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'hand', 'part', 'place',
  'case', 'week', 'company', 'where', 'much', 'help', 'through', 'line',
  'right', 'too', 'mean', 'old', 'life', 'few', 'north', 'open', 'seem',
  'same', 'large', 'turn', 'here', 'need', 'land', 'home', 'read',
  'set', 'city', 'put', 'end', 'why', 'let', 'big', 'try', 'high',
  'again', 'off', 'play', 'small', 'number', 'far', 'move', 'near',
  'field', 'keep', 'house', 'real', 'talk', 'eat', 'walk', 'run', 'ask',
  'add', 'late', 'car', 'eye', 'head', 'tree', 'book', 'room', 'side',
  'next', 'kind', 'stop', 'face', 'miss', 'town', 'own', 'hold', 'base',
  'hear', 'door', 'sure', 'know', 'true', 'fact', 'once', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten', 'both', 'each', 'learn', 'plan',
  'stay', 'form', 'born', 'show', 'draw', 'name', 'next', 'play', 'feel',
  'mile', 'river', 'voice', 'power', 'town', 'fine', 'drive', 'stood',
  'front', 'teach', 'final', 'happy', 'heart', 'light', 'money', 'month',
  'music', 'never', 'night', 'often', 'order', 'other', 'paper', 'party',
  'phone', 'piece', 'plant', 'price', 'print', 'queen', 'quick', 'quiet',
  'quite', 'raise', 'reach', 'ready', 'rest', 'river', 'round', 'scene',
  'sense', 'serve', 'seven', 'shape', 'share', 'shelf', 'shine', 'short',
  'since', 'skill', 'sleep', 'slide', 'small', 'smell', 'smile', 'solid',
  'solve', 'sorry', 'south', 'space', 'speak', 'speed', 'spend', 'stand',
  'start', 'state', 'steel', 'stick', 'still', 'stone', 'store', 'storm',
  'story', 'study', 'sugar', 'table', 'taste', 'teach', 'teeth', 'thank',
  'thing', 'think', 'third', 'those', 'three', 'threw', 'throw', 'tiger',
  'tired', 'today', 'total', 'touch', 'tough', 'tower', 'trail', 'train',
  'treat', 'trend', 'trial', 'tried', 'trust', 'twice', 'uncle', 'under',
  'union', 'until', 'upper', 'usual', 'value', 'video', 'visit', 'vital',
  'voice', 'voter', 'waste', 'watch', 'water', 'wheel', 'where', 'which',
  'while', 'white', 'whole', 'whose', 'wider', 'woman', 'women', 'world',
  'worry', 'worth', 'would', 'write', 'wrong', 'young', 'youth', 'zero',
];

export const NORMAL_WORDS = [
  ...EASY_WORDS.slice(0, 100),
  'abstract', 'achieve', 'acquire', 'advance', 'advertise', 'allocate',
  'analyze', 'ancient', 'another', 'anxiety', 'apparent', 'approach',
  'arrange', 'article', 'assault', 'attempt', 'balance', 'because',
  'benefit', 'between', 'brother', 'brought', 'captain', 'careful',
  'century', 'certain', 'chapter', 'charter', 'circuit', 'collect',
  'comment', 'compare', 'compete', 'complex', 'concept', 'conduct',
  'confirm', 'conform', 'connect', 'contact', 'content', 'context',
  'control', 'convert', 'correct', 'country', 'courage', 'culture',
  'current', 'custom', 'damage', 'danger', 'database', 'debate',
  'decide', 'decline', 'defense', 'deliver', 'demand', 'depend',
  'design', 'develop', 'digital', 'discuss', 'display', 'dispute',
  'divide', 'domain', 'dynamic', 'economy', 'element', 'enhance',
  'entire', 'episode', 'escape', 'example', 'express', 'failure',
  'feature', 'federal', 'fiction', 'foreign', 'forward', 'freedom',
  'funeral', 'general', 'genetic', 'genuine', 'gravity', 'healthy',
  'history', 'horizon', 'hunting', 'imagine', 'improve', 'include',
  'initial', 'inspect', 'install', 'instant', 'instead', 'integer',
  'involve', 'journey', 'justice', 'kingdom', 'kitchen', 'landing',
  'langage', 'largely', 'leading', 'leaving', 'library', 'limited',
  'listing', 'logical', 'machine', 'manager', 'mapping', 'maximum',
  'measure', 'medical', 'mention', 'message', 'minimum', 'miracle',
  'mixture', 'monitor', 'morning', 'mystery', 'natural', 'neither',
  'neutral', 'nominal', 'notable', 'nothing', 'nuclear', 'observe',
  'obvious', 'officer', 'operate', 'opinion', 'organic', 'outside',
  'overall', 'package', 'partial', 'perfect', 'perform', 'perhaps',
  'physics', 'picture', 'possess', 'precise', 'problem', 'process',
  'produce', 'product', 'program', 'promote', 'protect', 'provide',
  'publish', 'purpose', 'quality', 'quantum', 'quarter', 'radical',
  'receive', 'reflect', 'regular', 'release', 'replace', 'require',
  'respect', 'restore', 'revenue', 'reverse', 'section', 'service',
  'setting', 'similar', 'society', 'soldier', 'someone', 'station',
  'storage', 'student', 'subject', 'success', 'support', 'teacher',
  'through', 'tonight', 'version', 'whether', 'without', 'working',
  'Abraham', 'Climate', 'Digital', 'Eastern', 'Fashion', 'January',
  'Kingdom', 'Mineral', 'October', 'Phoenix', 'Quarter', 'Science',
  'Theatre', 'Uniform', 'Venture', 'Weather', 'Younger',
  'He said,', 'She ran.', 'Wait!', '"Hello,"', 'Stop!',
];

export const HARD_WORDS = [
  'acknowledgment', 'administration', 'aforementioned', 'amelioration',
  'approximately', 'architectural', 'authentication', 'authorization',
  'bibliographic', 'bureaucratic', 'catastrophic', 'collaborative',
  'commemorative', 'commonwealth', 'communication', 'comprehensive',
  'concentration', 'configuration', 'confrontation', 'conscientious',
  'consideration', 'constitutional', 'contamination', 'controversial',
  'cryptographic', 'decomposition', 'demonstrative', 'determination',
  'differentiation', 'disambiguation', 'disorganized', 'documentation',
  'electromagnetic', 'entrepreneurial', 'environmental', 'equilibrium',
  'establishment', 'exacerbation', 'experimentation', 'extrapolation',
  'extraordinary', 'facilitation', 'falsification', 'fingerprinting',
  'functionality', 'fundamentalist', 'generalization', 'globalization',
  'heterogeneous', 'hierarchical', 'humanitarian', 'hypothetically',
  'identification', 'ideologically', 'implementation', 'inconsistency',
  'indeterminate', 'infrastructure', 'initialization', 'internationalization',
  'interpretation', 'interrogation', 'introspective', 'investigation',
  'justification', 'knowledgeable', 'legitimization', 'liberalization',
  'marginalization', 'modernization', 'multiplication', 'normalization',
  'objectification', 'optimization', 'orchestration', 'organizational',
  'overwhelming', 'parallelization', 'parameterization', 'participation',
  'pathological', 'performative', 'philosophical', 'physiological',
  'probabilistic', 'procrastination', 'professionalism', 'proliferation',
  'proportionality', 'psychological', 'quantification', 'rationalization',
  'reconstruction', 'redistribution', 'representation', 'responsibility',
  'standardization', 'straightforward', 'suboptimization', 'superposition',
  'sustainability', 'synchronization', 'technological', 'telecommunications',
  'transformation', 'understanding', 'universalization', 'vulnerability',
  'The qu1ck br0wn f0x.', 'J@v@Scr1pt!', 'C0mpl3x-P@ssw0rd!',
  'H@rd_T3st#2024', 'Typ1ng@Sp33d!', 'K3yb0@rd#W@rri0r',
  '3rr0r: N0t F0und!', 'Sy5t3m.0verfl0w()', 'D3bug_Th1s_N0w!',
  'git c0mm1t -m "fix"', 'npm run bu1ld --prod', 'ERROR_C0DE: 404',
  'src/c0mp0nent.tsx', 'interface I_Am_Hard {}', 'const x: T = y as T;',
  'Z-index: 9999 !important', 'width: calc(100% - 2rem)',
  '{"key": "v@lu3", "num": 42}', 'https://ex@mple.com/p@th?q=1&r=2',
];

const wordCache = new LRUCache<string, string>({ max: 1000 });

function pickWords(wordList: string[], targetLength: number): string[] {
  const words: string[] = [];
  let currentLength = 0;

  while (currentLength < targetLength) {
    const word = wordList[Math.floor(Math.random() * wordList.length)]!;
    words.push(word);
    currentLength += word.length + 1;
  }

  return words;
}

export function generateText(difficulty: 'easy' | 'normal' | 'hard', durationSecs: number): string {
  const avgWpm = difficulty === 'easy' ? 50 : difficulty === 'normal' ? 70 : 90;
  const targetChars = Math.ceil((avgWpm * 5 * durationSecs) / 60) + 120;

  const wordList = difficulty === 'easy' ? EASY_WORDS : difficulty === 'normal' ? NORMAL_WORDS : HARD_WORDS;
  const words = pickWords(wordList, targetChars);
  return words.join(' ').trim();
}
