import type { Request, Response } from 'express';
import { collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, db } from '../database/compat.ts';

export class EventController {
  static async getPublicEvents(req: Request, res: Response) {
    try {
      const q = query(collection(db, 'events'), where('isActive', '==', true), orderBy('startDate', 'asc'));
      const snapshot = await getDocs(q);
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error('Fetch events error:', e);
      res.status(500).json([]);
    }
  }

  static async getAdminEvents(req: Request, res: Response) {
    try {
      const snapshot = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
  }

  static async createEvent(req: Request, res: Response) {
    try {
      const now = new Date();
      const fiveSecondsAgo = new Date(now.getTime() - 5000).toISOString();
      const duplicateCheck = await getDocs(query(
        collection(db, 'events'), 
        where('title', '==', req.body.title),
        where('createdAt', '>=', fiveSecondsAgo)
      ));
      
      if (!duplicateCheck.empty) {
        return res.status(409).json({ error: 'Event dengan judul serupa baru saja dibuat.' });
      }

      const docRef = await addDoc(collection(db, 'events'), { ...req.body, createdAt: now.toISOString() });
      res.json({ id: docRef.id });
    } catch (error) { 
      res.status(500).json({ error: 'Gagal membuat event' }); 
    }
  }

  static async updateEvent(req: Request, res: Response) {
    try {
      await updateDoc(doc(db, 'events', req.params.id), { ...req.body, updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error) { 
      res.status(500).json({ error: 'Gagal memperbarui event' }); 
    }
  }

  static async deleteEvent(req: Request, res: Response) {
    try {
      await deleteDoc(doc(db, 'events', req.params.id));
      res.json({ success: true });
    } catch (error) { 
      res.status(500).json({ error: 'Gagal menghapus event' }); 
    }
  }
}
