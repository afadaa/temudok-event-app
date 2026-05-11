import type { Request, Response } from 'express';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, addDoc, deleteDoc, serverTimestamp, db } from '../database/compat.ts';

export class PublicController {
  static async getBranches(req: Request, res: Response) {
    try {
      const snapshot = await getDocs(query(collection(db, 'branches'), orderBy('name', 'asc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch(e) { res.status(500).json([]); }
  }

  static async getCategories(req: Request, res: Response) {
    try {
      const snapshot = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch(e) { res.status(500).json([]); }
  }

  static async updatePhoto(req: Request, res: Response) {
    try {
      const { orderId, photoUrl } = req.body;
      if (!orderId || !photoUrl) {
        return res.status(400).json({ error: 'Order ID dan Foto wajib diisi' });
      }

      const docRef = doc(db, 'registrations', orderId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
      }

      await updateDoc(docRef, {
        photoUrl,
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Gagal mengunggah foto' });
    }
  }

  static async createBranch(req: Request, res: Response) {
    try {
      const docRef = await addDoc(collection(db, 'branches'), { ...req.body, createdAt: serverTimestamp() });
      res.json({ id: docRef.id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  }

  static async updateBranch(req: Request, res: Response) {
    try {
      await updateDoc(doc(db, 'branches', req.params.id), { name: req.body.name });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  }

  static async deleteBranch(req: Request, res: Response) {
    try {
      await deleteDoc(doc(db, 'branches', req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  }

  static async createCategory(req: Request, res: Response) {
    try {
      const { name, price } = req.body;
      const docRef = await addDoc(collection(db, 'categories'), { name, price: Number(price), createdAt: serverTimestamp() });
      res.json({ id: docRef.id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  }

  static async updateCategory(req: Request, res: Response) {
    try {
      const { name, price } = req.body;
      await updateDoc(doc(db, 'categories', req.params.id), { name, price: Number(price) });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  }

  static async deleteCategory(req: Request, res: Response) {
    try {
      await deleteDoc(doc(db, 'categories', req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  }
}
