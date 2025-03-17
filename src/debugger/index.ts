import Painter from "./painter.ts";
import config from "../config.ts";
// @ts-expect-error
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

const painter = Painter.instance;

const PAGE_SIZE = 40;
const UPDATE_INTERVAL = 500;

var isInMainMenu: boolean = true;


painter.handleKeyPress = async (line: string) => {
    painter.clear();
    painter.flushBuffer();
    if (line === 'w') {
        isInMainMenu = false;
        await painter.drawTable(
            'worker',
            ['ID', 'Status', 'Action', 'Message'],
            (data: any) => {
                return data.map((worker: any) => [
                    worker.id,
                    worker.status,
                    worker.action,
                    worker.message
                ])
            },
            0, PAGE_SIZE
        );
        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
    if (line === 'm') {
        isInMainMenu = false;
        await painter.drawTable(
            'macro',
            ['ID', 'UserMacroId', 'JWT', 'Result Message', 'Success?', 'Entries Lenght', 'CreatedAt', 'CompletedAt', 'String'],
            (data: any) => {
                return data.map((macro: any) => [
                    macro.id,
                    macro.userMacroId,
                    macro.JWT ? macro.JWT.slice(0, 10) : "",
                    macro.resultMessage,
                    macro.success,
                    macro.entries.length,
                    macro.createdAt,
                    macro.completedAt,
                    macro.string
                ])
            }, 0, PAGE_SIZE
        );
        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
    if (line === 'p') {
        isInMainMenu = false;
        await painter.drawTable(
            'protocol',
            ['ID', 'JWT', 'Timestamp', 'Message', 'Level', 'WorkerId'],
            (data: any) => {
                return data.map((protocol: any) => [
                    protocol.id,
                    protocol.JWT.slice(0, 10),
                    protocol.timestamp,
                    protocol.message,
                    protocol.level,
                    protocol.workerId
                ])
            },
            0, PAGE_SIZE
        );

        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
    if (line === 'q') {
        if (isInMainMenu) {
            painter.println("Quitting...");
            painter.close();
            process.exit(0);
        }
        painter.tableMode = false;
        isInMainMenu = true;
        painter.println("Quitting...");
        mainMenu();
    }
    if (painter.tableMode) {
        if (line === 'left') {
            painter.tableOffset = painter.tableOffset - painter.tableLimit < 0 ? 0 : painter.tableOffset - painter.tableLimit;
        }
        if (line === 'right') {
            if (painter.tableOffset + PAGE_SIZE < painter.tableTotal) {
                painter.tableOffset += PAGE_SIZE;
            }
        }
        painter.redrawTable();
    }
}



painter.clear();
painter.println("Agmadata Intergration Tests Debugger");
painter.println("Connecting to sqlitedb...");

const dialect = new SqliteDialect({
    database: new SQLite(config.databasePath),
})

// Pass the Database interface as a type parameter
const db = new Kysely<Database>({
    dialect
})
painter.println("Connected to sqlitedb.");

function mainMenu() {
    painter.println("======================");
    painter.println("Commands:");
    painter.println("(W)orkers");
    painter.println("(M)acros");
    painter.println("(P)rotocol");
    painter.println("(Q)uit");
    painter.println("======================");
}

mainMenu();