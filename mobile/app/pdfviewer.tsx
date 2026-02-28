import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { Colors, Typography, Sizes } from '../src/constants';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PdfViewerScreen() {
  const router = useRouter();
  const { uri: rawUri, title: rawTitle } = useLocalSearchParams();
  const uri = Array.isArray(rawUri) ? rawUri[0] : (rawUri || '');
  const title = Array.isArray(rawTitle) ? rawTitle[0] : (rawTitle || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loadAttempts, setLoadAttempts] = useState(0);

  // Validate URI on mount
  useEffect(() => {
    const validateFile = async () => {
      console.log('[PdfViewer] Validating URI:', uri);
      console.log('[PdfViewer] Title:', title);

      if (!uri.startsWith('file://') && !uri.startsWith('http://') && !uri.startsWith('https://')) {
        console.error('[PdfViewer] Invalid URI format:', uri);
        setError(`Invalid file path format. Expected file:// protocol but got: ${uri.substring(0, 50)}...`);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // For local files, check if it exists
        if (uri.startsWith('file://')) {
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) {
            throw new Error('PDF file not found');
          }
        }

        console.log('[PdfViewer] File validated successfully');
        setLoading(false);
      } catch (err: any) {
        console.error('[PdfViewer] Error validating file:', err);
        setLoading(false);
        setError('Failed to load PDF file. The file may be corrupted or inaccessible.');
      }
    };

    validateFile();
  }, [uri, title, loadAttempts]);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleRetry = useCallback(() => {
    console.log('[PdfViewer] Retrying PDF load, attempt:', loadAttempts + 1);
    setLoading(true);
    setError(null);
    setLoadAttempts(prev => prev + 1);
  }, [loadAttempts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.closeButtonBackground}>
          <Feather name="x" size={24} color={Colors.white} />
        </View>
      </TouchableOpacity>

      {/* Loading State */}
      {loading && !error && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.retryButton, styles.openExternalButton]}
              onPress={async () => {
                try {
                  const isAvailable = await Sharing.isAvailableAsync();
                  if (isAvailable) {
                    await Sharing.shareAsync(uri, {
                      UTI: 'com.adobe.pdf',
                      mimeType: 'application/pdf',
                    });
                  }
                } catch (err) {
                  console.error('Error opening PDF externally:', err);
                }
              }}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={16} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.retryButtonText}>Open with System Viewer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PDF Viewer */}
      {!error && (
        <View style={styles.pdfContainer}>
          <WebView
            source={{ uri: uri }}
            style={styles.webview}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowingReadAccessToURL={uri}
            scalesPageToFit={true}
            bounces={true}
            scrollEnabled={true}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[WebView] Error loading PDF:', nativeEvent);
              setError('Failed to load PDF. Please try opening with system viewer.');
            }}
            onLoad={() => {
              console.log('[WebView] PDF loaded successfully');
            }}
          />
        </View>
      )}

      {/* Page Indicator */}
      {!loading && !error && numPages > 1 && (
        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            Page {currentPage} of {numPages}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: Sizes.zIndex.modal,
  },
  closeButtonBackground: {
    width: Sizes.minTouchTarget,
    height: Sizes.minTouchTarget,
    borderRadius: Sizes.minTouchTarget / 2,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Sizes.md,
  },
  loadingText: {
    color: Colors.white,
    fontSize: Typography.bodySmall,
    fontWeight: Typography.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Sizes.xl,
    gap: Sizes.lg,
  },
  errorText: {
    color: Colors.white,
    fontSize: Typography.body,
    textAlign: 'center',
    fontWeight: Typography.medium,
    lineHeight: Typography.body * 1.5,
  },
  errorButtons: {
    flexDirection: 'column',
    gap: Sizes.md,
    width: '100%',
    paddingHorizontal: Sizes.xl,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Sizes.xl,
    paddingVertical: Sizes.md,
    borderRadius: Sizes.radiusMd,
    marginTop: Sizes.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openExternalButton: {
    backgroundColor: Colors.success,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: Typography.body,
    fontWeight: Typography.semibold,
  },
  pdfContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  webview: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: Colors.black,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    alignSelf: 'center',
    backgroundColor: Colors.overlay,
    paddingHorizontal: Sizes.md,
    paddingVertical: Sizes.sm,
    borderRadius: Sizes.radiusLg,
  },
  pageText: {
    color: Colors.white,
    fontSize: Typography.bodySmall,
    fontWeight: Typography.medium,
  },
});
