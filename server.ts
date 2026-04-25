import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { config as envConfig, assertProductionConfig } from './server/config';
import { getSnap, verifyNotification } from './server/midtrans';
import { qrBufferFromObject } from './server/utils';
import { requireAdmin } from './server/adminAuth';
import { z } from 'zod';
import dotenv from 'dotenv';
import { collection, doc, setDoc, updateDoc, getDocs, query, where, orderBy, getDoc, deleteDoc, addDoc, serverTimestamp } from './server/firestoreCompat';
import { recordTiming, getStats } from './server/metrics';
import fs from 'fs';
import bcrypt from 'bcryptjs';

dotenv.config();

// Validate production config early
try {
  assertProductionConfig();
} catch (err: any) {
  console.error('Config validation failed:', err.message);
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

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

// Note: server now uses firebase-admin via server/firebaseAdmin.ts

// Test connection and Seed Admin
(async () => {
  try {
    console.log(`Testing Firestore connection...`);
    await getDocs(collection('registrations'));
    console.log('Firestore connection verified');
    
    // Seed Admin User
    const adminUsername = process.env.ADMIN_USERNAME || 'adminidikaltim2026';
    const plainPassword = process.env.ADMIN_PASSWORD || '1d1k4lt!m2026';
  const adminRef = doc('admins', adminUsername);
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

    // Seed Initial Event if none exists
  const eventsSnapshot = await getDocs(collection('events'));
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
  await setDoc(doc('events', defaultEventId), defaultEvent);
      console.log('Initial event seeded in Firestore.');
    }
  } catch (err: any) {
    console.error('Firestore init error:', err.message);
  }
})();

const PORT = 3000;

// Midtrans initialized via server/midtrans.ts (getSnap)

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
  category: z.string(),
  branchId: z.string().optional(),
  eventId: z.string()
});

  

async function startServer() {
  const app = express();
  // Security middlewares
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, true) }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Simple timing middleware to record endpoint durations
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const routeKey = `${req.method} ${req.route?.path || req.path}`;
      recordTiming(routeKey, ms);
    });
    next();
  });

  // Route: /api/pay moved to server/routes/pay.ts
  const payRouter = (await import('./server/routes/pay')).default;
  app.use('/api/pay', payRouter);

  // Registrations routes moved to server/routes/registrations.ts
  const registrationsRouter = (await import('./server/routes/registrations')).default;
  app.use('/api', registrationsRouter);

  // Users routes
  const usersRouter = (await import('./server/routes/users')).default;
  app.use('/api/users', usersRouter);

  // Admin metrics endpoint
  app.get('/api/admin/metrics', requireAdmin, (req, res) => {
    res.json(getStats());
  });

  // Public APIs for form
  app.get('/api/branches', async (req, res) => {
    try {
  const snapshot = await getDocs(query(collection('branches'), orderBy('name', 'asc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch(e) { res.status(500).json([]); }
  });

  app.get('/api/categories', async (req, res) => {
    try {
  const snapshot = await getDocs(query(collection('categories'), orderBy('name', 'asc')));
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch(e) { res.status(500).json([]); }
  });

  // Event APIs
  app.get('/api/events', async (req, res) => {
    try {
  const q = query(collection('events'), where('isActive', '==', true), orderBy('startDate', 'asc'));
      const snapshot = await getDocs(q);
      res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error('Fetch events error:', e);
      res.status(500).json([]);
    }
  });

  app.get('/api/admin/events', requireAdmin, async (req, res) => {
    try {
  const snapshot = await getDocs(query(collection('events'), orderBy('createdAt', 'desc')));
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
        collection('events'), 
        where('title', '==', req.body.title),
        where('createdAt', '>=', fiveSecondsAgo)
      ));
      
      if (!duplicateCheck.empty) {
        console.warn('Duplicate event creation attempt blocked for:', req.body.title);
        return res.status(409).json({ error: 'Event dengan judul serupa baru saja dibuat.' });
      }

  const docRef = await addDoc(collection('events'), { ...req.body, createdAt: now.toISOString() });
      res.json({ id: docRef.id });
    } catch (error) { 
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Gagal membuat event' }); 
    }
  });

  app.put('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      console.log('Admin updating event:', req.params.id);
  await updateDoc(doc('events', req.params.id), { ...req.body, updatedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (error) { 
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Gagal memperbarui event' }); 
    }
  });

  app.delete('/api/admin/events/:id', requireAdmin, async (req, res) => {
    try {
      console.log('Admin deleting event:', req.params.id);
  await deleteDoc(doc('events', req.params.id));
      res.json({ success: true });
    } catch (error) { 
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Gagal menghapus event' }); 
    }
  });

  // Admin CRUD: Branches
  app.post('/api/admin/branches', requireAdmin, async (req, res) => {
    try {
  const docRef = await addDoc(collection('branches'), { ...req.body, createdAt: serverTimestamp() });
      res.json({ id: docRef.id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.put('/api/admin/branches/:id', requireAdmin, async (req, res) => {
    try {
  await updateDoc(doc('branches', req.params.id), { name: req.body.name });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/branches/:id', requireAdmin, async (req, res) => {
    try {
  await deleteDoc(doc('branches', req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  // Admin CRUD: Categories
  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    try {
      const { name, price } = req.body;
  const docRef = await addDoc(collection('categories'), { name, price: Number(price), createdAt: serverTimestamp() });
      res.json({ id: docRef.id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.put('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      const { name, price } = req.body;
  await updateDoc(doc('categories', req.params.id), { name, price: Number(price) });
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
  await deleteDoc(doc('categories', req.params.id));
      res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
  });

  // Payment status routed to payController
  const { paymentStatus } = await import('./server/controllers/payController');
  app.get('/api/payment-status/:orderId', paymentStatus);

  // Route: /api/webhook moved to server/routes/webhook.ts (raw body applied there)
  const webhookRouter = (await import('./server/routes/webhook')).default;
  app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);

  // Route: /api/events moved to server/routes/events.ts
  const eventsRouter = (await import('./server/routes/events')).default;
  app.use('/api/events', eventsRouter);

  // Route: /api/categories
  const categoriesRouter = (await import('./server/routes/categories')).default;
  app.use('/api/categories', categoriesRouter);

  // Route: /api/branches
  const branchesRouter = (await import('./server/routes/branches')).default;
  app.use('/api/branches', branchesRouter);

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

    // Generate QR Code buffer and attach as binary
    const qrData = { id: order_id, name, cat: category, event: data.custom_field3 || 'MUSWIL IDI KALTIM 2026' };
    const qrBuffer = await qrBufferFromObject(qrData);

    const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@idikaltim.org';
    const fromName = process.env.MAIL_FROM_NAME || 'Muswil IDI Kaltim';

    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: email,
      subject: 'E-Tiket Muswil IDI Kaltim 2026',
      attachments: [{ filename: 'qrcode.png', content: qrBuffer, cid: 'qrcode-ticket' }],
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
