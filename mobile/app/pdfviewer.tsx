import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import Pdf from 'react-native-pdf';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, Typography, Sizes } from '../src/constants';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ZOOM_THROTTLE_MS = 400;

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

  const [scale, setScale] = useState(1.0);
  // Track scale in a ref so throttled handlers always read the latest value
  const scaleRef = useRef(1.0);
  // Timestamp of last zoom action — used to throttle rapid button presses
  const lastZoomTime = useRef(0);

  // Memoize source to prevent re-renders on scale changes
  const source = useMemo(() => ({ uri, cache: true }), [uri]);

  // Validate URI on mount
  useEffect(() => {
    const validateFile = async () => {


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
          // @ts-ignore: getInfoAsync exists in legacy but isn't typed correctly
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists) {
            throw new Error('PDF file not found');
          }
        }


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

    setLoading(true);
    setError(null);
    setLoadAttempts(prev => prev + 1);
  }, [loadAttempts]);


  const handleZoomIn = useCallback(() => {
    const now = Date.now();
    if (now - lastZoomTime.current < ZOOM_THROTTLE_MS) return;
    lastZoomTime.current = now;
    const nextScale = Math.min(scaleRef.current + 0.5, 3.0);
    scaleRef.current = nextScale;
    setScale(nextScale);
  }, []);

  const handleZoomOut = useCallback(() => {
    const now = Date.now();
    if (now - lastZoomTime.current < ZOOM_THROTTLE_MS) return;
    lastZoomTime.current = now;
    const nextScale = Math.max(scaleRef.current - 0.5, 1.0);
    scaleRef.current = nextScale;
    setScale(nextScale);
  }, []);

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
        <View style={styles.pdfViewerWrapper}>
          <Pdf
            source={source}
            style={styles.pdfViewer}
            trustAllCerts={false}
            scale={scale}
            minScale={1.0}
            maxScale={3.0}
            spacing={10}
            enableDoubleTapZoom={true}
            onScaleChanged={(newScale) => {
              // Keep ref in sync when user pinch-zooms natively (no state update to avoid re-render)
              scaleRef.current = newScale;
            }}
            onLoadComplete={(numberOfPages) => {
              setNumPages(numberOfPages);
              setLoading(false);
            }}
            onPageChanged={(page) => {
              setCurrentPage(page);
            }}
            onError={(err) => {
              setError('Failed to load PDF. Please try opening with system viewer.');
              setLoading(false);
            }}
          />
        </View>
      )}

      {/* Zoom Controls */}
      {!loading && !error && (
        <View style={styles.zoomControls}>
          <TouchableOpacity 
              style={styles.zoomButton} 
              onPress={handleZoomIn}
              activeOpacity={0.7}
          >
            <Feather name="plus" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity 
              style={styles.zoomButton} 
              onPress={handleZoomOut}
              activeOpacity={0.7}
          >
            <Feather name="minus" size={24} color={Colors.white} />
          </TouchableOpacity>
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
  pdfViewerWrapper: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  pdfViewer: {
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
  zoomControls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 110 : 90,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  zoomButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 8,
  },
});
