import { useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Alert, FlatList } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { generateId } from '../src/utils/id';
import * as XLSX from 'xlsx';
import { Produto } from '../src/types';
import { importBatch, getLocais } from '../src/storage';
import { applyDateMask } from '../src/utils/date';

interface ImportRow {
  predio: string;
  quantidade: number;
  produto: string;
  vencimento: string;
}

export default function ImportarScreen() {
  const [importedRows, setImportedRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);

  const normalizeYear = (yearStr: string): string => {
    if (yearStr.length <= 2) {
      const num = parseInt(yearStr, 10);
      return String(num <= 30 ? 2000 + num : 1900 + num);
    }
    return yearStr;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const readFileAsBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      return arrayBufferToBase64(buffer);
    }
    return readAsStringAsync(uri, { encoding: 'base64' });
  };

  const parseExcelDate = (value: unknown): string => {
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
    if (typeof value === 'string') {
      if (value.includes('/')) {
        const parts = value.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = normalizeYear(parts[2]);
          return `${day}/${month}/${year}`;
        }
        return applyDateMask(value.replace(/\D/g, ''));
      }
      if (value.includes('-')) {
        const parts = value.split('-');
        if (parts.length === 3) {
          const day = parts[2].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = normalizeYear(parts[0]);
          return `${day}/${month}/${year}`;
        }
      }
    }
    return String(value || '');
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setLoading(true);

      const fileContent = await readFileAsBase64(file.uri);

      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const rows: ImportRow[] = jsonData.map((row) => {
        const predio =
          String(
            row['predio'] ??
              row['Predio'] ??
              row['PREDIO'] ??
              row['Prédio'] ??
              row['prédio'] ??
              row['local'] ??
              row['Local'] ??
              row['LOCAL'] ??
              ''
          ).trim();
        const qtdValue =
          row['quantidade'] ??
          row['Quantidade'] ??
          row['QUANTIDADE'] ??
          row['qtd'] ??
          row['Qtd'] ??
          row['QTD'] ??
          1;
        const quantidade = parseInt(String(qtdValue), 10) || 1;
        const produto = String(
          row['produto'] ??
            row['Produto'] ??
            row['PRODUTO'] ??
            ''
        ).trim();
        const vencRaw =
          row['vencimento'] ??
          row['Vencimento'] ??
          row['VENCIMENTO'] ??
          row['validade'] ??
          row['Validade'] ??
          row['VALIDADE'] ??
          row['data'] ??
          row['Data'] ??
          '';
        const vencimento = parseExcelDate(vencRaw);

        return { predio, quantidade, produto, vencimento };
      });

      setImportedRows(rows);
      setImported(false);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      Alert.alert('Erro', 'Erro ao ler o arquivo. Verifique o formato.');
    }
  };

  const handleImport = async () => {
    if (importedRows.length === 0) {
      Alert.alert('Erro', 'Nenhum dado para importar.');
      return;
    }

    setLoading(true);

    try {
      const existingLocais = await getLocais();
      const localMap = new Map(existingLocais.map((l) => [l.nome.toLowerCase(), l]));

      const newLocais: { id: string; nome: string; ativo: boolean }[] = [];
      const newProdutos: Produto[] = [];

      for (const row of importedRows) {
        let local = localMap.get(row.predio.toLowerCase());
        if (!local) {
          local = { id: generateId(), nome: row.predio, ativo: true };
          newLocais.push(local);
          localMap.set(row.predio.toLowerCase(), local);
        }

        newProdutos.push({
          id: generateId(),
          localId: local.id,
          localNome: local.nome,
          quantidade: row.quantidade,
          nome: row.produto,
          validade: row.vencimento,
          situacao: '',
          status: '',
        });
      }

      await importBatch(newLocais, newProdutos);
      setImported(true);
      setLoading(false);
      Alert.alert(
        'Sucesso',
        `${newProdutos.length} produto(s) importado(s) com sucesso!`
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Erro', 'Erro ao importar os dados.');
    }
  };

  const renderPreviewItem = ({ item, index }: { item: ImportRow; index: number }) => (

    <View style={styles.previewRow}>
      <Text style={styles.previewIndex}>{index + 1}</Text>
      <Text style={[styles.previewCell, { flex: 2 }]}>{item.predio}</Text>
      <Text style={[styles.previewCell, { flex: 1 }]}>{item.quantidade}</Text>
      <Text style={[styles.previewCell, { flex: 2 }]}>{item.produto}</Text>
      <Text style={[styles.previewCell, { flex: 2 }]}>{item.vencimento}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Importar Planilha Excel</Text>
        <Text style={styles.subtitle}>
          O arquivo deve conter as colunas: predio, quantidade, produto e vencimento
        </Text>
        <TouchableOpacity
          style={styles.pickButton}
          onPress={handlePickFile}
          disabled={loading}
        >
          <Text style={styles.pickButtonText}>
            {loading ? 'Processando...' : 'Selecionar Arquivo'}
          </Text>
        </TouchableOpacity>
      </View>

      {importedRows.length > 0 && (
        <>
          <View style={styles.previewHeader}>
            <View style={styles.previewHeaderTopRow}>
              <Text style={styles.previewTitle}>
                Pre-visualizacao ({importedRows.length} itens)
              </Text>
              {!imported && (
                <TouchableOpacity
                  style={styles.importButton}
                  onPress={handleImport}
                  disabled={loading}
                >
                  <Text style={styles.importButtonText}>
                    {loading ? 'Importando...' : 'Confirmar Importacao'}
                  </Text>
                </TouchableOpacity>
              )}
              {imported && (
                <TouchableOpacity
                  style={styles.newImportButton}
                  onPress={() => {
                    setImportedRows([]);
                    setImported(false);
                  }}
                >
                  <Text style={styles.newImportButtonText}>Nova Importacao</Text>
                </TouchableOpacity>
              )}
            </View>
            {imported && (
              <Text style={styles.importedText}>Importado com sucesso!</Text>
            )}
          </View>

          <View style={styles.tableScroll}>
            <View style={styles.tableWrapper}>
          <View style={styles.previewHeaderRow}>
            <Text style={styles.previewIndex}>#</Text>
            <Text style={[styles.previewHeaderCell, { flex: 2 }]}>Predio</Text>
            <Text style={[styles.previewHeaderCell, { flex: 1 }]}>Qtd</Text>
            <Text style={[styles.previewHeaderCell, { flex: 2 }]}>Produto</Text>
            <Text style={[styles.previewHeaderCell, { flex: 2 }]}>Vencimento</Text>
          </View>

          <FlatList
            data={importedRows}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderPreviewItem}
          />
          </View>
</View>
        </>
      )}
    </View>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  pickButton: {
    backgroundColor: '#7CB24B',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  previewHeader: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  previewHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  importButton: {
    backgroundColor: '#7CB24B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  importButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  importedText: {
    color: '#7CB24B',
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 8,
  },
  newImportButton: {
    backgroundColor: '#7CB24B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  newImportButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#7CB24B',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  previewHeaderCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 4,
  },
  previewRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  previewIndex: {
    width: 30,
    fontSize: 12,
    color: '#999',
  },
  previewCell: {
    fontSize: 13,
    color: '#333',
    paddingHorizontal: 4,
  },
  tableWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#7CB24B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    flex: 1,
  },
   tableScroll: {
    flex: 1,
    width: '100%',
  },
});
