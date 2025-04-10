/**
 * @fileoverview Watcher-Modul für die automatische Neustart der Anwendung bei Dateiänderungen.
 * Verwendet nodemon, um Dateien zu überwachen und startet die Hauptanwendung als Kindprozess neu.
 */
import { default as nodemonDefault } from 'nodemon';
import { fork, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Logger, { systemLogger } from './logger.ts';

// Handhabung der ESM vs CommonJS nodemon Import-Inkonsistenz
const nodemon = nodemonDefault as any;

// Aktuelles Verzeichnis erhalten
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let childProcess: ChildProcess | null = null;
const watcherLogger = new Logger();

/**
 * Initialisiert den Logger für den Watcher-Prozess
 */
async function initWatcherLogger() {
    await watcherLogger.setJWT('system');
    await watcherLogger.log('Watcher-Prozess gestartet');
}

// Logger initialisieren
initWatcherLogger();

/**
 * Startet die App in einem Kindprozess.
 * Richtet Event-Handler für die Prozess-Kommunikation ein und verwaltet den Lifecycle.
 */
function startApp() {
    try {
        if (!childProcess) {
            childProcess = fork('./src/index.ts', [], {});
            
            childProcess.on('message', (message) => {
                if (message === 'shutdown') {
                    watcherLogger.log('Kindprozess hat Herunterfahren angefordert');
                    childProcess?.kill();
                    childProcess = null;
                    startApp();
                }
            });
            
            watcherLogger.log(`App gestartet mit PID: ${childProcess.pid}`);
        } else {
            watcherLogger.log('Kindprozess läuft bereits, daher ist der einzige Weg zum Neustart, eine "shutdown"-Nachricht vom Kindprozess zu senden');
        }

    } catch (err) {
        const error = err as Error;
        watcherLogger.error('Fehler beim Starten des Kindprozesses:', error.message, '\nStack:', error.stack);
    }
}

// Nodemon initialisieren
nodemon({
    script: './src/index.ts',
    ext: 'ts',
    watch: ['./src/'],
    exec: 'echo "Änderungen erkannt"', // Nur ein Platzhalter
    ignore: ['./src/watcher.ts', './src/debugger/**'] // Den Watcher selbst nicht überwachen
});

// App initial starten
startApp();

/**
 * Event-Handler für nodemon-Neustartsereignisse.
 * Versucht, den Kindprozess ordnungsgemäß herunterzufahren und startet ihn neu.
 */
nodemon.on('restart', async (files: string[]) => {
    watcherLogger.log('Dateien geändert:', JSON.stringify(files));
    watcherLogger.log('Neustart der Anwendung wegen Änderungen in:', 
        files.map(f => f.split('/').pop()).join(', '));

    // Versuche, Shutdown-Nachricht an Kindprozess zu senden
    if (childProcess) {
        try {
            // Dem Prozess Zeit geben, um ordnungsgemäß herunterzufahren
            childProcess.send('shutdown');
            watcherLogger.log('Shutdown-Signal an Kindprozess gesendet');
        } catch (err) {
            const error = err as Error;
            watcherLogger.error('Fehler beim Senden der Shutdown-Nachricht:', error.message);
        }

        // App neu starten
        startApp();
    }
});

// Nodemon-Abstürze behandeln
nodemon.on('crash', () => {
    watcherLogger.error('Nodemon abgestürzt! Neustart wird eingeleitet...');
    startApp();
});
