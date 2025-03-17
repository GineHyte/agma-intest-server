import express from 'express';
import {
    postMacro,
    getMacro
} from '../controllers/macroController.ts';

const router = express.Router();

router.post('/:MACROID', postMacro);
router.get('/:MACROID', getMacro);


export default router;