import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import midtransClient from 'midtrans-client';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { z } from 'zod';

import apiRoutes from './server/routes/index.ts';
import {
  adminDb,
  addDoc,
  collection,
  databaseProvider,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runMysqlMigrations,
  seedAppDatabase,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from './server/database/compat.ts';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function shouldUseMidtransSnap() {
  return process.env.VITE_USE_MIDTRANS_SNAP === 'true' || process.env.USE_MIDTRANS_SNAP === 'true';
}

function isPanitiaCategory(categoryNameOrId: string) {
  return String(categoryNameOrId || '').trim().toUpperCase().startsWith('PANITIA');
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
  app.set('etag', false);

  try {
    console.log(`Testing ${databaseProvider} connection...`);
    await runMysqlMigrations();
    await getDocs(query(collection(db, 'registrations'), where('__name__', '==', 'test')));
    console.log(`${databaseProvider} connection verified`);
    await seedAppDatabase();
  } catch (err: any) {
    console.error(`${databaseProvider} init error:`, err.message);
  }

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
      const isPanitiaRegistration = isPanitiaCategory(categoryName) || isPanitiaCategory(validatedData.category);

      if (isPanitiaRegistration) {
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
          kriteria: validatedData.kriteria || '',
          tipePeserta: validatedData.tipePeserta || '',
          suratMandatUrl: validatedData.suratMandatUrl || '',
          komisi: validatedData.komisi || '',
          perhimpunanName: validatedData.perhimpunanName || '',
          mkekBranch: validatedData.mkekBranch || '',
          bersedia: validatedData.bersedia || false,
          status: 'pending',
          amount: 0,
          paymentVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'registrations', orderId), panitiaReg);
        return res.json({ orderId, isAdminApproval: true });
      }

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

      if (!shouldUseMidtransSnap()) {
        return res.json({ orderId, isBankTransfer: true });
      }

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

  app.get('/api/panitia/status', async (req, res) => {
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

      if (existing.empty) {
        return res.json({ exists: false });
      }

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
  });

  app.post('/api/panitia/register', async (req, res) => {
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
        if (!existingDoc) {
          return res.status(409).json({ message: 'Email ini sudah terdaftar sebagai peserta kategori lain.' });
        }
        const existingData = existingDoc.data();
        if (!isPanitiaCategory(existingData.category) && !isPanitiaCategory(existingData.categoryId)) {
          return res.status(409).json({ message: 'Email ini sudah terdaftar sebagai peserta kategori lain.' });
        }
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
  });

  app.post('/api/panitia/photo', async (req, res) => {
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

  app.post('/api/admin/registrations/import', requireAdmin, async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
      if (!rows.length) {
        return res.status(400).json({ error: 'Data Excel kosong' });
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const imported: any[] = [];
      const errors: { row: number; message: string }[] = [];
      const now = new Date().toISOString();

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] || {};
        const rowNumber = index + 2;
        const fullName = String(row.fullName || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const phone = String(row.phone || '').trim();
        const eventId = String(row.eventId || '').trim();
        const categoryId = String(row.categoryId || '').trim();
        const category = String(row.category || '').trim();

        if (!fullName) {
          errors.push({ row: rowNumber, message: 'Nama Lengkap wajib diisi' });
          continue;
        }
        if (!emailPattern.test(email)) {
          errors.push({ row: rowNumber, message: 'Email tidak valid' });
          continue;
        }
        if (phone.length < 8) {
          errors.push({ row: rowNumber, message: 'Nomor WhatsApp wajib diisi' });
          continue;
        }
        if (!eventId) {
          errors.push({ row: rowNumber, message: 'Event ID wajib diisi' });
          continue;
        }
        if (!categoryId && !category) {
          errors.push({ row: rowNumber, message: 'Kategori ID atau Kategori wajib diisi' });
          continue;
        }

        const orderId = String(row.orderId || '').trim() || `import-${Date.now()}-${index + 1}`;
        const status = String(row.status || 'settlement').trim().toLowerCase();
        const amountNumber = Number(row.amount || 0);
        const payload = {
          orderId,
          eventId,
          eventTitle: String(row.eventTitle || '').trim(),
          fullName,
          email,
          phone,
          npa: String(row.npa || '').trim(),
          category: category || categoryId,
          categoryId: categoryId || category,
          branchId: String(row.branchId || '').trim(),
          kriteria: String(row.kriteria || '').trim(),
          tipePeserta: String(row.tipePeserta || '').trim(),
          suratMandatUrl: String(row.suratMandatUrl || '').trim(),
          komisi: String(row.komisi || '').trim(),
          perhimpunanName: String(row.perhimpunanName || '').trim(),
          mkekBranch: String(row.mkekBranch || '').trim(),
          bersedia: row.bersedia === true || String(row.bersedia || '').toLowerCase() === 'true' || String(row.bersedia || '').toLowerCase() === 'ya',
          status: status || 'settlement',
          amount: Number.isFinite(amountNumber) ? amountNumber : 0,
          paymentVerified: ['settlement', 'capture'].includes(status),
          createdAt: String(row.createdAt || '').trim() || now,
          updatedAt: now,
        };

        try {
          await setDoc(doc(db, 'registrations', orderId), payload);
          imported.push({ orderId, fullName, email });
        } catch (rowError: any) {
          errors.push({ row: rowNumber, message: rowError?.message || 'Gagal menyimpan data' });
        }
      }

      res.json({ success: true, imported: imported.length, errors });
    } catch (error: any) {
      console.error('Import Registrations Error:', error);
      res.status(500).json({ error: 'Gagal import data pendaftaran', detail: error?.message });
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
      const masterSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name', 'asc')));
      const masterCategories = masterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const masterMap = new Map(masterCategories.map((category: any) => [category.id, category]));
      res.json(snapshot.docs.map(doc => {
        const data: any = doc.data();
        const eventCategories = Array.isArray(data.categories) ? data.categories : [];
        const filteredCategories = masterMap.size > 0
          ? eventCategories
              .filter((eventCategory: any) => masterMap.has(eventCategory.id))
              .map((eventCategory: any) => {
                const masterCategory: any = masterMap.get(eventCategory.id);
                return {
                  ...eventCategory,
                  name: masterCategory?.name || eventCategory.name,
                  price: Number(eventCategory.price || 0) > 0 ? Number(eventCategory.price) : Number(masterCategory?.price || 0),
                };
              })
          : eventCategories;
        return { id: doc.id, ...data, categories: filteredCategories };
      }));
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
      const eventPayload = {
        ...req.body,
        categories: Array.isArray(req.body.categories)
          ? req.body.categories.map((category: any) => ({
              ...category,
              price: Number(String(category.price || 0).replace(/[^\d]/g, '')) || 0,
            }))
          : [],
      };
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

      const docRef = await addDoc(collection(db, 'events'), { ...eventPayload, createdAt: now.toISOString() });
      res.json({ id: docRef.id });
    } catch (error) { 
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Gagal membuat event' }); 
    }
  });

  app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      console.log('Admin updating event:', req.params.id);
      const eventPayload = {
        ...req.body,
        categories: Array.isArray(req.body.categories)
          ? req.body.categories.map((category: any) => ({
              ...category,
              price: Number(String(category.price || 0).replace(/[^\d]/g, '')) || 0,
            }))
          : [],
      };
      await updateDoc(doc(db, 'events', req.params.id), { ...eventPayload, updatedAt: new Date().toISOString() });
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

  async function getBranchName(branchId?: string) {
    if (!branchId) return '';
    try {
      const branchSnap = await getDoc(doc(db, 'branches', branchId));
      if (branchSnap.exists()) return branchSnap.data()?.name || branchId;
    } catch (error) {
      console.warn('Branch lookup warn:', error);
    }
    return branchId;
  }

  // API: Get Payment Status
  app.get('/api/payment-status/by-email', async (req, res) => {
    try {
      const email = ((req.query.email as string) || '').trim();
      if (!email) return res.status(400).json({ error: 'Email query parameter is required' });

      const q = query(collection(db, 'registrations'), where('email', '==', email));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => {
        const data: any = d.data();
        return {
          orderId: d.id || data.orderId || null,
          status: data.status,
          amount: data.amount,
          eventTitle: data.eventTitle,
          createdAt: data.createdAt,
          fullName: data.fullName,
          category: data.category,
          branchId: data.branchId || '',
        };
      });
      return res.status(200).json({ results: items });
    } catch (error) {
      console.error('getPaymentStatusByEmail error:', error);
      return res.status(500).json({ error: 'Gagal mencari data berdasarkan email' });
    }
  });

  app.get('/api/payment-status/:orderId', async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const docRef = doc(db, 'registrations', orderId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
      }

      const regData = docSnap.data();
      const branchName = await getBranchName(regData.branchId);
      const commonStatusFields = {
        order_id: orderId,
        custom_field1: regData.fullName,
        custom_field2: regData.category,
        custom_field3: regData.eventTitle,
        branchId: regData.branchId || '',
        branchName,
        kriteria: regData.kriteria || '',
        tipePeserta: regData.tipePeserta || '',
        photoUrl: regData.photoUrl || getPaymentPhotoUrl(orderId),
      };
      const photoUrl = regData.photoUrl || getPaymentPhotoUrl(orderId);

      if (regData.amount === 0 || !process.env.MIDTRANS_SERVER_KEY || process.env.MIDTRANS_SERVER_KEY === 'MY_MIDTRANS_SERVER_KEY') {
        return res.json({ 
          transaction_status: regData.status,
          gross_amount: regData.amount,
          transaction_time: regData.createdAt,
          ...commonStatusFields,
          payment_type: 'free/dummy',
          order_id: orderId,
          custom_field1: regData.fullName,
          custom_field2: regData.category,
          custom_field3: regData.eventTitle,
          branchId: regData.branchId || '',
          branchName,
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
          ...commonStatusFields,
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
          ...commonStatusFields,
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
        const isAllowedFile = mimetype.includes('image') || mimetype === 'application/pdf';
        if (!isAllowedFile) {
          return res.status(400).json({ error: 'File harus berupa gambar (jpeg/png) atau PDF' });
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
          // Fallback: keep payment proof in the same field the admin dashboard reads.
          const docRef = doc(db, 'registrations', orderId);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            return res.status(404).json({ error: 'Data registrasi tidak ditemukan' });
          }
          try {
            await updateDoc(docRef, {
              paymentPhoto: fileUrl,
              updatedAt: new Date().toISOString()
            });
          } catch (updateErr: any) {
            console.error('Firestore update error (client SDK) for paymentPhoto:', updateErr);
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
        const matches = String(data).match(/^data:((?:image\/[a-zA-Z]+)|application\/pdf);base64,(.+)$/);
        let mimeType = 'image/jpeg';
        let base64 = String(data);
        if (matches) {
          mimeType = matches[1];
          base64 = matches[2];
        }

        const allowed: Record<string, string> = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
        if (!allowed[mimeType]) return res.status(400).json({ error: 'Unsupported file type' });

        const buffer = Buffer.from(base64, 'base64');
        const maxBytes = 5 * 1024 * 1024; // 5 MB decoded limit
        if (buffer.length > maxBytes) return res.status(400).json({ error: 'File terlalu besar (maksimal 5MB)' });

        const ext = allowed[mimeType];
        const finalName = filename ? String(filename).replace(/[^a-zA-Z0-9_.\-]/g, '_') : `payment-${safeOrderId}${ext}`;
        const outDir = path.join(process.cwd(), 'public/uploads');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const outPath = path.join(outDir, finalName);
        fs.writeFileSync(outPath, buffer);

        const fileUrl = `/uploads/${finalName}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

        // Persist base64 data URL into Firestore.photoUrl as requested (if size fits rules)
        try {
          // Reconstruct data URL (if input had prefix use that, otherwise build it)
          const inputData = String(data);
          const dataUrlFull = matches ? inputData : `data:${mimeType};base64,${base64}`;
          const isPdf = mimeType === 'application/pdf';

          // Enforce Firestore rule: photoUrl max ~1,048,576 characters
          if (!isPdf && dataUrlFull.length > 1048576) {
            // cleanup file to avoid orphan
            try { fs.unlinkSync(outPath); } catch (e) {}
            return res.status(400).json({ error: 'Base64 data too large for Firestore (max 1,048,576 characters). Please compress or resize image.' });
          }

            // We'll persist both a storage/file reference (paymentPhoto) and the
            // base64 data URL (photoUrl) so clients (TicketDownload) can render
            // immediately while admins can see the uploaded file path.
            // Persist base64 under `paymentPhoto` (so it doesn't override
            // the attendee `photoUrl` used for ticket photos). Also store
            // the uploaded file path in `paymentPhotoFile` for admin reference.
            const updatePayload: any = {
              paymentPhoto: isPdf ? fileUrl : dataUrlFull,
              paymentPhotoFile: fileUrl,
              updatedAt: new Date().toISOString()
            };

            if (adminDb) {
              const regRef = adminDb.collection('registrations').doc(orderId);
              const regSnap = await regRef.get();
              if (!regSnap.exists) {
                try { fs.unlinkSync(outPath); } catch (e) {}
                return res.status(404).json({ error: 'Registration not found' });
              }
              await regRef.update(updatePayload);
            } else {
              // client SDK fallback — Firestore rules must allow at least photoUrl.
              const docRef = doc(db, 'registrations', orderId);
              const docSnap = await getDoc(docRef);
              if (!docSnap.exists()) {
                try { fs.unlinkSync(outPath); } catch (e) {}
                return res.status(404).json({ error: 'Registration not found' });
              }

              try {
                // Try updating paymentPhoto & paymentPhotoFile. If permission denied
                // for these fields, fall back to updating only paymentPhoto (if allowed).
                await updateDoc(docRef, updatePayload);
              } catch (partialErr: any) {
                console.warn('Client SDK update for paymentPhoto failed, attempting to persist paymentPhoto only:', partialErr?.message || partialErr);
                try {
                  await updateDoc(docRef, { paymentPhoto: isPdf ? fileUrl : dataUrlFull, updatedAt: new Date().toISOString() });
                } catch (updateErr: any) {
                  console.error('Firestore update error (client SDK) for paymentPhoto after fallback:', updateErr);
                  try { fs.unlinkSync(outPath); } catch (e) {}
                  if (updateErr?.code === 7 || updateErr?.message?.includes('PERMISSION_DENIED')) {
                    return res.status(403).json({ error: 'Permission denied when updating Firestore. Initialize firebase-admin with service account credentials or adjust Firestore rules.' });
                  }
                  throw updateErr;
                }
              }
            }
        } catch (dbErr) {
          console.error('Failed to persist base64 payment photo to Firestore:', dbErr);
          // cleanup file on DB failure
          try { fs.unlinkSync(outPath); } catch (e) {}
          if (dbErr?.code === 7 || String(dbErr).includes('PERMISSION_DENIED')) {
            return res.status(403).json({ error: 'Permission denied when updating Firestore. Initialize firebase-admin with service account credentials or adjust Firestore rules.' });
          }
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


