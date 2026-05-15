import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { collection, getDocs, query, orderBy, where, doc, getDoc, updateDoc, db, adminDb } from '../database/compat.ts';
import { sendTicketEmail, sendBroadcastEmail, sendPanitiaApprovalEmail } from '../services/MailService.ts';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isPanitiaCategory = (categoryNameOrId: string) => String(categoryNameOrId || '').trim().toUpperCase().startsWith('PANITIA');

export class AdminController {
  static async getRegistrations(req: Request, res: Response) {
    try {
      const snapshot = await getDocs(query(collection(db, 'registrations'), orderBy('createdAt', 'desc')));
      const docs = snapshot.docs.map((doc: any) => ({
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

      const alreadyCheckedIn = data.checkedIn === true || data.checkedIn === 1 || String(data.checkedIn || '').toLowerCase() === 'true';
      if (alreadyCheckedIn) {
        return res.status(409).json({
          error: 'Peserta sudah pernah check-in',
          checkedInAt: data.checkedInAt || null,
          participant: data
        });
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

  static async markAsPaid(req: Request, res: Response) {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

      // Use adminDb when available for privileged update
      if (adminDb) {
        const ref = adminDb.collection('registrations').doc(orderId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Registration not found' });
        await ref.update({ status: 'settlement', paymentVerified: true, updatedAt: new Date().toISOString() });
        // attempt to send ticket email (non-blocking for response)
        try {
          const data = snap.data();
          const payload = {
            order_id: orderId,
            customer_details: {
              first_name: data.fullName,
              email: data.email,
              phone: data.phone
            },
            custom_field1: data.fullName,
            custom_field2: data.category,
            custom_field3: data.eventTitle
          };
          if (isPanitiaCategory(data.category) || isPanitiaCategory(data.categoryId)) {
            await sendPanitiaApprovalEmail(payload);
          } else {
            await sendTicketEmail(payload);
          }
        } catch (emailErr) {
          console.error('Failed to send ticket email after admin mark-paid (adminDb):', emailErr);
        }

        // broadcast to event participants or related list (non-blocking)
        try {
          const data = snap.data();
          if (isPanitiaCategory(data.category) || isPanitiaCategory(data.categoryId)) {
            return res.json({ success: true });
          }
          // Example: send a short broadcast only to the single recipient to confirm
          // You can expand this to query more recipients for the event if needed
          const subject = `Konfirmasi Pembayaran - ${data.eventTitle || ''}`;
          const html = `<p>Halo ${data.fullName},</p><p>Pembayaran untuk order <strong>${orderId}</strong> telah dikonfirmasi oleh admin. E-Tiket telah dikirim ke email Anda.</p>`;
          sendBroadcastEmail({ emails: [data.email], subject, html }).catch(err => console.error('Broadcast error:', err));
        } catch (bErr) {
          console.error('Failed to trigger broadcast after admin mark-paid (adminDb):', bErr);
        }

        return res.json({ success: true });
      }

      const docRef = doc(db, 'registrations', orderId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return res.status(404).json({ error: 'Registration not found' });
      await updateDoc(docRef, { status: 'settlement', paymentVerified: true, updatedAt: new Date().toISOString() });

      // attempt to send ticket email
      try {
        const data = docSnap.data();
        const payload = {
          order_id: orderId,
          customer_details: {
            first_name: data.fullName,
            email: data.email,
            phone: data.phone
          },
          custom_field1: data.fullName,
          custom_field2: data.category,
          custom_field3: data.eventTitle
        };
        if (isPanitiaCategory(data.category) || isPanitiaCategory(data.categoryId)) {
          await sendPanitiaApprovalEmail(payload);
        } else {
          await sendTicketEmail(payload);
        }
      } catch (emailErr) {
        console.error('Failed to send ticket email after admin mark-paid:', emailErr);
      }

      // send a small broadcast/confirmation to the registrant (non-blocking)
      try {
        const data = docSnap.data();
        if (isPanitiaCategory(data.category) || isPanitiaCategory(data.categoryId)) {
          return res.json({ success: true });
        }
        const subject = `Konfirmasi Pembayaran - ${data.eventTitle || ''}`;
        const html = `<p>Halo ${data.fullName},</p><p>Pembayaran untuk order <strong>${orderId}</strong> telah dikonfirmasi oleh admin. E-Tiket telah dikirim ke email Anda.</p>`;
        sendBroadcastEmail({ emails: [data.email], subject, html }).catch(err => console.error('Broadcast error:', err));
      } catch (bErr) {
        console.error('Failed to trigger broadcast after admin mark-paid:', bErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('markAsPaid Error:', error);
      // return a bit more info for debugging (non-sensitive)
      res.status(500).json({ error: (error && (error as any).message) ? (error as any).message : 'Failed to update registration status' });
    }
  }

  static async cancelRegistration(req: Request, res: Response) {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

      const payload = {
        status: 'cancel',
        paymentVerified: false,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (adminDb) {
        const ref = adminDb.collection('registrations').doc(orderId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Registration not found' });
        await ref.update(payload);
      } else {
        const docRef = doc(db, 'registrations', orderId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return res.status(404).json({ error: 'Registration not found' });
        await updateDoc(docRef, payload);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('cancelRegistration Error:', error);
      res.status(500).json({ error: 'Gagal membatalkan pendaftaran' });
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

  static async updateRegistrationEmail(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const email = String(req.body.email || '').trim().toLowerCase();

      if (!orderId) return res.status(400).json({ error: 'Order ID is required' });
      if (!emailPattern.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });

      const payload = {
        email,
        updatedAt: new Date().toISOString(),
        emailUpdatedAt: new Date().toISOString()
      };

      if (adminDb) {
        const ref = adminDb.collection('registrations').doc(orderId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Registration not found' });
        await ref.update(payload);
      } else {
        const docRef = doc(db, 'registrations', orderId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return res.status(404).json({ error: 'Registration not found' });
        await updateDoc(docRef, payload);
      }

      res.json({ success: true, email });
    } catch (error) {
      console.error('updateRegistrationEmail Error:', error);
      res.status(500).json({ error: 'Gagal memperbarui email peserta' });
    }
  }

  static async uploadParticipantPhoto(req: Request, res: Response) {
    const uploadedFile = (req as any).file;
    try {
      const orderId = String(req.params.orderId || req.body.orderId || '').trim();
      if (!orderId) return res.status(400).json({ error: 'Order ID is required' });
      if (!uploadedFile) return res.status(400).json({ error: 'No file uploaded (expected field "photo")' });

      const mimetype = String(uploadedFile.mimetype || '').toLowerCase();
      if (!mimetype.startsWith('image/')) {
        try { fs.unlinkSync(path.join(process.cwd(), 'public', 'uploads', uploadedFile.filename)); } catch {}
        return res.status(400).json({ error: 'Foto peserta harus berupa gambar' });
      }

      const fileUrl = `/uploads/${uploadedFile.filename}`;
      const payload = {
        photoUrl: fileUrl,
        updatedAt: new Date().toISOString(),
      };

      if (adminDb) {
        const ref = adminDb.collection('registrations').doc(orderId);
        const snap = await ref.get();
        if (!snap.exists) {
          try { fs.unlinkSync(path.join(process.cwd(), 'public', 'uploads', uploadedFile.filename)); } catch {}
          return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
        }
        await ref.update(payload);
      } else {
        const docRef = doc(db, 'registrations', orderId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          try { fs.unlinkSync(path.join(process.cwd(), 'public', 'uploads', uploadedFile.filename)); } catch {}
          return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
        }
        await updateDoc(docRef, payload);
      }

      res.json({ success: true, photoUrl: fileUrl });
    } catch (error) {
      if (uploadedFile) {
        try { fs.unlinkSync(path.join(process.cwd(), 'public', 'uploads', uploadedFile.filename)); } catch {}
      }
      console.error('Admin Participant Photo Upload Error:', error);
      res.status(500).json({
        error: 'Gagal mengunggah foto peserta',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async resendEmail(req: Request, res: Response) {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

      let data;
      if (adminDb) {
        const ref = adminDb.collection('registrations').doc(orderId);
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Registration not found' });
        data = snap.data();
      } else {
        const docRef = doc(db, 'registrations', orderId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return res.status(404).json({ error: 'Registration not found' });
        data = docSnap.data();
      }

      if (data.status !== 'settlement' && data.status !== 'capture') {
        return res.status(400).json({ error: 'Pembayaran peserta belum lunas' });
      }

      await sendTicketEmail({
        order_id: orderId,
        customer_details: {
          first_name: data.fullName,
          email: data.email,
          phone: data.phone
        },
        custom_field1: data.fullName,
        custom_field2: data.category,
        custom_field3: data.eventTitle
      });

      res.json({ success: true, message: 'Email berhasil dikirim ulang' });
    } catch (error) {
      console.error('resendEmail Error:', error);
      res.status(500).json({ error: 'Gagal mengirim ulang email' });
    }
  }
}
