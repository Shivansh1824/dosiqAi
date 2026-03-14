import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Image,
    Dimensions,
    Platform,
    ActivityIndicator,
    StatusBar,
    Animated,
    FlatList,
    Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Pdf from 'react-native-pdf';
import { Colors, Sizes, Typography } from '../constants';

export interface FileItem {
    uri: string;
    type: 'image' | 'document';
    name: string;
}

interface FilePreviewModalProps {
    visible: boolean;
    files: FileItem[];
    onConfirm: () => void;
    onCancel: () => void;
    onAddPage?: () => void; // kept for backward compat but not used if inline callbacks provided
    onPickFromLibrary?: () => void;
    onTakePhoto?: () => void;
    onPickDocument?: () => void;
    onRemovePage?: (index: number) => void;
    isUploading?: boolean;
}

const { width, height } = Dimensions.get('window');
const THUMBNAIL_SIZE = 56;

/**
 * Self-contained PDF item — Uses react-native-pdf for native rendering
 * Fabric-compatible replacement for legacy PDF components.
 */
const PdfPreviewItem = React.memo(function PdfPreviewItem({ uri, itemIndex, setPdfPageCounts }: {
    uri: string;
    itemIndex: number;
    setPdfPageCounts: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}) {
    const [loading, setLoading] = useState(true);

    // Page removal/counting is now handled by Pdf component onLoadComplete

    return (
        <View style={pdfItemStyles.container}>
            {loading && (
                <View style={pdfItemStyles.loading}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            )}
            <Pdf
                source={{ uri, cache: true }}
                style={pdfItemStyles.pdf}
                onLoadComplete={(numberOfPages) => {
                    setLoading(false);
                    setPdfPageCounts(prev => ({ ...prev, [itemIndex]: numberOfPages }));
                }}
                onError={(error) => {
                    console.log(error);
                    setLoading(false);
                }}
                trustAllCerts={false}
            />
        </View>
    );
}, (prevProps, nextProps) => {
    // Custom comparator: only re-render if uri or index actually changed
    return prevProps.uri === nextProps.uri && prevProps.itemIndex === nextProps.itemIndex;
});

const pdfItemStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    loading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        zIndex: 1,
    },
    pdf: { flex: 1, width: '100%', height: '100%', backgroundColor: '#F5F5F5' },
});

export default function FilePreviewModal({
    visible,
    files,
    onConfirm,
    onCancel,
    onAddPage,
    onPickFromLibrary,
    onTakePhoto,
    onPickDocument,
    onRemovePage,
    isUploading = false,
}: FilePreviewModalProps) {
    const [pdfPageCounts, setPdfPageCounts] = useState<Record<number, number>>({}); // per-file PDF page counts
    const [currentIndex, setCurrentIndex] = useState(0);

    const flatListRef = useRef<FlatList>(null);
    const thumbnailListRef = useRef<FlatList>(null);
    const [sliderWidth, setSliderWidth] = useState(width - Sizes.lg * 2);

    // Inline picker overlay state
    const [showInlinePicker, setShowInlinePicker] = useState(false);
    const pickerSlideAnim = useRef(new Animated.Value(0)).current;
    const pickerFadeAnim = useRef(new Animated.Value(0)).current;

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setCurrentIndex(0);
            setShowInlinePicker(false);
            pickerSlideAnim.setValue(0);
            pickerFadeAnim.setValue(0);
            setPdfPageCounts({});
        }
    }, [visible, files]);

    // Update FlatList index when files array changes
    useEffect(() => {
        if (visible && files.length > 0) {
            // Adjust currentIndex if it's now out of bounds
            let newIndex = currentIndex;
            if (currentIndex >= files.length) {
                newIndex = Math.max(0, files.length - 1);
                setCurrentIndex(newIndex);
            }

            // Sync FlatList to ensure it stays on the correct page when files are added/removed
            setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: newIndex, animated: false });
            }, 50);
        }
    }, [files, visible]);

    // Auto-scroll thumbnail strip to keep active item visible
    useEffect(() => {
        if (visible && files.length > 1) {
            setTimeout(() => {
                thumbnailListRef.current?.scrollToIndex({
                    index: currentIndex,
                    animated: true,
                    viewPosition: 0.5, // Center the active thumbnail
                });
            }, 100);
        }
    }, [currentIndex, visible, files.length]);

    const openInlinePicker = () => {
        setShowInlinePicker(true);
        Animated.parallel([
            Animated.timing(pickerFadeAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.spring(pickerSlideAnim, {
                toValue: 1,
                damping: 22,
                stiffness: 120,
                mass: 0.8,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeInlinePicker = () => {
        Animated.parallel([
            Animated.timing(pickerFadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(pickerSlideAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setShowInlinePicker(false);
        });
    };

    const handleAddPagePress = () => {
        // If we have inline callbacks, use the inline picker
        if (onPickFromLibrary || onTakePhoto || onPickDocument) {
            openInlinePicker();
        } else if (onAddPage) {
            // Fallback to old behavior
            onAddPage();
        }
    };

    const handlePickLibrary = () => {
        closeInlinePicker();
        // Small delay to let the animation complete
        setTimeout(() => {
            onPickFromLibrary?.();
        }, 250);
    };

    const handleTakePhoto = () => {
        closeInlinePicker();
        setTimeout(() => {
            onTakePhoto?.();
        }, 250);
    };

    const handlePickDocument = () => {
        if (files.some(f => f.type === 'image')) {
            Alert.alert('Invalid Selection', 'Please upload PDFs separately.');
            return;
        }
        closeInlinePicker();
        setTimeout(() => {
            onPickDocument?.();
        }, 250);
    };

    if (!visible || files.length === 0) return null;

    const currentFile = files[currentIndex] || files[0];

    // Determine if current file is a native PDF
    const isPdf = currentFile.type === 'document' && currentFile.name.toLowerCase().endsWith('.pdf');
    const isImageFlow = currentFile.type === 'image';
    const isPdfSelected = files.some(f => f.type === 'document' && f.name.toLowerCase().endsWith('.pdf'));

    // Compute dynamic page and token counts
    // Compute dynamic page count FOR THE CURRENT DOCUMENT ONLY
    let currentDocumentPages = 0;
    if (isPdf) {
        currentDocumentPages = pdfPageCounts[currentIndex] || 0;
    } else {
        // Images are considered 1 page/token each
        currentDocumentPages = 1;
    }

    // Compute TOTAL tokens across ALL documents
    const imageCount = files.filter(f => f.type === 'image').length;
    let totalPdfPages = 0;
    Object.values(pdfPageCounts).forEach(count => {
        totalPdfPages += count;
    });
    const totalTokens = totalPdfPages + imageCount;

    // Has inline add-page capability — now works for both image and PDF flows
    const hasInlineAddPage = onPickFromLibrary || onTakePhoto || onPickDocument;

    const pickerTranslateY = pickerSlideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0],
    });

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />

                {/* Background Effect */}
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.90)' }]} />
                )}

                {/* Header - Title Only */}
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title} numberOfLines={1}>Preview</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>
                            {files.length > 1 ? `Document ${currentIndex + 1} of ${files.length}` : currentFile.name}
                        </Text>
                    </View>
                </View>

                {/* Content Preview */}
                <View style={styles.contentContainer}>
                    <View style={styles.previewCard}>
                        <View
                            style={styles.sliderContainer}
                            onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                        >
                            <FlatList
                                ref={flatListRef}
                                data={files}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item, index) => item.uri + index}
                                renderItem={({ item, index: itemIndex }) => {
                                    const isItemPdf = item.type === 'document' && item.name.toLowerCase().endsWith('.pdf');
                                    return (
                                        <View style={{ width: sliderWidth, height: '100%' }}>
                                            {isItemPdf ? (
                                                <PdfPreviewItem
                                                    uri={item.uri}
                                                    itemIndex={itemIndex}
                                                    setPdfPageCounts={setPdfPageCounts}
                                                />
                                            ) : (
                                                <Image
                                                    source={{ uri: item.uri }}
                                                    style={styles.image}
                                                    resizeMode="contain"
                                                />
                                            )}
                                        </View>
                                    );
                                }}
                                initialScrollIndex={0}
                                getItemLayout={(data, index) => (
                                    { length: sliderWidth, offset: sliderWidth * index, index }
                                )}
                                onMomentumScrollEnd={(e) => {
                                    const offset = e.nativeEvent.contentOffset.x;
                                    const widthScale = e.nativeEvent.layoutMeasurement.width || sliderWidth;
                                    if (widthScale > 0) {
                                        const newIndex = Math.round(offset / widthScale);
                                        if (newIndex >= 0 && newIndex < files.length) {
                                            setCurrentIndex(newIndex);
                                        }
                                    }
                                }}
                            />
                        </View>

                        {/* Document Number Badge — top-left */}
                        {files.length > 1 && (
                            <View style={styles.docNumberBadge}>
                                <Text style={styles.docNumberText}>{currentIndex + 1}</Text>
                            </View>
                        )}

                        {/* Remove Page Button — top-right */}
                        {onRemovePage && files.length > 0 && (
                            <TouchableOpacity
                                style={styles.removePageButton}
                                onPress={() => onRemovePage(currentIndex)}
                                disabled={isUploading}
                            >
                                <Feather name="trash-2" size={20} color={Colors.white} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Thumbnail Strip — WhatsApp-style navigation */}
                    {files.length > 1 && (
                        <View style={styles.thumbnailStripContainer}>
                            <FlatList
                                ref={thumbnailListRef}
                                data={files}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.thumbnailStripContent}
                                keyExtractor={(item, index) => `thumb-${item.uri}-${index}`}
                                getItemLayout={(_, index) => ({
                                    length: THUMBNAIL_SIZE + 10, // size + gap
                                    offset: (THUMBNAIL_SIZE + 10) * index,
                                    index,
                                })}
                                renderItem={({ item, index: thumbIndex }) => {
                                    const isActive = thumbIndex === currentIndex;
                                    const isThumbPdf = item.type === 'document' && item.name.toLowerCase().endsWith('.pdf');
                                    return (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (thumbIndex !== currentIndex) {
                                                    setCurrentIndex(thumbIndex);
                                                    flatListRef.current?.scrollToIndex({ index: thumbIndex, animated: true });
                                                }
                                            }}
                                            style={[
                                                styles.thumbnailItem,
                                                isActive && styles.thumbnailItemActive,
                                            ]}
                                        >
                                            {isThumbPdf ? (
                                                <View style={styles.pdfThumbnail}>
                                                    <Feather name="file-text" size={22} color={isActive ? Colors.primary : 'rgba(255,255,255,0.5)'} />
                                                    <Text style={[styles.pdfThumbnailLabel, isActive && styles.pdfThumbnailLabelActive]}>PDF</Text>
                                                </View>
                                            ) : (
                                                <Image
                                                    source={{ uri: item.uri }}
                                                    style={styles.thumbnailImage}
                                                    resizeMode="cover"
                                                />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    )}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Feather name="file-text" size={16} color={Colors.white} style={{ opacity: 0.8 }} />
                            <Text style={styles.statText}>
                                {currentDocumentPages > 0 ? `${currentDocumentPages} Page${currentDocumentPages !== 1 ? 's' : ''}` : 'Counting...'}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Feather name="layers" size={16} color={Colors.secondary} style={{ opacity: 0.9 }} />
                            <Text style={styles.statText}>
                                {totalTokens > 0 ? `${totalTokens} Token${totalTokens !== 1 ? 's' : ''}` : '...'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Bottom Actions Footer */}
                <View style={[styles.footer, (hasInlineAddPage || onAddPage) ? { paddingTop: 0 } : undefined]}>

                    {/* Add More Actions Row — direct access for better 2026 UX */}
                    {(hasInlineAddPage || onAddPage) && !isPdfSelected && (
                        <View style={styles.addActionsRow}>
                            <TouchableOpacity
                                style={[styles.inlineActionButton, styles.cameraAction]}
                                onPress={handleTakePhoto}
                                disabled={isUploading}
                                activeOpacity={0.8}
                            >
                                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                                <View style={styles.inlineActionContent}>
                                    <Feather name="camera" size={18} color={Colors.white} />
                                    <Text style={styles.inlineActionText}>Camera</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.inlineActionButton, styles.galleryAction]}
                                onPress={handlePickLibrary}
                                disabled={isUploading}
                                activeOpacity={0.8}
                            >
                                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                                <View style={styles.inlineActionContent}>
                                    <Feather name="image" size={18} color={Colors.white} />
                                    <Text style={styles.inlineActionText}>Gallery</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

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
                            disabled={isUploading || (isPdf && currentDocumentPages === 0)}
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

                {/* ─── Inline Source Picker Overlay ─── */}
                {showInlinePicker && (
                    <Animated.View
                        style={styles.pickerCardWrapper}
                        pointerEvents="box-none" // Let touches pass through the wrapper if not on card
                    >
                        {/* Dimmed backdrop — tap to dismiss */}
                        <TouchableWithoutFeedback onPress={closeInlinePicker}>
                            <Animated.View style={[styles.pickerBackdrop, { opacity: pickerFadeAnim }]} />
                        </TouchableWithoutFeedback>

                        <Animated.View
                            style={[
                                styles.pickerCardContainer,
                                { transform: [{ translateY: pickerTranslateY }] },
                            ]}
                        >
                            {/* Layered blur architecture for true 2026 depth calculation */}
                            <BlurView intensity={65} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
                            <View style={styles.pickerCardOverlay} />

                            <View style={styles.pickerCard}>
                                {/* Handle bar */}
                                <View style={styles.pickerHandle}>
                                    <View style={styles.pickerHandleBar} />
                                </View>

                                <Text style={styles.pickerTitle}>Add More Images</Text>
                                <Text style={styles.pickerSubtitle}>Choose a source to scan or import</Text>

                                <View style={styles.pickerOptionsRow}>
                                    {/* Photo Library Option */}
                                    <TouchableOpacity
                                        style={styles.pickerOptionThreeCol}
                                        onPress={handlePickLibrary}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.pickerIconCircle}>
                                            <Feather name="image" size={24} color="#6366F1" />
                                        </View>
                                        <Text style={styles.pickerOptionText}>Photo Library</Text>
                                    </TouchableOpacity>

                                    {/* Camera Option */}
                                    <TouchableOpacity
                                        style={styles.pickerOptionThreeCol}
                                        onPress={handleTakePhoto}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.pickerIconCircle}>
                                            <Feather name="camera" size={24} color="#3B82F6" />
                                        </View>
                                        <Text style={styles.pickerOptionText}>Take Photo</Text>
                                    </TouchableOpacity>

                                    {/* Choose Files Option */}
                                    {onPickDocument && !files.some(f => f.type === 'image') && (
                                        <TouchableOpacity
                                            style={styles.pickerOptionThreeCol}
                                            onPress={handlePickDocument}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.pickerIconCircle}>
                                                <Feather name="folder" size={24} color="#10B981" />
                                            </View>
                                            <Text style={styles.pickerOptionText}>Choose Files</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Cancel */}
                                <TouchableOpacity
                                    style={styles.pickerCancelButton}
                                    onPress={closeInlinePicker}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.pickerCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </Animated.View>
                )}
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
        // Adjust height to leave room for stats
        height: '75%',
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
    pdfView: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#F5F5F5',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    sliderContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    removePageButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    docNumberBadge: {
        position: 'absolute',
        top: 16,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        minWidth: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        zIndex: 5,
    },
    docNumberText: {
        color: Colors.white,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    // ─── Thumbnail Strip Styles ───
    thumbnailStripContainer: {
        width: '100%',
        marginTop: 16,
        alignItems: 'center',
    },
    thumbnailStripContent: {
        paddingHorizontal: Sizes.lg,
        gap: 10,
    },
    thumbnailItem: {
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    thumbnailItemActive: {
        borderColor: Colors.primary,
        borderWidth: 2.5,
        transform: [{ scale: 1.08 }],
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    pdfThumbnail: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
    },
    pdfThumbnailLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.5)',
        letterSpacing: 0.5,
    },
    pdfThumbnailLabelActive: {
        color: Colors.primary,
    },
    addActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 12,
        width: '100%',
        paddingHorizontal: 20,
    },
    inlineActionButton: {
        flex: 1,
        height: 50,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    cameraAction: {
        borderColor: 'rgba(59, 130, 246, 0.5)', // Subtle blue tint
    },
    galleryAction: {
        borderColor: 'rgba(99, 102, 241, 0.5)', // Subtle indigo tint
    },
    inlineActionContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    inlineActionText: {
        color: Colors.white,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // Stats Styles
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statText: {
        color: Colors.white,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginHorizontal: 16,
    },

    // Footer Styles
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

    // ─── Inline Picker Overlay Styles ───
    pickerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    pickerCardWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    pickerCardContainer: {
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)', // Luminous top edge
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 24,
    },
    pickerCardOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 15, 20, 0.45)', // Rich grounding tint that doesn't kill the blur
    },
    pickerCard: {
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 48 : 32,
        paddingTop: 16,
    },
    pickerHandle: {
        alignItems: 'center',
        marginBottom: 20,
    },
    pickerHandleBar: {
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    pickerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.white,
        textAlign: 'center',
        marginBottom: 6,
        letterSpacing: -0.6,
    },
    pickerSubtitle: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        marginBottom: 36,
        fontWeight: '500',
    },
    pickerOptionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 36,
        flexWrap: 'wrap',
    },
    pickerOption: {
        alignItems: 'center',
        justifyContent: 'center',
        width: width * 0.41,
        paddingVertical: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
    },
    pickerOptionThreeCol: {
        alignItems: 'center',
        justifyContent: 'center',
        width: (width - 48 - 24) / 3, // 3 columns with 12px gaps and 24px*2 padding
        paddingVertical: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
    },
    pickerIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
        backgroundColor: 'rgba(255, 255, 255, 1)', // Bright solid pop for the icon core
        shadowColor: 'rgba(255, 255, 255, 0.2)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 8,
    },
    pickerOptionText: {
        color: Colors.white,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    pickerCancelButton: {
        paddingVertical: 20,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 22,
        borderCurve: 'continuous',
    },
    pickerCancelText: {
        color: Colors.white,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
});
