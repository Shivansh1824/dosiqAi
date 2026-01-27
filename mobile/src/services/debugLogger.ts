import * as FileSystem from 'expo-file-system/legacy';

// @ts-ignore
// @ts-ignore
export const LOG_FILE_PATH = `${FileSystem.cacheDirectory}notification_debug.log`;
const LOG_FILE = LOG_FILE_PATH;

export async function logDebug(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
  
  try {
    let currentContent = '';
    try {
        // Try reading first
        currentContent = await FileSystem.readAsStringAsync(LOG_FILE);
    } catch (e) {
        // File likely doesn't exist, start empty
        currentContent = '';
    }
    
    // Keep only last 1000 lines for performance
    const lines = currentContent.split('\n');
    const trimmedContent = lines.slice(-1000).join('\n');
    
    await FileSystem.writeAsStringAsync(LOG_FILE, trimmedContent + logEntry);
    console.log(`[DEBUG_LOG] ${message}`, data || '');
  } catch (error) {
    console.error('Failed to write debug log:', error);
  }
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
