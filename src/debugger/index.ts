import Painter from "./painter.ts";
import { formatTimestamp } from "../utils.ts";

const painter = Painter.instance;

painter.clear();
painter.println("Agmadata Intergration Tests Debugger");
painter.println("Connected to sqlitedb.");

const PAGE_SIZE = 40;
const UPDATE_INTERVAL = 500;

var isInMainMenu: boolean = true;


painter.handleKeyPress = async (line: string) => {
    painter.clear();
    painter.flushBuffer();
    if (line === 'w') {
        isInMainMenu = false;
        await painter.drawTable(
            'worker',
            ['ID', 'Status', 'Action', 'Message'],
            (data: any) => {
                return data.map((worker: any) => [
                    worker.id,
                    worker.status,
                    worker.action,
                    worker.message
                ])
            },
            0, PAGE_SIZE
        );
        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
    if (line === 'm') {
        isInMainMenu = false;
        await painter.drawTable(
            'macro',
            ['ID', 'UserMacroId', 'JWT', 'Result Message', 'Status', 'Entries Lenght', 'StartedAt', 'CompletedAt', 'String'],
            (data: any) => {
                return data.map((macro: any) => {
                    let startedAt = formatTimestamp(macro.startedAt);
                    let completedAt = formatTimestamp(macro.completedAt);
                    return [
                        macro.id,
                        macro.userMacroId,
                        macro.JWT ? macro.JWT.slice(0, 10) : "",
                        macro.resultMessage,
                        macro.status,
                        JSON.parse(macro.entries).length,
                        `${startedAt.date} ${startedAt.time}`,
                        `${completedAt.date} ${startedAt.time}`,
                        macro.string
                    ]
                })

            }, 0, PAGE_SIZE
        );
        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
    if (line === 'p') {
        isInMainMenu = false;
        await painter.drawTable(
            'protocol',
            ['ID', 'JWT', 'Timestamp', 'Message', 'Level', 'WorkerId'],
            (data: any) => {
                return data.map((protocol: any) => [
                    protocol.id,
                    protocol.JWT.slice(0, 10),
                    protocol.timestamp,
                    protocol.message,
                    protocol.level,
                    protocol.workerId
                ])
            },
            0, PAGE_SIZE
        );
        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
    if (line === 'q') {
        if (isInMainMenu) {
            painter.println("Quitting...");
            painter.close();
            process.exit(0);
        }
        painter.tableMode = false;
        isInMainMenu = true;
        painter.println("Quitting...");
        mainMenu();
    }
    if (painter.tableMode) {
        if (line === 'left') {
            painter.tableOffset = painter.tableOffset - painter.tableLimit < 0 ? 0 : painter.tableOffset - painter.tableLimit;
        }
        if (line === 'right') {
            if (painter.tableOffset + PAGE_SIZE < painter.tableTotal) {
                painter.tableOffset += PAGE_SIZE;
            }
        }
        painter.redrawTable();
    }
    if (line === 'o') {
        isInMainMenu = false;
        let workerId = parseInt(await painter.getUserInput("Enter Worker ID: "));
        await painter.drawTable(
            'protocol',
            ['ID', 'JWT', 'Timestamp', 'Message', 'Level', 'WorkerId'],
            (data: any) => {
                return data.map((protocol: any) => [
                    protocol.id,
                    protocol.JWT.slice(0, 10),
                    protocol.timestamp,
                    protocol.message,
                    protocol.level,
                    protocol.workerId
                ])
            },
            0, PAGE_SIZE,
            (db) => db.where('workerId', '=', workerId)
        );
        if (!painter.tableMode) { isInMainMenu = true; mainMenu(); }
        while (true) {
            if (isInMainMenu) { break; }
            painter.redrawTable();
            await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
        }
    }
}





function mainMenu() {
    painter.println("======================");
    painter.println("Commands:");
    painter.println("(W)orkers");
    painter.println("(M)acros");
    painter.println("(P)rotocol");
    painter.println("(Q)uit");
    painter.println("W(O)rker Protocol");
    painter.println("======================");
}

mainMenu();