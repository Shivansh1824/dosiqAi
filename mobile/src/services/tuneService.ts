// Audio playback management using expo-audio (New Architecture compatible)
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';

// App Assets
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

const TUNE_3S_MP3 = require('../../assets/sounds/dosiqai_alert_3s.mp3');
const TUNE_6S_MP3 = require('../../assets/sounds/dosiqai_alert_6s.mp3');
const TUNE_12S_MP3 = require('../../assets/sounds/dosiqai_alert_12s.mp3');

const TUNE_3S_WAV = require('../../assets/sounds/dosiqai_alert_3s.wav');
const TUNE_6S_WAV = require('../../assets/sounds/dosiqai_alert_6s.wav');
const TUNE_12S_WAV = require('../../assets/sounds/dosiqai_alert_12s.wav');

const TUNE_3S = Platform.OS === 'ios' ? TUNE_3S_WAV : TUNE_3S_MP3;
const TUNE_6S = Platform.OS === 'ios' ? TUNE_6S_WAV : TUNE_6S_MP3;
const TUNE_12S = Platform.OS === 'ios' ? TUNE_12S_WAV : TUNE_12S_MP3;

export type TuneType = 'app' | 'system' | 'none';

export interface Tune {
    id: string;
    name: string;
    duration: string;
    durationMs: number;     // Precise duration for animation sync
    filename: string;       // For app tunes: file name, for system: URI/identifier
    file?: any;             // Audio asset (app tunes only)
    type: TuneType;
    uri?: string;           // System tune URI (Android)
}

// App tunes - available on all platforms
export const APP_TUNES: Tune[] = [
    { id: 'app_3s', name: 'dosiqAi Alert - 3s', duration: '3s', durationMs: 3420, filename: Platform.OS === 'ios' ? 'dosiqai_alert_3s.wav' : 'dosiqai_alert_3s.mp3', file: TUNE_3S, type: 'app' },
    { id: 'app_6s', name: 'dosiqAi Alert - 6s', duration: '6s', durationMs: 7840, filename: Platform.OS === 'ios' ? 'dosiqai_alert_6s.wav' : 'dosiqai_alert_6s.mp3', file: TUNE_6S, type: 'app' },
    { id: 'app_12s', name: 'dosiqAi Alert - 12s', duration: '12s', durationMs: 12260, filename: Platform.OS === 'ios' ? 'dosiqai_alert_12s.wav' : 'dosiqai_alert_12s.mp3', file: TUNE_12S, type: 'app' },
];


// No Sound option
export const NO_SOUND_TUNE: Tune = {
    id: 'none',
    name: 'No Sound',
    duration: '-',
    durationMs: 0,
    filename: 'none',
    type: 'none',
};

export const getNoSoundOption = () => NO_SOUND_TUNE;

// iOS default sound option
const IOS_DEFAULT_TUNE: Tune = {
    id: 'ios_default',
    name: 'Default Notification Sound',
    duration: 'System',
    durationMs: 3000,
    filename: 'default',
    type: 'system',
};

let currentSound: any = null;
let currentSubscription: any = null;

// Audio mode setup removed as it requires expo-av which is not present.
// We will rely on default playback behavior for now.

// The rest of the playback logic
export async function playTunePreview(tune: Tune): Promise<void> {
    console.log('[TuneService] playTunePreview called for:', tune.id);
    
    // Stop any currently playing sound
    await stopPreview();

    if (tune.type === 'none' || (tune.type === 'system' && Platform.OS === 'ios')) {
        console.log('[TuneService] Playback skipped for this type');
        return;
    }

    try {
        let source = null;
        if (tune.type === 'app' && tune.file) {
            // Reverted to using tune.file directly as expo-audio expects the required module integer.
            source = tune.file;
        } else if (tune.type === 'system' && tune.uri && Platform.OS === 'android') {
            source = tune.uri;
        }

        if (source) {
            console.log('[TuneService] Creating player with source:', tune.id);
            const player = createAudioPlayer(source);
            currentSound = player;
            
            // Set volume to max for preview
            player.volume = 1.0;
            
            console.log('[TuneService] player.play() invoked');
            player.play();
        } else {
            console.warn('[TuneService] No valid source found for tune:', tune.id);
        }
    } catch (error) {
        console.error('[TuneService] Playback Error:', error);
        throw error;
    }
}

export async function stopPreview(): Promise<void> {
    if (currentSound || currentSubscription) {
        console.log('[TuneService] stopPreview execution starting');
    }

    if (currentSubscription) {
        console.log('[TuneService] Cleaning up subscription');
        currentSubscription.remove();
        currentSubscription = null;
    }

    if (currentSound) {
        try {
            console.log('[TuneService] Pausing player');
            currentSound.pause();
        } catch (error) {
            console.warn('[TuneService] Pause warn:', error);
        }
        currentSound = null;
    }
}


export function onPlaybackFinish(callback: () => void): void {
    if (currentSound) {
        currentSubscription = currentSound.addListener('playbackStatusUpdate', (status: any) => {
            if (status.didJustFinish) {
                console.log('[TuneService] Playback finished naturally');
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

