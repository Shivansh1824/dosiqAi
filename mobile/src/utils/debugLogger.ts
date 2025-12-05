import { File, Paths } from 'expo-file-system';

// Create a File object for the debug log file
const logFile = new File(Paths.document, 'debug_logs.txt');

/**
 * Appends a log entry to the debug log file.
 * @param level 'INFO' | 'WARN' | 'ERROR'
 * @param message The main log message
 * @param data Optional data object to stringify
 */
export const logToDebugFile = async (
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    data?: any
) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''
        }\n`;

    try {
        let currentContent = '';
        if (logFile.exists) {
            currentContent = await logFile.text();
        }
        const newContent = currentContent + logEntry;
        await logFile.write(newContent);
        console.log(`[DebugLogger] Wrote to file: ${message}`);
    } catch (error) {
        console.error('[DebugLogger] Failed to write log:', error);
    }
};

/**
 * Reads the content of the debug log file.
 */
export const getDebugLogs = async (): Promise<string> => {
    try {
        if (!logFile.exists) {
            return 'No logs found.';
        }
        return await logFile.text();
    } catch (error) {
        console.error('[DebugLogger] Failed to read logs:', error);
        return `Error reading logs: ${error}`;
    }
};

/**
 * Clears the debug log file.
 */
export const clearDebugLogs = async () => {
    try {
        if (logFile.exists) {
            await logFile.delete();
        }
        console.log('[DebugLogger] Logs cleared.');
    } catch (error) {
        console.error('[DebugLogger] Failed to clear logs:', error);
    }
};

// Helper for error logging
export const logError = (message: string, error: any) => {
    logToDebugFile('ERROR', message, error);
};
