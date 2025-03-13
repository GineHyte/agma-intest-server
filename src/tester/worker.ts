import { workerData, parentPort } from 'worker_threads';
import config from '../config.ts';
import puppeteer from 'puppeteer';
import Tester from './tester.ts';
import Logger from '../logger.ts';
import Recorder from '../recorder.ts';

(async () => {
    const id = workerData.id;
    const device = "GBINT" + id.toString();
    const browserWSEndpoint = workerData.browserWSEndpoint;
    const workerLogger = new Logger();
    workerLogger.workerId = id;
    // Connect to the browser instance using the WebSocket endpoint
    const browser = await puppeteer.connect({
        browserWSEndpoint,
        defaultViewport: config.viewport
    });
    // Create a new browser context to avoid session token conflicts
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.goto(config.url + "?Device=" + device);
    await page.setViewport(config.viewport);
    try {
        const recorder = new Recorder(page, workerLogger);
        const tester = new Tester(page, workerLogger);
        postMessage({ status: 'running', action: 'init', id: id });
        await tester.login();

        // register all communication events
        parentPort?.on('message', async (message) => {
            switch (message.action) {
                case 'teardown':
                    postMessage({ status: 'running', action: 'teardown', id: id });
                    await tester.logout();
                    await recorder.stopRecording();
                    postMessage({ status: 'completed', action: 'teardown', id: id });
                    break;
                default:
                    break;
            }
        });
        postMessage({ status: 'completed', action: 'init', id: id });
    } catch (error) {
        postMessage({ status: 'completed', action: 'teardown', message: error instanceof Error ? error.message : error, id: id });
        return;
    }
})();

// Function to post messages to the parent thread
function postMessage(arg0: WorkerMessage) {
    return parentPort?.postMessage(arg0);
}