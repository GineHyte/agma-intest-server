
import type { Request, Response } from 'express';
import logger from '../logger.ts';
import config from '../config.ts';
import jwt from 'jsonwebtoken';
import { db } from '../database.ts';

/**
 * Handles authentication by creating a JWT token for a client session.
 * 
 * @param req - Express request object containing authentication parameters
 * @param res - Express response object to send the result
 * @returns A Promise that resolves when the authentication process is complete
 * 
 * @remarks
 * This function expects the following URL parameters:
 * - YSYS: System identifier string
 * - YJBN: Job number as integer
 * - YB: Batch identifier string
 * - YM: Module identifier string
 * 
 * The function performs the following steps:
 * 1. Validates that all required parameters are present
 * 2. Creates a JWT token with the parameters
 * 3. Checks if a session with this token already exists
 * 4. Creates a new session in the database if it doesn't exist
 * 
 * @throws Returns 400 status if any required parameter is missing
 * @throws Returns 429 status if a session with the same token already exists
 * @throws Returns 500 status if any other error occurs during execution
 */
export async function getAuth(req: Request, res: Response): Promise<void> {
    await logger.setJWT('system'); // Set JWT for system
    try {
        let YSYS: string = req.params.YSYS as string;
        let YJBN: number = parseInt(req.params.YJBN as string);
        let YB: string = req.params.YB as string;
        let YM: string = req.params.YM as string;

        if (!YSYS || !YJBN || !YB || !YM) {
            logger.error('Bad Request');
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
            logger.error('Too many requests');
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

        await logger.setJWT(token); // Set JWT for new session
        logger.log('New session created: YSYS: ' + YSYS + ', YJBN: ' + YJBN + ', YB: ' + YB + ', YM: ' + YM);

        res.status(200).json({
            status: 200,
            token: token
        });

    } catch (error) {
        let message = error instanceof Error ? error.message : 'Internal Server Error'
        logger.error('Error during execution: ' + message);
        res.status(500).json({
            status: 500,
            message: message
        });
    }
}