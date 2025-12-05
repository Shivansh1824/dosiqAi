import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cache Service for AsyncStorage
 * Provides utilities for caching data locally to enable instant load + background refresh
 */

const CACHE_PREFIX = 'cache:';
const CACHE_VERSION = 'v1';

/**
 * Cache key generators for different data types
 */
export const CacheKeys = {
    documents: (userId: string) => `${CACHE_PREFIX}${CACHE_VERSION}:documents:${userId}`,
    medications: (userId: string) => `${CACHE_PREFIX}${CACHE_VERSION}:medications:${userId}`,
    appointments: (userId: string) => `${CACHE_PREFIX}${CACHE_VERSION}:appointments:${userId}`,
    familyMembers: (userId: string) => `${CACHE_PREFIX}${CACHE_VERSION}:familyMembers:${userId}`,
};

/**
 * Save data to cache
 * @param key - Cache key
 * @param data - Data to cache (will be JSON stringified)
 */
export const saveToCache = async <T>(key: string, data: T): Promise<void> => {
    try {
        const cacheData = {
            data,
            timestamp: Date.now(),
            version: CACHE_VERSION,
        };
        await AsyncStorage.setItem(key, JSON.stringify(cacheData));
        console.log(`[CacheService] Saved to cache: ${key}`);
    } catch (error) {
        console.error(`[CacheService] Error saving to cache (${key}):`, error);
        // Don't throw - caching is non-critical
    }
};

/**
 * Load data from cache
 * @param key - Cache key
 * @returns Cached data or null if not found/expired
 */
export const loadFromCache = async <T>(key: string): Promise<T | null> => {
    try {
        const cached = await AsyncStorage.getItem(key);
        if (!cached) {
            console.log(`[CacheService] No cache found for: ${key}`);
            return null;
        }

        const cacheData = JSON.parse(cached);

        // Validate cache version
        if (cacheData.version !== CACHE_VERSION) {
            console.log(`[CacheService] Cache version mismatch for: ${key}`);
            await AsyncStorage.removeItem(key);
            return null;
        }

        console.log(`[CacheService] Loaded from cache: ${key} (age: ${Date.now() - cacheData.timestamp}ms)`);
        return cacheData.data as T;
    } catch (error) {
        console.error(`[CacheService] Error loading from cache (${key}):`, error);
        return null;
    }
};

/**
 * Clear specific cache entry
 * @param key - Cache key to clear
 */
export const clearCache = async (key: string): Promise<void> => {
    try {
        await AsyncStorage.removeItem(key);
        console.log(`[CacheService] Cleared cache: ${key}`);
    } catch (error) {
        console.error(`[CacheService] Error clearing cache (${key}):`, error);
    }
};

/**
 * Clear all app cache (useful for logout)
 */
export const clearAllCache = async (): Promise<void> => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

        if (cacheKeys.length > 0) {
            await AsyncStorage.multiRemove(cacheKeys);
            console.log(`[CacheService] Cleared ${cacheKeys.length} cache entries`);
        }
    } catch (error) {
        console.error('[CacheService] Error clearing all cache:', error);
    }
};

/**
 * Get cache metadata (timestamp, age)
 * @param key - Cache key
 */
export const getCacheMetadata = async (key: string): Promise<{ timestamp: number; age: number } | null> => {
    try {
        const cached = await AsyncStorage.getItem(key);
        if (!cached) return null;

        const cacheData = JSON.parse(cached);
        return {
            timestamp: cacheData.timestamp,
            age: Date.now() - cacheData.timestamp,
        };
    } catch (error) {
        console.error(`[CacheService] Error getting cache metadata (${key}):`, error);
        return null;
    }
};
