import Painter from "./painter.ts";
import config from "../config.ts";
// @ts-expect-error
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

const painter = Painter.instance;


painter.handleInput = async (line: string) => {
    if (line.toLowerCase() === 'e') {
        painter.println("Eximine Workers");
        while (true) {
            const workers = await db.selectFrom('worker').selectAll().execute();
            painter.clear();
            painter.mvCur(1, 1);
            painter.rl.write("Worker ID - Status - Action");
            painter.mvCur(1, 2);
            for (const worker of workers) {
                painter.rl.write(`Worker ${worker.id} - ${worker.status} - ${worker.action} \n`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
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

painter.println("======================");
painter.println("Commands:");
painter.println("(E)ximine - eximine workers");

// The prompt will automatically be shown at the bottom
