import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export type DestinationType = {
    id?: number;
    title: string;
    address: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
};

interface OriginModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (address: string) => void;
    onSaveAndFavorite: (dest: DestinationType) => void;
}

const COLORS = ['#FF0055', '#00CCFF', '#CCFF00', '#FF9900', '#9D00FF', '#00FF66'];
const ICONS: (keyof typeof MaterialIcons.glyphMap)[] = [
    'home', 'work', 'store', 'restaurant', 'local-cafe',
    'fitness-center', 'school', 'flight', 'favorite', 'star'
];

export default function OriginModal({ visible, onClose, onSave, onSaveAndFavorite }: OriginModalProps) {
    const [title, setTitle] = useState('');
    const [address, setAddress] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressComplement, setAddressComplement] = useState('');
    const [cepState, setCepState] = useState('');
    const [cepLoading, setCepLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

    useEffect(() => {
        if (visible) {
            setCepState('');
            setCepLoading(false);
            setTitle('');
            setAddress('');
            setAddressNumber('');
            setAddressComplement('');
            setSelectedColor(COLORS[0]);
            setSelectedIcon(ICONS[0]);
        }
    }, [visible]);

    const fetchAddressByCep = async (cleanCep: string) => {
        setCepLoading(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (data.erro) {
                setAlertConfig({ visible: true, title: 'Atenção', message: 'CEP não encontrado.' });
                setCepLoading(false);
                return;
            }

            const fullAddress = `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`;
            setAddress(fullAddress);
        } catch (error) {
            setAlertConfig({ visible: true, title: 'Erro', message: 'Não foi possível buscar o CEP, verifique a conexão.' });
        } finally {
            setCepLoading(false);
        }
    };

    const getFullAddress = () => {
        let finalLocationString = address.trim();
        if (addressNumber.trim()) finalLocationString += `, ${addressNumber.trim()}`;
        if (addressComplement.trim()) finalLocationString += ` - ${addressComplement.trim()}`;
        return finalLocationString;
    }

    const handleSearchOnly = () => {
        if (!address.trim()) return;
        onSave(getFullAddress());
        onClose();
    };

    const handleSaveAndSearch = () => {
        if (!address.trim() || !title.trim()) return;
        onSaveAndFavorite({
            title,
            address: getFullAddress(),
            color: selectedColor,
            icon: selectedIcon
        });
        onClose();
    }

    const isSearchDisabled = !address.trim();
    const isSaveFavDisabled = !address.trim() || !title.trim();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <Modal visible={alertConfig.visible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/80 px-4">
                    <View className="bg-surface w-full rounded-3xl p-6 border-2 border-red-500 items-center">
                        <View className="w-16 h-16 bg-red-500/20 rounded-full items-center justify-center mb-4">
                            <MaterialIcons name="error-outline" size={32} color="#EF4444" />
                        </View>
                        <Text className="text-white text-2xl font-bold font-display mb-2">{alertConfig.title}</Text>
                        <Text className="text-gray-400 text-center mb-6">{alertConfig.message}</Text>
                        <TouchableOpacity
                            onPress={() => setAlertConfig({ ...alertConfig, visible: false })}
                            className="w-full bg-red-500 h-12 rounded-xl items-center justify-center"
                        >
                            <Text className="font-bold text-white text-lg font-display">ENTENDIDO</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black/60"
            >
                <View className="bg-surface rounded-t-3xl pt-6 px-6 pb-4 border-t border-stroke" style={{ maxHeight: '90%' }}>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-2xl font-bold font-display">
                            Digitar Endereço Atual
                        </Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-background-dark rounded-full">
                            <MaterialIcons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="">
                        {/* Input: Title */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">TÍTULO (CASO QUEIRA SALVAR NOS FAVORITOS)</Text>
                        <View className="bg-background-dark border border-stroke rounded-xl px-4 h-14 justify-center mb-5">
                            <TextInput
                                className="text-white text-lg font-display flex-1"
                                placeholder="Ex: Farmácia do João..."
                                placeholderTextColor="#6B7280"
                                value={title}
                                onChangeText={setTitle}
                                autoCapitalize="characters"
                                style={{ paddingVertical: 0 }}
                            />
                        </View>

                        {/* Input: CEP */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">CEP (OPCIONAL, AUTO-PREENCHE A RUA)</Text>
                        <View className="bg-background-dark border border-stroke rounded-xl px-4 h-14 flex-row items-center mb-5">
                            <TextInput
                                className="text-white text-base font-mono flex-1 mr-2"
                                placeholder="Ex: 01001-000"
                                placeholderTextColor="#6B7280"
                                keyboardType="number-pad"
                                maxLength={9}
                                value={cepState}
                                onChangeText={(text) => {
                                    const rawCep = text.replace(/\D/g, '');
                                    setCepState(text);
                                    if (rawCep.length === 8) {
                                        fetchAddressByCep(rawCep);
                                    }
                                }}
                                style={{ paddingVertical: 0 }}
                            />
                            {cepLoading && <ActivityIndicator color="#CCFF00" size="small" />}
                        </View>

                        {/* Input: Address */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">LOGRADOURO</Text>
                        <View className="bg-background-dark border border-stroke rounded-xl px-4 h-14 justify-center mb-5">
                            <TextInput
                                className="text-white text-base font-mono flex-1 mt-1"
                                placeholder="Ex: Av. Brasil"
                                placeholderTextColor="#6B7280"
                                value={address}
                                onChangeText={setAddress}
                                style={{ paddingVertical: 0 }}
                            />
                        </View>

                        {/* Input: Number and Complement */}
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-[0.4]">
                                <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">NÚMERO</Text>
                                <View className="bg-background-dark border border-stroke rounded-xl px-4 h-14 justify-center">
                                    <TextInput
                                        className="text-white text-base font-mono flex-1 mt-1"
                                        placeholder="Ex: 1000"
                                        placeholderTextColor="#6B7280"
                                        keyboardType="numeric"
                                        value={addressNumber}
                                        onChangeText={setAddressNumber}
                                        style={{ paddingVertical: 0 }}
                                    />
                                </View>
                            </View>

                            <View className="flex-1">
                                <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">COMPLEMENTO</Text>
                                <View className="bg-background-dark border border-stroke rounded-xl px-4 h-14 justify-center">
                                    <TextInput
                                        className="text-white text-base font-mono flex-1 mt-1"
                                        placeholder="Ex: Bloco B..."
                                        placeholderTextColor="#6B7280"
                                        value={addressComplement}
                                        onChangeText={setAddressComplement}
                                        style={{ paddingVertical: 0 }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Icon Selection */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">ÍCONE (SE FOR SALVAR NOS FAVORITOS)</Text>
                        <View className="h-[60px] mb-6">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-6 items-center flex-row">
                                {ICONS.map((icon) => (
                                    <TouchableOpacity
                                        key={icon}
                                        onPress={() => setSelectedIcon(icon)}
                                        className={`rounded-full items-center justify-center border-2 ${selectedIcon === icon ? 'border-primary bg-primary/20' : 'border-transparent bg-background-dark'}`}
                                        style={{ width: 56, height: 56 }}
                                    >
                                        <MaterialIcons name={icon} size={28} color={selectedIcon === icon ? '#CCFF00' : 'white'} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Color Selection */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">COR  (SE FOR SALVAR NOS FAVORITOS)</Text>
                        <View className="h-[60px] mb-2">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-6 items-center flex-row">
                                {COLORS.map((color) => (
                                    <TouchableOpacity
                                        key={color}
                                        onPress={() => setSelectedColor(color)}
                                        className="rounded-full border-2 items-center justify-center"
                                        style={{
                                            width: 56,
                                            height: 56,
                                            backgroundColor: color,
                                            borderColor: selectedColor === color ? 'white' : 'transparent'
                                        }}
                                    >
                                        {selectedColor === color && <MaterialIcons name="check" size={24} color={color === '#CCFF00' ? 'black' : 'white'} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                    </ScrollView>

                    {/* Actions - Fixed Bottom */}
                    <View className="flex-row gap-4 mt-4 pt-4 border-t border-stroke/50 pb-2">
                        <TouchableOpacity
                            onPress={handleSaveAndSearch}
                            disabled={isSaveFavDisabled}
                            className={`flex-1 h-[60px] rounded-xl items-center justify-center flex-col active:scale-95 ${isSaveFavDisabled ? 'bg-[#9D00FF]/50' : 'bg-[#9D00FF]'}`}
                        >
                            <MaterialIcons name="bookmark" size={20} color={isSaveFavDisabled ? 'rgba(255,255,255,0.4)' : 'white'} />
                            <Text className={`font-bold text-[12px] font-display ${isSaveFavDisabled ? 'text-white/40' : 'text-white'}`}>SALVAR FAV</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSearchOnly}
                            disabled={isSearchDisabled}
                            className={`flex-[2] h-[60px] rounded-xl items-center justify-center flex-row gap-2 active:scale-95 ${isSearchDisabled ? 'bg-primary/50' : 'bg-primary'}`}
                        >
                            <MaterialIcons name="search" size={24} color={isSearchDisabled ? 'rgba(0,0,0,0.4)' : 'black'} />
                            <Text className={`font-bold text-[16px] xl:text-lg font-display ${isSearchDisabled ? 'text-black/40' : 'text-black'}`}>BUSCAR UBER</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
