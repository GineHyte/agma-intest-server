import Painter from "./painter.ts";
import config from "../config.ts";
// @ts-expect-error
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
const painter = Painter.instance;

var isInMainMenu: boolean = true;


painter.handleKeyPress = async (line: string) => {
    painter.clear();
    painter.flushBuffer();
    if (line.toLowerCase() === 'w') {
        isInMainMenu = false;
        while (true) {
            if (isInMainMenu) { break; }
            var workers: any[] = [];
            try {
                workers = await db.selectFrom('worker').selectAll().execute();
            } catch (error) {
                painter.println("Error: " + (error instanceof Error ? error.message : ""));
                break;
            }
            painter.clear();
            painter.mvCur(1, 1);
            let table = new AsciiTable3('Workers')
                .setHeading('ID', 'Status', 'Action', 'Message')
                .setAlign(3, AlignmentEnum.CENTER)
                .addRowMatrix(workers.map((worker) => [worker.id, worker.status, worker.action, worker.message]));
            painter.rl.write(table.toString());
            painter.redrawScreen(7 + workers.length);

            // print line buffer
            painter.rl.write(painter.rl.line);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    if (line.toLowerCase() === 'm') {
        isInMainMenu = false;
        while (true) {
            if (isInMainMenu) { break; }
            var macros: any[] = [];
            try {
                macros = await db.selectFrom('macro').selectAll().execute();
            } catch (error) {
                painter.println("Error: " + (error instanceof Error ? error.message : ""));
                break;
            }
            painter.clear();
            painter.mvCur(1, 1);
            let table = new AsciiTable3('Macros')
                .setHeading('ID', 'UserMacroId', 'JWT', 'Result', 'Entries', 'CreatedAt', 'CompletedAt', 'String')
                .setAlign(3, AlignmentEnum.CENTER)
                .addRowMatrix(macros.map((macro) =>
                    [
                        macro.id,
                        macro.userMacroId,
                        macro.JWT.splice(0, 10),
                        macro.result,
                        macro.entries,
                        macro.createdAt,
                        macro.completedAt,
                        macro.string
                    ]
                ));
            painter.rl.write(table.toString());
            painter.redrawScreen(7 + macros.length);

            // print line buffer
            painter.rl.write(painter.rl.line);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    if (line.toLowerCase() === 'p') {
        isInMainMenu = false;
        while (true) {
            if (isInMainMenu) { break; }
            var macros: any[] = [];
            try {
                macros = await db.selectFrom('protocol').selectAll().execute();
            } catch (error) {
                painter.println("Error: " + (error instanceof Error ? error.message : ""));
                break;
            }
            painter.clear();
            painter.mvCur(1, 1);
            let table = new AsciiTable3('Protocol')
                .setHeading('ID', 'JWT', 'Timestamp', 'Message', 'Level', 'WorkerId')
                .setAlign(3, AlignmentEnum.CENTER)
                .addRowMatrix(macros.map((macro) =>
                    [macro.id, macro.JWT.splice(0, 10), macro.timestamp, macro.message, macro.level, macro.workerId]
                ));
            painter.rl.write(table.toString());
            painter.redrawScreen(7 + macros.length);

            // print line buffer
            painter.rl.write(painter.rl.line);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    if (line.toLowerCase() === 'q') {
        if (isInMainMenu) {
            painter.println("Quitting...");
            painter.close();
            process.exit(0);
        }
        isInMainMenu = true;
        painter.println("Quitting...");
        mainMenu();
    }
}



painter.clear();
painter.println("Terminal Emulator Started");
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