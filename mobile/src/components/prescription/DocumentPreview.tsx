import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Pdf from 'react-native-pdf';
import { BlurView } from 'expo-blur';
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
 * DocumentPreview - Document preview card with image/PDF display and floating action buttons
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
            <View style={styles.errorContainer}>
                <View style={styles.errorIconCircle}>
                    <Feather name="alert-circle" size={32} color={Colors.error} />
                </View>
                <Text style={styles.errorTitle}>File Not Found</Text>
                <Text style={styles.errorText}>
                    The document could not be loaded.
                </Text>
            </View>
        );
    }

    if (imageUri) {
        return (
            <View style={styles.container}>
                <View style={styles.previewWrapper}>
                    {isPdf ? (
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
                            style={styles.previewContent}
                            onError={(error) => console.error('[DocumentPreview] PDF Error:', error)}
                        />
                    ) : (
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.previewContent}
                            resizeMode="cover"
                        />
                    )}
                    
                    {/* PDF Overlay to prevent interaction stealing if needed, or just visual polish */}
                    <View style={styles.overlay} pointerEvents="none" />

                    <View style={styles.floatingBarContainer} pointerEvents="box-none">
                        <View style={styles.glassBarShadow}>
                            {/* Use systemChromeMaterialLight for that specific macOS/iOS popover look if available, else light */}
                            <BlurView intensity={80} tint="systemChromeMaterialLight" style={styles.glassBar}>
                                <TouchableOpacity 
                                    style={styles.actionButton} 
                                    onPress={onView}
                                    activeOpacity={0.6}
                                >
                                    <Feather name="eye" size={20} color={Colors.primary} style={styles.actionIcon} />
                                    <Text style={styles.actionText}>View</Text>
                                </TouchableOpacity>
                                
                                <View style={styles.divider} />
                                
                                <TouchableOpacity 
                                    style={styles.actionButton} 
                                    onPress={onDownload}
                                    activeOpacity={0.6}
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <Feather name="download" size={20} color={Colors.primary} style={styles.actionIcon} />
                                    )}
                                    <Text style={styles.actionText}>
                                        {downloading ? 'Saving...' : 'Save'}
                                    </Text>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <DocumentPreviewLoading />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 0,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray200,
        // Edge-to-edge: No border radius, no horizontal margin
    },
    previewWrapper: {
        width: '100%',
        height: 220, // Adjusted height to 220 as per user request
        backgroundColor: Colors.white,
        position: 'relative',
    },
    previewContent: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: Colors.white,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.02)', // Very subtle overlay
    },
    
    // Floating Bar Styles
    floatingBarContainer: {
        position: 'absolute',
        bottom: 20, // Lifted up slightly
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    glassBarShadow: {
        borderRadius: 100,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.1, // Softer shadow for cleaner look
        shadowRadius: 16,
        elevation: 10,
    },
    glassBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 100,
        overflow: 'hidden',
        // Make background transparent on iOS to let blur handle it fully
        // Use slight white tint on Android where BlurView might be limited
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255,255,255,0.9)', 
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 28, // Increased from 20 for more width
        paddingVertical: 12,   // Increased from 10
        gap: 10,               // Increased gap
    },
    actionIcon: {
        opacity: 0.9,
    },
    actionText: {
        fontSize: 16,          // Increased from 15
        fontWeight: '600',
        color: Colors.gray900,
        letterSpacing: -0.2,
    },
    divider: {
        width: 1,
        height: 24,            // Increased from 20 to match larger buttons
        backgroundColor: '#475569',
        opacity: 1,
    },

    // Error State
    errorContainer: {
        height: 200,
        backgroundColor: Colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray200,
    },
    errorIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.errorLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    errorText: {
        fontSize: 13,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
});
