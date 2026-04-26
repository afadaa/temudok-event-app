import type { Request, Response, NextFunction } from 'express';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.ts';
import bcrypt from 'bcryptjs';

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const username = req.headers['x-admin-username'] as string;
  const password = req.headers['x-admin-password'] as string;
  
  if (!username || !password) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const adminSnap = await getDoc(doc(db, 'admins', username));
    if (!adminSnap.exists()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isValid = await bcrypt.compare(password, adminSnap.data().password);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
