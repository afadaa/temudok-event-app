import type { Request, Response } from 'express';
import { collection, getDocs, query, orderBy, doc, getDoc, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp, where, db } from '../database/compat.ts';

function isPanitiaCategory(categoryNameOrId: string) {
  return String(categoryNameOrId || '').trim().toUpperCase().startsWith('PANITIA');
}

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

  static async getPanitiaStatus(req: Request, res: Response) {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const email = String(req.query.email || '').trim().toLowerCase();
      const eventId = String(req.query.eventId || '').trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Format email tidak valid' });
      if (!eventId) return res.status(400).json({ message: 'Event ID wajib diisi' });

      const existing = await getDocs(query(
        collection(db, 'registrations'),
        where('email', '==', email),
        where('eventId', '==', eventId)
      ));

      if (existing.empty) return res.json({ exists: false });

      const panitiaDoc = existing.docs.find((entry: any) => {
        const data = entry.data();
        return isPanitiaCategory(data.category) || isPanitiaCategory(data.categoryId);
      });

      if (!panitiaDoc) {
        return res.status(409).json({
          exists: true,
          isPanitia: false,
          message: 'Email ini sudah terdaftar sebagai peserta kategori lain.',
        });
      }

      const data = panitiaDoc.data();
      res.json({
        exists: true,
        isPanitia: true,
        orderId: panitiaDoc.id,
        fullName: data.fullName || '',
        email: data.email || email,
        status: data.status || 'pending',
        category: data.category || 'Panitia',
        categoryId: data.categoryId || 'Panitia',
        photoUploaded: Boolean(data.photoUrl),
        photoUrl: data.photoUrl || '',
      });
    } catch (error: any) {
      console.error('Panitia Status Error:', error);
      res.status(500).json({ message: 'Gagal mengecek data panitia', detail: error?.message });
    }
  }

  static async registerPanitia(req: Request, res: Response) {
    try {
      const fullName = String(req.body.fullName || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const eventId = String(req.body.eventId || '').trim();

      if (fullName.length < 3) return res.status(400).json({ message: 'Nama lengkap minimal 3 karakter' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Format email tidak valid' });
      if (!eventId) return res.status(400).json({ message: 'Event ID wajib diisi' });

      const eventSnap = await getDoc(doc(db, 'events', eventId));
      if (!eventSnap.exists()) return res.status(400).json({ message: 'Event tidak ditemukan atau sudah berakhir.' });

      const event = eventSnap.data();
      const panitiaCategory = event.categories?.find((category: any) =>
        isPanitiaCategory(category.name) || isPanitiaCategory(category.id)
      );
      const categoryId = panitiaCategory?.id || 'Panitia';
      const categoryName = panitiaCategory?.name || 'Panitia';

      const existing = await getDocs(query(
        collection(db, 'registrations'),
        where('email', '==', email),
        where('eventId', '==', eventId)
      ));

      const now = new Date().toISOString();
      if (!existing.empty) {
        const existingDoc = existing.docs.find((entry: any) => {
          const data = entry.data();
          return isPanitiaCategory(data.category) || isPanitiaCategory(data.categoryId);
        });
        if (!existingDoc) return res.status(409).json({ message: 'Email ini sudah terdaftar sebagai peserta kategori lain.' });

        await updateDoc(existingDoc.ref, {
          fullName,
          category: categoryName,
          categoryId,
          amount: 0,
          updatedAt: now,
        });
        return res.json({ success: true, orderId: existingDoc.id, alreadyRegistered: true });
      }

      const orderId = `${eventId}-panitia-${Date.now()}`;
      await setDoc(doc(db, 'registrations', orderId), {
        orderId,
        eventId,
        eventTitle: event.title || '',
        fullName,
        email,
        phone: '-',
        npa: '',
        category: categoryName,
        categoryId,
        branchId: '',
        status: 'pending',
        amount: 0,
        paymentVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      res.json({ success: true, orderId });
    } catch (error: any) {
      console.error('Panitia Register Error:', error);
      res.status(500).json({ message: 'Gagal mendaftar sebagai panitia', detail: error?.message });
    }
  }

  static async uploadPanitiaPhoto(req: Request, res: Response) {
    try {
      const orderId = String(req.body.orderId || '').trim();
      const photoUrl = String(req.body.photoUrl || '').trim();

      if (!orderId || !photoUrl) return res.status(400).json({ message: 'Order ID dan foto wajib diisi' });
      if (!photoUrl.startsWith('data:image/')) return res.status(400).json({ message: 'Foto peserta harus berupa gambar JPG atau PNG' });

      const docRef = doc(db, 'registrations', orderId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return res.status(404).json({ message: 'Data panitia tidak ditemukan' });

      const data = docSnap.data();
      if (!isPanitiaCategory(data.category) && !isPanitiaCategory(data.categoryId)) {
        return res.status(400).json({ message: 'Data ini bukan pendaftaran Panitia' });
      }

      const status = String(data.status || '').toLowerCase();
      if (!['settlement', 'capture'].includes(status)) {
        return res.status(403).json({ message: 'Foto baru dapat diunggah setelah data Panitia divalidasi admin' });
      }

      await updateDoc(docRef, {
        photoUrl,
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Panitia Photo Upload Error:', error);
      res.status(500).json({ message: 'Gagal mengunggah foto panitia', detail: error?.message });
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
