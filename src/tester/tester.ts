import type {
    Page,
    EvaluateFuncWith,
    ElementHandle,
    NodeFor,
    WaitForSelectorOptions,
    KeyboardTypeOptions,
    ClickOptions,
    KeyInput,
    KeyPressOptions
} from 'puppeteer';
import config from '../config.ts';
import Logger from '../logger.ts';

export default class Tester {
    private appStatus!: AppStatus;
    private haltZeit: number;
    private logger!: Logger;
    private page: Page;
    private tippenZeit: number;
    constructor(
        page: Page,
        logger: Logger,
        haltZeit: number = config.haltZeit,
        tippenZeit: number = config.tippenZeit,
    ) {
        this.page = page;
        this.logger = logger;
        this.haltZeit = haltZeit;
        this.tippenZeit = tippenZeit;
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

    async $(selector: string, maxTime: number = 30_000): Promise<ElementHandle<NodeFor<string>>> {
        await this.page.waitForSelector(selector, { timeout: maxTime });
        let element = await this.page.$(selector);
        if (!element) {
            this.logger.error("Element not found: " + selector);
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

    async $eval(selector: string, pageFunction: EvaluateFuncWith<any, any[]>, ...args: any): Promise<any> {
        let element = await this.$(selector);
        return element.evaluate(pageFunction, ...args);
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

    async drucken(key: KeyInput, options?: Readonly<KeyPressOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        await this.logger.log("Drücke Taste: " + key);
        return await this.page.keyboard.press(key, options);
    }

    async feldEingabe(feld: number, text: string, seite: number = 1) {
        if (!await (this.$('div[id=SeitenMenue1][class*=x-item-disabled]'))) { // wenn Seitenmenü nicht disabled
            await this.klicken(`li[data-boundview="SeitenMenue1-picker"][data-recordindex="${seite}"]`);
        }

        let inputEl = await this.$(`[data-componentid="${await this.getAktWindowID()}_EDIT${seite}_${feld}"]`);
        if ((await (await inputEl.getProperty('ariaReadonly')).jsonValue()) === 'true' || !inputEl) {
            this.logger.error("Feld ist readonly: " + feld);
            return;
        }
        await inputEl.type(text, { delay: this.tippenZeit });
        await this.drucken('Enter');
    }

    async getAktWindowID() {
        return await this.page.evaluate(() => window.windowID);
    }

    async halten(ms: number) {
        await this.logger.log("Warte " + ms + "ms");
        return await new Promise(resolve => setTimeout(resolve, ms));
    }

    async klicken(selector: string, options?: Readonly<ClickOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        await this.logger.log("Klicke auf Element: " + selector);
        return await this.page.click(selector, options);
    }

    async klickenButton(buttonLabel: string) {
        let rightButton: any;
        let buttons = (await this.$$eval(`a[id^="${await this.getAktWindowID()}_BUT"]`,
            (els: HTMLAnchorElement[]) => els.map(el => { return { "id": el.id, "text": el.textContent?.split(" ")[0], "disabled": el.ariaDisabled } }))
        ) as { id: string, text: string, disabled: string }[];
        for (let button of buttons) {
            this.logger.log("Suchen Button: " + button.text + " nach " + buttonLabel);
            if (button.text.trim() === buttonLabel) {
                this.logger.log("Button gefunden: " + button.text);
                rightButton = button;
                break;
            }
        }
        if (!rightButton) {
            this.logger.error("Button nicht gefunden: " + buttonLabel);
            return;
        }
        if (rightButton.disabled === 'true') {
            this.logger.error("Button ist disabled: " + buttonLabel);
            return;
        }
        await this.klicken(`a[id="${rightButton.id}"]`);
    }

    async login() {
        await this.logger.log("Anmeldung...");
        await this.tippen(config.bediener, '[data-componentid=name]', { delay: this.tippenZeit });
        await this.tippen(config.kennwort, '[data-componentid=kenn]', { delay: this.tippenZeit });
        await this.drucken('Enter');
        await this.drucken('Enter');
        await this.$('[id=image-1033]');                        // warten auf iFood Logo
        await this.logger.log("Anmeldung erfolgreich");
        await this.parseAppStatus();
        await this.logger.log("Job: " + this.appStatus.job);
    }

    async logout() {
        // Zurück zum Hauptbildschirm
        while ((await this.getAktWindowID()) !== '') {
            await this.drucken('Escape');
            await this.halten(10); // Kurze Pause zwischen Escape-Drücken
        }
        await this.programmaufruf("000");
        await this.warten('input[value="zum Login"]'); // warten auf zum Login Button
        await this.logger.log("logout done!");
    }

    async relogin() {
        let loginBtn = await this.$('input[value="zum Login"]'); // Suchen nach zum Login Button
        if (loginBtn) {
            await Promise.all([
                this.page.waitForNavigation(),
                this.klicken('input[value="zum Login"]')
            ]);
            await this.login();
        } else {
            await this.logger.log("Kein Login erforderlich - bereits angemeldet?");
        }
    }

    async programmaufruf(menuepunkt: string) {
        await this.logger.log("Programmaufruf: " + menuepunkt);
        await this.page.evaluate((menuepunkt) => window.programmaufruf(menuepunkt), menuepunkt);
    }

    async tippen(text: string, selector: string | undefined = undefined, options?: Readonly<KeyboardTypeOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        if (selector) {
            return await this.page.type(selector, text, options);
        }
        return await this.page.keyboard.type(text, options);
    }

    async tippenMel(text: string, num: number) {
        await this.tippen(text, `input[id="${await this.getAktWindowID()}_FPOS1_${num}-inputEl"]`, { delay: this.tippenZeit });
        await this.drucken('Enter');
    }

    async warten<Selector extends string>(selector: Selector, options?: WaitForSelectorOptions): Promise<ElementHandle<NodeFor<Selector>> | null> {
        await this.logger.log("Warte auf Element: " + selector);
        return await this.page.waitForSelector(selector, options);
    }

    async wartenBisMaskeGeladen() {
        await this.$(`[id="${await this.getAktWindowID()}-body"]`);
    }
}