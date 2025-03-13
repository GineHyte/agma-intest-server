import { default as nodemonDefault } from 'nodemon';
import { fork, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Handle ESM vs CommonJS nodemon import inconsistency
const nodemon = nodemonDefault as any;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let childProcess: ChildProcess | null = null;

// Start the app in a child process
function startApp() {
    if (childProcess) {
        try {
            childProcess.kill();
        } catch (err) {
            console.error('Error killing child process:', err);
        }
    }

    try {
        childProcess = fork('./src/index.ts', [], {});

        console.log(`App started with PID: ${childProcess.pid}`);
    } catch (err) {
        console.error('Error starting child process:', err);
    }
}

// Initialize nodemon
nodemon({
    script: './src/index.ts',
    ext: 'ts',
    watch: ['./src/'],
    exec: 'echo "Changes detected"', // Just a placeholder
    ignore: ['./src/watcher.ts'] // Don't watch the watcher itself
});

// Start the app initially
startApp();

// Listen for nodemon restart events
nodemon.on('restart', async (files: string[]) => {
    console.log('Files changed:', files);

    // Try to send shutdown message to child process
    if (childProcess) {
        try {
            // Give the process time to shutdown gracefully
            childProcess.send('shutdown');
            await new Promise(resolve => setTimeout(resolve, 10000));
        } catch (err) {
            console.log('Failed to send shutdown message, forcing restart');
        }

        // Start the app again
        startApp();
    }
});

// Handle nodemon crashes
nodemon.on('crash', () => {
    console.error('Nodemon crashed! Restarting...');
    startApp();
});

process.on('SIGINT', () => {
    if (childProcess) {
        try {
            childProcess.kill();
        } catch (err) {
            console.error('Error killing child process:', err);
        }
    }
    process.exit(0);
});