import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env['VITE_WS_URL'] ?? '';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function connectSocket(token?: string): void {
  const s = getSocket();
  if (token) {
    s.auth = { token };
  }
  if (!s.connected) s.connect();
}

export function reconnectSocket(): void {
  const s = getSocket();
  delete (s.auth as Record<string, unknown>)['token'];
  if (s.connected) s.disconnect();
  s.connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
