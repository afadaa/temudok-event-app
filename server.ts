import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, updateDoc, getDocs, query, where, orderBy, getDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import midtransClient from 'midtrans-client';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { z } from 'zod';
import admin from 'firebase-admin';

import apiRoutes from './server/routes/index.ts';
import { seedDatabase } from './server/services/SeedService.ts';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Client Setup
let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, relying on environment variables');
}

// Override with .env if present
const config = {
  apiKey: process.env.FIREBASE_API_KEY || firebaseConfig?.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig?.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || firebaseConfig?.appId,
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId,
};

// Initialize Firebase App
const firebaseApp = initializeApp(config);
const db = getFirestore(firebaseApp, config.firestoreDatabaseId);

// Try to initialize firebase-admin for server-side privileged access if credentials are available
let adminDb: admin.firestore.Firestore | null = null;
try {
  if (process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      // Allow passing the service account JSON as an env var (useful in containers)
      const credObj = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      admin.initializeApp({ credential: admin.credential.cert(credObj as any) });
    } else {
      // When GOOGLE_APPLICATION_CREDENTIALS is set to a file path
      admin.initializeApp();
    }
    adminDb = admin.firestore();
    console.log('Firebase Admin initialized for server-side privileged access');
  } else {
    console.log('Firebase Admin not initialized: no service account credentials found. Server will use client SDK and may be subject to Firestore rules.');
  }
} catch (err) {
  console.warn('Failed to initialize firebase-admin:', err);
  adminDb = null;
}

// Test connection and Seed Admin
(async () => {
  try {
    console.log(`Testing Firestore connection (Project: ${config.projectId}, DB: ${config.firestoreDatabaseId || '(default)'})...`);
    await getDocs(query(collection(db, 'registrations'), where('__name__', '==', 'test')));
    console.log('Firestore connection verified');
    
    // Seed Admin User - Only if environment variables are provided
    const adminUsername = process.env.ADMIN_USERNAME;
    const plainPassword = process.env.ADMIN_PASSWORD;

    if (adminUsername && plainPassword) {
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
        console.log(`Admin user '${adminUsername}' seeded in Firestore.`);
      }
    } else {
      console.warn('ADMIN_USERNAME or ADMIN_PASSWORD not found in .env. Skipping admin seeding.');
    }

    // Seed Initial Event if none exists
    const eventsSnapshot = await getDocs(collection(db, 'events'));
    if (eventsSnapshot.empty) {
      const defaultEventId = 'muswil-initial-event';
      const defaultEvent = {
        title: 'Musyawarah Wilayah IDI Kalimantan Timur 2026',
        description: 'Musyawarah Wilayah (MUSWIL) IDI Kalimantan Timur merupakan agenda rutin empat tahunan yang bertujuan untuk mengevaluasi program kerja kepengurusan periode sebelumnya serta menyusun rencana strategis dan memilih nakhoda baru untuk masa khidmat berikutnya.',
        startDate: '2026-05-20T08:00:00.000Z',
        endDate: '2026-05-22T17:00:00.000Z',
        location: 'Hotel Gran Senyiur',
        address: 'Balikpapan, Kalimantan Timur',
        isActive: true,
        categories: [
          { id: 'delegate', name: 'Utusan Cabang (Delegasi Resmi)', price: 1000000 },
          { id: 'participant', name: 'Anggota Biasa (Peserta)', price: 1250000 },
          { id: 'guest', name: 'Tamu Undangan / Eksibitor', price: 500000 }
        ],
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'events', defaultEventId), defaultEvent);
      console.log('Initial event seeded in Firestore.');
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const orderId = req.body.orderId || req.body.order_id || 'unknown';
    // Sanitize orderId untuk nama file (hapus karakter tidak valid)
    const safeOrderId = orderId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    cb(null, `payment-${safeOrderId}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const RegistrationSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(10),
  npa: z.string().optional(), // Nomor Pokok Anggota IDI
  category: z.string(),
  branchId: z.string().optional(),
  eventId: z.string(),
  kriteria: z.string().optional(),
  tipePeserta: z.string().optional(),
  suratMandatUrl: z.string().optional(),
  komisi: z.string().optional(),
  perhimpunanName: z.string().optional(),
  mkekBranch: z.string().optional(),
  bersedia: z.boolean().optional()
});

  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const username = req.headers['x-admin-username'] as string;
    const password = req.headers['x-admin-password'] as string;
    if (!username || !password) return Object.assign(res.status(401).json({ error: 'Unauthorized' }));
    try {
      const adminSnap = await getDoc(doc(db, 'admins', username));
      if (!adminSnap.exists()) return Object.assign(res.status(401).json({ error: 'Unauthorized' }));
      const isValid = await bcrypt.compare(password, adminSnap.data().password);
      if (!isValid) return Object.assign(res.status(401).json({ error: 'Unauthorized' }));
      next();
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // API: Create Transaction
  app.post('/api/pay', async (req, res) => {
    try {
      const parseResult = RegistrationSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.error('Validation Error:', parseResult.error.format());
        return res.status(400).json({ 
          message: 'Data pendaftaran tidak valid', 
          details: parseResult.error.format() 
        });
      }
      const validatedData = parseResult.data;

      // Check if email already registered for THIS event
      let existingRef;
      try {
        console.log(`Checking registration for email: ${validatedData.email}, eventId: ${validatedData.eventId}`);
        const q = query(
          collection(db, 'registrations'), 
          where('email', '==', validatedData.email), 
          where('eventId', '==', validatedData.eventId)
        );
        existingRef = await getDocs(q);
        console.log(`Found ${existingRef.size} existing registrations for cleanup`);
      } catch (dbError: any) {
        console.error('Database Error during registration check:', dbError);
        return res.status(500).json({ 
          message: 'Gagal terhubung ke database. Silakan coba beberapa saat lagi.' 
        });
      }

      if (!existingRef.empty) {
        // Find if any are already paid
        const alreadyPaid = existingRef.docs.find(doc => ['settlement', 'capture'].includes(doc.data().status));
        if (alreadyPaid) {
          return res.status(400).json({ 
            message: 'Email ini sudah terdaftar dan pembayaran telah dikonfirmasi. Silakan cek email Anda untuk e-tiket.' 
          });
        }

        // Cleanup all non-paid records (pending/expire/cancel/deny)
        for (const existingDoc of existingRef.docs) {
          try {
            console.log(`Cleaning up previous incomplete registration (${existingDoc.data().status}) for ${validatedData.email} (ID: ${existingDoc.id})`);
            await deleteDoc(existingDoc.ref);
          } catch (delError) {
            console.error('Error deleting previous record:', delError);
          }
        }
      }

      const orderId = `${validatedData.eventId}-${Date.now()}`;
      
      let price = 0;
      let categoryName = validatedData.category;
      let eventTitle = 'Event IDI';

      const eventRef = doc(db, 'events', validatedData.eventId);
      const eventSnap = await getDoc(eventRef);
      if (!eventSnap.exists()) {
        return res.status(400).json({ message: 'Event tidak ditemukan atau sudah berakhir.' });
      }
      
      const event = eventSnap.data();
      eventTitle = event.title;
      const cat = event.categories?.find((c: any) => c.id === validatedData.category);
      if (!cat) {
        return res.status(400).json({ message: 'Kategori tiket tidak valid untuk event ini.' });
      }
      price = cat.price;
      
      let dynamicCatName = cat.name;
      if (validatedData.kriteria === 'ASAL IDI CABANG' && validatedData.tipePeserta && validatedData.branchId) {
        dynamicCatName = `${validatedData.tipePeserta.split(' ')[0]} ${validatedData.branchId}`;
      } else if (validatedData.kriteria === 'PENGURUS IDI WILAYAH KALTIM') {
        dynamicCatName = 'PENGURUS IDI WILAYAH KALTIM';
      } else if (validatedData.kriteria === 'PERHIMPUNAN DAN KESEMINATAN' && validatedData.perhimpunanName) {
        dynamicCatName = validatedData.perhimpunanName;
      } else if (validatedData.kriteria === 'MKEK' && validatedData.mkekBranch) {
        dynamicCatName = `MKEK ${validatedData.mkekBranch.replace('PENGURUS ', '')}`;
      }
      
      categoryName = dynamicCatName;

      // price === 0 condition (Free Registration)
      if (price === 0) {
        console.log('Free registration for Utusan:', validatedData.email);
        
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
          kriteria: validatedData.kriteria || '',
          tipePeserta: validatedData.tipePeserta || '',
          suratMandatUrl: validatedData.suratMandatUrl || '',
          komisi: validatedData.komisi || '',
          perhimpunanName: validatedData.perhimpunanName || '',
          mkekBranch: validatedData.mkekBranch || '',
          bersedia: validatedData.bersedia || false,
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

      // Initial save for paid registration (pending)
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
        kriteria: validatedData.kriteria || '',
        tipePeserta: validatedData.tipePeserta || '',
        suratMandatUrl: validatedData.suratMandatUrl || '',
        komisi: validatedData.komisi || '',
        perhimpunanName: validatedData.perhimpunanName || '',
        mkekBranch: validatedData.mkekBranch || '',
        bersedia: validatedData.bersedia || false,
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
            name: `Tiket Muswil Kaltim - ${categoryName}`,
          },
        ],
        custom_field1: validatedData.fullName,
        custom_field2: categoryName,
      };

      const snap = getSnap();
      const transaction = await snap.createTransaction(parameter);
      res.json({ token: transaction.token, orderId });
    } catch (error: any) {
      console.error('Payment Error Trace:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ 
        message: `Gagal memproses pendaftaran: ${errorMessage}`,
        details: error
      });
    }
  });

  // API: Get Admin Registrations
  app.get('/api/admin/registrations', requireAdmin, async (req, res) => {
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
  });

  // Public APIs for form
  app.get('/api/branches', async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(db, 'branches'), orderBy('name', 'asc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch(e) { res.status(500).json([]); }
  });

  app.get('/api/categories', async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch(e) { res.status(500).json([]); }
  });

  // Event APIs
  app.get('/api/events', async (req, res) => {
    try {
      const q = query(collection(db, 'events'), where('isActive', '==', true), orderBy('startDate', 'asc'));
      const snapshot = await getDocs(q);
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error('Fetch events error:', e);
      res.status(500).json([]);
    }
  });

  app.get('/api/admin/events', requireAdmin, async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/admin/events', requireAdmin, async (req, res) => {
    try {
      console.log('Admin creating event:', req.body.title);
      // Optional: Check for recently created similar event to prevent duplicates
      const now = new Date();
      const fiveSecondsAgo = new Date(now.getTime() - 5000).toISOString();
      const duplicateCheck = await getDocs(query(
        collection(db, 'events'), 
        where('title', '==', req.body.title),
        where('createdAt', '>=', fiveSecondsAgo)
      ));
      
      if (!duplicateCheck.empty) {
        console.warn('Duplicate event creation attempt blocked for:', req.body.title);
        return res.status(409).json({ error: 'Event dengan judul serupa baru saja dibuat.' });
      }

      const docRef = await addDoc(collection(db, 'events'), { ...req.body, createdAt: now.toISOString() });
      res.json({ id: docRef.id });
    } catch (error) { 
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Gagal membuat event' }); 
    }
  });

  app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      console.log('Admin updating event:', req.params.id);
      await updateDoc(doc(db, 'events', req.params.id), { ...req.body, updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error) { 
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Gagal memperbarui event' }); 
    }
  });

  app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      console.log('Admin deleting event:', req.params.id);
      await deleteDoc(doc(db, 'events', req.params.id));
      res.json({ success: true });
    } catch (error) { 
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Gagal menghapus event' }); 
    }
  });

  // Admin CRUD: Branches
  app.post('/api/admin/branches', requireAdmin, async (req, res) => {
    try {
      const docRef = await addDoc(collection(db, 'branches'), { ...req.body, createdAt: serverTimestamp() });
      res.json({ id: docRef.id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.put('/api/admin/branches/:id', requireAdmin, async (req, res) => {
    try {
      await updateDoc(doc(db, 'branches', req.params.id), { name: req.body.name });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/branches/:id', requireAdmin, async (req, res) => {
    try {
      await deleteDoc(doc(db, 'branches', req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  // Admin CRUD: Categories
  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    try {
      const { name, price } = req.body;
      const docRef = await addDoc(collection(db, 'categories'), { name, price: Number(price), createdAt: serverTimestamp() });
      res.json({ id: docRef.id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      const { name, price } = req.body;
      await updateDoc(doc(db, 'categories', req.params.id), { name, price: Number(price) });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      await deleteDoc(doc(db, 'categories', req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });


  function getPaymentPhotoUrl(orderId: string): string {
    const safeOrderId = orderId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const uploadsDir = path.join(process.cwd(), 'public/uploads');
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const filename = `payment-${safeOrderId}${ext}`;
      if (fs.existsSync(path.join(uploadsDir, filename))) {
        return `/uploads/${filename}`;
      }
    }
    return '';
  }
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
      const photoUrl = getPaymentPhotoUrl(orderId); // ✅ derive dari file, bukan Firestore

      if (regData.amount === 0 || !process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
        return res.json({ 
          transaction_status: regData.status,
          gross_amount: regData.amount,
          transaction_time: regData.createdAt,
          payment_type: 'free/dummy',
          order_id: orderId,
          custom_field1: regData.fullName,
          custom_field2: regData.category,
          photoUrl, // ✅
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
          photoUrl, // ✅
        });
      } catch (midtransError: any) {
        console.warn('Midtrans status fetch warn:', midtransError.message);
        return res.json({ 
          transaction_status: regData.status,
          gross_amount: regData.amount,
          transaction_time: regData.createdAt,
          order_id: orderId,
          custom_field1: regData.fullName,
          custom_field2: regData.category,
          photoUrl, // ✅
        });
      }
    } catch (error) {
      console.error('Fetch Status Error:', error);
      res.status(500).json({ error: 'Gagal mengambil status' });
    }
  });

  app.post('/api/update-photo', async (req, res) => {
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
      console.error('Update Photo Error:', error);
      res.status(500).json({ error: 'Gagal mengunggah foto' });
    }
  });

  // API: Upload payment photo (multipart) and update registration.paymentPhoto
  // API: Upload payment photo (multipart) and update registration.paymentPhoto
    app.post('/api/update-payment', upload.single('paymentPhoto'), async (req, res) => {
      try {
        const orderId = (req.body.orderId || req.body.order_id || req.body.orderID) as string;
        if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded (expected field "paymentPhoto")' });

        const mimetype = (file.mimetype || '').toLowerCase();
        if (!mimetype.includes('image')) {
          return res.status(400).json({ error: 'File harus berupa gambar (jpeg/png)' });
        }

  const fileUrl = `/uploads/${file.filename}`;
  const publicBase = `${req.protocol}://${req.get('host')}`;
  const fullUrl = `${publicBase}${fileUrl}`;

        // Gunakan Admin SDK jika tersedia (bypass Firestore rules)
        if (adminDb) {
          const adminDocRef = adminDb.collection('registrations').doc(orderId);
          const adminSnap = await adminDocRef.get();
          if (!adminSnap.exists) {
            return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
          }
          await adminDocRef.update({
            paymentPhoto: fileUrl,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Fallback: update the allowed `photoUrl` field (firestore.rules permits this) so clients can see the image
          const docRef = doc(db, 'registrations', orderId);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
          }
          try {
            await updateDoc(docRef, {
              photoUrl: fullUrl,
              updatedAt: new Date().toISOString()
            });
          } catch (updateErr: any) {
            console.error('Firestore update error (client SDK) for photoUrl:', updateErr);
            // Remove the uploaded file to avoid orphaned files
            try { fs.unlinkSync(path.join(process.cwd(), 'public', 'uploads', file.filename)); } catch (e) {}
            if (updateErr?.code === 7 || updateErr?.message?.includes('PERMISSION_DENIED')) {
              return res.status(403).json({ error: 'Permission denied when updating Firestore. Initialize firebase-admin with service account credentials or adjust Firestore rules.' });
            }
            throw updateErr;
          }
        }

        res.json({ success: true, fileUrl });
      } catch (error: any) {
        console.error('Update Payment Photo Error:', error?.message || error);
        res.status(500).json({ error: 'Gagal mengunggah bukti pembayaran', detail: error?.message });
      }
    });

    // API: Upload payment photo as base64 (JSON) - useful when client sends dataURL
    app.post('/api/update-payment-base64', express.json({ limit: '8mb' }), async (req, res) => {
      try {
        const { orderId, data, filename } = req.body as { orderId?: string; data?: string; filename?: string };
        if (!orderId || !data) return res.status(400).json({ error: 'orderId and data (base64) are required' });

        const safeOrderId = String(orderId).replace(/[^a-zA-Z0-9_\-]/g, '_');

        // strip data URI prefix if present
        const matches = String(data).match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        let mimeType = 'image/jpeg';
        let base64 = String(data);
        if (matches) {
          mimeType = matches[1];
          base64 = matches[2];
        }

        const allowed: Record<string, string> = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
        if (!allowed[mimeType]) return res.status(400).json({ error: 'Unsupported image type' });

        const buffer = Buffer.from(base64, 'base64');
        const maxBytes = 3 * 1024 * 1024; // 3 MB decoded limit
        if (buffer.length > maxBytes) return res.status(400).json({ error: 'Image too large' });

        const ext = allowed[mimeType];
        const finalName = filename ? String(filename).replace(/[^a-zA-Z0-9_.\-]/g, '_') : `payment-${safeOrderId}${ext}`;
        const outDir = path.join(process.cwd(), 'public/uploads');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const outPath = path.join(outDir, finalName);
        fs.writeFileSync(outPath, buffer);

        const fileUrl = `/uploads/${finalName}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

        // Try to persist to Firestore if adminDb available (privileged). If not, skip DB write.
        try {
          if (adminDb) {
            const regRef = adminDb.collection('registrations').doc(orderId);
            const regSnap = await regRef.get();
            if (!regSnap.exists) {
              // remove file to avoid orphan
              try { fs.unlinkSync(outPath); } catch (e) {}
              return res.status(404).json({ error: 'Registration not found' });
            }
            await regRef.update({ paymentPhoto: fileUrl, paymentPhotoUrl: fullUrl, updatedAt: new Date().toISOString() });
          }
        } catch (dbErr) {
          console.error('Failed to persist base64 payment photo to Firestore:', dbErr);
          // cleanup file on DB failure
          try { fs.unlinkSync(outPath); } catch (e) {}
          return res.status(500).json({ error: 'Failed to save payment photo to database', detail: String(dbErr) });
        }

        return res.json({ success: true, fileUrl, fileUrlFull: fullUrl });
      } catch (err: any) {
        console.error('Base64 upload err:', err);
        return res.status(500).json({ error: 'Failed to save base64 image', detail: err?.message || String(err) });
      }
    });

  app.post('/api/admin/check-in', requireAdmin, async (req, res) => {
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
  });

  app.get('/api/admin/guestbook', requireAdmin, async (req, res) => {
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
                  <td style="text-align: right; font-weight: bold; color: #0f172a;">${category}</td>
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
  // Initialize Database & Seeding
  await seedDatabase();

  // API Routes
  app.use('/api', apiRoutes);

  // Diagnostics endpoint to verify Admin SDK state without exposing secrets
  app.get('/api/diagnostics', (req, res) => {
    try {
      const adminInitialized = !!adminDb;
      const hasAdminEnv = !!(process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS);
      res.json({ adminInitialized, hasAdminEnv });
    } catch (err) {
      console.error('Diagnostics error:', err);
      res.status(500).json({ error: 'Diagnostics failed' });
    }
  });

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

  // Global Express error handler — placed here so it has access to `app`
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      console.error('Global error handler caught:', err && err.message ? err.message : err);
      // Multer-specific errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large', code: err.code });
        }
        return res.status(400).json({ error: err.message || 'Multer error', code: err.code });
      }

      // If the error has an HTTP status, use it
      const status = err?.status || err?.statusCode || 500;
      const message = err?.message || 'Internal Server Error';
      res.status(status).json({ error: message, detail: err?.detail || null });
    } catch (handlerErr) {
      console.error('Error in error handler:', handlerErr);
      res.status(500).json({ error: 'Internal Server Error in error handler' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

// Global error handler (for multer and other errors) - ensure JSON responses
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Express error handler for multer and other errors (returns JSON)
// Note: must be registered after all routes (which it is)
process.nextTick(() => {}); // keep stack position stable

// Exported middleware cannot be directly registered outside startServer(), but we will
// add a simple global handler by patching app inside startServer in future if needed.

