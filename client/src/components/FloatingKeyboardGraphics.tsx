import React from 'react';

export function FloatingKeyboardGraphics() {
  return (
    <div className="relative w-full max-w-xl mx-auto flex items-center justify-center min-h-[380px] sm:min-h-[440px] select-none pointer-events-none">
      
      {/* Ambient background soft glow */}
      <div 
        className="absolute w-72 h-72 rounded-full bg-accent/15 blur-3xl -z-10 animate-pulse pointer-events-none"
        style={{ animationDuration: '6s' }}
      />

      <div 
        className="relative z-10 w-full max-w-[420px] transition-transform animate-float-keyboard"
      >
        <svg
          viewBox="0 0 460 250"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-[0_20px_35px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_25px_40px_rgba(0,0,0,0.45)]"
        >
          {/* Keyboard Chassis Base */}
          <rect
            x="10"
            y="10"
            width="440"
            height="230"
            rx="22"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="3"
          />
          {/* Keyboard Inner Plate */}
          <rect
            x="22"
            y="22"
            width="416"
            height="206"
            rx="14"
            fill="var(--raised)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />

          {/* Row 1: Function / Number keys */}
          {/* Esc key (Accent) */}
          <rect x="32" y="32" width="28" height="26" rx="6" fill="var(--accent)" />
          <text x="46" y="49" fill="#FFFFFF" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold" textAnchor="middle">ESC</text>
          
          {[
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='
          ].map((key, i) => (
            <g key={key} className={i === 3 ? 'animate-key-tap-1' : ''}>
              <rect
                x={66 + i * 27.5}
                y="32"
                width="23.5"
                height="26"
                rx="5"
                fill="var(--surface)"
                stroke="var(--border)"
                strokeWidth="1.2"
              />
              <text x={77.7 + i * 27.5} y="49" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{key}</text>
            </g>
          ))}
          {/* Backspace */}
          <rect x="396" y="32" width="32" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="412" y="48" fill="var(--muted)" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">⌫</text>

          {/* Row 2: QWERTY */}
          <rect x="32" y="66" width="36" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="50" y="82" fill="var(--muted)" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">TAB</text>

          {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'].map((key, i) => (
            <g key={key} className={i === 2 || i === 4 ? 'animate-key-tap-2' : ''}>
              <rect
                x={74 + i * 27.5}
                y="66"
                width="23.5"
                height="26"
                rx="5"
                fill={i === 2 ? 'color-mix(in srgb, var(--accent) 15%, var(--surface))' : 'var(--surface)'}
                stroke={i === 2 ? 'var(--accent)' : 'var(--border)'}
                strokeWidth="1.2"
              />
              <text x={85.7 + i * 27.5} y="83" fill={i === 2 ? 'var(--accent)' : 'var(--text)'} fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">{key}</text>
            </g>
          ))}
          <rect x="404" y="66" width="24" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="416" y="82" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">\</text>

          {/* Row 3: ASDFGHJKL */}
          <rect x="32" y="100" width="44" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="54" y="116" fill="var(--muted)" fontSize="8.5" fontFamily="Inter, sans-serif" textAnchor="middle">CAPS</text>

          {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\''].map((key, i) => {
            const isF = key === 'F';
            const isJ = key === 'J';
            return (
              <g key={key} className={isF ? 'animate-key-tap-1' : ''}>
                <rect
                  x={82 + i * 27.5}
                  y="100"
                  width="23.5"
                  height="26"
                  rx="5"
                  fill="var(--surface)"
                  stroke="var(--border)"
                  strokeWidth="1.2"
                />
                <text x={93.7 + i * 27.5} y="117" fill="var(--text)" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">{key}</text>
                {/* Homing nubs on F and J */}
                {(isF || isJ) && (
                  <line x1={90 + i * 27.5} y1="121" x2={97.5 + i * 27.5} y2="121" stroke="var(--muted)" strokeWidth="1.2" strokeLinecap="round" />
                )}
              </g>
            );
          })}
          {/* Enter key (Accent) */}
          <rect x="385" y="100" width="43" height="26" rx="5" fill="var(--accent)" />
          <text x="406.5" y="117" fill="#FFFFFF" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold" textAnchor="middle">↵</text>

          {/* Row 4: SHIFT + ZXCVBNM */}
          <rect x="32" y="134" width="54" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="59" y="150" fill="var(--muted)" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">SHIFT</text>

          {['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'].map((key, i) => (
            <g key={key} className={i === 1 ? 'animate-key-tap-2' : ''}>
              <rect
                x={92 + i * 27.5}
                y="134"
                width="23.5"
                height="26"
                rx="5"
                fill="var(--surface)"
                stroke="var(--border)"
                strokeWidth="1.2"
              />
              <text x={103.7 + i * 27.5} y="151" fill="var(--text)" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="600" textAnchor="middle">{key}</text>
            </g>
          ))}
          <rect x="367" y="134" width="61" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="397.5" y="150" fill="var(--muted)" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">SHIFT</text>

          {/* Row 5: Modifiers & Spacebar */}
          <rect x="32" y="168" width="34" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="49" y="184" fill="var(--muted)" fontSize="8.5" fontFamily="Inter, sans-serif" textAnchor="middle">CTRL</text>

          <rect x="72" y="168" width="32" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="88" y="184" fill="var(--muted)" fontSize="8.5" fontFamily="Inter, sans-serif" textAnchor="middle">ALT</text>

          <rect x="110" y="168" width="36" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="128" y="184" fill="var(--muted)" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">⌘</text>

          {/* Spacebar */}
          <g className="animate-space-tap">
            <rect
              x="152"
              y="168"
              width="170"
              height="26"
              rx="6"
              fill="color-mix(in srgb, var(--accent) 12%, var(--surface))"
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
            {/* Subtle center line marker */}
            <line x1="225" y1="181" x2="249" y2="181" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </g>

          <rect x="328" y="168" width="36" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="346" y="184" fill="var(--muted)" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">⌘</text>

          <rect x="370" y="168" width="26" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="383" y="184" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">←</text>

          <rect x="402" y="168" width="26" height="26" rx="5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.2" />
          <text x="415" y="184" fill="var(--muted)" fontSize="10" fontFamily="JetBrains Mono, monospace" textAnchor="middle">→</text>
          
          <circle cx="430" cy="18" r="2.5" fill="var(--accent)" className="animate-ping" style={{ animationDuration: '3s' }} />
          <circle cx="430" cy="18" r="2" fill="var(--accent)" />
        </svg>
      </div>

      <div 
        className="absolute -bottom-6 -left-3 sm:left-1 z-20 w-28 sm:w-32 animate-float-reverse pointer-events-none"
        style={{ animationDelay: '1.6s' }}
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-xl"
        >
          <circle cx="60" cy="60" r="54" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
          <circle cx="60" cy="60" r="46" fill="var(--raised)" />

          <circle
            cx="60"
            cy="60"
            r="34"
            fill="none"
            stroke="var(--border)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="142.4 71.2"
            transform="rotate(150 60 60)"
          />
          <circle
            cx="60"
            cy="60"
            r="34"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray="99.7 213.6"
            transform="rotate(150 60 60)"
          />

          <g className="animate-gauge-needle" style={{ transformOrigin: '60px 60px' }}>
            <line x1="60" y1="60" x2="60" y2="34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="60" cy="60" r="5" fill="var(--text)" />
            <circle cx="60" cy="60" r="2.5" fill="var(--surface)" />
          </g>

          <text x="60" y="78" fill="var(--text)" fontSize="13" fontFamily="JetBrains Mono, monospace" fontWeight="800" textAnchor="middle">138</text>
          <text x="60" y="90" fill="var(--muted)" fontSize="8.5" fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">WPM</text>
        </svg>
      </div>

      <div 
        className="absolute -bottom-3 right-4 sm:right-10 z-20 w-20 sm:w-24 animate-float-slow pointer-events-none"
        style={{ animationDelay: '2.4s' }}
      >
        <svg
          viewBox="0 0 90 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-lg"
        >
          {/* Keycap Bottom Base Shadow / Chamfer */}
          <path
            d="M12 36 L45 18 L78 36 L78 64 L45 82 L12 64 Z"
            fill="var(--raised)"
            stroke="var(--border)"
            strokeWidth="2"
          />
          {/* Front Left Face */}
          <path
            d="M12 36 L45 54 L45 82 L12 64 Z"
            fill="color-mix(in srgb, var(--text) 8%, var(--surface))"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          {/* Front Right Face */}
          <path
            d="M45 54 L78 36 L78 64 L45 82 Z"
            fill="color-mix(in srgb, var(--text) 14%, var(--surface))"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          {/* Top Key Surface */}
          <path
            d="M18 34 L45 20 L72 34 L45 48 Z"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />
          {/* Top Glyph: Lightning Bolt for Speed */}
          <path
            d="M47 26 L40 34 H46 L43 42 L51 33 H45 L47 26 Z"
            fill="var(--accent)"
          />
        </svg>
      </div>

    </div>
  );
}
