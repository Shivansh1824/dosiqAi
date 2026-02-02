import * as FileSystem from 'expo-file-system/legacy';

// @ts-ignore
// @ts-ignore
export const LOG_FILE_PATH = `${FileSystem.cacheDirectory}notification_debug.log`;
const LOG_FILE = LOG_FILE_PATH;

export async function logDebug(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  // const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
  
  // CRITICAL FIX: Disable File I/O logging to prevent crash loop.
  // The 'read-trim-write' cycle on every log was causing excessive bridge traffic and freezing the UI.
  console.log(`[DEBUG_LOG] ${message}`, data || '');

  /* 
  try {
    let currentContent = '';
    try {
        currentContent = await FileSystem.readAsStringAsync(LOG_FILE);
    } catch (e) {
        currentContent = '';
    }
    
    // Keep only last 1000 lines for performance
    const lines = currentContent.split('\n');
    const trimmedContent = lines.slice(-1000).join('\n');
    
    await FileSystem.writeAsStringAsync(LOG_FILE, trimmedContent + logEntry);
  } catch (error) {
    console.error('Failed to write debug log:', error);
  }
  */
}
export async function getLogs(): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(LOG_FILE);
  } catch (error) {
    return 'No logs found (or error reading them).';
  }
}
export async function clearLogs() {
  try {
    await FileSystem.writeAsStringAsync(LOG_FILE, '');
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
}
