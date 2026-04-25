import express from 'express';
import { handleWebhook } from '../controllers/webhookController';

const router = express.Router();

// Use express.raw at route-level in server.ts; here we expect raw body forwarded
router.post('/', handleWebhook);

export default router;
