import { workerData, parentPort } from 'worker_threads';
import config from '../config.ts';
import puppeteer from 'puppeteer';
import Tester from './tester.ts';
import Logger, { systemLogger } from '../logger.ts';
import Recorder from '../recorder.ts';

var tester: Tester;
var recorder: Recorder;
var context: puppeteer.BrowserContext;
var browser: puppeteer.Browser;
var page: puppeteer.Page;
var workerLogger: Logger;
var browserWSEndpoint: string;
var device: string;
var id: number;
var currentAction: Action = 'init';
var currentStatus: Status = 'pending';
var userMacroId: string;


(async () => {
    id = workerData.id;
    device = "GBINT" + id.toString();
    browserWSEndpoint = workerData.browserWSEndpoint;
    workerLogger = new Logger();
    workerLogger.workerId = id;
    // Connect to the browser instance using the WebSocket endpoint
    browser = await puppeteer.connect({
        browserWSEndpoint,
        defaultViewport: config.viewport
    });
    parentPort?.on('message', async (message) => {
        await dispatchTask(message);
    });
    await workerLogger.log('Worker has started.');
})();

// Function to post messages to the parent thread
function postMessage(arg0: WorkerMessage) {
    return parentPort?.postMessage(arg0);
}

async function processWorkerTask(task: MasterMessage) {
    const action = task.action;
    currentAction = action;
    currentStatus = 'running';
    postMessage({ status: 'running', action: action, id: workerData.id });
    await workerLogger.log('Worker has received ' + action + ' signal.');
    switch (action) {
        case 'teardown':
            await tester.logout();
            await recorder.stopRecording();
            break;
        case 'test':
            if (task.userMacroId === undefined) {
                await workerLogger.error('Fehler bei Ausführung:', 'userMacroId ist nicht vorhanden!');
                postMessage({ status: 'failed', action: action, message: 'userMacroId ist nicht vorhanden!', id: workerData.id });
                return;
            }
            userMacroId = task.userMacroId;
            if (task.entries) {
                const entries = task.entries;
                await tester.halten(500);
                for (const entry of entries) {
                    try {
                        switch (entry.type) {
                            case 'M': // maus
                                await tester.klicken(`[id=${entry.key}]`);
                                break;
                            case 'T': // tippen
                                await tester.drucken(entry.key);
                                break;
                            case 'P': // menuepunkt 
                                await tester.programmaufruf(entry.key);
                                break;
                        }
                    } catch (error) {
                        let message: string = '[Eintrag: ' + JSON.stringify(entry) + '] ';
                        message += error instanceof Error ? error.message : 'Internal Server Error';
                        await workerLogger.error('Fehler bei Ausführung:', message);
                        postMessage({ status: 'failed', action: action, message: message, id: workerData.id, userMacroId: userMacroId, JWT: task.JWT });
                        await tester.logout();
                        await workerLogger.log("Führen relogin Funktion aus nach dem Fehler...");
                        await tester.relogin();
                        postMessage({ status: 'completed', action: 'init', id: workerData.id });
                        return;
                    }
                }
            }
            break;
        case 'init':
            // Create a new browser context to avoid session token conflicts
            context = await browser.createBrowserContext();
            page = await context.newPage();
            recorder = new Recorder(page, workerLogger);
            tester = new Tester(page, workerLogger);
            await page.goto(config.url + "?Device=" + device);
            await page.setViewport(config.viewport);
            await tester.login();
        default:
            break;
    }
    postMessage({ status: 'completed', action: action, id: workerData.id });
}

async function dispatchTask(task: MasterMessage) {
    await workerLogger.setJWT(task.JWT);
    await processWorkerTask(task);
}
