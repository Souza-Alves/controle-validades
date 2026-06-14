import { Platform } from 'react-native';
import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import * as XLSX from 'xlsx';
import { Local, Produto } from '../types';
import { supabase } from '../supabase';

const DATA_FILE = `${documentDirectory}controle_validades.xlsx`;
const QUEUE_FILE = `${documentDirectory}controle_validades_queue.json`;
const STORAGE_KEY = 'controle_validades_data';
const QUEUE_KEY = 'controle_validades_queue';
const MIGRATED_KEY = 'controle_validades_migrated';

interface WorkbookData {
  locais: Local[];
  produtos: Produto[];
}

type PendingOp =
  | { kind: 'upsertLocal'; data: Local }
  | { kind: 'deleteLocal'; id: string }
  | { kind: 'upsertProduto'; data: Produto }
  | { kind: 'deleteProduto'; id: string }
  | { kind: 'clearAll' };

// --------------- Cache local (offline) ---------------

async function readWorkbook(): Promise<WorkbookData> {
  if (Platform.OS === 'web') {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return { locais: [], produtos: [] };
      return JSON.parse(stored) as WorkbookData;
    } catch {
      return { locais: [], produtos: [] };
    }
  }

  const info = await getInfoAsync(DATA_FILE);
  if (!info.exists) return { locais: [], produtos: [] };

  const base64 = await readAsStringAsync(DATA_FILE, { encoding: EncodingType.Base64 });
  const wb = XLSX.read(base64, { type: 'base64' });

  let locais: Local[] = [];
  if (wb.SheetNames.includes('Locais')) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Locais']);
    locais = rows.map((r) => ({
      id: String(r['id'] ?? ''),
      nome: String(r['nome'] ?? ''),
      ativo: r['ativo'] === true || r['ativo'] === 'true' || r['ativo'] === 1,
    }));
  }

  let produtos: Produto[] = [];
  if (wb.SheetNames.includes('Produtos')) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Produtos']);
    produtos = rows.map((r) => ({
      id: String(r['id'] ?? ''),
      localId: String(r['localId'] ?? ''),
      localNome: String(r['localNome'] ?? ''),
      quantidade: Number(r['quantidade'] ?? 0),
      nome: String(r['nome'] ?? ''),
      validade: String(r['validade'] ?? ''),
      situacao: String(r['situacao'] ?? '') as Produto['situacao'],
      status: String(r['status'] ?? '') as Produto['status'],
    }));
  }

  return { locais, produtos };
}

async function writeWorkbook(data: WorkbookData): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return;
  }

  const wb = XLSX.utils.book_new();
  const locaisSheet = XLSX.utils.json_to_sheet(
    data.locais.map((l) => ({ id: l.id, nome: l.nome, ativo: l.ativo }))
  );
  XLSX.utils.book_append_sheet(wb, locaisSheet, 'Locais');

  const produtosSheet = XLSX.utils.json_to_sheet(
    data.produtos.map((p) => ({
      id: p.id,
      localId: p.localId,
      localNome: p.localNome,
      quantidade: p.quantidade,
      nome: p.nome,
      validade: p.validade,
      situacao: p.situacao,
      status: p.status,
    }))
  );
  XLSX.utils.book_append_sheet(wb, produtosSheet, 'Produtos');

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await writeAsStringAsync(DATA_FILE, base64, { encoding: EncodingType.Base64 });
}

// --------------- Fila de operações pendentes ---------------

async function readQueue(): Promise<PendingOp[]> {
  if (Platform.OS === 'web') {
    try {
      const stored = window.localStorage.getItem(QUEUE_KEY);
      return stored ? (JSON.parse(stored) as PendingOp[]) : [];
    } catch {
      return [];
    }
  }
  try {
    const info = await getInfoAsync(QUEUE_FILE);
    if (!info.exists) return [];
    const content = await readAsStringAsync(QUEUE_FILE);
    return JSON.parse(content) as PendingOp[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingOp[]): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return;
  }
  await writeAsStringAsync(QUEUE_FILE, JSON.stringify(queue));
}

async function enqueue(op: PendingOp): Promise<void> {
  const queue = await readQueue();
  queue.push(op);
  await writeQueue(queue);
  void ensureSynced(true);
}

async function getFlag(key: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
  }
  try {
    const info = await getInfoAsync(`${documentDirectory}${key}`);
    return info.exists;
  } catch { return false; }
}

async function setFlag(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(key, '1'); } catch { /* ignore */ }
    return;
  }
  try { await writeAsStringAsync(`${documentDirectory}${key}`, '1'); } catch { /* ignore */ }
}

// --------------- Mapeamento app ↔ Supabase ---------------
// tb_location: id(int8), name(varchar), status(bool), created_at
// tb_products: id(int8), name(varchar), amount(int4), exp_date(date),
//              situation(varchar), status(varchar), id_location(int4 FK)

function appDateToDb(d: string): string | null {
  if (!d) return null;
  const parts = d.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function dbDateToApp(d: string | null): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

interface DbLocal {
  id: number;
  name: string;
  status: boolean;
}

interface DbProdutoRow {
  id: number;
  name: string;
  amount: number;
  exp_date: string | null;
  situation: string;
  status: string;
  id_location: number;
  tb_location?: { name: string } | null;
}

function toDbLocal(l: Local): DbLocal {
  return { id: Number(l.id), name: l.nome, status: l.ativo };
}

function fromDbLocal(r: DbLocal): Local {
  return { id: String(r.id), nome: String(r.name ?? ''), ativo: !!r.status };
}

function toDbProduto(p: Produto): {
  id: number; name: string; amount: number; exp_date: string | null;
  situation: string; status: string; id_location: number;
} {
  return {
    id: Number(p.id),
    name: p.nome,
    amount: p.quantidade,
    exp_date: appDateToDb(p.validade),
    situation: p.situacao,
    status: p.status,
    id_location: Number(p.localId),
  };
}

function fromDbProduto(r: DbProdutoRow): Produto {
  return {
    id: String(r.id),
    localId: String(r.id_location ?? ''),
    localNome: r.tb_location?.name ?? '',
    quantidade: Number(r.amount ?? 0),
    nome: String(r.name ?? ''),
    validade: dbDateToApp(r.exp_date ?? null),
    situacao: String(r.situation ?? '') as Produto['situacao'],
    status: String(r.status ?? '') as Produto['status'],
  };
}

// --------------- Sincronização ---------------

let inFlight: Promise<void> | null = null;
let lastSyncAt = 0;

export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false;
  } catch {
    return true;
  }
}

async function applyOp(op: PendingOp): Promise<void> {
  if (op.kind === 'upsertLocal') {
    const { error } = await supabase.from('tb_location').upsert(toDbLocal(op.data));
    if (error) throw error;
  } else if (op.kind === 'deleteLocal') {
    const { error } = await supabase.from('tb_location').delete().eq('id', Number(op.id));
    if (error) throw error;
  } else if (op.kind === 'upsertProduto') {
    const { error } = await supabase.from('tb_products').upsert(toDbProduto(op.data));
    if (error) throw error;
  } else if (op.kind === 'deleteProduto') {
    const { error } = await supabase.from('tb_products').delete().eq('id', Number(op.id));
    if (error) throw error;
  } else if (op.kind === 'clearAll') {
    const prod = await supabase.from('tb_products').delete().neq('id', 0);
    if (prod.error) throw prod.error;
    const loc = await supabase.from('tb_location').delete().neq('id', 0);
    if (loc.error) throw loc.error;
  }
}

async function ensureMigration(): Promise<void> {
  if (await getFlag(MIGRATED_KEY)) return;
  const local = await readWorkbook();
  if (local.locais.length > 0 || local.produtos.length > 0) {
    const queue = await readQueue();
    for (const l of local.locais) queue.push({ kind: 'upsertLocal', data: l });
    for (const p of local.produtos) queue.push({ kind: 'upsertProduto', data: p });
    await writeQueue(queue);
  }
  await setFlag(MIGRATED_KEY);
}

async function doSync(): Promise<void> {
  if (!(await isOnline())) return;

  await ensureMigration();

  // Process queue one item at a time. Re-read from disk after each op
  // to avoid overwriting items that other async code appended while we
  // were busy with the (slow) network call in applyOp.
  while (true) {
    const queue = await readQueue();
    if (queue.length === 0) break;
    await applyOp(queue[0]);
    const current = await readQueue();
    current.shift();
    await writeQueue(current);
  }

  const [locaisRes, produtosRes] = await Promise.all([
    supabase.from('tb_location').select('*'),
    supabase.from('tb_products').select('*, tb_location(name)'),
  ]);
  if (locaisRes.error || produtosRes.error) return;

  // Re-check the queue right before overwriting the cache: if new ops were
  // enqueued while we were fetching (e.g. a mutation during the network call),
  // skip the overwrite so we don't hide un-synced local changes from the UI.
  // The next sync cycle will push them and then pull a consistent state.
  const pending = await readQueue();
  if (pending.length > 0) return;

  const fresh: WorkbookData = {
    locais: (locaisRes.data as DbLocal[]).map(fromDbLocal),
    produtos: (produtosRes.data as DbProdutoRow[]).map(fromDbProduto),
  };
  await writeWorkbook(fresh);
}

async function ensureSynced(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && Date.now() - lastSyncAt < 800) return;
  inFlight = (async () => {
    try {
      await doSync();
    } catch {
      // Sem rede ou falha temporária: mantém cache + fila.
    } finally {
      lastSyncAt = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function syncNow(): Promise<void> {
  return ensureSynced(true);
}

let wasConnected = true;
NetInfo.addEventListener((state) => {
  const connected = state.isConnected !== false;
  if (connected && !wasConnected) {
    void ensureSynced(true);
  }
  wasConnected = connected;
});

// --------------- Locais ---------------

export async function getLocais(): Promise<Local[]> {
  await ensureSynced();
  const data = await readWorkbook();
  return data.locais;
}

export async function saveLocais(locais: Local[]): Promise<void> {
  const data = await readWorkbook();
  data.locais = locais;
  await writeWorkbook(data);
  const queue = await readQueue();
  for (const l of locais) queue.push({ kind: 'upsertLocal', data: l });
  await writeQueue(queue);
  void ensureSynced(true);
}

export async function addLocal(local: Local): Promise<void> {
  const data = await readWorkbook();
  data.locais.push(local);
  await writeWorkbook(data);
  await enqueue({ kind: 'upsertLocal', data: local });
}

export async function updateLocal(updated: Local): Promise<void> {
  const data = await readWorkbook();
  const index = data.locais.findIndex((l) => l.id === updated.id);
  if (index >= 0) {
    const anterior = data.locais[index];
    data.locais[index] = updated;
    if (anterior.nome !== updated.nome) {
      data.produtos = data.produtos.map((p) =>
        p.localId === updated.id ? { ...p, localNome: updated.nome } : p
      );
    }
    await writeWorkbook(data);
    await enqueue({ kind: 'upsertLocal', data: updated });
  }
}

export async function deleteLocal(id: string): Promise<void> {
  const data = await readWorkbook();
  data.locais = data.locais.filter((l) => l.id !== id);
  await writeWorkbook(data);
  await enqueue({ kind: 'deleteLocal', id });
}

export async function getLocaisAtivos(): Promise<Local[]> {
  await ensureSynced();
  const data = await readWorkbook();
  return data.locais.filter((l) => l.ativo);
}

// --------------- Produtos ---------------

export async function getProdutos(): Promise<Produto[]> {
  await ensureSynced();
  const data = await readWorkbook();
  return data.produtos;
}

export async function saveProdutos(produtos: Produto[]): Promise<void> {
  const data = await readWorkbook();
  data.produtos = produtos;
  await writeWorkbook(data);
  const queue = await readQueue();
  for (const p of produtos) queue.push({ kind: 'upsertProduto', data: p });
  await writeQueue(queue);
  void ensureSynced(true);
}

export async function addProduto(produto: Produto): Promise<void> {
  const data = await readWorkbook();
  data.produtos.push(produto);
  await writeWorkbook(data);
  await enqueue({ kind: 'upsertProduto', data: produto });
}

export async function addProdutos(newProdutos: Produto[]): Promise<void> {
  const data = await readWorkbook();
  data.produtos.push(...newProdutos);
  await writeWorkbook(data);
  const queue = await readQueue();
  for (const p of newProdutos) queue.push({ kind: 'upsertProduto', data: p });
  await writeQueue(queue);
  void ensureSynced(true);
}

export async function importBatch(locais: Local[], produtos: Produto[]): Promise<void> {
  const data = await readWorkbook();
  for (const l of locais) {
    if (!data.locais.find((x) => x.id === l.id)) data.locais.push(l);
  }
  data.produtos.push(...produtos);
  await writeWorkbook(data);
  const queue = await readQueue();
  for (const l of locais) queue.push({ kind: 'upsertLocal', data: l });
  for (const p of produtos) queue.push({ kind: 'upsertProduto', data: p });
  await writeQueue(queue);
  void ensureSynced(true);
}

export async function updateProduto(updated: Produto): Promise<void> {
  const data = await readWorkbook();
  const index = data.produtos.findIndex((p) => p.id === updated.id);
  if (index >= 0) {
    data.produtos[index] = updated;
    await writeWorkbook(data);
    await enqueue({ kind: 'upsertProduto', data: updated });
  }
}

export async function deleteProduto(id: string): Promise<void> {
  const data = await readWorkbook();
  data.produtos = data.produtos.filter((p) => p.id !== id);
  await writeWorkbook(data);
  await enqueue({ kind: 'deleteProduto', id });
}

export async function clearAllData(): Promise<void> {
  await writeWorkbook({ locais: [], produtos: [] });
  await writeQueue([{ kind: 'clearAll' }]);
  void ensureSynced(true);
}

export async function exportWorkbookBase64(): Promise<string> {
  const data = await readWorkbook();
  const wb = XLSX.utils.book_new();
  const locaisSheet = XLSX.utils.json_to_sheet(
    data.locais.map((l) => ({ id: l.id, nome: l.nome, ativo: l.ativo }))
  );
  XLSX.utils.book_append_sheet(wb, locaisSheet, 'Locais');
  const produtosSheet = XLSX.utils.json_to_sheet(
    data.produtos.map((p) => ({
      id: p.id,
      localId: p.localId,
      localNome: p.localNome,
      quantidade: p.quantidade,
      nome: p.nome,
      validade: p.validade,
      situacao: p.situacao,
      status: p.status,
    }))
  );
  XLSX.utils.book_append_sheet(wb, produtosSheet, 'Produtos');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
