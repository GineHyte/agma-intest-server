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
    await systemLogger.log('Checking JWT: ' + JWT);
    const session = await db.selectFrom('session')
        .selectAll()
        .where('JWT', '=', JWT)
        .executeTakeFirst();
    if (!session) { return false; }
    if (session.expires < Date.now()) {
        await systemLogger.error('Session expired: ' + JWT);
        return false;
    }
    return true;
}