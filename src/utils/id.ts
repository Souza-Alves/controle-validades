let lastId = 0;

export function generateId(): string {
  // IDs numéricos monotônicos compatíveis com int8 do Supabase.
  // Base é o timestamp em ms * 1000; se vários IDs forem gerados no mesmo
  // milissegundo (ex.: import em massa de 91+ itens num for sem await),
  // apenas incrementamos sobre o último ID. Isso garante unicidade
  // independente de quantos sejam gerados por ms, sem o problema de
  // estouro do contador (counter >= 1000 colidiria com o ms seguinte).
  let id = Date.now() * 1000;
  if (id <= lastId) id = lastId + 1;
  lastId = id;
  return String(id);
}
