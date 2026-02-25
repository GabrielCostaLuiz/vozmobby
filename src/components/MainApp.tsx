import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Animated,
    Image,
    StatusBar,
    Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import DestinationModal, { DestinationType } from './DestinationModal';
import { useSettings } from '../contexts/SettingsContext';

export default function MainApp() {
    const db = useSQLiteContext();
    const router = useRouter();
    const { settings } = useSettings();

    const [destinations, setDestinations] = useState<DestinationType[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingDestination, setEditingDestination] = useState<DestinationType | null>(null);

    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [spokenText, setSpokenText] = useState('');

    // Prevenir closure staleness
    const destinationsRef = useRef<DestinationType[]>([]);
    useEffect(() => { destinationsRef.current = destinations; }, [destinations]);

    // Animação Setup
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const hasGreeted = useRef(false); // Flag de Barreira

    // Função essencial de Acessibilidade p/ deficientes visuais e Permissões Base
    useEffect(() => {
        if (!hasGreeted.current && settings.phrases.homeGreeting) {
            hasGreeted.current = true;
            (async () => {
                // Boas-vindas em voz alta (Feedback Ocular) configurado na Tela Settings
                Speech.speak(settings.phrases.homeGreeting, {
                    language: 'pt-BR',
                    rate: settings.speechRate,
                    pitch: 1.0,
                    voice: settings.voiceId || undefined
                });

                // Requer as permissões de localização ativamente no Android/iOS
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Speech.speak('O GPS do seu celular precisa estar ativado para funcionar.', {
                        language: 'pt-BR',
                        rate: settings.speechRate,
                        voice: settings.voiceId || undefined
                    });
                }
            })();
        }
    }, [settings.phrases.homeGreeting, settings.speechRate, settings.voiceId]);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    useFocusEffect(
        useCallback(() => {
            loadDestinations();
        }, [])
    );

    const loadDestinations = async () => {
        try {
            const result = await db.getAllAsync<DestinationType>('SELECT * FROM destinations ORDER BY id ASC');
            setDestinations(result);
        } catch (error) {
            console.error('Failed to load destinations:', error);
        }
    };

    const handleSaveDestination = async (dest: DestinationType) => {
        try {
            if (dest.id) {
                // Update
                await db.runAsync(
                    'UPDATE destinations SET title = ?, address = ?, icon = ?, color = ? WHERE id = ?',
                    dest.title, dest.address, dest.icon, dest.color, dest.id
                );
            } else {
                // Insert
                await db.runAsync(
                    'INSERT INTO destinations (title, address, icon, color) VALUES (?, ?, ?, ?)',
                    dest.title, dest.address, dest.icon, dest.color
                );
            }
            loadDestinations();
        } catch (error) {
            console.error('Failed to save destination:', error);
        }
    };

    const handleDeleteDestination = async (id: number) => {
        try {
            await db.runAsync('DELETE FROM destinations WHERE id = ?', id);
            loadDestinations();
        } catch (error) {
            console.error('Failed to delete destination:', error);
        }
    };

    const openNewModal = () => {
        setEditingDestination(null);
        setModalVisible(true);
    };

    const openEditModal = (dest: DestinationType) => {
        setEditingDestination(dest);
        setModalVisible(true);
    };

    // Navegar para a tela "De Onde Vai Sair?" e passar o destino final nos parametros    };

    /** Voice Listeners and Functions **/
    useEffect(() => {
        Voice.onSpeechStart = () => setIsListening(true);
        Voice.onSpeechEnd = () => setIsListening(false);
        Voice.onSpeechResults = handleSpeechResults;
        Voice.onSpeechError = (e: SpeechErrorEvent) => {
            setIsListening(false);
            console.error('Voice Error:', e);
            if (e.error?.message?.includes('Native Module is null') || e.error?.message?.includes('not found')) {
                Alert.alert(
                    'Pacote Nativo Ausente',
                    'O pacote de voz nativo não foi encontrado no seu aplicativo atual. Isso significa que:\n1. Você está rodando no Expo Go.\n2. OU seu último "Build" falhou e este APK antigo não tem as alterações.\n\nPor favor, rode o EAS Build novamente (agora que o erro do Gradle foi corrigido) e instale o novo APK.'
                );
            }
        };

        return () => {
            Voice.destroy().then(Voice.removeAllListeners);
        };
    }, [router]);

    const handleSpeechResults = (e: SpeechResultsEvent) => {
        const phrases = e.value || [];
        setSpokenText(phrases[0] || '');

        let found = false;
        if (phrases.length > 0) {
            for (let phrase of phrases) {
                const cleaned = phrase.toLowerCase().trim();
                // Busca aproximação do que o Voice retornou com a lista no DB
                const match = destinationsRef.current.find(d =>
                    cleaned.includes(d.title.toLowerCase().trim()) ||
                    d.title.toLowerCase().trim().includes(cleaned)
                );

                if (match && !found) {
                    found = true;
                    Speech.speak('Entendido. Indo para ' + match.title, { language: 'pt-BR', rate: settings.speechRate, voice: settings.voiceId || undefined });
                    handleSelectDestination(match);
                    break;
                }
            }
            if (!found) {
                Speech.speak('Destino não encontrado em seus favoritos. Tente novamente.', { language: 'pt-BR', rate: settings.speechRate, voice: settings.voiceId || undefined });
            }
        }
    };

    const startListening = async () => {
        try {
            await Voice.start('pt-BR');
        } catch (e: any) {
            console.error(e);
            if (e?.message?.includes('null')) Alert.alert(
                'Build Desatualizado',
                'Instale a última versão do APK compilado pelo EAS para que os pacotes nativos de voz sejam acionados.'
            );
        }
    };

    const stopListening = async () => {
        try {
            await Voice.stop();
            setIsListening(false);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSelectDestination = (dest: DestinationType) => {
        Speech.stop(); // Interrompe qualquer robô falando antes de gerar a nova fala
        Speech.speak(`Indo para ${dest.title}. ${settings.phrases.destinationSelectWait || 'Aguarde'}`, { // Added speech
            language: 'pt-BR',
            rate: settings.speechRate,
            voice: settings.voiceId || undefined
        });

        router.push({
            pathname: '/origin',
            params: {
                destinationId: dest.id,
                destinationTitle: dest.title,
                destinationAddress: dest.address // Necessário para converter endereço textual do BD do app em LAT/LNG para o app oficial do Uber!
            }
        });
    };

    const pulseScale = pulseAnim.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [1, 1.4, 1],
    });

    const pulseOpacity = pulseAnim.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [0.3, 0, 0],
    });

    return (
        <SafeAreaView className="flex-1 bg-background-dark">
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* Background Texture Overlay */}
            <View className="absolute inset-0 z-50 opacity-[0.03]" pointerEvents="none">
                <Image
                    source={{ uri: 'https://www.transparenttextures.com/patterns/dark-matter.png' }}
                    className="w-full h-full"
                    resizeMode="repeat"
                />
            </View>

            {/* Top Status Bar & Greeting */}
            <View className="flex-none px-6 pt-12 pb-4 z-10 w-full" style={{ paddingTop: 48 }}>
                <View className="flex-row justify-between items-start">
                    <View className="flex-col">
                        <Text className="text-gray-400 text-lg font-medium mb-1 font-display">Para onde vamos?</Text>
                        <Text className="text-4xl font-bold tracking-tight text-[#CCFF00] font-display">VozMobby</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push('/settings')}
                        activeOpacity={0.7}
                        className="items-center justify-center w-12 h-12 rounded-full border-2 border-stroke bg-surface active:border-primary"
                    >
                        <MaterialIcons name="settings" size={26} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Content Area - Destinos */}
            <ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: 190, justifyContent: 'flex-start', flexGrow: 1, gap: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {destinations.map((dest) => (
                    <TouchableOpacity
                        key={dest.id}
                        onPress={() => handleSelectDestination(dest)}
                        onLongPress={() => openEditModal(dest)}
                        delayLongPress={300}
                        activeOpacity={0.8}
                        className="w-full h-[120px] rounded-xl flex-row items-center px-6 active:scale-[0.98]"
                        style={{ backgroundColor: dest.color }}
                    >
                        <View className="items-center justify-center w-16 h-16 rounded-full bg-black/20 mr-4">
                            <MaterialIcons name={dest.icon} size={36} color="white" />
                        </View>
                        <View className="flex-col items-start flex-1">
                            <Text className="text-2xl font-bold tracking-wide font-display" style={{ color: dest.color === '#CCFF00' ? 'black' : 'white' }}>{dest.title}</Text>
                            <Text className="text-sm font-mono mt-1" style={{ color: dest.color === '#CCFF00' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }}>{dest.address}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => openEditModal(dest)}
                            className="p-2 ml-1 bg-black/20 rounded-full"
                        >
                            <MaterialIcons name="edit" size={24} color={dest.color === '#CCFF00' ? 'black' : 'white'} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}

                {/* Novo Destino */}
                <TouchableOpacity
                    onPress={openNewModal}
                    activeOpacity={0.7}
                    className="w-full h-[80px] border-2 border-dashed border-stroke rounded-xl flex-row items-center justify-center gap-3 active:border-white mb-6"
                >
                    <MaterialIcons name="add" size={24} color="#9CA3AF" />
                    <Text className="font-bold text-gray-400 font-display">ADICIONAR OUTRO</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Bottom Fixed Container: Mic Trigger */}
            <View className="absolute bottom-0 left-0 w-full h-[30%] min-h-[220px]" pointerEvents="box-none">
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)', '#000000']}
                    className="flex-1 w-full items-center justify-end pb-12"
                    pointerEvents="box-none"
                >
                    <View className="items-center justify-end" pointerEvents="box-none">
                        <View className="relative items-center justify-center w-[88px] h-[88px]">
                            <Animated.View
                                className="absolute w-full h-full rounded-full bg-primary"
                                style={{
                                    transform: [{ scale: pulseScale }],
                                    opacity: pulseOpacity,
                                }}
                            />

                            <TouchableOpacity
                                activeOpacity={0.7}
                                className={`absolute items-center justify-center w-[88px] h-[88px] rounded-full z-10 active:scale-90 ${isListening ? 'bg-red-500' : 'bg-[#CCFF00]'}`}
                                style={{
                                    shadowColor: isListening ? '#EF4444' : '#CCFF00',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.8,
                                    shadowRadius: 24,
                                    elevation: 15,
                                }}
                                onPressIn={startListening}
                                onPressOut={stopListening}
                            >
                                <MaterialIcons name="mic" size={48} color={isListening ? 'white' : 'black'} />
                            </TouchableOpacity>
                        </View>

                        <Text className="mt-6 text-white text-lg font-bold tracking-widest uppercase opacity-80 font-display">
                            {isListening ? (spokenText.length > 0 ? spokenText : 'Escutando...') : 'Segure para falar'}
                        </Text>
                    </View>
                </LinearGradient>
            </View>

            {/* Modal de Criação / Edição */}
            <DestinationModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveDestination}
                onDelete={handleDeleteDestination}
                initialData={editingDestination}
            />
        </SafeAreaView>
    );
}
