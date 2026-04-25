import { Request, Response } from 'express';
import { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy } from '../firestoreCompat';
import { z } from 'zod';

const EventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
  categories: z.array(z.any()).optional()
});

export async function listEvents(req: Request, res: Response) {
  try {
    const q = query(collection('events'), where('isActive', '==', true), orderBy('startDate', 'asc'));
    const snap = await getDocs(q);
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('listEvents', err);
    return res.status(500).json([]);
  }
}

export async function getEvent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const snap = await getDoc(doc('events', id));
    if (!snap.exists()) return res.status(404).json({ error: 'Not found' });
    return res.json({ id: snap.id, ...snap.data() });
  } catch (err) {
    console.error('getEvent', err);
    return res.status(500).json({ error: 'Internal' });
  }
}

export async function createEvent(req: Request, res: Response) {
  try {
    const data = EventSchema.parse(req.body);
    const ref = await addDoc(collection('events'), { ...data, createdAt: new Date().toISOString() });
    return res.status(201).json({ id: ref.id });
  } catch (err: any) {
    console.error('createEvent', err);
    return res.status(400).json({ error: err?.message || 'Bad Request' });
  }
}

export async function updateEvent(req: Request, res: Response) {
  try {
    const id = req.params.id;
    await updateDoc(doc('events', id), { ...req.body, updatedAt: new Date().toISOString() });
    return res.json({ success: true });
  } catch (err) {
    console.error('updateEvent', err);
    return res.status(500).json({ error: 'Failed' });
  }
}

export async function deleteEvent(req: Request, res: Response) {
  try {
    await deleteDoc(doc('events', req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteEvent', err);
    return res.status(500).json({ error: 'Failed' });
  }
}
