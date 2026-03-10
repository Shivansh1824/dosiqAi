// Audio playback management using expo-audio (New Architecture compatible)
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';

// App Assets
const TUNE_3S = require('../../assets/sounds/dosiqai_alert_3s.mp3');
const TUNE_6S = require('../../assets/sounds/dosiqai_alert_6s.mp3');
const TUNE_12S = require('../../assets/sounds/dosiqai_alert_12s.mp3');

import { Platform } from 'react-native';

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

export const getNoSoundOption = () => NO_SOUND_TUNE;

// iOS default sound option
const IOS_DEFAULT_TUNE: Tune = {
    id: 'ios_default',
    name: 'Default Notification Sound',
    duration: 'System',
    filename: 'default',
    type: 'system',
};

let currentSound: any = null;
let currentSubscription: any = null;

// The rest of the playback logic
export async function playTunePreview(tune: Tune): Promise<void> {
    // Stop any currently playing sound
    await stopPreview();

    if (tune.type === 'none' || (tune.type === 'system' && Platform.OS === 'ios')) {
        return;
    }

    try {
        let source = null;
        if (tune.type === 'app' && tune.file) {
            source = tune.file;
        } else if (tune.type === 'system' && tune.uri && Platform.OS === 'android') {
            source = tune.uri;
        }

        if (source) {
            const player = createAudioPlayer(source);
            currentSound = player;
            player.play();
        }
    } catch (error) {
        console.error('Error playing tune preview:', error);
        throw error;
    }
}

export async function stopPreview(): Promise<void> {
    if (currentSubscription) {
        currentSubscription.remove();
        currentSubscription = null;
    }

    if (currentSound) {
        try {
            currentSound.pause();
        } catch (error) {
            console.warn('Error stopping preview:', error);
        }
        currentSound = null;
    }
}

export function onPlaybackFinish(callback: () => void): void {
    if (currentSound) {
        currentSubscription = currentSound.addListener('playbackStatusUpdate', (status: any) => {
            if (status.didJustFinish) {
                callback();
                if (currentSubscription) {
                    currentSubscription.remove();
                    currentSubscription = null;
                }
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

export function getAppTunes(): Tune[] {
    return APP_TUNES;
}

export async function getSystemTunes(): Promise<Tune[]> {
    // This would normally use native modules to fetch system sounds
    // For now, return empty or implement basic logic if needed
    return [];
}

