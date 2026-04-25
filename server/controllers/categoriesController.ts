import { Request, Response } from 'express';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from '../firestoreCompat';
import { z } from 'zod';

const CategorySchema = z.object({ name: z.string().min(1), price: z.coerce.number().min(0) });

export async function listCategories(req: Request, res: Response) {
  try {
    const snap = await getDocs(query(collection('categories'), orderBy('name', 'asc')));
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('listCategories', err);
    return res.status(500).json([]);
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const { name, price } = CategorySchema.parse(req.body);
    const ref = await addDoc(collection('categories'), { name, price: Number(price), createdAt: new Date().toISOString() });
    return res.status(201).json({ id: ref.id });
  } catch (err: any) {
    console.error('createCategory', err);
    return res.status(400).json({ error: err?.message || 'Bad Request' });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const { name, price } = CategorySchema.parse(req.body);
    await updateDoc(doc('categories', req.params.id), { name, price: Number(price) });
    return res.json({ success: true });
  } catch (err) {
    console.error('updateCategory', err);
    return res.status(500).json({ error: 'Failed' });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    await deleteDoc(doc('categories', req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteCategory', err);
    return res.status(500).json({ error: 'Failed' });
  }
}
