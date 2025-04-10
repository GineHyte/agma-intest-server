import fs from "fs";
import path from "path";
import { db } from "./database.ts";
import config from "./config.ts";
import { formatTimestamp } from "./utils.ts";

/**
 * Logger-Klasse zur Verwaltung von Anwendungsprotokollen mit Datenbankintegration.
 * Unterstützt verschiedene Protokollebenen und speichert Logs mit zugehörigen JWT-Tokens.
 * 
 * @class
 * @description Eine Klasse zur Verwaltung von Anwendungsprotokollen mit Datenbankintegration.
 * Unterstützt verschiedene Protokollebenen und speichert Logs mit zugehörigen JWT-Tokens.
 */
export default class Logger {
    /**
     * JWT-Token für die aktuelle Sitzung oder "system" für Systemprotokolle
     * @private
     * @type {string | "system" | undefined}
     * @description JWT-Token für die aktuelle Sitzung oder "system" für Systemprotokolle
     */
    private JWT?: string | "system";

    /**
     * Arbeiter-ID, die mit der aktuellen Logger-Sitzung verknüpft ist
     * @type {number | undefined}
     * @description Arbeiter-ID, die mit der aktuellen Logger-Sitzung verknüpft ist
     */
    workerId?: number;

    /**
     * Flag zum Aktivieren oder Deaktivieren der Protokollierungsfunktion
     * @type {boolean}
     * @description Flag zum Aktivieren oder Deaktivieren der Protokollierungsfunktion
     */
    logFlag: boolean = config.defaultLogFlag;

    /**
     * Pfad, in dem Protokolldateien gespeichert werden
     * @type {string}
     * @description Pfad, in dem Protokolldateien gespeichert werden
     */
    logPath: string = config.defaultLogPath;

    /**
     * Name der zuletzt erstellten Protokolldatei
     * @type {string | undefined}
     * @description Name der zuletzt erstellten Protokolldatei
     */
    logLastName: string | undefined;

    /**
     * Formatiert eine Nachricht und ihre optionalen Parameter zu einem einzigen String
     * @param message - Die primäre Nachricht zum Formatieren
     * @param optionalParams - Zusätzliche Parameter, die in die formatierte Nachricht aufgenommen werden sollen
     * @returns Formatierte Nachrichtenzeichenkette
     * @private
     * @description Formatiert eine Nachricht und ihre optionalen Parameter zu einem einzigen String
     */
    private formatMessage(message: any, optionalParams: any[]): string {
        const msgStr = message === undefined || message === null ? '' : String(message);
        const paramsStr = optionalParams.map(param =>
            param === undefined || param === null ? '' : String(param)
        ).join(' ');

        return msgStr + (paramsStr ? ' ' + paramsStr : '');
    }

    /**
     * Speichert eine Protokollnachricht in der Datenbank
     * @param message - Die formatierte Protokollnachricht
     * @param level - Protokollebene: 'info', 'warn' oder 'error'
     * @returns Promise, das aufgelöst wird, wenn der Datenbankvorgang abgeschlossen ist
     * @private
     * @description Speichert eine Protokollnachricht in der Datenbank
     */
    private async pushToDatabase(message: string, level: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
        if (!this.logFlag) { return }
        if (this.JWT !== undefined) {
            await db.insertInto('protocol')
                .values({ JWT: this.JWT, message: message, level: level, timestamp: Date.now(), workerId: this.workerId })
                .execute();
        }
    }

    /**
 * Speichert eine Protokollnachricht in der Datei
 * @param message - Die formatierte Protokollnachricht
 * @param level - Protokollebene: 'info', 'warn' oder 'error'
 * @returns Promise, das aufgelöst wird, wenn der Datenbankvorgang abgeschlossen ist
 * @private
 * @description Speichert eine Protokollnachricht in der Datei
 */
    private async pushToFile(message: string, level: 'info' | 'warn' | 'error' = 'info'): Promise<void> {
        if (!this.logFlag) { return }
        // Verzeichnis erstellen, wenn es nicht existiert
        const directory = path.dirname(this.logPath);
        if (!fs.existsSync(directory) && directory !== '') {
            fs.mkdirSync(directory, { recursive: true });
        }
        let datetime = formatTimestamp(Date.now());
        let sRecord = `[${datetime.date}|${datetime.time}|${level.toUpperCase()}|`;
        sRecord += `${this.workerId !== undefined ? 'W ' + this.workerId : 'system'}`
        if (this.JWT !== undefined) {
            let userData = await db
                .selectFrom('session')
                .selectAll()
                .where('JWT', '=', this.JWT)
                .executeTakeFirstOrThrow();
            sRecord += `|${userData.YJBN}|${userData.YSYS}|${userData.YB}`;
        }
        sRecord += `] ${message}\n`;

        fs.appendFileSync(this.logPath + "logs.txt", sRecord);
    }

    /**
     * Exportiert alle Protokolleinträge aus der Datenbank in eine JSON-Datei
     * @param name - Der Name für die Protokolldatei
     * @returns Promise, das aufgelöst wird, wenn der Dateischreibvorgang abgeschlossen ist
     * @description Exportiert alle Protokolleinträge aus der Datenbank in eine Textdatei
     */
    async dumpProtocolToFile(name: string): Promise<void> {
        const protocol = await db.selectFrom('protocol').selectAll().execute();
        // Protokolleinträge aus der Datenbank löschen für dieses JWT und workerId nach dem Abrufen
        if (this.JWT !== undefined) {
            await db.deleteFrom('protocol')
                .where('JWT', '=', this.JWT)
                .execute();
        }
        // Verzeichnis erstellen, wenn es nicht existiert
        const directory = path.dirname(this.logPath);
        if (!fs.existsSync(directory) && directory !== '') {
            fs.mkdirSync(directory, { recursive: true });
        }
        this.logLastName = name;
        for (let record of protocol) {
            let datetime = formatTimestamp(record.timestamp);
            let userData = await db
                .selectFrom('session')
                .selectAll()
                .where('JWT', '=', record.JWT)
                .executeTakeFirstOrThrow();

            let sRecord = `[${datetime.date}|${datetime.time}|${record.level.toUpperCase()}|`;
            sRecord += `${record.workerId !== undefined ? 'W ' + record.workerId : 'system'}|`
            sRecord += `${userData.YJBN}|${userData.YSYS}|${userData.YB}`;
            sRecord += ` ${record.message}\n`;
            fs.appendFileSync(this.logPath + name + ".txt", sRecord);
        }
    }

    /**
     * Protokolliert eine Fehlermeldung in der Konsole und Datenbank
     * @param message - Die primäre Fehlermeldung zum Protokollieren
     * @param optionalParams - Zusätzliche Parameter, die in die Protokollnachricht aufgenommen werden sollen
     * @returns Promise, das aufgelöst wird, wenn der Protokollierungsvorgang abgeschlossen ist
     * @description Protokolliert eine Fehlermeldung in der Konsole und Datenbank
     */
    async error(message?: any, ...optionalParams: any[]): Promise<void> {
        // Fehlerbehandlung: Rot gefärbte Konsolenausgabe
        const actualMessage: string = this.formatMessage(message, optionalParams);
        let prefix = '[ERROR';
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log("\x1b[1;31m" + prefix + '] ' + actualMessage + '\x1b[0m');
        await this.pushToFile(actualMessage, 'error');
    }

    /**
     * Protokolliert eine Informationsmeldung in der Konsole und Datenbank
     * @param message - Die primäre Nachricht zum Protokollieren
     * @param optionalParams - Zusätzliche Parameter, die in die Protokollnachricht aufgenommen werden sollen
     * @returns Promise, das aufgelöst wird, wenn der Protokollierungsvorgang abgeschlossen ist
     * @description Protokolliert eine Informationsmeldung in der Konsole und Datenbank
     */
    async log(message?: any, ...optionalParams: any[]): Promise<void> {
        // Standardprotokollierung: Normale Konsolenausgabe
        const actualMessage: string = this.formatMessage(message, optionalParams)
        let prefix = '[INFO';
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log("\x1b[0m" + prefix + '] ' + actualMessage);
        await this.pushToFile(actualMessage, 'info');
    }

    /**
     * Setzt das JWT-Token für die aktuelle Logger-Sitzung nach Überprüfung in der Datenbank
     * @param JWT - Der JWT-Token-String oder "system" für Systemprotokolle
     * @returns Promise, das zu true aufgelöst wird, wenn JWT gültig ist, sonst zu false
     * @description Setzt das JWT-Token für die aktuelle Logger-Sitzung nach Überprüfung in der Datenbank
     */
    async setJWT(JWT: string | "system"): Promise<boolean> {
        // JWT-Validierung gegen die Datenbank
        const result = await db
            .selectFrom('session')
            .selectAll()
            .where('JWT', '=', JWT)
            .executeTakeFirst();

        if (!result) {
            this.error('JWT nicht in der Datenbank gefunden:', JWT);
            return false;
        }
        this.JWT = JWT;
        return true;
    }

    /**
     * Protokolliert eine Warnmeldung in der Konsole und Datenbank
     * @param message - Die primäre Warnmeldung zum Protokollieren
     * @param optionalParams - Zusätzliche Parameter, die in die Protokollnachricht aufgenommen werden sollen
     * @returns Promise, das aufgelöst wird, wenn der Protokollierungsvorgang abgeschlossen ist
     * @description Protokolliert eine Warnmeldung in der Konsole und Datenbank
     */
    async warn(message?: any, ...optionalParams: any[]): Promise<void> {
        // Warnungsprotokollierung: Gelb gefärbte Konsolenausgabe
        const actualMessage: string = this.formatMessage(message, optionalParams);
        let prefix = '[WARN';
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log("\x1b[1;33m" + prefix + '] ' + actualMessage + '\x1b[0m');
        await this.pushToFile(actualMessage, 'warn');
    }

    /**
     * Protokolliert eine Debug-Nachricht in der Konsole
     * @param message - Die primäre Debug-Nachricht zum Protokollieren
     * @param optionalParams - Zusätzliche Parameter, die in die Protokollnachricht aufgenommen werden sollen
     * @returns Promise, das aufgelöst wird, wenn der Protokollierungsvorgang abgeschlossen ist
     * @description Protokolliert eine Debug-Nachricht in der Konsole (nur Konsole, nicht Datenbank)
     */
    async debug(message?: any, ...optionalParams: any[]): Promise<void> {
        // Debug-Ausgabe: Nur für Entwicklungszwecke
        const actualMessage: string = this.formatMessage(message, optionalParams);
        let prefix = '[DEBUG';  // Für hellen weißen Text
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log("\x1b[0;97;44m" + prefix + '] ' + actualMessage + '\x1b[0m');
    }
}

/**
 * Globale Systemlogger-Instanz für die anwendungsweite Protokollierung
 * @type {Logger}
 * @description Globale Instanz des Systemloggers für die anwendungsweite Protokollierung
 */
export const systemLogger = new Logger();

/**
 * Initialisiert den Systemlogger mit dem "system" JWT
 * @returns Promise, das aufgelöst wird, wenn der Systemlogger initialisiert ist
 * @description Initialisiert den Systemlogger mit dem "system" JWT-Token
 */
export async function initSystemLogger(): Promise<void> {
    // Systemlogger wird initialisiert
    await systemLogger.setJWT('system');
    await systemLogger.log('Logger initialisiert');
};