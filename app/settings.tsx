import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    SafeAreaView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSettings, AppSettings } from '../src/contexts/SettingsContext';

export default function SettingsScreen() {
    const router = useRouter();
    const { settings, saveAllSettings, isLoading } = useSettings();
    const [availableVoices, setAvailableVoices] = useState<Speech.Voice[]>([]);

    // Draft local memory. It will only hit the database when "SAVE" is clicked.
    const [draft, setDraft] = useState<AppSettings>(settings);
    const [isSaving, setIsSaving] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [errorModalVisible, setErrorModalVisible] = useState(false);

    useEffect(() => {
        // Inicializar draft após carregamento, se necessário
        if (settings.voiceId !== draft.voiceId) {
            setDraft(settings);
        }
    }, [isLoading]);

    useEffect(() => {
        const fetchVoices = async () => {
            let voices = await Speech.getAvailableVoicesAsync();
            voices = voices.filter(v => v.language.includes('pt-BR'));

            // Deduplicate logic and filter out Android's verbose redundant names
            let cleanedVoices: Speech.Voice[] = [];
            const seenIdentifiers = new Set<string>();

            for (const v of voices) {
                if (!seenIdentifiers.has(v.identifier)) {
                    // Filter logic: Ignore android specifically weird fallback voices
                    if (!v.identifier.includes('afs') && !v.name.includes('language')) {
                        // Rename locally for better display (just mutating the copy we display)
                        let displayLabel = v.name;
                        if (displayLabel.includes('pt-br-x-')) {
                            const engineLabel = displayLabel.split('-')[3]?.toUpperCase() || 'Local';
                            displayLabel = `Voz ${engineLabel}`;
                        } else if (displayLabel === 'pt-BR-local') {
                            displayLabel = 'Robô (Local)';
                        }

                        cleanedVoices.push({ ...v, name: displayLabel });
                    }
                    seenIdentifiers.add(v.identifier);
                }
            }

            setAvailableVoices(cleanedVoices);
        };
        fetchVoices();
    }, []);

    const playVoiceTest = () => {
        Speech.stop();
        Speech.speak('Olá. Estou pronta para te avisar das viagens', {
            language: 'pt-BR',
            rate: draft.speechRate,
            voice: draft.voiceId || undefined
        });
    };

    const handleUpdateVoice = (identifier: string) => {
        setDraft(prev => ({ ...prev, voiceId: identifier }));
    };

    const handlePhraseChange = (key: keyof AppSettings['phrases'], text: string) => {
        setDraft(prev => ({
            ...prev,
            phrases: {
                ...prev.phrases,
                [key]: text
            }
        }));
    };

    const handleSaveConfigs = async () => {
        setIsSaving(true);
        try {
            await saveAllSettings(draft); // Manda tudo de uma vez
            setSuccessModalVisible(true);
        } catch (e) {
            setErrorModalVisible(true);
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background-dark items-center justify-center">
                <ActivityIndicator color="#CCFF00" size="large" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-dark">
            {/* Custom Modals for Success/Error */}
            <Modal visible={successModalVisible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/80 px-4">
                    <View className="bg-surface w-full rounded-3xl p-6 border-2 border-[#CCFF00] items-center">
                        <View className="w-16 h-16 bg-[#CCFF00]/20 rounded-full items-center justify-center mb-4">
                            <MaterialIcons name="done" size={32} color="#CCFF00" />
                        </View>
                        <Text className="text-white text-2xl font-bold font-display mb-2">Sucesso!</Text>
                        <Text className="text-gray-400 text-center mb-6">Configurações globais salvas e aplicadas na memória.</Text>
                        <TouchableOpacity
                            onPress={() => setSuccessModalVisible(false)}
                            className="w-full bg-[#CCFF00] h-12 rounded-xl items-center justify-center"
                        >
                            <Text className="font-bold text-black text-lg">LEGAL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={errorModalVisible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/80 px-4">
                    <View className="bg-surface w-full rounded-3xl p-6 border-2 border-red-500 items-center">
                        <View className="w-16 h-16 bg-red-500/20 rounded-full items-center justify-center mb-4">
                            <MaterialIcons name="error-outline" size={32} color="#EF4444" />
                        </View>
                        <Text className="text-white text-2xl font-bold font-display mb-2">Ops...</Text>
                        <Text className="text-gray-400 text-center mb-6">Erro ao salvar configurações devido a falha nativa. Tente reiniciar o app.</Text>
                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            className="w-full bg-red-500 h-12 rounded-xl items-center justify-center"
                        >
                            <Text className="font-bold text-white text-lg">LEGAL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Header / Nav */}
            <View className="flex-none px-6 pt-12 pb-4 z-10 w-full" style={{ paddingTop: 48 }}>
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-12 h-12 bg-surface border-2 border-stroke rounded-full justify-center items-center"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>

                    <View className="flex-col">
                        <Text className="text-gray-400 text-lg font-medium mb-1 font-display">Acessibilidade</Text>
                        <Text className="text-3xl font-bold tracking-tight text-white font-display">Voz & Ajustes</Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100, gap: 16 }}>

                {/* SETTING: VOZ DO SISTEMA */}
                <Text className="text-gray-400 font-bold ml-2 text-xs tracking-wider mt-2">SELECIONE A VOZ</Text>

                <View className="bg-surface rounded-xl border border-stroke p-4 gap-4 mb-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                        {/* Option: Default (Voz do robozinho padrao) */}
                        <TouchableOpacity
                            onPress={() => handleUpdateVoice('')}
                            className={`border-2 rounded-lg px-4 py-3 mr-3 flex-row items-center ${!draft.voiceId ? 'border-primary bg-primary/10' : 'border-stroke'}`}
                        >
                            <MaterialIcons name="record-voice-over" size={20} color={!draft.voiceId ? '#CCFF00' : 'white'} />
                            <Text className={`ml-2 font-display ${!draft.voiceId ? 'text-primary font-bold' : 'text-white'}`}>Padrão do Sistema</Text>
                        </TouchableOpacity>

                        {availableVoices.map((voice) => (
                            <TouchableOpacity
                                key={voice.identifier}
                                onPress={() => handleUpdateVoice(voice.identifier)}
                                className={`border-2 rounded-lg px-4 py-3 mr-3 flex-row items-center ${draft.voiceId === voice.identifier ? 'border-primary bg-primary/10' : 'border-stroke'}`}
                            >
                                <MaterialIcons name="person" size={20} color={draft.voiceId === voice.identifier ? '#CCFF00' : '#9CA3AF'} />
                                <Text className={`ml-2 font-display ${draft.voiceId === voice.identifier ? 'text-primary font-bold' : 'text-gray-400'}`}>
                                    {voice.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        onPress={playVoiceTest}
                        className="bg-background-dark border border-primary h-12 items-center justify-center rounded-lg flex-row gap-2"
                    >
                        <MaterialIcons name="volume-up" size={24} color="#CCFF00" />
                        <Text className="text-primary font-bold tracking-widest font-display">OUVIR A VOZ SELECIONADA</Text>
                    </TouchableOpacity>
                </View>

                {/* SETTINGS: TEXTOS FALADOS (DINÂMICOS) */}
                <Text className="text-gray-400 font-bold ml-2 text-xs tracking-wider mt-4">TEXTOS FALADOS NAS TELAS</Text>
                <Text className="text-gray-500 text-[11px] ml-2 mb-2 italic px-2">
                    Use {'{origin}'} para importar a de onde o motorista vai sair e {'{destination}'} para puxar pra onde ele vai na frase.
                </Text>

                <View className="gap-4">
                    {/* Saudação Inicial */}
                    <View className="bg-surface border border-stroke rounded-xl px-4 py-3">
                        <Text className="text-white font-bold text-sm mb-1">Abertura do App</Text>
                        <TextInput
                            className="text-gray-300 font-mono text-xs p-0 m-0 min-h-[40px]"
                            multiline
                            value={draft.phrases.homeGreeting}
                            onChangeText={(t) => handlePhraseChange('homeGreeting', t)}
                        />
                    </View>

                    {/* Confirmação de Destino */}
                    <View className="bg-surface border border-stroke rounded-xl px-4 py-3">
                        <Text className="text-white font-bold text-sm mb-1">Ao entrar na Tela do GPS</Text>
                        <TextInput
                            className="text-gray-300 font-mono text-xs p-0 m-0 min-h-[40px]"
                            multiline
                            value={draft.phrases.originScreenEnter}
                            onChangeText={(t) => handlePhraseChange('originScreenEnter', t)}
                        />
                    </View>

                    {/* Buscando Motorista */}
                    <View className="bg-surface border border-stroke rounded-xl px-4 py-3">
                        <Text className="text-white font-bold text-sm mb-1">Ao tocar em Localização Atual</Text>
                        <TextInput
                            className="text-gray-300 font-mono text-xs p-0 m-0 min-h-[40px]"
                            multiline
                            value={draft.phrases.gpsSearching}
                            onChangeText={(t) => handlePhraseChange('gpsSearching', t)}
                        />
                    </View>

                    {/* Falha de GPS */}
                    <View className="bg-surface border border-stroke rounded-xl px-4 py-3">
                        <Text className="text-red-400 font-bold text-sm mb-1">Falha ou Negou GPS</Text>
                        <TextInput
                            className="text-gray-300 font-mono text-xs p-0 m-0 min-h-[40px]"
                            multiline
                            value={draft.phrases.gpsDenied}
                            onChangeText={(t) => handlePhraseChange('gpsDenied', t)}
                        />
                    </View>

                    {/* Resumo Final - Acionando a Uber Original */}
                    <View className="bg-surface border border-stroke rounded-xl px-4 py-3">
                        <Text className="text-primary font-bold text-sm mb-1">Passando para o App da Uber</Text>
                        <TextInput
                            className="text-gray-300 font-mono text-xs p-0 m-0 min-h-[60px]"
                            multiline
                            value={draft.phrases.routeGenerating}
                            onChangeText={(t) => handlePhraseChange('routeGenerating', t)}
                        />
                    </View>
                </View>
            </ScrollView>

            {/* Mega Botão Salvar (Fixo na Base) */}
            <View className="absolute bottom-0 left-4 right-4 z-50 pb-6 bg-background-dark pt-2">
                <TouchableOpacity
                    onPress={handleSaveConfigs}
                    disabled={isSaving}
                    className="bg-primary h-14 items-center justify-center rounded-xl flex-row gap-2"
                    style={{ shadowColor: '#CCFF00', shadowOpacity: 0.3, shadowRadius: 10 }}
                >
                    {isSaving ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <>
                            <MaterialIcons name="save" size={24} color="black" />
                            <Text className="text-black font-bold text-lg font-display">SALVAR ALTERAÇÕES</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}
