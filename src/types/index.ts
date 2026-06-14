export interface Local {
  id: string;
  nome: string;
  ativo: boolean;
}

export type SituacaoType = '' | 'Vendido' | 'Vencido';
export type StatusType = '' | 'Baixado' | 'Pendente';

export interface Produto {
  id: string;
  localId: string;
  localNome: string;
  quantidade: number;
  nome: string;
  validade: string; // DD/MM/AAAA
  situacao: SituacaoType;
  status: StatusType;
}
