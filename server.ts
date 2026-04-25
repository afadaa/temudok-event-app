import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import midtransClient from 'midtrans-client';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { z } from 'zod';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, updateDoc, getDocs, query, where, orderBy, getDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Client Setup
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Test connection and Seed Admin
(async () => {
  try {
    console.log(`Testing Firestore connection (Project: ${firebaseConfig.projectId}, DB: ${firebaseConfig.firestoreDatabaseId || '(default)'})...`);
    await getDocs(query(collection(db, 'registrations'), where('__name__', '==', 'test')));
    console.log('Firestore connection verified');
    
    // Seed Admin User
    const adminUsername = 'adminidikaltim2026';
    const plainPassword = '1d1k4lt!m2026';
    const adminRef = doc(db, 'admins', adminUsername);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      await setDoc(adminRef, {
        username: adminUsername,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      });
      console.log('Admin user seeded in Firestore.');
    }
  } catch (err: any) {
    console.error('Firestore init error:', err.message);
  }
})();

const PORT = 3000;

// Midtrans Lazy Initialization
let snapInstance: any = null;
function getSnap() {
  if (!snapInstance) {
    if (!process.env.MIDTRANS_SERVER_KEY) {
      throw new Error('MIDTRANS_SERVER_KEY is missing');
    }
    snapInstance = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    });
  }
  return snapInstance;
}

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

const RegistrationSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(10),
  npa: z.string().optional(), // Nomor Pokok Anggota IDI
  category: z.enum(['guest', 'delegate']),
});

async function startServer() {
  const app = express();
  app.use(express.json());

  // API: Create Transaction
  app.post('/api/pay', async (req, res) => {
    try {
      const validatedData = RegistrationSchema.parse(req.body);

      // Check if email already registered
      let existingRef;
      try {
        const q = query(collection(db, 'registrations'), where('email', '==', validatedData.email), where('status', 'in', ['settlement', 'capture']));
        existingRef = await getDocs(q);
      } catch (dbError: any) {
        console.error('Database Error during registration check:', dbError);
        // If it's a permission error, it might be the database setup
        if (dbError.message?.includes('PERMISSION_DENIED')) {
          return res.status(500).json({ 
            message: 'Terjadi kendala pada koneksi database (Permission Denied). Silakan lapor ke panitia.' 
          });
        }
        throw dbError;
      }

      if (!existingRef.empty) {
        return res.status(400).json({ 
          message: 'Email ini sudah terdaftar. Silakan cek email Anda untuk e-tiket atau hubungi panitia jika ada kendala.' 
        });
      }

      const orderId = `MUSWIL-IDI-${Date.now()}`;
      
      const price = validatedData.category === 'guest' ? 5000 : 0;

      // price === 0 condition
      if (price === 0) {
        console.log('Free registration for Utusan:', validatedData.email);
        
        const regData = {
          orderId,
          fullName: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone,
          npa: validatedData.npa || '',
          category: validatedData.category,
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
          custom_field2: validatedData.category,
        });
        return res.json({ isFree: true, orderId });
      }

      // Initial save for paid registration (pending)
      const pendingReg = {
        orderId,
        fullName: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone,
        npa: validatedData.npa || '',
        category: validatedData.category,
        status: 'pending',
        amount: price,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'registrations', orderId), pendingReg);

      // Dummy Mode Check
      if (!process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
        console.log('Dummy Payment Triggered for:', validatedData.email);
        return res.json({ token: 'DUMMY_TOKEN', orderId, isDummy: true });
      }

      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: price,
        },
        customer_details: {
          first_name: validatedData.fullName,
          email: validatedData.email,
          phone: validatedData.phone,
        },
        item_details: [
          {
            id: 'TICKET-MUSWIL',
            price: price,
            quantity: 1,
            name: `Tiket Muswil IDI Kaltim - ${validatedData.category === 'guest' ? 'Tamu/Undangan' : 'Utusan'}`,
          },
        ],
        custom_field1: validatedData.fullName,
        custom_field2: validatedData.category,
      };

      const snap = getSnap();
      const transaction = await snap.createTransaction(parameter);
      res.json({ token: transaction.token, orderId });
    } catch (error) {
      console.error('Payment Error:', error);
      res.status(400).json({ error: 'Failed to create transaction' });
    }
  });

  // API: Admin Registrations
  app.get('/api/admin/registrations', async (req, res) => {
    const username = req.headers['x-admin-username'] as string;
    const password = req.headers['x-admin-password'] as string;

    if (!username || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const adminRef = doc(db, 'admins', username);
      const adminSnap = await getDoc(adminRef);

      if (!adminSnap.exists()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const adminData = adminSnap.data() as any;
      const isValid = await bcrypt.compare(password, adminData.password);

      if (!isValid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

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
  });

  // API: Get Payment Status
  app.get('/api/payment-status/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const docRef = doc(db, 'registrations', orderId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
      }

      const regData = docSnap.data();

      // If it is a free registration or Dummy Mode, we just return the local status
      if (regData.amount === 0 || !process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
        return res.json({ 
          transaction_status: regData.status,
          gross_amount: regData.amount,
          transaction_time: regData.createdAt,
          payment_type: 'free/dummy',
          order_id: orderId,
          custom_field1: regData.fullName,
          custom_field2: regData.category
        });
      }

      // Try Midtrans for paid registrations
      try {
        const snap = getSnap();
        const statusResponse = await snap.transaction.status(orderId);
        
        // Update Firestore with latest status
        await updateDoc(docRef, {
          status: statusResponse.transaction_status,
          updatedAt: new Date().toISOString(),
        });

        // Mix in DB values to ensure Total Bayar and Waktu Transaksi match the user requirement
        return res.json({
          ...statusResponse,
          gross_amount: regData.amount,
          transaction_time: regData.createdAt,
        });
      } catch (midtransError: any) {
        console.warn('Midtrans status fetch warn (returning local DB status):', midtransError.message);
        return res.json({ 
          transaction_status: regData.status,
          gross_amount: regData.amount,
          transaction_time: regData.createdAt,
          order_id: orderId,
          custom_field1: regData.fullName,
          custom_field2: regData.category
        });
      }
    } catch (error) {
      console.error('Fetch Status Error:', error);
      res.status(500).json({ error: 'Gagal mengambil status' });
    }
  });

  // API: Midtrans Webhook
  app.post('/api/webhook', async (req, res) => {
    try {
      const snap = getSnap();
      const statusResponse = await snap.transaction.notification(req.body);
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      console.log(`Transaction notification received. Order ID: ${orderId}. Status: ${transactionStatus}. Fraud: ${fraudStatus}`);

      // Update Firestore status
      await updateDoc(doc(db, 'registrations', orderId), {
        status: transactionStatus,
        updatedAt: new Date().toISOString(),
      });

      if (transactionStatus === 'capture') {
        if (fraudStatus === 'challenge') {
          // TODO: handle fraud challenge
        } else if (fraudStatus === 'accept') {
          await sendTicketEmail(statusResponse);
        }
      } else if (transactionStatus === 'settlement') {
        await sendTicketEmail(statusResponse);
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny' || transactionStatus === 'expire') {
        // TODO: handle failure
      } else if (transactionStatus === 'pending') {
        // TODO: handle pending
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook Error:', error);
      res.status(500).send('Error');
    }
  });

  async function sendTicketEmail(data: any) {
    const { order_id } = data;
    const email = data.customer_details?.email;
    const name = data.custom_field1 || data.customer_details?.first_name || 'Peserta';
    const category = data.custom_field2 || 'Peserta';
    const npa = data.custom_field3 || '-';

    if (!email) {
      console.error('No email found for order', order_id);
      return;
    }

    // Generate QR Code with more detailed data
    const qrData = JSON.stringify({
      id: order_id,
      name: name,
      cat: category,
      event: 'MUSWIL IDI KALTIM 2026'
    });
    
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@idikaltim.org';
    const fromName = process.env.MAIL_FROM_NAME || 'Muswil IDI Kaltim';

    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: email,
      subject: 'E-Tiket Muswil IDI Kaltim 2026',
      attachments: [{
        filename: 'qrcode.png',
        path: qrCodeDataUrl,
        cid: 'qrcode-ticket'
      }],
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #0d9488; text-align: center;">E-TIKET RESMI</h2>
          <div style="background-color: #f0fdfa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0d9488;">
            <p style="margin: 0; color: #134e4a; font-weight: bold;">Status: Pembayaran Berhasil</p>
          </div>
          <p>Halo <strong>${name}</strong>,</p>
          <p>Terima kasih telah mendaftar di Musyawarah Wilayah IDI Kalimantan Timur 2026. Data pendaftaran Anda telah kami terima.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 10px; margin: 25px 0; border: 1px dashed #cbd5e1;">
            <div style="text-align: center;">
              <p style="margin-bottom: 10px; font-size: 14px; color: #64748b; font-weight: bold; uppercase;">Scan QR Code saat Registrasi</p>
              <img src="cid:qrcode-ticket" alt="QR Code Tiket" style="width: 180px; height: 180px; border: 4px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
              <p style="font-family: monospace; margin-top: 15px; color: #0f172a; font-size: 16px; font-weight: bold;">${order_id}</p>
            </div>
            
            <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; pt: 15px;">
              <table style="width: 100%; font-size: 13px; color: #475569;">
                <tr>
                  <td style="padding: 5px 0;">Kategori:</td>
                  <td style="text-align: right; font-weight: bold; color: #0f172a;">${category === 'guest' ? 'Tamu / Undangan' : 'Utusan'}</td>
                </tr>
              </table>
            </div>
          </div>

          <p style="font-size: 14px; line-height: 1.6;">Silakan simpan e-tiket ini dan tunjukkan kepada panitia di lokasi acara untuk proses check-in.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              <strong>Muswil IDI Kalimantan Timur 2026</strong><br/>
              Pesan otomatis, mohon tidak membalas.
            </p>
          </div>
        </div>
      `,
    };

    try {
      if (!process.env.MAIL_USERNAME || process.env.MAIL_USERNAME === 'MY_EMAIL_USER') {
        console.log('Mode Demo/Placeholder: Email tidak benar-benar dikirim. Detail:', mailOptions.to, mailOptions.subject);
        return;
      }
      await transporter.sendMail(mailOptions);
      console.log('Ticket email sent successfully to', email);
    } catch (err) {
      console.error('Failed to send email:', err);
    }
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
