import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { clearAllData } from '../src/storage';

export default function ConfiguracaoScreen() {
  const handleClearAll = () => {
    Alert.alert(
      'Confirmar',
      'Deseja apagar TODOS os dados (locais e produtos)? Esta acao nao pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Sucesso', 'Todos os dados foram apagados.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Configuracoes</Text>
        <Text style={styles.description}>
          Gerencie os dados do aplicativo.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados</Text>
          <Text style={styles.sectionDescription}>
            Apagar toda a base de dados incluindo locais e produtos cadastrados.
          </Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleClearAll}>
            <Text style={styles.dangerButtonText}>Apagar Toda a Base</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
