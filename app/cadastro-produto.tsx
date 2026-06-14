import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { generateId } from '../src/utils/id';
import { Local, SituacaoType, StatusType } from '../src/types';
import { getLocaisAtivos, addProduto } from '../src/storage';
import { applyDateMask, parseDate } from '../src/utils/date';

export default function CadastroProdutoScreen() {
  const [locais, setLocais] = useState<Local[]>([]);
  const [localId, setLocalId] = useState('');
  const [localNome, setLocalNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [nome, setNome] = useState('');
  const [validade, setValidade] = useState('');
  const [situacao, setSituacao] = useState<SituacaoType>('');
  const [status, setStatus] = useState<StatusType>('');
  const [showLocalPicker, setShowLocalPicker] = useState(false);
  const [showSituacaoPicker, setShowSituacaoPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const datePickerRef = useRef<HTMLInputElement | null>(null);

  useFocusEffect(
    useCallback(() => {
      getLocaisAtivos().then(setLocais);
    }, [])
  );

  const closeAllDropdowns = () => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
    setShowLocalPicker(false);
    setShowSituacaoPicker(false);
    setShowStatusPicker(false);
  };

  const handleSave = async () => {
    if (!localId) {
      Alert.alert('Erro', 'Selecione a localizacao.');
      return;
    }
    if (!quantidade.trim() || isNaN(Number(quantidade))) {
      Alert.alert('Erro', 'Informe a quantidade (numerico).');
      return;
    }
    if (!nome.trim()) {
      Alert.alert('Erro', 'Informe o nome do produto.');
      return;
    }
    if (!validade.trim() || !parseDate(validade)) {
      Alert.alert('Erro', 'Informe a validade no formato DD/MM/AAAA.');
      return;
    }

    await addProduto({
      id: generateId(),
      localId,
      localNome,
      quantidade: parseInt(quantidade, 10),
      nome: nome.trim(),
      validade,
      situacao,
      status,
    });

    Alert.alert('Sucesso', 'Produto cadastrado com sucesso!');
    setLocalId('');
    setLocalNome('');
    setQuantidade('');
    setNome('');
    setValidade('');
    setSituacao('');
    setStatus('');
  };

  const handleDateChange = (value: string) => {
    if (!value) return;
    const parts = value.split('-');
    if (parts.length === 3) {
      setValidade(`${parts[2]}/${parts[1]}/${parts[0]}`);
    }
  };

  const openNativeDatePicker = () => {
    if (Platform.OS === 'web' && datePickerRef.current) {
      datePickerRef.current.showPicker?.();
      datePickerRef.current.click();
    }
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={closeAllDropdowns}>
      <ScrollView style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.formTitle}>Cadastro de Produto</Text>

          {/* Localizacao */}
          <Text style={styles.label}>Localizacao</Text>
          <View style={{ zIndex: 30 }}>
            <TouchableOpacity
              style={styles.input}
              onPress={(e) => {
                e.stopPropagation?.();
                setShowLocalPicker(!showLocalPicker);
                setShowSituacaoPicker(false);
                setShowStatusPicker(false);
              }}
            >
              <Text style={localNome ? styles.inputText : styles.placeholderText}>
                {localNome || 'Selecione o local...'}
              </Text>
            </TouchableOpacity>
            {showLocalPicker && (
              <View style={styles.dropdown}>
                {locais.length === 0 ? (
                  <View style={styles.dropdownItem}>
                    <Text style={styles.placeholderText}>
                      Nenhum local ativo cadastrado
                    </Text>
                  </View>
                ) : (
                  locais.map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setLocalId(l.id);
                        setLocalNome(l.nome);
                        setShowLocalPicker(false);
                      }}
                    >
                      <Text>{l.nome}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Quantidade */}
          <Text style={styles.label}>Quantidade</Text>
          <TextInput
            style={styles.input}
            value={quantidade}
            onChangeText={setQuantidade}
            placeholder="Quantidade"
            keyboardType="numeric"
          />

          {/* Produto */}
          <Text style={styles.label}>Produto</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Nome do produto"
          />

          {/* Validade */}
          <Text style={styles.label}>Validade</Text>
          <View style={styles.dateInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={validade}
              onChangeText={(t) => setValidade(applyDateMask(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="numeric"
              maxLength={10}
            />
            {Platform.OS === 'web' && (
              <View style={styles.datePickerWebWrapper}>
                <input
                  ref={datePickerRef}
                  type="date"
                  style={{
                    position: 'absolute',
                    opacity: 0,
                    width: 30,
                    height: 30,
                    cursor: 'pointer',
                  }}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
                <TouchableOpacity style={styles.datePickerButton} onPress={openNativeDatePicker}>
                  <Text style={styles.datePickerIcon}>{'\uD83D\uDCC5'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Situacao */}
          <Text style={styles.label}>Situacao</Text>
          <View style={{ zIndex: 20 }}>
            <TouchableOpacity
              style={styles.input}
              onPress={(e) => {
                e.stopPropagation?.();
                setShowSituacaoPicker(!showSituacaoPicker);
                setShowLocalPicker(false);
                setShowStatusPicker(false);
              }}
            >
              <Text style={situacao ? styles.inputText : styles.placeholderText}>
                {situacao || 'Selecione...'}
              </Text>
            </TouchableOpacity>
            {showSituacaoPicker && (
              <View style={styles.dropdown}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSituacao('Vendido');
                    setShowSituacaoPicker(false);
                  }}
                >
                  <Text>Vendido</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSituacao('Vencido');
                    setShowSituacaoPicker(false);
                  }}
                >
                  <Text>Vencido</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <View style={{ zIndex: 10 }}>
            <TouchableOpacity
              style={styles.input}
              onPress={(e) => {
                e.stopPropagation?.();
                setShowStatusPicker(!showStatusPicker);
                setShowLocalPicker(false);
                setShowSituacaoPicker(false);
              }}
            >
              <Text style={status ? styles.inputText : styles.placeholderText}>
                {status || 'Selecione...'}
              </Text>
            </TouchableOpacity>
            {showStatusPicker && (
              <View style={styles.dropdown}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setStatus('Baixado');
                    setShowStatusPicker(false);
                  }}
                >
                  <Text>Baixado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setStatus('Pendente');
                    setShowStatusPicker(false);
                  }}
                >
                  <Text>Pendente</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Salvar Produto</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    backgroundColor: '#fff',
    padding: 16,
    margin: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  datePickerWebWrapper: {
    position: 'relative',
    width: 30,
    height: 30,
  },
  datePickerButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerIcon: {
    fontSize: 18,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginTop: 2,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#7CB24B',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
