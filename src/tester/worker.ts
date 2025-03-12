import { workerData, parentPort } from 'worker_threads';
import config from '../config.ts';
import Tester from './tester.ts';
import { systemLogger } from '../logger.ts';
import Recorder from '../recorder.ts';

await systemLogger.log('Worker started');
(async () => {
    const browser = workerData.browser;
    const device = workerData.device;
    console.log('Worker received browser:', browser);
    if (!browser) {
        throw new Error('Browser not found in worker data');
    }
    const page = await browser?.newPage();
    await page.goto(config.url + "?Device=" + device);
    await page.setViewport(config.viewport);
    const recorder = new Recorder(page, systemLogger);
    const tester = new Tester(page, recorder, systemLogger); // will start with systemLogger
    parentPort?.postMessage({ status: 'login' });
    await tester.login(); // This process can take some time
    parentPort?.postMessage({ status: 'ready' });
    await systemLogger.log('Worker ready')
})();