import express from 'express';
import bcrypt from 'bcryptjs';
import { getDoc, doc } from './firestoreCompat';
import { config } from './config';

export const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Prefer API key header
  const apiKey = req.headers['x-admin-api-key'] as string | undefined;
  if (apiKey && config.ADMIN_API_KEY && apiKey === config.ADMIN_API_KEY) return next();

  // Fallback to username/password (legacy) — still better than sending plaintext if used over TLS
  const username = req.headers['x-admin-username'] as string;
  const password = req.headers['x-admin-password'] as string;
  if (!username || !password) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const adminSnap = await getDoc(doc('admins', username));
    if (!adminSnap.exists()) return res.status(401).json({ error: 'Unauthorized' });
    const isValid = await bcrypt.compare(password, adminSnap.data().password);
    if (!isValid) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  } catch (err) {
    console.error('Admin auth error', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
