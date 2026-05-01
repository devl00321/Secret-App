import { Router } from 'express';
import crypto from 'node:crypto';

const router = Router();
const inviteCodes = new Map<
  string,
  {
    createdBy: string;
    expiresAt: number;
    isUsed: boolean;
  }
>();
const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 30;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const codeLifetimeMs = 10 * 60 * 1000;

const cleanupExpiredCodes = () => {
  const now = Date.now();

  for (const [code, entry] of inviteCodes.entries()) {
    if (entry.expiresAt <= now || entry.isUsed) {
      inviteCodes.delete(code);
    }
  }
};

router.use((req, res, next) => {
  cleanupExpiredCodes();

  const key = req.ip || 'unknown';
  const now = Date.now();
  const existing = requestCounts.get(key);

  if (!existing || existing.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    next();
    return;
  }

  if (existing.count >= maxRequestsPerWindow) {
    res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    return;
  }

  existing.count += 1;
  next();
});

// Generate pairing code
router.post('/pair/generate', async (req, res) => {
  const { userId } = req.body as { userId?: string };

  if (!userId || userId.trim().length < 3) {
    res.status(400).json({ error: 'A valid userId is required.' });
    return;
  }

  for (const [code, entry] of inviteCodes.entries()) {
    if (entry.createdBy === userId.trim()) {
      inviteCodes.delete(code);
    }
  }

  let code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

  while (inviteCodes.has(code)) {
    code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  const expiresAt = Date.now() + codeLifetimeMs;
  inviteCodes.set(code, {
    createdBy: userId.trim(),
    expiresAt,
    isUsed: false,
  });

  res.json({ code, expiresAt });
});

// Join via pairing code
router.post('/pair/join', async (req, res) => {
  const { code, userId } = req.body as { code?: string; userId?: string };
  const normalizedCode = code?.replace(/\D/g, '').slice(0, 6);

  if (!normalizedCode || normalizedCode.length !== 6 || !userId || userId.trim().length < 3) {
    res.status(400).json({ error: 'A valid code and userId are required.' });
    return;
  }

  const invite = inviteCodes.get(normalizedCode);

  if (!invite) {
    res.status(404).json({ error: 'Invite code not found or expired.' });
    return;
  }

  if (invite.isUsed) {
    res.status(409).json({ error: 'This invite code has already been used.' });
    return;
  }

  if (invite.expiresAt <= Date.now()) {
    inviteCodes.delete(normalizedCode);
    res.status(410).json({ error: 'This invite code has expired.' });
    return;
  }

  if (invite.createdBy === userId.trim()) {
    res.status(400).json({ error: 'You cannot join your own invite code.' });
    return;
  }

  invite.isUsed = true;

  res.json({
    success: true,
    coupleId: crypto.randomUUID(),
    partnerId: invite.createdBy,
  });
});

export default router;
