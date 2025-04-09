import fs from "fs";
import Logger from "./logger.ts";
import config from "./config.ts";


/**
 * A utility class for capturing screenshots and recording screen activity from a browser page.
 * This class handles creating directories for media storage and manages recording sessions.
 */
export default class Recorder {
    private _recording?: any;
    private logger: Logger;
    private page: any;
    screencastPath: string = config.defaultScreencastPath;
    screencastFlag: boolean = config.defaultScreencastFlag;
    screencastLastName: string | undefined;


    /**
     * Creates a new Recorder instance.
     * 
     * @param page - The browser page to record or screenshot (typically a Playwright Page object)
     * @param logger - Logger instance for recording operation statuses and errors
     * @param screencastPath - Directory path where screenshots and recordings will be saved
     */
    constructor(page: any, logger: Logger) {
        this.page = page;
        this.logger = logger;
    }

    /**
     * Takes a screenshot of the current page state and saves it as a PNG file.
     * 
     * @param name - The filename for the screenshot (without extension)
     * @returns A Promise that resolves when the screenshot is saved
     */
    public async screenshot(name: string) {
        if (!this.screencastFlag) { return }
        if (this.page) {
            await this.page.screenshot({
                path: this.screencastPath + name + ".png",
            });
            await this.logger.log("Screenshot saved: " + name + ".png");
        }
    }

    /**
     * Starts screen recording of the current page.
     * 
     * @param name - The filename for the recording (without extension)
     * @returns A Promise that resolves when recording has started
     */
    public async startRecording(name: string) {
        if (!this.screencastFlag) { return }

        if (this.page) {
            if (!fs.existsSync(this.screencastPath)) {
                fs.mkdirSync(this.screencastPath, { recursive: true });
            }
            this.screencastLastName = name;
            this._recording = await this.page.screencast({ path: `${this.screencastPath}${name}.webm` });
            await this.logger.log("Recording started: " + name + ".webm");
        }
    }

    /**
     * Stops the current screen recording if one is in progress.
     * 
     * @returns A Promise that resolves when recording has stopped
     */
    public async stopRecording() {
        if (!this.screencastFlag) { return }
        if (this._recording) {
            await this._recording.stop();
            await this.logger.log("Recording stopped");
            this._recording = undefined;
        }
    }
}