import { db } from './database.ts';
import { systemLogger } from './logger.ts';


/**
 * Überprüft den Authentifizierungsstatus eines JSON Web Tokens (JWT).
 * 
 * Diese Funktion prüft, ob der bereitgestellte JWT in der Sitzungstabelle der Datenbank existiert.
 * Sie protokolliert den Validierungsversuch und setzt den entsprechenden JWT für die Protokollierung.
 * 
 * @param JWT - Die zu validierende JSON Web Token-Zeichenfolge
 * @returns Ein Promise, das zu einem Boolean aufgelöst wird, der angibt, ob der JWT gültig ist
 *          (true, wenn eine entsprechende Sitzung in der Datenbank existiert, false andernfalls)
 */
export async function checkAuth(JWT: string): Promise<boolean> {
    if (!JWT) {
        await systemLogger.error('JWT ist nicht vorhanden!');
        return false;
    }
    const session = await db.selectFrom('session')
        .selectAll()
        .where('JWT', '=', JWT)
        .executeTakeFirst();
    if (!session) {
        await systemLogger.error('Sitzung nicht gefunden: ' + JWT.slice(0, 10) + '...');
        return false;
    }
    if (session.expires < Date.now()) {
        await systemLogger.error('Sitzung abgelaufen: ' + JWT.slice(0, 10) + '...');
        return false;
    }
    return true;
}

/**
 * Ein Objekt, das die numerischen Werte für verschiedene Status-Typen zuordnet.
 */
export const ResponseStatus: { [key in Status]: number } = {
    "pending": 1,
    "running": 2,
    "completed": 3,
    "failed": 4
}

/**
 * Formatiert einen Zeitstempel in ein Objekt mit Datums- und Zeitstrings.
 * 
 * @param timestamp - Der zu formatierende Zeitstempel in Millisekunden
 * @returns Ein Objekt mit zwei Eigenschaften: 'date' im Format 'YYYYMMDD' und 'time' im Format 'HH:MM:SS'
 */
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