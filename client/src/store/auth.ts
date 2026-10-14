import { create } from 'zustand';

export interface User {
  id: string;
  username: string;
  email: string;
  elo: number;
  provisional_games: number;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setGuest: (guest: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  isGuest: false,
  setUser: (user) => set({ user, isGuest: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setGuest: (isGuest) => set({ isGuest, user: null }),
  logout: () => set({ user: null, isGuest: false }),
}));
