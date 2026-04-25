import express from 'express';
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '../controllers/eventsController';
import { requireAdmin } from '../adminAuth';

const router = express.Router();

router.get('/', listEvents);
router.get('/:id', getEvent);
router.post('/', requireAdmin, createEvent);
router.put('/:id', requireAdmin, updateEvent);
router.delete('/:id', requireAdmin, deleteEvent);

export default router;
