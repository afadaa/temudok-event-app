import express from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoriesController';
import { requireAdmin } from '../adminAuth';

const router = express.Router();
router.get('/', listCategories);
router.post('/', requireAdmin, createCategory);
router.put('/:id', requireAdmin, updateCategory);
router.delete('/:id', requireAdmin, deleteCategory);

export default router;
