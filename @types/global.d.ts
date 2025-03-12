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
}

// This export is necessary to make the file a module
export {};