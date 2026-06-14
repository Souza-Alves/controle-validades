import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as MailComposer from 'expo-mail-composer';
import { Produto, SituacaoType, StatusType } from '../src/types';
import { getProdutos, getLocais } from '../src/storage';
import { parseDate, formatDate, applyDateMask } from '../src/utils/date';
import { Local } from '../src/types';

type SortField = 'local' | 'qtd' | 'produto' | 'validade' | 'situacao' | 'status';
type SortDir = 'asc' | 'desc';

export default function ExportarScreen() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);

  const [filtrosLocal, setFiltrosLocal] = useState<string[]>([]);
  const [filtroCondicao, setFiltroCondicao] = useState<SituacaoType>('');
  const [filtroStatus, setFiltroStatus] = useState<StatusType>('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');

  const [showLocalPicker, setShowLocalPicker] = useState(false);
  const [showCondicaoPicker, setShowCondicaoPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const localTriggerRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [localPickerPos, setLocalPickerPos] = useState({ top: 0, left: 0, width: 0 });

  const [sortField, setSortField] = useState<SortField>('validade');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const dateStartRef = useRef<HTMLInputElement | null>(null);
  const dateEndRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    const [prods, locs] = await Promise.all([getProdutos(), getLocais()]);
    setProdutos(prods);
    setLocais(locs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const closeAllDropdowns = () => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
    }
    setShowLocalPicker(false);
    setShowCondicaoPicker(false);
    setShowStatusPicker(false);
  };

  const locaisAtivos = locais.filter((l) => l.ativo);
  const localById = new Map(locais.map((l) => [l.id, l]));
  const localByNome = new Map(locais.map((l) => [l.nome.toLowerCase(), l]));
  const isLocalAtivo = (p: Produto): boolean => {
    const loc = localById.get(p.localId) ?? localByNome.get(p.localNome.toLowerCase());
    return loc ? loc.ativo : false;
  };

  const filteredProdutos = produtos.filter((p) => {
    if (!isLocalAtivo(p)) return false;
    if (filtrosLocal.length > 0) {
      const match = filtrosLocal.some(
        (f) => p.localNome.toLowerCase() === f.toLowerCase()
      );
      if (!match) return false;
    }
    if (filtroCondicao && p.situacao !== filtroCondicao) return false;
    if (filtroCondicao === 'Vencido' && filtroStatus && p.status !== filtroStatus) return false;
    if (periodoInicio && periodoFim) {
      const d = parseDate(p.validade);
      const start = parseDate(periodoInicio);
      const end = parseDate(periodoFim);
      if (d && start && end) {
        if (d < start || d > end) return false;
      }
    }
    return true;
  });

  const sortedProdutos = [...filteredProdutos].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'local') {
      cmp = a.localNome.localeCompare(b.localNome);
    } else if (sortField === 'qtd') {
      cmp = a.quantidade - b.quantidade;
    } else if (sortField === 'produto') {
      cmp = a.nome.localeCompare(b.nome);
    } else if (sortField === 'situacao') {
      cmp = (a.situacao || '').localeCompare(b.situacao || '');
    } else if (sortField === 'status') {
      cmp = (a.status || '').localeCompare(b.status || '');
    } else {
      const da = parseDate(a.validade);
      const db = parseDate(b.validade);
      cmp = (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleLocalFilter = (nome: string) => {
    setFiltrosLocal((prev) =>
      prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]
    );
  };

  const handleDateChange = (
    value: string,
    setter: (v: string) => void
  ) => {
    if (!value) return;
    const parts = value.split('-');
    if (parts.length === 3) {
      setter(`${parts[2]}/${parts[1]}/${parts[0]}`);
    }
  };

  const openNativeDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (Platform.OS === 'web' && ref.current) {
      ref.current.showPicker?.();
      ref.current.click();
    }
  };

  const handleExport = async () => {
    if (sortedProdutos.length === 0) {
      Alert.alert('Info', 'Nenhum produto para enviar com os filtros aplicados.');
      return;
    }

    const today = new Date();
    let body = 'Relatorio de Produtos - Controle de Validades\n\n';
    body += 'Local | Qtd | Produto | Validade | Situacao | Status\n';
    body += '------|-----|---------|----------|----------|-------\n';
    sortedProdutos.forEach((p) => {
      body += `${p.localNome} | ${p.quantidade} | ${p.nome} | ${p.validade} | ${p.situacao || '-'} | ${p.status || '-'}\n`;
    });
    body += `\nTotal: ${sortedProdutos.length} produto(s)`;

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Erro', 'Servico de email nao disponivel neste dispositivo.');
      return;
    }

    await MailComposer.composeAsync({
      subject: `Controle de Validades - Relatorio (${formatDate(today)})`,
      body,
    });
  };

  const sortArrow = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const localFilterLabel =
    filtrosLocal.length === 0
      ? 'Todos'
      : filtrosLocal.length <= 2
        ? filtrosLocal.join(', ')
        : `${filtrosLocal.length} selecionados`;

  const renderItem = ({ item }: { item: Produto }) => (
    <View style={styles.row}>
      <Text style={[styles.cell, { flex: 2 }]}>{item.localNome}</Text>
      <Text style={[styles.cell, { flex: 0.5 }]}>{item.quantidade}</Text>
      <Text style={[styles.cell, { flex: 2.5 }]}>{item.nome}</Text>
      <Text style={[styles.cell, { flex: 1.2 }]} numberOfLines={1}>{item.validade.substring(0,5)}</Text>
      <Text style={[styles.cell, { flex: 1.5 }]}>{item.situacao || '-'}</Text>
      <Text style={[styles.cell, { flex: 1.5 }]}>{item.status || '-'}</Text>
    </View>
  );

  const tableHeader = () => (
    <View style={styles.headerRow}>
      <Text style={[styles.headerCell, { flex: 2 }]} onPress={() => toggleSort('local')}>Local{sortArrow('local')}</Text>
      <Text style={[styles.headerCell, { flex: 0.5 }]} onPress={() => toggleSort('qtd')}>Qtd{sortArrow('qtd')}</Text>
      <Text style={[styles.headerCell, { flex: 2.5 }]} onPress={() => toggleSort('produto')}>Produto{sortArrow('produto')}</Text>
      <Text style={[styles.headerCell, { flex: 1.2 }]} onPress={() => toggleSort('validade')}>Data{sortArrow('validade')}</Text>
      <Text style={[styles.headerCell, { flex: 1.5 }]} onPress={() => toggleSort('situacao')}>Situação{sortArrow('situacao')}</Text>
      <Text style={[styles.headerCell, { flex: 1.5 }]} onPress={() => toggleSort('status')}>Status{sortArrow('status')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <View style={[styles.filterField, { zIndex: 30 }]}>
            <Text style={styles.filterLabel}>Local:</Text>
            <TouchableOpacity
              ref={localTriggerRef}
              style={styles.filterInput}
              onPress={() => {
                setShowCondicaoPicker(false);
                setShowStatusPicker(false);
                if (showLocalPicker) {
                  setShowLocalPicker(false);
                  return;
                }
                localTriggerRef.current?.measureInWindow((x, y, width, height) => {
                  setLocalPickerPos({ top: y + height, left: x, width });
                  setShowLocalPicker(true);
                });
              }}
            >
              <Text numberOfLines={1}>{localFilterLabel}</Text>
            </TouchableOpacity>
            <Modal
              visible={showLocalPicker}
              transparent
              animationType="none"
              onRequestClose={() => setShowLocalPicker(false)}
            >
              <Pressable style={styles.pickerOverlay} onPress={() => setShowLocalPicker(false)}>
                <View
                  style={[
                    styles.dropdownModalBox,
                    {
                      top: localPickerPos.top,
                      left: localPickerPos.left,
                      width: Math.min(
                        Math.max(localPickerPos.width, 220),
                        Dimensions.get('window').width - localPickerPos.left - 8
                      ),
                    },
                  ]}
                >
                  <ScrollView
                    style={{ maxHeight: 240 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    <TouchableOpacity
                      style={[styles.ddItem, filtrosLocal.length === 0 && styles.ddItemSelected]}
                      onPress={() => { setFiltrosLocal([]); setShowLocalPicker(false); }}
                    >
                      <Text style={filtrosLocal.length === 0 ? styles.ddTextSelected : undefined}>Todos</Text>
                    </TouchableOpacity>
                    {locaisAtivos.map((l) => {
                      const sel = filtrosLocal.includes(l.nome);
                      return (
                        <TouchableOpacity
                          key={l.id}
                          style={[styles.ddItem, sel && styles.ddItemSelected]}
                          onPress={() => toggleLocalFilter(l.nome)}
                        >
                          <View style={styles.checkboxRow}>
                            <View style={[styles.checkbox, sel && styles.checkboxChecked]}>
                              {sel && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                            </View>
                            <Text style={sel ? styles.ddTextSelected : undefined}>{l.nome}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>
          </View>
          <View style={[styles.filterField, { zIndex: 20 }]}>
            <Text style={styles.filterLabel}>Condicao:</Text>
            <TouchableOpacity
              style={styles.filterInput}
              onPress={() => {
                setShowCondicaoPicker(!showCondicaoPicker);
                setShowLocalPicker(false);
                setShowStatusPicker(false);
              }}
            >
              <Text numberOfLines={1}>{filtroCondicao || 'Todos'}</Text>
            </TouchableOpacity>
            {showCondicaoPicker && (
              <View style={styles.dropdownAbsolute}>
                {(['', 'Vendido', 'Vencido'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt || 'todos'}
                    style={styles.ddItem}
                    onPress={() => {
                      setFiltroCondicao(opt);
                      if (opt !== 'Vencido') setFiltroStatus('');
                      setShowCondicaoPicker(false);
                    }}
                  >
                    <Text>{opt || 'Todos'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={[styles.filterField, { zIndex: 10 }]}>
            <Text style={styles.filterLabel}>Status:</Text>
            <TouchableOpacity
              style={[styles.filterInput, filtroCondicao !== 'Vencido' && styles.inputDisabled]}
              onPress={() => {
                if (filtroCondicao !== 'Vencido') return;
                setShowStatusPicker(!showStatusPicker);
                setShowLocalPicker(false);
                setShowCondicaoPicker(false);
              }}
              disabled={filtroCondicao !== 'Vencido'}
            >
              <Text style={filtroCondicao !== 'Vencido' ? styles.textDisabled : undefined} numberOfLines={1}>
                {filtroCondicao === 'Vencido' ? (filtroStatus || 'Todos') : 'Disponivel apenas para Vencido'}
              </Text>
            </TouchableOpacity>
            {showStatusPicker && filtroCondicao === 'Vencido' && (
              <View style={styles.dropdownAbsolute}>
                {(['', 'Baixado', 'Pendente'] as StatusType[]).map((opt) => (
                  <TouchableOpacity
                    key={opt || 'todos'}
                    style={styles.ddItem}
                    onPress={() => { setFiltroStatus(opt); setShowStatusPicker(false); }}
                  >
                    <Text>{opt || 'Todos'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Periodo Inicio:</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.filterInput, { flex: 1, paddingVertical: 8 }]}
                value={periodoInicio}
                onChangeText={(t) => setPeriodoInicio(applyDateMask(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
              {Platform.OS === 'web' && (
                <View style={styles.datePickerWebWrapper}>
                  <input
                    ref={dateStartRef}
                    type="date"
                    style={{ position: 'absolute', opacity: 0, width: 30, height: 30, cursor: 'pointer' }}
                    onChange={(e) => handleDateChange(e.target.value, setPeriodoInicio)}
                  />
                  <TouchableOpacity style={styles.datePickerButton} onPress={() => openNativeDatePicker(dateStartRef)}>
                    <Text style={styles.datePickerIcon}>{'\uD83D\uDCC5'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Periodo Fim:</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.filterInput, { flex: 1, paddingVertical: 8 }]}
                value={periodoFim}
                onChangeText={(t) => setPeriodoFim(applyDateMask(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
              {Platform.OS === 'web' && (
                <View style={styles.datePickerWebWrapper}>
                  <input
                    ref={dateEndRef}
                    type="date"
                    style={{ position: 'absolute', opacity: 0, width: 30, height: 30, cursor: 'pointer' }}
                    onChange={(e) => handleDateChange(e.target.value, setPeriodoFim)}
                  />
                  <TouchableOpacity style={styles.datePickerButton} onPress={() => openNativeDatePicker(dateEndRef)}>
                    <Text style={styles.datePickerIcon}>{'\uD83D\uDCC5'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Table - FlatList as direct child for reliable scroll */}
      <FlatList
        style={styles.tableList}
        data={sortedProdutos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={tableHeader}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
          </View>
        }
      />
      <View style={styles.footer}>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Text style={styles.exportButtonText}>Enviar por Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {   flex: 1,
    backgroundColor: '#f5f5f5',},
  filterContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 10,
  },
  filterRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  filterField: { flex: 1, position: 'relative' },
  filterLabel: { fontSize: 12, color: '#666', marginBottom: 2 },
  filterInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  inputDisabled: { backgroundColor: '#eee', borderColor: '#ddd' },
  textDisabled: { color: '#bbb' },
  dateInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  datePickerWebWrapper: { position: 'relative', width: 30, height: 30 },
  datePickerButton: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  datePickerIcon: { fontSize: 18 },
  dropdownAbsolute: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  pickerOverlay: {
    flex: 1,
  },
  dropdownModalBox: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  ddItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  ddItemSelected: { backgroundColor: '#e8f5e1' },
  ddTextSelected: { color: '#4a8a1a', fontWeight: 'bold' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderWidth: 2, borderColor: '#ccc',
    borderRadius: 4, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#7CB24B', backgroundColor: '#7CB24B' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
 
  tableList: {
    flex: 1,
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#7CB24B',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#7CB24B',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  headerCell: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cell: {
    fontSize: 13,
    color: '#333',
    paddingHorizontal: 4,
  },

  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 14 },
  footer: {
     alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 5,
  },

  exportButton: {
    backgroundColor: '#7CB24B',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 170,
  },
  exportButtonText: {  color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },


});
