import express from 'express';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/usersController';
import { requireAdmin } from '../adminAuth';

const router = express.Router();
router.get('/', listUsers);
router.post('/', requireAdmin, createUser);
router.put('/:id', requireAdmin, updateUser);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
