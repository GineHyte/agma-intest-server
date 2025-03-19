import * as readline from 'readline';
import { AsciiTable3, AlignmentEnum } from 'ascii-table3';
// @ts-expect-error
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import config from '../config.ts'

export default class Painter {
    static #instance: Painter;
    rl: readline.Interface;
    outputBuffer: string[] = [];
    currentScroll: number = 0;
    handleInput: (line: string) => void = () => { };
    handleKeyPress: (key: string) => void = () => { };
    tableMode: boolean = false;
    tableName: string = '';
    tableHeaders: string[] = [];
    tableRowsCallback: (data: any) => string[][] = () => [];
    tableWhereCallback: (db: any) => any = (db) => db;
    tableOffset: number = 0;
    tableLimit: number = 0;
    tableTotal: number = 0;
    db: Kysely<Database>;
    private inputMode: boolean = false;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '',
        });
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);

        // Handle window resize events
        process.stdout.on('resize', () => {
            this.clear();
            this.redrawScreen();
        });

        // Setup input handling
        process.stdin.on("keypress", (char, evt) => {
            if (this.inputMode) {
                return;
            }
            this.handleKeyPress(evt.name);
        });

        this.rl.on('line', (line) => {
            this.handleInput(line);
            this.rl.prompt(true);
        });

        const dialect = new SqliteDialect({
            database: new SQLite(config.databasePath),
        })

        this.db = new Kysely<Database>({
            dialect
        })

    }

    public async getUserInput(message: string) {
        process.stdin.setRawMode(false);
        this.inputMode = true;
        await new Promise<string>((resolve) => {
            this.rl.question("Press Enter to continue...", (answer: string) => {
                resolve(answer);
            });
        });
        const input = await new Promise<string>((resolve) => {
            this.rl.question(message, (answer: string) => {
                resolve(answer);
            });
        });
        process.stdin.setRawMode(true);
        this.inputMode = false;
        return input;
    }

    public static get instance(): Painter {
        if (!Painter.#instance) {
            Painter.#instance = new Painter();
        }
        return Painter.#instance;
    }

    public mvCur(x: number, y: number) {
        process.stdout.write(`\x1b[${y};${x}H`);
    }

    public clear() {
        process.stdout.write('\x1b[2J');
        process.stdout.write('\x1b[0;0H');
    }

    public print(text: string) {
        // Add to buffer instead of directly writing
        this.outputBuffer.push(text);
        this.clear();
        this.redrawScreen();
    }

    public println(text: string) {
        this.print(text + '\n');
    }

    public close() {
        this.rl.close();
    }

    public getTerminalSize(): { columns: number, rows: number } {
        return {
            columns: process.stdout.columns || 80,
            rows: process.stdout.rows || 24
        };
    }

    public moveCursorToBottom() {
        const { rows } = this.getTerminalSize();
        this.mvCur(1, rows);
    }

    public redrawScreen(offset: number = 0) {

        const { rows, columns } = this.getTerminalSize();
        const maxLines = rows - 2; // Reserve bottom line for prompt

        // Calculate which part of the buffer to show based on scroll position
        const startIndex = Math.max(offset, this.outputBuffer.length - maxLines - this.currentScroll);
        const endIndex = Math.min(this.outputBuffer.length, startIndex + maxLines);

        // Display the visible portion of the buffer
        for (let i = startIndex; i < endIndex; i++) {
            process.stdout.write(this.outputBuffer[i]);
            if (!this.outputBuffer[i].endsWith('\n')) {
                process.stdout.write('\n');
            }
        }

        // Draw separator line
        this.mvCur(1, rows - 1);
        process.stdout.write('-'.repeat(columns) + '\n');

        // Position cursor at prompt
        this.moveCursorToBottom();
        this.rl.prompt(true);
    }

    public flushBuffer() {
        this.outputBuffer = [];
    }

    public async drawTable(
        tableName: string,
        headers: string[],
        rowsCallback: (data: any) => string[][],
        offset: number = 0,
        limit: number = 0,
        whereCallback: (db: any) => any = (db) => db
    ) {
        let data = await whereCallback(this.db.selectFrom(tableName as keyof Database).selectAll()).offset(offset).limit(limit).execute();
        if (data.length === 0) {
            this.println("No data found.");
            return;
        }
        let total = await whereCallback(
            this.db.selectFrom(tableName as keyof Database).select(this.db.fn.countAll().as("count"))
        )
            .executeTakeFirstOrThrow();
        total = total.count; 
        this.tableMode = true;
        // save the table data for redrawTable with new offset
        this.tableName = tableName;
        this.tableHeaders = headers;
        this.tableRowsCallback = rowsCallback;
        this.tableWhereCallback = whereCallback;
        this.tableOffset = offset;
        this.tableLimit = limit;
        this.tableTotal = total as number;

        let table = new AsciiTable3(tableName)
            .setHeading(...headers)
            .setAlign(3, AlignmentEnum.CENTER)
            .addRowMatrix(rowsCallback(data));

        // Instead of using println which adds to buffer and redraws
        // Just write directly to stdout
        process.stdout.write(table.toString() + '\n');
        process.stdout.write(`\n<${offset + 1}/${total}>\n`);
    }

    public async redrawTable() {
        this.mvCur(1, 1);
        await this.drawTable(this.tableName, this.tableHeaders, this.tableRowsCallback, this.tableOffset, this.tableLimit, this.tableWhereCallback);
    }
}

