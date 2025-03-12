import express from 'express';
import macroRoute from './routes/macroRoute.ts';
import authRoute from './routes/authRoute.ts';
import Logger, { initSystemLogger, systemLogger } from './logger.ts'
import { db, up as databaseUp, down as databaseDown, initSystemSessionForLogging } from './database.ts';
import TestMaster from './tester/master.ts';

const app = express();

app.use(express.json());
app.use('/macro', macroRoute);
app.use('/auth', authRoute);

app.listen(3000, async () => {
    try { await databaseDown(db); } catch { } // Drop tables (TODO: Remove this line in production)
    await databaseUp(db);
    await initSystemSessionForLogging(); // Create system session for logging
    initSystemLogger(); // Initialize system logger
    systemLogger.log('Everything with Protocol table is set up!');
    TestMaster.instance.setup();
    systemLogger.log('Server is running on port 3000');
});