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
var workerTasks: any[] = [];
var browserWSEndpoint: string;
var device: string;
var id: number;
var currentAction: Action = 'init';
var currentStatus: Status = 'pending';


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
    // Create a new browser context to avoid session token conflicts
    context = await browser.createBrowserContext();
    page = await context.newPage();
    recorder = new Recorder(page, workerLogger);
    tester = new Tester(page, workerLogger);
    parentPort?.on('message', async (message) => {
        await pushTask(message);
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
    switch (action) {
        case 'teardown':
            await workerLogger.log('Worker has received teardown signal.');
            await tester.logout();
            await recorder.stopRecording();
            break;
        case 'test':
            await workerLogger.log('Worker has received test signal.');
            if (task.entries) {
                const entries = task.entries;
                await tester.halten(500);
                let counter = 0;
                for (const entry of entries) {
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
                    counter++;
                }
            }
            break;
        case 'init':
            await page.goto(config.url + "?Device=" + device);
            await page.setViewport(config.viewport);
            await tester.login();
        default:
            break;
    }
    postMessage({ status: 'completed', action: action, id: workerData.id });
}

async function pushTask(task: MasterMessage) {
    workerTasks.push(task);
    await readTasks();
}

async function readTasks() {
    if (currentStatus !== 'pending' && currentStatus !== 'running') {
        return;
    }
    if (workerTasks.length > 0) {
        const task = workerTasks.shift();
        await processWorkerTask(task);
    }
}