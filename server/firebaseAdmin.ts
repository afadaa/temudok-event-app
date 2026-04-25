import admin from 'firebase-admin';
import fs from 'fs';
import { config } from './config';

// Initialize Firebase Admin SDK
export function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();

  if (config.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(config.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    const key = JSON.parse(fs.readFileSync(config.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(key), projectId: config.FIREBASE_PROJECT_ID });
  } else {
    // Fall back to default application credentials (ADC) if available
    admin.initializeApp();
  }
  return admin.app();
}

// Ensure initialized on import
try { initFirebaseAdmin(); } catch (e) { console.warn('Firebase Admin init warning:', e.message); }

export const adminApp = admin;
export const adminDb = () => admin.firestore();
