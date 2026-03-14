import React, { Fragment } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
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
                        <Feather name="alert-circle" size={64} color={Colors.error} />
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
                                    <Feather name="eye" size={18} color={Colors.primary} />
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
                                        <Feather name="download" size={18} color={Colors.primary} />
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
                            resizeMode="cover"
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
                                    <Feather name="eye" size={18} color={Colors.primary} />
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
                                        <Feather name="download" size={18} color={Colors.primary} />
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
