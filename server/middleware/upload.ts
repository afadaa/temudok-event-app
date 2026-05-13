import fs from 'fs';
import path from 'path';
import multer from 'multer';

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename(req, file, cb) {
    const rawOrderId = req.params?.orderId || req.body.orderId || req.body.order_id || 'unknown';
    const safeOrderId = String(rawOrderId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = file.fieldname === 'photo' ? 'participant' : 'payment';
    cb(null, `${prefix}-${safeOrderId}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});
