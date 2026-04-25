import express from 'express';
import { createTransaction } from '../controllers/payController';

const router = express.Router();

router.post('/', createTransaction);

export default router;
