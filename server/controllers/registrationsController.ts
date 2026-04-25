import { Request, Response } from 'express';
import { collection, doc, getDoc, getDocs, updateDoc, query, where, orderBy } from '../firestoreCompat';
import { getSnap } from '../midtrans';
import { config } from '../config';

export async function adminListRegistrations(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const cursor = req.query.cursor as string | undefined;
    const fields = (req.query.fields as string | undefined)?.split(',').map(f=>f.trim()).filter(Boolean);

    const snapshot = await getDocs(query(collection('registrations'), orderBy('createdAt', 'desc')));
    let docs = snapshot.docs;
    if (cursor) {
      const idx = docs.findIndex((d: any) => d.id === cursor);
      if (idx >= 0) docs = docs.slice(idx + 1);
    }
    const sliced = docs.slice(0, limit);
    const out = sliced.map((d: any) => {
      const data = d.data();
      const item: any = { id: d.id };
      if (fields && fields.length) {
        for (const f of fields) if (data[f] !== undefined) item[f] = data[f];
      } else Object.assign(item, data);
      return item;
    });
    const nextCursor = sliced.length ? sliced[sliced.length -1].id : null;
    res.json({ data: out, nextCursor });
  } catch (error) {
    console.error('Admin Fetch Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function paymentStatus(req: Request, res: Response) {
  try {
    const orderId = req.params.orderId;
    const docRef = doc('registrations', orderId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });

    const regData = docSnap.data();

  if (regData.amount === 0 || !config.MIDTRANS_SERVER_KEY || config.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
      return res.json({ transaction_status: regData.status, gross_amount: regData.amount, transaction_time: regData.createdAt, payment_type: 'free/dummy', order_id: orderId, custom_field1: regData.fullName, custom_field2: regData.category, photoUrl: regData.photoUrl || '' });
    }

    try {
      const snap = getSnap();
      if (!snap) throw new Error('Midtrans not configured');
      const statusResponse = await snap.transaction.status(orderId);
      await updateDoc(docRef, { status: statusResponse.transaction_status, updatedAt: new Date().toISOString() });
      return res.json({ ...statusResponse, gross_amount: regData.amount, transaction_time: regData.createdAt, photoUrl: regData.photoUrl || '' });
    } catch (midtransError: any) {
      console.warn('Midtrans status fetch warn (returning local DB status):', midtransError.message);
      return res.json({ transaction_status: regData.status, gross_amount: regData.amount, transaction_time: regData.createdAt, order_id: orderId, custom_field1: regData.fullName, custom_field2: regData.category, photoUrl: regData.photoUrl || '' });
    }
  } catch (error) {
    console.error('Fetch Status Error:', error);
    res.status(500).json({ error: 'Gagal mengambil status' });
  }
}

export async function updatePhoto(req: Request, res: Response) {
  try {
    const { orderId, photoUrl } = req.body;
    if (!orderId || !photoUrl) return res.status(400).json({ error: 'Order ID dan Foto wajib diisi' });
    const docRef = doc('registrations', orderId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
    await updateDoc(docRef, { photoUrl, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error) {
    console.error('Update Photo Error:', error);
    res.status(500).json({ error: 'Gagal mengunggah foto' });
  }
}

export async function checkIn(req: Request, res: Response) {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required' });
    const docRef = doc('registrations', orderId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
    const data = docSnap.data();
    if (data.status !== 'settlement' && data.status !== 'capture') return res.status(400).json({ error: 'Pembayaran belum lunas/berhasil' });
    await updateDoc(docRef, { checkedIn: true, checkedInAt: new Date().toISOString() });
    res.json({ success: true, participant: data });
  } catch (error) {
    console.error('Check-in Error:', error);
    res.status(500).json({ error: 'Gagal melakukan check-in' });
  }
}

export async function guestbook(req: Request, res: Response) {
  try {
    const q = query(collection('registrations'), where('checkedIn', '==', true), orderBy('checkedInAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const guests = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(guests);
  } catch (error) {
    console.error('Guestbook Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data buku tamu' });
  }
}
