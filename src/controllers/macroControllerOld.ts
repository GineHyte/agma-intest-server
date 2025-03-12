import type { Request, Response } from 'express';
import logger from '../logger.ts';
import tester from '../tester.ts';

export async function postMacro(req: Request, res: Response): Promise<void> {
    try {
        const { entries } = req.body;
        
        logger.log('Erhaltene Anfrage:', entries);
        if (!Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({ status: 400, message: 'Bad Request' });
            return;
        }
        
        await tester.setup();
        logger.startRecording(`macro-${new Date().toISOString().replace(/:/g, "-")}`);
        await tester.login();
        await tester.halten(500);
        let counter = 0;
        for (const entry of entries) {
            switch (entry.type) {
                case 'M': // maus
                    await tester.klicken(`[id=${entry.key}]`);
                    break;
                case 'T': // tippen
                    await tester.drucken(entry.key);
                    break;
                case 'P': // menuepunkt 
                    await tester.programmaufruf(entry.key);
                    break;
            }
            counter++;
        }
        await tester.logout();
        await logger.stopRecording();
        await tester.close();
        res.status(200).json({ status: 200, message: 'OK'});
    } catch (error) {
        logger.error('Fehler bei Ausführung:', error);
        await tester.logout();
        await tester.close();
        res.status(500).json({ 
            status: 500, 
            message: error instanceof Error ? error.message : 'Internal Server Error'
        });
    }
}