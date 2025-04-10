import express from 'express';
import macroRoute from './routes/macroRoute.ts';
import authRoute from './routes/authRoute.ts';
import { initSystemLogger, systemLogger } from './logger.ts'
import { db, up as databaseUp, down as databaseDown, initSystemSessionForLogging } from './database.ts';
import TestMaster from './tester/master.ts';

// Function to gracefully shut down the application
export async function shutdown() {
    await systemLogger.log('Graceful shutdown initiated');
    await TestMaster.instance.teardown();
    await systemLogger.log('TestMaster teardown complete');
    await systemLogger.log('Closing database connection');
    if (process.send) {
        process.send('shutdown');
    }
}

// Main application functionality
export async function runApp() {
    await systemLogger.log('Anwendung wird gestartet...');
    const app = express();
    const testMaster = TestMaster.instance;
    
    app.use(async (req, res, next) => {
        const start = Date.now();
        await systemLogger.log(`HTTP ${req.method} ${req.url} - Gestartet`);
        
        res.on('finish', async () => {
            const duration = Date.now() - start;
            await systemLogger.log(
                `HTTP ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`
            );
        });
        
        next();
    });

    app.use(express.json());
    app.use('/macro', macroRoute);
    app.use('/auth', authRoute);
    
    
    app.listen(3000, async () => {
        await systemLogger.log('Server hört auf Port 3000');
        await systemLogger.log('Datenbank wird eingerichtet...');
        try { await databaseDown(db); } catch { } // Drop tables (TODO: Remove this line in production)
        await databaseUp(db);
        await systemLogger.log('Datenbank-Setup abgeschlossen');
        await initSystemSessionForLogging(); // Create system session for logging
        await initSystemLogger(); // Initialize system logger
        await systemLogger.log('Everything with Protocol table is set up!');
        await testMaster.init();
        await systemLogger.log('Server is running on port 3000');
    });
}