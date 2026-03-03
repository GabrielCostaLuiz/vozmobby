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
    ActivityIndicator,
    Alert,
    Linking,
    Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@dev-amirzubair/react-native-voice';
import { useSettings } from '../src/contexts/SettingsContext';
import OriginModal, { DestinationType } from '../src/components/OriginModal';
import { useSQLiteContext } from 'expo-sqlite';

export default function OriginScreen() {
    const router = useRouter();
    const db = useSQLiteContext();
    const { settings } = useSettings();
    const { destinationId, destinationTitle, destinationAddress } = useLocalSearchParams();

    // States
    const [isSearching, setIsSearching] = useState(false);
    const [currentStreetName, setCurrentStreetName] = useState('Usar GPS do telefone');
    const [originModalVisible, setOriginModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [errorModalConfig, setErrorModalConfig] = useState({ visible: false, message: '' });
    const [destinations, setDestinations] = useState<DestinationType[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [spokenText, setSpokenText] = useState('');

    // Refs
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const destinationsRef = useRef<DestinationType[]>([]);

    // Sync ref with state
    useEffect(() => {
        destinationsRef.current = destinations;
    }, [destinations]);

    // Animations
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    // Initial greeting / focus effects
    useEffect(() => {
        Speech.stop();
        const contextualMsg = settings.phrases.originScreenEnter.replace('{destination}', (destinationTitle as string) || 'Seu destino');
        Speech.speak(contextualMsg, {
            language: 'pt-BR',
            rate: settings.speechRate,
            pitch: 1.0,
            voice: settings.voiceId || undefined
        });

        return () => { Speech.stop() };
    }, [destinationTitle, settings.phrases.originScreenEnter, settings.speechRate, settings.voiceId]);

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
            console.error('Failed to load origin destinations:', error);
        }
    };

    // Voice Handlers
    useEffect(() => {
        Voice.onSpeechStart = () => setIsListening(true);
        Voice.onSpeechEnd = () => setIsListening(false);
        Voice.onSpeechResults = handleSpeechResults;
        Voice.onSpeechError = (e: SpeechErrorEvent) => {
            setIsListening(false);
            console.error('Origin Voice Error:', e);
        };

        return () => {
            Voice.destroy().then(Voice.removeAllListeners);
        };
    }, []);

    const handleSpeechResults = (e: SpeechResultsEvent) => {
        const phrases = e.value || [];
        setSpokenText(phrases[0] || '');

        if (phrases.length > 0) {
            let found = false;
            for (let phrase of phrases) {
                const cleaned = phrase.toLowerCase().trim();

                if (cleaned.includes('gps') || cleaned.includes('atual') || cleaned.includes('localizar')) {
                    found = true;
                    Speech.speak('Localizando via GPS...', { language: 'pt-BR', rate: settings.speechRate });
                    handleSelectCurrentLocation();
                    break;
                }

                const match = destinationsRef.current.find(d =>
                    cleaned.includes(d.title.toLowerCase().trim()) ||
                    d.title.toLowerCase().trim().includes(cleaned)
                );

                if (match) {
                    found = true;
                    Speech.speak('Ponto de partida: ' + match.title, { language: 'pt-BR', rate: settings.speechRate });
                    handleSelectCustomOrigin(match.address);
                    break;
                }
            }

            if (!found) {
                Speech.speak('Local não encontrado nos favoritos.', { language: 'pt-BR', rate: settings.speechRate });
            }
        }
    };

    const startListening = async () => {
        try {
            setSpokenText('');
            await Voice.start('pt-BR');
        } catch (e) {
            console.error(e);
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

    // Location Handlers
    const handleSelectCurrentLocation = async () => {
        setIsSearching(true);
        Speech.stop();
        Speech.speak(settings.phrases.gpsSearching, {
            language: 'pt-BR',
            rate: settings.speechRate,
            voice: settings.voiceId || undefined
        });

        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setIsSearching(false);
                Speech.speak(settings.phrases.gpsDenied, {
                    language: 'pt-BR',
                    rate: settings.speechRate,
                    voice: settings.voiceId || undefined
                });
                return;
            }

            let currLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const pickupLat = currLoc.coords.latitude;
            const pickupLng = currLoc.coords.longitude;

            const originMatches = await Location.reverseGeocodeAsync({ latitude: pickupLat, longitude: pickupLng });
            let readableOrigin = 'Endereço atual não identificado';
            if (originMatches.length > 0) {
                const fetchedAddress = originMatches[0];
                readableOrigin = `${fetchedAddress.street || fetchedAddress.name} ${fetchedAddress.streetNumber ? ', ' + fetchedAddress.streetNumber : ''}`;
            }

            let dropoffLat = null;
            let dropoffLng = null;

            if (destinationAddress) {
                const destMatches = await Location.geocodeAsync(destinationAddress as string);
                if (destMatches.length > 0) {
                    dropoffLat = destMatches[0].latitude;
                    dropoffLng = destMatches[0].longitude;
                }
            }

            setCurrentStreetName(readableOrigin);

            const speakString = settings.phrases.routeGenerating
                .replace('{origin}', readableOrigin)
                .replace('{destination}', (destinationTitle as string) || 'seu destino');

            let uberDeepLink = `uber://?client_id=chamauber&action=setPickup&pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}`;

            if (dropoffLat && dropoffLng) {
                uberDeepLink += `&dropoff[latitude]=${dropoffLat}&dropoff[longitude]=${dropoffLng}`;
            }

            Speech.speak(speakString, {
                language: 'pt-BR',
                rate: settings.speechRate,
                pitch: 1.0,
                voice: settings.voiceId || undefined,
                onDone: () => {
                    Linking.openURL(uberDeepLink).catch(() => {
                        Speech.speak('Erro. Parece que o aplicativo da Uber não está instalado no dispositivo.', { language: 'pt-BR' });
                    });
                }
            });

        } catch (error) {
            console.error('GPS/Geocode ERROR:', error);
            Speech.speak(settings.phrases.gpsFailed, {
                language: 'pt-BR',
                rate: settings.speechRate,
                voice: settings.voiceId || undefined
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectCustomOrigin = async (address: string) => {
        setIsSearching(true);
        Speech.stop();
        Speech.speak(settings.phrases.gpsSearching, {
            language: 'pt-BR',
            rate: settings.speechRate,
            voice: settings.voiceId || undefined
        });

        try {
            const originMatches = await Location.geocodeAsync(address);
            if (originMatches.length === 0) {
                setErrorModalConfig({ visible: true, message: 'Endereço de partida não encontrado pelo celular.' });
                setIsSearching(false);
                return;
            }

            const pickupLat = originMatches[0].latitude;
            const pickupLng = originMatches[0].longitude;

            let dropoffLat = null;
            let dropoffLng = null;

            if (destinationAddress) {
                const destMatches = await Location.geocodeAsync(destinationAddress as string);
                if (destMatches.length > 0) {
                    dropoffLat = destMatches[0].latitude;
                    dropoffLng = destMatches[0].longitude;
                }
            }

            setCurrentStreetName(address);

            const speakString = settings.phrases.routeGenerating
                .replace('{origin}', address)
                .replace('{destination}', (destinationTitle as string) || 'seu destino');

            let uberDeepLink = `uber://?client_id=chamauber&action=setPickup&pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}`;

            if (dropoffLat && dropoffLng) {
                uberDeepLink += `&dropoff[latitude]=${dropoffLat}&dropoff[longitude]=${dropoffLng}`;
            }

            Speech.speak(speakString, {
                language: 'pt-BR',
                rate: settings.speechRate,
                pitch: 1.0,
                voice: settings.voiceId || undefined,
                onDone: () => {
                    Linking.openURL(uberDeepLink).catch(() => {
                        Speech.speak('Erro. Aplicativo Uber não instalado.', { language: 'pt-BR' });
                    });
                }
            });

        } catch (error) {
            console.error('Custom Origin Geocode ERROR:', error);
            Speech.speak(settings.phrases.gpsFailed, {
                language: 'pt-BR',
                rate: settings.speechRate,
                voice: settings.voiceId || undefined
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleSaveFavorite = async (dest: DestinationType) => {
        try {
            await db.runAsync(
                'INSERT INTO destinations (title, address, icon, color) VALUES (?, ?, ?, ?)',
                dest.title, dest.address, dest.icon, dest.color
            );
            setSuccessModalVisible(true);
            loadDestinations();
        } catch (error) {
            console.error('Failed to save to SQLite:', error);
            setErrorModalConfig({ visible: true, message: 'Falha ao salvar o local favorito. Tente novamente.' });
        }
    };

    const pulseScale = pulseAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.3, 1],
    });

    return (
        <SafeAreaView className="flex-1 bg-background-dark">
            <Modal visible={successModalVisible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/80 px-4">
                    <View className="bg-surface w-full rounded-3xl p-6 border-2 border-[#CCFF00] items-center">
                        <View className="w-16 h-16 bg-[#CCFF00]/20 rounded-full items-center justify-center mb-4">
                            <MaterialIcons name="done" size={32} color="#CCFF00" />
                        </View>
                        <Text className="text-white text-2xl font-bold font-display mb-2">Sucesso!</Text>
                        <Text className="text-gray-400 text-center mb-6">Endereço favoritado e adicionado à listagem abaixo.</Text>
                        <TouchableOpacity
                            onPress={() => setSuccessModalVisible(false)}
                            className="w-full bg-[#CCFF00] h-12 rounded-xl items-center justify-center"
                        >
                            <Text className="font-bold text-black text-lg font-display">LEGAL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={errorModalConfig.visible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/80 px-4">
                    <View className="bg-surface w-full rounded-3xl p-6 border-2 border-red-500 items-center">
                        <View className="w-16 h-16 bg-red-500/20 rounded-full items-center justify-center mb-4">
                            <MaterialIcons name="error-outline" size={32} color="#EF4444" />
                        </View>
                        <Text className="text-white text-2xl font-bold font-display mb-2">Ops...</Text>
                        <Text className="text-gray-400 text-center mb-6">{errorModalConfig.message}</Text>
                        <TouchableOpacity
                            onPress={() => setErrorModalConfig({ ...errorModalConfig, visible: false })}
                            className="w-full bg-red-500 h-12 rounded-xl items-center justify-center"
                        >
                            <Text className="font-bold text-white text-lg font-display">ENTENDIDO</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            <View className="absolute inset-0 z-50 opacity-[0.03]" pointerEvents="none">
                <Image
                    source={{ uri: 'https://www.transparenttextures.com/patterns/dark-matter.png' }}
                    className="w-full h-full"
                    resizeMode="repeat"
                />
            </View>

            <View className="flex-none px-6 pt-12 pb-2 z-10 w-full" style={{ paddingTop: 48 }}>
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-12 h-12 bg-surface border-2 border-stroke rounded-full justify-center items-center"
                    >
                        <MaterialIcons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>

                    <View className="flex-col">
                        <Text className="text-gray-400 text-lg font-medium mb-1 font-display">De onde você vai sair?</Text>
                        <Text className="text-3xl font-bold tracking-tight text-white font-display">Sua Localização</Text>
                    </View>
                </View>

                <View className="mt-6 flex-row items-center gap-3">
                    <MaterialIcons name="place" size={20} color="#CCFF00" />
                    <Text className="text-white text-base">Indo para: <Text className="font-bold text-[#CCFF00] font-display">{destinationTitle || 'Destino...'}</Text></Text>
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4 mt-6"
                contentContainerStyle={{ paddingBottom: 190, gap: 16 }}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity
                    onPress={handleSelectCurrentLocation}
                    activeOpacity={0.8}
                    className="w-full h-[140px] rounded-xl flex-row items-center px-6 border-2 border-primary bg-[#CCFF00]/10 overflow-hidden relative"
                >
                    <Animated.View
                        className="absolute right-0 top-0 bottom-0 w-32 bg-primary opacity-10 rounded-full"
                        style={{ transform: [{ scale: pulseScale }] }}
                    />

                    <View className="items-center justify-center w-16 h-16 rounded-full bg-primary mr-4 shadow-lg shadow-primary">
                        {isSearching ? (
                            <ActivityIndicator color="black" size="large" />
                        ) : (
                            <MaterialIcons name="my-location" size={32} color="black" />
                        )}
                    </View>

                    <View className="flex-col items-start flex-1">
                        <Text className="text-2xl font-bold tracking-wide font-display text-primary">LOCALIZAÇÃO ATUAL</Text>
                        <Text className="text-sm font-mono mt-1 text-gray-300">
                            {isSearching ? 'Obtendo GPS...' : currentStreetName}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View className="h-[1px] bg-stroke my-2 mx-4" />
                <Text className="text-gray-400 font-bold ml-2 text-xs tracking-wider mb-2">OUTROS LOCAIS (FAVORITOS)</Text>

                {destinations.map((dest) => (
                    <TouchableOpacity
                        key={dest.id}
                        onPress={() => handleSelectCustomOrigin(dest.address)}
                        activeOpacity={0.8}
                        className="w-full h-[80px] rounded-xl flex-row items-center px-6 mb-4 active:scale-[0.98]"
                        style={{ backgroundColor: dest.color }}
                    >
                        <MaterialIcons name={dest.icon} size={28} color={dest.color === '#CCFF00' ? 'black' : 'white'} className="mr-4" />
                        <View className="flex-col items-start flex-1">
                            <Text className="text-xl font-bold tracking-wide font-display" style={{ color: dest.color === '#CCFF00' ? 'black' : 'white' }}>{dest.title}</Text>
                            <Text className="text-xs font-mono mt-1" style={{ color: dest.color === '#CCFF00' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }} numberOfLines={1}>{dest.address}</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity
                    onPress={() => setOriginModalVisible(true)}
                    activeOpacity={0.7}
                    className="w-full h-[80px] border-2 border-dashed border-stroke rounded-xl flex-row items-center px-6 mb-4"
                >
                    <MaterialIcons name="search" size={28} color="#9CA3AF" className="mr-4" />
                    <View>
                        <Text className="font-bold text-gray-400 font-display text-lg">DIGITAR UM NOVO ENDEREÇO</Text>
                        <Text className="text-gray-500 font-mono text-xs">Ex: Aeroporto Leste, Rua 2...</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            {/* Bottom Fixed Container: Mic Trigger (Standardized) */}
            <View className="absolute bottom-0 left-0 w-full h-[250px] z-20 pointer-events-none" pointerEvents="box-none">
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)', '#000000']}
                    className="flex-1 w-full items-center justify-end pb-10"
                    pointerEvents="box-none"
                >
                    <View className="items-center justify-end" pointerEvents="box-none">
                        <View className="relative items-center justify-center w-[88px] h-[88px]">
                            {isListening && (
                                <Animated.View
                                    className="absolute w-full h-full rounded-full bg-red-500 opacity-30"
                                    style={{
                                        transform: [{ scale: pulseScale }],
                                    }}
                                />
                            )}

                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPressIn={startListening}
                                onPressOut={stopListening}
                                className={`absolute items-center justify-center w-[88px] h-[88px] rounded-full z-10 active:scale-95 ${isListening ? 'bg-red-500' : 'bg-[#CCFF00]'}`}
                                style={{
                                    shadowColor: isListening ? '#EF4444' : '#CCFF00',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.8,
                                    shadowRadius: 24,
                                    elevation: 15,
                                }}
                            >
                                <MaterialIcons
                                    name={isListening ? 'mic' : 'mic-none'}
                                    size={48}
                                    color={isListening ? 'white' : 'black'}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text className="mt-4 text-[#CCFF00] font-bold text-sm tracking-widest uppercase opacity-90 font-display">
                            {isListening ? (spokenText || 'Escutando...') : 'Falar Favorito / GPS'}
                        </Text>
                    </View>
                </LinearGradient>
            </View>

            <OriginModal
                visible={originModalVisible}
                onClose={() => setOriginModalVisible(false)}
                onSave={handleSelectCustomOrigin}
                onSaveAndFavorite={handleSaveFavorite}
            />
        </SafeAreaView>
    );
}
