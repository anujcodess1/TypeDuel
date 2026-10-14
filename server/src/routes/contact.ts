import { Router } from 'express';
import { z } from 'zod';
import { contactLimit } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import { getDb } from '../db/connection.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
  website: z.string().max(0).optional(),
  _submitTime: z.number().optional(),
});

router.post('/', contactLimit, validateBody(ContactSchema), (req, res, next) => {
  try {
    const { name, email, subject, message, website, _submitTime } = req.body as z.infer<typeof ContactSchema>;

    if (website && website.length > 0) {
      res.json({ ok: true });
      return;
    }

    if (_submitTime && Date.now() - _submitTime < 3000) {
      throw new AppError(429, 'Please slow down');
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO contact_submissions (name, email, subject, message, ip)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, email, subject, message, req.ip ?? null);

    logger.info({ event: 'contact_submission', email }, 'Contact form submitted');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
