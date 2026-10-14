import { reconnectSocket } from './socket';

const BASE = import.meta.env['VITE_API_URL'] ?? '';

const NO_REFRESH_PATHS = new Set([
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/logout-all',
]);

let refreshInFlight: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = request<{ user: unknown }>('/api/auth/refresh', { method: 'POST' }, false)
      .then(() => {
        // cookie now holds a fresh access token — let the socket re-authenticate with it
        reconnectSocket();
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function reauthSocket(): Promise<boolean> {
  return tryRefresh();
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401 && allowRefresh && !NO_REFRESH_PATHS.has(path)) {
    if (await tryRefresh()) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json() as { error?: string };
      message = data.error ?? message;
    } catch {}
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  elo: number;
  provisional_games: number;
}

export const api = {
  auth: {
    register: (body: { username: string; email: string; password: string }) =>
      request<{ user: UserResponse }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body: { usernameOrEmail: string; password: string }) =>
      request<{ user: UserResponse }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    refresh: () => request<{ user: UserResponse }>('/api/auth/refresh', { method: 'POST' }),

    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

    logoutAll: () => request<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST' }),

    me: () => request<UserResponse>('/api/auth/me'),

    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),

    deleteAccount: (body: { password: string }) =>
      request<{ ok: boolean }>('/api/auth/account', { method: 'DELETE', body: JSON.stringify(body) }),

    sessions: () => request<{ sessions: unknown[] }>('/api/auth/sessions'),

    revokeSession: (sessionId: string) =>
      request<{ ok: boolean }>(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' }),
  },

  leaderboard: {
    get: (params: { difficulty: string; duration: number; period: string; cursor?: string }) => {
      const q = new URLSearchParams({
        difficulty: params.difficulty,
        duration: String(params.duration),
        period: params.period,
        ...(params.cursor ? { cursor: params.cursor } : {}),
      });
      return request<{ rows: unknown[]; nextCursor: string | null; currentUserRow: unknown | null }>(
        `/api/leaderboard?${q}`,
      );
    },

    profile: (username: string) => request<unknown>(`/api/leaderboard/profile/${username}`),

    me: () => request<unknown>('/api/leaderboard/me'),
  },

  stats: {
    get: () => request<{
      onlinePlayers: number;
      activeRooms: number;
      racesToday: number;
      duelsToday: number;
      totalRaces: number;
    }>('/api/stats'),
  },

  contact: {
    submit: (body: { name: string; email: string; subject: string; message: string; _submitTime: number }) =>
      request<{ ok: boolean }>('/api/contact', { method: 'POST', body: JSON.stringify(body) }),
  },
};
