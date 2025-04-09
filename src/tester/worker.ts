import { workerData, parentPort } from 'worker_threads';
import config from '../config.ts';
import puppeteer from 'puppeteer';
import Tester from './tester.ts';
import Logger from '../logger.ts';
import Recorder from '../recorder.ts';

var tester: Tester;
var workerRecorder: Recorder;
var context: puppeteer.BrowserContext;
var browser: puppeteer.Browser;
var page: puppeteer.Page;
var workerLogger: Logger;
var browserWSEndpoint: string;
var device: string;
var id: number;
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
    postMessage({ status: 'running', action: action, id: workerData.id, userMacroId: task.userMacroId, JWT: task.JWT });
    await workerLogger.log('Worker has received ' + action + ' signal.');
    switch (action) {
        case 'teardown':
            await tester.logout();
            await workerRecorder.stopRecording();
            break;
        case 'test':
            await testHandler(task);
            break;
        case 'endtest':
            await tester.logout();
            await workerRecorder.stopRecording();
            await tester.relogin();
            break;
        case 'init':
            // Create a new browser context to avoid session token conflicts
            context = await browser.createBrowserContext();
            page = await context.newPage();
            page.setDefaultTimeout(config.elementTimeout);
            workerRecorder = new Recorder(page, workerLogger);
            tester = new Tester(page, workerLogger);
            await page.goto(config.url + "?Device=" + device);
            await page.setViewport(config.viewport);
            await tester.login();
        default:
            break;
    }
    workerRecorder.stopRecording();
    workerLogger.dumpProtocolToFile(`W${workerData.id}-${Date.now().toLocaleString('de-DE')}`);
    let msg: WorkerMessage = {
        status: 'completed',
        message: "Erfolg!",
        action: action,
        id: workerData.id,
        userMacroId: userMacroId,
        JWT: task.JWT,
    };
    if (workerLogger.logFlag) { msg.logName = workerLogger.logLastName }
    if (workerRecorder.screencastFlag) { msg.screencastName = workerRecorder.screencastLastName }
    postMessage(msg);
}

async function dispatchTask(task: MasterMessage) {
    await workerLogger.setJWT(task.JWT);
    await processWorkerTask(task);
}


async function testHandler(task: MasterMessage) {
    if (task.logFlag !== undefined) { workerLogger.logFlag = task.logFlag; }
    if (task.logPath !== undefined) { workerLogger.logPath = task.logPath; }
    if (task.screencastFlag !== undefined) { workerRecorder.screencastFlag = task.screencastFlag; }
    if (task.screencastPath !== undefined) { workerRecorder.screencastPath = task.screencastPath; }
    await workerLogger.log('Starten UserMacroId: ' + task.userMacroId);
    if (task.userMacroId === undefined) {
        await workerLogger.error('Fehler bei Ausführung:', 'userMacroId ist nicht vorhanden!');
        postMessage({ status: 'failed', action: task.action, message: 'userMacroId ist nicht vorhanden!', id: workerData.id });
        return;
    }
    userMacroId = task.userMacroId;
    if (task.entries) {
        workerRecorder.startRecording(`W${workerData.id}-${Date.now().toLocaleString('de-DE')}`);
        const entries = task.entries;
        await tester.halten(500);
        for (const entry of entries) {
            try {
                await tester.testStep(entry.key, entry.type)
            } catch (error) {
                let message: string = '[Eintrag: ' + JSON.stringify(entry) + '] ';
                message += error instanceof Error ? error.message : 'Internal Server Error';
                await workerLogger.error('Fehler bei Ausführung:', message);
                workerRecorder.stopRecording();
                workerLogger.dumpProtocolToFile(`W${workerData.id}-${Date.now().toLocaleString('de-DE')}`);
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
                return;
            }
        }
    }
}