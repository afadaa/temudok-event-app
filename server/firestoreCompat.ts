import { adminDb } from './firebaseAdmin';
import admin from 'firebase-admin';

const db = () => adminDb();

// collection can be called as collection('name') or collection(db, 'name')
export const collection = (a: any, b?: string) => {
  const path = typeof a === 'string' ? a : b;
  return db().collection(path);
};

// doc can be called as doc('collection', 'id') or doc(db, 'collection', 'id')
export const doc = (a: any, b?: string, c?: string) => {
  if (typeof a === 'string' && typeof b === 'string') return db().collection(a).doc(b);
  if (typeof a !== 'string' && typeof b === 'string' && typeof c === 'string') return db().collection(b).doc(c);
  if (typeof a === 'string' && !b) return db().doc(a);
  throw new Error('Unsupported doc() signature');
};

export const setDoc = async (ref: any, data: any) => {
  if (typeof ref === 'string') return db().doc(ref).set(data);
  return ref.set(data);
};

export const updateDoc = async (ref: any, data: any) => ref.update(data);
export const getDoc = async (ref: any) => ref.get();
export const deleteDoc = async (ref: any) => ref.delete();
export const addDoc = async (colRef: any, data: any) => colRef.add(data);
export const getDocs = async (queryRef: any) => queryRef.get();

// Query helpers: where() and orderBy() produce constraint descriptors consumed by query()
export const where = (field: string, op: any, value: any) => ({ type: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ type: 'orderBy', field, dir });

export const query = (collectionRef: admin.firestore.CollectionReference | any, ...constraints: any[]) => {
  let q: admin.firestore.Query = collectionRef as any;
  for (const c of constraints) {
    if (!c) continue;
    if (c.type === 'where') q = q.where(c.field, c.op as any, c.value);
    if (c.type === 'orderBy') q = q.orderBy(c.field, c.dir);
  }
  return q;
};

export const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

// Note: this compatibility layer aims to minimize changes but it's better to refactor to explicit admin.firestore() calls.
