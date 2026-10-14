import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('td-theme') as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('td-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

useThemeStore.getState().setTheme(useThemeStore.getState().theme);
