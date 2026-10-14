# SECURITY.md

## Threat Model Summary

TypeDuel handles user accounts, game state, and competitive rankings. The following threat categories are mitigated in code:

### Authentication Threats
- **Credential stuffing / brute force**: Per-account and per-IP lockout with exponential backoff. Rate limits on login/register.
- **Session hijacking**: httpOnly, Secure, SameSite=Strict cookies with `__Host-` prefix. JWT access tokens (15 min TTL) + refresh token rotation.
- **Token replay**: Refresh token reuse detection — reuse invalidates the entire token family.
- **Enumeration**: Generic error messages for login/register. Constant-time comparisons.

### Game Integrity
- **Cheating**: Server-authoritative scoring. Clients only send keystrokes; server recomputes WPM, accuracy, consistency.
- **Bot detection**: Inhuman keystroke interval detection (<20ms sustained), zero-variance timing, WPM cap (300), paste/drag rejection.
- **Score manipulation**: Each session has a signed, single-use session ID. Replayed or expired submissions are rejected.
- **Tab-switching**: Detected and flagged during active matches.

### Input Threats
- **Injection**: Parameterized queries everywhere. Zod schema validation on all inputs.
- **XSS**: No `dangerouslySetInnerHTML`. Strict CSP with nonce-based inline style blocking.
- **CSRF**: Double-submit cookie pattern on all state-changing routes.
- **Prototype pollution**: Input sanitization; no dynamic property access on user data.

### Transport Threats
- **MITM**: HSTS with preload. Secure cookies. HTTPS enforced in production.
- **CORS misconfiguration**: Origin whitelist via env; same whitelist enforced on Socket.IO handshake.
- **Header leakage**: Helmet with strict headers; `x-powered-by` removed.

### Abuse Threats
- **Rate limiting**: express-rate-limit on all routes; stricter tiers on auth endpoints.
- **Socket flooding**: Per-event rate limits; connection limits per IP; auto-disconnect on violations.
- **Room guessing**: Unambiguous 6-char codes from crypto.randomBytes; passwords hashed with argon2id.
- **Spam**: Contact form honeypot, time-to-submit check, rate limit.

### Operational Security
- Secrets only from environment variables, validated at boot.
- No stack traces in production responses.
- Structured audit log with PII redaction.
- Graceful shutdown drains sockets and DB.

---

## Responsible Disclosure

If you discover a security vulnerability, please **do not** open a public issue. Instead, email **security@typeduel.io** with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

We aim to respond within 48 hours and resolve critical issues within 7 days.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes     |
| < 1.0   | ❌ No      |

---

## Dependency Security

Run `npm run audit` to check for known vulnerabilities. We use Dependabot for automated dependency updates.
