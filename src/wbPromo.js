/* ═══ Relatório de produção da promotora (CREFISA CP, HAPPY, ICRED) → arquivo do WorkBank — 22/10/2026 ═══
   Ainda sem API: o Carlos baixa o relatório (.csv) e sobe aqui, como faz com a Quali e a Finanto. Regras conferidas linha a
   linha contra os 3 arquivos dele ("como vem da promotora.csv", "como presica ficar.csv", "Arquivo Padrao WORKBANK (35)"):
   - banco: CREFISA → 789 CREFISACP, HAPPY → 159, ICRED → 1526 (Carlos); outro banco sem código não gera;
   - proposta/contrato = COD. BANCO (número; o ICRED tem "CTC0006285326" e "0402032283/CAR", que vão como texto);
   - tipo: Novo → Novo, Refin → REFINANCIAMENTO, "Refin / Portabilidade" → PORTAB/REFIN; produto, situação, CPF e cliente
     como vêm; empréstimo = DATA; crédito = DATA AVERBACAO ("-" = vazio); nascimento 01/01/1990; DIGITAL;
   - usuário (NIC_CTR_USUARIO) = o nome antes de "(SUB-USUÁRIO PARCEIRO) 1287.xxx". O sistema da promotora estraga acento e
     pontuação ("ESTA?FANE", "JANA?NA", "PE€ANHA") e o Work só acha o usuário com o nome exato — "se tiver uma . diferente
     ele já deixa todas as propostas sem usuário". Ordem: (1) o nome salvo para aquela grafia (konsig_config
     promo_wb_usuarios, começa com os da planilha do Carlos); (2) nome sem lixo vai como vem; (3) "pela lógica": a letra
     estragada vira a que mais aparece nos nomes de clientes da base ("pode colocar PECANHA que eu só ajusto a letra no
     sistema") e a tela mostra para conferir. */
export const PROMO_OBRIG=['COD. BANCO','CPF','CLIENTE','COD DIGITADOR NO BANCO','VALOR BRUTO','VALOR LIQUIDO','VALOR PARCELA','BANCO','TIPO PRODUTO','PRODUTO','QTDE PARCELAS','STATUS','DATA AVERBACAO','DATA']
export const PROMO_BANCOS={CREFISA:{nom:'CREFISACP',padrao:789},CREFISACP:{nom:'CREFISACP',padrao:789},HAPPY:{nom:'HAPPY',padrao:159},ICRED:{nom:'ICRED',padrao:1526}}
export const promoBanco=b=>{const k=String(b||'').trim().toUpperCase();return PROMO_BANCOS[k]||{nom:k,padrao:null}}
// o portal da promotora também tem PAN, FACTA, C6… — esses saem pela tela da CredFranco; este cartão é só os 3 da lista
export const promoBancoAceito=b=>!!PROMO_BANCOS[String(b||'').trim().toUpperCase()]
// .csv aberto e salvo no Excel: o número da proposta vira "5,0796E+11" e os dígitos se perdem — não dá para consertar
export const promoNotacaoCientifica=v=>/^\d+([.,]\d+)?E[+-]?\d+$/i.test(String(v??'').trim())
const PROMO_TIPO={'novo':'Novo','refin':'REFINANCIAMENTO','refin / portabilidade':'PORTAB/REFIN','portabilidade':'Portabilidade','cartão':'Cartão','cartao':'Cartão'}

// .csv do portal: ANSI (windows-1252), ";", e uma linha em branco antes do cabeçalho. Aceita UTF-8 e "," se salvarem de novo.
export function promoLerCsv(buf){
  let t;try{t=new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch{t=new TextDecoder('windows-1252').decode(buf)}
  t=t.replace(/^\uFEFF/,'')
  const ls=t.split(/\r?\n/),i=ls.findIndex(l=>/^\s*"?COD"?\s*[;,]/i.test(l))
  if(i<0)return{cab:[],rows:[]}
  const sep=ls[i].split(';').length>=ls[i].split(',').length?';':','
  const corpo=ls.slice(i).join('\n'),linhas=[];let campo='',linha=[],q=false
  for(let k=0;k<corpo.length;k++){const c=corpo[k]
    if(q){if(c==='"'){if(corpo[k+1]==='"'){campo+='"';k++}else q=false}else campo+=c;continue}
    if(c==='"'){q=true;continue}
    if(c===sep){linha.push(campo);campo='';continue}
    if(c==='\n'){linha.push(campo);linhas.push(linha);linha=[];campo='';continue}
    campo+=c}
  if(campo||linha.length){linha.push(campo);linhas.push(linha)}
  const cab=(linhas[0]||[]).map(h=>String(h).trim())
  const rows=linhas.slice(1).filter(l=>l.some(v=>String(v).trim())).map(l=>{const o={};cab.forEach((h,j)=>{if(h&&!(h in o))o[h]=l[j]??''});return o})
  return{cab,rows}
}

// ── usuário ──────────────────────────────────────────────────────────────────
// "NOME (SUB-USUÁRIO PARCEIRO) 1287.08018893918", "NOME SUB-USURIO PARCEIRO", "(SUB-USUÁRIO FUNCIONÁRIO)" → NOME.
// O "Á" vem estragado de 4 jeitos (nada, \u00a0, ÿ, ˜) — por isso o ".{0,3}" (e não \S: o \u00a0 conta como espaço).
// Qualquer tipo de sub-usuário ("PARCEIRO", "FUNCIONÁRIO", e o que vier com acessos novos) sai do nome.
export const promoNomeUsuario=s=>String(s||'').replace(/\s*\(?\s*SUB-USU.{0,3}RIO\b[^()]*\)?\s*[\d.]*\s*$/i,'').replace(/\s+/g,' ').trim()
const LIMPO=/^[A-Za-z0-9 .'\/-]*$/
export const promoTemLixo=n=>!LIMPO.test(n)
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
// palavra estragada → padrões de busca (LIKE: "_" = 1 letra). Cada trecho de lixo vira 1 ou 2 letras; o "A" logo antes do
// trecho pode ser o "Ã" do lixo (UTF-8 lido como ANSI: "É" → "Ã‰" → "A?") ou uma letra de verdade (TENA?RIO → TENORIO).
export function promoPadroes(w){
  const out=new Set(),runs=[...w.matchAll(/[^A-Za-z0-9]+/g)]
  const gera=(i,acc,pos)=>{
    if(i===runs.length){out.add(acc+w.slice(pos));return}
    const r=runs[i],ini=r.index,fim=ini+r[0].length,antes=w.slice(pos,ini)
    gera(i+1,acc+antes+'_',fim)
    if(r[0].length>1)gera(i+1,acc+antes+'__',fim)
    if(r[0][0]==='?'&&/A$/i.test(antes)){gera(i+1,acc+antes.slice(0,-1)+'_',fim);gera(i+1,acc+antes,fim)}
  }
  gera(0,'',0);return[...out].filter(p=>p.replace(/_/g,'').length>=2)
}
// nomes da planilha do Carlos (22/10/2026, "como presica ficar.csv"): grafia que vem da promotora → nome como está no
// sistema dele. Três não batem com a lógica (TENARIO, CLAUDINAIA, PE€ANHA) e por isso precisam ficar salvos.
export const PROMO_SEMENTE={
  "ESTA?FANE SALETE SIQUEIRA ROCHA":"ESTEFANE SALETE SIQUEIRA ROCHA",
  "VITORIA JANA\u00d6NA PEREIRA NUNES":"VITORIA JANAINA PEREIRA NUNES",
  "DANIELA TENA?RIO DA SILVA":"DANIELA TENARIO DA SILVA",
  "VITORIA JANA\u2122NA PEREIRA NUNES":"VITORIA JANAINA PEREIRA NUNES",
  "CLAUDINA?IA SALES DE ANCHIETA":"CLAUDINAIA SALES DE ANCHIETA",
  "EST\u00c7?FANE SALETE SIQUEIRA ROCHA":"ESTEFANE SALETE SIQUEIRA ROCHA",
  "ANTONIA TACILA DA SILVA ALEM\u00c7?O":"ANTONIA TACILA DA SILVA ALEMAO",
  "MATEUS DA SILVA PE\u20acANHA LOPES":"MATEUS DA SILVA PE\u20acANHA LOPES"
}
// buscar(padrão) → lista de nomes de clientes (digitacoes.cliente) que contêm o padrão
export async function promoCorrigirNome(nome,buscar,cache=new Map()){
  const out=[]
  for(const w of nome.split(' ')){
    if(LIMPO.test(w)){out.push(w);continue}
    const tally={}
    for(const p of promoPadroes(w)){
      if(!cache.has(p)){
        const re=new RegExp('^'+fold(p).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/_/g,'.')+'$'),m={}
        let lista=[];try{lista=await buscar(p)}catch{}
        for(const x of lista||[])for(const t of fold(x).split(/\s+/))if(re.test(t))m[t]=(m[t]||0)+1
        cache.set(p,m)}
      for(const[t,n]of Object.entries(cache.get(p)))tally[t]=Math.max(tally[t]||0,n)
    }
    const best=Object.entries(tally).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]
    out.push(best&&best[1]>=2?best[0]:fold(w).replace(/[^A-Z0-9.'\/-]/g,''))
  }
  return out.join(' ').replace(/\s+/g,' ').trim()
}

// ── linha do WorkBank ────────────────────────────────────────────────────────
const num=v=>{let s=String(v??'').trim();if(!s||s==='-')return null;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');const n=Number(s);return isNaN(n)?null:n}
export const promoData=v=>{const s=String(v||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3],12,0,0)
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?new Date(+m[3],+m[2]-1,+m[1],12,0,0):null}
const proposta=v=>{const s=String(v??'').trim();return /^[1-9]\d*$/.test(s)?Number(s):(s||null)}
// taxa a.m. pelo nome da tabela (22/10/2026, Carlos: "inserir a taxa também por favor nas tabelas que possuem taxa, exemplo o
// happy e icred"): "TAXA 1,85 (ACIMA DE 1.000,00)" / "TX 1,80" → ela; faixa "TAXA 2,89 A 4,98" / "TX 1,84 A 1,85" → a MENOR
// (a regra dele para banco que não é C6); sem taxa (Crefisa, "TEMPORARIA") = vazio. A faixa de VALOR entre parênteses
// "(DE 1.000,00 A 20.000,00)" não conta: a taxa só vale colada no "TAXA"/"TX". Corta em 2 casas, sem arredondar.
const txNum=x=>Number(String(x).replace(',','.'))
export function promoTaxa(produto){
  const t=String(produto||''),fx=t.match(/\b(?:TAXA|TX)\.?\s*(\d{1,2},\d{1,3})\s*%?\s*A\s*(\d{1,2},\d{1,3})(?![\d.,])/i)
  const v=fx?Math.min(txNum(fx[1]),txNum(fx[2])):(m=>m?txNum(m[1]):null)(t.match(/\b(?:TAXA|TX)\.?\s*(\d{1,2},\d{1,3})(?![\d.,])/i))
  return v==null||!(v>0)?null:Math.trunc(Math.round(v*1e6)/1e4)/100
}
// 22/10/2026, Carlos: "sempre exclua do crefisacp ... esses dois usuario" — digitam manualmente na empresa e o Carlos sobe
// esses contratos direto do banco, quando pagam
export const PROMO_FORA={CREFISACP:['PRISCILA KELI CARVALHO LAZINI LEAO','EMILLY YORRANA DA SILVA']}
export const promoChaveNome=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim()
export const promoFora=o=>(PROMO_FORA[o.NOM_BANCO]||[]).some(n=>promoChaveNome(n)===promoChaveNome(o.NIC_CTR_USUARIO))
export function promoLinha(r,hdr,hoje,codigos,usuario){
  const o={};hdr.forEach(h=>o[h]=null)
  const b=promoBanco(r['BANCO']),cod=Number((codigos||{})[b.nom]??b.padrao)
  o.NUM_BANCO=cod>0?cod:null;o.NOM_BANCO=b.nom
  o.NUM_PROPOSTA=proposta(r['COD. BANCO']);o.NUM_CONTRATO=o.NUM_PROPOSTA
  const tp=String(r['TIPO PRODUTO']||'').trim();o.DSC_TIPO_PROPOSTA_EMPRESTIMO=PROMO_TIPO[tp.toLowerCase()]||tp||null
  o.DSC_PRODUTO=r['PRODUTO']??null
  o.DAT_CTR_INCLUSAO=hoje
  o.DSC_SITUACAO_EMPRESTIMO=r['STATUS']??null
  o.DAT_EMPRESTIMO=promoData(r['DATA'])
  o.NIC_CTR_USUARIO=usuario||null
  o.COD_CPF_CLIENTE=r['CPF']??null;o.NOM_CLIENTE=r['CLIENTE']??null
  o.DAT_NASCIMENTO=new Date(1990,0,1,12,0,0)
  o.QTD_PARCELA=num(r['QTDE PARCELAS'])
  o.VAL_PRESTACAO=num(r['VALOR PARCELA']);o.VAL_BRUTO=num(r['VALOR BRUTO']);o.VAL_LIQUIDO=num(r['VALOR LIQUIDO'])
  o.DAT_CREDITO=promoData(r['DATA AVERBACAO'])
  o.PCL_TAXA_EMPRESTIMO=promoTaxa(r['PRODUTO'])
  o.DSC_TIPO_FORMULARIO_EMPRESTIMO='DIGITAL'
  return o
}
