# Controle de Validades

App mobile (Android e iOS) para controle de validades de alimentos, desenvolvido com React Native e Expo.

## Funcionalidades

### 1. Cadastro de Locais
- Campo de texto para nome do local
- Status ativo/inativo com switch
- Editar e excluir locais

### 2. Cadastro de Produtos
- Combo de localizacao (somente locais ativos)
- Campo numerico para quantidade
- Campo de texto para nome do produto
- Campo de validade com formato DD/MM/AAAA
- Combo para situacao (Vendido/Vencido)
- Combo para status (Baixado/Pendente)

### 3. Importacao via Excel
- Upload de planilha Excel (.xlsx, .xls, .csv)
- Colunas esperadas: predio, quantidade, produto, vencimento
- Pre-visualizacao antes de confirmar importacao
- Criacao automatica de locais inexistentes

### 4. Envio por Email
- Envia por email os itens proximos ao vencimento
- Ordenados por localizacao
- Periodo: data atual ate 4 dias a frente

### 5. Tela Principal
- Busca por local ou periodo de vencimento
- Filtro por quantidade de dias
- Lista em formato de tabela com colunas
- Ordenacao por Local e Data de vencimento
- Selecao de Situacao (Vendido/Vencido) na propria lista
- Status (Baixado/Pendente) disponivel quando situacao e Vencido

## Tecnologias

- React Native com Expo (SDK 54)
- TypeScript
- Expo Router (navegacao por tabs)
- AsyncStorage (armazenamento local)
- expo-document-picker + xlsx (importacao Excel)
- expo-mail-composer (envio de email)

## Como Executar

```bash
npm install
npx expo start
```

Depois, escaneie o QR code com o app Expo Go no celular ou use um ewmulador.

## Estrutura do Projeto

```
app/
  _layout.tsx         # Layout com navegacao por tabs
  index.tsx           # Tela principal (lista de produtos)
  locais.tsx          # Cadastro de locais
  cadastro-produto.tsx # Cadastro de produtos
  importar.tsx        # Importacao via Excel
src/
  types/index.ts      # Tipos TypeScript
  storage/index.ts    # Funcoes de armazenamento (AsyncStorage)
  utils/date.ts       # Utilitarios de data
  utils/id.ts         # Geracao de IDs
```
