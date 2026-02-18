import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Pdf from 'react-native-pdf';
import { Colors } from '../../constants';
import { DocumentPreviewLoading } from './DocumentPreviewLoading';

interface DocumentPreviewProps {
    imageUri: string | null;
    isPdf: boolean;
    fileNotFound: boolean;
    downloading: boolean;
    onView: () => void;
    onDownload: () => void;
}

/**
 * DocumentPreview - Document preview card with image/PDF display and action buttons
 * Extracted from PrescriptionSummaryScreen.tsx
 */
export function DocumentPreview({
    imageUri,
    isPdf,
    fileNotFound,
    downloading,
    onView,
    onDownload,
}: DocumentPreviewProps) {
    if (fileNotFound) {
        return (
            <View style={styles.previewCard}>
                <View style={styles.previewIconContainer}>
                    <Feather name="alert-circle" size={64} color={Colors.error} />
                </View>
                <Text style={styles.previewText}>File Not Found</Text>
                <Text style={styles.errorText}>
                    The document file could not be found on this device.
                </Text>
            </View>
        );
    }

    if (isPdf && imageUri) {
        return (
            <View style={styles.previewCard}>
                <View style={styles.pdfPreviewWrapper}>
                    <Pdf
                        source={{ uri: imageUri, cache: true }}
                        page={1}
                        scale={1.0}
                        minScale={1.0}
                        maxScale={1.0}
                        spacing={0}
                        fitPolicy={0}
                        enablePaging={false}
                        enableRTL={false}
                        enableAnnotationRendering={false}
                        style={styles.pdfPreview}
                        onLoadComplete={(numberOfPages) => {
                            console.log(`[DocumentPreview] PDF Loaded: ${numberOfPages} pages`);
                        }}
                        onError={(error) => {
                            console.error('[DocumentPreview] PDF Error:', error);
                        }}
                    />
                    <ActionButtons
                        downloading={downloading}
                        onView={onView}
                        onDownload={onDownload}
                    />
                </View>
            </View>
        );
    }

    if (imageUri) {
        return (
            <View style={styles.previewCard}>
                <View>
                    <Image
                        source={{ uri: imageUri }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                    <View style={styles.heroOverlay} />
                    <ActionButtons
                        downloading={downloading}
                        onView={onView}
                        onDownload={onDownload}
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.previewCard}>
            <DocumentPreviewLoading />
        </View>
    );
}

/**
 * ActionButtons - Floating action buttons overlay
 */
function ActionButtons({
    downloading,
    onView,
    onDownload,
}: {
    downloading: boolean;
    onView: () => void;
    onDownload: () => void;
}) {
    return (
        <View style={styles.floatingButtonContainer}>
            <TouchableOpacity
                style={styles.actionCard}
                onPress={onView}
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
    );
}

const styles = StyleSheet.create({
    previewCard: {
        backgroundColor: Colors.white,
        borderRadius: 0,
        marginBottom: 8,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.08)',
        overflow: 'hidden',
    },
    previewIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 40,
        backgroundColor: '#F0F9FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#DBEAFE',
        alignSelf: 'center',
        marginTop: 40,
    },
    previewText: {
        fontSize: 16,
        color: Colors.gray500,
        marginBottom: 24,
        fontWeight: '500',
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    pdfPreviewWrapper: {
        width: '100%',
        height: 208,
        backgroundColor: Colors.white,
        overflow: 'hidden',
    },
    pdfPreview: {
        flex: 1,
        width: '100%',
        height: 208,
        backgroundColor: Colors.white,
    },
    heroImage: {
        width: '100%',
        height: 208,
        backgroundColor: Colors.gray50,
    },
    heroOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    floatingButtonContainer: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'transparent',
        borderRadius: 14,
        padding: 10,
    },
    actionCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: Colors.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.gray200,
        gap: 6,
        shadowColor: Colors.gray900,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
        minHeight: 44,
    },
    actionIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionCardLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.textPrimary,
        letterSpacing: 0.2,
    },
});
