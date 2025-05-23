const config = {
    "launchOptions": {
        headless: false,
        args: [
            "--incognito",
            "--disable-hang-monitor",
            "--ignore-certificate-errors",
            "--ignore-certificate-errors-spki-list"
        ],
    },
    "viewport": {
        "width": 1920,
        "height": 1000
    },
    "url": "http://localhost:52773/csp/azu/AnmeldungiFood2.CSP",
    "bediener": process.env.BEDIENER || "",
    "kennwort": process.env.KENNWORT || "",
    "defaultScreencastPath": "C:/Users/oleksii/agma-intest-server/media/",
    "defaultLogPath": "C:/Users/oleksii/agma-intest-server/logs/",
    "defaultScreencastFlag": false,
    "defaultLogFlag": false,
    "haltZeit": 200,
    "tippenZeit": 10,
    "databasePath": "database.db",
    "jwtExpires": 1000 * 60 * 60 * 24, // 24 hours
    "jwtSecret": process.env.JWT_SECRET || "",
    "workerCount": 2,
    "elementTimeout": 5000,
}

export default config;
