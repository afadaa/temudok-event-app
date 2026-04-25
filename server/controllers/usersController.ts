import { Request, Response } from 'express';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy } from '../firestoreCompat';

export async function listUsers(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const cursor = req.query.cursor as string | undefined;
    const fields = (req.query.fields as string | undefined)?.split(',').map(f => f.trim()).filter(Boolean);

    // Build base query
    let q: any = query(collection('users'), orderBy('createdAt', 'desc'));

    // TODO: firestoreCompat doesn't support select() wrapper; we will fetch full docs for now but only return requested fields
  const snapshot: any = await getDocs(q);

    // If cursor provided, do naive client-side slice (compat shim); better to refactor to admin.firestore() queries for startAfter
    let docs = snapshot.docs;
    if (cursor) {
      const idx = docs.findIndex((d: any) => d.id === cursor);
      if (idx >= 0) docs = docs.slice(idx + 1);
    }

    const sliced = docs.slice(0, limit);

    const users = sliced.map((d: any) => {
      const data = d.data();
      const out: any = { id: d.id };
      if (fields && fields.length) {
        for (const f of fields) if (data[f] !== undefined) out[f] = data[f];
      } else {
        Object.assign(out, data);
      }
      return out;
    });

    const nextCursor = sliced.length ? sliced[sliced.length - 1].id : null;
    res.json({ data: users, nextCursor });
  } catch (error) {
    console.error('List Users Error:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar pengguna' });
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    const payload = req.body;
    // Minimal validation: ensure required fields exist
    if (!payload.email || !payload.fullName) return res.status(400).json({ error: 'email dan fullName wajib diisi' });
    const colRef = collection('users');
    const result: any = await addDoc(colRef, { ...payload, createdAt: new Date().toISOString() });
    res.status(201).json({ id: result.id, ...payload });
  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({ error: 'Gagal membuat pengguna' });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const payload = req.body;
    const docRef = doc('users', id);
    const docSnap: any = await getDoc(docRef);
    if (!docSnap.exists()) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    await updateDoc(docRef, { ...payload, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ error: 'Gagal memperbarui pengguna' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const id = req.params.id;
    const docRef = doc('users', id);
    const docSnap: any = await getDoc(docRef);
    if (!docSnap.exists()) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    await deleteDoc(docRef);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ error: 'Gagal menghapus pengguna' });
  }
}
