const config = {
    "launchOptions": {
        headless: true,
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
    "jwtExpires": 1000 * 60 * 60 * 24, // 24 hours
    "jwtSecret": process.env.JWT_SECRET || "",
    "workerCount": 3
}

export default config;
