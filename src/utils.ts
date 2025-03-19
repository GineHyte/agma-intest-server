import { db } from './database.ts';
import { systemLogger } from './logger.ts';


/**
 * Validates the authentication status of a JSON Web Token (JWT).
 * 
 * This function checks if the provided JWT exists in the database's session table.
 * It logs the validation attempt and sets the appropriate JWT for logging.
 * 
 * @param JWT - The JSON Web Token string to validate
 * @returns A Promise that resolves to a boolean indicating whether the JWT is valid
 *          (true if a corresponding session exists in the database, false otherwise)
 */
export async function checkAuth(JWT: string): Promise<boolean> {
    await systemLogger.log('Checking JWT: ' + JWT.slice(0, 10) + '...');
    const session = await db.selectFrom('session')
        .selectAll()
        .where('JWT', '=', JWT)
        .executeTakeFirst();
    if (!session) {
        await systemLogger.error('Session not found: ' + JWT.slice(0, 10) + '...');
        return false;
    }
    if (session.expires < Date.now()) {
        await systemLogger.error('Session expired: ' + JWT.slice(0, 10) + '...');
        return false;
    }
    return true;
}

export const ResponseStatus: { [key in Status]: number } = {
    "pending": 1,
    "running": 2,
    "completed": 3,
    "failed": 4
}


export function formatTimestamp(timestamp: number): { date: string, time: string } {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return { date: `${year}${month}${day}`, time: `${hours}:${minutes}:${seconds}` };
}