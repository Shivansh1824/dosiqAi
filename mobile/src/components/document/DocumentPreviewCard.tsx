import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors, Typography } from '../../constants';
import { DocumentPreviewLoading } from '../prescription';

interface DocumentPreviewCardProps {
  isPdf: boolean;
  imageUri: string | null;
  fileNotFound: boolean;
  downloading: boolean;
  onViewFullScreen: () => void;
  onDownload: () => void;
}

export function DocumentPreviewCard({
  isPdf,
  imageUri,
  fileNotFound,
  downloading,
  onViewFullScreen,
  onDownload,
}: DocumentPreviewCardProps) {
  return (
    <View style={styles.previewCard}>
      {fileNotFound ? (
        <>
          <View style={styles.previewIconContainer}>
            <Feather name="alert-circle" size={64} color={Colors.error} />
          </View>
          <Text style={styles.previewText}>File Not Found</Text>
          <Text style={styles.errorText}>
            The document file could not be found on this device.
          </Text>
        </>
      ) : isPdf && imageUri ? (
        <>
          <View style={styles.pdfPreviewWrapper}>
            <WebView
              source={{ uri: imageUri }}
              style={styles.pdfPreview}
              originWhitelist={['*']}
              scalesPageToFit={true}
              useWebKit={true}
              scrollEnabled={false}
              pointerEvents="none" // Prevent interaction in the card preview
            />

            {/* Floating Action Buttons - Overlay on PDF */}
            <View style={styles.floatingButtonContainer}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={onViewFullScreen}
                activeOpacity={0.7}
              >
                <View style={styles.actionIconCircle}>
                  <Feather name="eye" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.actionCardLabel}>View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={onDownload}
                activeOpacity={0.7}
                disabled={downloading}
              >
                <View style={styles.actionIconCircle}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Feather name="download" size={20} color={Colors.primary} />
                  )}
                </View>
                <Text style={styles.actionCardLabel}>
                  {downloading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : imageUri ? (
        <>
          <View>
            <Image
              source={{ uri: imageUri }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />

            {/* Floating Action Buttons - Overlay on Image */}
            <View style={styles.floatingButtonContainer}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={onViewFullScreen}
                activeOpacity={0.7}
              >
                <View style={styles.actionIconCircle}>
                  <Feather name="eye" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.actionCardLabel}>View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={onDownload}
                activeOpacity={0.7}
                disabled={downloading}
              >
                <View style={styles.actionIconCircle}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Feather name="download" size={20} color={Colors.primary} />
                  )}
                </View>
                <Text style={styles.actionCardLabel}>
                  {downloading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <DocumentPreviewLoading />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  previewCard: {
    margin: 16,
    marginBottom: 24,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  previewIconContainer: {
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  previewText: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.gray900,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.gray500,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    lineHeight: 20,
  },
  pdfPreviewWrapper: {
    width: '100%',
    height: 480,
    backgroundColor: Colors.gray100,
    position: 'relative',
  },
  pdfPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gray100,
  },
  heroImage: {
    width: '100%',
    height: 480,
    backgroundColor: Colors.gray100,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
    elevation: 4,
  },
  actionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  actionCardLabel: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semibold,
    color: Colors.gray800,
  },
});
