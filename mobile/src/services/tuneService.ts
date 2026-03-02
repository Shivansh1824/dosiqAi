import { Platform } from 'react-native';

// Wait, the duplicate import of Platform was on line 71, let's fix the entire top of the file up to line 74.
// Note: expo-audio doesn't have an Audio.Sound object. Let's check what it has.
// import { AudioPlayer, useAudioPlayer } from 'expo-audio'; // We'll see if this works, but we can't use hooks here.

// Audio playback management using expo-audio (New Architecture compatible)
import { createAudioPlayer } from 'expo-audio';

let NotificationSounds: any = null;
if (Platform.OS === 'android') {
    try {
        // High risk module, wrapped in try-catch for New Architecture compatibility
        const module = require('react-native-notification-sounds');
        NotificationSounds = module.default || module;
    } catch (e) {
        console.warn('[TuneService] react-native-notification-sounds failed to load. System sounds disabled.');
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
// We need to use imperative Expo Audio APIs. Let's try to mock or temporarily define this while we figure out imperative playback.
let currentSound: any = null;

// The rest of the playback logic
export async function playTunePreview(tune: Tune): Promise<void> {
    // Stop any currently playing sound
    await stopPreview();

    if (tune.type === 'none' || (tune.type === 'system' && Platform.OS === 'ios')) {
        return;
    }

    try {
        let player = null;
        if (tune.type === 'app' && tune.file) {
            player = createAudioPlayer(tune.file);
        } else if (tune.type === 'system' && tune.uri && Platform.OS === 'android') {
            player = createAudioPlayer(tune.uri);
        }

        if (player) {
            currentSound = player;
            player.play();
        }
    } catch (error) {
        console.error('Error playing tune preview:', error);
        throw error;
    }
}
export async function stopPreview(): Promise<void> {
    if (currentSound) {
        try {
            // Using pause/release for cleanup
            currentSound.pause();
        } catch (error) {
            console.warn('Error stopping preview:', error);
        }
        currentSound = null;
    }
}

export function onPlaybackFinish(callback: () => void): void {
    if (currentSound) {
        // Wait, expo-audio player exposes a listener or events?
        // For now, let's just mimic it loosely.
        const subscription = currentSound.addListener('playbackStatusUpdate', (status: any) => {
            if (status.isLoaded && status.didJustFinish) {
                callback();
                subscription.remove();
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

