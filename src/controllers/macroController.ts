import type { Request, Response } from 'express';
import Logger, { systemLogger } from '../logger.ts';
import { checkAuth, formatTimestamp } from '../utils.ts';
import TestMaster from '../tester/master.ts';
import { db } from '../database.ts';
import { ResponseStatus } from '../utils.ts';


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

        const { entries, string, screencastFlag, screencastPath, logFlag, logPath } = req.body;
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
            string: string,
            screencastFlag,
            screencastPath,
            logFlag,
            logPath,
        }).execute();

        await TestMaster.instance.pushTask({
            action: 'test',
            entries,
            JWT,
            screencastFlag,
            screencastPath,
            logFlag,
            logPath,
            userMacroId: MACROID
        });
        await TestMaster.instance.pushTask({ action: 'endtest', JWT, userMacroId: MACROID });

        res.status(200).json({ status: 200, message: 'OK' });
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
        await logger.log('Erhaltene Get Macro Anfrage:', MACROID);
        if (!MACROID) {
            res.status(400).json({ status: 400, message: 'MACROID ist nicht vorhandelt!' });
            return;
        }

        const macro = await db.selectFrom('macro')
            .select(['resultMessage', "status", "startedAt", "completedAt"])
            .where("JWT", "==", JWT)
            .where("userMacroId", "==", MACROID)
            .executeTakeFirst();
        if (macro === undefined || !macro.status) {
            res.status(404).json({ status: 404, message: 'MACROID ist nicht vorhandelt!' });
            return;
        }
        let response: any = {
            status: 200,
            message: macro.resultMessage,
            testStatus: ResponseStatus[macro.status]
        }
        if (macro.startedAt) {
            let startedAt = formatTimestamp(macro.startedAt);
            response.startedAtDate = startedAt.date;
            response.startedAtTime = startedAt.time;
        }
        if (macro.completedAt) {
            let completedAt = formatTimestamp(macro.completedAt);
            response.completedAtDate = completedAt.date;
            response.completedAtTime = completedAt.time;
        }

        res.status(200).json(response);
    } catch (error) {
        await systemLogger.error('Fehler bei Ausführung:', error);
        res.status(500).json({
            status: 500,
            message: error instanceof Error ? error.message : 'Internal Server Error'
        });
    }
}