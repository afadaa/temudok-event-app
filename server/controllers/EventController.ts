import type { Request, Response } from 'express';
import { collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, db } from '../database/compat.ts';

export class EventController {
  static async getPublicEvents(req: Request, res: Response) {
    try {
      const q = query(collection(db, 'events'), where('isActive', '==', true), orderBy('startDate', 'asc'));
      const snapshot = await getDocs(q);
      const masterSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
      const masterCategories = masterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const masterMap = new Map(masterCategories.map((category: any) => [category.id, category]));
      res.json(snapshot.docs.map(doc => {
        const data: any = doc.data();
        const eventCategories = Array.isArray(data.categories) ? data.categories : [];
        const filteredCategories = masterMap.size > 0
          ? eventCategories
              .filter((eventCategory: any) => masterMap.has(eventCategory.id))
              .map((eventCategory: any) => {
                const masterCategory: any = masterMap.get(eventCategory.id);
                return {
                  ...eventCategory,
                  name: masterCategory?.name || eventCategory.name,
                  price: Number(eventCategory.price || 0) > 0 ? Number(eventCategory.price) : Number(masterCategory?.price || 0),
                };
              })
          : eventCategories;
        return { id: doc.id, ...data, categories: filteredCategories };
      }));
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
      const eventPayload = {
        ...req.body,
        categories: Array.isArray(req.body.categories)
          ? req.body.categories.map((category: any) => ({
              ...category,
              price: Number(String(category.price || 0).replace(/[^\d]/g, '')) || 0,
            }))
          : [],
      };
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

      const docRef = await addDoc(collection(db, 'events'), { ...eventPayload, createdAt: now.toISOString() });
      res.json({ id: docRef.id });
    } catch (error) { 
      res.status(500).json({ error: 'Gagal membuat event' }); 
    }
  }

  static async updateEvent(req: Request, res: Response) {
    try {
      const eventPayload = {
        ...req.body,
        categories: Array.isArray(req.body.categories)
          ? req.body.categories.map((category: any) => ({
              ...category,
              price: Number(String(category.price || 0).replace(/[^\d]/g, '')) || 0,
            }))
          : [],
      };
      await updateDoc(doc(db, 'events', req.params.id), { ...eventPayload, updatedAt: new Date().toISOString() });
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
