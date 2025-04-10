import { systemLogger } from '../logger.ts';
import config from '../config.ts';
import { db } from '../database.ts'
import puppeteer, { Browser } from 'puppeteer';
import { Worker } from 'worker_threads';

/**
 * Hauptklasse zur Verwaltung des Testvorgangs und der Testarbeiter.
 * Verwaltet Browser-Instanzen und verteilt Testaufgaben.
 */
export default class TestMaster {
    static #instance: TestMaster;

    private browser?: Browser;
    private browserWSEndpoint?: string;
    private workers: Worker[] = [];
    private tasks: MasterMessage[] = [];

    /**
     * Gibt die Singleton-Instanz des TestMasters zurück.
     * Erstellt eine neue Instanz, falls noch keine existiert.
     */
    public static get instance(): TestMaster {
        if (!TestMaster.#instance) {
            TestMaster.#instance = new TestMaster();
        }
        return TestMaster.#instance;
    }

    /**
     * Wartet, bis alle Worker ihre Aufgaben abgeschlossen haben.
     * @param action Optionale Aktion, auf deren Abschluss gewartet werden soll.
     */
    private async waitForWorkersToFinish(action?: string) {
        await systemLogger.log('Warte auf Abschluss der Worker ', action, '...');
        let workers = await db.selectFrom('worker').select('id').execute();
        for (let worker of workers) {
            await this.waitForWokerToFinish(worker.id, action);
        }

        await systemLogger.log('Alle Worker haben ', action, ' abgeschlossen');
    }

    /**
     * Wartet, bis ein bestimmter Worker seine Aufgabe abgeschlossen hat.
     * @param id Die ID des Workers.
     * @param action Optionale Aktion, auf deren Abschluss gewartet werden soll.
     */
    private async waitForWokerToFinish(id: number, action?: string) {
        await systemLogger.log('Warte auf Abschluss des Worker [', id, '] ', action, '...');
        let worker = await db.selectFrom('worker').select(['status', 'action']).where("id", "=", id).executeTakeFirstOrThrow();
        let finished = false;
        while (!finished) {
            if (action === undefined && worker.status !== 'completed') {
                finished = false;
            }
            else if (worker.action === action && worker.status !== 'completed') {
                finished = false;
            }
            else { finished = true; }
            await new Promise((resolve) => setTimeout(resolve, 500));
            worker = await db.selectFrom('worker').select(['status', 'action']).where("id", "=", id).executeTakeFirstOrThrow();
        }
        await systemLogger.log('Worker [', id, '] hat ', action, ' abgeschlossen');
    }

    /**
     * Behandelt Fehler, die in Workers auftreten.
     * @param error Der aufgetretene Fehler.
     * @param id Die ID des betroffenen Workers.
     */
    private async workerErrorHandler(error: Error, id?: number) {
        await systemLogger.error('Unbehandelter Fehler in Worker [', id === undefined ? id : '', ']: ', JSON.stringify(error));
        await systemLogger.error('Prozess Stack: ', new Error().stack)
    }

    /**
     * Verarbeitet Nachrichten von Workers.
     * @param handlerPayload Die Nutzlast der Worker-Nachricht.
     */
    private async workerMessageHandler(handlerPayload: any) {
        const id: number = handlerPayload.id;
        const status: Status = handlerPayload.status;
        const action: Action = handlerPayload.action;
        const JWT: string | undefined = handlerPayload.JWT;
        const worker: Worker = this.workers[id];
        const message: string | undefined = handlerPayload.message;
        const userMacroId: string | undefined = handlerPayload.userMacroId;

        await db.updateTable('worker')
            .where("id", "=", id)
            .set({
                id: id,
                threadId: worker.threadId,
                status: status,
                action: action,
                message: message
            }).execute();
        await systemLogger.log('Worker [', id, '] hat ', action, ' mit dem Status ', status, ' gemeldet.');
        switch (action) {
            case 'init':
                break;
            case 'teardown':
                if (status === 'completed') {
                    await systemLogger.log('Worker [', id, '] hat teardown abgeschlossen.');
                    worker.terminate();
                }
                break;
            case 'test':
                if (JWT === undefined || userMacroId === undefined) { break; }
                let newMacro: any = {
                    resultMessage: message,
                    status: status,
                    screencastName: handlerPayload.screencastName,
                    logName: handlerPayload.logName,
                    entries: JSON.stringify(handlerPayload.entries),
                }
                if (status === 'running' || status === 'pending') {
                    newMacro.startedAt = Date.now();
                } else {
                    newMacro.completedAt = Date.now();
                }
                await db.updateTable('macro')
                    .set(newMacro)
                    .where("JWT", "==", JWT)
                    .where("userMacroId", "==", userMacroId)
                    .execute();
                if (status === 'completed') {
                    await systemLogger.log('Worker [', id, '] hat Test abgeschlossen.');
                }
                break;
            default:
                break;
        }
    }

    /**
     * Initialisiert den TestMaster und startet die Worker.
     */
    public async init() {
        await systemLogger.log('TestMaster instanziiert!');
        if (this.browser === undefined) {
            // Browser im Server-Modus starten
            this.browser = await puppeteer.launch({
                ...config.launchOptions,
                // Diese Optionen aktivieren den Browser-Server-Modus
                args: [
                    ...(config.launchOptions.args || []),
                    '--remote-debugging-port=0'
                ]
            });

            // Browser WebSocket-Endpunkt abrufen
            this.browserWSEndpoint = this.browser.wsEndpoint();
            await systemLogger.log(`Browser im Server-Modus gestartet mit Endpunkt: ${this.browserWSEndpoint}`);
        }

        await systemLogger.log('Starte Initialisierung der TestWorker...');
        let worker: Worker;

        for (let i = 0; i < config.workerCount; i++) {
            await systemLogger.log('Starte Worker ' + i);
            worker = new Worker('./src/tester/worker.ts', {
                workerData: {
                    id: i,
                    browserWSEndpoint: this.browserWSEndpoint
                }
            });

            const workerId = i;

            // Alle Kommunikationsereignisse registrieren
            worker.on('error', async (error) => {
                await this.workerErrorHandler(error, workerId);
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
            worker.postMessage({ action: 'init', JWT: 'system' });
            this.workers.push(worker);
        }
    }

    /**
     * Beendet alle Worker und schließt den Browser.
     */
    public async teardown() {
        await systemLogger.log('Starte Beendigung der TestWorker...');
        await this.waitForWorkersToFinish();
        for (let worker of this.workers) {
            worker.postMessage({ action: 'teardown' });
        }
        await systemLogger.log('Alle Worker wurden zur Beendigung angewiesen.');
        await this.waitForWorkersToFinish('teardown');
        await this.browser?.close();
        await systemLogger.log('Browser wurde geschlossen.');
    }

    /**
     * Fügt eine neue Aufgabe zur Warteschlange hinzu.
     * @param task Die hinzuzufügende Aufgabe.
     */
    public async pushTask(task: MasterMessage) {
        await systemLogger.log('Aufgabe zur Warteschlange hinzugefügt:',
            'Aktion:', task.action,
            'BenutzerMakroId:', task.userMacroId,
            'Warteschlangengröße:', this.tasks.length + 1);
        this.tasks.push(task);
        await this.processTasks();
    }

    /**
     * Verarbeitet Aufgaben aus der Warteschlange und weist sie verfügbaren Workern zu.
     */
    public async processTasks() {
        await systemLogger.log('Verarbeitung der Worker-Aufgaben....', this.tasks.length)
        while (this.tasks.length > 0) {
            let workers = await db.selectFrom('worker').select(['id', 'status']).execute();
            for (let worker of workers) { // Suche nach verfügbaren Workern
                if (worker.status === 'running' || worker.status === 'pending') { continue; } // Worker ist bereits beschäftigt
                let workerObject = this.workers[worker.id];
                let task = this.tasks.shift();
                await systemLogger.log('Freier Worker gefunden!', worker.id, JSON.stringify(task))
                workerObject.postMessage(task);
                await db.updateTable('worker')
                    .where("id", "=", worker.id)
                    .set({
                        threadId: workerObject.threadId,
                        status: 'pending',
                        message: 'Warte auf Status running...'
                    }).execute();
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}