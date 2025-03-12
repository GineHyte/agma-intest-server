import express from 'express';
import {
    postMacro
} from '../controllers/macroController.ts';

const router = express.Router();

router.post('/', postMacro);


export default router;