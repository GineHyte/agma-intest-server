import fs from "fs";
import Logger from "./logger.ts";
import config from "./config.ts";


/**
 * Eine Hilfsklasse zum Erfassen von Screenshots und Aufzeichnen von Bildschirmaktivitäten einer Browser-Seite.
 * Diese Klasse verwaltet die Erstellung von Verzeichnissen für die Medienspeicherung und steuert Aufzeichnungssitzungen.
 */
export default class Recorder {
    private _recording?: any;
    private logger: Logger;
    private page: any;
    screencastPath: string = config.defaultScreencastPath;
    screencastFlag: boolean = config.defaultScreencastFlag;
    screencastLastName: string | undefined;


    /**
     * Erstellt eine neue Recorder-Instanz.
     * 
     * @param page - Die Browser-Seite, die aufgezeichnet oder fotografiert werden soll (typischerweise ein Playwright Page-Objekt)
     * @param logger - Logger-Instanz zur Aufzeichnung von Betriebszuständen und Fehlern
     * @param screencastPath - Verzeichnispfad, in dem Screenshots und Aufzeichnungen gespeichert werden
     */
    constructor(page: any, logger: Logger) {
        this.page = page;
        this.logger = logger;
    }

    /**
     * Nimmt einen Screenshot vom aktuellen Seitenzustand auf und speichert ihn als PNG-Datei.
     * 
     * @param name - Der Dateiname für den Screenshot (ohne Erweiterung)
     * @returns Ein Promise, das aufgelöst wird, wenn der Screenshot gespeichert ist
     */
    public async screenshot(name: string) {
        if (!this.screencastFlag) { return }
        if (this.page) {
            await this.page.screenshot({
                path: this.screencastPath + name + ".png",
            });
            await this.logger.log("Screenshot gespeichert: " + name + ".png");
        }
    }

    /**
     * Startet die Bildschirmaufzeichnung der aktuellen Seite.
     * 
     * @param name - Der Dateiname für die Aufzeichnung (ohne Erweiterung)
     * @returns Ein Promise, das aufgelöst wird, wenn die Aufzeichnung gestartet wurde
     */
    public async startRecording(name: string) {
        if (!this.screencastFlag) { return }

        if (this.page) {
            if (!fs.existsSync(this.screencastPath)) {
                fs.mkdirSync(this.screencastPath, { recursive: true });
            }
            this.screencastLastName = name;
            this._recording = await this.page.screencast({ path: `${this.screencastPath}${name}.webm` });
            await this.logger.log("Aufzeichnung gestartet: " + `${this.screencastPath}${name}.webm`);
        }
    }

    /**
     * Stoppt die aktuelle Bildschirmaufzeichnung, falls eine läuft.
     * 
     * @returns Ein Promise, das aufgelöst wird, wenn die Aufzeichnung gestoppt wurde
     */
    public async stopRecording() {
        if (!this.screencastFlag) { return }
        if (this._recording) {
            await this._recording.stop();
            await this.logger.log("Aufzeichnung gestoppt");
            this._recording = undefined;
        }
    }
}