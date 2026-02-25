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

interface DestinationModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (dest: DestinationType) => void;
    onDelete?: (id: number) => void;
    initialData?: DestinationType | null;
}

const COLORS = ['#FF0055', '#00CCFF', '#CCFF00', '#FF9900', '#9D00FF', '#00FF66'];
const ICONS: (keyof typeof MaterialIcons.glyphMap)[] = [
    'home', 'work', 'store', 'restaurant', 'local-cafe',
    'fitness-center', 'school', 'flight', 'favorite', 'star'
];

export default function DestinationModal({ visible, onClose, onSave, onDelete, initialData }: DestinationModalProps) {
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
            setAddressNumber('');
            setAddressComplement('');

            if (initialData) {
                setTitle(initialData.title);
                setAddress(initialData.address); // Compatibilidade reversa: Joga tudo salvo na barra principal
                setSelectedColor(initialData.color);
                setSelectedIcon(initialData.icon);
            } else {
                setTitle('');
                setAddress('');
                setSelectedColor(COLORS[0]);
                setSelectedIcon(ICONS[0]);
            }
        }
    }, [visible, initialData]);

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

            // Monta o endereço concatenando Rua, Bairro e Cidade
            const fullAddress = `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}`;
            setAddress(fullAddress);
        } catch (error) {
            setAlertConfig({ visible: true, title: 'Erro', message: 'Não foi possível buscar o CEP, verifique a conexão.' });
        } finally {
            setCepLoading(false);
        }
    };

    const handleSave = () => {
        if (!title.trim() || !address.trim()) return;

        // Concatena a rua com os numéricos extra se eles existirem digitados
        let finalLocationString = address.trim();
        if (addressNumber.trim()) finalLocationString += `, ${addressNumber.trim()}`;
        if (addressComplement.trim()) finalLocationString += ` - ${addressComplement.trim()}`;

        onSave({
            id: initialData?.id,
            title,
            address: finalLocationString,
            color: selectedColor,
            icon: selectedIcon,
        });
        onClose();
    };

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
                            {initialData ? 'Editar Destino' : 'Novo Destino'}
                        </Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-background-dark rounded-full">
                            <MaterialIcons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="">
                        {/* Input: Title */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">TÍTULO DA ROTA</Text>
                        <View className="bg-background-dark border border-stroke rounded-xl px-4 h-14 justify-center mb-5">
                            <TextInput
                                className="text-white text-lg font-display flex-1"
                                placeholder="Ex: Academia"
                                placeholderTextColor="#6B7280"
                                value={title}
                                onChangeText={setTitle}
                                autoCapitalize="characters"
                                style={{ paddingVertical: 0 }}
                            />
                        </View>

                        {/* Input: CEP (Autofill de Endereço via ViaCEP API) */}
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
                                    // Remove não numéricos p/ formatar e buscar
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
                        <View className="flex-row gap-4 mb-7">
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
                                        placeholder="Ex: Bloco B, Apt 01"
                                        placeholderTextColor="#6B7280"
                                        value={addressComplement}
                                        onChangeText={setAddressComplement}
                                        style={{ paddingVertical: 0 }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Icon Selection */}
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">ÍCONE</Text>
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
                        <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs tracking-wider">COR</Text>
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
                    <View className="flex-row gap-4 mt-4 pt-2 border-t border-stroke/50">
                        {initialData && onDelete && (
                            <TouchableOpacity
                                onPress={() => {
                                    onDelete(initialData.id!);
                                    onClose();
                                }}
                                className="flex-1 h-[56px] bg-background-dark border border-red-500 rounded-xl items-center justify-center"
                            >
                                <Text className="text-red-500 font-bold text-[16px] font-display">EXCLUIR</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={!title.trim() || !address.trim()}
                            className={`flex-[2] rounded-xl items-center justify-center flex-row gap-2 active:scale-95 ${!title.trim() || !address.trim() ? 'bg-primary/50' : 'bg-primary'}` + (initialData ? " h-[56px]" : " h-14")}
                        >
                            <MaterialIcons name="check" size={24} color={!title.trim() || !address.trim() ? 'rgba(0,0,0,0.4)' : 'black'} />
                            <Text className={`font-bold text-[16px] xl:text-lg font-display ${!title.trim() || !address.trim() ? 'text-black/40' : 'text-black'}`}>SALVAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
