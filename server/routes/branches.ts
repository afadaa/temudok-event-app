import express from 'express';
import { listBranches, createBranch, updateBranch, deleteBranch } from '../controllers/branchesController';
import { requireAdmin } from '../adminAuth';

const router = express.Router();
router.get('/', listBranches);
router.post('/', requireAdmin, createBranch);
router.put('/:id', requireAdmin, updateBranch);
router.delete('/:id', requireAdmin, deleteBranch);

export default router;
