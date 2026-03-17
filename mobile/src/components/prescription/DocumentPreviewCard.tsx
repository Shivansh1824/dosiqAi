import React, { Fragment } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import Pdf from 'react-native-pdf';
import { Colors } from '../../constants';
import { styles } from '../../screens/PrescriptionSummaryScreen.styles';
import { DocumentPreviewLoading } from './DocumentPreviewLoading';

interface DocumentPreviewCardProps {
    fileNotFound: boolean;
    isPdf: boolean;
    imageUri: string | null;
    handleViewFullDocument: () => void;
    handleDownload: () => void;
    downloading: boolean;
}

export const DocumentPreviewCard: React.FC<DocumentPreviewCardProps> = ({
    fileNotFound,
    isPdf,
    imageUri,
    handleViewFullDocument,
    handleDownload,
    downloading,
}) => {
    return (
        <View style={styles.previewCard}>
            {fileNotFound ? (
                <Fragment>
                    <View style={styles.previewIconContainer}>
                        <SymbolView
                            name={{ ios: 'exclamationmark.circle', android: 'error' }}
                            size={64}
                            tintColor={Colors.error}
                            fallback={<Feather name="alert-circle" size={64} color={Colors.error} />}
                        />
                    </View>
                    <Text style={styles.previewText}>File Not Found</Text>
                    <Text style={styles.errorText}>
                        The document file could not be found on this device.
                    </Text>
                </Fragment>
            ) : isPdf && imageUri ? (
                <Animated.View layout={LinearTransition.duration(300)}>
                    {/* Native PDF Preview */}
                    <View style={styles.pdfPreviewWrapper}>
                        <Pdf
                            source={{ uri: imageUri, cache: true }}
                            style={styles.pdfPreview}
                            trustAllCerts={false}
                            fitPolicy={0} // Fit width
                            onLoadComplete={(numberOfPages) => {
                                console.log(`Number of pages: ${numberOfPages}`);
                            }}
                            onPageChanged={(page, numberOfPages) => {
                                console.log(`Current page: ${page}`);
                            }}
                            onError={(error) => {
                                console.log(error);
                            }}
                            onPressLink={(uri) => {
                                console.log(`Link pressed: ${uri}`);
                            }}
                        />

                        {/* Floating Action Buttons - Modern Compact Pill */}
                        <View style={styles.floatingButtonContainer}>
                            <View style={styles.compactActionPill}>
                                <TouchableOpacity
                                    style={styles.pillAction}
                                    onPress={handleViewFullDocument}
                                    activeOpacity={0.7}
                                >
                                    <SymbolView
                                        name={{ ios: 'eye', android: 'visibility' }}
                                        size={18}
                                        tintColor={Colors.primary}
                                        fallback={<Feather name="eye" size={18} color={Colors.primary} />}
                                    />
                                    <Text style={styles.pillActionText}>View</Text>
                                </TouchableOpacity>

                                <View style={styles.pillDivider} />

                                <TouchableOpacity
                                    style={styles.pillAction}
                                    onPress={handleDownload}
                                    activeOpacity={0.7}
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <SymbolView
                                            name={{ ios: 'square.and.arrow.down', android: 'download' }}
                                            size={18}
                                            tintColor={Colors.primary}
                                            fallback={<Feather name="download" size={18} color={Colors.primary} />}
                                        />
                                    )}
                                    <Text style={styles.pillActionText}>
                                        {downloading ? 'Saving' : 'Save'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            ) : imageUri ? (
                <Animated.View layout={LinearTransition.duration(300)}>
                    <View>
                        <Image
                            source={{ uri: imageUri || undefined }}
                            style={styles.heroImage}
                            contentFit="cover"
                        />
                        <View style={styles.heroOverlay} />

                        {/* Floating Action Buttons - Modern Compact Pill */}
                        <View style={styles.floatingButtonContainer}>
                            <View style={styles.compactActionPill}>
                                <TouchableOpacity
                                    style={styles.pillAction}
                                    onPress={handleViewFullDocument}
                                    activeOpacity={0.7}
                                >
                                    <SymbolView
                                        name={{ ios: 'eye', android: 'visibility' }}
                                        size={18}
                                        tintColor={Colors.primary}
                                        fallback={<Feather name="eye" size={18} color={Colors.primary} />}
                                    />
                                    <Text style={styles.pillActionText}>View</Text>
                                </TouchableOpacity>

                                <View style={styles.pillDivider} />

                                <TouchableOpacity
                                    style={styles.pillAction}
                                    onPress={handleDownload}
                                    activeOpacity={0.7}
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <SymbolView
                                            name={{ ios: 'square.and.arrow.down', android: 'download' }}
                                            size={18}
                                            tintColor={Colors.primary}
                                            fallback={<Feather name="download" size={18} color={Colors.primary} />}
                                        />
                                    )}
                                    <Text style={styles.pillActionText}>
                                        {downloading ? 'Saving' : 'Save'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Animated.View>
            ) : (
                <DocumentPreviewLoading />
            )}
        </View>
    );
};
