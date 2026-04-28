import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, relying on environment variables');
}

export const config = {
  apiKey: process.env.FIREBASE_API_KEY || firebaseConfig?.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig?.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || firebaseConfig?.appId,
  firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId,
};

const firebaseApp = initializeApp(config);
export const db = getFirestore(firebaseApp, config.firestoreDatabaseId);

// Initialize firebase-admin if credentials are available
let adminDb: admin.firestore.Firestore | null = null;
try {
  if (process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
      const credObj = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      admin.initializeApp({ credential: admin.credential.cert(credObj as any) });
    } else {
      admin.initializeApp();
    }
    adminDb = admin.firestore();
    console.log('server/config/firebase: firebase-admin initialized');
  } else {
    console.log('server/config/firebase: firebase-admin not initialized (no credentials found)');
  }
} catch (err) {
  console.warn('server/config/firebase: failed to initialize firebase-admin', err);
  adminDb = null;
}

export { adminDb };
