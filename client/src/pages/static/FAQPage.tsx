import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    q: 'How is WPM calculated?',
    a: 'One word equals 5 characters (including spaces). Net WPM counts correct words per minute and subtracts uncorrected errors so your speed reflects both speed and accuracy.',
  },
  {
    q: 'How does the Elo rating work?',
    a: 'Everyone starts at 1200 rating. Winning races against higher-rated players gives more points, while losses deduct points based on standard Elo calculation.',
  },
  {
    q: 'How does anti-cheat work?',
    a: 'The server checks keystroke intervals and test duration to detect automated scripts, copy-paste attempts, and macros, keeping the leaderboards clean.',
  },
  {
    q: 'Can I practice without an account?',
    a: 'Yes. Solo practice is open without logging in. Creating an account lets you participate in ranked 1v1 duels, create private rooms, and save your scores on the leaderboards.',
  },
  {
    q: 'What keyboard layouts are supported?',
    a: 'All layouts (QWERTY, Dvorak, Colemak, etc.) work automatically with your system keyboard.',
  },
];

export function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
          <HelpCircle size={14} /> Questions & Answers
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Frequently Asked Questions</h1>
        <p className="text-muted text-base">Everything you need to know about TypeDuel mechanics and rankings.</p>
      </div>

      <div className="space-y-3">
        {FAQS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="card border border-default overflow-hidden transition-colors">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-[var(--text)] hover:text-accent"
              >
                <span>{item.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-muted transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-accent' : ''}`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm text-muted leading-relaxed border-t border-default/50 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
