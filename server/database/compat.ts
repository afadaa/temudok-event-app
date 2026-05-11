import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection as fbCollection,
  doc as fbDoc,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  getDocs as fbGetDocs,
  getDoc as fbGetDoc,
  deleteDoc as fbDeleteDoc,
  addDoc as fbAddDoc,
  query as fbQuery,
  where as fbWhere,
  orderBy as fbOrderBy,
  serverTimestamp as fbServerTimestamp,
} from 'firebase/firestore';
import admin from 'firebase-admin';
import mysql from 'mysql2/promise';

dotenv.config();

type Provider = 'firestore' | 'mysql';
type WhereConstraint = { type: 'where'; field: string; op: string; value: any };
type OrderConstraint = { type: 'orderBy'; field: string; direction?: 'asc' | 'desc' };
type QueryConstraint = WhereConstraint | OrderConstraint;
type CollectionRef = { provider: Provider; name: string; fbRef?: any };
type DocRef = { provider: Provider; collectionName: string; id: string; fbRef?: any };
type QueryRef = { provider: Provider; collectionRef: CollectionRef; constraints: QueryConstraint[]; fbRef?: any };

const allowedTables = new Set(['admins', 'branches', 'categories', 'events', 'registrations']);
const jsonFields = new Set(['categories']);
const booleanFields = new Set(['isActive', 'bersedia', 'paymentVerified', 'checkedIn']);
const dateFields = new Set(['createdAt', 'updatedAt', 'startDate', 'endDate', 'checkedInAt']);
const columns: Record<string, string[]> = {
  admins: ['id', 'username', 'password', 'createdAt', 'updatedAt'],
  branches: ['id', 'name', 'createdAt', 'updatedAt'],
  categories: ['id', 'name', 'price', 'createdAt', 'updatedAt'],
  events: ['id', 'title', 'description', 'startDate', 'endDate', 'location', 'address', 'isActive', 'categories', 'createdAt', 'updatedAt'],
  registrations: [
    'id', 'orderId', 'eventId', 'eventTitle', 'fullName', 'email', 'phone', 'npa', 'category', 'categoryId',
    'branchId', 'kriteria', 'tipePeserta', 'suratMandatUrl', 'komisi', 'perhimpunanName', 'mkekBranch',
    'bersedia', 'status', 'amount', 'paymentVerified', 'paymentPhoto', 'paymentPhotoFile', 'photoUrl',
    'checkedIn', 'checkedInAt', 'createdAt', 'updatedAt',
  ],
};

const rawDatabaseProvider = String(process.env.DATABASE_PROVIDER || process.env.DB_PROVIDER || 'firestore').trim().toLowerCase();

export const databaseProvider = (rawDatabaseProvider === 'mysql'
  ? 'mysql'
  : 'firestore') as Provider;

console.log(`Database provider: ${databaseProvider}`);

let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, relying on environment variables');
}

let firestoreDb: any = null;
if (databaseProvider === 'firestore') {
  const firebaseRuntimeConfig = {
    apiKey: process.env.FIREBASE_API_KEY || firebaseConfig?.apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain,
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig?.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId,
    appId: process.env.FIREBASE_APP_ID || firebaseConfig?.appId,
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId,
  };

  const firebaseApp = initializeApp(firebaseRuntimeConfig);
  firestoreDb = getFirestore(firebaseApp, firebaseRuntimeConfig.firestoreDatabaseId);
}

export let adminDb: admin.firestore.Firestore | null = null;
if (databaseProvider === 'firestore') {
  try {
    if (process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS) as any) });
      } else {
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
}

export const db = databaseProvider === 'firestore' ? firestoreDb : { provider: 'mysql' };

let pool: mysql.Pool | null = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
      user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
      password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'temudok_event_app',
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      namedPlaceholders: false,
      dateStrings: true,
    });
  }
  return pool;
}

function assertTable(table: string) {
  if (!allowedTables.has(table)) throw new Error(`Unsupported table: ${table}`);
}

function normalizeDateValue(value: any) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'string') return value.slice(0, 19).replace('T', ' ');
  return value;
}

function normalizeForMysql(table: string, id: string, payload: Record<string, any>) {
  assertTable(table);
  const allowed = columns[table];
  const row: Record<string, any> = { id };

  for (const [key, rawValue] of Object.entries(payload)) {
    if (!allowed.includes(key)) continue;
    let value = rawValue;
    if (value === undefined) continue;
    if (jsonFields.has(key)) value = JSON.stringify(value ?? []);
    if (booleanFields.has(key)) value = value ? 1 : 0;
    if (dateFields.has(key)) value = normalizeDateValue(value);
    row[key] = value;
  }

  if (table === 'admins') row.username = row.username || id;
  if (table === 'registrations') row.orderId = row.orderId || id;
  return row;
}

function normalizeFromMysql(row: any) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id') continue;
    if (jsonFields.has(key)) {
      if (typeof value === 'string') {
        try { out[key] = JSON.parse(value); } catch { out[key] = []; }
      } else {
        out[key] = value || [];
      }
      continue;
    }
    if (booleanFields.has(key)) {
      out[key] = value === 1 || value === true;
      continue;
    }
    if (dateFields.has(key) && value) {
      out[key] = typeof value === 'string' ? value.replace(' ', 'T') : value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function docSnapshot(ref: DocRef, row: any | null) {
  return {
    id: ref.id,
    ref,
    exists: () => !!row,
    data: () => row ? normalizeFromMysql(row) : undefined,
  };
}

function querySnapshot(table: string, rows: any[]) {
  const docs = rows.map((row: any) => {
    const ref: DocRef = { provider: 'mysql', collectionName: table, id: row.id };
    return {
      id: row.id,
      ref,
      data: () => normalizeFromMysql(row),
    };
  });
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
  };
}

function toSqlOperator(op: string) {
  if (op === '==') return '=';
  if (['>=', '<=', '>', '<'].includes(op)) return op;
  throw new Error(`Unsupported where operator for MySQL: ${op}`);
}

function buildSelect(ref: CollectionRef, constraints: QueryConstraint[]) {
  assertTable(ref.name);
  const whereParts: string[] = [];
  const values: any[] = [];
  const orders: string[] = [];

  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      if (constraint.field === '__name__') {
        whereParts.push('id ' + toSqlOperator(constraint.op) + ' ?');
        values.push(constraint.value);
      } else {
        if (!columns[ref.name].includes(constraint.field)) continue;
        whereParts.push('`' + constraint.field + '` ' + toSqlOperator(constraint.op) + ' ?');
        let value = constraint.value;
        if (booleanFields.has(constraint.field)) value = value ? 1 : 0;
        if (dateFields.has(constraint.field)) value = normalizeDateValue(value);
        values.push(value);
      }
    }
    if (constraint.type === 'orderBy' && columns[ref.name].includes(constraint.field)) {
      orders.push('`' + constraint.field + '` ' + ((constraint.direction || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'));
    }
  }

  let sql = `SELECT * FROM \`${ref.name}\``;
  if (whereParts.length) sql += ` WHERE ${whereParts.join(' AND ')}`;
  if (orders.length) sql += ` ORDER BY ${orders.join(', ')}`;
  return { sql, values };
}

export function collection(database: any, name: string): CollectionRef {
  if (databaseProvider === 'firestore') return { provider: 'firestore', name, fbRef: fbCollection(database, name) };
  assertTable(name);
  return { provider: 'mysql', name };
}

export function doc(database: any, collectionName: string, id: string): DocRef {
  if (databaseProvider === 'firestore') return { provider: 'firestore', collectionName, id, fbRef: fbDoc(database, collectionName, id) };
  assertTable(collectionName);
  return { provider: 'mysql', collectionName, id };
}

export function where(field: string, op: string, value: any): WhereConstraint | any {
  return databaseProvider === 'firestore' ? fbWhere(field, op as any, value) : { type: 'where', field, op, value };
}

export function orderBy(field: string, direction?: 'asc' | 'desc'): OrderConstraint | any {
  return databaseProvider === 'firestore' ? fbOrderBy(field, direction) : { type: 'orderBy', field, direction };
}

export function query(collectionRef: CollectionRef, ...constraints: QueryConstraint[]): QueryRef | any {
  if (databaseProvider === 'firestore') return { provider: 'firestore', collectionRef, constraints, fbRef: fbQuery(collectionRef.fbRef, ...(constraints as any[])) };
  return { provider: 'mysql', collectionRef, constraints };
}

export async function getDocs(ref: CollectionRef | QueryRef | any): Promise<any> {
  if (databaseProvider === 'firestore') {
    const fbRef = ref.fbRef || ref;
    return fbGetDocs(fbRef);
  }
  const collectionRef = ref.collectionRef || ref;
  const constraints = ref.constraints || [];
  const { sql, values } = buildSelect(collectionRef, constraints);
  const [rows] = await getPool().query(sql, values);
  return querySnapshot(collectionRef.name, rows as any[]);
}

export async function getDoc(ref: DocRef | any): Promise<any> {
  if (databaseProvider === 'firestore') return fbGetDoc(ref.fbRef || ref);
  const [rows] = await getPool().query(`SELECT * FROM \`${ref.collectionName}\` WHERE id = ? LIMIT 1`, [ref.id]);
  const first = (rows as any[])[0] || null;
  return docSnapshot(ref, first);
}

export async function setDoc(ref: DocRef | any, payload: Record<string, any>) {
  if (databaseProvider === 'firestore') return fbSetDoc(ref.fbRef || ref, payload);
  const row = normalizeForMysql(ref.collectionName, ref.id, payload);
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  const updates = keys.filter(key => key !== 'id').map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ');
  await getPool().execute(
    `INSERT INTO \`${ref.collectionName}\` (${keys.map(key => `\`${key}\``).join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
    keys.map(key => row[key])
  );
}

export async function updateDoc(ref: DocRef | any, payload: Record<string, any>) {
  if (databaseProvider === 'firestore') return fbUpdateDoc(ref.fbRef || ref, payload);
  const row = normalizeForMysql(ref.collectionName, ref.id, payload);
  delete row.id;
  const keys = Object.keys(row);
  if (!keys.length) return;
  const assignments = keys.map(key => `\`${key}\` = ?`).join(', ');
  const [result] = await getPool().execute(`UPDATE \`${ref.collectionName}\` SET ${assignments} WHERE id = ?`, [...keys.map(key => row[key]), ref.id]);
  if ((result as any).affectedRows === 0) throw new Error(`Document not found: ${ref.collectionName}/${ref.id}`);
}

export async function deleteDoc(ref: DocRef | any) {
  if (databaseProvider === 'firestore') return fbDeleteDoc(ref.fbRef || ref);
  await getPool().execute(`DELETE FROM \`${ref.collectionName}\` WHERE id = ?`, [ref.id]);
}

export async function addDoc(collectionRef: CollectionRef | any, payload: Record<string, any>) {
  if (databaseProvider === 'firestore') return fbAddDoc(collectionRef.fbRef || collectionRef, payload);
  const id = payload.id || crypto.randomUUID();
  await setDoc({ provider: 'mysql', collectionName: collectionRef.name, id }, payload);
  return { id };
}

export function serverTimestamp() {
  return databaseProvider === 'firestore' ? fbServerTimestamp() : new Date().toISOString();
}

export async function runMysqlMigrations() {
  if (databaseProvider !== 'mysql') return;
  const migrationsDir = path.join(process.cwd(), 'database/migrations');
  const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
  const connection = await getPool().getConnection();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
      for (const statement of statements) {
        await connection.query(statement);
      }
    }
  } finally {
    connection.release();
  }
}

export async function seedAppDatabase() {
  const adminUsername = process.env.ADMIN_USERNAME || 'adminidikaltim2026';
  const plainPassword = process.env.ADMIN_PASSWORD || '1d1k4lt!m2026';

  if (adminUsername && plainPassword) {
    const adminRef = doc(db, 'admins', adminUsername);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      const salt = await bcryptHashSalt();
      const hashedPassword = await bcryptHash(plainPassword, salt);
      await setDoc(adminRef, {
        username: adminUsername,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      });
      console.log(`Admin user '${adminUsername}' seeded in ${databaseProvider}.`);
    }
  } else {
    console.warn('ADMIN_USERNAME or ADMIN_PASSWORD not found in .env. Skipping admin seeding.');
  }

  const eventsSnapshot = await getDocs(collection(db, 'events'));
  if (eventsSnapshot.empty) {
    const defaultEventId = 'muswil-initial-event';
    await setDoc(doc(db, 'events', defaultEventId), {
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
        { id: 'guest', name: 'Tamu Undangan / Eksibitor', price: 500000 },
      ],
      createdAt: new Date().toISOString(),
    });
    console.log(`Initial event seeded in ${databaseProvider}.`);
  }
}

async function bcryptHashSalt() {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.genSalt(10);
}

async function bcryptHash(value: string, salt: string) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.hash(value, salt);
}
