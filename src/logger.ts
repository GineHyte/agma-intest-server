import fs from "fs";
import path from "path";
import { db } from "./database.ts";
import config from "./config.ts";


/**
 * Logger class for handling application logging with database integration.
 * Supports different log levels and stores logs with associated JWT tokens.
 */
export default class Logger {
    /** JWT token for the current session or "system" for system-level logs */
    private JWT?: string | "system";
    /** Worker ID associated with the current logger session */
    workerId?: number;
    logFlag: boolean = config.defaultLogFlag;
    logPath: string = config.defaultLogPath;
    logLastName: string | undefined;

    /**
     * Formats a message and its optional parameters into a single string
     * @param message - The primary message to format
     * @param optionalParams - Additional parameters to include in the formatted message
     * @returns Formatted message string
     * @private
     */
    private formatMessage(message: any, optionalParams: any[]): string {
        const msgStr = message === undefined || message === null ? '' : String(message);
        const paramsStr = optionalParams.map(param =>
            param === undefined || param === null ? '' : String(param)
        ).join(' ');

        return msgStr + (paramsStr ? ' ' + paramsStr : '');
    }

    /**
     * Stores a log message in the database
     * @param JWT - The JWT token associated with the log entry
     * @param message - The formatted log message
     * @param level - Log level: 'info', 'warn', or 'error'
     * @returns Promise that resolves when the database operation is complete
     * @private
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
     * Exports all log entries from the database to a JSON file
     * @returns Promise that resolves when the file write operation is complete
     */
    async dumpProtocolToFile(name: string): Promise<void> {
        if (!this.logFlag) { return }
        const protocol = await db.selectFrom('protocol').execute();

        // Create directory if it doesn't exist
        const directory = path.dirname(this.logPath);
        if (!fs.existsSync(directory) && directory !== '') {
            fs.mkdirSync(directory, { recursive: true });
        }
        this.logLastName = name;
        fs.writeFileSync(this.logPath + name + ".txt", JSON.stringify(protocol, null, 2));
    }

    /**
     * Logs an error message to the console and database
     * @param message - The primary error message to log
     * @param optionalParams - Additional parameters to include in the log message
     * @returns Promise that resolves when the log operation is complete
     */
    async error(message?: any, ...optionalParams: any[]): Promise<void> {
        const actualMessage: string = this.formatMessage(message, optionalParams);
        let prefix = '[ERROR';
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log(prefix + '] ' + actualMessage);
        await this.pushToDatabase(actualMessage, 'error');
    }

    /**
     * Logs an informational message to the console and database
     * @param message - The primary message to log
     * @param optionalParams - Additional parameters to include in the log message
     * @returns Promise that resolves when the log operation is complete
     */
    async log(message?: any, ...optionalParams: any[]): Promise<void> {
        const actualMessage: string = this.formatMessage(message, optionalParams);
        let prefix = '[INFO';
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log(prefix + '] ' + actualMessage);
        await this.pushToDatabase(actualMessage, 'info');
    }

    /**
     * Sets the JWT token for the current logger session after validating it against the database
     * @param JWT - The JWT token string or "system" for system logs
     * @returns Promise resolving to true if JWT is valid, false otherwise
     */
    async setJWT(JWT: string | "system"): Promise<boolean> {
        const result = await db
            .selectFrom('session')
            .selectAll()
            .where('JWT', '=', JWT)
            .executeTakeFirst();

        if (!result) {
            this.error('JWT not found in database:', JWT);
            return false;
        }
        this.JWT = JWT;
        return true;
    }

    /**
     * Logs a warning message to the console and database
     * @param message - The primary warning message to log
     * @param optionalParams - Additional parameters to include in the log message
     * @returns Promise that resolves when the log operation is complete
     */
    async warn(message?: any, ...optionalParams: any[]): Promise<void> {
        const actualMessage: string = this.formatMessage(message, optionalParams);
        let prefix = '[WARN';
        if (this.JWT !== undefined) {
            prefix += ' | ' + this.JWT.slice(0, 8);
        }
        if (this.workerId !== undefined) {
            prefix += ' | Worker ' + this.workerId;
        }

        console.log(prefix + '] ' + actualMessage);
        await this.pushToDatabase(actualMessage, 'warn');
    }
}

/**
 * Global system logger instance for application-wide logging
 */
export const systemLogger = new Logger();

/**
 * Initializes the system logger with the "system" JWT
 * @returns Promise that resolves when the system logger is initialized
 */
export async function initSystemLogger(): Promise<void> {
    await systemLogger.setJWT('system');
    await systemLogger.log('Logger initialized');
};