/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: {
        default: 'var(--border)',
      },
      divideColor: {
        default: 'var(--border)',
      },
      colors: {
        accent: {
          DEFAULT: '#D9622B',
          hover: '#C5551F',
        },
        correct: '#3E8E6A',
        error: '#C8443A',
        warning: '#D9A441',
        dark: {
          bg: '#121416',
          surface: '#1B1E21',
          raised: '#23272B',
          border: '#2A2E32',
          text: '#E8E6E1',
          muted: '#8A8F94',
        },
        light: {
          bg: '#F5F2EB',
          surface: '#FFFFFF',
          raised: '#FBF9F4',
          border: '#DDD8CC',
          text: '#1A1C1E',
          muted: '#6B6F73',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'typing': ['1.375rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'sm': '4px',
        DEFAULT: '8px',
        'lg': '12px',
        'xl': '16px',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      keyframes: {
        'caret-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1s ease-in-out infinite',
        'slide-up': 'slide-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
