import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  ScrollView,
  Pressable,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as MailComposer from 'expo-mail-composer';
import { Produto, SituacaoType, StatusType } from '../src/types';
import { getProdutos, updateProduto, getLocais, deleteProduto } from '../src/storage';
import {
  parseDate,
  formatDate,
  isWithinDays,
  isInRange,
  compareDates,
  applyDateMask,
} from '../src/utils/date';
import { Local } from '../src/types';

type SortField = 'local' | 'qtd' | 'produto' | 'validade';
type SortDir = 'asc' | 'desc';

export default function HomeScreen() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [filtrosLocal, setFiltrosLocal] = useState<string[]>([]);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [diasFiltro, setDiasFiltro] = useState('');
  const [sortField, setSortField] = useState<SortField>('validade');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showLocalPicker, setShowLocalPicker] = useState(false);
  const localTriggerRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  const [localPickerPos, setLocalPickerPos] = useState({ top: 0, left: 0, width: 0 });

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [editLocalId, setEditLocalId] = useState('');
  const [editLocalNome, setEditLocalNome] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editValidade, setEditValidade] = useState('');
  const [editQuantidade, setEditQuantidade] = useState('');
  const [editSituacao, setEditSituacao] = useState<SituacaoType>('');
  const [editStatus, setEditStatus] = useState<StatusType>('');
  const [showModalLocalPicker, setShowModalLocalPicker] = useState(false);
  const [showModalSituacaoPicker, setShowModalSituacaoPicker] = useState(false);
  const [showModalStatusPicker, setShowModalStatusPicker] = useState(false);

  const [showDatePickerInicial, setShowDatePickerInicial] = useState(false);
  const [showDatePickerFinal, setShowDatePickerFinal] = useState(false);

  const datePickerInicialRef = useRef<HTMLInputElement | null>(null);
  const datePickerFinalRef = useRef<HTMLInputElement | null>(null);
  const datePickerModalRef = useRef<HTMLInputElement | null>(null);

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
    setShowModalLocalPicker(false);
    setShowModalSituacaoPicker(false);
    setShowModalStatusPicker(false);
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
    if (dataInicial && dataFinal) {
      return isInRange(p.validade, dataInicial, dataFinal);
    }
    const days = parseInt(diasFiltro, 10);
    if (!isNaN(days) && days >= 0) {
      return isWithinDays(p.validade, days);
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
    } else {
      cmp = compareDates(a.validade, b.validade);
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
    setFiltrosLocal((prev) => {
      if (prev.includes(nome)) {
        return prev.filter((n) => n !== nome);
      }
      return [...prev, nome];
    });
  };

  const openEditModal = (produto: Produto) => {
    setEditingProduto(produto);
    setEditLocalId(produto.localId);
    setEditLocalNome(produto.localNome);
    setEditNome(produto.nome);
    setEditValidade(produto.validade);
    setEditQuantidade(String(produto.quantidade));
    setEditSituacao(produto.situacao);
    setEditStatus(produto.status);
    setShowModalLocalPicker(false);
    setShowModalSituacaoPicker(false);
    setShowModalStatusPicker(false);
    setModalVisible(true);
  };

  const handleSaveModal = async () => {
    if (!editingProduto) return;
    if (!editNome.trim()) {
      Alert.alert('Erro', 'Nome do produto e obrigatorio.');
      return;
    }
    if (!editValidade.trim()) {
      Alert.alert('Erro', 'Data de validade e obrigatoria.');
      return;
    }
    const qty = parseInt(editQuantidade, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Erro', 'Quantidade invalida.');
      return;
    }
    const updated: Produto = {
      ...editingProduto,
      localId: editLocalId,
      localNome: editLocalNome,
      nome: editNome,
      validade: editValidade,
      quantidade: qty,
      situacao: editSituacao,
      status: editSituacao === 'Vencido' ? editStatus : '',
    };
    await updateProduto(updated);
    setModalVisible(false);
    setEditingProduto(null);
    loadData();
  };

  const handleDeleteProduto = () => {
    if (!editingProduto) return;
    Alert.alert(
      'Confirmar exclusao',
      `Deseja remover "${editingProduto.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await deleteProduto(editingProduto.id);
            setModalVisible(false);
            setEditingProduto(null);
            loadData();
          },
        },
      ]
    );
  };

  const enviarEmail = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 4);

    const itensProximos = produtos
      .filter((p) => {
        const d = parseDate(p.validade);
        return d && d >= today && d <= futureDate;
      })
      .sort((a, b) => a.localNome.localeCompare(b.localNome));

    if (itensProximos.length === 0) {
      Alert.alert('Info', 'Nenhum produto com vencimento nos proximos 4 dias.');
      return;
    }

    let body = 'Produtos proximos ao vencimento:\n\n';
    body += 'Local | Qtd | Produto | Validade | Situacao | Status\n';
    body += '------|-----|---------|----------|----------|-------\n';
    itensProximos.forEach((p) => {
      body += `${p.localNome} | ${p.quantidade} | ${p.nome} | ${p.validade} | ${p.situacao || '-'} | ${p.status || '-'}\n`;
    });

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Erro', 'Servico de email nao disponivel neste dispositivo.');
      return;
    }

    await MailComposer.composeAsync({
      subject: `Controle de Validades - Produtos proximos ao vencimento (${formatDate(today)})`,
      body,
    });
  };

  const handleDatePickerChange = (
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

  const sortArrow = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const renderItem = ({ item }: { item: Produto }) => (
    <TouchableOpacity style={styles.row} onPress={() => openEditModal(item)} activeOpacity={0.6}>
      <Text style={[styles.cell, { flex: 2 }]}>
        {item.localNome}
      </Text>
      <Text style={[styles.cell, { flex: 1 }]}>
        {item.quantidade}
      </Text>
      <Text style={[styles.cell, { flex: 2 }]}>
        {item.nome}
      </Text>
      <Text  style={[styles.cell, { flex: 2 }]}>
        {item.validade}
      </Text>
    </TouchableOpacity>
  );

  const localFilterLabel =
    filtrosLocal.length === 0
      ? 'Todos'
      : filtrosLocal.length <= 2
        ? filtrosLocal.join(', ')
        : `${filtrosLocal.length} selecionados`;

  return (
    <Pressable style={styles.container} onPress={closeAllDropdowns}>
      {/* Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <View style={[styles.filterField, { zIndex: 10 }]}>
            <Text style={styles.filterLabel}>Local:</Text>
            <TouchableOpacity
              ref={localTriggerRef}
              style={styles.filterInput}
              onPress={() => {
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
                      width: localPickerPos.width,
                    },
                  ]}
                >
                  <ScrollView
                    style={{ maxHeight: 240 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        filtrosLocal.length === 0 && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setFiltrosLocal([]);
                        setShowLocalPicker(false);
                      }}
                    >
                      <Text style={filtrosLocal.length === 0 ? styles.dropdownTextSelected : undefined}>
                        Todos
                      </Text>
                    </TouchableOpacity>
                    {locaisAtivos.map((l) => {
                      const selected = filtrosLocal.includes(l.nome);
                      return (
                        <TouchableOpacity
                          key={l.id}
                          style={[
                            styles.dropdownItem,
                            selected && styles.dropdownItemSelected,
                          ]}
                          onPress={() => toggleLocalFilter(l.nome)}
                        >
                          <View style={styles.checkboxRow}>
                            <View
                              style={[
                                styles.checkbox,
                                selected && styles.checkboxChecked,
                              ]}
                            >
                              {selected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                            </View>
                            <Text style={selected ? styles.dropdownTextSelected : undefined}>
                              {l.nome}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>
          </View>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Dias:</Text>
            <TextInput
              style={styles.filterInput}
              value={diasFiltro}
              onChangeText={setDiasFiltro}
              keyboardType="numeric"
              placeholder="4"
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Data Inicial:</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.filterInput, { flex: 1 }]}
                value={dataInicial}
                onChangeText={(t) => setDataInicial(applyDateMask(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
              {Platform.OS === 'web' && (
                <View style={styles.datePickerWebWrapper}>
                  <input
                    ref={datePickerInicialRef}
                    type="date"
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 30,
                      height: 30,
                      cursor: 'pointer',
                    }}
                    onChange={(e) =>
                      handleDatePickerChange(e.target.value, setDataInicial)
                    }
                  />
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => openNativeDatePicker(datePickerInicialRef)}
                  >
                    <Text style={styles.datePickerIcon}>{'\uD83D\uDCC5'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>Data Final:</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.filterInput, { flex: 1 }]}
                value={dataFinal}
                onChangeText={(t) => setDataFinal(applyDateMask(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
              {Platform.OS === 'web' && (
                <View style={styles.datePickerWebWrapper}>
                  <input
                    ref={datePickerFinalRef}
                    type="date"
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      width: 30,
                      height: 30,
                      cursor: 'pointer',
                    }}
                    onChange={(e) =>
                      handleDatePickerChange(e.target.value, setDataFinal)
                    }
                  />
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => openNativeDatePicker(datePickerFinalRef)}
                  >
                    <Text style={styles.datePickerIcon}>{'\uD83D\uDCC5'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.tableScroll}>
        <View style={styles.tableWrapper}>
          <View style={styles.headerRow}>
            
              <Text style={[styles.headerCell, { flex: 2 }]}
              onPress={() => toggleSort('local')}>
                Local{sortArrow('local')}
              </Text>
              <Text  style={[styles.headerCell,{ flex: 1 }]}
              onPress={() => toggleSort('qtd')}
             >
                Qtd{sortArrow('qtd')}
              </Text>
              <Text  style={[styles.headerCell, { flex: 2 }]}
              onPress={() => toggleSort('produto')}>
                Produto{sortArrow('produto')}
              </Text>
              <Text    style={[styles.headerCell, { flex: 2 }]}
              onPress={() => toggleSort('validade')}>
                Data{sortArrow('validade')}
              </Text>
          </View>
          <FlatList
            data={sortedProdutos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.listFull}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhum produto encontrado</Text>
              </View>
            }
          />
        </View>
      </View>
      <View style={styles.emailButtonWrapper}>
        <TouchableOpacity style={styles.emailButton} onPress={enviarEmail}>
          <Text style={styles.emailButtonText}>Enviar por Email</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (showModalLocalPicker || showModalSituacaoPicker || showModalStatusPicker) {
              setShowModalLocalPicker(false);
              setShowModalSituacaoPicker(false);
              setShowModalStatusPicker(false);
            } else {
              setModalVisible(false);
              setEditingProduto(null);
            }
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => {
            setShowModalLocalPicker(false);
            setShowModalSituacaoPicker(false);
            setShowModalStatusPicker(false);
          }}>
            <Text style={styles.modalTitle}>Editar Produto</Text>

            {editingProduto && (
              <>
                <View style={[styles.modalField, { zIndex: 30 }]}>
                  <Text style={styles.modalLabel}>Localizacao:</Text>
                  <TouchableOpacity
                    style={styles.modalPickerButton}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setShowModalLocalPicker(!showModalLocalPicker);
                      setShowModalSituacaoPicker(false);
                      setShowModalStatusPicker(false);
                    }}
                  >
                    <Text>{editLocalNome || 'Selecione o local...'}</Text>
                  </TouchableOpacity>
                  {showModalLocalPicker && (
                    <View style={styles.modalDropdown}>
                      <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                        {locais.filter((l) => l.ativo).map((l) => (
                          <TouchableOpacity
                            key={l.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setEditLocalId(l.id);
                              setEditLocalNome(l.nome);
                              setShowModalLocalPicker(false);
                            }}
                          >
                            <Text>{l.nome}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Produto:</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editNome}
                    onChangeText={setEditNome}
                    placeholder="Nome do produto"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Validade:</Text>
                  <View style={styles.dateInputRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 1 }]}
                      value={editValidade}
                      onChangeText={(text) => setEditValidade(applyDateMask(text))}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                    />
                    {Platform.OS === 'web' && (
                      <View style={styles.datePickerWebWrapper}>
                        <TouchableOpacity
                          style={styles.datePickerButton}
                          onPress={() => openNativeDatePicker(datePickerModalRef)}
                        >
                          <Text style={styles.datePickerIcon}>📅</Text>
                        </TouchableOpacity>
                        <input
                          ref={datePickerModalRef as React.RefObject<HTMLInputElement>}
                          type="date"
                          style={{
                            position: 'absolute',
                            opacity: 0,
                            width: 1,
                            height: 1,
                            top: 0,
                            left: 0,
                          }}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleDatePickerChange(e.target.value, setEditValidade)
                          }
                        />
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Quantidade:</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editQuantidade}
                    onChangeText={setEditQuantidade}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.modalField, { zIndex: 20 }]}>
                  <Text style={styles.modalLabel}>Situacao:</Text>
                  <TouchableOpacity
                    style={styles.modalPickerButton}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setShowModalLocalPicker(false);
                      setShowModalSituacaoPicker(!showModalSituacaoPicker);
                      setShowModalStatusPicker(false);
                    }}
                  >
                    <Text>{editSituacao || 'Selecione'}</Text>
                  </TouchableOpacity>
                  {showModalSituacaoPicker && (
                    <View style={styles.modalDropdown}>
                      {(['', 'Vendido', 'Vencido'] as SituacaoType[]).map((opt) => (
                        <TouchableOpacity
                          key={opt || 'vazio'}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditSituacao(opt);
                            if (opt !== 'Vencido') {
                              setEditStatus('');
                            }
                            setShowModalSituacaoPicker(false);
                          }}
                        >
                          <Text>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.modalField, { zIndex: 10 }]}>
                  <Text
                    style={[
                      styles.modalLabel,
                      editSituacao !== 'Vencido' && styles.modalLabelDisabled,
                    ]}
                  >
                    Status:
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.modalPickerButton,
                      editSituacao !== 'Vencido' && styles.modalPickerDisabled,
                    ]}
                    onPress={(e) => {
                      if (editSituacao !== 'Vencido') return;
                      e.stopPropagation?.();
                      setShowModalLocalPicker(false);
                      setShowModalStatusPicker(!showModalStatusPicker);
                      setShowModalSituacaoPicker(false);
                    }}
                    disabled={editSituacao !== 'Vencido'}
                  >
                    <Text
                      style={
                        editSituacao !== 'Vencido' ? styles.modalTextDisabled : undefined
                      }
                    >
                      {editSituacao === 'Vencido'
                        ? editStatus || 'Selecione'
                        : 'Disponivel apenas para vencidos'}
                    </Text>
                  </TouchableOpacity>
                  {showModalStatusPicker && editSituacao === 'Vencido' && (
                    <View style={styles.modalDropdown}>
                      {(['', 'Baixado', 'Pendente'] as StatusType[]).map((opt) => (
                        <TouchableOpacity
                          key={opt || 'vazio'}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditStatus(opt);
                            setShowModalStatusPicker(false);
                          }}
                        >
                          <Text>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteProduto}
                  >
                    <Text style={styles.deleteButtonText}>Remover</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRight}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setModalVisible(false);
                        setEditingProduto(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveModal}
                    >
                      <Text style={styles.saveButtonText}>Salvar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 10,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  filterField: {
    flex: 1,
    position: 'relative',
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 14,
    backgroundColor: '#fff',
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
  dropdownItemSelected: {
    backgroundColor: '#e8f5e1',
  },
  dropdownTextSelected: {
    color: '#4a8a1a',
    fontWeight: 'bold',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#7CB24B',
    backgroundColor: '#7CB24B',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emailButtonWrapper: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 5,
  },
  emailButton: {
    backgroundColor: '#7CB24B',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 170,
  },
  emailButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    alignItems: 'flex-start',
    backgroundColor: '#7CB24B',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
   previewHeaderRow: {
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
  previewIndex: {
    width: 30,
    fontSize: 12,
    color: '#999',
  },
  cell: {
    fontSize: 13,
    color: '#333',
    paddingHorizontal: 4,
  },

  
 
  listFull: {
    flexGrow: 1,
    minHeight: 200,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#f9f9f9',
  },
  pickerButtonText: {
    fontSize: 11,
    flexWrap: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: 28,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    zIndex: 999,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
    marginBottom: 2,
  },
  modalSubInfo: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 14,
    position: 'relative',
  },
  modalLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  modalLabelDisabled: {
    color: '#bbb',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  modalPickerButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f9f9f9',
  },
  modalPickerDisabled: {
    backgroundColor: '#eee',
    borderColor: '#ddd',
  },
  modalTextDisabled: {
    color: '#bbb',
  },
  modalDropdown: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  modalButtonsRight: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#7CB24B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
