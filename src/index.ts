import { shutdown, runApp } from './app.ts';

// Handle process messages for graceful shutdown
process.on('message', async (msg) => {
    if (msg === 'shutdown') {
        await shutdown();
    }
});

// Run the application
runApp().catch(err => {
    console.error('Error in application:', err);
    process.exit(1);
});