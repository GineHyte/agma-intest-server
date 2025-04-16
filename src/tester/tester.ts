import type {
    Page,
    EvaluateFuncWith,
    ElementHandle,
    NodeFor,
    KeyboardTypeOptions,
    ClickOptions,
    KeyInput,
    KeyPressOptions
} from 'puppeteer';
import config from '../config.ts';
import Logger from '../logger.ts';

/**
 * Test-Automatisierungsklasse für die Anwendungsoberfläche.
 * Ermöglicht das automatisierte Navigieren durch die Anwendung, Eingabe von Daten
 * und Ausführen von Aktionen wie Klicken, Tippen und Programmaufrufe.
 */
export default class Tester {
    private appStatus!: AppStatus;
    private haltZeit: number;
    private logger!: Logger;
    private page: Page;
    private tippenZeit: number;
    private currentTestStep: boolean = false;
    private fehler: boolean = false;
    private fehlerBeschreibung: string = '';

    /**
     * Erstellt eine neue Tester-Instanz.
     * 
     * @param page - Die Browser-Seite, auf der der Test ausgeführt wird
     * @param logger - Logger-Instanz für Protokollierung
     * @param haltZeit - Wartezeit zwischen Aktionen in Millisekunden
     * @param tippenZeit - Verzögerungszeit zwischen einzelnen Tastenanschlägen
     */
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

    /**
     * Analysiert den Anwendungsstatus und speichert die Informationen.
     * 
     * @private
     */
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

    /**
     * Sucht und wartet auf ein Element mit dem angegebenen Selektor.
     * 
     * @param selector - CSS-Selektor zum Finden des Elements
     * @param maxTime - Maximale Wartezeit in Millisekunden
     * @returns ElementHandle des gefundenen Elements
     * @throws Error wenn das Element nicht gefunden wird
     */
    async $(selector: string, maxTime: number = 30_000): Promise<ElementHandle<NodeFor<string>>> {
        await this.page.waitForSelector(selector, { timeout: maxTime });
        let element = await this.page.$(selector);
        if (!element) {
            this.logger.error("Element nicht gefunden: " + selector);
            throw new Error("Element nicht gefunden: " + selector);
        }
        return element;
    }

    /**
     * Führt eine Funktion auf einem Element mit dem angegebenen Selektor aus.
     * 
     * @param selector - CSS-Selektor zum Finden des Elements
     * @param pageFunction - Die auf dem Element auszuführende Funktion
     * @param args - Zusätzliche Argumente für die Funktion
     * @returns Ergebnis der Funktion
     */
    async $eval(selector: string, pageFunction: EvaluateFuncWith<any, any[]>, ...args: any): Promise<any> {
        let element = await this.$(selector);
        return element.evaluate(pageFunction, ...args);
    }

    /**
     * Wählt ein Element aus einer Auswahlliste aus.
     * 
     * @param auswahl - Index des auszuwählenden Elements oder -1 für Header
     */
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

    /**
     * Drückt eine Taste auf der Tastatur.
     * 
     * @param key - Die zu drückende Taste
     * @param options - Optionen für den Tastenvorgang
     * @returns Promise das aufgelöst wird, wenn die Taste gedrückt wurde
     */
    async drucken(key: KeyInput, options?: Readonly<KeyPressOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        return await this.page.keyboard.press(key, options);
    }

    /**
     * Gibt Text in ein Formularfeld ein.
     * 
     * @param feld - Nummer des Formularfeldes
     * @param text - Einzugebender Text
     * @param seite - Seitennummer des Formulars
     */
    async feldEingabe(feld: number, text: string, seite: number = 1) {
        if (!await (this.$('div[id=SeitenMenue1][class*=x-item-disabled]'))) { // wenn Seitenmenü nicht deaktiviert
            await this.klicken(`li[data-boundview="SeitenMenue1-picker"][data-recordindex="${seite}"]`);
        }

        let inputEl = await this.$(`[data-componentid="${await this.getAktWindowID()}_EDIT${seite}_${feld}"]`);
        if ((await (await inputEl.getProperty('ariaReadonly')).jsonValue()) === 'true' || !inputEl) {
            this.logger.error("Feld ist schreibgeschützt: " + feld);
            return;
        }
        await inputEl.type(text, { delay: this.tippenZeit });
        await this.drucken('Enter');
    }

    /**
     * Ermittelt die ID des aktuellen Fensters.
     * 
     * @returns ID des aktuellen Fensters
     */
    async getAktWindowID() {
        return await this.page.evaluate(() => window.windowID);
    }

    /**
     * Pausiert die Ausführung für die angegebene Zeit.
     * 
     * @param ms - Wartezeit in Millisekunden
     * @returns Promise das nach der Wartezeit aufgelöst wird
     */
    async halten(ms: number) {
        return await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Klickt auf ein Element mit dem angegebenen Selektor.
     * 
     * @param selector - CSS-Selektor des zu klickenden Elements
     * @param options - Optionen für den Klickvorgang
     * @returns Promise das aufgelöst wird, wenn der Klick ausgeführt wurde
     */
    async klicken(selector: string, options?: Readonly<ClickOptions>): Promise<void> {
        selector = this.replaceAllElementsIds(selector);
        await this.halten(this.haltZeit);
        let element = await this.$(selector);
        return await element.click(options);
    }

    /**
     * Führt den Login-Prozess in der Anwendung durch.
     */
    async login() {
        await this.tippen(config.bediener, '[data-componentid=name]', { delay: this.tippenZeit });
        await this.tippen(config.kennwort, '[data-componentid=kenn]', { delay: this.tippenZeit });
        await this.drucken('Enter');
        await this.drucken('Enter');
        await this.$('[id=image-1033]');                        // warten auf iFood Logo
        await this.parseAppStatus();

        await this.page.evaluate(() => {
            let FehlerJSProxy = (e: any, m: any) => {
                this.fehler = true;
                this.fehlerBeschreibung = e.message;
                window.FehlerJS(e, m)
            }
            window.FehlerJS = FehlerJSProxy;
        });
    }

    async keineLizenzen() {
        return await this.page.evaluate(() => Array.from(document.querySelectorAll('p'))
            .find(el => el.textContent === 'Leider sind keine Lizenzen mehr frei.')) !== undefined
    }

    /**
     * Führt den Logout-Prozess in der Anwendung durch.
     */
    async logout() {
        let counter = 0;
        this.currentTestStep = false;
        // Zurück zum Hauptbildschirm
        while ((await this.getAktWindowID()) !== '') {
            counter++;
            if (counter > 100) {
                this.logger.error("Fehler beim Abmelden (100 mal Escape -> nix)");
                return;
            }
            await this.drucken('Escape');
            await this.halten(10); // Kurze Pause zwischen Escape-Drücken
        }
        await this.programmaufruf("000");
        await this.$('input[value="zum Login"]'); // warten auf zum Login Button
    }

    /**
     * Führt einen erneuten Login in der Anwendung durch, falls erforderlich.
     */
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

    /**
     * Ruft ein Programm oder Menüpunkt in der Anwendung auf.
     * 
     * @param menuepunkt - ID des aufzurufenden Menüpunkts
     */
    async programmaufruf(menuepunkt: string) {
        await this.page.evaluate((menuepunkt) => window.programmaufruf(menuepunkt), menuepunkt);
        await this.halten(this.haltZeit);
    }

    /**
     * Gibt Text auf der Seite oder in einem bestimmten Element ein.
     * 
     * @param text - Einzugebender Text
     * @param selector - Optional: CSS-Selektor des Zielelements
     * @param options - Optionen für die Texteingabe
     * @returns Promise das aufgelöst wird, wenn der Text eingegeben wurde
     */
    async tippen(text: string, selector: string | undefined = undefined, options?: Readonly<KeyboardTypeOptions>): Promise<void> {
        await this.halten(this.haltZeit);
        if (selector) {
            return await this.page.type(selector, text, options);
        }
        return await this.page.keyboard.type(text, options);
    }

    /**
     * Gibt Text in ein Mehrfachauswahl-Feld ein.
     * 
     * @param text - Einzugebender Text
     * @param num - Nummer des Feldes
     */
    async tippenMel(text: string, num: number) {
        await this.tippen(text, `input[id="${await this.getAktWindowID()}_FPOS1_${num}-inputEl"]`, { delay: this.tippenZeit });
        await this.drucken('Enter');
    }

    /**
     * Wartet bis die aktuelle Maske geladen ist.
     */
    async wartenBisMaskeGeladen() {
        await this.$(`[id="${await this.getAktWindowID()}-body"]`);
    }

    /**
     * Ersetzt Platzhalter in einem Selektor durch aktuelle Werte.
     * 
     * @param str - Selektor-String mit Platzhaltern
     * @returns Fertig ersetzter Selektor-String
     * @private
     */
    private replaceAllElementsIds(str: string) {
        let res = str.replaceAll('||JBN||', this.appStatus.job.toString());
        return res;
    }

    /**
     * Zeigt den aktuellen Testschritt in der Benutzeroberfläche an.
     * 
     * @param key - Schlüssel oder Bezeichner des Testschritts
     * @param type - Typ des Testschritts
     */
    async showCurrentStep(key: string, type: string) {
        if (!this.currentTestStep) {
            let html = `<div style="display:flex;justify-content:center;align-items:center;">
                <span style="font-size:30px;flex: 0 0 120px" id="integration-test-label">${key} ${type}</span>
            </div>`
            await this.page.evaluate((html: string) => {
                let panel = window.Ext.create('Ext.Panel', {
                    floating: true,
                    alwaysOnTop: true,
                    renderTo: document.body,
                    html: html,
                    height: 50,
                    width: 200,
                    id: "integration-test-container",
                })
                panel.showAt(window.innerWidth - 200, 50)
            }, html)
            this.currentTestStep = true;
            return
        }
        await this.$eval('span[id="integration-test-label"]', (span: any, key: string, type: string) => {
            span.innerHTML = `${key} ${type}`
        }, key, type)
    }

    /**
     * Führt einen bestimmten Testschritt aus.
     * 
     * @param key - Schlüssel oder Bezeichner des Testschritts
     * @param type - Typ des Testschritts (bestimmt die auszuführende Aktion)
     */
    async testStep(key: string, type: string) {
        let windowID = await this.getAktWindowID()
        await this.showCurrentStep(key, type)
        await this.logger.log(`Testschritt: ${key} ${type}`)
        switch (type) {
            case 'M': // Maus
                await this.klicken(`[id="${key}"]`);
                break;
            case 'T': // Tastatur
                await this.drucken(key as KeyInput);
                break;
            case 'P': // Menüpunkt 
                await this.programmaufruf(key);
                break;
            case 'MAVBTN': // Maske Vertikaler Button 
                var klickId = await this.page.evaluate((ctrl: string) => {
                    let butbar = window.Ext.getCmp(`${windowID}butbar`)
                    let items = butbar.items.items
                    let butmap: any = {};
                    items.forEach((el: any) => {
                        butmap[el.cspConfig.badge.trim()] = el.cspConfig.idnr.trim()
                    });
                    return butmap[ctrl]
                }, key)
                await this.klicken(`[id="${windowID}_${klickId}"]`)
                break;
            case 'MFBTN':
                for (let i = 0; i < parseInt(key); i++) {
                    await this.drucken("ArrowDown");
                }
                await this.drucken("Enter");
                break;
            case 'MFSCHL':
                await this.drucken('Escape');
                break;
            case 'MATKLCK':
                var pos = key.split("^")
                var selectorForClick = await this.page.evaluate((col: number, row: number) => {
                    let senchagrid = window.grid[window.windIdx];
                    return senchagrid.view.el.dom.children[2].children[row].children[0].children[0].children[col].className
                }, parseInt(pos[0]), parseInt(pos[1]))
                await this.klicken(`[class="${selectorForClick}"]`)
                break;
            case 'MATDBLKLCK':
                var pos = key.split("^")
                var selectorForClick = await this.page.evaluate((col: number, row: number) => {
                    let senchagrid = window.grid[window.windIdx];
                    return senchagrid.view.el.dom.children[2].children[row].children[0].children[0].children[col].className
                }, parseInt(pos[0]), parseInt(pos[1]))
                await this.klicken(`[class="${selectorForClick}"]`, { count: 2 })
                break;
            case 'MATHEADKLCK':
                var selectorForClick = await this.page.evaluate((col: number) => {
                    let senchagrid = window.grid[window.windIdx];
                    return senchagrid.columns[col].id;
                }, parseInt(key))
                await this.klicken(`[id="${selectorForClick}"]`)
                break;
            case 'ALERTSCHL':
                var selectorForClick = await this.page.evaluate(() => window.Ext.Msg.down('button').el.dom.id)
                await this.klicken(`a[id="${selectorForClick}"]`)
                break;
            case 'MAVSEITE':
                var windIdx = await this.page.evaluate(() => window.windIdx)
                await this.klicken(`[id="SeitenMenue${windIdx}"] input`)
                await this.page.evaluate((key: number) => { window.Ext.getCmp("SeitenMenue" + window.windIdx).picker.setSelection(key) }, parseInt(key) - 1)
                break;
        }
    }
}