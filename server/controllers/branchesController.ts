import { Request, Response } from 'express';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from '../firestoreCompat';
import { z } from 'zod';

const BranchSchema = z.object({ name: z.string().min(1) });

export async function listBranches(req: Request, res: Response) {
  try {
    const snap = await getDocs(query(collection('branches'), orderBy('name', 'asc')));
    return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('listBranches', err);
    return res.status(500).json([]);
  }
}

export async function createBranch(req: Request, res: Response) {
  try {
    const { name } = BranchSchema.parse(req.body);
    const ref = await addDoc(collection('branches'), { name, createdAt: new Date().toISOString() });
    return res.status(201).json({ id: ref.id });
  } catch (err: any) {
    console.error('createBranch', err);
    return res.status(400).json({ error: err?.message || 'Bad Request' });
  }
}

export async function updateBranch(req: Request, res: Response) {
  try {
    const { name } = BranchSchema.parse(req.body);
    await updateDoc(doc('branches', req.params.id), { name });
    return res.json({ success: true });
  } catch (err) {
    console.error('updateBranch', err);
    return res.status(500).json({ error: 'Failed' });
  }
}

export async function deleteBranch(req: Request, res: Response) {
  try {
    await deleteDoc(doc('branches', req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteBranch', err);
    return res.status(500).json({ error: 'Failed' });
  }
}
