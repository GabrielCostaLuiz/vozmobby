import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
    voiceId: string;
    speechRate: number;
    phrases: {
        homeGreeting: string;
        destinationSelectWait: string;
        voiceActivationPrompt: string;
        originScreenEnter: string;
        gpsSearching: string;
        gpsDenied: string;
        gpsFailed: string;
        routeGenerating: string;
    };
}

const DEFAULT_SETTINGS: AppSettings = {
    voiceId: '',
    speechRate: 0.95,
    phrases: {
        homeGreeting: 'Bem-vindo ao VozMobby. Selecione o destino para onde deseja viajar.',
        destinationSelectWait: 'Motorista, qual a sua rota?',
        voiceActivationPrompt: 'Pode falar, estou ouvindo.',
        originScreenEnter: 'VozMobby definido. Indo para: {destination}. De onde você vai sair?',
        gpsSearching: 'Buscando sua localização via GPS e traçando a rota...',
        gpsDenied: 'O acesso ao GPS foi negado.',
        gpsFailed: 'Houve um erro técnico de localização. Tente novamente mais tarde.',
        routeGenerating: 'Sua localização atual é a rua: {origin}. Traçando caminho para {destination}. O aplicativo da Uber oficial está sendo aberto em 3 segundos.'
    }
};

interface SettingsContextData {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
    updatePhrase: (key: keyof AppSettings['phrases'], newPhrase: string) => Promise<void>;
    saveAllSettings: (fullSettings: AppSettings) => Promise<void>;
    isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextData>({} as SettingsContextData);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('@chama_uber_settings');
            if (stored) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
            }
        } catch (error) {
            console.error('Error loading settings', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateSettings = async (newSettings: Partial<AppSettings>) => {
        try {
            const updated = { ...settings, ...newSettings };
            setSettings(updated);
            await AsyncStorage.setItem('@chama_uber_settings', JSON.stringify(updated));
        } catch (error) {
            console.error('Error saving settings', error);
        }
    };

    const updatePhrase = async (key: keyof AppSettings['phrases'], newPhrase: string) => {
        try {
            const updated = {
                ...settings,
                phrases: { ...settings.phrases, [key]: newPhrase }
            };
            setSettings(updated);
            await AsyncStorage.setItem('@chama_uber_settings', JSON.stringify(updated));
        } catch (error) {
            console.error('Error saving phrase', error);
        }
    };

    const saveAllSettings = async (fullSettings: AppSettings) => {
        try {
            setSettings(fullSettings);
            await AsyncStorage.setItem('@chama_uber_settings', JSON.stringify(fullSettings));
        } catch (error) {
            console.error('Error on bulk save', error);
            throw error;
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, updatePhrase, saveAllSettings, isLoading }}>
            {children}
        </SettingsContext.Provider>
    );
};

export function useSettings() {
    return useContext(SettingsContext);
}
