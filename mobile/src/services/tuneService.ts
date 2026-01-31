import { Platform } from 'react-native';
import { Audio } from 'expo-av';

// Conditionally import for Android only
let NotificationSounds: any = null;
if (Platform.OS === 'android') {
    try {
        console.log('[TuneService] Requirement check for react-native-notification-sounds');
        const module = require('react-native-notification-sounds');
        
        // Comprehensive resolution
        if (module.getNotifications) {
            NotificationSounds = module;
        } else if (module.default && module.default.getNotifications) {
            NotificationSounds = module.default;
        } else {
            NotificationSounds = module.default || module;
        }
        
        console.log('[TuneService] NotificationSounds resolved. Methods:', 
            Object.keys(NotificationSounds).filter(k => typeof NotificationSounds[k] === 'function')
        );

    } catch (e) {
        console.warn('[TuneService] react-native-notification-sounds loading failed:', e);
    }
}

// Audio Assets
const TUNE_3S = require('../../assets/sounds/dosiqai_alert_3s.mp3');
const TUNE_6S = require('../../assets/sounds/dosiqai_alert_6s.mp3');
const TUNE_12S = require('../../assets/sounds/dosiqai_alert_12s.mp3');

export type TuneType = 'app' | 'system' | 'none';

export interface Tune {
    id: string;
    name: string;
    duration: string;
    filename: string;       // For app tunes: file name, for system: URI/identifier
    file?: any;             // Audio asset (app tunes only)
    type: TuneType;
    uri?: string;           // System tune URI (Android)
}

// App tunes - available on all platforms
export const APP_TUNES: Tune[] = [
    { id: 'app_3s', name: 'dosiqAi Alert - 3s', duration: '3s', filename: 'dosiqai_alert_3s.mp3', file: TUNE_3S, type: 'app' },
    { id: 'app_6s', name: 'dosiqAi Alert - 6s', duration: '6s', filename: 'dosiqai_alert_6s.mp3', file: TUNE_6S, type: 'app' },
    { id: 'app_12s', name: 'dosiqAi Alert - 12s', duration: '12s', filename: 'dosiqai_alert_12s.mp3', file: TUNE_12S, type: 'app' },
];

// No Sound option
export const NO_SOUND_TUNE: Tune = {
    id: 'none',
    name: 'No Sound',
    duration: '-',
    filename: 'none',
    type: 'none',
};

// iOS default sound option
const IOS_DEFAULT_TUNE: Tune = {
    id: 'ios_default',
    name: 'Default Notification Sound',
    duration: 'System',
    filename: 'default',
    type: 'system',
};

// Audio playback management
let currentSound: Audio.Sound | null = null;

/**
 * Get the app tunes (dosiqAi alerts)
 */
export function getAppTunes(): Tune[] {
    return APP_TUNES;
}

/**
 * Get the No Sound option
 */
export function getNoSoundOption(): Tune {
    return NO_SOUND_TUNE;
}

/**
 * Get system notification tunes based on platform
 * Android: Fetches device notification sounds
 * iOS: Returns single default notification sound option
 */
export async function getSystemTunes(): Promise<Tune[]> {
    console.log('[TuneService] getSystemTunes called for platform:', Platform.OS);
    if (Platform.OS === 'ios') {
        return [IOS_DEFAULT_TUNE];
    }

    if (Platform.OS === 'android' && NotificationSounds) {
        try {
            console.log('[TuneService] Calling NotificationSounds.getNotifications');
            const sounds = await NotificationSounds.getNotifications('notification');
            console.log('[TuneService] Raw sounds from library:', sounds ? (Array.isArray(sounds) ? sounds.length : typeof sounds) : 'null/undefined');
            
            if (!Array.isArray(sounds)) {
                console.warn('[TuneService] Received non-array from getNotifications');
                return [];
            }

            return sounds.map((sound: any, index: number) => ({
                id: `system_${index}_${sound.soundID || sound.url}`,
                name: sound.title || sound.name || `System Sound ${index + 1}`,
                duration: 'System',
                // Prefer URL/URI as the filename (identifier) so it can be used for Channel creation
                filename: sound.url || sound.soundID?.toString() || `system_${index}`,
                type: 'system' as TuneType,
                uri: sound.url,
            }));
        } catch (error) {
            console.error('[TuneService] Error fetching system sounds:', error);
            return [];
        }
    }

    console.log('[TuneService] Android path - NotificationSounds is null/undefined');
    return [];
}

/**
 * Play a tune preview
 * @param tune The tune to preview
 * @returns Promise that resolves when playback starts
 */
export async function playTunePreview(tune: Tune): Promise<void> {
    // Stop any currently playing sound
    await stopPreview();

    // Don't play preview for No Sound or iOS system sounds
    if (tune.type === 'none') {
        return;
    }

    if (tune.type === 'system' && Platform.OS === 'ios') {
        // iOS system sounds cannot be previewed programmatically
        return;
    }

    try {
        if (tune.type === 'app' && tune.file) {
            // Play app tune using expo-av
            const { sound } = await Audio.Sound.createAsync(tune.file);
            currentSound = sound;
            await sound.playAsync();
        } else if (tune.type === 'system' && tune.uri && Platform.OS === 'android') {
            // Play Android system sound
            const { sound } = await Audio.Sound.createAsync({ uri: tune.uri });
            currentSound = sound;
            await sound.playAsync();
        }
    } catch (error) {
        console.error('Error playing tune preview:', error);
        throw error;
    }
}

/**
 * Stop any currently playing preview
 */
export async function stopPreview(): Promise<void> {
    if (currentSound) {
        try {
            await currentSound.stopAsync();
            await currentSound.unloadAsync();
        } catch (error) {
            console.warn('Error stopping preview:', error);
        }
        currentSound = null;
    }
}

/**
 * Set up playback status listener for the current sound
 * @param callback Called when playback finishes
 */
export function onPlaybackFinish(callback: () => void): void {
    if (currentSound) {
        currentSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
                callback();
            }
        });
    }
}

/**
 * Find a tune by its filename/id from all available tunes
 * @param filename The filename or identifier to search for
 * @param systemTunes Optional array of system tunes to search
 */
export function findTuneByFilename(filename: string, systemTunes: Tune[] = []): Tune | undefined {
    // Check app tunes
    const appTune = APP_TUNES.find(t => t.filename === filename);
    if (appTune) return appTune;

    // Check no sound
    if (filename === 'none' || filename === NO_SOUND_TUNE.filename) {
        return NO_SOUND_TUNE;
    }

    // Check iOS default
    if (filename === 'default' || filename === IOS_DEFAULT_TUNE.filename) {
        return IOS_DEFAULT_TUNE;
    }

    // Check system tunes
    const systemTune = systemTunes.find(t => t.filename === filename);
    if (systemTune) return systemTune;

    return undefined;
}

/**
 * Get the default tune for the current platform
 */
export function getDefaultTune(): Tune {
    return APP_TUNES[0]; // Default to 3s dosiqAi alert
}

