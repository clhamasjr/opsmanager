/* WorkBank da QualiBanking pela API (tabela portabilidades, que a Edge Function sync-qualibanking atualiza), sem subir
   o relatório — 21/10/2026, Carlos: "No quali como já possui a API é possivel ser feito a exportação da forma que é
   feito na credfranco?". Monta a linha com os MESMOS nomes de coluna do relatório do portal e passa pelo quLinha do
   App.jsx (o mesmo do cartão que lê o .csv, aprovado pelo Carlos em 09/10; o arquivo de teste da API foi aprovado em
   21/10: "o arquivo está correto"). Entra na tela como um banco a mais, com o período escolhido na tela, igual à
   CredFranco (sem corte fixo de 2 meses — pedido do Carlos). A API só tem portabilidade (Portabilidade +
   Refinanciamento e Refinanciamento da Portabilidade); "Novo" (~1,5%) continua vindo só pelo relatório, e em dia de
   muito movimento a sincronização da API perde alguns contratos (devolve no máximo 20 por dia em cada consulta).
   ⚠️ Os valores ATUAIS ficam no topo do raw_data. As colunas rate/term/installment_value/net_value/rule_* da tabela
   guardam a proposta ORIGINAL (antes do recálculo da portabilidade), o status_name pode ter sido trocado aqui por
   "Proposta Expirada" (limpeza de pendência velha) e o borrower_name às vezes difere — conferido com o relatório de
   14/10/2026, contrato a contrato. */
export const QU_API_COLS='contract_number,operation_type,proposal_date,borrower_identity,borrower_name,status_name,term,loan_value,installment_value,net_value,endorsement_date,rate,rule_name,'+
  'r_rate:raw_data->>rate,r_mrate:raw_data->>monthlyRate,r_term:raw_data->>term,r_parcela:raw_data->>installmentValue,r_liq:raw_data->>netValue,'+
  'r_base:raw_data->>baseValue,r_tabela:raw_data->rule->>name,r_status:raw_data->status->>name,r_averb:raw_data->>endorsementDate,r_nome:raw_data->borrower->>name,login:raw_data->>accessId'
const dia=v=>{const s=String(v||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):''}
const tem=v=>v!=null&&v!==''&&v!=='null'
// a taxa do topo vem arredondada em 3 casas (1,475); quando a "monthlyRate" é a mesma taxa com mais casas (1,4747),
// usa ela — senão o arredondamento para 2 casas sai diferente do relatório (1,48 × 1,47)
function taxa(a){
  const r=Number(a.r_rate),m=Number(a.r_mrate)
  if(tem(a.r_rate)&&isFinite(r)){if(tem(a.r_mrate)&&isFinite(m)&&Math.abs(Math.round(m*1000)/1000-r)<1e-9)return m;return r}
  return tem(a.rate)?Number(a.rate):null
}
export function quApiParaRelatorio(a){
  const tx=taxa(a)
  return{
    'Número do Contrato':a.contract_number||'',
    'Tipo de Operação':a.operation_type||'',
    'Nome da Tabela':tem(a.r_tabela)?a.r_tabela:(a.rule_name||''),
    'Status':tem(a.r_status)?a.r_status:(a.status_name||''),
    'Data da Proposta':dia(a.proposal_date),
    'CPF':String(a.borrower_identity||''),
    'Nome':tem(a.r_nome)?a.r_nome:(a.borrower_name||''),
    'Prazo':tem(a.r_term)?a.r_term:(a.term??''),
    'Valor Base':tem(a.r_base)?a.r_base:(a.loan_value??''),
    'Valor da Parcela':tem(a.r_parcela)?a.r_parcela:(a.installment_value??''),
    'Valor Líquido ao Cliente':tem(a.r_liq)?a.r_liq:(a.net_value??''),
    'Data de Averbação':tem(a.r_averb)?dia(a.r_averb):dia(a.endorsement_date),
    'Taxa':tx==null?'':tx/100,   // o relatório traz a taxa em fração (0,0185); a API em % (1,85)
    'Login':tem(a.login)?a.login:''
  }
}
