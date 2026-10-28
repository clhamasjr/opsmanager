/* ═══ BRB (InConta) → arquivo do WorkBank — 28/10/2026 ═══
   Carlos: "atualmente eu utilizo esse robo do BRB inconta para exportação de proposta ... é possivel ser feito todo esse
   processo dentro do OPS?". O robô do PC (C:\konsig-sync\brb.mjs) faz o que o main.py dele fazia — entra no InConta, lê as
   propostas cadastradas nos últimos 2 meses (propostas/index) e o detalhe de cada uma (propostas/acompanharProposta) — e
   grava em konsig_config.brb_esteira ({proposta_id: {...}}). Daqui sai a linha do Work. Regras conferidas contra os
   arquivos dele ("output_json 1.csv" = saída do main.py, "output_json 2.csv" = ajustado, "Arquivo Padrao WORKBANK (39)"):
   127 de 127 linhas idênticas.
   - banco 7056 "BRB - INCONTA"; proposta = contrato = proposta_id (número);
   - tipo: CONTRATO NOVO → NOVO; PORTABILIDADE; REFINANCIAMENTO → PORTAB/REFIN só quando a tabela é "REFIN DE PORT"
     (traz o contrato para o InConta E refinancia), senão REFINANCIAMENTO — "REFIN PORT" e "VIRADA DE FOLHA REF DE PORT"
     são refinanciamento PÓS-portabilidade, de contrato que já está no InConta (confirmado pelo Carlos em 28/10/2026);
   - produto = tabela como vem; situação = status_atual como vem (Pago, Cancelada, Simulacao…);
   - empréstimo = criação da AF (created_at); crédito = status_data só quando Pago;
   - usuário = agente (LHAMAS 11, LHAMAS 77…); CPF e nome como vêm; nascimento 01/01/1990;
   - bruto = valor_ccb (se não for 0) senão valor_principal — o mesmo do main.py; parcela, líquido, prazo e taxa mensal. */
export const BRB_NUM=7056,BRB_NOM='BRB - INCONTA'
const n=v=>{if(v==null||v==='')return null;const x=Number(v);return isNaN(x)?null:x}
// "2026-10-27T…" → data do dia (o main.py pegava os 10 primeiros caracteres)
export const brbDia=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[1]+'-'+m[2]+'-'+m[3]:''}
const dt=s=>{const d=brbDia(s);return d?new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10),12,0,0):null}
export function brbTipo(op,tabela){
  const o=String(op||'').trim().toUpperCase()
  if(o==='CONTRATO NOVO'||o==='NOVO')return 'NOVO'
  if(o==='REFINANCIAMENTO')return /REFIN\s+DE\s+PORT/i.test(String(tabela||''))?'PORTAB/REFIN':'REFINANCIAMENTO'
  return o||null
}
// main.py: valor_ccb if valor_ccb != 0 else valor_principal — no Python só o NÚMERO 0 é "igual a 0": se a API mandar o texto
// "0.00", ele fica (bruto 0, como nas canceladas/simulações do arquivo dele). Vazio cai no principal.
export const brbBruto=x=>{const c=x.valor_ccb;return c!=null&&c!==''&&c!==0?n(c):n(x.valor_principal)}
export const brbPago=x=>/^pago$/i.test(String(x.status_atual||'').trim())
export function brbLinha(x,hdr,hoje){
  const o={};hdr.forEach(h=>o[h]=null)
  o.NUM_BANCO=BRB_NUM;o.NOM_BANCO=BRB_NOM
  o.NUM_PROPOSTA=n(x.proposta_id);o.NUM_CONTRATO=o.NUM_PROPOSTA
  o.DSC_TIPO_PROPOSTA_EMPRESTIMO=brbTipo(x.operacao,x.tabela)
  o.DSC_PRODUTO=x.tabela??null
  o.DAT_CTR_INCLUSAO=hoje
  o.DSC_SITUACAO_EMPRESTIMO=x.status_atual??null
  o.DAT_EMPRESTIMO=dt(x.created_at)
  o.NIC_CTR_USUARIO=x.agente??null
  o.COD_CPF_CLIENTE=x.cpf??null;o.NOM_CLIENTE=x.nome??null
  o.DAT_NASCIMENTO=new Date(1990,0,1,12,0,0)
  o.QTD_PARCELA=n(x.prazo)
  o.VAL_PRESTACAO=n(x.valor_parcelas);o.VAL_BRUTO=brbBruto(x);o.VAL_LIQUIDO=n(x.valor_liquido)
  o.DAT_CREDITO=brbPago(x)?dt(x.status_data):null
  o.PCL_TAXA_EMPRESTIMO=n(x.taxa_juros_mensal)
  o.DSC_TIPO_FORMULARIO_EMPRESTIMO='DIGITAL'
  return o
}
// situação resumida para os filtros da tela (PEN/AND/INT/REP)
export function brbSit(x){
  const s=String(x.status_atual||'').trim().toLowerCase()
  if(s==='pago')return 'INT'
  if(/cancel|reprov|recus|expirad|negad/.test(s))return 'REP'
  if(/pendent/.test(s))return 'PEN'
  return 'AND'
}
