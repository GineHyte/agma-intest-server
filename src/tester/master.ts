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
    private tasks: MasterMessage[] = [];

    public static get instance(): TestMaster {
        if (!TestMaster.#instance) {
            TestMaster.#instance = new TestMaster();
        }
        return TestMaster.#instance;
    }

    private async waitForWorkersToFinish(action?: string) {
        await systemLogger.log('Waiting for workers to finish ', action, '...');
        let allFinished = false;
        while (!allFinished) {
            allFinished = true;
            let workersStatus = await db.selectFrom('worker').selectAll().execute();
            for (let worker of workersStatus.values()) {
                if (action === undefined && worker.status !== 'completed') {
                    allFinished = false;
                    break;
                }
                if (worker.action === action && worker.status !== 'completed') {
                    allFinished = false;
                    break;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        await systemLogger.log('All workers have finished ', action);
    }

    private async workerErrorHandler(error: Error, id?: number) {
        await systemLogger.error('Unhandled error in worker [', id === undefined ? id : '', ']: ', error);
    }

    private async workerMessageHandler(message: any) {
        const id: number = message.id;
        const status: Status = message.status;
        const action: Action = message.action;
        const worker: Worker = this.workers[id];

        await db.updateTable('worker')
            .where("id", "=", id)
            .set({
                id: id,
                threadId: worker.threadId,
                status: status,
                action: action,
                message: message.message
            }).execute();
        switch (action) {
            case 'init':
                break;
            case 'teardown':
                if (status === 'completed') {
                    await systemLogger.log('Worker [', id, '] has finished teardown.');
                    worker.terminate();
                }
                break;
            default:
                break;
        }
    }

    public async init() {
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
            await db.insertInto('worker').values({
                id: i,
                threadId: worker.threadId,
                status: 'pending',
                action: 'init'
            }).execute();
            worker.postMessage({ action: 'init' });
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

    public async pushTask(task: MasterMessage) {
        await systemLogger.log('Pushing task: ', JSON.stringify(task));
        this.tasks.push(task);
        await this.processTasks();
    }

    public async processTasks() {
        while (this.tasks.length > 0) {
            let task = this.tasks.shift();
            if (task) {
                await systemLogger.log('Processing task: ', JSON.stringify(task));
                let workersStatus = await db.selectFrom('worker').selectAll().execute();
                for (let status of workersStatus) {
                    if (status.status === 'completed' || status.status === 'pending') {
                        let worker = this.workers[status.id];
                        worker.postMessage(task);
                        break;
                    }
                }
            }
        }
    }
}