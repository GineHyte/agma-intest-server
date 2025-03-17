import type { Request, Response } from 'express';
import Logger, { systemLogger } from '../logger.ts';
import { checkAuth } from '../utils.ts';
import TestMaster from '../tester/master.ts';
import { db } from '../database.ts';


export async function postMacro(req: Request, res: Response): Promise<void> {
    try {
        if (!req.headers.authorization) {
            res.status(401).json({ status: 401, message: 'Unauthorized' });
            return;
        }
        let JWT = req.headers.authorization.split(' ')[1];
        let logger = new Logger();
        if (await checkAuth(JWT)) {
            await logger.setJWT(JWT);
        } else {
            res.status(401).json({ status: 401, message: 'Unauthorized' });
            return;
        }
        
        const { entries, string } = req.body;
        const { MACROID } = req.params;
        if (!Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({ status: 400, message: 'Es soll mehr als 0 entries in body eingeben werden!' });
            return;
        }
        if (!MACROID) {
            res.status(400).json({ status: 400, message: 'MACROID ist nicht vorhandelt!' });
            return;
        }

        await db.insertInto('macro').values({
            userMacroId: MACROID,
            JWT,
            entries: JSON.stringify(entries),
            createdAt: Date.now(),
            string: string
        }).execute();

        TestMaster.instance.pushTask({ action: 'test', entries, JWT, userMacroId: MACROID });
        
        res.status(200).json({ status: 200, message: 'OK'});
    } catch (error) {
        await systemLogger.error('Fehler bei Ausführung:', error);
        res.status(500).json({ 
            status: 500, 
            message: error instanceof Error ? error.message : 'Internal Server Error'
        });
    }
}

export async function getMacro(req: Request, res: Response): Promise<void> {
    try {
        if (!req.headers.authorization) {
            res.status(401).json({ status: 401, message: 'Unauthorized' });
            return;
        }
        let JWT = req.headers.authorization.split(' ')[1];
        let logger = new Logger();
        if (await checkAuth(JWT)) {
            await logger.setJWT(JWT);
        } else {
            res.status(401).json({ status: 401, message: 'Unauthorized' });
            return;
        }

        const { MACROID } = req.params;
        await logger.log('Erhaltene Anfrage:', MACROID);
        if (!MACROID) {
            res.status(400).json({ status: 400, message: 'MACROID ist nicht vorhandelt!' });
            return;
        }

        const macro = await db.selectFrom('macro')
            .select(['resultMessage', "success"])
            .where("JWT", "==", JWT)
            .where("userMacroId", "==", MACROID)
            .executeTakeFirst();
        if (macro === undefined) {
            res.status(404).json({ status: 404, message: 'MACROID ist nicht vorhandelt!' });
            return;
        }
        res.status(200).json({ status: 200, message: macro.resultMessage, success: macro.success });
    } catch (error) {
        await systemLogger.error('Fehler bei Ausführung:', error);
        res.status(500).json({ 
            status: 500, 
            message: error instanceof Error ? error.message : 'Internal Server Error'
        });
    }
}