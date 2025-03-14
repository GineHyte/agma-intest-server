
import type { Request, Response } from 'express';
import Logger, { systemLogger } from '../logger.ts';
import config from '../config.ts';
import jwt from 'jsonwebtoken';
import { db } from '../database.ts';


/**
 * Verarbeitet die Authentifizierung durch Erstellung eines JWT-Tokens für eine Client-Sitzung.
 * 
 * @param req - Express-Anfrageobjekt mit Authentifizierungsparametern
 * @param res - Express-Antwortobjekt zum Senden des Ergebnisses
 * @returns Ein Promise, das aufgelöst wird, wenn der Authentifizierungsprozess abgeschlossen ist
 * 
 * @remarks
 * Diese Funktion erwartet folgende URL-Parameter:
 * - YSYS: System-Identifikationsstring
 * - YJBN: Jobnummer 
 * - YB: Bediener
 * - YM: Mandant
 * 
 * Die Funktion führt folgende Schritte aus:
 * 1. Überprüft, ob alle erforderlichen Parameter vorhanden sind
 * 2. Erstellt ein JWT-Token mit den Parametern
 * 3. Prüft, ob bereits eine Sitzung mit diesem Token existiert
 * 4. Erstellt eine neue Sitzung in der Datenbank, falls keine existiert
 * 
 * @throws Gibt Status 400 zurück, wenn ein erforderlicher Parameter fehlt
 * @throws Gibt Status 429 zurück, wenn bereits eine Sitzung mit demselben Token existiert
 * @throws Gibt Status 500 zurück, wenn während der Ausführung ein anderer Fehler auftritt
 */
export async function getAuth(req: Request, res: Response): Promise<void> {
    await systemLogger.log('Authenticating...');
    try {
        let YSYS: string = req.params.YSYS as string;
        let YJBN: number = parseInt(req.params.YJBN as string);
        let YB: string = req.params.YB as string;
        let YM: string = req.params.YM as string;

        if (!YSYS || !YJBN || !YB || !YM) {
            await systemLogger.error('Bad Request');
            res.status(400).json({
                status: 400,
                message: `${YSYS ? '' : 'YSYS '}${YJBN ? '' : 'YJBN '}${YB ? '' : 'YB '}${YM ? '' : 'YM '}is missing`
            });
            return;
        }
        const token = jwt.sign({
            YSYS: YSYS,
            YJBN: YJBN,
            YB: YB,
            YM: YM
        }, config.jwtSecret, { expiresIn: config.jwtExpires });

        // check if session already exists
        const session = await db.selectFrom('session')
            .select('JWT')
            .where('JWT', '=', token)
            .executeTakeFirst();
        if (session) {
            await systemLogger.error('Too many requests');
            res.status(429).json({
                status: 429,
                message: 'Too many requests'
            });
            return;
        }

        // create new session in database
        await db.insertInto('session')
            .values({
                JWT: token,
                YSYS: YSYS,
                YJBN: YJBN,
                YB: YB,
                YM: YM,
                expires: Date.now() + config.jwtExpires
            }).execute();

        let logger = new Logger();
        await logger.setJWT(token);
        await logger.log('New session created: YSYS: ' + YSYS + ', YJBN: ' + YJBN + ', YB: ' + YB + ', YM: ' + YM);

        res.status(200).json({
            status: 200,
            token: token
        });

    } catch (error) {
        let message = error instanceof Error ? error.message : 'Internal Server Error'
        await systemLogger.error('Error during execution: ' + message);
        res.status(500).json({
            status: 500,
            message: message
        });
    }
}