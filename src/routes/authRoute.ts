import express from 'express';
import {
    getAuth
} from '../controllers/authController.ts';

const router = express.Router();

router.get('/:YSYS/:YJBN/:YB/:YM', getAuth);


export default router;