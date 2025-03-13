import { systemLogger } from '../logger.ts';
import config from '../config.ts';
import { db } from '../database.ts'
import puppeteer, { Browser } from 'puppeteer';
import { Worker } from 'worker_threads';

export default class TestMaster {
    static #instance: TestMaster;

    
    private browser?: Browser;
    private browserWSEndpoint?: string;
    private workers: Worker[] = [];
    private workersStatus: Map<number, any> = new Map();

    public static get instance(): TestMaster {
        if (!TestMaster.#instance) {
            TestMaster.#instance = new TestMaster();
        }
        return TestMaster.#instance;
    }
    
    private async waitForWorkersToFinish(action?: string) {
        await systemLogger.log('Waiting for workers to finish ', action, '...');
        
        await systemLogger.log('All workers have finished ', action);
    }

    private async workerErrorHandler(error: Error, id?: number) {
        await systemLogger.error('Unhandled error in worker [', id === undefined ? id : '', ']: ', error);
    }

    private async workerMessageHandler(message: any) {
        const id = message.id;
        const status = message.status;
        const action = message.action;
        const worker = this.workers[id];
        // update worker status
        this.workersStatus.set(worker.threadId, message);
        switch (action) {
            case 'login':
                break;
            case 'teardown':
                if (status === 'done') {
                    await systemLogger.log('Worker [', id, '] has finished teardown.');
                    worker.terminate();
                }
                break;
            default:
                break;
        }
    }

    public async setup() {
        await systemLogger.log('TestMaster instantiated!');
        if (this.browser === undefined) {
            // Launch browser in server mode
            this.browser = await puppeteer.launch({
                ...config.launchOptions,
                // These options enable browser server mode
                args: [
                    ...(config.launchOptions.args || []),
                    '--remote-debugging-port=0'
                ]
            });

            // Get the browser WebSocket endpoint
            this.browserWSEndpoint = this.browser.wsEndpoint();
            await systemLogger.log(`Browser started in server mode with endpoint: ${this.browserWSEndpoint}`);
        }

        await systemLogger.log('Starting initialisation of TestWorkers...');
        let worker: Worker;

        for (let i = 0; i < config.workerCount; i++) {
            await systemLogger.log('Starting worker ' + i);
            worker = new Worker('./src/tester/worker.ts', {
                workerData: {
                    id: i,
                    browserWSEndpoint: this.browserWSEndpoint
                }
            });

            // register all communication events
            worker.on('error', async (error) => {
                await this.workerErrorHandler(error, i);
            });
            worker.on('message', async (message) => {
                await this.workerMessageHandler(message);
            });
            this.workersStatus.set(worker.threadId, { status: 'pending', action: 'init' });
            await db.insertInto('worker').values({
                id: i,
                threadId: worker.threadId,
                status: 'pending',
                action: 'init'
            }).execute();
            this.workers.push(worker);
        }
    }

    public async teardown() {
        await systemLogger.log('Starting teardown of TestWorkers...');
        await this.waitForWorkersToFinish();
        for (let worker of this.workers) {
            worker.postMessage({ action: 'teardown' });
        }
        await systemLogger.log('All workers have been instructed to teardown.');
        await this.waitForWorkersToFinish('teardown');
        await this.browser?.close();
        await systemLogger.log('Browser has been closed.');
    }
}