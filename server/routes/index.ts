import express from 'express';
import { AdminController } from '../controllers/AdminController.ts';
import { EventController } from '../controllers/EventController.ts';
import { PaymentController } from '../controllers/PaymentController.ts';
import { PublicController } from '../controllers/PublicController.ts';
import { requireAdmin } from '../middleware/auth.ts';

const router = express.Router();

// Public Routes
router.get('/events', EventController.getPublicEvents);
router.get('/branches', PublicController.getBranches);
router.get('/categories', PublicController.getCategories);
router.post('/pay', PaymentController.createTransaction);
router.get('/payment-status/:orderId', PaymentController.getPaymentStatus);
router.post('/update-photo', PublicController.updatePhoto);
router.post('/webhook', PaymentController.handleWebhook);

// Admin Routes (Event Management)
router.get('/admin/events', requireAdmin, EventController.getAdminEvents);
router.post('/admin/events', requireAdmin, EventController.createEvent);
router.put('/admin/events/:id', requireAdmin, EventController.updateEvent);
router.delete('/admin/events/:id', requireAdmin, EventController.deleteEvent);

// Admin Routes (Branch Management)
router.post('/admin/branches', requireAdmin, PublicController.createBranch);
router.put('/admin/branches/:id', requireAdmin, PublicController.updateBranch);
router.delete('/admin/branches/:id', requireAdmin, PublicController.deleteBranch);

// Admin Routes (Category Management)
router.post('/admin/categories', requireAdmin, PublicController.createCategory);
router.put('/admin/categories/:id', requireAdmin, PublicController.updateCategory);
router.delete('/admin/categories/:id', requireAdmin, PublicController.deleteCategory);

// Admin Routes (Data & Operations)
router.get('/admin/registrations', requireAdmin, AdminController.getRegistrations);
router.post('/admin/check-in', requireAdmin, AdminController.checkIn);
router.post('/admin/mark-paid', requireAdmin, AdminController.markAsPaid);
router.get('/admin/guestbook', requireAdmin, AdminController.getGuestbook);

export default router;
