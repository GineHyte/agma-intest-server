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
    "url": "https://srv-ent/csp/azu/AnmeldungiFood2.CSP",
    "bediener": process.env.BEDIENER || "",
    "kennwort": process.env.KENNWORT || "",
    "defaultMediaPath": "media/",
    "defaultLogPath": "logs/",
    "haltZeit": 200,
    "tippenZeit": 10,
    "databasePath": "database.db",
    "jwtExpires": 3600,
    "jwtSecret": process.env.JWT_SECRET || "",
    "workerCount": 5
}

export default config;
