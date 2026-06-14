import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { generateId } from '../src/utils/id';
import { Local } from '../src/types';
import { getLocais, addLocal, updateLocal, deleteLocal } from '../src/storage';

export default function LocaisScreen() {
  const [locais, setLocais] = useState<Local[]>([]);
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadLocais = useCallback(async () => {
    const data = await getLocais();
    setLocais(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLocais();
    }, [loadLocais])
  );

  const handleSave = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'Informe o nome do local.');
      return;
    }

    if (editingId) {
      await updateLocal({ id: editingId, nome: nome.trim(), ativo });
    } else {
      await addLocal({ id: generateId(), nome: nome.trim(), ativo });
    }

    setNome('');
    setAtivo(true);
    setEditingId(null);
    loadLocais();
  };

  const handleEdit = (local: Local) => {
    setNome(local.nome);
    setAtivo(local.ativo);
    setEditingId(local.id);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirmar', 'Deseja excluir este local?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteLocal(id);
          loadLocais();
        },
      },
    ]);
  };

  const handleCancel = () => {
    setNome('');
    setAtivo(true);
    setEditingId(null);
  };

  const renderItem = ({ item }: { item: Local }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemInfo}>
        <Text style={styles.listItemName}>{item.nome}</Text>
        <Text
          style={[
            styles.listItemStatus,
            { color: item.ativo ? '#7CB24B' : '#f44336' },
          ]}
        >
          {item.ativo ? 'Ativo' : 'Inativo'}
        </Text>
      </View>
      <View style={styles.listItemActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.actionButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.actionButtonText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Pressable style={styles.container} onPress={() => { if (Platform.OS !== 'web') Keyboard.dismiss(); }}>
      <View style={styles.form}>
        <Text style={styles.formTitle}>
          {editingId ? 'Editar Local' : 'Novo Local'}
        </Text>
        <Text style={styles.label}>Local</Text>
        <TextInput
          style={styles.input}
          value={nome}
          onChangeText={setNome}
          placeholder="Nome do local"
        />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Status:</Text>
          <View style={styles.switchContainer}>
            <Text style={{ color: ativo ? '#7CB24B' : '#f44336' }}>
              {ativo ? 'Ativo' : 'Inativo'}
            </Text>
            <Switch
              value={ativo}
              onValueChange={setAtivo}
              trackColor={{ false: '#ccc', true: '#7CB24B' }}
              thumbColor={ativo ? '#7CB24B' : '#f5f5f5'}
            />
          </View>
        </View>
        <View style={styles.formButtons}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>
              {editingId ? 'Atualizar' : 'Salvar'}
            </Text>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={locais}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum local cadastrado</Text>
          </View>
        }
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#7CB24B',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#888',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContainer: {
    padding: 8,
  },
  listItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  listItemStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButton: {
    backgroundColor: '#ff9800',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
});
