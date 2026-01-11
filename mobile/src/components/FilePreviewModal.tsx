import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Dimensions,
    Platform,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors, Sizes, Typography } from '../constants';

interface FilePreviewModalProps {
    visible: boolean;
    fileUri: string | null;
    fileType: 'image' | 'document'; // 'document' usually covers PDF in this context
    fileName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isUploading?: boolean;
}

const { width, height } = Dimensions.get('window');

export default function FilePreviewModal({
    visible,
    fileUri,
    fileType,
    fileName,
    onConfirm,
    onCancel,
    isUploading = false,
}: FilePreviewModalProps) {
    const [pdfLoading, setPdfLoading] = useState(true);

    if (!visible || !fileUri) return null;

    // Determine if it's a PDF based on type or filename
    const isPdf = fileType === 'document' && fileName.toLowerCase().endsWith('.pdf');

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />

                {/* Background Blur */}
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Header - Title Only */}
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title} numberOfLines={1}>Preview</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{fileName}</Text>
                    </View>
                </View>

                {/* Content Preview */}
                <View style={styles.contentContainer}>
                    <View style={styles.previewCard}>
                        {isPdf ? (
                            <View style={styles.pdfContainer}>
                                {pdfLoading && (
                                    <View style={styles.pdfLoading}>
                                        <ActivityIndicator size="large" color={Colors.primary} />
                                    </View>
                                )}
                                <WebView
                                    source={{ uri: fileUri }}
                                    style={styles.webview}
                                    onLoadEnd={() => setPdfLoading(false)}
                                    originWhitelist={['*']}
                                    scalesPageToFit={true}
                                />
                            </View>
                        ) : (
                            <Image
                                source={{ uri: fileUri }}
                                style={styles.image}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                </View>

                {/* Bottom Actions Footer */}
                <View style={styles.footer}>
                    <Text style={styles.helperText}>
                        Verify your document is clear and readable
                    </Text>

                    <View style={styles.buttonRow}>
                        {/* Cancel Button - Outline/Ghost */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={onCancel}
                            disabled={isUploading}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        {/* Select/Confirm Button - Primary Filled */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.selectButton]}
                            onPress={onConfirm}
                            disabled={isUploading}
                            activeOpacity={0.8}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color={Colors.white} />
                            ) : (
                                <Text style={styles.selectButtonText}>Upload</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: Sizes.xl,
        paddingBottom: Sizes.lg,
        zIndex: 10,
    },
    titleContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.white,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.7)',
        maxWidth: width * 0.7,
        textAlign: 'center',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Sizes.lg,
        paddingBottom: Sizes.md,
    },
    previewCard: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    image: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    pdfContainer: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    pdfLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        zIndex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },

    // New Footer Styles
    footer: {
        width: '100%',
        paddingHorizontal: Sizes.lg,
        paddingBottom: Platform.OS === 'ios' ? 50 : 30, // Safe area padding
        paddingTop: Sizes.md,
        alignItems: 'center',
        gap: 20,
    },
    helperText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 16,
    },
    actionButton: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    cancelButtonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    selectButton: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    selectButtonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
