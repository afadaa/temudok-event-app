import type { Request, Response } from 'express';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc, updateDoc, db } from '../database/compat.ts';
import { RegistrationSchema } from '../models/Registration.ts';
import { getSnap } from '../config/midtrans.ts';
import { sendTicketEmail } from '../services/MailService.ts';
import dotenv from 'dotenv';

dotenv.config();

function shouldUseMidtransSnap() {
  return process.env.VITE_USE_MIDTRANS_SNAP === 'true' || process.env.USE_MIDTRANS_SNAP === 'true';
}

function isPanitiaCategory(categoryNameOrId: string) {
  return String(categoryNameOrId || '').trim().toUpperCase().startsWith('PANITIA');
}

export class PaymentController {
  static async createTransaction(req: Request, res: Response) {
    try {
      const parseResult = RegistrationSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: 'Data pendaftaran tidak valid', 
          details: parseResult.error.format() 
        });
      }
      const validatedData = parseResult.data;

      // Check if email already registered for THIS event
      let existingRef;
      try {
        const q = query(
          collection(db, 'registrations'),
          where('email', '==', validatedData.email),
          where('eventId', '==', validatedData.eventId)
        );
        existingRef = await getDocs(q);
      } catch (dbError: any) {
        return res.status(500).json({ 
          message: 'Gagal terhubung ke database. Silakan coba beberapa saat lagi.' 
        });
      }

      if (!existingRef.empty) {
        const alreadyPaid = existingRef.docs.find(doc => ['settlement', 'capture'].includes(doc.data().status));
        if (alreadyPaid) {
          return res.status(400).json({ 
            message: 'Email ini sudah terdaftar dan pembayaran telah dikonfirmasi. Silakan cek email Anda untuk e-tiket.' 
          });
        }

        for (const existingDoc of existingRef.docs) {
          try {
            await deleteDoc(existingDoc.ref);
          } catch (delError) {
            console.error('Error deleting previous record:', delError);
          }
        }
      }

      const orderId = `${validatedData.eventId}-${Date.now()}`;
      
      const eventSnap = await getDoc(doc(db, 'events', validatedData.eventId));
      if (!eventSnap.exists()) {
        return res.status(400).json({ message: 'Event tidak ditemukan atau sudah berakhir.' });
      }
      
      const event = eventSnap.data();
      const cat = event.categories?.find((c: any) => c.id === validatedData.category);
      if (!cat) {
        return res.status(400).json({ message: 'Kategori tiket tidak valid untuk event ini.' });
      }
      
      const price = cat.price;
      const categoryName = cat.name;
      const eventTitle = event.title;

      if (isPanitiaCategory(categoryName) || isPanitiaCategory(validatedData.category)) {
        const panitiaReg = {
          orderId,
          eventId: validatedData.eventId,
          eventTitle,
          fullName: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone,
          npa: validatedData.npa || '',
          category: categoryName,
          categoryId: validatedData.category,
          branchId: validatedData.branchId || '',
          status: 'pending',
          amount: 0,
          paymentVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'registrations', orderId), panitiaReg);
        return res.json({ orderId, isAdminApproval: true });
      }

      if (price === 0) {
        const regData = {
          orderId,
          eventId: validatedData.eventId,
          eventTitle,
          fullName: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone,
          npa: validatedData.npa || '',
          category: categoryName,
          categoryId: validatedData.category,
          branchId: validatedData.branchId || '',
          status: 'settlement',
          amount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'registrations', orderId), regData);

        await sendTicketEmail({
          order_id: orderId,
          customer_details: {
            first_name: validatedData.fullName,
            email: validatedData.email,
            phone: validatedData.phone
          },
          custom_field1: validatedData.fullName,
          custom_field2: categoryName,
          custom_field3: eventTitle
        });
        return res.json({ isFree: true, orderId });
      }

      const pendingReg = {
        orderId,
        eventId: validatedData.eventId,
        eventTitle,
        fullName: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone,
        npa: validatedData.npa || '',
        category: categoryName,
        categoryId: validatedData.category,
        branchId: validatedData.branchId || '',
        status: 'pending',
        amount: price,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'registrations', orderId), pendingReg);

      if (!shouldUseMidtransSnap()) {
        return res.json({ orderId, isBankTransfer: true });
      }

      if (!process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
        return res.json({ token: 'DUMMY_TOKEN', orderId, isDummy: true });
      }

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: Math.round(price),
        },
        customer_details: {
          first_name: validatedData.fullName.substring(0, 50),
          email: validatedData.email,
          phone: validatedData.phone,
        },
        item_details: [
          {
            id: 'TICKET',
            price: Math.round(price),
            quantity: 1,
            name: `Tiket ${eventTitle} - ${categoryName}`.substring(0, 50),
          },
        ],
        custom_field1: validatedData.fullName.substring(0, 255),
        custom_field2: categoryName.substring(0, 255),
        custom_field3: eventTitle.substring(0, 255)
      };

      const snap = getSnap();
      const transaction = await snap.createTransaction(parameter);
      res.json({ token: transaction.token, orderId });
    } catch (error: any) {
      console.error('Payment Error:', error);
      res.status(400).json({ 
        message: `Gagal memproses pendaftaran: ${error.message || 'Error occurred'}`
      });
    }
  }

  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId;
      let docRef = doc(db, 'registrations', orderId);
      let docSnap = await getDoc(docRef);

      // If no document with the id, try to find a registration where the field orderId matches
      if (!docSnap.exists()) {
        const q = query(collection(db, 'registrations'), where('orderId', '==', orderId));
        const qSnap = await getDocs(q);
        if (qSnap.empty) {
          return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
        }
        // use first matched document
        const found = qSnap.docs[0];
        docRef = doc(db, 'registrations', found.id);
        docSnap = await getDoc(docRef);
      }

      const regData = docSnap.data();

      if (regData.amount === 0 || !process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
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
      res.status(500).json({ error: 'Gagal mengambil status' });
    }
  }

  static async getPaymentStatusByEmail(req: Request, res: Response) {
    try {
      const email = (req.query.email as string || '').trim();
      if (!email) return res.status(400).json({ error: 'Email query parameter is required' });

      const q = query(collection(db, 'registrations'), where('email', '==', email));
      const snap = await getDocs(q);
      const items = snap.docs.map((d: any) => {
        const data: any = d.data();
        return {
          orderId: d.id || data.orderId || null,
          status: data.status,
          amount: data.amount,
          eventTitle: data.eventTitle,
          createdAt: data.createdAt,
        };
      });
      // always return 200 with results (may be empty)
      return res.status(200).json({ results: items });
    } catch (error) {
      console.error('getPaymentStatusByEmail error:', error);
      return res.status(500).json({ error: 'Gagal mengambil data berdasarkan email' });
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    try {
      const snap = getSnap();
      const statusResponse = await snap.transaction.notification(req.body);
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      console.log(`Webhook: ${orderId} - ${transactionStatus}`);

      await updateDoc(doc(db, 'registrations', orderId), {
        status: transactionStatus,
        updatedAt: new Date().toISOString(),
      });

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'accept') {
          await sendTicketEmail(statusResponse);
        }
      } else if (transactionStatus === 'settlement') {
        await sendTicketEmail(statusResponse);
      }

      res.status(200).send('OK');
    } catch (error) {
      res.status(500).send('Error');
    }
  }
}
