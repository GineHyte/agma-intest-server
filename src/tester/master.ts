import { systemLogger } from '../logger.ts';
import config from '../config.ts';
import { db } from '../database.ts'
import puppeteer, { Browser } from 'puppeteer';
import { Worker } from 'worker_threads';


export default class TestMaster {
    static #instance: TestMaster;
    private browser?: Browser;

    public async setup() {
        await systemLogger.log('TestMaster instantiated!');
        if (this.browser === undefined) {
            this.browser = await puppeteer.launch(config.launchOptions);
        }
        await systemLogger.log('Starting initialisation of TestWorkers...');
        let worker: Worker;
        for (let i = 0; i < config.workerCount; i++) {
            await systemLogger.log('Starting worker ' + i);
            worker = new Worker('./src/worker.ts', { workerData: { device: 'GBINT' + i, browser: this.browser } });
            worker.on('message', async (message) => {
                if (message.status === 'login') {
                    await systemLogger.log('Worker logged in!');
                }
                if (message.status === 'ready') {
                    await systemLogger.log('Worker ready!');
                }
            });
        }
    }

    public static get instance(): TestMaster {
        if (!TestMaster.#instance) {
            TestMaster.#instance = new TestMaster();
        }
        return TestMaster.#instance;
    }
} 