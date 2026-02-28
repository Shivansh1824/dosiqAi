import React from 'react';
import { View, Text, StyleSheet, ScrollView,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MedicationIcon } from './MedicationIcons';
import { Colors } from '../../constants';

/**
 * IconPreviewScreen - A gallery of all medication icons to verify designs
 */
export const IconPreviewScreen = () => {
    const forms = [
        'Tablet',
        'Capsule',
        'Syrup',
        'Injection',
        'Drops',
        'Cream',
        'Ointment',
        'Inhaler',
        'Sachet',
        'Nebulizer',
        'Unknown (Fallback)'
    ];

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Neo-Glass Icons</Text>
                    <Text style={styles.subtitle}>2026 Premium Design Language</Text>
                </View>

                <View style={styles.grid}>
                    {forms.map((form) => (
                        <View key={form} style={styles.iconCard}>
                            <MedicationIcon form={form === 'Unknown (Fallback)' ? null : form} size={32} />
                            <Text style={styles.iconName}>{form}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.colorLegend}>
                    <Text style={styles.legendTitle}>Design Principles</Text>
                    <View style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.legendText}>Chroma-Themed for instant recognition</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD' }]} />
                        <Text style={styles.legendText}>Liquid Glass containers with reflections</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.dot, { backgroundColor: '#64748B' }]} />
                        <Text style={styles.legendText}>Refractive layered SVG artwork</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    container: {
        padding: 24,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '600',
        marginTop: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    iconCard: {
        width: '47%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginBottom: 4,
    },
    iconName: {
        marginTop: 16,
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    colorLegend: {
        marginTop: 40,
        padding: 24,
        backgroundColor: '#F1F5F9',
        borderRadius: 24,
    },
    legendTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    }
});
