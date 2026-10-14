import React, { useEffect, useRef, useCallback, useState } from 'react';

export type CharState = 'default' | 'correct' | 'error';

interface TypingAreaProps {
  text: string;
  onKeystroke: (char: string, index: number, correct: boolean) => void;
  onFinish: () => void;
  isActive: boolean;
  disabled?: boolean;
}

const VISIBLE_LINES = 3;

export function TypingArea({ text, onKeystroke, onFinish, isActive, disabled }: TypingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textWrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const indexRef = useRef(0);
  const charsRef = useRef<CharState[]>([]);
  const caretRef = useRef<HTMLDivElement>(null);
  const charsElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [lineOffset, setLineOffset] = useState(0);
  const typingTimerRef = useRef<number>(0);

  const words = React.useMemo(() => {
    return text.split(' ');
  }, [text]);

  const updateCaret = useCallback(() => {
    const idx = indexRef.current;
    const caret = caretRef.current;
    if (!caret) return;

    if (!text || text.length === 0) {
      caret.style.display = 'none';
      return;
    }

    caret.style.display = 'block';

    let targetLeft = 0;
    let targetTop = 0;
    let targetHeight = 32;

    if (idx < text.length) {
      const el = charsElementsRef.current[idx];
      if (el) {
        targetLeft = el.offsetLeft;
        targetTop = el.offsetTop;
        targetHeight = el.offsetHeight || 32;
      }
    } else {
      const lastEl = charsElementsRef.current[text.length - 1];
      if (lastEl) {
        targetLeft = lastEl.offsetLeft + lastEl.offsetWidth;
        targetTop = lastEl.offsetTop;
        targetHeight = lastEl.offsetHeight || 32;
      }
    }

    caret.style.transform = `translate3d(${targetLeft}px, ${targetTop}px, 0)`;
    caret.style.height = `${targetHeight}px`;

    if (targetTop > 0) {
      const lineHeight = targetHeight || 36;
      const currentLine = Math.floor(targetTop / lineHeight);
      if (currentLine >= 2) {
        setLineOffset((currentLine - 1) * lineHeight);
      } else {
        setLineOffset(0);
      }
    } else {
      setLineOffset(0);
    }
  }, [text]);

  const triggerTypingAnimation = useCallback(() => {
    const caret = caretRef.current;
    if (!caret) return;
    caret.classList.add('typing');
    caret.classList.remove('blinking');
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      if (caret) {
        caret.classList.remove('typing');
        caret.classList.add('blinking');
      }
    }, 500);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isActive || disabled) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }

      triggerTypingAnimation();

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (indexRef.current > 0) {
          indexRef.current--;
          const el = charsElementsRef.current[indexRef.current];
          if (el) {
            el.className = 'char-default';
            charsRef.current[indexRef.current] = 'default';
          }
          requestAnimationFrame(updateCaret);
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();

      const idx = indexRef.current;
      if (idx >= text.length) return;

      const expected = text[idx]!;
      const correct = e.key === expected;
      charsRef.current[idx] = correct ? 'correct' : 'error';

      const el = charsElementsRef.current[idx];
      if (el) {
        el.className = correct ? 'char-correct' : 'char-error';
      }

      onKeystroke(e.key, idx, correct);
      indexRef.current++;

      if (indexRef.current >= text.length) {
        requestAnimationFrame(updateCaret);
        onFinish();
        return;
      }

      requestAnimationFrame(updateCaret);
    },
    [isActive, disabled, text, updateCaret, onKeystroke, onFinish, triggerTypingAnimation],
  );

  useEffect(() => {
    indexRef.current = 0;
    charsRef.current = Array(text.length).fill('default');
    charsElementsRef.current.forEach((el) => {
      if (el) el.className = 'char-default';
    });
    setLineOffset(0);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(updateCaret);
    });
    return () => cancelAnimationFrame(id);
  }, [text, updateCaret]);

  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(updateCaret);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateCaret]);

  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
      requestAnimationFrame(updateCaret);
    }
  }, [isActive, updateCaret]);

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  let runningCharIndex = 0;

  return (
    <div
      className="typing-area relative select-none cursor-text w-full outline-none"
      style={{
        minHeight: '7.5rem',
        maxHeight: `${VISIBLE_LINES * 2.6}rem`,
        overflow: 'hidden',
      }}
      ref={containerRef}
      onClick={handleContainerClick}
      aria-label="Typing test area"
    >
      <div
        ref={textWrapperRef}
        className="relative flex flex-wrap gap-y-2 select-none"
        style={{
          transform: `translateY(-${lineOffset}px)`,
          transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {words.map((word, wordIndex) => {
          const wordStartIndex = runningCharIndex;
          const wordLetters = word.split('');
          const hasTrailingSpace = wordIndex < words.length - 1;

          // Advance running index past letters and trailing space
          runningCharIndex += word.length + (hasTrailingSpace ? 1 : 0);

          return (
            <span key={wordIndex} className="inline-flex whitespace-nowrap">
              {wordLetters.map((char, charOffset) => {
                const globalIndex = wordStartIndex + charOffset;
                return (
                  <span
                    key={globalIndex}
                    ref={(el) => {
                      charsElementsRef.current[globalIndex] = el;
                    }}
                    className="char-default inline-block"
                  >
                    {char}
                  </span>
                );
              })}

              {hasTrailingSpace && (
                <span
                  key={wordStartIndex + word.length}
                  ref={(el) => {
                    charsElementsRef.current[wordStartIndex + word.length] = el;
                  }}
                  className="char-default inline-block"
                >
                  {'\u00A0'}
                </span>
              )}
            </span>
          );
        })}

        {/* Floating smooth caret */}
        <div
          ref={caretRef}
          className={`caret ${isActive ? 'blinking' : ''}`}
          aria-hidden="true"
        />
      </div>

      {/* Single focused invisible input receiving raw keyboard events exclusively */}
      <input
        ref={inputRef}
        type="text"
        className="absolute inset-0 opacity-0 cursor-text pointer-events-auto"
        onKeyDown={handleKeyDown}
        onPaste={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-hidden="true"
      />
    </div>
  );
}
