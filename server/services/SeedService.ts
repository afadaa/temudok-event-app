import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase.ts';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export async function seedDatabase() {
  try {
    console.log(`Verifying database seeding...`);
    
    // Seed Admin User
    const adminUsername = process.env.ADMIN_USERNAME || 'adminidikaltim2026';
    const plainPassword = process.env.ADMIN_PASSWORD || '1d1k4lt!m2026';
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
    console.error('Seed error:', err.message);
  }
}
