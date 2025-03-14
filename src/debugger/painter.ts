import * as readline from 'readline';

export default class Painter {
    static #instance: Painter;
    rl: readline.Interface;
    outputBuffer: string[] = [];
    currentScroll: number = 0;
    handleInput: (line: string) => void = () => {};
    handleKeyPress: (key: string) => void = () => {};

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
            this.handleKeyPress(char);
        });

        this.rl.on('line', (line) => {
            this.handleInput(line);
            this.rl.prompt(true);
        });
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
}


