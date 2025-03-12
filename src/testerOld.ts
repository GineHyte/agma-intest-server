import type {
    Page,
    Browser,
    EvaluateFuncWith,
    ElementHandle,
    NodeFor,
    WaitForSelectorOptions,
    KeyboardTypeOptions,
    ClickOptions,
    KeyInput,
    Locator,
    KeyPressOptions
} from 'puppeteer';
import puppeteer from 'puppeteer';
import config from './config.ts';
import logger from './logger.ts';

export class Tester {
    browser: Browser | undefined;

    haltZeit: number;
    tippenZeit: number;
    page!: Page;
    appStatus!: AppStatus;

    constructor(
        tippenZeit: number = 0,
        haltZeit: number = 0,
        browser: Browser | undefined = undefined,
    ) {
        this.haltZeit = haltZeit;
        this.tippenZeit = tippenZeit;
        this.browser = browser;
        if (logger) {
        }
    }

    async setup() {
        if (this.browser === undefined) {
            this.browser = await puppeteer.launch(config.launchOptions);
            this.page = await this.browser.newPage();
            await this.page.goto(config.url);
        } else {
            this.page = (await this.browser.pages())[0];
        }
        await this.page.setViewport(config.viewport);
        logger.page = this.page;
    }

    async login() {
        await this.tippen(config.bediener, '[data-componentid=name]', { delay: this.tippenZeit });
        await this.tippen(config.kennwort, '[data-componentid=kenn]', { delay: this.tippenZeit });
        await this.klicken('span[data-ref="btnInnerEl"]');
        logger.log("Anmeldung erfolgreich");
        await this.$('[id=image-1033]');                        // warten auf iFood Logo
        await this.parseAppStatus();
        logger.log("Job: " + this.appStatus.job);
    }

    private async parseAppStatus() {
        let appStatus = await this.page.evaluate(() => window.AppStatus);
        this.appStatus = {} as AppStatus
        this.appStatus.uci = appStatus[0].split(': ')[1];
        this.appStatus.job = +appStatus[1].split(': ')[1];
        this.appStatus.device = appStatus[2].split(': ')[1];
        this.appStatus.bediener = appStatus[3].split(': ')[1];
        this.appStatus.version = appStatus[4].split(': ')[1];
        this.appStatus.mandant = appStatus[5].split(': ')[1];
        this.appStatus.jobverwaltungStatus = appStatus[6].split(' ')[1] === 'aktiv';
    }

    async halten(ms: number) {
        return await new Promise(resolve => setTimeout(resolve, ms));
    }

    async $(selector: string, maxTime: number = 30_000): Promise<ElementHandle<NodeFor<string>>> {
        await this.page.waitForSelector(selector, { timeout: maxTime });
        let element = await this.page.$(selector);
        if (!element) {
            logger.error("Element not found: " + selector);
            throw new Error("Element not found: " + selector);
        }
        return element;
    }

    async $$<Selector extends string>(selector: Selector): Promise<ElementHandle<NodeFor<Selector>>[]> {
        return await this.page.$$(selector);
    }

    async $$eval<
        Selector extends string,
        Params extends unknown[],
        Func extends EvaluateFuncWith<Array<NodeFor<Selector>>, Params> = EvaluateFuncWith<Array<NodeFor<Selector>>, Params>>
        (selector: Selector, pageFunction: Func | string, ...args: Params): Promise<Awaited<ReturnType<Func>>> {
        return await this.page.$$eval(selector, pageFunction, ...args);
    }

    async warten<Selector extends string>(selector: Selector, options?: WaitForSelectorOptions): Promise<ElementHandle<NodeFor<Selector>> | null> {
        return await this.page.waitForSelector(selector, options);
    }

    async tippen(text: string, selector: string | undefined = undefined, options?: Readonly<KeyboardTypeOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        if (selector) {
            return await this.page.type(selector, text, options);
        }
        return await this.page.keyboard.type(text, options);
    }

    async klicken(selector: string, options?: Readonly<ClickOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        return await this.page.click(selector, options);
    }

    async drucken(key: KeyInput, options?: Readonly<KeyPressOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        return await this.page.keyboard.press(key, options);
    }

    async $eval(selector: string, pageFunction: EvaluateFuncWith<any, any[]>, ...args: any): Promise<any> {
        let element = await this.$(selector);
        return element.evaluate(pageFunction, ...args);
    }

    async logout() {
        // Zurück zum Hauptbildschirm
        logger.log("Zurück zum Hauptbildschirm mit Escape");
        while ((await this.getAktWindowID()) !== '') {
            await this.drucken('Escape');
            await this.halten(10); // Kurze Pause zwischen Escape-Drücken
        }
        await this.programmaufruf("000");
        await this.warten('input[value="zum Login"]'); // warten auf zum Login Button
    }

    locator<Selector extends string>(selector: Selector): Locator<NodeFor<Selector>> {
        return this.page.locator(selector);
    }

    async programmaufruf(menuepunkt: string) {
        await this.page.evaluate((menuepunkt) => window.programmaufruf(menuepunkt), menuepunkt);
    }

    async getAktWindowID() {
        return await this.page.evaluate(() => window.windowID);
    }

    async close() {
        await this.browser?.close();
        this.browser = undefined;
        this.page = undefined as any;
    }

    async feldEingabe(feld: number, text: string, seite: number = 1) {
        if (!await (this.$('div[id=SeitenMenue1][class*=x-item-disabled]'))) { // wenn Seitenmenü nicht disabled
            await this.klicken(`li[data-boundview="SeitenMenue1-picker"][data-recordindex="${seite}"]`);
        }

        let inputEl = await this.$(`[data-componentid="${await this.getAktWindowID()}_EDIT${seite}_${feld}"]`);
        if ((await (await inputEl.getProperty('ariaReadonly')).jsonValue()) === 'true' || !inputEl) {
            logger.error("Feld ist readonly: " + feld);
            return;
        }
        await inputEl.type(text, { delay: this.tippenZeit });
        await this.drucken('Enter');
    }

    async klickenButton(buttonLabel: string) {
        let rightButton: any;
        let buttons = (await this.$$eval(`a[id^="${await this.getAktWindowID()}_BUT"]`,
            (els: HTMLAnchorElement[]) => els.map(el => { return { "id": el.id, "text": el.textContent?.split(" ")[0], "disabled": el.ariaDisabled } }))
        ) as { id: string, text: string, disabled: string }[];
        for (let button of buttons) {
            logger.log("Suchen Button: " + button.text + " nach " + buttonLabel);
            if (button.text.trim() === buttonLabel) {
                logger.log("Button gefunden: " + button.text);
                rightButton = button;
                break;
            }
        }
        if (!rightButton) {
            logger.error("Button nicht gefunden: " + buttonLabel);
            return;
        }
        if (rightButton.disabled === 'true') {
            logger.error("Button ist disabled: " + buttonLabel);
            return;
        }
        await this.klicken(`a[id="${rightButton.id}"]`);
    }

    async auswahlMel(auswahl: number) {
        if (auswahl === -1) {
            await this.klicken(`[id="${await this.getAktWindowID()}_header-targetEl"] div[role="button"]`);
        } else {
            await this.$eval(
                `[id="${await this.getAktWindowID()}_gridPanel-body"]`,
                (el: HTMLDivElement, index: number) => {
                    // @ts-ignore   
                    el.children[0].children[0].children[index].children[0].children[0].children[0].children[0].click();
                },
                auswahl - 1
            );
        }
    }

    async tippenMel(text: string, num: number) {
        await this.tippen(text, `input[id="${await this.getAktWindowID()}_FPOS1_${num}-inputEl"]`, { delay: this.tippenZeit });
        await this.drucken('Enter');
    }

    async wartenBisMaskeGeladen() {
        await this.$(`[id="${await this.getAktWindowID()}-body"]`);
    }
}

export default new Tester(config.tippenZeit, config.haltZeit); // Singleton