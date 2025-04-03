import { KeyInput } from "puppeteer";

declare global {
    interface AppStatus {
        uci: string;
        job: number;
        device: string;
        bediener: string
        version: string;
        mandant: string;
        jobverwaltungStatus: boolean; // true = aktiv, false = inaktiv
    }

    interface Window {
        AppStatus: string[];
        windowID: string;
        keyboardEventListener: (key: string) => void; // awaits a key as string
        keyboardEventListenerRefResolvent: (e: KeyboardEvent) => void; // awaits event and resolves key reference as string
        mouseEventListener: (id: string) => void; // awaits a id as string
        mouseEventListenerRefResolvent: (e: MouseEvent) => void; // awaits event and resolves target reference as object
        aufnahmeAgmaIntest: () => void;
        programmaufruf: (programm: string) => void;
        aufnahmeListeClear: () => void;
        ausfuehrenAgmaIntest: () => void;
        aufnahmeListeAgmaIntest: any; // Ext.Panel
        Ext: any;
    }

    type Status = "pending" | "running" | "completed" | "failed";
    type Level = "info" | "warn" | "error";
    type Action = string | "teardown" | "init" | "test";

    interface WorkerMessage {
        status: Status;
        action: Action;
        userMacroId?: string;
        JWT?: string;
        message?: string | unknown;
        id: number;
    }

    type KeyType = "M" | "T" | "P" | "MAVBTN" | "MFBTN" | "MATKLCK" | "MATDBLKLCK" | "MATHEADKLCK" | "MFSCHL" | "ALERTSCHL";

    interface Entry {
        type: KeyType;
        key: KeyInput;
    }

    interface MasterMessage {
        action: Action;
        JWT: string;
        userMacroId?: string;
        entries?: Entry[];
    }

    interface Database {
        session: {
            JWT: string
            YJBN: number
            YSYS: string
            YB: string
            YM: string
            expires: number
        }
        protocol: {
            id?: number
            JWT: string
            timestamp: number
            message?: string
            level: Level
            workerId?: number
        }
        macro: {
            id?: number
            JWT: string
            userMacroId?: string
            resultMessage?: string
            status?: Status
            entries?: string // JSON string
            startedAt?: number
            completedAt?: number
            workerId?: number
            string?: string
        }
        worker: {
            id: number
            threadId: number
            status: Status
            action: Action
            message?: string
        }
    }
}

// This export is necessary to make the file a module
export { };