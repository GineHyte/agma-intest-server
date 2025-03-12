import fs from "fs";
import Logger from "./logger.ts";
import config from "./config.ts";


/**
 * A utility class for capturing screenshots and recording screen activity from a browser page.
 * This class handles creating directories for media storage and manages recording sessions.
 */
export default class Recorder {
    private page: any;
    private mediaPath: string;
    private logger: Logger;
    private _recording?: any;

    /**
     * Creates a new Recorder instance.
     * 
     * @param page - The browser page to record or screenshot (typically a Playwright Page object)
     * @param logger - Logger instance for recording operation statuses and errors
     * @param mediaPath - Directory path where screenshots and recordings will be saved
     */
    constructor(page: any, logger: Logger, mediaPath: string = config.defaultMediaPath) {
        this.page = page;
        this.logger = logger;
        this.mediaPath = mediaPath;
        try {
            if (!fs.existsSync(this.mediaPath)) {
                fs.mkdirSync(this.mediaPath, { recursive: true });
            }
        } catch (err) {
            this.logger.error('Error creating directories: ', err);
        }
    }

    /**
     * Takes a screenshot of the current page state and saves it as a PNG file.
     * 
     * @param name - The filename for the screenshot (without extension)
     * @returns A Promise that resolves when the screenshot is saved
     */
    public async screenshot(name: string) {
        if (this.page) {
            await this.page.screenshot({
                path: this.mediaPath + name + ".png",
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
        if (this.page) {
            this._recording = await this.page.screencast({ path: `${this.mediaPath}${name}.webm` });
            await this.logger.log("Recording started: " + name + ".webm");
        }
    }

    /**
     * Stops the current screen recording if one is in progress.
     * 
     * @returns A Promise that resolves when recording has stopped
     */
    public async stopRecording() {
        if (this._recording) {
            await this._recording.stop();
            await this.logger.log("Recording stopped");
            this._recording = undefined;
        }
    }
}