/* ═══ Crefisa pela planilha do BANCO → arquivo do WorkBank — 28/10/2026 ═══
   Carlos: "montar um outro relatorio igual é feito no CREFISACP, HAPPY e ICRED, porém da planilha que eu exporto de dentro
   do banco crefisa". É o "Contratos Esteira Analise" do sistema da Crefisa, uma planilha por acesso (PRISCILA 1287.36701754821
   e EMILLY 1287.54586600802 — os dois usuários que o cartão da promotora deixa de fora, PROMO_FORA, porque o Carlos sobe esses
   contratos direto do banco). As duas planilhas viram UM arquivo do Work. Regras conferidas contra os arquivos dele ("Como vem
   do banco", "Como tem que ficar" e "(2)" — um de cada acesso — e "workbank inclusao"): 184 de 184 linhas idênticas.
   - banco 789 CREFISACP; proposta = contrato = NUMERO_CONTRATO, senão NUMERO_ADE (61 de 136 vêm só com a ADE), em texto;
   - tipo: "001 - NOVO CONTRATO" → NOVO, "027 - REFINANCIAMENTO" → REFINANCIAMENTO;
   - produto = CONVENIO-TABELA ("Baixa Renda-…", "INSS-…"); refin com a tabela genérica "EMPRESTIMO PESSOAL DESC EM CONTA"
     vira "convênio-REFINANCIAMENTO" (a mesma regra da Crefisa Baixa Renda);
   - situação = STATUS_PROPOSTA como vem (ANDAMENTO / PAGO / CANCELADO);
   - empréstimo = DATA_DIGITACAO_BANCO e crédito = DATA_ULTIMO_SUB_STATUS_BANCO só quando PAGO, as duas em TEXTO dd/mm/aaaa
     (é como vão no arquivo dele);
   - usuário = LOGIN_SUB_USUARIO; CPF e cliente como vêm; nascimento 01/01/1990; prazo, parcela, bruto e líquido; DIGITAL.
   A planilha já "arrumada" à mão (CONVENIO "Baixa Renda-", tipo "NOVO") também serve: dá o mesmo arquivo. */
export const CB_ABA='Contratos Esteira Analise'
export const CB_OBRIG=['NUMERO_ADE','NUMERO_CONTRATO','CPF_CLIENTE','NOME_CLIENTE','DATA_DIGITACAO_BANCO','VALOR_BRUTO','VALOR_LIQUIDO','VALOR_PARCELA','PRAZO','BANCO','CONVENIO','TABELA','TIPO_CONTRATO','STATUS_PROPOSTA','DATA_ULTIMO_SUB_STATUS_BANCO','LOGIN_SUB_USUARIO']
const pad=n=>String(n).padStart(2,'0')
const txt=v=>v==null?'':String(v).trim()
// lê a planilha (o XLSX vem de fora para o mesmo código rodar no navegador e no teste). Datas ficam como vieram: texto, ou o
// número de série se o arquivo passou pelo Excel (cbDataTxt converte sem fuso).
export function cbLerPlanilha(XLSX,buf){
  // só planilha do Excel de verdade (.xlsx começa com "PK", .xls antigo com D0 CF 11 E0): um .xls que é HTML ou um .csv
  // salvo no Excel em português passa pelo leitor com "585,30" virando 58530 e as datas trocadas (revisão de 28/10)
  const b=buf||[],xlsx=b[0]===0x50&&b[1]===0x4B,xls=b[0]===0xD0&&b[1]===0xCF&&b[2]===0x11&&b[3]===0xE0
  if(!xlsx&&!xls)throw new Error('não é uma planilha do Excel (.xlsx) — exporte de novo no banco e escolha o arquivo sem abrir')
  const wb=XLSX.read(buf,{type:'array',cellDates:false})
  const abas=[CB_ABA,...wb.SheetNames.filter(n=>n!==CB_ABA)].filter(n=>wb.Sheets[n])
  let melhor=null
  for(const aba of abas){
    const a=XLSX.utils.sheet_to_json(wb.Sheets[aba],{header:1,raw:true,defval:null})
    const cab=(a[0]||[]).map(h=>txt(h))
    const falta=CB_OBRIG.filter(h=>!cab.includes(h))
    if(!falta.length){
      const rows=a.slice(1).filter(l=>l.some(v=>v!=null&&String(v).trim()!=='')).map(l=>{const o={};cab.forEach((h,i)=>{if(h&&!(h in o))o[h]=l[i]??null});return o})
      return{aba,rows}
    }
    if(!melhor||falta.length<melhor.falta.length)melhor={aba,falta}
  }
  throw new Error('não parece a planilha "'+CB_ABA+'" do banco — faltam as colunas: '+(melhor?melhor.falta.join(', '):CB_OBRIG.join(', ')))
}
export const cbNotacaoCientifica=v=>/^\d+([.,]\d+)?E[+-]?\d+$/i.test(txt(v))
// data em texto dd/mm/aaaa (o relatório traz assim); número de série do Excel (dias desde 30/12/1899) → data sem fuso
export function cbDataTxt(v){
  if(v==null||v==='')return null
  if(typeof v==='number'){if(!(v>0))return null;const d=new Date(Math.round((Math.floor(v)-25569)*86400000));return pad(d.getUTCDate())+'/'+pad(d.getUTCMonth()+1)+'/'+d.getUTCFullYear()}
  const s=txt(v);let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return pad(m[1])+'/'+pad(m[2])+'/'+m[3]
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:null
}
export const cbDataOrd=s=>s?s.split('/').reverse().join('-'):''   // dd/mm/aaaa → aaaa-mm-dd (para ordenar)
const num=v=>{if(typeof v==='number')return v;let s=txt(v);if(!s||s==='-')return null;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return isNaN(n)?null:n}
export function cbTipo(t){const s=txt(t).replace(/^\d+\s*-\s*/,'').toUpperCase();return /REFIN/.test(s)?'REFINANCIAMENTO':/NOVO/.test(s)?'NOVO':s}
export const cbTipoConhecido=t=>t==='NOVO'||t==='REFINANCIAMENTO'
export const cbProposta=r=>{const c=r.NUMERO_CONTRATO,a=r.NUMERO_ADE;return txt(c)||txt(a)}
export const cbEhCrefisa=r=>/^CREFISA/i.test(txt(r.BANCO))
export const cbAcesso=r=>txt(r.SUB_USUARIO).replace(/\s*\(\s*sub-?usu.{0,3}rio[^)]*\)\s*$/i,'').trim()
export function cbLinha(r,hdr,hoje){
  const o={};hdr.forEach(h=>o[h]=null)
  o.NUM_BANCO=789;o.NOM_BANCO='CREFISACP'
  o.NUM_PROPOSTA=cbProposta(r)||null;o.NUM_CONTRATO=o.NUM_PROPOSTA
  const tp=cbTipo(r.TIPO_CONTRATO),tab=txt(r.TABELA),conv=txt(r.CONVENIO).replace(/\s*-\s*$/,'')
  o.DSC_TIPO_PROPOSTA_EMPRESTIMO=tp||null
  o.DSC_PRODUTO=conv+'-'+((tp==='REFINANCIAMENTO'&&/^EMPRESTIMO PESSOAL DESC EM CONTA$/i.test(tab))?'REFINANCIAMENTO':tab)
  o.DAT_CTR_INCLUSAO=hoje
  const sit=txt(r.STATUS_PROPOSTA);o.DSC_SITUACAO_EMPRESTIMO=sit||null
  o.DAT_EMPRESTIMO=cbDataTxt(r.DATA_DIGITACAO_BANCO)
  o.NIC_CTR_USUARIO=txt(r.LOGIN_SUB_USUARIO)||null
  o.COD_CPF_CLIENTE=r.CPF_CLIENTE??null;o.NOM_CLIENTE=r.NOME_CLIENTE??null
  o.DAT_NASCIMENTO=new Date(1990,0,1,12,0,0)
  o.QTD_PARCELA=num(r.PRAZO)
  o.VAL_PRESTACAO=num(r.VALOR_PARCELA);o.VAL_BRUTO=num(r.VALOR_BRUTO);o.VAL_LIQUIDO=num(r.VALOR_LIQUIDO)
  o.DAT_CREDITO=/^PAGO$/i.test(sit)?cbDataTxt(r.DATA_ULTIMO_SUB_STATUS_BANCO):null
  o.DSC_TIPO_FORMULARIO_EMPRESTIMO='DIGITAL'
  return o
}
// junta as planilhas: só CREFISA, sem proposta fica fora. Proposta repetida (a mesma exportada de novo mais tarde, com outro
// nome: o banco põe data e hora no nome) vale a da planilha BAIXADA POR ÚLTIMO (a.quando = data do arquivo; empate = a
// escolhida depois) — antes valia a 1ª e um contrato já PAGO voltava a sair ANDAMENTO (revisão de 28/10). A linha fica na
// posição em que a proposta apareceu primeiro.
export function cbMontar(arquivos,hdr,hoje){
  const pos=new Map(),esc=[],outros={},tiposNovos={},acArq={};let semProposta=0,repetidas=0
  arquivos.forEach((a,ia)=>{const q=Number(a.quando)||0
    for(const r of a.rows){
      if(!cbEhCrefisa(r)){const b=txt(r.BANCO)||'?';outros[b]=(outros[b]||0)+1;continue}
      const p=cbProposta(r);if(!p){semProposta++;continue}
      const ac=(cbAcesso(r)||'?')+' · '+(txt(r.LOGIN_SUB_USUARIO)||'sem login');(acArq[ac]=acArq[ac]||new Set()).add(ia)
      if(pos.has(p)){repetidas++;const x=esc[pos.get(p)];if(q>x.q||(q===x.q&&ia>x.ia))esc[pos.get(p)]={r,q,ia,ac};continue}
      pos.set(p,esc.length);esc.push({r,q,ia,ac})
    }})
  const linhas=[],porAcesso={}
  for(const x of esc){const o=cbLinha(x.r,hdr,hoje);linhas.push(o);porAcesso[x.ac]=(porAcesso[x.ac]||0)+1
    if(!cbTipoConhecido(o.DSC_TIPO_PROPOSTA_EMPRESTIMO)){const t=o.DSC_TIPO_PROPOSTA_EMPRESTIMO||'(vazio)';tiposNovos[t]=(tiposNovos[t]||0)+1}}
  const porSit={};linhas.forEach(o=>{const s=o.DSC_SITUACAO_EMPRESTIMO||'?';porSit[s]=(porSit[s]||0)+1})
  const datas=linhas.map(o=>cbDataOrd(o.DAT_EMPRESTIMO)).filter(Boolean).sort()
  const dt=s=>s?s.split('-').reverse().join('/'):null
  // o mesmo acesso em mais de uma planilha (a tela avisa: vale a baixada por último)
  const acessoEmVarias=Object.entries(acArq).filter(([,s])=>s.size>1).map(([k,s])=>({acesso:k,arquivos:[...s].map(i=>arquivos[i].nome)}))
  return{linhas,outros,porAcesso,porSit,tiposNovos,semProposta,repetidas,acessoEmVarias,
    pagoSemCredito:linhas.filter(o=>/^PAGO$/i.test(o.DSC_SITUACAO_EMPRESTIMO||'')&&!o.DAT_CREDITO).length,
    semUsuario:linhas.filter(o=>!o.NIC_CTR_USUARIO).length,semData:linhas.filter(o=>!o.DAT_EMPRESTIMO).length,
    estragadas:linhas.filter(o=>cbNotacaoCientifica(o.NUM_PROPOSTA)).length,
    total:linhas.reduce((s,o)=>s+(o.VAL_BRUTO||0),0),de:dt(datas[0]),ate:dt(datas[datas.length-1])}
}
