import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from '@/store/toast';

const KEY_SESSION = 'typeduel_page_key';
const TS_SESSION = 'typeduel_page_key_activity';
const IDLE_LIMIT_MS = 60 * 60 * 1000;

let lastActivity = Number(sessionStorage.getItem(TS_SESSION)) || Date.now();

function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
}

const VALID_KEY = /^[a-z0-9]{12,24}$/;

function readSessionKey(): string | null {
  const k = sessionStorage.getItem(KEY_SESSION);
  if (k && !VALID_KEY.test(k)) {
    sessionStorage.removeItem(KEY_SESSION);
    return null;
  }
  return k;
}

function touch() {
  lastActivity = Date.now();
  sessionStorage.setItem(TS_SESSION, String(lastActivity));
}

function idleExpired() {
  return Date.now() - lastActivity > IDLE_LIMIT_MS;
}

export function useRouteKey() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const segs = pathname.split('/').filter(Boolean);
  const isAuth = segs[0] === 'auth' && (segs[1] === 'login' || segs[1] === 'register');
  const base = segs.length === 0 ? '/' : isAuth ? `/auth/${segs[1]}` : `/${segs[0]}`;
  const urlKey = isAuth ? segs[2] : segs[1];

  useEffect(() => {
    if (base === '/') return;

    if (idleExpired()) {
      sessionStorage.removeItem(KEY_SESSION);
      touch();
      toast('No activity for over an hour — page session expired', 'info');
      navigate('/', { replace: true });
      return;
    }
    touch();

    const sessionKey = readSessionKey();
    const validUrlKey = urlKey && VALID_KEY.test(urlKey) ? urlKey : undefined;
    if (!validUrlKey) {
      const next = sessionKey ?? generateKey();
      sessionStorage.setItem(KEY_SESSION, next);
      navigate(`${base}/${next}${search}`, { replace: true });
    } else if (!sessionKey) {
      sessionStorage.setItem(KEY_SESSION, validUrlKey);
    } else if (sessionKey !== validUrlKey) {
      navigate(`${base}/${sessionKey}${search}`, { replace: true });
    }
  }, [base, urlKey, search, navigate]);

  useEffect(() => {
    if (base === '/') return;

    const act = () => touch();
    const events = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, act, { passive: true }));

    const iv = setInterval(() => {
      if (idleExpired()) {
        sessionStorage.removeItem(KEY_SESSION);
        touch();
        events.forEach((e) => window.removeEventListener(e, act));
        toast('Idle for over an hour — session key dropped, head back to home', 'info');
        navigate('/', { replace: true });
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, act));
      clearInterval(iv);
    };
  }, [base, navigate]);
}
