import express from 'express';
import { adminListRegistrations, paymentStatus, updatePhoto, checkIn, guestbook } from '../controllers/registrationsController';
import { requireAdmin } from '../adminAuth';

const router = express.Router();

router.get('/admin/registrations', requireAdmin, adminListRegistrations);
router.get('/payment-status/:orderId', paymentStatus);
router.post('/update-photo', updatePhoto);
router.post('/admin/check-in', requireAdmin, checkIn);
router.get('/admin/guestbook', requireAdmin, guestbook);

export default router;
