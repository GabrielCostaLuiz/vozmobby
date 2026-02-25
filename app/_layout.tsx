import React from 'react';
import { View, Text } from 'react-native';
import { useFonts, Lexend_700Bold, Lexend_400Regular } from '@expo-google-fonts/lexend';
import { SpaceMono_700Bold, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';

import { initializeDatabase } from '../src/database/schema';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import '../global.css';

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Lexend_700Bold,
        Lexend_400Regular,
        SpaceMono_700Bold,
        SpaceMono_400Regular
    });

    if (!fontsLoaded) {
        return (
            <View className="flex-1 bg-background-dark items-center justify-center">
                <Text className="text-white">Loading...</Text>
            </View>
        );
    }

    return (
        <SettingsProvider>
            <SQLiteProvider databaseName="chamauber.db" onInit={initializeDatabase}>
                <Stack screenOptions={{ headerShown: false }} />
            </SQLiteProvider>
        </SettingsProvider>
    );
}
