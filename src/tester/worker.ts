import { workerData, parentPort } from 'worker_threads';
import config from '../config.ts';
import puppeteer from 'puppeteer';
import Tester from './tester.ts';
import Logger from '../logger.ts';
import Recorder from '../recorder.ts';
import { formatTimestamp } from '../utils.ts';

/**
 * Tester-Instanz für den Worker-Thread
 */
var tester: Tester;

/**
 * Recorder-Instanz für den Worker-Thread
 */
var workerRecorder: Recorder;

/**
 * Browser-Kontext für den Worker-Thread
 */
var context: puppeteer.BrowserContext;

/**
 * Browser-Instanz für den Worker-Thread
 */
var browser: puppeteer.Browser;

/**
 * Browser-Seite für den Worker-Thread
 */
var page: puppeteer.Page;

/**
 * Logger-Instanz für den Worker-Thread
 */
var workerLogger: Logger;

/**
 * WebSocket-Endpunkt für die Browser-Verbindung
 */
var browserWSEndpoint: string;

/**
 * Gerätename für den Worker-Thread
 */
var device: string;

/**
 * ID des Worker-Threads
 */
var id: number;

/**
 * ID des vom Benutzer definierten Makros
 */
var userMacroId: string;

/**
 * Fehler-Status des Tests
 */
var failed: boolean;

/**
 * Name der Protokolldatei
 */
const logName: string = "logs";


/**
 * Selbstaufrufende Funktion zur Initialisierung des Workers
 */
(async () => {
    id = workerData.id;
    device = "GBINT" + id.toString();
    browserWSEndpoint = workerData.browserWSEndpoint;
    workerLogger = new Logger();
    workerLogger.workerId = id;
    // Verbindung zur Browser-Instanz über den WebSocket-Endpunkt herstellen
    browser = await puppeteer.connect({
        browserWSEndpoint,
        defaultViewport: config.viewport
    });
    parentPort?.on('message', async (message) => {
        await workerLogger.debug("Nachricht: ", JSON.stringify(message));
        await dispatchTask(message);
    });
    await workerLogger.log('Worker wurde gestartet.');
})();

/**
 * Funktion zum Senden von Nachrichten an den übergeordneten Thread
 * 
 * @param arg0 - Die zu sendende Nachricht
 * @returns Ergebnis des Nachrichtenversands
 */
function postMessage(arg0: WorkerMessage) {
    return parentPort?.postMessage(arg0);
}

/**
 * Verarbeitet eine Aufgabe im Worker-Thread
 * 
 * @param task - Die zu verarbeitende Aufgabe
 * @returns Promise, das aufgelöst wird, wenn die Aufgabe abgeschlossen ist
 */
async function processWorkerTask(task: MasterMessage) {
    const action = task.action;
    postMessage({ status: 'running', action: action, id: workerData.id, userMacroId: task.userMacroId, JWT: task.JWT });
    await workerLogger.log('Worker hat das Signal ' + action + ' erhalten.');
    switch (action) {
        case 'teardown':
            await tester.logout();
            await workerRecorder.stopRecording();
            postMessage({
                status: 'completed',
                message: "Teardown Erfolg!",
                action: task.action,
                id: workerData.id,
            });
            break;
        case 'test':
            await testHandler(task);
            break;
        case 'endtest':
            await tester.logout();
            await workerRecorder.stopRecording();
            await tester.relogin();
            postMessage({
                status: 'completed',
                message: "Endtest Erfolg!",
                action: task.action,
                id: workerData.id,
            });
            break;
        case 'init':
            // Neuen Browser-Kontext erstellen, um Konflikte mit Session-Token zu vermeiden
            context = await browser.createBrowserContext();
            page = await context.newPage();
            page.setDefaultTimeout(config.elementTimeout);
            workerRecorder = new Recorder(page, workerLogger);
            tester = new Tester(page, workerLogger);
            await page.goto(config.url + "?Device=" + device);
            await page.setViewport(config.viewport);
            try {
                await tester.login();
            } catch (e) {
                await workerLogger.error('Fehler bei der Anmeldung', e)
                if (await tester.keineLizenzen()) {
                    postMessage({
                        status: 'failed',
                        message: "Keine Lizenzen!",
                        action: task.action,
                        id: workerData.id,
                    });
                }
                break;
            }
            postMessage({
                status: 'completed',
                message: "Init Erfolg!",
                action: task.action,
                id: workerData.id,
            });
        default:
            break;
    }
}

/**
 * Verteilt eine Aufgabe zur Verarbeitung
 * 
 * @param task - Die zu verteilende Aufgabe
 * @returns Promise, das aufgelöst wird, wenn die Aufgabe verteilt wurde
 */
async function dispatchTask(task: MasterMessage) {
    await workerLogger.setJWT(task.JWT);
    await processWorkerTask(task);
}

/**
 * Verarbeitet Testaufgaben
 * 
 * @param task - Die zu verarbeitende Testaufgabe
 * @returns Promise, das aufgelöst wird, wenn der Test abgeschlossen ist
 */
async function testHandler(task: MasterMessage) {
    if (task.logFlag !== undefined) { workerLogger.logFlag = task.logFlag; }
    if (task.logPath !== undefined) { workerLogger.logPath = task.logPath; }
    if (task.screencastFlag !== undefined) { workerRecorder.screencastFlag = task.screencastFlag; }
    if (task.screencastPath !== undefined) { workerRecorder.screencastPath = task.screencastPath; }
    if (task.userMacroId === undefined) {
        await workerLogger.error('Fehler bei Ausführung:', 'userMacroId ist nicht vorhanden!');
        postMessage({ status: 'failed', action: task.action, message: 'userMacroId ist nicht vorhanden!', id: workerData.id });
        return;
    }
    userMacroId = task.userMacroId;
    if (task.entries) {
        let datetime = formatTimestamp(Date.now())
        await workerRecorder.startRecording(`W${workerData.id}-${datetime.date}-${datetime.time.replaceAll(':', '-')}`);
        const entries = task.entries;
        await tester.halten(500);
        for (const entry of entries) {
            try {
                await tester.testStep(entry.key, entry.type)
            } catch (error) {
                let message: string = '[Eintrag: ' + JSON.stringify(entry) + '] ';
                message += error instanceof Error ? error.message : 'Interner Serverfehler';
                await workerLogger.error(
                    'Test fehlgeschlagen:',
                    'Schritt:', entry.key, entry.type,
                    'MakroID:', userMacroId,
                    'Fehler:', message,
                    'Stack:', error instanceof Error ? error.stack : 'Kein Stack'
                );
                await workerRecorder.stopRecording();
                await workerLogger.dumpProtocolToFile(logName);
                let msg: WorkerMessage = {
                    status: 'failed',
                    action: task.action,
                    message: message,
                    id: workerData.id,
                    userMacroId: userMacroId,
                    JWT: task.JWT
                };
                if (workerLogger.logFlag) { msg.logName = workerLogger.logLastName }
                if (workerRecorder.screencastFlag) { msg.screencastName = workerRecorder.screencastLastName }
                postMessage(msg);
                await processWorkerTask({ action: 'endtest', JWT: task.JWT, userMacroId: task.userMacroId });
                return;
            }
        }
        await workerRecorder.stopRecording();
        await workerLogger.dumpProtocolToFile(logName);
        let msg: WorkerMessage = {
            status: 'completed',
            message: "Erfolg!",
            action: task.action,
            id: workerData.id,
            userMacroId: userMacroId,
            JWT: task.JWT,
        };
        if (workerLogger.logFlag) { msg.logName = workerLogger.logLastName }
        if (workerRecorder.screencastFlag) { msg.screencastName = workerRecorder.screencastLastName }
        postMessage(msg);
        await processWorkerTask({ action: 'endtest', JWT: task.JWT, userMacroId: task.userMacroId });
    }
}