import type { Request, Response } from 'express';
import { collection, getDocs, query, orderBy, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase.ts';

export class AdminController {
  static async getRegistrations(req: Request, res: Response) {
    try {
      const snapshot = await getDocs(query(collection(db, 'registrations'), orderBy('createdAt', 'desc')));
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(docs);
    } catch (error) {
      console.error('Admin Fetch Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async checkIn(req: Request, res: Response) {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

      const docRef = doc(db, 'registrations', orderId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
      }

      const data = docSnap.data();
      if (data.status !== 'settlement' && data.status !== 'capture') {
        return res.status(400).json({ error: 'Pembayaran belum lunas/berhasil' });
      }

      await updateDoc(docRef, {
        checkedIn: true,
        checkedInAt: new Date().toISOString()
      });

      res.json({ success: true, participant: data });
    } catch (error) {
      console.error('Check-in Error:', error);
      res.status(500).json({ error: 'Gagal melakukan check-in' });
    }
  }

  static async getGuestbook(req: Request, res: Response) {
    try {
      const q = query(
        collection(db, 'registrations'), 
        where('checkedIn', '==', true),
        orderBy('checkedInAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const guests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(guests);
    } catch (error) {
      console.error('Guestbook Error:', error);
      res.status(500).json({ error: 'Gagal mengambil data buku tamu' });
    }
  }
}
