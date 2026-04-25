import { Request, Response } from 'express';
import { RegistrationSchema } from '../validators';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc } from '../firestoreCompat';
import { getSnap } from '../midtrans';
import { qrBufferFromObject } from '../utils';
import { config as envConfig } from '../config';

export async function paymentStatus(req: Request, res: Response) {
  try {
    const orderId = req.params.orderId;
    const docRef = doc('registrations', orderId);
    const docSnap: any = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
    }

    const regData = docSnap.data();

    if (regData.amount === 0 || !envConfig.MIDTRANS_SERVER_KEY || envConfig.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
      return res.json({
        transaction_status: regData.status,
        gross_amount: regData.amount,
        transaction_time: regData.createdAt,
        payment_type: 'free/dummy',
        order_id: orderId,
        custom_field1: regData.fullName,
        custom_field2: regData.category,
        photoUrl: regData.photoUrl || ''
      });
    }

    try {
      const snap = getSnap();
      if (!snap) throw new Error('Midtrans not configured');
      const statusResponse = await snap.transaction.status(orderId);
      await updateDoc(docRef, {
        status: statusResponse.transaction_status,
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        ...statusResponse,
        gross_amount: regData.amount,
        transaction_time: regData.createdAt,
        photoUrl: regData.photoUrl || ''
      });
    } catch (midtransError: any) {
      console.warn('Midtrans status fetch warn (returning local DB status):', midtransError.message);
      return res.json({
        transaction_status: regData.status,
        gross_amount: regData.amount,
        transaction_time: regData.createdAt,
        order_id: orderId,
        custom_field1: regData.fullName,
        custom_field2: regData.category,
        photoUrl: regData.photoUrl || ''
      });
    }
  } catch (error) {
    console.error('Fetch Status Error:', error);
    res.status(500).json({ error: 'Gagal mengambil status' });
  }
}

export async function createTransaction(req: Request, res: Response) {
  try {
    const validatedData = RegistrationSchema.parse(req.body);

    // Check if email already registered for THIS event
    let existingRef;
    try {
      const q = (await getDocs(collection('registrations'))); // keep compatibility; main check upstream
      existingRef = q;
    } catch (dbError: any) {
      console.error('Database Error during registration check:', dbError);
      if (dbError.message?.includes('PERMISSION_DENIED')) {
        return res.status(500).json({ message: 'Terjadi kendala pada koneksi database (Permission Denied). Silakan lapor ke panitia.' });
      }
      throw dbError;
    }

    // (For brevity, keep rest of logic in main server for now)
    res.status(501).json({ error: 'Not implemented in controller yet' });
  } catch (error) {
    console.error('Payment Error:', error);
    res.status(400).json({ error: 'Failed to create transaction' });
  }
}
