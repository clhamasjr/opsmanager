import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabase.js'
import * as XLSX from 'xlsx'

/* ═══ THEME ═══ */
const C={bg:'#F5F7FA',surface:'#FFFFFF',card:'#FFFFFF',border:'#E2E8F0',text:'#1E293B',muted:'#94A3B8',accent:'#3B82F6',accent2:'#10B981',warn:'#F59E0B',danger:'#EF4444',info:'#0EA5E9',abg:'#3B82F611'}
const NOW=new Date()
const diasUteisAte=(fromStr)=>{if(!fromStr)return null;const from=new Date(String(fromStr).slice(0,10)+'T00:00:00');const to=new Date(new Date().toISOString().slice(0,10)+'T00:00:00');if(isNaN(from)||isNaN(to))return null;let n=0;const d=new Date(from);while(d<to){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)n++}return n}
const localDate=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return`${y}-${m}-${dd}`}
const CUR_M=localDate(NOW).slice(0,7),PREV_M=(()=>{const d=new Date(NOW.getFullYear(),NOW.getMonth()-1,1);return localDate(d).slice(0,7)})()

/* ═══ UTILS ═══ */
const fmtCur=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDate=d=>{if(!d)return'—';const s=String(d).slice(0,10);const p=s.split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d}
const PROD_SIT=['CONCRETIZADO','CRC CLIENTE','PAGO','INTEGRADA','PAGO C/PENDÊNCIA','PAGO C/PENDENCIA','PORTABILIDADE AVERBADA']
const PROD_SITB=['FINALIZADO','PAGO','PAGA','AVERBADO','CONCRETIZADO','INTEGRADA','INTEGRADO','INT - FINALIZADO','INT - FINALIZADO REFIN','INT - TED EMITIDA','PAGO AO CLIENTE','PAGO C/PENDÊNCIA','PAGO C/PENDENCIA','PAGAMENTO REALIZADO','FINALIZADO / PAGO','PAGO - CRÉDITO ENVIADO','PORTABILIDADE AVERBADA']
const isFin=o=>PROD_SIT.includes((o.situacao||'').toUpperCase())||PROD_SITB.includes((o.situacaoBanco||'').toUpperCase())
const isEst=o=>{const s=(o.situacao||'').toUpperCase(),sb=(o.situacaoBanco||'').toUpperCase();return['ESTORNADO','CANCELADO','CANCELADA','RECUSADA','REPROVADA','REPROVADO','NEGADO','NEGADA','PROPOSTA REPROVADA','CANCELADO PELO CLIENTE'].includes(s)||['CANCELADO','CANCELADA','REPROVADA','REPROVADO','NEGADA','REPROVADA - FINALIZADA','REPROVADO CRÉDITO'].includes(sb)}
const isPend=o=>!isFin(o)&&!isEst(o)
const sitCol=s=>{s=(s||'').toUpperCase();if(['FINALIZADO','PAGO','AVERBADO','APROVADO','CONCRETIZADO','INTEGRADA','INTEGRADO','CRC CLIENTE','PAGA','PAGAMENTO REALIZADO'].includes(s))return C.accent2;if(['ESTORNADO','CANCELADO','CANCELADA','RECUSADA','REPROVADA','REPROVADO','NEGADO','NEGADA','PROPOSTA REPROVADA'].includes(s))return C.danger;if(['EM ANÁLISE','EM ANALISE','PENDENTE','ANALISE BANCO','ANDAMENTO','AGUARDANDO RETORNO CIP','PROPOSTA CADASTRADA','ASSINADO CCB'].includes(s))return C.warn;return C.info}
function nDate(v){if(!v)return'';if(typeof v==='number'){const days=Math.floor(v-25569);const y=1970;const d=new Date(Date.UTC(y,0,1+days));return!isNaN(d.getTime())?(d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')):''}const s=String(v).trim(),m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);if(m)return(m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);return''}
function pNum(v){if(v==null||v==='')return 0;if(typeof v==='number')return v;return parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.'))||0}
const fixDate=v=>{if(!v)return'';const s=String(v).trim();return s.length>=10&&s[4]==='-'?s.slice(0,10):s}
// Pendência "expirada": sem atividade há mais de N dias (sync parado / proposta morta) — sai dos cards, não é apagada
const OLD_PEND_DAYS=60
const isOldPend=d=>{if(!d)return false;const dt=new Date(String(d).slice(0,10)+'T00:00:00');return !isNaN(dt.getTime())&&(NOW-dt)/86400000>OLD_PEND_DAYS}
const fromDb=r=>({id:r.id,id_ext:r.id_ext||'',banco:r.banco||'',cpf:r.cpf||'',cliente:r.cliente||'',proposta:r.proposta||'',contrato:r.contrato||'',data:fixDate(r.data),prazo:r.prazo||'',vrBruto:Number(r.vr_bruto)||0,vrParcela:Number(r.vr_parcela)||0,vrLiquido:Number(r.vr_liquido)||0,vrRepasse:Number(r.vr_repasse)||0,vrSeguro:Number(r.vr_seguro)||0,taxa:r.taxa||'',operacao:r.operacao||'',situacao:r.situacao||'',produto:r.produto||'',convenio:r.convenio||'',agente:r.agente||'',situacaoBanco:r.situacao_banco||'',obsSituacao:r.obs_situacao||'',usuario:r.usuario||'',crcCliente:fixDate(r.crc_cliente),dataNossoCredito:fixDate(r.data_nosso_credito)})
const toDb=o=>({id_ext:o.id_ext||'',banco:o.banco||'',cpf:o.cpf||'',cliente:o.cliente||'',proposta:o.proposta||'',contrato:o.contrato||'',data:o.data||null,prazo:o.prazo||'',vr_bruto:o.vrBruto||0,vr_parcela:o.vrParcela||0,vr_liquido:o.vrLiquido||0,vr_repasse:o.vrRepasse||0,vr_seguro:o.vrSeguro||0,taxa:o.taxa||'',operacao:o.operacao||'',situacao:o.situacao||'',produto:o.produto||'',convenio:o.convenio||'',agente:o.agente||'',situacao_banco:o.situacaoBanco||'',obs_situacao:o.obsSituacao||'',usuario:o.usuario||'',crc_cliente:o.crcCliente||null,data_nosso_credito:o.dataNossoCredito||null})

/* ═══ PERIODS ═══ */
const PERIODS=(()=>{const y=NOW.getFullYear(),m=NOW.getMonth(),d=(a,b)=>localDate(new Date(a,b,1)),e=(a,b)=>localDate(new Date(a,b+1,0));return{mes:{n:'Mês Atual',f:d(y,m),t:e(y,m)},ant:{n:'Mês Anterior',f:d(y,m-1),t:e(y,m-1)},tri:{n:'Trimestre',f:d(y,m-2),t:e(y,m)},sem:{n:'Semestre',f:d(y,m-5),t:e(y,m)},ano:{n:String(y),f:y+'-01-01',t:y+'-12-31'},tudo:{n:'Tudo',f:'2000-01-01',t:'2099-12-31'}}})()
function prevRange(per,cdf,cdt){const y=NOW.getFullYear(),m=NOW.getMonth(),d=(a,b)=>localDate(new Date(a,b,1)),e=(a,b)=>localDate(new Date(a,b+1,0));if(per==='mes')return{df:d(y,m-1),dt:e(y,m-1),n:'Mês Anterior'};if(per==='ant')return{df:d(y,m-2),dt:e(y,m-2),n:'2 meses atrás'};if(per==='tri')return{df:d(y,m-5),dt:e(y,m-3),n:'Trimestre Anterior'};if(per==='sem')return{df:d(y,m-11),dt:e(y,m-6),n:'Semestre Anterior'};if(per==='ano')return{df:(y-1)+'-01-01',dt:(y-1)+'-12-31',n:String(y-1)};if(per==='custom'&&cdf&&cdt){const a=new Date(cdf+'T00:00:00'),b=new Date(cdt+'T00:00:00');const days=Math.round((b-a)/86400000)+1;const pb=new Date(a);pb.setDate(pb.getDate()-1);const pa=new Date(pb);pa.setDate(pa.getDate()-days+1);return{df:localDate(pa),dt:localDate(pb),n:'Período Anterior'}}return null}

/* ═══ SERVER-SIDE FETCH ═══ */
const SEL='id,banco,cpf,cliente,proposta,data,vr_bruto,vr_liquido,vr_repasse,vr_parcela,operacao,situacao,situacao_banco,convenio,agente,usuario,crc_cliente,data_nosso_credito'
async function fetchOps(per,onProgress,customDf,customDt){
  let df,dt
  if(per==='custom'){df=customDf||'2000-01-01';dt=customDt||'2099-12-31'}
  else{const r=PERIODS[per]||PERIODS.tudo;df=r.f;dt=r.t}
  const PAGE=1000;let all=[],from=0
  while(true){
    let q=supabase.from('digitacoes').select(SEL).range(from,from+PAGE-1)
      .not('agente','ilike','%teste%').not('cliente','ilike','%teste%').not('usuario','ilike','%teste%')
    if(per!=='tudo')q=q.gte('data',df).lte('data',dt)
    const{data,error}=await q
    if(error){console.error('fetchOps err:',error);break}
    if(!data||data.length===0)break
    all=all.concat(data);if(onProgress)onProgress(all.length)
    if(data.length<PAGE)break;from+=PAGE
  }
  console.log(`fetchOps(${per}) ${df}→${dt}: ${all.length} rows`)
  return all.map(fromDb)
}

/* ═══ FETCH PRODUCTION — by CRC date ═══ */
async function fetchProd(per,onProgress,customDf,customDt){
  let df,dt
  if(per==='custom'){df=customDf||'2000-01-01';dt=customDt||'2099-12-31'}
  else{const r=PERIODS[per]||PERIODS.tudo;df=r.f;dt=r.t}
  const PAGE=1000;let all=[],from=0
  while(true){
    let q=supabase.from('digitacoes').select(SEL)
      .in('situacao',['CONCRETIZADO','CRC CLIENTE','PAGO','INTEGRADA','PAGO C/PENDÊNCIA','PORTABILIDADE AVERBADA'])
      .not('agente','ilike','%teste%').not('cliente','ilike','%teste%').not('usuario','ilike','%teste%')
      .range(from,from+PAGE-1)
    if(per!=='tudo')q=q.gte('crc_cliente',df).lte('crc_cliente',dt)
    const{data,error}=await q
    if(error){console.error('fetchProd err:',error);break}
    if(!data||!data.length)break
    all=all.concat(data);if(onProgress)onProgress(all.length)
    if(data.length<PAGE)break;from+=PAGE
  }
  console.log(`fetchProd(${per}) ${df}→${dt}: ${all.length} rows`)
  return all.map(fromDb)
}

/* ═══ FETCH RECEIVABLES — all with CRC filled ═══ */
async function fetchReceb(){
  const PAGE=1000;let all=[],from=0
  while(true){
    const{data,error}=await supabase.from('digitacoes').select(SEL)
      .in('situacao',['CONCRETIZADO','CRC CLIENTE','PAGO','INTEGRADA','PAGO C/PENDÊNCIA','PORTABILIDADE AVERBADA'])
      .not('crc_cliente','is',null)
      .not('agente','ilike','%teste%').not('cliente','ilike','%teste%').not('usuario','ilike','%teste%')
      .range(from,from+PAGE-1)
    if(error){console.error('fetchReceb err:',error);break}
    if(!data||!data.length)break
    all=all.concat(data)
    if(data.length<PAGE)break;from+=PAGE
  }
  console.log(`fetchReceb: ${all.length} rows`)
  return all.map(fromDb)
}

/* ═══ BUSINESS DAYS + PROJECTION by CRC ═══ */
function countBD(s,e){let c=0;const d=new Date(s);while(d<=e){if(d.getDay()!==0&&d.getDay()!==6)c++;d.setDate(d.getDate()+1)}return c}
function getBD(dateStr){if(!dateStr)return 0;return countBD(new Date(dateStr),NOW)}
function getAgingKey(bd){return bd<=5?'0-5':bd<=10?'5-10':bd<=15?'10-15':bd<=30?'15-30':bd<=60?'30-60':bd<=90?'60-90':'90+'}
function getProj(prodOps){
  const y=NOW.getFullYear(),m=NOW.getMonth(),f=new Date(y,m,1),l=new Date(y,m+1,0),ye=new Date(NOW);ye.setDate(ye.getDate()-1)
  const duT=countBD(f,l),duP=countBD(f,ye<f?f:ye),duR=duT-duP
  // prodOps already filtered by CRC in current month
  const fR=prodOps.reduce((s,o)=>s+(o.vrBruto||0),0),fC=prodOps.length
  const mdR=duP>0?fR/duP:0,mdD=duP>0?fC/duP:0
  return{duT,duP,duR,fR,fC,mdR,mdD,pR:mdR*duT,pD:Math.round(mdD*duT)}
}

/* ═══ UI ATOMS ═══ */
function Stat({label,value,sub,color,small}){return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:small?'10px 12px':'14px 16px',flex:1,minWidth:small?90:120}}><div style={{fontSize:small?8:9,color:C.muted,marginBottom:3,fontWeight:600,textTransform:'uppercase'}}>{label}</div><div style={{fontSize:small?14:18,fontWeight:700,color:color||C.text}}>{value}</div>{sub&&<div style={{fontSize:small?9:10,color:C.muted,marginTop:2}}>{sub}</div>}</div>}
function Badge({text,color}){return<span style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:color+'22',color,fontWeight:600}}>{text}</span>}
function PeriodBar({per,setPer,loading,customDf,customDt,setCustomDf,setCustomDt,onApplyCustom}){
  return<div style={{display:'flex',flexDirection:'column',gap:6}}>
    <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
      {Object.entries(PERIODS).map(([k,v])=><button key={k} onClick={()=>setPer(k)} disabled={loading} style={{padding:'5px 12px',borderRadius:6,fontFamily:'Outfit,sans-serif',fontSize:10,border:'1px solid '+(per===k?C.accent:C.border),background:per===k?C.abg:'transparent',color:per===k?C.accent:C.muted,fontWeight:per===k?700:400,cursor:loading?'wait':'pointer',opacity:loading?.5:1}}>{v.n}</button>)}
      <button onClick={()=>setPer('custom')} disabled={loading} style={{padding:'5px 12px',borderRadius:6,fontFamily:'Outfit,sans-serif',fontSize:10,border:'1px solid '+(per==='custom'?C.accent:C.border),background:per==='custom'?C.abg:'transparent',color:per==='custom'?C.accent:C.muted,fontWeight:per==='custom'?700:400,cursor:loading?'wait':'pointer'}}>📅 Personalizado</button>
      {loading&&<span style={{fontSize:10,color:C.warn,marginLeft:8}}>⏳</span>}
    </div>
    {per==='custom'&&<div style={{display:'flex',gap:8,alignItems:'end'}}>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>DE</label><input type="date" value={customDf||''} onChange={e=>setCustomDf&&setCustomDf(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'6px 10px',fontSize:11,fontFamily:'Outfit,sans-serif'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>ATÉ</label><input type="date" value={customDt||''} onChange={e=>setCustomDt&&setCustomDt(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'6px 10px',fontSize:11,fontFamily:'Outfit,sans-serif'}}/></div>
      <button onClick={()=>onApplyCustom&&onApplyCustom()} style={{background:C.accent,color:'#fff',border:'none',borderRadius:7,padding:'7px 16px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Aplicar</button>
    </div>}
  </div>
}

/* ═══ EXPORT XLSX ═══ */
function exportXlsx(ops,filename){
  const ws=XLSX.utils.json_to_sheet(ops.map(o=>({Data:o.data,Banco:o.banco,CPF:o.cpf,Cliente:o.cliente,Proposta:o.proposta,'Operação':o.operacao,'Situação':o.situacao,'Sit.Banco':o.situacaoBanco,'Convênio':o.convenio,Agente:o.agente,Bruto:o.vrBruto,Líquido:o.vrLiquido,Repasse:o.vrRepasse,Parcela:o.vrParcela,CRC:o.crcCliente,'Nosso Crédito':o.dataNossoCredito})))
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Dados');XLSX.writeFile(wb,filename+'.xlsx')
}
function canManage(){try{const s=JSON.parse(localStorage.getItem('om-session')||'{}');return s.perfil==='admin'||s.perfil==='gestor'}catch(e){return false}}
function ExportBtn({ops,name}){if(!canManage())return null;return<button onClick={()=>exportXlsx(ops,name||'export')} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 ({ops.length})</button>}

function ExportModal({open,onClose,ops}){
  const[fBanco,sFBanco]=useState(''),[fAgente,sFAgente]=useState(''),[fOp,sFOp]=useState(''),[fSit,sFSit]=useState(''),[fConv,sFConv]=useState('')
  if(!open)return null
  const bancos=[...new Set(ops.map(o=>o.banco).filter(Boolean))].sort()
  const agentes=[...new Set(ops.map(o=>o.agente).filter(Boolean))].sort()
  const operacoes=[...new Set(ops.map(o=>o.operacao).filter(Boolean))].sort()
  const situacoes=[...new Set(ops.map(o=>o.situacao).filter(Boolean))].sort()
  const convenios=[...new Set(ops.map(o=>o.convenio).filter(Boolean))].sort()
  const fd=ops.filter(o=>(!fBanco||o.banco===fBanco)&&(!fAgente||o.agente===fAgente)&&(!fOp||o.operacao===fOp)&&(!fSit||o.situacao===fSit)&&(!fConv||o.convenio===fConv))
  const sel=s=>({background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11,width:'100%'})
  return<div style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:18,width:640,maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
      <div style={{padding:'16px 22px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between'}}><h3 style={{fontWeight:700,fontSize:15,margin:0}}>Exportar com Filtros</h3><button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>×</button></div>
      <div style={{padding:'16px 22px',display:'flex',flexDirection:'column',gap:12}}>
        <div className="rg3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
          <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>BANCO</label><select value={fBanco} onChange={e=>sFBanco(e.target.value)} style={sel()}><option value="">Todos</option>{bancos.map(b=><option key={b} value={b}>{b}</option>)}</select></div>
          <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>PARCEIRO</label><select value={fAgente} onChange={e=>sFAgente(e.target.value)} style={sel()}><option value="">Todos</option>{agentes.map(a=><option key={a} value={a}>{a}</option>)}</select></div>
          <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>OPERAÇÃO</label><select value={fOp} onChange={e=>sFOp(e.target.value)} style={sel()}><option value="">Todas</option>{operacoes.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
          <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>SITUAÇÃO</label><select value={fSit} onChange={e=>sFSit(e.target.value)} style={sel()}><option value="">Todas</option>{situacoes.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>CONVÊNIO</label><select value={fConv} onChange={e=>sFConv(e.target.value)} style={sel()}><option value="">Todos</option>{convenios.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{display:'flex',alignItems:'end'}}><button onClick={()=>{sFBanco('');sFAgente('');sFOp('');sFSit('');sFConv('')}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.muted,padding:'6px 12px',fontSize:11,cursor:'pointer',width:'100%'}}>Limpar</button></div>
        </div>
        <div style={{background:C.surface,borderRadius:10,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><strong style={{color:C.accent}}>{fd.length}</strong> registros — {fmtCur(fd.reduce((s,o)=>s+(o.vrBruto||0),0))}</div>
          <button onClick={()=>{exportXlsx(fd,'opsmanager-export');onClose()}} disabled={!fd.length} style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:700,fontSize:13,cursor:'pointer',opacity:fd.length?.1:.4}}>📤 Exportar XLSX</button>
        </div>
      </div>
    </div>
  </div>
}

/* ═══ PARCEIROS ═══ */
function parseParceiros(wb){
  const ws=wb.Sheets[wb.SheetNames[0]]
  const rows=XLSX.utils.sheet_to_json(ws,{defval:'',header:1})
  if(!rows.length)return[]
  const h=rows[0]
  // Detecta CRViewReport: pares chave-valor (72+ cols, col 0="Agente")
  if(h.length>=20&&String(h[0]||'').toLowerCase().includes('agente')&&String(h[2]||'').toLowerCase().includes('fun')){
    const fIdx={}
    for(let i=0;i<h.length;i+=2){const k=String(h[i]||'').trim().toLowerCase();if(k)fIdx[k]=i+1}
    const g=(row,k)=>{const i=fIdx[k];return(i!=null&&i<row.length&&row[i]!=null)?String(row[i]).trim():''}
    const parsed=rows.map(r=>{
      const raw=g(r,'agente')
      if(!raw||raw.toLowerCase()==='agente')return null
      const nm=raw.replace(/^[\d.\/\-]+\s*/,'').trim()
      const cpf=g(r,'cpf/cnpj')
      const sit=g(r,'situação')||g(r,'situacao')
      const sup=g(r,'supervisor')
      const ger=g(r,'gerente')
      const codSup=sup?sup.split('|')[0]?.trim():''
      const nomeSup=sup?sup.split('|')[1]?.trim()||sup:''
      return{
        nome:nm||raw,
        cpf_cnpj:cpf,
        telefone:g(r,'celular')||g(r,'tel.resid.'),
        email:g(r,'e-mail'),
        cidade:g(r,'cidade'),
        uf:g(r,'uf'),
        responsavel:nomeSup,
        observacao:g(r,'observação')||g(r,'observacao'),
        ativo:sit?sit.toUpperCase()==='ATIVO':true,
        cod_agente:g(r,'cód.agente'),
        funcao:g(r,'função')||g(r,'funcao')||'AGENTE',
        cod_supervisor:codSup,
        supervisor:nomeSup,
        gerente:ger?ger.split('|')[1]?.trim()||ger:''
      }
    }).filter(r=>r&&r.nome)
    // Deduplicar nomes — adiciona código se houver duplicata
    const nameCount={};parsed.forEach(p=>nameCount[p.nome]=(nameCount[p.nome]||0)+1)
    parsed.forEach(p=>{if(nameCount[p.nome]>1&&p.cod_agente)p.nome=p.nome+' ('+p.cod_agente+')'})
    // Dedup final: mesmo nome+código repetido na planilha quebra o upsert (ON CONFLICT ... row a second time) — funde mantendo campos preenchidos
    return dedupeByNome(parsed)
  }
  const jsonRows=XLSX.utils.sheet_to_json(ws,{defval:''})
  return dedupeByNome(jsonRows.map(r=>({
    nome:String(r.Nome||r.nome||r.NOME||r.Agente||r.agente||'').trim(),
    cpf_cnpj:String(r.CPF||r.CNPJ||r.cpf_cnpj||r['CPF/CNPJ']||'').trim(),
    telefone:String(r.Telefone||r.telefone||r.Tel||r.Celular||'').trim(),
    email:String(r.Email||r.email||r['E-mail']||'').trim(),
    cidade:String(r.Cidade||r.cidade||'').trim(),
    uf:String(r.UF||r.uf||'').trim(),
    responsavel:String(r.Responsavel||r.responsavel||r.Supervisor||'').trim(),
    observacao:String(r.Obs||r.obs||r['Observação']||'').trim()
  })).filter(r=>r.nome))
}
function dedupeByNome(arr){
  const m=new Map()
  arr.forEach(p=>{
    const e=m.get(p.nome)
    if(!e){m.set(p.nome,p);return}
    Object.keys(p).forEach(f=>{const v=p[f];if(v!==''&&v!=null&&(e[f]===''||e[f]==null))e[f]=v})
  })
  return[...m.values()]
}

function Parceiros({curOps,curProd,myAgents}){
  const[list,setList]=useState([]),[loading,setLoading]=useState(true),[showNew,setShowNew]=useState(false),[se,sSe]=useState('')
  const[nome,setNome]=useState(''),[cpf,setCpf]=useState(''),[tel,setTel]=useState(''),[email,setEmail]=useState(''),[cidade,setCidade]=useState(''),[uf,setUf]=useState(''),[resp,setResp]=useState(''),[obs,setObs]=useState(''),[msg,setMsg]=useState('')
  const[tab,sTab]=useState('lista'),[openSup,setOpenSup]=useState({})
  const fr=useRef(null)
  useEffect(()=>{supabase.from('parceiros').select('*').order('nome').then(({data})=>{setList(data||[]);setLoading(false)})},[])
  const reload=async()=>{const{data}=await supabase.from('parceiros').select('*').order('nome');setList(data||[])}
  // Computações DEPOIS dos hooks
  const prodByAg={};(curOps||[]).forEach(o=>{const a=o.agente||'?';if(!prodByAg[a])prodByAg[a]={dig:0,vl:0,prod:0,vr:0};prodByAg[a].dig++;prodByAg[a].vl+=(o.vrBruto||0)})
  ;(curProd||[]).forEach(o=>{const a=o.agente||'?';if(!prodByAg[a])prodByAg[a]={dig:0,vl:0,prod:0,vr:0};prodByAg[a].prod++;prodByAg[a].vr+=(o.vrBruto||0)})
  const getProd=name=>(prodByAg[name]||{dig:0,vl:0,prod:0,vr:0})
  const fd=(myAgents?list.filter(p=>myAgents.has(p.nome)):list).filter(p=>{if(!se)return true;const s=se.toLowerCase();return(p.nome||'').toLowerCase().includes(s)||(p.cpf_cnpj||'').includes(s)||(p.cidade||'').toLowerCase().includes(s)||(p.supervisor||'').toLowerCase().includes(s)})
  const exportParceiros=()=>{
    const rows=fd.map(p=>{const pr=getProd(p.nome);const cv=pr.dig?(pr.prod/pr.dig*100):0;return{Código:p.cod_agente||'',Nome:p.nome,Função:p.funcao||'','CPF/CNPJ':p.cpf_cnpj||'',Telefone:p.telefone||'',Email:p.email||'',Cidade:p.cidade||'',UF:p.uf||'',Supervisor:p.supervisor||'',Status:p.ativo?'ATIVO':'INATIVO','Dig.Mês':pr.dig,'Base Dig.':pr.vl,'Prod.Mês':pr.prod,'Base Prod.':pr.vr,'Conversão':cv?cv.toFixed(1)+'%':''}})
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Parceiros');XLSX.writeFile(wb,'parceiros-'+new Date().toISOString().slice(0,10)+'.xlsx')
  }
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
      <h2 style={{fontWeight:800,fontSize:20}}>Parceiros ({list.length})</h2>
      <div style={{display:'flex',gap:6}}>
        <button onClick={exportParceiros} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 Exportar ({fd.length})</button>
        <button onClick={()=>fr.current?.click()} style={{background:C.surface,border:'1px solid '+C.accent,borderRadius:8,color:C.accent,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>🔄 Atualizar Base</button>
        <input ref={fr} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setMsg('Processando...');const rd=new FileReader();rd.onload=async ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const parsed=parseParceiros(wb);if(!parsed.length){setMsg('⚠ Nenhum registro encontrado');return}setMsg('Gravando '+parsed.length+'...');let ok=0;for(let i=0;i<parsed.length;i+=200){const batch=parsed.slice(i,i+200);const{error}=await supabase.from('parceiros').upsert(batch,{onConflict:'nome',ignoreDuplicates:false});if(error){console.error('Upsert error:',error);const basic=batch.map(({cod_agente,funcao,cod_supervisor,supervisor,gerente,...rest})=>rest);const{error:e2}=await supabase.from('parceiros').upsert(basic,{onConflict:'nome',ignoreDuplicates:false});if(e2){setMsg('Erro: '+e2.message);return}ok+=basic.length}else{ok+=batch.length}setMsg('Gravando '+ok+'/'+parsed.length+'...')}await reload();setMsg('✓ '+ok+' parceiros atualizados! ('+new Date().toLocaleDateString('pt-BR')+')')}catch(ex){setMsg('Erro: '+ex.message)}};rd.readAsArrayBuffer(file)}}/>
        <button onClick={()=>setShowNew(!showNew)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'6px 14px',fontWeight:600,fontSize:11,cursor:'pointer'}}>+ Novo</button>
      </div>
    </div>
    {msg&&<div style={{background:C.accent2+'22',color:C.accent2,padding:'8px 12px',borderRadius:8,fontSize:12}}>{msg}</div>}
    {showNew&&<form onSubmit={async e=>{e.preventDefault();await supabase.from('parceiros').insert({nome,cpf_cnpj:cpf,telefone:tel,email,cidade,uf,responsavel:resp,observacao:obs});setNome('');setCpf('');setTel('');setEmail('');setCidade('');setUf('');setResp('');setObs('');setShowNew(false);await reload()}} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,alignItems:'end'}}>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>NOME</label><input value={nome} onChange={e=>setNome(e.target.value)} required style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>CPF/CNPJ</label><input value={cpf} onChange={e=>setCpf(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>TELEFONE</label><input value={tel} onChange={e=>setTel(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>EMAIL</label><input value={email} onChange={e=>setEmail(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>CIDADE</label><input value={cidade} onChange={e=>setCidade(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>UF</label><input value={uf} onChange={e=>setUf(e.target.value)} maxLength={2} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>RESPONSÁVEL</label><input value={resp} onChange={e=>setResp(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div>
      <button type="submit" style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Salvar</button>
    </form>}
    <div style={{display:'flex',gap:6,marginBottom:4}}>
      <button onClick={()=>sTab('lista')} style={{padding:'6px 16px',borderRadius:8,border:'1px solid '+(tab==='lista'?C.accent:C.border),background:tab==='lista'?C.abg:'transparent',color:tab==='lista'?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:tab==='lista'?600:400}}>📋 Lista</button>
      <button onClick={()=>sTab('arvore')} style={{padding:'6px 16px',borderRadius:8,border:'1px solid '+(tab==='arvore'?C.accent:C.border),background:tab==='arvore'?C.abg:'transparent',color:tab==='arvore'?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:tab==='arvore'?600:400}}>🌳 Árvore de Gestão</button>
      <button onClick={()=>sTab('analise')} style={{padding:'6px 16px',borderRadius:8,border:'1px solid '+(tab==='analise'?C.accent:C.border),background:tab==='analise'?C.abg:'transparent',color:tab==='analise'?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:tab==='analise'?600:400}}>📊 Análise</button>
    </div>
    {tab==='lista'&&<>
    <input value={se} onChange={e=>sSe(e.target.value)} placeholder="Buscar parceiro..." style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 12px',fontSize:12,outline:'none'}}/>
    {!loading&&<div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Cód','Nome','Função','Telefone','Email','Dig.','Produção','Conv.','Supervisor','Status'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:7,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{fd.map(p=>{const pr=getProd(p.nome);const cv=pr.dig?(pr.prod/pr.dig*100):0;return<tr key={p.id} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'8px 10px',color:C.muted,fontSize:9}}>{p.cod_agente||'—'}</td><td style={{padding:'8px 10px',fontWeight:600}}>{p.nome}</td><td style={{padding:'8px 10px',fontSize:10}}><Badge text={p.funcao||'AGENTE'} color={p.funcao==='GERENTE COMERCIAL'?C.accent:p.funcao==='INDICADO'?C.info:C.muted}/></td><td style={{padding:'8px 10px',fontSize:10}}>{p.telefone||'—'}</td><td style={{padding:'8px 10px',fontSize:10}}>{p.email||'—'}</td><td style={{padding:'8px 10px',textAlign:'center'}}>{pr.dig||'—'}</td><td style={{padding:'8px 10px',fontWeight:600,color:C.accent2}}>{pr.prod?fmtCur(pr.vr):'—'}</td><td style={{padding:'8px 10px',fontWeight:600,color:cv>=50?C.accent2:cv>=30?C.warn:cv>0?C.danger:C.muted}}>{cv?cv.toFixed(0)+'%':'—'}</td><td style={{padding:'8px 10px',fontSize:9}}>{p.supervisor||'—'}</td><td style={{padding:'8px 10px'}}><Badge text={p.ativo?'Ativo':'Inativo'} color={p.ativo?C.accent2:C.danger}/></td></tr>})}</tbody></table></div>}
    </>}
    {tab==='arvore'&&!loading&&(()=>{
      const bySup={},semSup=[]
      list.forEach(p=>{
        const sup=p.cod_supervisor||p.supervisor
        if(sup){
          if(!bySup[sup])bySup[sup]={nome:p.supervisor||sup,cod:p.cod_supervisor||'',members:[]}
          bySup[sup].members.push(p)
        }else{
          const isSup=list.some(x=>x.cod_supervisor===p.cod_agente)
          if(!isSup)semSup.push(p)
        }
      })
      // Calcular produção por supervisor
      const supProd=(members)=>{let d=0,vl=0,pr=0,vr=0;members.forEach(m=>{const p=getProd(m.nome);d+=p.dig;vl+=p.vl;pr+=p.prod;vr+=p.vr});return{d,vl,pr,vr}}
      const supArr=Object.entries(bySup).map(([k,s])=>({...s,key:k,sp:supProd(s.members)})).sort((a,b)=>b.sp.vr-a.sp.vr)
      const toggleSup=k=>setOpenSup(p=>({...p,[k]:!p[k]}))
      const AgRow=({m})=>{const p=getProd(m.nome);const cv=p.dig?(p.prod/p.dig*100):0;return<tr style={{borderBottom:'1px solid '+C.border}}>
        <td style={{padding:'5px 8px',color:C.muted,fontSize:9}}>{m.cod_agente}</td>
        <td style={{padding:'5px 8px',fontWeight:600,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.nome}</td>
        <td style={{padding:'5px 8px'}}><Badge text={m.funcao||'AGENTE'} color={m.funcao==='INDICADO'?C.info:m.funcao==='GERENTE COMERCIAL'?C.accent:C.muted}/></td>
        <td style={{padding:'5px 8px',fontSize:10}}>{m.telefone||'—'}</td>
        <td style={{padding:'5px 8px',fontSize:10,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.email||'—'}</td>
        <td style={{padding:'5px 8px',textAlign:'center'}}>{p.dig||<span style={{color:C.border}}>—</span>}</td>
        <td style={{padding:'5px 8px',textAlign:'center',color:C.accent}}>{p.dig?fmtCur(p.vl):<span style={{color:C.border}}>—</span>}</td>
        <td style={{padding:'5px 8px',textAlign:'center',fontWeight:600,color:C.accent2}}>{p.prod||<span style={{color:C.border}}>—</span>}</td>
        <td style={{padding:'5px 8px',textAlign:'center',fontWeight:600,color:C.accent2}}>{p.prod?fmtCur(p.vr):<span style={{color:C.border}}>—</span>}</td>
        <td style={{padding:'5px 8px',textAlign:'center',fontWeight:600,color:cv>=50?C.accent2:cv>=30?C.warn:cv>0?C.danger:C.border}}>{cv?cv.toFixed(0)+'%':'—'}</td>
        <td style={{padding:'5px 8px'}}><Badge text={m.ativo?'Ativo':'Inativo'} color={m.ativo?C.accent2:C.danger}/></td>
      </tr>}
      const TH=['Cód','Nome','Função','Telefone','Email','Dig.','Base Dig.','Prod.','Base Prod.','Conv.','Status']
      // Totais gerais
      const allP={d:0,vl:0,pr:0,vr:0};list.forEach(m=>{const p=getProd(m.nome);allP.d+=p.dig;allP.vl+=p.vl;allP.pr+=p.prod;allP.vr+=p.vr})
      return<div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:4}}>
          <Stat label="Supervisores" value={supArr.length} small/>
          <Stat label="Ativos" value={list.filter(p=>p.ativo).length} color={C.accent2} small/>
          <Stat label="Digitações" value={allP.d} sub={fmtCur(allP.vl)} color={C.accent} small/>
          <Stat label="Produção" value={allP.pr} sub={fmtCur(allP.vr)} color={C.accent2} small/>
          <Stat label="Conv." value={allP.d?(allP.pr/allP.d*100).toFixed(0)+'%':'—'} color={allP.d&&(allP.pr/allP.d)>=.5?C.accent2:C.warn} small/>
        </div>
        {supArr.map(s=>{
          const isOpen=openSup[s.key]!==false
          const active=s.members.filter(p=>p.ativo).length
          const cv=s.sp.d?(s.sp.pr/s.sp.d*100):0
          return<div key={s.key} style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,overflow:'hidden'}}>
            <div onClick={()=>toggleSup(s.key)} style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:C.surface}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:14}}>{isOpen?'▾':'▸'}</span>
                <span style={{fontSize:14}}>👤</span>
                <div><div style={{fontSize:12,fontWeight:700}}>{s.nome}</div><div style={{fontSize:9,color:C.muted}}>Cód: {s.cod} · {active}/{s.members.length} ativos</div></div>
              </div>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:C.accent}}>{s.sp.d}</div><div style={{fontSize:7,color:C.muted}}>DIG</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:C.accent2}}>{s.sp.pr}</div><div style={{fontSize:7,color:C.muted}}>PROD</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:C.accent2}}>{fmtCur(s.sp.vr)}</div><div style={{fontSize:7,color:C.muted}}>REPASSE</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:cv>=50?C.accent2:cv>=30?C.warn:cv>0?C.danger:C.muted}}>{cv?cv.toFixed(0)+'%':'—'}</div><div style={{fontSize:7,color:C.muted}}>CONV</div></div>
              </div>
            </div>
            {isOpen&&<div style={{padding:'0 16px 12px'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:10,marginTop:8}}>
                <thead><tr>{TH.map(h=><th key={h} style={{padding:'4px 8px',textAlign:'left',color:C.muted,fontSize:7,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
                <tbody>{s.members.sort((a,b)=>(getProd(b.nome).vr)-(getProd(a.nome).vr)).map(m=><AgRow key={m.id} m={m}/>)}</tbody>
              </table>
            </div>}
          </div>})}
        {semSup.length>0&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,overflow:'hidden'}}>
          <div onClick={()=>toggleSup('__sem__')} style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:C.surface}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:14}}>{openSup['__sem__']!==false?'▾':'▸'}</span><span style={{fontSize:14}}>📋</span><div style={{fontSize:12,fontWeight:700}}>Sem Supervisor ({semSup.length})</div></div>
            {(()=>{const sp=supProd(semSup);return<div style={{display:'flex',gap:14,alignItems:'center'}}>
              <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:C.accent}}>{sp.d}</div><div style={{fontSize:7,color:C.muted}}>DIG</div></div>
              <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:C.accent2}}>{sp.pr}</div><div style={{fontSize:7,color:C.muted}}>PROD</div></div>
              <div style={{textAlign:'center'}}><div style={{fontSize:12,fontWeight:700,color:C.accent2}}>{fmtCur(sp.vr)}</div><div style={{fontSize:7,color:C.muted}}>REPASSE</div></div>
            </div>})()}
          </div>
          {openSup['__sem__']!==false&&<div style={{padding:'0 16px 12px'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:10,marginTop:8}}>
              <thead><tr>{TH.map(h=><th key={h} style={{padding:'4px 8px',textAlign:'left',color:C.muted,fontSize:7,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>{semSup.sort((a,b)=>(getProd(b.nome).vr)-(getProd(a.nome).vr)).map(m=><AgRow key={m.id} m={m}/>)}</tbody>
            </table>
          </div>}
        </div>}
      </div>
    })()}

    {/* ABA ANÁLISE */}
    {tab==='analise'&&!loading&&(()=>{
      const ativos=list.filter(p=>p.ativo),inativos=list.filter(p=>!p.ativo)
      // Classificar por atividade
      const comDig=[],semDig=[],comProd=[],semProd=[]
      const semTel=[],semEmail=[],semSup=[],cadIncompleto=[]
      const acao=[]
      ativos.forEach(p=>{
        const pr=getProd(p.nome)
        if(pr.dig>0)comDig.push({...p,pr});else semDig.push({...p,pr})
        if(pr.prod>0)comProd.push({...p,pr});else semProd.push({...p,pr})
        if(!p.telefone)semTel.push(p)
        if(!p.email)semEmail.push(p)
        if(!p.supervisor&&!p.cod_supervisor)semSup.push(p)
        if(!p.telefone||!p.email)cadIncompleto.push(p)
        // Sugestões de ação
        if(pr.dig===0&&pr.prod===0)acao.push({...p,pr,tipo:'🔴 Sem Atividade',msg:'Nenhuma digitação ou produção no mês. Contatar para verificar interesse.'})
        else if(pr.dig>0&&pr.prod===0)acao.push({...p,pr,tipo:'🟡 Sem Conversão',msg:`${pr.dig} digitações sem produção. Acompanhar status das propostas.`})
        else if(pr.dig>0&&pr.prod>0){const cv=pr.prod/pr.dig*100;if(cv<25)acao.push({...p,pr,tipo:'🟠 Baixa Conversão',msg:`Conversão ${cv.toFixed(0)}% — verificar qualidade das digitações.`})}
      })
      // Inativos com potencial
      const inativosPot=inativos.filter(p=>{const pr=getProd(p.nome);return pr.dig>0||pr.prod>0}).map(p=>({...p,pr:getProd(p.nome)}))
      // Totals
      const totalBase=ativos.reduce((s,p)=>s+getProd(p.nome).vl,0)
      const totalProd=ativos.reduce((s,p)=>s+getProd(p.nome).vr,0)
      const cvGeral=comDig.length?((comProd.length/comDig.length)*100):0

      return<div style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* RESUMO */}
        <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Stat label="Total Cadastrados" value={list.length} sub={`${ativos.length} ativos · ${inativos.length} inativos`}/>
          <Stat label="Com Digitação" value={comDig.length} sub={fmtCur(totalBase)} color={C.accent}/>
          <Stat label="Com Produção" value={comProd.length} sub={fmtCur(totalProd)} color={C.accent2}/>
          <Stat label="Sem Atividade" value={semDig.length} color={C.danger} sub={`${ativos.length?((semDig.length/ativos.length)*100).toFixed(0):0}% dos ativos`}/>
          <Stat label="Cadastro Incompleto" value={cadIncompleto.length} color={C.warn}/>
        </div>

        {/* INDICADORES */}
        <div className="rg3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>📊 Funil do Mês</div>
            {[{l:'Cadastrados Ativos',v:ativos.length,c:C.text,pct:100},
              {l:'Com Digitação',v:comDig.length,c:C.accent,pct:ativos.length?(comDig.length/ativos.length*100):0},
              {l:'Com Produção',v:comProd.length,c:C.accent2,pct:ativos.length?(comProd.length/ativos.length*100):0}
            ].map(x=><div key={x.l} style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}><span>{x.l}</span><span style={{fontWeight:700,color:x.c}}>{x.v} ({x.pct.toFixed(0)}%)</span></div>
              <div style={{height:6,background:C.bg,borderRadius:3}}><div style={{height:'100%',background:x.c,borderRadius:3,width:x.pct+'%'}}/></div>
            </div>)}
          </div>

          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>⚠ Pendências Cadastrais</div>
            {[{l:'Sem Telefone',v:semTel.length,c:C.danger},
              {l:'Sem Email',v:semEmail.length,c:C.warn},
              {l:'Sem Supervisor',v:semSup.length,c:C.info},
              {l:'Inativos',v:inativos.length,c:C.muted}
            ].map(x=><div key={x.l} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'5px 0',borderBottom:'1px solid '+C.border}}>
              <span>{x.l}</span><span style={{fontWeight:700,color:x.c}}>{x.v}</span>
            </div>)}
          </div>

          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>🏆 Top Produtores</div>
            {ativos.sort((a,b)=>getProd(b.nome).vr-getProd(a.nome).vr).slice(0,7).map((p,i)=>{const pr=getProd(p.nome);return pr.prod?<div key={p.id} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'3px 0'}}>
              <span style={{color:i<3?C.accent2:C.text}}>{i+1}. {p.nome}</span>
              <span style={{fontWeight:600,color:C.accent2}}>{fmtCur(pr.vr)}</span>
            </div>:null}).filter(Boolean)}
          </div>
        </div>

        {/* SUGESTÕES DE AÇÃO */}
        <div style={{background:C.card,border:'1px solid '+C.danger+'33',borderRadius:14,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700}}>🎯 Sugestões de Ação — {acao.length} parceiros</span>
            <span style={{fontSize:10,color:C.muted}}>Ativos sem resultado ou com baixa performance</span>
          </div>
          <div style={{overflowX:'auto',maxHeight:300}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
            <thead><tr style={{background:C.surface}}>{['Status','Parceiro','Telefone','Supervisor','Dig.','Prod.','Ação Sugerida'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
            <tbody>{acao.sort((a,b)=>{const ord={'🔴 Sem Atividade':0,'🟡 Sem Conversão':1,'🟠 Baixa Conversão':2};return(ord[a.tipo]||9)-(ord[b.tipo]||9)}).slice(0,50).map(a=><tr key={a.id} style={{borderBottom:'1px solid '+C.border}}>
              <td style={{padding:'5px 8px',whiteSpace:'nowrap'}}>{a.tipo}</td>
              <td style={{padding:'5px 8px',fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nome}</td>
              <td style={{padding:'5px 8px'}}>{a.telefone||<span style={{color:C.danger}}>sem tel</span>}</td>
              <td style={{padding:'5px 8px',fontSize:9}}>{a.supervisor||'—'}</td>
              <td style={{padding:'5px 8px',textAlign:'center'}}>{a.pr.dig}</td>
              <td style={{padding:'5px 8px',textAlign:'center',color:a.pr.prod?C.accent2:C.danger}}>{a.pr.prod}</td>
              <td style={{padding:'5px 8px',fontSize:9,color:C.muted,maxWidth:200}}>{a.msg}</td>
            </tr>)}</tbody>
          </table></div>
        </div>

        {/* INATIVOS COM POTENCIAL */}
        {inativosPot.length>0&&<div style={{background:C.card,border:'1px solid '+C.warn+'33',borderRadius:14,padding:16}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>♻ Inativos com Produção Recente — Reativar? ({inativosPot.length})</div>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
            <thead><tr style={{background:C.surface}}>{['Parceiro','Telefone','Email','Dig.','Produção','Supervisor'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
            <tbody>{inativosPot.sort((a,b)=>b.pr.vr-a.pr.vr).map(p=><tr key={p.id} style={{borderBottom:'1px solid '+C.border}}>
              <td style={{padding:'5px 8px',fontWeight:600}}>{p.nome}</td>
              <td style={{padding:'5px 8px'}}>{p.telefone||'—'}</td>
              <td style={{padding:'5px 8px'}}>{p.email||'—'}</td>
              <td style={{padding:'5px 8px',textAlign:'center'}}>{p.pr.dig}</td>
              <td style={{padding:'5px 8px',fontWeight:600,color:C.accent2}}>{p.pr.prod?fmtCur(p.pr.vr):'—'}</td>
              <td style={{padding:'5px 8px',fontSize:9}}>{p.supervisor||'—'}</td>
            </tr>)}</tbody>
          </table></div>
        </div>}

        {/* PERFIL POR FAIXA DE PRODUÇÃO */}
        {(()=>{
          const faixas=[
            {id:'elite',label:'🏆 Elite',min:100000,color:'#8B5CF6',bg:'#8B5CF610'},
            {id:'ouro',label:'🥇 Ouro',min:50000,max:100000,color:C.accent2,bg:C.accent2+'10'},
            {id:'prata',label:'🥈 Prata',min:20000,max:50000,color:C.accent,bg:C.accent+'10'},
            {id:'bronze',label:'🥉 Bronze',min:5000,max:20000,color:C.warn,bg:C.warn+'10'},
            {id:'inicial',label:'📗 Iniciante',min:1,max:5000,color:C.info,bg:C.info+'10'},
            {id:'zero',label:'⚪ Sem Produção',min:0,max:0,color:C.muted,bg:C.surface}
          ]
          const ativosData=ativos.map(p=>{const pr=getProd(p.nome);return{...p,pr,vr:pr.vr||0}})
          const faixaData=faixas.map(f=>{
            const ps=f.id==='zero'?ativosData.filter(p=>p.vr===0):f.max?ativosData.filter(p=>p.vr>=f.min&&p.vr<f.max):ativosData.filter(p=>p.vr>=f.min)
            const totalVal=ps.reduce((s,p)=>s+p.vr,0)
            const totalDig=ps.reduce((s,p)=>s+p.pr.dig,0)
            const avgVal=ps.length?totalVal/ps.length:0
            const cv=totalDig?(ps.reduce((s,p)=>s+p.pr.prod,0)/totalDig*100):0
            return{...f,count:ps.length,totalVal,totalDig,avgVal,cv,parceiros:ps.sort((a,b)=>b.vr-a.vr)}
          })
          const totalGeral=ativosData.reduce((s,p)=>s+p.vr,0)
          return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:13,fontWeight:800,marginBottom:12}}>🎯 Perfil por Faixa de Produção</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8,marginBottom:14}}>
              {faixaData.map(f=><div key={f.id} style={{background:f.bg,border:'1px solid '+f.color+'33',borderRadius:10,padding:10,textAlign:'center'}}>
                <div style={{fontSize:10,fontWeight:700,color:f.color,marginBottom:4}}>{f.label}</div>
                <div style={{fontSize:20,fontWeight:800}}>{f.count}</div>
                <div style={{fontSize:10,fontWeight:600,color:f.color}}>{fmtCur(f.totalVal)}</div>
                <div style={{fontSize:8,color:C.muted}}>{totalGeral?(f.totalVal/totalGeral*100).toFixed(0):0}% do total</div>
              </div>)}
            </div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
              <thead><tr style={{background:C.surface}}>
                {['Faixa','Qtd','Vl. Produção','% Total','Média/Parceiro','Digitações','Conversão'].map(h=><th key={h} style={{padding:'6px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}
              </tr></thead>
              <tbody>{faixaData.map(f=><tr key={f.id} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'5px 10px',fontWeight:700,color:f.color}}>{f.label}</td>
                <td style={{padding:'5px 10px',fontWeight:600}}>{f.count} <span style={{color:C.muted,fontWeight:400}}>({ativos.length?(f.count/ativos.length*100).toFixed(0):0}%)</span></td>
                <td style={{padding:'5px 10px',fontWeight:700,color:f.color}}>{fmtCur(f.totalVal)}</td>
                <td style={{padding:'5px 10px'}}>{totalGeral?(f.totalVal/totalGeral*100).toFixed(1):0}%</td>
                <td style={{padding:'5px 10px'}}>{fmtCur(f.avgVal)}</td>
                <td style={{padding:'5px 10px'}}>{f.totalDig}</td>
                <td style={{padding:'5px 10px',fontWeight:600,color:f.cv>=50?C.accent2:f.cv>=30?C.warn:f.cv>0?C.danger:C.muted}}>{f.cv?f.cv.toFixed(0)+'%':'—'}</td>
              </tr>)}</tbody>
            </table></div>

            {/* Top parceiros por faixa */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:14}}>
              {faixaData.filter(f=>f.count>0&&f.id!=='zero').slice(0,3).map(f=><div key={f.id} style={{background:f.bg,border:'1px solid '+f.color+'22',borderRadius:10,padding:12}}>
                <div style={{fontSize:10,fontWeight:700,color:f.color,marginBottom:6}}>{f.label} — Top 5</div>
                {f.parceiros.slice(0,5).map((p,i)=><div key={p.nome} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'2px 0'}}>
                  <span>{i+1}. {p.nome}</span>
                  <span style={{fontWeight:600,color:f.color}}>{fmtCur(p.vr)}</span>
                </div>)}
              </div>)}
            </div>
          </div>
        })()}

        {/* PARCEIROS POR FUNÇÃO */}
        <div className="rg2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>👥 Por Função</div>
            {(()=>{const m={};list.forEach(p=>{const f=p.funcao||'SEM FUNÇÃO';if(!m[f])m[f]={t:0,a:0,d:0,p:0};m[f].t++;if(p.ativo)m[f].a++;const pr=getProd(p.nome);m[f].d+=pr.dig;m[f].p+=pr.prod});return Object.entries(m).sort((a,b)=>b[1].t-a[1].t).map(([f,d])=><div key={f} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'4px 0',borderBottom:'1px solid '+C.border}}>
              <span><Badge text={f} color={f==='AGENTE'?C.accent:f==='INDICADO'?C.info:f==='GERENTE COMERCIAL'?C.accent2:C.muted}/></span>
              <span style={{color:C.muted}}>{d.a}/{d.t} ativos · {d.d} dig · {d.p} prod</span>
            </div>)})()}
          </div>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>📍 Por Supervisor</div>
            {(()=>{const m={};list.filter(p=>p.ativo).forEach(p=>{const s=p.supervisor||'Sem Supervisor';if(!m[s])m[s]={t:0,d:0,p:0};m[s].t++;const pr=getProd(p.nome);m[s].d+=pr.dig;m[s].p+=pr.prod});return Object.entries(m).sort((a,b)=>b[1].p-a[1].p).slice(0,10).map(([s,d])=>{const cv=d.d?(d.p/d.d*100):0;return<div key={s} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'4px 0',borderBottom:'1px solid '+C.border}}>
              <span style={{fontWeight:600}}>{s} <span style={{color:C.muted,fontWeight:400}}>({d.t})</span></span>
              <span>{d.d} dig · {d.p} prod · <span style={{fontWeight:600,color:cv>=50?C.accent2:cv>=30?C.warn:C.danger}}>{cv.toFixed(0)}%</span></span>
            </div>})})()}
          </div>
        </div>
      </div>
    })()}
  </div>
}


/* ═══ HOOK: useOps with custom date support ═══ */
function useOps(defaultPer,myAgents){
  const[per,setPer]=useState(defaultPer||'mes'),[ops,setOps]=useState([]),[loading,setLoading]=useState(false),[count,setCount]=useState(0)
  const[customDf,setCustomDf]=useState(''),[customDt,setCustomDt]=useState(''),[trigger,setTrigger]=useState(0)
  useEffect(()=>{let c=false;setLoading(true);fetchOps(per,n=>{if(!c)setCount(n)},customDf,customDt).then(d=>{if(!c){const fd=myAgents?d.filter(o=>myAgents.has(o.agente)):d;setOps(fd);setCount(fd.length)}}).catch(()=>{}).finally(()=>{if(!c)setLoading(false)});return()=>{c=true}},[per,trigger,myAgents])
  const applyCustom=()=>setTrigger(t=>t+1)
  return{per,setPer,ops,loading,count,customDf,setCustomDf,customDt,setCustomDt,applyCustom}
}
function useProd(defaultPer,myAgents){
  const[per,setPer]=useState(defaultPer||'mes'),[ops,setOps]=useState([]),[digOps,setDigOps]=useState([]),[loading,setLoading]=useState(false)
  const[customDf,setCustomDf]=useState(''),[customDt,setCustomDt]=useState(''),[trigger,setTrigger]=useState(0)
  useEffect(()=>{let c=false;setLoading(true)
    Promise.all([fetchProd(per,null,customDf,customDt),fetchOps(per,null,customDf,customDt)]).then(([p,d])=>{
      if(!c){const fp=myAgents?p.filter(o=>myAgents.has(o.agente)):p;const fd=myAgents?d.filter(o=>myAgents.has(o.agente)):d;setOps(fp);setDigOps(fd)}
    }).catch(()=>{}).finally(()=>{if(!c)setLoading(false)});return()=>{c=true}},[per,trigger,myAgents])
  const applyCustom=()=>setTrigger(t=>t+1)
  return{per,setPer,ops,digOps,loading,customDf,setCustomDf,customDt,setCustomDt,applyCustom}
}

/* ═══ IMPORT MODAL ═══ */
const IMP={id_ext:{l:'ID',a:['id']},banco:{l:'Banco',a:['banco']},cpf:{l:'CPF',a:['cpf']},cliente:{l:'Cliente',a:['cliente','nome']},proposta:{l:'Proposta',a:['proposta']},contrato:{l:'Contrato',a:['contrato','nº contrato','n\u00ba contrato']},data:{l:'Data',a:['data','dat.inclus\u00e3o']},prazo:{l:'Prazo',a:['prazo']},vrBruto:{l:'Bruto',a:['vr. bruto','bruto','vr bruto']},vrParcela:{l:'Parcela',a:['vr. parcela','vr parcela','parcela']},vrLiquido:{l:'Vl.Base',a:['vr. l\u00edquido','vr liquido','vr. liquido','l\u00edquido','liquido']},vrRepasse:{l:'Repasse',a:['vr. repasse','repasse','vr repasse']},vrSeguro:{l:'Seguro',a:['vr. seguro','vr seguro','seguro']},taxa:{l:'Taxa',a:['taxa']},operacao:{l:'Opera\u00e7\u00e3o',a:['opera\u00e7\u00e3o','operacao','opera\u00e7ao','operac\u00e3o']},situacao:{l:'Situa\u00e7\u00e3o',a:['situa\u00e7\u00e3o','situacao','status','situa\u00e7ao','situac\u00e3o']},produto:{l:'Produto',a:['produto']},convenio:{l:'Conv\u00eanio',a:['conv\u00eanio','convenio','conv\u00eanio']},agente:{l:'Agente',a:['agente']},situacaoBanco:{l:'Sit.Banco',a:['situa\u00e7\u00e3o banco','sit. banco','situacao banco']},obsSituacao:{l:'Obs.',a:['obs. situa\u00e7\u00e3o','obs. situa\u00e7\u00e3o banco','obs situac\u00e3o banco','obs. situacao banco','obs situa\u00e7\u00e3o banco']},usuario:{l:'Usu\u00e1rio',a:['usu\u00e1rio','usuario']},crcCliente:{l:'CRC',a:['cr cliente','crc cliente','crc','data crc']},dataNossoCredito:{l:'N.Cr\u00e9dito',a:['nosso cr','nosso cr\u00e9dito','nosso credito']}}

function ImportModal({open,onClose,onImport,onDone}){
  const fr=useRef(null),[step,setStep]=useState(1),[raw,setRaw]=useState([]),[hd,setHd]=useState([]),[mp,setMp]=useState({}),[pv,setPv]=useState([]),[fn,setFn]=useState(''),[busy,setBusy]=useState(false),[progress,setProg]=useState('')
  useEffect(()=>{if(!open){setStep(1);setRaw([]);setHd([]);setMp({});setPv([]);setFn('');setBusy(false);setProg('')}},[open])
  if(!open)return null
  const vc=pv.filter(p=>p._v).length,tR=pv.filter(p=>p._v).reduce((s,o)=>s+(o.vrBruto||0),0)
  return(
    <div style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:18,width:760,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{padding:'16px 22px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between'}}><h3 style={{fontWeight:700,fontSize:15,margin:0}}>Importar — Etapa {step}/3</h3><button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>×</button></div>
        <div style={{padding:'16px 22px'}}>
          {step===1&&<div onClick={()=>fr.current?.click()} style={{border:'2px dashed '+C.border,borderRadius:14,padding:'36px 20px',textAlign:'center',cursor:'pointer',background:C.surface}}><div style={{fontSize:32}}>📂</div><div style={{fontSize:13,fontWeight:600,marginTop:8}}>Clique para selecionar</div><input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const file=e.target.files?.[0];if(!file)return;setFn(file.name);const rd=new FileReader();rd.onload=ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length)return;setRaw(rows);const cols=Object.keys(rows[0]);setHd(cols);const m={};const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,' ').trim();Object.entries(IMP).forEach(([f,def])=>{const exact=cols.find(c=>def.a.some(a=>norm(c)===norm(a)));if(exact){m[f]=exact;return}const found=cols.find(c=>def.a.some(a=>norm(c).includes(norm(a))));if(found)m[f]=found});setMp(m);setStep(2)}catch(ex){alert(ex.message)}};rd.readAsArrayBuffer(file)}} style={{display:'none'}}/></div>}
          {step===2&&<div style={{display:'flex',flexDirection:'column',gap:10}}><div style={{fontSize:12,color:C.muted}}>{fn} — {raw.length} linhas — {Object.keys(mp).length} detectados</div><div className="rg3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>{Object.entries(IMP).map(([f,def])=><div key={f}><label style={{fontSize:8,color:mp[f]?C.accent:C.muted,fontWeight:600}}>{def.l}</label><select value={mp[f]||''} onChange={e=>setMp(p=>({...p,[f]:e.target.value||undefined}))} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:4,fontSize:10,width:'100%'}}><option value="">—</option>{hd.map(h=><option key={h} value={h}>{h}</option>)}</select></div>)}</div><div style={{display:'flex',gap:8}}><button onClick={()=>setStep(1)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'8px 16px',cursor:'pointer'}}>←</button><button onClick={()=>{const built=raw.map(row=>{const cl=mp.cliente?String(row[mp.cliente]||'').trim():'';const pr=mp.proposta?String(row[mp.proposta]||'').trim():'';const ok=!!(cl||pr);const g=f=>mp[f]?String(row[mp[f]]||'').trim():'';const gu=f=>g(f).toUpperCase();return{_v:ok,cliente:cl,proposta:pr,id_ext:g('id_ext'),banco:g('banco'),cpf:g('cpf'),contrato:g('contrato'),data:nDate(mp.data?row[mp.data]:''),prazo:g('prazo'),vrBruto:pNum(mp.vrBruto?row[mp.vrBruto]:''),vrParcela:pNum(mp.vrParcela?row[mp.vrParcela]:''),vrLiquido:pNum(mp.vrLiquido?row[mp.vrLiquido]:''),vrRepasse:pNum(mp.vrRepasse?row[mp.vrRepasse]:''),vrSeguro:pNum(mp.vrSeguro?row[mp.vrSeguro]:''),taxa:g('taxa'),operacao:gu('operacao'),situacao:gu('situacao'),produto:g('produto'),convenio:gu('convenio'),agente:g('agente'),situacaoBanco:gu('situacaoBanco'),obsSituacao:g('obsSituacao'),usuario:g('usuario'),crcCliente:nDate(mp.crcCliente?row[mp.crcCliente]:''),dataNossoCredito:nDate(mp.dataNossoCredito?row[mp.dataNossoCredito]:'')}});setPv(built);setStep(3)}} style={{flex:1,background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Revisar →</button></div></div>}
          {step===3&&<div style={{display:'flex',flexDirection:'column',gap:10}}><div style={{fontSize:12}}><strong style={{color:C.accent2}}>{vc}</strong> válidas — {fmtCur(tR)}</div>{progress&&<div style={{fontSize:11,color:C.warn}}>{progress}</div>}<div style={{overflowX:'auto',maxHeight:260,borderRadius:8,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}><thead><tr style={{background:C.surface}}>{['','Cliente','Banco','Sit.','Agente','Vl.Base'].map(h=><th key={h} style={{padding:'5px 7px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{pv.slice(0,40).map((p,i)=><tr key={i} style={{borderBottom:'1px solid '+C.border,opacity:p._v?1:.3}}><td style={{padding:'3px 7px',color:p._v?C.accent2:C.danger}}>{p._v?'✓':'✕'}</td><td style={{padding:'3px 7px'}}>{p.cliente}</td><td style={{padding:'3px 7px'}}>{p.banco}</td><td style={{padding:'3px 7px'}}>{p.situacao}</td><td style={{padding:'3px 7px'}}>{p.agente}</td><td style={{padding:'3px 7px',fontWeight:600}}>{fmtCur(p.vrBruto)}</td></tr>)}</tbody></table></div><div style={{display:'flex',gap:8}}><button onClick={()=>setStep(2)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'8px 16px',cursor:'pointer'}}>←</button><button onClick={async()=>{setBusy(true);const valid=pv.filter(p=>p._v).map(({_v,...r})=>r);const total=valid.length;let ok=0,fail=0;for(let i=0;i<total;i+=200){const batch=valid.slice(i,i+200);setProg(`Gravando ${Math.min(i+200,total)}/${total}...`);try{await onImport(batch);ok+=batch.length}catch(e){fail+=batch.length;console.error('Batch err:',e)}if(i+50<total)await new Promise(r=>setTimeout(r,200))}setProg(fail?`✓ ${ok} gravados, ${fail} falharam`:`✓ ${ok} gravados!`);await new Promise(r=>setTimeout(r,1500));setBusy(false);setProg('');if(onDone)onDone();onClose()}} disabled={!vc||busy} style={{flex:1,background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',opacity:(!vc||busy)?.4:1}}>{busy?progress||'Gravando...':'✓ Importar '+vc}</button></div></div>}
        </div>
      </div>
    </div>
  )
}

/* ═══ PARTNER HEALTH MODAL ═══ */
function PartnerHealth({name,ops,onClose}){
  if(!name)return null
  const al=ops.filter(o=>o.agente===name)
  const fin=al.filter(isFin),est=al.filter(isEst),pend=al.filter(isPend)
  const r=al.reduce((s,o)=>s+(o.vrBruto||0),0),fR=fin.reduce((s,o)=>s+(o.vrBruto||0),0),eR=est.reduce((s,o)=>s+(o.vrBruto||0),0)
  const cv=al.length?(fin.length/al.length*100):0,estP=al.length?(est.length/al.length*100):0
  const bB={};al.forEach(o=>{const k=o.banco||'?';if(!bB[k])bB[k]={c:0,r:0,f:0};bB[k].c++;bB[k].r+=(o.vrBruto||0);if(isFin(o))bB[k].f++})
  const bO={};al.forEach(o=>{const k=o.operacao||'?';if(!bO[k])bO[k]={c:0,r:0,f:0};bO[k].c++;bO[k].r+=(o.vrBruto||0);if(isFin(o))bO[k].f++})
  const bS={};al.forEach(o=>{const k=o.situacao||'?';if(!bS[k])bS[k]={c:0,r:0};bS[k].c++;bS[k].r+=(o.vrBruto||0)})
  const health=cv>=60?'🟢 Excelente':cv>=40?'🟡 Bom':cv>=25?'🟠 Regular':'🔴 Crítico'
  const hColor=cv>=60?C.accent2:cv>=40?C.warn:cv>=25?'#F97316':C.danger
  return(
    <div style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:18,width:800,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{padding:'16px 22px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><h3 style={{fontWeight:700,fontSize:17,margin:0}}>{name}</h3><div style={{fontSize:12,color:hColor,fontWeight:700,marginTop:2}}>{health} — Conversão {cv.toFixed(0)}%</div></div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}><ExportBtn ops={al} name={'parceiro-'+name}/><button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>×</button></div>
        </div>
        <div style={{padding:'16px 22px',display:'flex',flexDirection:'column',gap:14}}>
          <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Stat label="Total" value={al.length} small/><Stat label="Vl.Base" value={fmtCur(r)} color={C.accent} small/>
            <Stat label="Pagas" value={fin.length} sub={fmtCur(fR)} color={C.accent2} small/>
            <Stat label="Em Andamento" value={pend.length} sub={fmtCur(pend.reduce((s,o)=>s+(o.vrBruto||0),0))} color={C.warn} small/>
            <Stat label="Estornos" value={est.length} sub={estP.toFixed(0)+'%'} color={C.danger} small/>
          </div>
          <div className="rg3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div style={{background:C.surface,border:'1px solid '+C.border,borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>Por Banco</div>
              {Object.entries(bB).sort((a,b)=>b[1].r-a[1].r).map(([b,d])=><div key={b} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0'}}><span>{b} ({d.c})</span><span style={{color:C.accent,fontWeight:600}}>{fmtCur(d.r)}</span></div>)}
            </div>
            <div style={{background:C.surface,border:'1px solid '+C.border,borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>Por Operação</div>
              {Object.entries(bO).sort((a,b)=>b[1].r-a[1].r).map(([o,d])=><div key={o} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0'}}><span>{o} ({d.c})</span><span style={{color:C.accent,fontWeight:600}}>{fmtCur(d.r)}</span></div>)}
            </div>
            <div style={{background:C.surface,border:'1px solid '+C.border,borderRadius:12,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:8}}>Por Situação</div>
              {Object.entries(bS).sort((a,b)=>b[1].c-a[1].c).map(([s,d])=><div key={s} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0'}}><Badge text={s} color={sitCol(s)}/><span style={{fontWeight:600}}>{d.c} · {fmtCur(d.r)}</span></div>)}
            </div>
          </div>
          <div style={{background:C.surface,border:'1px solid '+C.accent+'33',borderRadius:12,padding:14}}>
            <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:6}}>📌 Diagnóstico</div>
            <div style={{fontSize:11,display:'flex',flexDirection:'column',gap:4}}>
              {cv>=60&&<div style={{color:C.accent2}}>✓ Alta conversão — parceiro estratégico</div>}
              {cv>=40&&cv<60&&<div style={{color:C.warn}}>⚠ Conversão mediana — acompanhar</div>}
              {cv<40&&al.length>5&&<div style={{color:C.danger}}>🔴 Conversão baixa ({cv.toFixed(0)}%) — AÇÃO URGENTE</div>}
              {estP>25&&<div style={{color:C.danger}}>🔴 {est.length} estornos ({estP.toFixed(0)}%) — investigar</div>}
              {estP<=10&&al.length>5&&<div style={{color:C.accent2}}>✓ Baixo estorno ({estP.toFixed(0)}%)</div>}
              {pend.length>0&&<div style={{color:C.info}}>📋 {pend.length} propostas em andamento ({fmtCur(pend.reduce((s,o)=>s+(o.vrBruto||0),0))})</div>}
              {Object.entries(bB).length>0&&<div>🏦 Principal: <strong>{Object.entries(bB).sort((a,b)=>b[1].r-a[1].r)[0][0]}</strong></div>}
              {Object.entries(bO).length>0&&<div>⚡ Foco: <strong>{Object.entries(bO).sort((a,b)=>b[1].r-a[1].r)[0][0]}</strong></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══ DASHBOARD ═══ */
function Dashboard({curOps,prevOps,curProd,prevProd,prevProdProp,m2Prop,m3Prop,myAgents,prodYear,dash,dailyData,monthlyData,bizDays,propComp,weekCur,weekPrev,bankWeekCur,bankWeekPrev,bankMonthly}){
  const{per,setPer,ops,loading,count,customDf,setCustomDf,customDt,setCustomDt,applyCustom}=useOps('mes',myAgents)
  const[selP,setSelP]=useState(null)
  // CIP próximos 5 dias úteis (com e sem data esperada)
  const[cipNext,setCipNext]=useState([])
  const[cipSemData,setCipSemData]=useState([])  // aguardando CIP sem data prevista
  const[cipExpiradas,setCipExpiradas]=useState(0)  // pendências sem atividade +60d (ocultas)
  useEffect(()=>{
    (async()=>{
      const today=new Date()
      const in14=new Date(today);in14.setDate(in14.getDate()+14)
      const toISO=d=>d.toISOString().slice(0,10)
      // Quali com data — usa view enriched pra trazer parceiro_nome
      let qQ1=supabase.from('portabilidades_enriched').select('id,borrower_name,origin_bank_name,origin_due_balance,origin_due_balance_expected_date,origin_due_balance_returned,borrower_identity,parceiro_nome').gte('origin_due_balance_expected_date',toISO(today)).lte('origin_due_balance_expected_date',toISO(in14)).eq('origin_due_balance_returned',false).limit(500)
      const{data:q1}=await qQ1
      // Consig360 com data
      const{data:q2}=await supabase.from('consig_proposals').select('id,title,contract_bank_name,bank_name,value,debit_balance,expected_balance_date,partner_status_text,client_cpf,squad_user_name').gte('expected_balance_date',toISO(today)).lte('expected_balance_date',toISO(in14)).in('partner_status_text',['Aguardando Saldo CIP','Aguardando Finalização da portabilidade','Aguardando documentação','Pendente de Formalização']).limit(500)
      const merged=[
        ...(q1||[]).map(r=>({date:String(r.origin_due_balance_expected_date).slice(0,10),client:r.borrower_name,bank:r.origin_bank_name,value:Number(r.origin_due_balance||0),cpf:r.borrower_identity,parceiro:r.parceiro_nome||null,source:'quali'})),
        ...(q2||[]).map(r=>({date:String(r.expected_balance_date).slice(0,10),client:r.title,bank:r.contract_bank_name||r.bank_name,value:Number(r.debit_balance||r.value||0),cpf:r.client_cpf,parceiro:r.squad_user_name,source:'consig360'}))
      ]
      setCipNext(merged)
      // Aguardando sem data
      const{data:q3a}=await supabase.from('portabilidades_enriched').select('id,borrower_name,origin_bank_name,origin_due_balance,origin_due_balance_returned,borrower_identity,parceiro_nome,status_key,status_date').is('origin_due_balance_expected_date',null).eq('origin_due_balance_returned',false).in('status_key',['awaiting_portability','awaiting_formalization','awaiting_cip','documents_not_found','accepted','proposal_cadastrada']).limit(3000)
      const{data:q3b}=await supabase.from('consig_proposals').select('id,title,contract_bank_name,bank_name,value,debit_balance,partner_status_text,client_cpf,squad_user_name,updated_at_api,created_at_api').is('expected_balance_date',null).in('partner_status_text',['Aguardando Saldo CIP','Aguardando Finalização da portabilidade']).limit(3000)
      const semData=[
        ...(q3a||[]).map(r=>({client:r.borrower_name,bank:r.origin_bank_name,value:Number(r.origin_due_balance||0),cpf:r.borrower_identity,parceiro:r.parceiro_nome||null,status:r.status_key,source:'quali',_old:isOldPend(r.status_date)})),
        ...(q3b||[]).map(r=>({client:r.title,bank:r.contract_bank_name||r.bank_name,value:Number(r.debit_balance||r.value||0),cpf:r.client_cpf,parceiro:r.squad_user_name,status:r.partner_status_text,source:'consig360',_old:isOldPend(r.updated_at_api||r.created_at_api)}))
      ]
      setCipSemData(semData.filter(x=>!x._old))
      setCipExpiradas(semData.filter(x=>x._old).length)
    })()
  },[myAgents])
  // Use fast RPC data when available, fallback to computed
  const f=ops,tR=f.reduce((s,o)=>s+(o.vrBruto||0),0)
  const fin=f.filter(isFin),fR=fin.reduce((s,o)=>s+(o.vrBruto||0),0)
  const est=f.filter(isEst),pend=f.filter(isPend)
  const ags=[...new Set(f.map(o=>o.agente).filter(Boolean))]
  const bySit={};f.forEach(o=>{const k=o.situacao||'?';if(!bySit[k])bySit[k]={c:0,r:0};bySit[k].c++;bySit[k].r+=(o.vrBruto||0)})
  const sitArr=Object.entries(bySit).sort((a,b)=>b[1].c-a[1].c)
  const topM={};f.forEach(o=>{const a=o.agente||'?';if(!topM[a])topM[a]={r:0,c:0,fc:0,fr:0};topM[a].r+=(o.vrBruto||0);topM[a].c++;if(isFin(o)){topM[a].fc++;topM[a].fr+=(o.vrBruto||0)}})
  const topP=Object.entries(topM).sort((a,b)=>b[1].fr-a[1].fr).slice(0,10)
  const DAY=NOW.getDate()
  const curDig=curOps.length,prevDig=prevOps.length,varDig=prevDig?((curDig-prevDig)/prevDig*100):(curDig>0?100:0)
  // Projeção by CRC
  const proj=getProj(curProd),pctDU=proj.duT?(proj.duP/proj.duT*100):0
  // Por banco — PRODUÇÃO (finalizados)
  const byBanco={};curProd.forEach(o=>{const k=o.banco||'?';if(!byBanco[k])byBanco[k]={c:0,r:0};byBanco[k].c++;byBanco[k].r+=(o.vrBruto||0)})
  const bancoArr=Object.entries(byBanco).sort((a,b)=>b[1].r-a[1].r).slice(0,10)
  const vc=(v)=>v>0?'+'+v.toFixed(0)+'%':v.toFixed(0)+'%'
  const vCol=(v)=>v>0?C.accent2:v<-10?C.danger:C.warn
  const mName=(back)=>{const d=new Date(NOW.getFullYear(),NOW.getMonth()-back,1);return d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}
  // HOJE + ONTEM — prefer fast RPC data
  const now=new Date()
  const TODAY_STR=localDate(now)
  // Comparativo proporcional from RPC
  const curProdR=dash?Number(dash.prod_total):curProd.reduce((s,o)=>s+(o.vrBruto||0),0)
  const prevPropR=propComp?.m1?Number(propComp.m1.total):((prevProdProp||[]).reduce((s,o)=>s+(o.vrBruto||0),0))
  const m2PropR=propComp?.m2?Number(propComp.m2.total):((m2Prop||[]).reduce((s,o)=>s+(o.vrBruto||0),0))
  const m3PropR=propComp?.m3?Number(propComp.m3.total):((m3Prop||[]).reduce((s,o)=>s+(o.vrBruto||0),0))
  const prevProdR=prevProd.reduce((s,o)=>s+(o.vrBruto||0),0)
  const varProp=prevPropR?((curProdR-prevPropR)/prevPropR*100):(curProdR>0?100:0)
  const varM2=m2PropR?((curProdR-m2PropR)/m2PropR*100):(curProdR>0?100:0)
  const varM3=m3PropR?((curProdR-m3PropR)/m3PropR*100):(curProdR>0?100:0)
  // Prod by situação
  const prodBySit={};curProd.forEach(o=>{const k=o.situacao||'?';if(!prodBySit[k])prodBySit[k]={c:0,r:0};prodBySit[k].c++;prodBySit[k].r+=(o.vrBruto||0)})

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <h2 style={{fontWeight:800,fontSize:20}}>Dashboard</h2>
      {myAgents&&<div style={{background:C.accent+'18',border:'1px solid '+C.accent+'66',borderRadius:10,padding:'10px 14px',fontSize:12,color:C.accent,fontWeight:600}}>👥 Visão restrita à equipe — {myAgents.size} parceiros · {[...myAgents].slice(0,5).join(', ')}{myAgents.size>5?` +${myAgents.size-5}`:''}</div>}
      <PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/>
      <div style={{fontSize:10,color:C.muted}}>{dash?`${dash.dig_count} digitações · ${dash.prod_count} produção`:count+' digitações no período'}{myAgents?' · filtrado por equipe':''}</div>

      {/* ÚLTIMOS 5 DIAS ÚTEIS — se visão restrita (myAgents), calcula localmente a partir de ops já filtrado */}
      {(()=>{
        let daysToShow=bizDays
        if(myAgents){
          // Calcula localmente os últimos 5 dias úteis a partir de ops (curOps/digitações filtradas)
          const days=[];const d=new Date()
          while(days.length<5){
            if(d.getDay()!==0&&d.getDay()!==6)days.push(localDate(d))
            d.setDate(d.getDate()-1)
          }
          daysToShow=days.map(dt=>{
            const dayOps=ops.filter(o=>(o.data||'').slice(0,10)===dt)
            const total_val=dayOps.reduce((s,o)=>s+(o.vrBruto||0),0)
            const parcMap={};dayOps.forEach(o=>{const a=o.agente||'?';if(!parcMap[a])parcMap[a]={qtd:0,total:0};parcMap[a].qtd++;parcMap[a].total+=(o.vrBruto||0)})
            const top_parceiros=Object.entries(parcMap).map(([nome,v])=>({nome,...v})).sort((a,b)=>b.total-a.total).slice(0,5)
            const banMap={};dayOps.forEach(o=>{const b=o.banco||'?';if(!banMap[b])banMap[b]={qtd:0,total:0};banMap[b].qtd++;banMap[b].total+=(o.vrBruto||0)})
            const top_bancos=Object.entries(banMap).map(([nome,v])=>({nome,...v})).sort((a,b)=>b.total-a.total).slice(0,5)
            return{date:dt,total_dig:dayOps.length,total_val,parceiros:Object.keys(parcMap).length,top_parceiros,top_bancos}
          })
        }
        if(daysToShow.length===0)return null
        return<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {daysToShow.map((d,i)=>{const dt=new Date(d.date+'T12:00:00');const isToday=d.date===TODAY_STR;const label=dt.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','');const hasMov=d.total_dig>0;return<div key={d.date} style={{background:C.card,border:'1px solid '+(isToday?C.accent2+'66':C.border),borderRadius:12,padding:12,opacity:hasMov?1:.5}}>
            <div style={{fontSize:10,fontWeight:700,color:isToday?C.accent2:C.info,marginBottom:6}}>{isToday?'🟢 Hoje':'📋'} {label}</div>
            <div style={{fontSize:16,fontWeight:800,color:hasMov?C.accent:C.muted}}>{fmtCur(d.total_val||0)}</div>
            <div style={{fontSize:10,color:C.muted}}>{d.total_dig||0} digitações · {d.parceiros||0} parceiros</div>
          </div>})}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:10}}>
          {daysToShow.filter(d=>d.total_dig>0).slice(0,3).map(d=>{const dt=new Date(d.date+'T12:00:00');const isToday=d.date===TODAY_STR;return<div key={d.date} style={{background:C.card,border:'1px solid '+(isToday?C.accent2+'33':C.border),borderRadius:14,padding:14}}>
            <div style={{fontSize:11,fontWeight:700,color:isToday?C.accent2:C.info,marginBottom:8}}>{isToday?'🟢 Hoje':'📋'} — {fmtDate(d.date)} · {fmtCur(d.total_val||0)}</div>
            {d.top_parceiros&&<div style={{marginBottom:8}}><div style={{fontSize:9,fontWeight:600,color:C.muted,marginBottom:3}}>Top Parceiros</div>
              {d.top_parceiros.map((p,j)=><div key={p.nome} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'1px 0'}}><span style={{color:j<3?C.accent:C.text}}>{j+1}. {p.nome} ({p.qtd})</span><span style={{fontWeight:600,color:C.accent2}}>{fmtCur(p.total)}</span></div>)}</div>}
            {d.top_bancos&&<div><div style={{fontSize:9,fontWeight:600,color:C.muted,marginBottom:3}}>Bancos</div>
              {d.top_bancos.map(b=><div key={b.nome} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'1px 0'}}><span>{b.nome} ({b.qtd})</span><span style={{fontWeight:600,color:C.accent}}>{fmtCur(b.total)}</span></div>)}</div>}
          </div>})}
        </div>
      </>
      })()}

      {/* PRÓXIMOS 5 DIAS ÚTEIS — CIP a Retornar */}
      {(cipNext.length>0||cipSemData.length>0)&&(()=>{
        // Filtro de equipe: aplica AQUI no render para garantir que myAgents já está populado
        const teamFlt=arr=>myAgents?arr.filter(r=>r.parceiro&&myAgents.has(r.parceiro)):arr
        const cipNextF=teamFlt(cipNext)
        const cipSemDataF=teamFlt(cipSemData)
        const next5=[];const d=new Date(NOW);d.setDate(d.getDate()+1)
        while(next5.length<5){if(d.getDay()!==0&&d.getDay()!==6)next5.push(localDate(d));d.setDate(d.getDate()+1)}
        const byDay={};next5.forEach(dt=>byDay[dt]={items:[],total:0})
        cipNextF.forEach(c=>{if(byDay[c.date]){byDay[c.date].items.push(c);byDay[c.date].total+=c.value}})
        const totalCip=Object.values(byDay).reduce((s,d)=>s+d.total,0)
        const totalCount=Object.values(byDay).reduce((s,d)=>s+d.items.length,0)
        // Aguardando sem data - agrupar por cliente (CPF) para aglutinar duplicadas
        const byCliAgg={}
        cipSemDataF.forEach(c=>{const k=c.cpf||c.client;if(!byCliAgg[k])byCliAgg[k]={client:c.client,parceiro:c.parceiro,bank:c.bank,value:0,count:0,status:c.status};byCliAgg[k].value+=c.value;byCliAgg[k].count++})
        const totalSemData=Object.values(byCliAgg).reduce((s,c)=>s+c.value,0)
        // Agrupa por parceiro
        const byParc={}
        Object.values(byCliAgg).forEach(c=>{const p=c.parceiro||'(Sem parceiro)';if(!byParc[p])byParc[p]={parceiro:p,clients:[],total:0};byParc[p].clients.push(c);byParc[p].total+=c.value})
        const parceiros=Object.values(byParc).sort((a,b)=>b.total-a.total)
        return<div style={{background:C.card,border:'2px solid '+C.warn+'66',borderRadius:14,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:6}}>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:C.warn}}>⏳ CIP a Retornar — Próximos 5 Dias Úteis</div>
              <div style={{fontSize:10,color:C.muted}}>Saldos aguardando retorno da Câmara{cipExpiradas>0?` · 🗄️ ${cipExpiradas} antigas ocultas (+${OLD_PEND_DAYS}d sem atividade)`:''}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10,color:C.muted}}>Total esperado</div>
              <div style={{fontSize:16,fontWeight:700,color:C.warn}}>{fmtCur(totalCip+totalSemData)}</div>
              <div style={{fontSize:10,color:C.muted}}>{totalCount+Object.keys(byCliAgg).length} clientes</div>
            </div>
          </div>
          {/* Grid com dias */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:12}}>
            {next5.map(dt=>{const d=byDay[dt];const dtObj=new Date(dt+'T12:00:00');const label=dtObj.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','');const has=d.items.length>0;return<div key={dt} style={{background:has?C.warn+'15':C.surface,border:'1px solid '+(has?C.warn+'44':C.border),borderRadius:12,padding:10,opacity:has?1:.5}}>
              <div style={{fontSize:10,fontWeight:700,color:C.warn,marginBottom:4,textTransform:'capitalize'}}>{label}</div>
              <div style={{fontSize:16,fontWeight:800,color:has?C.warn:C.muted}}>{d.items.length}</div>
              <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{fmtCur(d.total)}</div>
              {d.items.length>0&&<div style={{marginTop:6,fontSize:9,maxHeight:80,overflowY:'auto'}}>
                {d.items.slice(0,4).map((c,i)=><div key={i} style={{padding:'2px 0',borderTop:i>0?'1px solid '+C.border:'none'}}>
                  <div style={{fontWeight:600,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.client}</div>
                  <div style={{color:C.muted,fontSize:8}}>{c.bank||'—'}</div>
                  <div style={{fontWeight:600,color:C.warn,fontSize:9}}>{fmtCur(c.value)}</div>
                </div>)}
                {d.items.length>4&&<div style={{marginTop:3,color:C.accent,fontSize:9,fontWeight:600}}>+{d.items.length-4} mais...</div>}
              </div>}
            </div>})}
          </div>
          {/* Lista sem data esperada — agrupado por parceiro */}
          {parceiros.length>0&&<div style={{marginTop:10,background:C.surface,borderRadius:10,padding:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8}}>📋 Aguardando (sem data prevista) — {Object.keys(byCliAgg).length} clientes · {fmtCur(totalSemData)}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>
              {parceiros.slice(0,12).map(pr=><div key={pr.parceiro} style={{background:C.card,border:'1px solid '+C.border,borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:10,fontWeight:700,color:C.accent,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pr.parceiro}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                  <div style={{fontSize:16,fontWeight:800}}>{pr.clients.length}</div>
                  <div style={{fontSize:10,color:C.muted}}>cliente{pr.clients.length>1?'s':''}</div>
                </div>
                <div style={{fontSize:11,fontWeight:600,color:C.warn}}>{fmtCur(pr.total)}</div>
              </div>)}
            </div>
          </div>}
        </div>
      })()}

      {/* ANÁLISE SEMANAL — Parceiros */}
      {weekCur.length>0&&(()=>{
        const prevMap={};(weekPrev||[]).forEach(p=>{prevMap[p.agente]={dig:Number(p.dig_count),val:Number(p.dig_total)}})
        const rows=weekCur.map(p=>{
          const dig=Number(p.dig_count),val=Number(p.dig_total),prod=Number(p.prod_count),prodVal=Number(p.prod_total)
          const prev=prevMap[p.agente]||{dig:0,val:0}
          const var_dig=prev.dig?((dig-prev.dig)/prev.dig*100):(dig>0?100:0)
          return{nome:p.agente,dig,val,prod,prodVal,prevDig:prev.dig,prevVal:prev.val,var_dig}
        }).filter(r=>r.dig>0||r.prevDig>0).sort((a,b)=>a.var_dig-b.var_dig)
        const caindo=rows.filter(r=>r.var_dig<0)
        const subindo=rows.filter(r=>r.var_dig>0).sort((a,b)=>b.var_dig-a.var_dig)
        const inativos=(weekPrev||[]).filter(p=>{const c=weekCur.find(c=>c.agente===p.agente);return(!c||Number(c.dig_count)===0)&&Number(p.dig_count)>0}).map(p=>({nome:p.agente,prevDig:Number(p.dig_count),prevVal:Number(p.dig_total)}))
        const totalCur=weekCur.reduce((s,p)=>s+Number(p.dig_total),0)
        const totalPrev=(weekPrev||[]).reduce((s,p)=>s+Number(p.dig_total),0)
        const varTotal=totalPrev?((totalCur-totalPrev)/totalPrev*100):(totalCur>0?100:0)
        return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
            <div><div style={{fontSize:14,fontWeight:800}}>📊 Análise Semanal</div><div style={{fontSize:10,color:C.muted}}>Semana atual vs anterior</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:10,color:C.muted}}>Total semana</div><div style={{fontSize:16,fontWeight:700}}>{fmtCur(totalCur)}</div><div style={{fontSize:10,fontWeight:600,color:varTotal>0?C.accent2:varTotal<0?C.danger:C.muted}}>{varTotal>0?'+':''}{varTotal.toFixed(0)}% vs anterior ({fmtCur(totalPrev)})</div></div>
          </div>
          <div className="rg2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{background:C.danger+'08',border:'1px solid '+C.danger+'22',borderRadius:10,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.danger,marginBottom:6}}>🔻 Digitando Menos ({caindo.length})</div>
              {caindo.length===0?<div style={{fontSize:10,color:C.muted}}>Nenhum parceiro caiu</div>:
              <div style={{maxHeight:200,overflowY:'auto'}}>{caindo.slice(0,15).map(r=><div key={r.nome} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'3px 0',borderBottom:'1px solid '+C.border}}>
                <span style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nome}</span>
                <span><span style={{fontWeight:700,color:C.danger}}>{fmtCur(r.val)}</span> <span style={{color:C.muted,fontSize:8}}>({r.dig} dig)</span> <span style={{color:C.danger,fontWeight:600}}>{r.var_dig.toFixed(0)}%</span></span>
              </div>)}</div>}
            </div>
            <div style={{background:C.accent2+'08',border:'1px solid '+C.accent2+'22',borderRadius:10,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent2,marginBottom:6}}>🔺 Digitando Mais ({subindo.length})</div>
              {subindo.length===0?<div style={{fontSize:10,color:C.muted}}>Nenhum parceiro subiu</div>:
              <div style={{maxHeight:200,overflowY:'auto'}}>{subindo.slice(0,15).map(r=><div key={r.nome} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'3px 0',borderBottom:'1px solid '+C.border}}>
                <span style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.nome}</span>
                <span><span style={{fontWeight:700,color:C.accent2}}>{fmtCur(r.val)}</span> <span style={{color:C.muted,fontSize:8}}>({r.dig} dig)</span> <span style={{color:C.accent2,fontWeight:600}}>+{r.var_dig.toFixed(0)}%</span></span>
              </div>)}</div>}
            </div>
          </div>
          {inativos.length>0&&<div style={{marginTop:10,background:C.warn+'08',border:'1px solid '+C.warn+'22',borderRadius:10,padding:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.warn,marginBottom:6}}>⚠ Pararam esta semana ({inativos.length})</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{inativos.slice(0,20).map(r=><span key={r.nome} style={{fontSize:9,background:C.warn+'15',border:'1px solid '+C.warn+'33',borderRadius:6,padding:'2px 8px'}}>{r.nome} <span style={{color:C.muted}}>({fmtCur(r.prevVal)})</span></span>)}</div>
          </div>}
        </div>
      })()}

      {/* VISÃO POR BANCO — Diária, Semanal, Mensal */}
      {(bankWeekCur.length>0||bankMonthly.length>0)&&(()=>{
        // Semanal por banco
        const prevBankMap={};(bankWeekPrev||[]).forEach(b=>{prevBankMap[b.banco]={dig:Number(b.dig_count),val:Number(b.dig_total)}})
        const bankRows=bankWeekCur.map(b=>{
          const val=Number(b.dig_total),dig=Number(b.dig_count),prod=Number(b.prod_total),prodC=Number(b.prod_count)
          const prev=prevBankMap[b.banco]||{dig:0,val:0}
          const varVal=prev.val?((val-prev.val)/prev.val*100):(val>0?100:0)
          return{banco:b.banco,val,dig,prod,prodC,prevVal:prev.val,prevDig:prev.dig,varVal}
        }).sort((a,b)=>b.val-a.val)
        // Mensal por banco — pivot
        const meses=[...new Set(bankMonthly.map(r=>r.mes))].sort()
        const bancoSet=[...new Set(bankMonthly.map(r=>r.banco))]
        const bancoTotals={};bankMonthly.forEach(r=>{bancoTotals[r.banco]=(bancoTotals[r.banco]||0)+Number(r.dig_total)})
        const topBancos=Object.entries(bancoTotals).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([b])=>b)
        const monthMap={};bankMonthly.forEach(r=>{monthMap[r.mes+'|'+r.banco]=Number(r.dig_total)})
        const mLabels=meses.map(m=>{const[y,mo]=m.split('-');return new Date(y,mo-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()})

        return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>🏦 Visão por Banco</div>

          {/* SEMANAL */}
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Semana Atual vs Anterior</div>
          <div style={{overflowX:'auto',marginBottom:16}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
              <thead><tr style={{background:C.surface}}>
                {['Banco','Vl. Digitado','Dig.','Produção','Sem. Anterior','Var.'].map(h=><th key={h} style={{padding:'6px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}
              </tr></thead>
              <tbody>{bankRows.slice(0,12).map(r=><tr key={r.banco} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'5px 10px',fontWeight:600}}>{r.banco}</td>
                <td style={{padding:'5px 10px',fontWeight:700,color:C.accent}}>{fmtCur(r.val)}</td>
                <td style={{padding:'5px 10px',color:C.muted}}>{r.dig}</td>
                <td style={{padding:'5px 10px',fontWeight:600,color:r.prodC?C.accent2:C.muted}}>{r.prodC?fmtCur(r.prod):'—'}</td>
                <td style={{padding:'5px 10px',color:C.muted}}>{r.prevVal?fmtCur(r.prevVal):'—'}</td>
                <td style={{padding:'5px 10px',fontWeight:700,color:r.varVal>0?C.accent2:r.varVal<0?C.danger:C.muted}}>{r.prevVal?((r.varVal>0?'+':'')+r.varVal.toFixed(0)+'%'):'novo'}</td>
              </tr>)}</tbody>
            </table>
          </div>

          {/* MENSAL — tabela pivot */}
          {meses.length>1&&<>
            <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Evolução Mensal (Top 8 Bancos)</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                <thead><tr style={{background:C.surface}}>
                  <th style={{padding:'6px 10px',textAlign:'left',color:C.muted,fontSize:8}}>BANCO</th>
                  {mLabels.map((l,i)=><th key={i} style={{padding:'6px 10px',textAlign:'right',color:i===mLabels.length-1?C.accent:C.muted,fontSize:8}}>{l}</th>)}
                  <th style={{padding:'6px 10px',textAlign:'right',color:C.muted,fontSize:8}}>TOTAL</th>
                </tr></thead>
                <tbody>{topBancos.map(banco=><tr key={banco} style={{borderBottom:'1px solid '+C.border}}>
                  <td style={{padding:'5px 10px',fontWeight:600,whiteSpace:'nowrap'}}>{banco}</td>
                  {meses.map((m,i)=>{const v=monthMap[m+'|'+banco]||0;return<td key={m} style={{padding:'5px 10px',textAlign:'right',fontWeight:i===meses.length-1?700:400,color:v?C.text:C.muted}}>{v?fmtCur(v):'—'}</td>})}
                  <td style={{padding:'5px 10px',textAlign:'right',fontWeight:700,color:C.accent}}>{fmtCur(bancoTotals[banco]||0)}</td>
                </tr>)}</tbody>
                <tfoot><tr style={{background:C.surface}}>
                  <td style={{padding:'6px 10px',fontWeight:700}}>TOTAL</td>
                  {meses.map(m=>{const t=bankMonthly.filter(r=>r.mes===m).reduce((s,r)=>s+Number(r.dig_total),0);return<td key={m} style={{padding:'6px 10px',textAlign:'right',fontWeight:700}}>{fmtCur(t)}</td>})}
                  <td style={{padding:'6px 10px',textAlign:'right',fontWeight:700,color:C.accent2}}>{fmtCur(Object.values(bancoTotals).reduce((s,v)=>s+v,0))}</td>
                </tr></tfoot>
              </table>
            </div>
          </>}
        </div>
      })()}

      {/* COMPARATIVO PROPORCIONAL — até dia {DAY} — 3 meses */}
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>📊 Produção até dia {DAY} — Comparativo</div>
        <div style={{fontSize:10,color:C.muted,marginBottom:12}}>CRC Cliente até o dia {DAY} de cada mês (dias úteis: {proj.duP}/{proj.duT})</div>
        <div className="rg4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          <div style={{background:C.surface,borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:8,color:C.accent,fontWeight:700}}>MÊS ATUAL</div><div style={{fontSize:18,fontWeight:700,color:C.accent2}}>{fmtCur(curProdR)}</div><div style={{fontSize:9,color:C.muted}}>{curProd.length} ops</div></div>
          <div style={{background:C.surface,borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>{mName(1)} até dia {DAY}</div><div style={{fontSize:18,fontWeight:700}}>{fmtCur(prevPropR)}</div><div style={{fontSize:10,fontWeight:600,color:vCol(varProp)}}>{vc(varProp)}</div></div>
          <div style={{background:C.surface,borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>{mName(2)} até dia {DAY}</div><div style={{fontSize:18,fontWeight:700}}>{fmtCur(m2PropR)}</div><div style={{fontSize:10,fontWeight:600,color:vCol(varM2)}}>{vc(varM2)}</div></div>
          <div style={{background:C.surface,borderRadius:10,padding:12,textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>{mName(3)} até dia {DAY}</div><div style={{fontSize:18,fontWeight:700}}>{fmtCur(m3PropR)}</div><div style={{fontSize:10,fontWeight:600,color:vCol(varM3)}}>{vc(varM3)}</div></div>
        </div>
        <div style={{marginTop:8,fontSize:9,color:C.muted}}>Total {mName(1)}: {fmtCur(prevProdR)} ({prevProd.length} ops) · Digitações mês: {curDig} ({vc(varDig)} vs ant.)</div>
        {Object.keys(prodBySit).length>0&&<div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}>{Object.entries(prodBySit).sort((a,b)=>b[1].r-a[1].r).map(([s,d])=><div key={s} style={{background:C.bg,borderRadius:8,padding:'6px 12px',border:'1px solid '+C.border}}><div style={{fontSize:8,color:C.accent2,fontWeight:600}}>{s}</div><div style={{fontSize:12,fontWeight:700}}>{fmtCur(d.r)}</div><div style={{fontSize:8,color:C.muted}}>{d.c} ops</div></div>)}</div>}
      </div>

      {/* PROJEÇÃO — com digitações */}
      <div style={{background:C.card,border:'1px solid '+C.accent+'44',borderRadius:14,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,fontWeight:700,color:C.accent}}>📅 Projeção Mês ({proj.duP}/{proj.duT} DU · Restam {proj.duR} DU)</span></div>
        <div style={{height:6,background:C.surface,borderRadius:4,marginBottom:12}}><div style={{height:'100%',background:'linear-gradient(90deg,'+C.accent+','+C.accent2+')',borderRadius:4,width:pctDU+'%'}}/></div>
        <div className="rg6" style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8}}>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PRODUÇÃO</div><div style={{fontSize:14,fontWeight:700,color:C.accent2}}>{fmtCur(proj.fR)}</div><div style={{fontSize:9,color:C.muted}}>{proj.fC} pagas</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PROJEÇÃO</div><div style={{fontSize:14,fontWeight:700,color:C.accent}}>{fmtCur(proj.pR)}</div><div style={{fontSize:9,color:C.muted}}>~{proj.pD} pagas</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>FALTA</div><div style={{fontSize:14,fontWeight:700,color:C.warn}}>{fmtCur(Math.max(0,proj.pR-proj.fR))}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>MÉDIA/DU</div><div style={{fontSize:14,fontWeight:700}}>{fmtCur(proj.mdR)}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>DIGITADAS</div><div style={{fontSize:14,fontWeight:700,color:C.info}}>{curDig}</div><div style={{fontSize:9,color:C.muted}}>{(proj.duP>0?(curDig/proj.duP):0).toFixed(1)}/DU</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PROJ.DIG.</div><div style={{fontSize:14,fontWeight:700,color:C.info}}>{proj.duP>0?Math.round(curDig/proj.duP*proj.duT):0}</div></div>
        </div>
      </div>

      {/* CARDS PERÍODO */}
      <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label="Produção (Pago)" value={fmtCur(curProdR)} color={C.accent2} sub={curProd.length+' finalizadas'}/>
        <Stat label="Digitações" value={f.length} sub={fmtCur(tR)+' digitado'}/>
        <Stat label="Em Andamento" value={pend.length} sub={fmtCur(pend.reduce((s,o)=>s+(o.vrBruto||0),0))} color={C.warn}/>
        <Stat label="Estornos" value={est.length} sub={fmtCur(est.reduce((s,o)=>s+(o.vrBruto||0),0))} color={C.danger}/>
        <Stat label="Parceiros" value={ags.length}/>
      </div>

      <div className="rg3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        {/* SITUAÇÕES COM VALORES */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Situações</div>
          {sitArr.slice(0,10).map(([s,d])=><div key={s} style={{marginBottom:5}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10}}><span style={{color:sitCol(s),fontWeight:600}}>{s}</span><span style={{color:C.muted}}>{d.c} · {fmtCur(d.r)}</span></div>
            <div style={{height:4,background:C.surface,borderRadius:2}}><div style={{height:'100%',background:sitCol(s),borderRadius:2,width:(d.c/(f.length||1)*100)+'%'}}/></div>
          </div>)}
        </div>

        {/* TOP PARCEIROS — clicável */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Top Parceiros <span style={{fontSize:9,color:C.muted}}>(clique p/ health)</span></div>
          {topP.map(([ag,d],i)=>{const cv=d.c?(d.fc/d.c*100):0;return<div key={ag} onClick={()=>setSelP(ag)} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0',borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
            <span style={{fontSize:10,fontWeight:700,color:i<3?C.accent:C.muted,width:16}}>{i+1}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ag}</div>
              <div style={{fontSize:8,color:C.muted}}>{d.c} dig · {d.fc} prod · {cv.toFixed(0)}%</div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:10,fontWeight:700,color:C.accent2}}>{fmtCur(d.fr)}</div>
              <div style={{fontSize:8,color:C.muted}}>dig: {fmtCur(d.r)}</div>
            </div>
          </div>})}
        </div>

        {/* POR BANCO — PRODUÇÃO */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Produção por Banco (CRC mês)</div>
          {bancoArr.map(([b,d])=>{const mx=bancoArr[0]?.[1]?.r||1;return<div key={b} style={{marginBottom:5}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10}}><span style={{fontWeight:600}}>{b}</span><span style={{color:C.accent2,fontWeight:600}}>{fmtCur(d.r)} <span style={{color:C.muted}}>({d.c} ops)</span></span></div>
            <div style={{height:4,background:C.surface,borderRadius:2}}><div style={{height:'100%',background:C.accent2,borderRadius:2,width:(d.r/mx*100)+'%'}}/></div>
          </div>})}
        </div>
      </div>

      {/* VISÃO DIÁRIA — últimos 30 dias */}
      {dailyData.length>0&&(()=>{
        const days=[];for(let i=30;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);days.push(localDate(d))}
        const byDay=days.map(d=>{const row=dailyData.find(x=>x.dia===d);const dt=new Date(d+'T12:00:00');const dow=dt.getDay();const isWe=dow===0||dow===6;return{d,dow,isWe,c:row?Number(row.qtd):0,r:row?Number(row.total):0,label:dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),wd:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow]}})
        const maxR=Math.max(...byDay.map(x=>x.r),1)
        return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:20}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>📅 Digitações Diárias — Últimos 30 dias (Vl. Base)</div>
          <div style={{overflowX:'auto'}}>
            <div style={{display:'flex',gap:3,alignItems:'end',minWidth:700,height:220,padding:'0 4px'}}>
              {byDay.map(x=>{const h=maxR>0?(x.r/maxR*100):0;const isToday=x.d===TODAY_STR;return<div key={x.d} style={{flex:x.isWe?'0 0 14px':'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'end',height:'100%',minWidth:0}}>
                <div style={{fontSize:8,fontWeight:600,color:isToday?C.accent2:C.accent,marginBottom:2}}>{x.c>0&&!x.isWe?fmtCur(x.r).replace('R$ ',''):''}</div>
                <div style={{fontSize:10,fontWeight:700,color:isToday?C.accent2:x.isWe?C.border:C.text,marginBottom:2}}>{x.c||''}</div>
                <div style={{width:x.isWe?10:'85%',height:Math.max(h,x.r?2:0)+'%',background:isToday?C.accent2:x.isWe?'#E2E8F0':C.accent,borderRadius:'4px 4px 0 0',opacity:x.isWe?.4:1,minHeight:x.r?4:0}}/>
                <div style={{borderTop:'1px solid '+C.border,width:'100%',textAlign:'center',paddingTop:4}}>
                  <div style={{fontSize:8,fontWeight:isToday?700:400,color:x.isWe?'#CBD5E1':isToday?C.accent2:C.muted}}>{x.label}</div>
                  <div style={{fontSize:7,color:x.isWe?'#CBD5E1':C.muted}}>{x.wd}</div>
                </div>
              </div>})}
            </div>
          </div>
        </div>
      })()}

      {/* PRODUÇÃO 12 MESES */}
      {monthlyData.length>0&&(()=>{
        const y=NOW.getFullYear(),mo=NOW.getMonth()
        const months=[];for(let i=11;i>=0;i--){const d=new Date(y,mo-i,1);months.push({key:localDate(d).slice(0,7),label:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.',''),m:d.getMonth(),y:d.getFullYear()})}
        const data=months.map(m=>{const row=monthlyData.find(x=>x.mes===m.key);return{...m,c:row?Number(row.qtd):0,r:row?Number(row.total):0}})
        const maxR=Math.max(...data.map(x=>x.r),1)
        const totalR=data.reduce((s,x)=>s+x.r,0),totalC=data.reduce((s,x)=>s+x.c,0)
        const avgR=totalR/12
        return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:13,fontWeight:700}}>📊 Produção — 12 Meses (CRC)</span>
            <div style={{display:'flex',gap:16}}>
              <span style={{fontSize:10,color:C.muted}}>Total: <strong style={{color:C.accent2}}>{fmtCur(totalR)}</strong> ({totalC} ops)</span>
              <span style={{fontSize:10,color:C.muted}}>Média: <strong style={{color:C.accent}}>{fmtCur(avgR)}</strong>/mês</span>
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'end',height:280}}>
            {data.map((x,i)=>{const h=maxR>0?Math.max(x.r/maxR*100,x.c?2:0):0;const isCur=i===data.length-1;return<div key={x.key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'end',height:'100%'}}>
              <div style={{fontSize:9,fontWeight:700,color:isCur?C.accent2:C.accent,marginBottom:2}}>{x.r>0?fmtCur(x.r).replace('R$ ',''):''}</div>
              <div style={{fontSize:11,fontWeight:800,color:isCur?C.accent2:C.text,marginBottom:3}}>{x.c||''}</div>
              <div style={{width:'70%',height:Math.max(h,x.c?2:0)+'%',background:isCur?'linear-gradient(180deg,'+C.accent2+','+C.accent+')':C.accent,borderRadius:'5px 5px 0 0',opacity:isCur?1:.75,minHeight:x.c?6:0}}/>
              <div style={{borderTop:'2px solid '+(isCur?C.accent2:C.border),width:'100%',textAlign:'center',paddingTop:6}}>
                <div style={{fontSize:9,color:isCur?C.accent2:C.muted,fontWeight:isCur?700:500,textTransform:'uppercase'}}>{x.label}</div>
              </div>
            </div>})}
          </div>
        </div>
      })()}

      <PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/>
    </div>
  )
}

/* ═══ OPERAÇÕES ═══ */
function Operacoes({onImport,myAgents,onDone}){
  const{per,setPer,ops,loading,count,customDf,setCustomDf,customDt,setCustomDt,applyCustom}=useOps('mes',myAgents)
  const[io,sio]=useState(false),[se,sse]=useState(''),[fs,sfs]=useState(''),[selP,setSelP]=useState(null),[showExp,setShowExp]=useState(false)
  const[importMsg,setImportMsg]=useState(''),[importing,setImporting]=useState(false)
  const quickRef=useRef(null)
  const aS=[...new Set(ops.map(o=>o.situacao).filter(Boolean))].sort()
  const fd=ops.filter(o=>!fs||o.situacao===fs).filter(o=>{if(!se)return true;const s=se.toLowerCase();return(o.cliente||'').toLowerCase().includes(s)||(o.agente||'').toLowerCase().includes(s)||(o.cpf||'').includes(s)||(o.usuario||'').toLowerCase().includes(s)}).sort((a,b)=>(b.data||'').localeCompare(a.data||''))
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,' ').trim()
  const quickImport=async(file)=>{
    if(!file)return
    setImporting(true);setImportMsg('Lendo '+file.name+'...')
    try{
      const buf=await file.arrayBuffer()
      const wb=XLSX.read(new Uint8Array(buf),{type:'array'})
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
      if(!rows.length){setImportMsg('Arquivo vazio');setImporting(false);return}
      const cols=Object.keys(rows[0])
      const mp={}
      Object.entries(IMP).forEach(([f,def])=>{const exact=cols.find(c=>def.a.some(a=>norm(c)===norm(a)));if(exact){mp[f]=exact;return};const found=cols.find(c=>def.a.some(a=>norm(c).includes(norm(a))));if(found)mp[f]=found})
      setImportMsg(file.name+' \u2014 '+rows.length+' linhas \u2014 '+Object.keys(mp).length+'/'+Object.keys(IMP).length+' colunas detectadas')
      const built=rows.map(row=>{
        const cl=mp.cliente?String(row[mp.cliente]||'').trim():''
        const pr=mp.proposta?String(row[mp.proposta]||'').trim():''
        const ok=!!(cl||pr)
        const g=f=>mp[f]?String(row[mp[f]]||'').trim():''
        const gu=f=>g(f).toUpperCase()
        return{_v:ok,cliente:cl,proposta:pr,id_ext:g('id_ext'),banco:g('banco'),cpf:g('cpf'),contrato:g('contrato'),data:nDate(mp.data?row[mp.data]:''),prazo:g('prazo'),vrBruto:pNum(mp.vrBruto?row[mp.vrBruto]:''),vrParcela:pNum(mp.vrParcela?row[mp.vrParcela]:''),vrLiquido:pNum(mp.vrLiquido?row[mp.vrLiquido]:''),vrRepasse:pNum(mp.vrRepasse?row[mp.vrRepasse]:''),vrSeguro:pNum(mp.vrSeguro?row[mp.vrSeguro]:''),taxa:g('taxa'),operacao:gu('operacao'),situacao:gu('situacao'),produto:g('produto'),convenio:gu('convenio'),agente:g('agente'),situacaoBanco:gu('situacaoBanco'),obsSituacao:g('obsSituacao'),usuario:g('usuario'),crcCliente:nDate(mp.crcCliente?row[mp.crcCliente]:''),dataNossoCredito:nDate(mp.dataNossoCredito?row[mp.dataNossoCredito]:'')}
      })
      const valid=built.filter(p=>p._v).map(({_v,...r})=>r)
      if(!valid.length){setImportMsg('Nenhuma linha v\u00e1lida encontrada');setImporting(false);return}
      const total=valid.length;let ok=0,fail=0
      for(let i=0;i<total;i+=200){
        const batch=valid.slice(i,i+200)
        setImportMsg('Gravando '+Math.min(i+200,total)+'/'+total+'...')
        try{await onImport(batch);ok+=batch.length}catch(e){fail+=batch.length;console.error('Batch err:',e)}
        if(i+200<total)await new Promise(r=>setTimeout(r,150))
      }
      setImportMsg(fail?'\u2713 '+ok+' gravados, '+fail+' falharam':'\u2713 '+ok+' propostas importadas com sucesso!')
      if(onDone)onDone()
    }catch(ex){setImportMsg('Erro: '+ex.message)}
    setImporting(false)
    if(quickRef.current)quickRef.current.value=''
  }
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}><h2 style={{fontWeight:800,fontSize:20}}>Opera\u00e7\u00f5es</h2><div style={{display:'flex',gap:6}}>
        {canManage()&&<><button onClick={()=>setShowExp(true)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 Exportar</button>
        <button onClick={()=>quickRef.current?.click()} disabled={importing} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:importing?'wait':'pointer',fontWeight:600,fontSize:12,opacity:importing?.6:1}}>📥 {importing?'Importando...':'Importar WorkBank'}</button>
        <input ref={quickRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>quickImport(e.target.files?.[0])}/>
        <button onClick={()=>sio(true)} style={{background:C.surface,border:'1px solid '+C.accent,borderRadius:8,color:C.accent,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>Importar Manual</button></>}
      </div></div>
      {importMsg&&<div style={{background:importMsg.includes('\u2713')?C.accent2+'22':importMsg.includes('Erro')?C.danger+'22':C.warn+'22',color:importMsg.includes('\u2713')?C.accent2:importMsg.includes('Erro')?C.danger:C.warn,padding:'8px 14px',borderRadius:8,fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{importMsg}</span>{!importing&&<button onClick={()=>setImportMsg('')} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:14}}>\u00d7</button>}</div>}
      <PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><input value={se} onChange={e=>sse(e.target.value)} placeholder="Buscar..." style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 12px',fontSize:12,outline:'none',flex:1,minWidth:160}}/><select value={fs} onChange={e=>sfs(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 11px',fontSize:12}}><option value="">Todos</option>{aS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
      <div style={{fontSize:10,color:C.muted}}>{fd.length} de {count} \u2014 {fmtCur(fd.reduce((s,o)=>s+(o.vrBruto||0),0))}</div>
      <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Data','CPF','Cliente','Banco','Op.','Situa\u00e7\u00e3o','Agente','Digitador','Vl.Base'].map(h=><th key={h} style={{padding:'8px 9px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{fd.slice(0,500).map(o=><tr key={o.id} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 9px',whiteSpace:'nowrap'}}>{fmtDate(o.data)}</td><td style={{padding:'7px 9px',fontSize:10,color:C.muted,whiteSpace:'nowrap'}}>{o.cpf||'\u2014'}</td><td style={{padding:'7px 9px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.cliente||'\u2014'}</td><td style={{padding:'7px 9px'}}>{o.banco}</td><td style={{padding:'7px 9px'}}>{o.operacao}</td><td style={{padding:'7px 9px'}}><Badge text={o.situacao||'\u2014'} color={sitCol(o.situacao)}/></td><td style={{padding:'7px 9px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer',color:C.accent}} onClick={()=>setSelP(o.agente)}>{o.agente}</td><td style={{padding:'7px 9px',fontSize:10,color:C.muted,maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={o.usuario||''}>{o.usuario||'\u2014'}</td><td style={{padding:'7px 9px',fontWeight:600}}>{fmtCur(o.vrBruto)}</td></tr>)}</tbody></table></div>
      <ImportModal open={io} onClose={()=>sio(false)} onImport={onImport} onDone={onDone}/>
      <ExportModal open={showExp} onClose={()=>setShowExp(false)} ops={ops}/>
      <PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/>
    </div>
  )
}

/* ═══ PRODUÇÃO — somente FINALIZADOS ═══ */
function Producao({myAgents}){
  const{per,setPer,ops,digOps,loading,customDf,setCustomDf,customDt,setCustomDt,applyCustom}=useProd('mes',myAgents)
  const[tab,sTab]=useState('banco')
  const[prevOps,setPrevOps]=useState([]),[prevDigOps,setPrevDigOps]=useState([]),[prevLoading,setPrevLoading]=useState(false)
  const fin=ops
  const totalDig=digOps.length
  const totalProd=fin.reduce((s,o)=>s+(o.vrBruto||0),0)
  const cv=totalDig?(fin.length/totalDig*100):0
  const pr=useMemo(()=>prevRange(per,customDf,customDt),[per,customDf,customDt])
  useEffect(()=>{
    if(!pr){setPrevOps([]);setPrevDigOps([]);return}
    let c=false;setPrevLoading(true)
    Promise.all([fetchProd('custom',null,pr.df,pr.dt),fetchOps('custom',null,pr.df,pr.dt)]).then(([p,d])=>{
      if(c)return
      const fp=myAgents?p.filter(o=>myAgents.has(o.agente)):p
      const fd=myAgents?d.filter(o=>myAgents.has(o.agente)):d
      setPrevOps(fp);setPrevDigOps(fd)
    }).catch(()=>{}).finally(()=>{if(!c)setPrevLoading(false)})
    return()=>{c=true}
  },[per,pr?.df,pr?.dt])
  const prevTotalProd=prevOps.reduce((s,o)=>s+(o.vrBruto||0),0)
  const prevTotalDig=prevDigOps.length
  const prevCv=prevTotalDig?(prevOps.length/prevTotalDig*100):0
  const pctVar=(a,b)=>b>0?((a-b)/b*100):(a>0?100:0)
  const vProd=pctVar(totalProd,prevTotalProd)
  const vDig=pctVar(totalDig,prevTotalDig)
  const vCv=cv-prevCv
  const kFn=tab==='banco'?o=>o.banco:tab==='convenio'?o=>o.convenio:o=>o.operacao
  const m={};fin.forEach(o=>{const k=kFn(o)||'?';if(!m[k])m[k]={c:0,r:0};m[k].c++;m[k].r+=(o.vrBruto||0)})
  const md={};digOps.forEach(o=>{const k=kFn(o)||'?';md[k]=(md[k]||0)+1})
  const pm={};prevOps.forEach(o=>{const k=kFn(o)||'?';if(!pm[k])pm[k]={c:0,r:0};pm[k].c++;pm[k].r+=(o.vrBruto||0)})
  const data=Object.entries(m).sort((a,b)=>b[1].r-a[1].r)
  const VarBadge=({v,isPp,hasRef})=>{if(!hasRef||!isFinite(v))return<span style={{color:C.muted}}>—</span>;const col=v>0?C.accent2:v<0?C.danger:C.muted;const arr=v>0.01?'▲':v<-0.01?'▼':'■';return<span style={{color:col,fontWeight:700}}>{arr} {Math.abs(v).toFixed(isPp?1:0)}{isPp?'pp':'%'}</span>}
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Produção</h2><ExportBtn ops={fin} name={'producao-'+per}/></div>
    <PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/>
    {pr&&<div style={{fontSize:10,color:C.muted}}>📊 Comparando com <strong style={{color:C.text}}>{pr.n}</strong> ({fmtDate(pr.df)} → {fmtDate(pr.dt)}){prevLoading&&<span style={{color:C.warn,marginLeft:6}}>⏳</span>}</div>}
    <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Produção (Pago)" value={fmtCur(totalProd)} color={C.accent2} sub={<span>{fin.length} finalizadas {pr&&<>· <VarBadge v={vProd} hasRef={prevTotalProd>0||totalProd>0}/></>}</span>}/>
      <Stat label="Digitadas" value={totalDig} sub={pr?<VarBadge v={vDig} hasRef={prevTotalDig>0||totalDig>0}/>:null}/>
      <Stat label="Conversão" value={cv.toFixed(0)+'%'} color={cv>=50?C.accent2:cv>=30?C.warn:C.danger} sub={pr?<VarBadge v={vCv} isPp hasRef={prevTotalDig>0}/>:null}/>
    </div>
    <div style={{display:'flex',gap:4}}>{[{id:'banco',n:'🏦 Banco'},{id:'convenio',n:'📑 Convênio'},{id:'operacao',n:'⚡ Operação'}].map(t=><button key={t.id} onClick={()=>sTab(t.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(tab===t.id?C.accent:C.border),background:tab===t.id?C.abg:'transparent',color:tab===t.id?C.accent:C.muted,fontSize:11,cursor:'pointer'}}>{t.n}</button>)}</div>
    <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead><tr style={{background:C.surface}}>{[tab==='banco'?'Banco':tab==='convenio'?'Convênio':'Operação','Produção (Pago)','%','Qtd Pagas','Digitadas','Conv.',...(pr?['Anterior','Var.']:[])].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
        <tbody>{data.map(([n,d])=>{const pct=totalProd?(d.r/totalProd*100):0;const dig=md[n]||0;const cvn=dig?(d.c/dig*100):0;const prev=pm[n]||{c:0,r:0};const vv=pctVar(d.r,prev.r);return<tr key={n} style={{borderBottom:'1px solid '+C.border}}>
          <td style={{padding:'8px 10px',fontWeight:700}}>{n}</td>
          <td style={{padding:'8px 10px',fontWeight:600,color:C.accent2}}>{fmtCur(d.r)}</td>
          <td style={{padding:'8px 10px',color:C.muted}}>{pct.toFixed(0)}%</td>
          <td style={{padding:'8px 10px',fontWeight:600}}>{d.c}</td>
          <td style={{padding:'8px 10px',color:C.muted}}>{dig}</td>
          <td style={{padding:'8px 10px',fontWeight:600,color:cvn>=50?C.accent2:cvn>=30?C.warn:C.danger}}>{cvn.toFixed(0)}%</td>
          {pr&&<td style={{padding:'8px 10px',color:C.muted}}>{prev.r?fmtCur(prev.r):'—'}</td>}
          {pr&&<td style={{padding:'8px 10px'}}><VarBadge v={vv} hasRef={prev.r>0||d.r>0}/></td>}
        </tr>})}</tbody>
      </table>
    </div>
  </div>
}

/* ═══ ESTRATÉGICO ═══ */
function Estrategico({myAgents}){const{per,setPer,ops,loading,customDf,setCustomDf,customDt,setCustomDt,applyCustom}=useOps('tudo',myAgents);const[sel,sSel]=useState(null),[selP,setSelP]=useState(null);const list=(()=>{const ags=[...new Set(ops.map(o=>o.agente).filter(Boolean))];return ags.map(a=>{const al=ops.filter(o=>o.agente===a),fn=al.filter(isFin),est=al.filter(isEst),r=al.reduce((s,o)=>s+(o.vrBruto||0),0),cv=al.length?(fn.length/al.length*100):0,er=al.length?(est.length/al.length*100):0;return{name:a,c:al.length,r,fC:fn.length,cv,estC:est.length,er}}).sort((a,b)=>b.r-a.r)})();return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Estratégico</h2><ExportBtn ops={ops} name={'estrategico-'+per}/></div><PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/><div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Parceiro','Dig.','Vl.Base','Conv.','Estornos','Health',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{list.map(p=>{const h=p.cv>=60?'🟢':p.cv>=40?'🟡':p.cv>=25?'🟠':'🔴';return<tr key={p.name} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}} onClick={()=>setSelP(p.name)}><td style={{padding:'8px 10px',fontWeight:600}}>{p.name}</td><td style={{padding:'8px 10px'}}>{p.c}</td><td style={{padding:'8px 10px',fontWeight:600,color:C.accent}}>{fmtCur(p.r)}</td><td style={{padding:'8px 10px',fontWeight:600,color:p.cv>=50?C.accent2:p.cv>=30?C.warn:C.danger}}>{p.cv.toFixed(0)}%</td><td style={{padding:'8px 10px',color:p.estC?C.danger:C.muted}}>{p.estC} ({p.er.toFixed(0)}%)</td><td style={{padding:'8px 10px',fontSize:14}}>{h}</td><td style={{color:C.accent}}>→</td></tr>})}</tbody></table></div><PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/></div>}

/* ═══ RANKING ═══ */
function Ranking({myAgents}){const{per,setPer,ops,loading,customDf,setCustomDf,customDt,setCustomDt,applyCustom}=useOps('mes',myAgents);const[selP,setSelP]=useState(null);const data=(()=>{const ags=[...new Set(ops.map(o=>o.agente).filter(Boolean))];return ags.map(a=>{const al=ops.filter(o=>o.agente===a),fn=al.filter(isFin),est=al.filter(isEst),r=al.reduce((s,o)=>s+(o.vrBruto||0),0),cv=al.length?(fn.length/al.length*100):0;return{name:a,c:al.length,r,cv,estC:est.length}}).sort((a,b)=>b.r-a.r)})();return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Ranking</h2><ExportBtn ops={ops} name={'ranking-'+per}/></div><PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/><div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['#','Parceiro','Dig.','Vl.Base','Conv.','Est.','Health'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{data.map((d,i)=>{const h=d.cv>=60?'🟢':d.cv>=40?'🟡':d.cv>=25?'🟠':'🔴';return<tr key={d.name} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}} onClick={()=>setSelP(d.name)}><td style={{padding:'8px 10px'}}><span style={{display:'inline-flex',width:22,height:22,borderRadius:6,background:i<3?C.accent:C.surface,alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:i<3?'#fff':C.muted}}>{i+1}</span></td><td style={{padding:'8px 10px',fontWeight:600}}>{d.name}</td><td style={{padding:'8px 10px'}}>{d.c}</td><td style={{padding:'8px 10px',fontWeight:600,color:C.accent}}>{fmtCur(d.r)}</td><td style={{padding:'8px 10px',fontWeight:600,color:d.cv>=50?C.accent2:d.cv>=30?C.warn:C.danger}}>{d.cv.toFixed(0)}%</td><td style={{padding:'8px 10px',color:d.estC?C.danger:C.muted}}>{d.estC}</td><td style={{fontSize:14}}>{h}</td></tr>})}</tbody></table></div><PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/></div>}

/* ═══ RECEBIMENTOS ═══ */
function Recebimentos({myAgents}){
  const[pend,setPend]=useState([]),[rec,setRec]=useState([]),[loading,setLoading]=useState(true)
  const[fB,sFB]=useState(''),[fA,sFA]=useState(''),[showExp,setShowExp]=useState(false),[fAging,sFAging]=useState('')

  useEffect(()=>{
    setLoading(true)
    fetchReceb().then(all=>{
      const comCrc=all.filter(o=>o.crcCliente&&o.crcCliente.length>=8)
      const filtered=myAgents?comCrc.filter(o=>myAgents.has(o.agente)):comCrc
      setPend(filtered.filter(o=>!o.dataNossoCredito||o.dataNossoCredito.length<8))
      setRec(filtered.filter(o=>o.dataNossoCredito&&o.dataNossoCredito.length>=8))
      setLoading(false)
    }).catch(e=>{console.error('Receb load error:',e);setLoading(false)})
  },[])

  const pR=pend.reduce((s,o)=>s+(o.vrBruto||0),0)
  const byBanco=(()=>{const m={};pend.forEach(o=>{const b=o.banco||'?';if(!m[b])m[b]={c:0,r:0,ds:[]};m[b].c++;m[b].r+=(o.vrBruto||0);if(o.crcCliente)m[b].ds.push(getBD(o.crcCliente))});return Object.entries(m).map(([b,d])=>({b,...d,md:d.ds.length?Math.round(d.ds.reduce((a,x)=>a+x,0)/d.ds.length):0,mx:d.ds.length?Math.max(...d.ds):0})).sort((a,b)=>b.r-a.r)})()
  const byOp=(()=>{const m={};pend.forEach(o=>{const k=o.operacao||'?';if(!m[k])m[k]={c:0,r:0};m[k].c++;m[k].r+=(o.vrBruto||0)});return Object.entries(m).sort((a,b)=>b[1].r-a[1].r)})()
  const byAg2=(()=>{const m={};pend.forEach(o=>{const a=o.agente||'?';if(!m[a])m[a]={c:0,r:0,ds:[]};m[a].c++;m[a].r+=(o.vrBruto||0);if(o.crcCliente)m[a].ds.push(getBD(o.crcCliente))});return Object.entries(m).map(([a,d])=>({a,c:d.c,r:d.r,md:d.ds.length?Math.round(d.ds.reduce((x,y)=>x+y,0)/d.ds.length):0})).sort((a,b)=>b.r-a.r)})()
  const AGING_KEYS=['0-5','5-10','10-15','15-30','30-60','60-90','90+']
  const aging=(()=>{const fx={};AGING_KEYS.forEach(k=>fx[k]=[0,0]);pend.forEach(o=>{if(!o.crcCliente)return;const bd=getBD(o.crcCliente),k=getAgingKey(bd);fx[k][0]++;fx[k][1]+=(o.vrBruto||0)});return Object.entries(fx)})()
  const filt=pend.filter(o=>(!fB||o.banco===fB)&&(!fA||o.agente===fA)&&(!fAging||(o.crcCliente&&getAgingKey(getBD(o.crcCliente))===fAging)))

  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <h2 style={{fontWeight:800,fontSize:20}}>A Receber {loading?'⏳':''}</h2>
      <div style={{display:'flex',gap:6}}>
        <button onClick={()=>setShowExp(true)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 Exportar</button>
        <ExportBtn ops={pend} name={'a-receber-todos'}/>
      </div>
    </div>
    <div style={{background:C.card,border:'1px solid '+C.warn+'44',borderRadius:12,padding:12,fontSize:11,color:C.warn}}>
      💡 Mostra <strong>todas</strong> as propostas onde o cliente já recebeu (CRC preenchido) mas você ainda não recebeu (Nosso Crédito vazio) — independente de período.
    </div>
    <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="A Receber" value={pend.length} sub={fmtCur(pR)} color={C.danger}/>
      <Stat label="Já Recebido" value={rec.length} sub={fmtCur(rec.reduce((s,o)=>s+(o.vrBruto||0),0))} color={C.accent2}/>
      <Stat label="Total CRC" value={pend.length+rec.length}/>
    </div>

    {pend.length>0&&<>
      {/* AGING — DIAS ÚTEIS — clicável para filtrar */}
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Aging — Dias Úteis desde CRC {fAging&&<button onClick={()=>sFAging('')} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.accent,padding:'2px 8px',fontSize:9,cursor:'pointer',marginLeft:8}}>✕ Limpar</button>}</div>
        <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {aging.map(([k,[c,r]])=>{const col=k.includes('90')||k.includes('60')?C.danger:k.includes('30')?C.warn:k.includes('15')||k.includes('10')?C.info:C.accent2;const pct=pend.length?(c/pend.length*100):0;const active=fAging===k;return c>0?<div key={k} onClick={()=>sFAging(active?'':k)} style={{background:active?col+'22':C.surface,border:'1px solid '+(active?col:C.border),borderRadius:10,padding:'10px 16px',minWidth:90,cursor:'pointer'}}>
            <div style={{fontSize:18,fontWeight:700,color:col}}>{c}</div>
            <div style={{fontSize:10,fontWeight:600,color:col}}>{k} DU</div>
            <div style={{fontSize:9,color:C.muted}}>{fmtCur(r)}</div>
            <div style={{height:3,background:C.border,borderRadius:2,marginTop:4}}><div style={{height:'100%',background:col,borderRadius:2,width:pct+'%'}}/></div>
          </div>:null})}
        </div>
      </div>

      <div className="rg3" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        {/* POR BANCO */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Banco</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Banco','Qtd','A Receber','Média DU','Máx DU'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{byBanco.map(b=><tr key={b.b} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'6px 8px',fontWeight:700}}>{b.b}</td>
            <td style={{padding:'6px 8px'}}>{b.c}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:C.danger}}>{fmtCur(b.r)}</td>
            <td style={{padding:'6px 8px',color:b.md>60?C.danger:b.md>30?C.warn:C.text}}>{b.md}d</td>
            <td style={{padding:'6px 8px',color:b.mx>90?C.danger:C.warn,fontWeight:600}}>{b.mx}d</td>
          </tr>)}</tbody></table>
        </div>
        {/* POR OPERAÇÃO */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Operação</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Operação','Qtd','A Receber'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{byOp.map(([op,d])=><tr key={op} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'6px 8px',fontWeight:600}}>{op}</td>
            <td style={{padding:'6px 8px'}}>{d.c}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:C.danger}}>{fmtCur(d.r)}</td>
          </tr>)}</tbody></table>
        </div>
        {/* POR PARCEIRO */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Parceiro</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Parceiro','Qtd','A Receber','Média DU'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{byAg2.slice(0,20).map(a=><tr key={a.a} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'6px 8px',fontWeight:600,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.a}</td>
            <td style={{padding:'6px 8px'}}>{a.c}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:C.danger}}>{fmtCur(a.r)}</td>
            <td style={{padding:'6px 8px',color:a.md>60?C.danger:a.md>30?C.warn:C.text}}>{a.md}d</td>
          </tr>)}</tbody></table>
        </div>
      </div>

      {/* BANCO × DIAS EM ABERTO */}
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Banco × Dias Úteis em Aberto</div>
        {(()=>{
          const FAIXAS=['0-5','5-10','10-15','15-30','30-60','60-90','90+']
          const getFaixa=d=>d<=5?'0-5':d<=10?'5-10':d<=15?'10-15':d<=30?'15-30':d<=60?'30-60':d<=90?'60-90':'90+'
          const mx={};pend.forEach(o=>{const b=o.banco||'?',d=o.crcCliente?getBD(o.crcCliente):0,f=getFaixa(d);if(!mx[b])mx[b]={};if(!mx[b][f])mx[b][f]={c:0,r:0};mx[b][f].c++;mx[b][f].r+=(o.vrBruto||0)})
          const bancos=Object.keys(mx).sort()
          return<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
            <thead><tr style={{background:C.surface}}>
              <th style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8,position:'sticky',left:0,background:C.surface}}>BANCO</th>
              {FAIXAS.map(f=><th key={f} style={{padding:'6px 8px',textAlign:'center',color:C.muted,fontSize:8,minWidth:70}}>{f} DU</th>)}
              <th style={{padding:'6px 8px',textAlign:'center',color:C.muted,fontSize:8,fontWeight:700}}>TOTAL</th>
            </tr></thead>
            <tbody>{bancos.map(b=>{
              const total={c:0,r:0};FAIXAS.forEach(f=>{if(mx[b]?.[f]){total.c+=mx[b][f].c;total.r+=mx[b][f].r}})
              return<tr key={b} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'6px 8px',fontWeight:600,position:'sticky',left:0,background:C.card}}>{b}</td>
                {FAIXAS.map(f=>{const v=mx[b]?.[f];const col=f.includes('90')||f.includes('60')?C.danger:f.includes('30')?C.warn:f.includes('15')?C.info:C.accent2;return<td key={f} style={{padding:'6px 8px',textAlign:'center'}}>{v?<div><div style={{fontWeight:600,color:col}}>{v.c}</div><div style={{fontSize:8,color:C.muted}}>{fmtCur(v.r)}</div></div>:<span style={{color:C.border}}>—</span>}</td>})}
                <td style={{padding:'6px 8px',textAlign:'center',fontWeight:700}}><div style={{color:C.danger}}>{total.c}</div><div style={{fontSize:8,color:C.muted}}>{fmtCur(total.r)}</div></td>
              </tr>
            })}</tbody>
          </table></div>
        })()}
      </div>

      {/* ANALÍTICO */}
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'center',flexWrap:'wrap',gap:8}}>
          <span style={{fontSize:12,fontWeight:700}}>Analítico — {filt.length} pendências ({fmtCur(filt.reduce((s,o)=>s+(o.vrBruto||0),0))})</span>
          <div style={{display:'flex',gap:6}}>
            <select value={fB} onChange={e=>sFB(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:10}}>
              <option value="">— Banco —</option>
              {[...new Set(pend.map(o=>o.banco).filter(Boolean))].sort().map(b=><option key={b} value={b}>{b}</option>)}
            </select>
            <select value={fA} onChange={e=>sFA(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:10}}>
              <option value="">— Parceiro —</option>
              {[...new Set(pend.map(o=>o.agente).filter(Boolean))].sort().map(a=><option key={a} value={a}>{a}</option>)}
            </select>
            <select value={fAging} onChange={e=>sFAging(e.target.value)} style={{background:C.surface,border:'1px solid '+(fAging?C.danger:C.border),borderRadius:6,color:fAging?C.danger:C.text,padding:'4px 8px',fontSize:10}}>
              <option value="">— Aging DU —</option>
              {AGING_KEYS.map(k=><option key={k} value={k}>{k} DU</option>)}
            </select>
            {(fB||fA||fAging)&&<button onClick={()=>{sFB('');sFA('');sFAging('')}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.muted,padding:'4px 8px',fontSize:10,cursor:'pointer'}}>✕</button>}
            <ExportBtn ops={filt} name={'a-receber-filtrado'}/>
          </div>
        </div>
        <div style={{overflowX:'auto',maxHeight:400,borderRadius:8,border:'1px solid '+C.border}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
            <thead><tr style={{background:C.surface,position:'sticky',top:0}}>
              {['Cliente','CPF','Banco','Op.','Agente','Vl.Base','CRC Cliente','DU'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}
            </tr></thead>
            <tbody>{filt.slice(0,500).map(o=>{
              const dias=o.crcCliente?getBD(o.crcCliente):0
              return<tr key={o.id} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'5px 8px',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.cliente}</td>
                <td style={{padding:'5px 8px'}}>{o.cpf}</td>
                <td style={{padding:'5px 8px'}}>{o.banco}</td>
                <td style={{padding:'5px 8px'}}>{o.operacao}</td>
                <td style={{padding:'5px 8px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.agente}</td>
                <td style={{padding:'5px 8px',fontWeight:600,color:C.danger}}>{fmtCur(o.vrBruto)}</td>
                <td style={{padding:'5px 8px'}}>{fmtDate(o.crcCliente)}</td>
                <td style={{padding:'5px 8px',fontWeight:600,color:dias>90?C.danger:dias>30?C.warn:C.text}}>{dias}d</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>
    </>}
    <ExportModal open={showExp} onClose={()=>setShowExp(false)} ops={pend}/>
  </div>
}

/* ═══ MEU PORTAL (tela do Parceiro) ═══ */
function MeuPortal({user}){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[parceiro,setParceiro]=useState(null)
  const[selRow,setSelRow]=useState(null)
  useEffect(()=>{
    if(!user.parceiro_id){setLoading(false);return}
    ;(async()=>{
      const{data:p}=await supabase.from('parceiros').select('*').eq('id',user.parceiro_id).single()
      setParceiro(p)
      // Buscar portabilidades via view enriched filtrando pelo parceiro
      const{data}=await supabase.from('portabilidades_enriched').select('*').eq('parceiro_id',user.parceiro_id).order('proposal_date',{ascending:false}).limit(1000)
      setRows(data||[])
      setLoading(false)
    })()
  },[user.parceiro_id])
  if(!user.parceiro_id)return<div style={{padding:40,textAlign:'center',color:C.muted}}>⚠️ Seu usuário não está vinculado a um parceiro. Contate o administrador.</div>
  if(loading)return<div style={{padding:40,textAlign:'center'}}>⏳ Carregando...</div>
  const isEnviado=r=>!!(r.portability_number||r.cip_submission_date||r.origin_due_balance_returned||r.origin_due_balance_date||['retained','rejected_ctc','integrated'].includes(r.status_key))
  const isChegou=r=>!!r.origin_due_balance_returned
  const isPago=r=>r.status_key==='integrated'
  const sumBal=arr=>arr.reduce((s,r)=>s+(Number(r.origin_due_balance)||0),0)
  const enviadas=rows.filter(isEnviado),chegou=rows.filter(isChegou),pagas=rows.filter(isPago)
  const aguardandoForm=rows.filter(r=>r.status_key==='awaiting_formalization')
  const pendenteDoc=rows.filter(r=>r.status_key==='documents_not_found')
  const hoje=localDate(new Date())
  const hojeChegaram=rows.filter(r=>r.origin_due_balance_date&&String(r.origin_due_balance_date).slice(0,10)===hoje)
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div>
        <h2 style={{fontWeight:800,fontSize:22,margin:0}}>👋 Olá, {user.nome.split(' ')[0]}!</h2>
        <div style={{fontSize:11,color:C.muted,marginTop:2}}>Parceiro: <strong>{parceiro?.nome||'—'}</strong></div>
      </div>
      <div style={{fontSize:10,color:C.muted}}>{rows.length} portabilidades registradas</div>
    </div>
    {/* CIP DO DIA */}
    {hojeChegaram.length>0&&<div style={{background:C.accent2+'15',border:'2px solid '+C.accent2,borderRadius:14,padding:16}}>
      <div style={{fontSize:14,fontWeight:800,color:C.accent2,marginBottom:8}}>🟢 Saldos que chegaram hoje — {hojeChegaram.length}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:8}}>
        {hojeChegaram.map(r=><div key={r.id} onClick={()=>setSelRow(r)} style={{background:C.card,borderRadius:8,padding:10,cursor:'pointer',border:'1px solid '+C.accent2+'33'}}>
          <div style={{fontSize:12,fontWeight:700}}>{r.borrower_name}</div>
          <div style={{fontSize:10,color:C.muted}}>{r.origin_bank_name}</div>
          <div style={{fontSize:14,fontWeight:700,color:C.accent2,marginTop:4}}>{fmtCur(r.origin_due_balance)}</div>
        </div>)}
      </div>
    </div>}
    {/* KPIs */}
    <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Total" value={rows.length} sub={fmtCur(sumBal(rows))}/>
      <Stat label="Enviadas CIP" value={enviadas.length} sub={fmtCur(sumBal(enviadas))} color={C.accent}/>
      <Stat label="Chegou Saldo" value={chegou.length} sub={fmtCur(sumBal(chegou))} color={C.warn}/>
      <Stat label="Integradas" value={pagas.length} sub={fmtCur(sumBal(pagas))} color={C.accent2}/>
      <Stat label="Aguardando Form." value={aguardandoForm.length} color={C.info}/>
      <Stat label="Pend. Docs" value={pendenteDoc.length} color={C.danger}/>
    </div>
    {/* Por status */}
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>📋 Minhas Portabilidades</div>
      <div style={{overflowX:'auto',maxHeight:600,borderRadius:8,border:'1px solid '+C.border}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Data','Cliente','Banco Origem','Saldo','Status','Retorno CIP'].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r=><tr key={r.id} onClick={()=>setSelRow(r)} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
            <td style={{padding:'6px 10px',whiteSpace:'nowrap',fontSize:10}}>{fmtDate(r.proposal_date)}</td>
            <td style={{padding:'6px 10px',fontWeight:600}}>{r.borrower_name}</td>
            <td style={{padding:'6px 10px',fontSize:10}}>{r.origin_bank_name||'—'}</td>
            <td style={{padding:'6px 10px',fontWeight:600,color:C.accent}}>{fmtCur(r.origin_due_balance)}</td>
            <td style={{padding:'6px 10px'}}><span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:(r.status_color||C.muted)+'22',color:r.status_color||C.muted,fontWeight:600}}>{r.status_name}</span></td>
            <td style={{padding:'6px 10px',fontSize:10,color:r.origin_due_balance_returned?C.accent2:C.muted}}>{r.origin_due_balance_date?fmtDate(r.origin_due_balance_date):(r.origin_due_balance_expected_date?'prev: '+fmtDate(r.origin_due_balance_expected_date):'—')}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    {/* Modal detalhes */}
    {selRow&&<div onClick={()=>setSelRow(null)} style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,width:600,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto',padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
          <h3 style={{margin:0,fontSize:16}}>{selRow.borrower_name}</h3>
          <button onClick={()=>setSelRow(null)} style={{background:'none',border:'none',color:C.muted,fontSize:24,cursor:'pointer'}}>×</button>
        </div>
        <div style={{fontSize:10,color:C.muted,marginBottom:10}}>Proposta {selRow.contract_number||selRow.proposal_number} · CPF {selRow.borrower_identity}</div>
        {selRow.formalization_url&&<div style={{marginBottom:14}}>
          <a href={selRow.formalization_url} target="_blank" rel="noopener noreferrer" style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6}}>🔗 Link de Formalização</a>
          {selRow.document_url&&<a href={selRow.document_url} target="_blank" rel="noopener noreferrer" style={{background:C.surface,color:C.accent,border:'1px solid '+C.accent,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,marginLeft:8}}>📄 Contrato</a>}
        </div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[
            ['Status',selRow.status_name],['Operação',selRow.operation_type],
            ['Banco Origem',selRow.origin_bank_name],['Banco Destino',selRow.destination_bank_name],
            ['Saldo Devedor',fmtCur(selRow.origin_due_balance)],['Vl. Bruto',fmtCur(selRow.loan_value)],
            ['Vl. Líquido (Troco)',fmtCur(selRow.net_value)],['Parcela',fmtCur(selRow.installment_value)],
            ['Prazo',selRow.term+' meses'],['Taxa',(selRow.rate||0).toFixed(2)+'%'],
            ['Data Proposta',fmtDate(selRow.proposal_date)],['Data Contrato',fmtDate(selRow.contract_date)],
            ['Retorno CIP',fmtDate(selRow.origin_due_balance_date)],['Retorno Esperado',fmtDate(selRow.origin_due_balance_expected_date)],
            ['Saldo Retornou?',selRow.origin_due_balance_returned?'✅ Sim':'Não'],['Número CIP',selRow.portability_number||'—']
          ].map(([l,v])=><div key={l} style={{background:C.surface,borderRadius:6,padding:'8px 10px'}}>
            <div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:12,fontWeight:600}}>{v||'—'}</div>
          </div>)}
        </div>
      </div>
    </div>}
  </div>
}

/* ═══ PORTABILIDADE (API QualiBanking) ═══ */
/* ═══ CONSIG360 (API Consig360) ═══ */
function Consig360({user}){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false),[msg,setMsg]=useState('')
  const[per,setPer]=useState('mes'),[customDf,setCustomDf]=useState(''),[customDt,setCustomDt]=useState(''),[trigger,setTrigger]=useState(0)
  const[fBanco,sFBanco]=useState(''),[fStatus,sFStatus]=useState(''),[fProduct,sFProduct]=useState(''),[se,sSe]=useState('')
  const[fPartnerStatus,sFPartnerStatus]=useState('')
  const[selRow,setSelRow]=useState(null),[lastSync,setLastSync]=useState(null)
  const loadData=async()=>{
    setLoading(true)
    let q=supabase.from('consig_proposals').select('*').order('created_at_api',{ascending:false}).limit(6000)
    if(per!=='tudo'){
      const r=PERIODS[per]||PERIODS.tudo
      const df=per==='custom'?(customDf||'2000-01-01'):r.f
      const dt=per==='custom'?(customDt||'2099-12-31'):r.t
      q=q.gte('created_at_api',df).lte('created_at_api',dt+'T23:59:59')
    }
    const{data}=await q
    setRows(data||[])
    const{data:sl}=await supabase.from('sync_logs').select('*').eq('source','consig360').order('started_at',{ascending:false}).limit(1)
    if(sl&&sl[0])setLastSync(sl[0])
    setLoading(false)
  }
  useEffect(()=>{loadData()},[per,trigger])
  const applyCustom=()=>setTrigger(t=>t+1)
  const doSync=async()=>{
    setSyncing(true);setMsg('Sincronizando Consig360...')
    try{
      const r=await fetch('https://rirsmtyuyqxsoxqbgtpu.supabase.co/functions/v1/sync-consig360?mode=incremental&maxPages=20&pageSize=100&delayMs=400')
      const j=await r.json()
      setMsg(j.ok?'✓ '+j.upserted+' propostas sincronizadas':'Erro: '+(j.error||'falhou'))
      await loadData()
    }catch(e){setMsg('Erro: '+e.message)}
    setSyncing(false)
  }
  // Classificadores baseados em partner_status_slug/text
  const isPaid=r=>['Desembolso liberado','Pago'].includes(r.partner_status_text)||r.status==='integrated'
  const isCanceled=r=>['Proposta Cancelada','Cancelado'].includes(r.partner_status_text)
  const isRejected=r=>r.partner_status_text==='Proposta Rejeitada pelo Banco'
  const isWaitingCip=r=>r.partner_status_text==='Aguardando Saldo CIP'
  const isWaitingFinalization=r=>r.partner_status_text==='Aguardando Finalização da portabilidade'
  const isWaitingDocs=r=>['Aguardando documentação','Pendente de Formalização'].includes(r.partner_status_text)
  const isBlocked=r=>['Benefício bloqueado','Beneficio Bloqueado'].includes(r.partner_status_text)
  const isError=r=>r.partner_status_text==='Erro ao digitar a proposta'
  const fd=rows.filter(r=>{
    if(fBanco&&r.bank_name!==fBanco)return false
    if(fStatus&&r.status!==fStatus)return false
    if(fProduct&&r.product!==fProduct)return false
    if(fPartnerStatus&&r.partner_status_text!==fPartnerStatus)return false
    if(se){const s=se.toLowerCase();if(!((r.title||'').toLowerCase().includes(s)||(r.client_cpf||'').includes(s)||(r.partner_contract_id||'').includes(s)))return false}
    return true
  })
  const sumVal=arr=>arr.reduce((s,r)=>s+(Number(r.value)||0),0)
  const paid=fd.filter(isPaid),canceled=fd.filter(isCanceled),rejected=fd.filter(isRejected)
  const waitCip=fd.filter(isWaitingCip),waitFin=fd.filter(isWaitingFinalization),waitDocs=fd.filter(isWaitingDocs)
  const blocked=fd.filter(isBlocked),errored=fd.filter(isError)
  const totalVal=sumVal(fd),paidVal=sumVal(paid),canceledVal=sumVal(canceled),rejectedVal=sumVal(rejected)
  const waitCipVal=sumVal(waitCip),waitFinVal=sumVal(waitFin),waitDocsVal=sumVal(waitDocs),blockedVal=sumVal(blocked)
  // Rankings
  const rankBank=arr=>{const m={};arr.forEach(r=>{const k=r.bank_name||'?';if(!m[k])m[k]={c:0,v:0};m[k].c++;m[k].v+=(Number(r.value)||0)});return Object.entries(m).sort((a,b)=>b[1].v-a[1].v)}
  const rankProduct=arr=>{const m={};arr.forEach(r=>{const k=r.product||'?';if(!m[k])m[k]={c:0,v:0};m[k].c++;m[k].v+=(Number(r.value)||0)});return Object.entries(m).sort((a,b)=>b[1].v-a[1].v)}
  const rankContractBank=arr=>{const m={};arr.forEach(r=>{const k=r.contract_bank_name||r.raw_data?.contract?.bank?.name||'?';if(!m[k])m[k]={c:0,v:0};m[k].c++;m[k].v+=(Number(r.value)||0)});return Object.entries(m).sort((a,b)=>b[1].v-a[1].v)}
  const topBankPaid=rankBank(paid).slice(0,10)
  const topBankAll=rankBank(fd).slice(0,10)
  const topProduct=rankProduct(fd)
  const maxBar=arr=>Math.max(...arr.map(([,x])=>x.v),1)
  const BarRow=({label,value,max,color,count})=>{const pct=(value/max*100)||0;return<div style={{marginBottom:4}}>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:2}}><span style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span><span style={{fontWeight:700,color}}>{fmtCur(value)} <span style={{color:C.muted,fontWeight:400}}>({count})</span></span></div>
    <div style={{height:12,background:C.surface,borderRadius:3}}><div style={{height:'100%',background:color,borderRadius:3,width:pct+'%',transition:'width .3s'}}/></div>
  </div>}
  const bancos=[...new Set(rows.map(r=>r.bank_name).filter(Boolean))].sort()
  const statuses=[...new Set(rows.map(r=>r.status).filter(Boolean))].sort()
  const products=[...new Set(rows.map(r=>r.product).filter(Boolean))].sort()
  const partnerStatuses=[...new Set(rows.map(r=>r.partner_status_text).filter(Boolean))].sort()
  const exportCsv=()=>{
    const dataRows=fd.map(r=>({
      Proposta:r.partner_contract_id,Cliente:r.title,CPF:r.client_cpf,Beneficio:r.benefit_number,
      Produto:r.product,'Banco Destino':r.bank_name,Status:r.status,'Status Parceiro':r.partner_status_text,
      Valor:r.value,Convenio:r.covenant_type,'Data Criação':r.created_at_api,'Última Atualização':r.updated_at_api
    }))
    const ws=XLSX.utils.json_to_sheet(dataRows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Consig360');XLSX.writeFile(wb,'consig360-'+new Date().toISOString().slice(0,10)+'.xlsx')
  }
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,alignItems:'center'}}>
      <div><h2 style={{fontWeight:800,fontSize:20,margin:0}}>Consig360</h2>
      {lastSync&&<div style={{fontSize:9,color:C.muted,marginTop:2}}>Última sync: {new Date(lastSync.started_at).toLocaleString('pt-BR')} — {lastSync.records_upserted||0} registros</div>}</div>
      <div style={{display:'flex',gap:6}}>
        <button onClick={exportCsv} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 Exportar ({fd.length})</button>
        <button onClick={doSync} disabled={syncing} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:syncing?'wait':'pointer',fontWeight:600,fontSize:12,opacity:syncing?.6:1}}>{syncing?'⏳ Sincronizando...':'🔄 Sync Consig360'}</button>
      </div>
    </div>
    {msg&&<div style={{background:msg.includes('✓')?C.accent2+'22':C.warn+'22',color:msg.includes('✓')?C.accent2:C.warn,padding:'8px 14px',borderRadius:8,fontSize:12}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button></div>}
    <PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/>

    {/* KPIs PRINCIPAIS */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
      <div style={{background:C.card,border:'2px solid '+C.text,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.text}}>TOTAL</div>
        <div style={{fontSize:18,fontWeight:800}}>{fmtCur(totalVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{fd.length} propostas</div>
      </div>
      <div style={{background:C.card,border:'2px solid '+C.accent2,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.accent2}}>✅ PAGO</div>
        <div style={{fontSize:18,fontWeight:800,color:C.accent2}}>{fmtCur(paidVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{paid.length} integradas</div>
      </div>
      <div style={{background:C.card,border:'2px solid '+C.warn,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.warn}}>⏳ AGUARD. CIP</div>
        <div style={{fontSize:18,fontWeight:800,color:C.warn}}>{fmtCur(waitCipVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{waitCip.length} aguardando</div>
      </div>
      <div style={{background:C.card,border:'2px solid '+C.accent,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.accent}}>📝 AGUARD. FORM.</div>
        <div style={{fontSize:18,fontWeight:800,color:C.accent}}>{fmtCur(waitFinVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{waitFin.length} aguardando</div>
      </div>
      <div style={{background:C.card,border:'2px solid '+C.info,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.info}}>📂 PEND. DOCS</div>
        <div style={{fontSize:18,fontWeight:800,color:C.info}}>{fmtCur(waitDocsVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{waitDocs.length} pendentes</div>
      </div>
      <div style={{background:C.card,border:'2px solid '+C.danger,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.danger}}>❌ REJEITADA</div>
        <div style={{fontSize:18,fontWeight:800,color:C.danger}}>{fmtCur(rejectedVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{rejected.length} pelo banco</div>
      </div>
      <div style={{background:C.card,border:'2px solid '+C.muted,borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.muted}}>🚫 CANCELADA</div>
        <div style={{fontSize:18,fontWeight:800,color:C.muted}}>{fmtCur(canceledVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{canceled.length} cancel.</div>
      </div>
      <div style={{background:C.card,border:'2px solid #F97316',borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:'#F97316'}}>⚠️ BLOQUEADO</div>
        <div style={{fontSize:18,fontWeight:800,color:'#F97316'}}>{fmtCur(blockedVal)}</div>
        <div style={{fontSize:9,color:C.muted}}>{blocked.length} bloq.</div>
      </div>
    </div>

    {/* FILTROS */}
    <div style={{display:'flex',gap:6,flexWrap:'wrap',background:C.card,border:'1px solid '+C.border,borderRadius:10,padding:'10px 14px',alignItems:'center'}}>
      <input value={se} onChange={e=>sSe(e.target.value)} placeholder="🔍 Cliente, CPF ou proposta..." style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11,flex:1,minWidth:180}}/>
      <select value={fBanco} onChange={e=>sFBanco(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todos bancos</option>{bancos.map(b=><option key={b} value={b}>{b}</option>)}</select>
      <select value={fProduct} onChange={e=>sFProduct(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todos produtos</option>{products.map(p=><option key={p} value={p}>{p}</option>)}</select>
      <select value={fPartnerStatus} onChange={e=>sFPartnerStatus(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todos status parceiro</option>{partnerStatuses.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select value={fStatus} onChange={e=>sFStatus(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todos status</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>
      {(fBanco||fStatus||fProduct||fPartnerStatus||se)&&<button onClick={()=>{sFBanco('');sFStatus('');sFProduct('');sFPartnerStatus('');sSe('')}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.muted,padding:'6px 10px',fontSize:10,cursor:'pointer'}}>✕ Limpar</button>}
    </div>

    {/* RANKINGS */}
    <div className="rg2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.accent2}}>🏦 Top Banco — Pagas</div>
        {topBankPaid.length===0?<div style={{fontSize:10,color:C.muted}}>Sem dados</div>:topBankPaid.map(([k,x])=><BarRow key={k} label={k} value={x.v} count={x.c} max={maxBar(topBankPaid)} color={C.accent2}/>)}
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.accent}}>🏦 Top Banco — Geral</div>
        {topBankAll.length===0?<div style={{fontSize:10,color:C.muted}}>Sem dados</div>:topBankAll.map(([k,x])=><BarRow key={k} label={k} value={x.v} count={x.c} max={maxBar(topBankAll)} color={C.accent}/>)}
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,gridColumn:'1 / -1'}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.info}}>📦 Por Produto</div>
        {topProduct.map(([k,x])=><BarRow key={k} label={k} value={x.v} count={x.c} max={maxBar(topProduct)} color={C.info}/>)}
      </div>
    </div>

    {/* TABELA */}
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Propostas — {fd.length} registros</div>
      <div style={{overflowX:'auto',maxHeight:500,borderRadius:8,border:'1px solid '+C.border}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead><tr style={{background:C.surface,position:'sticky',top:0,zIndex:1}}>{['Data','Proposta','Cliente','CPF','Banco','Produto','Valor','Status Parceiro','Link'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
          <tbody>{fd.slice(0,500).map(r=><tr key={r.id} onClick={()=>setSelRow(r)} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
            <td style={{padding:'5px 8px',whiteSpace:'nowrap',fontSize:9}}>{r.created_at_api?new Date(r.created_at_api).toLocaleDateString('pt-BR'):'—'}</td>
            <td style={{padding:'5px 8px',fontWeight:600,fontSize:10}}>{r.partner_contract_id||'—'}</td>
            <td style={{padding:'5px 8px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</td>
            <td style={{padding:'5px 8px',fontSize:9,fontFamily:'monospace'}}>{r.client_cpf}</td>
            <td style={{padding:'5px 8px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:9}}>{r.bank_name}</td>
            <td style={{padding:'5px 8px',fontSize:9}}>{r.product}</td>
            <td style={{padding:'5px 8px',fontWeight:600,color:C.accent}}>{fmtCur(r.value)}</td>
            <td style={{padding:'5px 8px'}}><span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:(isPaid(r)?C.accent2:isRejected(r)||isCanceled(r)?C.danger:isWaitingCip(r)||isWaitingFinalization(r)?C.warn:isWaitingDocs(r)?C.info:C.muted)+'22',color:isPaid(r)?C.accent2:isRejected(r)||isCanceled(r)?C.danger:isWaitingCip(r)||isWaitingFinalization(r)?C.warn:isWaitingDocs(r)?C.info:C.muted,fontWeight:600}}>{r.partner_status_text||r.status||'—'}</span></td>
            <td style={{padding:'5px 8px'}} onClick={e=>e.stopPropagation()}>{r.client_formalization_url?<a href={r.client_formalization_url} target="_blank" rel="noopener noreferrer" style={{fontSize:14,textDecoration:'none'}} title="Link de formalização">🔗</a>:<span style={{color:C.muted,fontSize:10}}>—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    {/* MODAL DETALHES */}
    {selRow&&<div onClick={()=>setSelRow(null)} style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,width:720,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto',padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
          <h3 style={{margin:0,fontSize:16}}>{selRow.title}</h3>
          <button onClick={()=>setSelRow(null)} style={{background:'none',border:'none',color:C.muted,fontSize:24,cursor:'pointer'}}>×</button>
        </div>
        <div style={{fontSize:10,color:C.muted,marginBottom:10}}>Proposta {selRow.partner_contract_id} · CPF {selRow.client_cpf} · Benefício {selRow.benefit_number||'—'}</div>
        {selRow.client_formalization_url&&<div style={{marginBottom:14}}>
          <a href={selRow.client_formalization_url} target="_blank" rel="noopener noreferrer" style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6}}>🔗 Link de Formalização (Cliente)</a>
        </div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {[
            ['Status',selRow.status],['Status Parceiro',selRow.partner_status_text],
            ['Banco',selRow.bank_name],['Produto',selRow.product],
            ['Valor',fmtCur(selRow.value)],['Vl. Líquido',fmtCur(selRow.net_value)],
            ['Saldo Devedor',fmtCur(selRow.debit_balance)],['Parcela',fmtCur(selRow.installment_value)],
            ['Prazo',selRow.term?selRow.term+' meses':'—'],['Convênio',selRow.covenant_type],
            ['Número CIP',selRow.portability_number||'—'],['Retorno Esperado CIP',selRow.expected_balance_date?fmtDate(selRow.expected_balance_date):'—'],
            ['Data Criação',selRow.created_at_api?new Date(selRow.created_at_api).toLocaleString('pt-BR'):'—'],
            ['Última Atualização',selRow.updated_at_api?new Date(selRow.updated_at_api).toLocaleString('pt-BR'):'—'],
            ['Data Contrato',selRow.contract_date?new Date(selRow.contract_date).toLocaleDateString('pt-BR'):'—'],
            ['Data Pagamento',selRow.pay_date?fmtDate(selRow.pay_date):'—']
          ].map(([l,v])=><div key={l} style={{background:C.surface,borderRadius:6,padding:'8px 10px'}}>
            <div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:12,fontWeight:600}}>{v||'—'}</div>
          </div>)}
        </div>
        {selRow.description&&<div style={{background:C.warn+'15',border:'1px solid '+C.warn+'44',borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{fontSize:9,fontWeight:600,color:C.warn,marginBottom:3}}>DESCRIÇÃO</div>
          <div style={{fontSize:11}}>{selRow.description}</div>
        </div>}
        {/* Timeline */}
        {selRow.timeline&&selRow.timeline.length>0&&<div>
          <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:C.muted}}>📜 Timeline de Status</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:300,overflowY:'auto'}}>
            {selRow.timeline.map((ev,i)=><div key={i} style={{background:C.surface,borderRadius:6,padding:'8px 10px',borderLeft:'3px solid '+C.accent}}>
              <div style={{fontSize:11,fontWeight:700}}>{ev.partnerStatus?.displayText||ev.status}</div>
              <div style={{fontSize:9,color:C.muted}}>{ev.createdAt?new Date(ev.createdAt).toLocaleString('pt-BR'):''}</div>
              {ev.description&&<div style={{fontSize:10,marginTop:2}}>{ev.description}</div>}
            </div>)}
          </div>
        </div>}
      </div>
    </div>}
  </div>
}

function Portabilidade({filterParceiroId,user,myAgents}={}){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false),[msg,setMsg]=useState('')
  const[pendRows,setPendRows]=useState([])  // pendências ATIVAS (com atividade recente) para card CIP a Retornar
  const[pendExpiradas,setPendExpiradas]=useState(0)  // pendências sem atividade +60d (fora dos cards)
  const[per,setPer]=useState('mes'),[customDf,setCustomDf]=useState(''),[customDt,setCustomDt]=useState(''),[trigger,setTrigger]=useState(0)
  const[fBanco,sFBanco]=useState(''),[fStatus,sFStatus]=useState(''),[fOp,sFOp]=useState(''),[se,sSe]=useState('')
  const[fDataRetornoDe,sFDataRetornoDe]=useState(''),[fDataRetornoAte,sFDataRetornoAte]=useState('')
  const[fParceiro,sFParceiro]=useState('')    // admin seleciona parceiro
  const[fSource,sFSource]=useState('all')     // 'all' | 'quali' | 'consig360'
  const[allParceiros,setAllParceiros]=useState([])
  const[selRow,setSelRow]=useState(null),[lastSync,setLastSync]=useState(null)
  const[parceiroInfo,setParceiroInfo]=useState(null)
  const[kpiDrilldown,setKpiDrilldown]=useState(null)  // {type, label, items, color}
  const isParceiroView=!!filterParceiroId
  // ID efetivo: prop (parceiro logado) OU filtro admin
  const effectiveParceiroId=filterParceiroId||fParceiro||null
  useEffect(()=>{
    if(filterParceiroId){
      supabase.from('parceiros').select('nome,telefone').eq('id',filterParceiroId).single().then(({data})=>setParceiroInfo(data))
    } else {
      // Admin: carrega lista de parceiros pra dropdown
      supabase.from('parceiros').select('id,nome,telefone').eq('ativo',true).order('nome').then(({data})=>setAllParceiros(data||[]))
    }
  },[filterParceiroId])
  const loadData=async()=>{
    setLoading(true)
    // Período
    let df='2000-01-01',dt='2099-12-31'
    if(per!=='tudo'){
      const r=PERIODS[per]||PERIODS.tudo
      df=per==='custom'?(customDf||'2000-01-01'):r.f
      dt=per==='custom'?(customDt||'2099-12-31'):r.t
    }
    // Fonte 1: QualiBanking
    const qualiTable='portabilidades_enriched'  // sempre usar view pra trazer parceiro
    let q1=supabase.from(qualiTable).select('*').order('proposal_date',{ascending:false}).limit(5000)
    if(effectiveParceiroId)q1=q1.eq('parceiro_id',effectiveParceiroId)
    if(per!=='tudo')q1=q1.gte('proposal_date',df).lte('proposal_date',dt)
    // Fonte 2: Consig360 (apenas produtos de portabilidade)
    // Se é view de parceiro, precisa filtrar por squad_user_name (nome do parceiro)
    let parceiroNomeFilter=null
    if(effectiveParceiroId){
      // Se tem parceiroInfo (parceiro logado) ou fParceiro (admin selecionou), buscar o nome
      if(parceiroInfo?.nome)parceiroNomeFilter=parceiroInfo.nome
      else{
        const match=allParceiros.find(p=>p.id===effectiveParceiroId)
        if(match)parceiroNomeFilter=match.nome
      }
    }
    let q2=supabase.from('consig_proposals').select('*').ilike('product','%portab%').order('created_at_api',{ascending:false}).limit(6000)
    if(per!=='tudo')q2=q2.gte('created_at_api',df).lte('created_at_api',dt+'T23:59:59')
    if(parceiroNomeFilter)q2=q2.ilike('squad_user_name',parceiroNomeFilter)
    // Fonte 3: Pendências CIP (TUDO, sem filtro de período) — pra card "CIP a Retornar"
    const ACTIVE_QUALI_STATUS=['awaiting_portability','awaiting_formalization','awaiting_cip','awaiting_send_to_cip','awaiting_endorsement','awaiting_manual_analysis','documents_not_found','proposal_cadastrada','accepted']
    const ACTIVE_CONSIG_STATUS=['Aguardando Saldo CIP','Aguardando Finalização da portabilidade','Aguardando documentação','Pendente de Formalização','Aguardando assinatura','Aguardando CCB','Aguardando a finalização do contrato de portabilidade']
    let qP1=supabase.from(qualiTable).select('*').eq('origin_due_balance_returned',false).in('status_key',ACTIVE_QUALI_STATUS).limit(5000)
    if(effectiveParceiroId)qP1=qP1.eq('parceiro_id',effectiveParceiroId)
    let qP2=supabase.from('consig_proposals').select('*').ilike('product','%portab%').in('partner_status_text',ACTIVE_CONSIG_STATUS).limit(5000)
    if(parceiroNomeFilter)qP2=qP2.ilike('squad_user_name',parceiroNomeFilter)
    const [r1,r2,rP1,rP2]=await Promise.all([q1,q2,qP1,qP2])
    const qualiRows=(r1.data||[]).map(r=>normalizeQuali(r))
    const consigRows=(r2.data||[]).map(r=>normalizeConsig(r))
    // Filtro por equipe (cod_supervisor): só mantém propostas dos agentes do supervisor
    const teamFilter=(arr)=>myAgents?arr.filter(r=>{
      const p=r.parceiro_nome||r.squad_user_name||''
      return myAgents.has(p)
    }):arr
    setRows(teamFilter([...qualiRows,...consigRows]).sort((a,b)=>(b.proposal_date||'').localeCompare(a.proposal_date||'')))
    const qualiPend=(rP1.data||[]).map(r=>normalizeQuali(r))
    const consigPend=(rP2.data||[]).map(r=>normalizeConsig(r))
    const allPend=teamFilter([...qualiPend,...consigPend])
    // Corte de atividade: pendência sem update há +60d = expirada (sync parado / proposta morta) — sai dos cards
    const freshPend=allPend.filter(r=>!isOldPend(r._source==='quali'?(r.status_date||r.updated_at):(r.updated_at_api||r.created_at_api)))
    setPendRows(freshPend)
    setPendExpiradas(allPend.length-freshPend.length)
    const{data:sl}=await supabase.from('sync_logs').select('*').in('source',['qualibanking','consig360']).order('started_at',{ascending:false}).limit(1)
    if(sl&&sl[0])setLastSync(sl[0])
    setLoading(false)
  }
  // Normalizadores: transformam rows de cada fonte em estrutura unificada
  function normalizeQuali(r){
    return {
      ...r,
      _source:'quali',
      _src_label:'QualiBanking',
      _src_color:'#3B82F6',
      // Garante campos na estrutura padrão
      external_id:r.quali_id,
      client_name:r.borrower_name,
      client_cpf:r.borrower_identity,
      client_phone:r.borrower_phone
    }
  }
  function normalizeConsig(r){
    // Mapear partner_status_text para status_color aproximado
    const st=r.partner_status_text||r.status||''
    const isP=['Desembolso liberado','Pago'].includes(st)||r.status==='integrated'
    const isR=st==='Proposta Rejeitada pelo Banco'
    const isC=['Proposta Cancelada','Cancelado'].includes(st)
    const isWaitCip=st==='Aguardando Saldo CIP'
    const isWaitFin=st==='Aguardando Finalização da portabilidade'
    const isWaitDocs=['Aguardando documentação','Pendente de Formalização'].includes(st)
    const color=isP?C.accent2:isR||isC?C.danger:isWaitCip||isWaitFin?C.warn:isWaitDocs?C.info:C.muted
    // Status_key mapeado para a mesma taxonomia da Quali (pra isEnviado/isChegou/etc)
    const status_key=isP?'integrated':isR?'rejected_ctc':isC?'canceled':isWaitCip?'awaiting_portability':isWaitFin?'awaiting_formalization':isWaitDocs?'documents_not_found':(r.status||'unknown')
    // Saldo chegou: se status indicar que passou da CIP
    const balanceReturned=isP||isWaitFin
    return {
      ...r,
      _source:'consig360',
      _src_label:'Consig360',
      _src_color:'#F97316',
      external_id:r.consig_id,
      // Normaliza campos para match com estrutura Quali
      proposal_number:r.partner_contract_id,
      client_name:r.title,
      client_cpf:r.client_cpf,
      client_phone:null,
      borrower_name:r.title,
      borrower_identity:r.client_cpf,
      borrower_phone:null,
      origin_bank_name:r.contract_bank_name||'(pendente enrich)',  // DEVIDO AO ENRICH
      origin_bank_code:r.contract_bank_febraban_code,
      destination_bank_name:r.bank_name,
      destination_bank_code:r.bank_febraban_code,
      operation_type:r.product,
      status_name:st,
      status_color:color,
      status_key,
      loan_value:r.value,
      net_value:r.net_value,
      origin_due_balance:r.debit_balance||r.value,
      origin_due_balance_returned:balanceReturned,
      origin_due_balance_date:r.pay_date||null,
      origin_due_balance_expected_date:r.expected_balance_date||null,
      proposal_date:r.created_at_api,
      contract_date:r.contract_date,
      cip_submission_date:null,
      portability_number:r.portability_number,
      formalization_url:r.client_formalization_url,
      document_url:null,
      installment_value:r.installment_value,
      rate:r.contract_rate||0,
      term:r.term,
      origin_installments_paid:r.contract_installments_paid,
      origin_installments_remaining:r.term?(r.term-(r.contract_installments_paid||0)):null,
      assigned:null,
      // PARCEIRO real do Consig360 (squadUser = promotora)
      parceiro_nome:r.squad_user_name||null,
      agente_digitacao:r.squad_user_name||null
    }
  }
  useEffect(()=>{loadData()},[per,trigger,fParceiro,parceiroInfo,allParceiros.length,myAgents])
  const applyCustom=()=>setTrigger(t=>t+1)
  const doSync=async()=>{
    setSyncing(true);setMsg('Sincronizando com QualiBanking...')
    try{
      const today=new Date(),from=new Date(today);from.setDate(from.getDate()-30)
      const resp=await fetch('https://rirsmtyuyqxsoxqbgtpu.supabase.co/functions/v1/sync-qualibanking?from='+localDate(from)+'&to='+localDate(today)+'&onlyPortability=true',{method:'GET'})
      const j=await resp.json()
      if(j.ok){setMsg('✓ '+j.upserted+' portabilidades sincronizadas ('+j.daysWithData+' dias com dados)');await loadData()}
      else setMsg('Erro: '+(j.error||'desconhecido'))
    }catch(e){setMsg('Erro: '+e.message)}
    setSyncing(false)
  }
  // Classificação por status — critérios baseados no fluxo real QualiBanking
  // Aguardando Formalização / Documentos Não Encontrados = AINDA NÃO FORAM para CIP
  // Enviado CIP = foi efetivamente para a Câmara. Indicadores: número CIP, cipSubmissionDate, saldo retornou, retido, rejeitado CTC, integrado
  const CIP_STATUS_AFTER=['retained','rejected_ctc','integrated','sent_to_cip','awaiting_portability','proposal_expired']
  const isEnviado=r=>!!(r.portability_number||r.cip_submission_date||r.origin_due_balance_returned||r.origin_due_balance_date||CIP_STATUS_AFTER.includes(r.status_key))
  // Chegou CIP = saldo efetivamente retornou da Câmara
  const isChegou=r=>!!r.origin_due_balance_returned
  // Pré-CIP = ainda no fluxo, mas não foi pra CIP
  const isPreCip=r=>['awaiting_formalization','documents_not_found','proposal_cadastrada','accepted'].includes(r.status_key)&&!isEnviado(r)
  const isPago=r=>r.status_key==='integrated'
  const isNaoPago=r=>['canceled','rejected_ctc','proposal_expired','canceled_by_customer'].includes(r.status_key)
  const isRetido=r=>r.status_key==='retained'
  const isTrocoNeg=r=>(r.net_value||0)<0
  // CIP do dia (com base na data que chegou o saldo)
  const hoje=localDate(new Date())
  const isChegouHoje=r=>r.origin_due_balance_date&&String(r.origin_due_balance_date).slice(0,10)===hoje
  const isEsperaHoje=r=>r.origin_due_balance_expected_date&&String(r.origin_due_balance_expected_date).slice(0,10)===hoje&&!r.origin_due_balance_returned
  // Filtros
  const fd=rows.filter(r=>{
    if(fSource!=='all'&&r._source!==fSource)return false
    // Filtro parceiro: para Quali vem via query SQL; para Consig360 comparamos squad_user_name com nome do parceiro selecionado
    if(fParceiro&&r._source==='consig360'){
      const selParc=allParceiros.find(p=>p.id===fParceiro)
      if(!selParc)return false
      if(!r.parceiro_nome||r.parceiro_nome.toUpperCase().trim()!==selParc.nome.toUpperCase().trim())return false
    }
    if(fBanco&&r.origin_bank_name!==fBanco&&r.destination_bank_name!==fBanco)return false
    if(fStatus&&r.status_name!==fStatus)return false
    if(fOp&&r.operation_type!==fOp)return false
    if(se){const s=se.toLowerCase();if(!((r.borrower_name||'').toLowerCase().includes(s)||(r.borrower_identity||'').includes(s)||(r.proposal_number||'').includes(s)||(r.contract_number||'').toLowerCase().includes(s)))return false}
    if(fDataRetornoDe||fDataRetornoAte){
      const dt=r.origin_due_balance_date?String(r.origin_due_balance_date).slice(0,10):''
      if(!dt)return false
      if(fDataRetornoDe&&dt<fDataRetornoDe)return false
      if(fDataRetornoAte&&dt>fDataRetornoAte)return false
    }
    return true
  })
  // KPIs
  const sumBal=arr=>arr.reduce((s,r)=>s+(Number(r.origin_due_balance)||0),0)
  const sumLoan=arr=>arr.reduce((s,r)=>s+(Number(r.loan_value)||0),0)
  const enviadas=fd.filter(isEnviado),chegou=fd.filter(isChegou),pagas=fd.filter(isPago),naoPagas=fd.filter(isNaoPago),retidas=fd.filter(isRetido),trocoNeg=fd.filter(isTrocoNeg)
  // A Chegar da CIP: portabilidades no fluxo CIP que ainda não retornaram (enviadas mas saldo não chegou, excluindo terminais)
  const TERMINAL_STATUS=['integrated','canceled','canceled_by_customer','rejected_ctc','proposal_expired','retained']
  const aChegarCip=fd.filter(r=>isEnviado(r)&&!isChegou(r)&&!TERMINAL_STATUS.includes(r.status_key))
  const totalEnviado=sumBal(enviadas),totalChegou=sumBal(chegou),totalPago=sumBal(pagas),totalNaoPago=sumBal(naoPagas),totalRetido=sumBal(retidas),totalTrocoNeg=sumLoan(trocoNeg)
  const totalAChegar=sumBal(aChegarCip)
  const naoChegou=totalEnviado-totalChegou
  const pctChegou=totalEnviado?(totalChegou/totalEnviado*100):0
  const pctPagoChegou=totalChegou?(totalPago/totalChegou*100):0
  const pctPagoEnviado=totalEnviado?(totalPago/totalEnviado*100):0
  const pctNaoPagoChegou=totalChegou?(totalNaoPago/totalChegou*100):0
  const pctRetencao=totalEnviado?(totalRetido/totalEnviado*100):0
  // Rankings por banco origem
  const rank=(filterFn,field)=>{
    const m={}
    fd.filter(filterFn).forEach(r=>{const k=r[field]||'?';if(!m[k])m[k]={c:0,v:0};m[k].c++;m[k].v+=(Number(r.origin_due_balance)||0)})
    return Object.entries(m).sort((a,b)=>b[1].v-a[1].v)
  }
  const topEnviado=rank(isEnviado,'origin_bank_name').slice(0,15)
  const topChegou=rank(isChegou,'origin_bank_name').slice(0,10)
  const topPago=rank(isPago,'origin_bank_name').slice(0,10)
  const topPctChegou=(()=>{
    const m={}
    fd.filter(isEnviado).forEach(r=>{const k=r.origin_bank_name||'?';if(!m[k])m[k]={env:0,ch:0};m[k].env+=(Number(r.origin_due_balance)||0)})
    fd.filter(isChegou).forEach(r=>{const k=r.origin_bank_name||'?';if(m[k])m[k].ch+=(Number(r.origin_due_balance)||0)})
    return Object.entries(m).filter(([,x])=>x.env>0).map(([k,x])=>[k,{pct:x.ch/x.env*100,env:x.env,ch:x.ch}]).sort((a,b)=>b[1].pct-a[1].pct).slice(0,10)
  })()
  // BANCOS QUE MAIS RETÊM SALDO (pior % de retorno) - excluindo Quali/QI Tech
  const bancosRetem=(()=>{
    const m={}
    fd.forEach(r=>{
      const k=r.origin_bank_name||'?'
      if(k==='?'||k==='Quali'||k==='QI Tech')return
      if(!isEnviado(r))return
      if(!m[k])m[k]={env:0,ch:0,envVal:0,chVal:0,pending:0,pendingVal:0}
      m[k].env++
      m[k].envVal+=(Number(r.origin_due_balance)||0)
      if(isChegou(r)){m[k].ch++;m[k].chVal+=(Number(r.origin_due_balance)||0)}
      else if(!TERMINAL_STATUS.includes(r.status_key)){m[k].pending++;m[k].pendingVal+=(Number(r.origin_due_balance)||0)}
    })
    return Object.entries(m)
      .filter(([,x])=>x.env>=3)  // mínimo 3 propostas pra dar ranking
      .map(([k,x])=>[k,{pct:x.ch/x.env*100,env:x.env,ch:x.ch,envVal:x.envVal,chVal:x.chVal,pending:x.pending,pendingVal:x.pendingVal}])
      .sort((a,b)=>a[1].pct-b[1].pct)  // ordem crescente = pior primeiro
      .slice(0,10)
  })()
  const bancos=[...new Set(rows.flatMap(r=>[r.origin_bank_name,r.destination_bank_name]).filter(Boolean))].sort()
  const statuses=[...new Set(rows.map(r=>r.status_name).filter(Boolean))].sort()
  const operations=[...new Set(rows.map(r=>r.operation_type).filter(Boolean))].sort()
  const maxBar=arr=>Math.max(...arr.map(([,x])=>x.v||x.pct||0),1)
  const BarRow=({label,value,max,color,fmt})=>{const pct=(value/max*100)||0;return<div style={{marginBottom:4}}>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:2}}><span style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span><span style={{fontWeight:700,color}}>{fmt(value)}</span></div>
    <div style={{height:14,background:C.surface,borderRadius:3,position:'relative'}}><div style={{height:'100%',background:color,borderRadius:3,width:pct+'%',transition:'width .3s'}}/></div>
  </div>}
  const exportPortab=()=>{
    const dataRows=fd.map(r=>({
      Proposta:r.contract_number||r.proposal_number,'ID Proposta Interno':r.proposal_number,CPF:r.borrower_identity,Cliente:r.borrower_name,Telefone:r.borrower_phone,
      Operação:r.operation_type,Status:r.status_name,'Banco Origem':r.origin_bank_name,'Banco Destino':r.destination_bank_name,
      'Saldo Devedor':r.origin_due_balance,'Vl. Bruto':r.loan_value,'Vl. Líquido (Troco)':r.net_value,
      Parcela:r.installment_value,Prazo:r.term,Taxa:r.rate,
      'Data Proposta':r.proposal_date,'Data Contrato':r.contract_date,'Enviado CIP':r.cip_submission_date,
      'Retorno Esperado CIP':r.origin_due_balance_expected_date,'Saldo Chegou':r.origin_due_balance_returned?'Sim':'Não',
      'Parcelas Pagas':r.origin_installments_paid,'Parcelas Restantes':r.origin_installments_remaining
    }))
    const ws=XLSX.utils.json_to_sheet(dataRows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Portabilidades');XLSX.writeFile(wb,'portabilidades-'+new Date().toISOString().slice(0,10)+'.xlsx')
  }
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,alignItems:'center'}}>
      <div><h2 style={{fontWeight:800,fontSize:20,margin:0}}>{isParceiroView?'Meu Portal':'Portabilidade'}</h2>
      {isParceiroView&&parceiroInfo&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>👤 {parceiroInfo.nome}{parceiroInfo.telefone?' · '+parceiroInfo.telefone:''}</div>}
      {!isParceiroView&&<div style={{fontSize:9,color:C.muted,marginTop:2}}>{rows.length} registros no período · {pendRows.length} pendências abertas{pendExpiradas>0?` · 🗄️ ${pendExpiradas} expiradas ocultas (+${OLD_PEND_DAYS}d sem atividade)`:''}{lastSync?` · última sync: ${new Date(lastSync.started_at).toLocaleString('pt-BR')} (${lastSync.records_upserted||0} novas/atualizadas)`:''}</div>}</div>
      <div style={{display:'flex',gap:6}}>
        {canManage()&&<button onClick={exportPortab} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 Exportar ({fd.length})</button>}
        {!isParceiroView&&canManage()&&<button onClick={doSync} disabled={syncing} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:syncing?'wait':'pointer',fontWeight:600,fontSize:12,opacity:syncing?.6:1}}>{syncing?'⏳ Sincronizando...':'🔄 Sync QualiBanking'}</button>}
      </div>
    </div>
    {msg&&<div style={{background:msg.includes('✓')?C.accent2+'22':C.warn+'22',color:msg.includes('✓')?C.accent2:C.warn,padding:'8px 14px',borderRadius:8,fontSize:12}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button></div>}
    <PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/>

    {/* CIP DO DIA — movimentos de hoje */}
    {(()=>{
      const chegouHoje=rows.filter(isChegouHoje),esperaHoje=rows.filter(isEsperaHoje)
      const pagoHoje=rows.filter(r=>r.status_key==='integrated'&&r.status_date&&String(r.status_date).slice(0,10)===hoje)
      const totalChegouHoje=sumBal(chegouHoje),totalEsperaHoje=sumBal(esperaHoje),totalPagoHoje=sumBal(pagoHoje)
      const temMov=chegouHoje.length+esperaHoje.length+pagoHoje.length>0
      return<div style={{background:C.card,border:'2px solid '+C.accent2+'55',borderRadius:14,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
          <div style={{fontSize:13,fontWeight:800,color:C.accent2}}>📅 CIP do Dia — {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</div>
          <div style={{fontSize:9,color:C.muted}}>Movimentos de CIP registrados hoje</div>
        </div>
        {!temMov?<div style={{textAlign:'center',color:C.muted,fontSize:11,padding:14}}>Sem movimentos de CIP registrados hoje.</div>:<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
            <div style={{background:C.accent2+'15',borderLeft:'4px solid '+C.accent2,borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:9,fontWeight:700,color:C.accent2}}>🟢 CHEGOU SALDO HOJE</div>
              <div style={{fontSize:20,fontWeight:800,color:C.accent2}}>{chegouHoje.length}</div>
              <div style={{fontSize:11,fontWeight:600,color:C.accent2}}>{fmtCur(totalChegouHoje)}</div>
            </div>
            <div style={{background:C.warn+'15',borderLeft:'4px solid '+C.warn,borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:9,fontWeight:700,color:C.warn}}>⏳ ESPERA RETORNO HOJE</div>
              <div style={{fontSize:20,fontWeight:800,color:C.warn}}>{esperaHoje.length}</div>
              <div style={{fontSize:11,fontWeight:600,color:C.warn}}>{fmtCur(totalEsperaHoje)}</div>
            </div>
            <div style={{background:C.accent+'15',borderLeft:'4px solid '+C.accent,borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:9,fontWeight:700,color:C.accent}}>💰 INTEGRADA HOJE</div>
              <div style={{fontSize:20,fontWeight:800,color:C.accent}}>{pagoHoje.length}</div>
              <div style={{fontSize:11,fontWeight:600,color:C.accent}}>{fmtCur(totalPagoHoje)}</div>
            </div>
          </div>
          {chegouHoje.length>0&&<div style={{marginTop:12,overflowX:'auto'}}>
            <div style={{fontSize:10,fontWeight:700,color:C.accent2,marginBottom:4}}>Saldos chegados hoje:</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
              <thead><tr style={{background:C.surface}}>{['Cliente','Banco Origem','Saldo','Status'].map(h=><th key={h} style={{padding:'4px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
              <tbody>{chegouHoje.map(r=><tr key={r.id} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'4px 8px',fontWeight:600}}>{r.borrower_name}</td>
                <td style={{padding:'4px 8px',fontSize:9}}>{r.origin_bank_name}</td>
                <td style={{padding:'4px 8px',fontWeight:600,color:C.accent2}}>{fmtCur(r.origin_due_balance)}</td>
                <td style={{padding:'4px 8px'}}><span style={{fontSize:9,padding:'1px 6px',borderRadius:4,background:(r.status_color||C.muted)+'22',color:r.status_color||C.muted,fontWeight:600}}>{r.status_name}</span></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </>}
      </div>
    })()}

    {/* CALENDÁRIO CIP - PRÓXIMOS 5 DIAS ÚTEIS */}
    {(()=>{
      const next5=[];const d=new Date(NOW);d.setDate(d.getDate()+1)
      while(next5.length<5){if(d.getDay()!==0&&d.getDay()!==6)next5.push(localDate(d));d.setDate(d.getDate()+1)}
      const comData=pendRows.filter(r=>{
        if(!r.origin_due_balance_expected_date)return false
        if(r.origin_due_balance_returned)return false
        if(TERMINAL_STATUS.includes(r.status_key))return false
        const dt=String(r.origin_due_balance_expected_date).slice(0,10)
        return next5.includes(dt)
      })
      const semData=pendRows.filter(r=>{
        if(r.origin_due_balance_expected_date)return false
        if(r.origin_due_balance_returned)return false
        return true
      })
      // Agrupar por dia (clientes)
      const byDay={};next5.forEach(dt=>byDay[dt]={clients:{},total:0,count:0})
      comData.forEach(r=>{
        const dt=String(r.origin_due_balance_expected_date).slice(0,10)
        if(!byDay[dt])return
        const k=r.borrower_identity||r.client_cpf||r.borrower_name
        if(!byDay[dt].clients[k])byDay[dt].clients[k]={name:r.borrower_name,banks:new Set(),total:0,count:0,parceiro:r.parceiro_nome,source:r._source}
        byDay[dt].clients[k].banks.add(r.origin_bank_name)
        byDay[dt].clients[k].total+=(Number(r.origin_due_balance)||0)
        byDay[dt].clients[k].count++
        byDay[dt].total+=(Number(r.origin_due_balance)||0)
      })
      // Agrupar COM DATA (5 dias) por parceiro
      const byParcComData={}
      comData.forEach(r=>{
        const p=r.parceiro_nome||'(Sem parceiro)'
        const k=r.borrower_identity||r.client_cpf||r.borrower_name
        if(!byParcComData[p])byParcComData[p]={parceiro:p,clients:{},total:0,items:[]}
        if(!byParcComData[p].clients[k])byParcComData[p].clients[k]={name:r.borrower_name,total:0}
        byParcComData[p].clients[k].total+=(Number(r.origin_due_balance)||0)
        byParcComData[p].total+=(Number(r.origin_due_balance)||0)
        byParcComData[p].items.push(r)
      })
      const parcComDataList=Object.values(byParcComData).map(p=>({...p,qtdClients:Object.keys(p.clients).length})).sort((a,b)=>b.total-a.total)
      // Por parceiro das sem data
      const byParcSem={}
      semData.forEach(r=>{
        const p=r.parceiro_nome||'(Sem parceiro)'
        const k=r.borrower_identity||r.client_cpf||r.borrower_name
        if(!byParcSem[p])byParcSem[p]={parceiro:p,clients:{},total:0,items:[]}
        if(!byParcSem[p].clients[k])byParcSem[p].clients[k]={name:r.borrower_name,total:0}
        byParcSem[p].clients[k].total+=(Number(r.origin_due_balance)||0)
        byParcSem[p].total+=(Number(r.origin_due_balance)||0)
        byParcSem[p].items.push(r)
      })
      const parcSemList=Object.values(byParcSem).map(p=>({...p,qtdClients:Object.keys(p.clients).length})).sort((a,b)=>b.total-a.total)
      const totalCom=Object.values(byDay).reduce((s,d)=>s+d.total,0)
      const totalClientsCom=Object.values(byDay).reduce((s,d)=>s+Object.keys(d.clients).length,0)
      const totalSemClients=parcSemList.reduce((s,p)=>s+p.qtdClients,0)
      const totalSem=parcSemList.reduce((s,p)=>s+p.total,0)
      // Helper: clicar em parceiro abre KPI drilldown
      const openParcDrilldown=(parc,items,label)=>setKpiDrilldown({type:'partner-days',label:label+': '+parc.parceiro+' — '+parc.qtdClients+' clientes',items,color:C.warn})
      return<div style={{background:C.card,border:'2px solid '+C.warn+'66',borderRadius:14,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:6}}>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:C.warn}}>⏳ CIP a Retornar — Próximos 5 Dias Úteis</div>
            <div style={{fontSize:10,color:C.muted}}>Saldos aguardando retorno · Clique no parceiro para ver propostas</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,color:C.muted}}>Total esperado</div>
            <div style={{fontSize:16,fontWeight:700,color:C.warn}}>{fmtCur(totalCom+totalSem)}</div>
            <div style={{fontSize:10,color:C.muted}}>{totalClientsCom+totalSemClients} clientes</div>
          </div>
        </div>
        {/* GRID DIAS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          {next5.map(dt=>{const d=byDay[dt];const dtObj=new Date(dt+'T12:00:00');const label=dtObj.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','');const clients=Object.values(d.clients);const has=clients.length>0;return<div key={dt} style={{background:has?C.warn+'15':C.surface,border:'1px solid '+(has?C.warn+'44':C.border),borderRadius:10,padding:10,opacity:has?1:.5}}>
            <div style={{fontSize:10,fontWeight:700,color:C.warn,marginBottom:4,textTransform:'capitalize'}}>{label}</div>
            <div style={{fontSize:16,fontWeight:800,color:has?C.warn:C.muted}}>{clients.length}</div>
            <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{fmtCur(d.total)}</div>
            {has&&<div style={{marginTop:6,fontSize:9,maxHeight:100,overflowY:'auto'}}>
              {clients.slice(0,5).map((c,i)=><div key={i} style={{padding:'3px 0',borderTop:i>0?'1px solid '+C.border:'none'}}>
                <div style={{fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</div>
                {c.parceiro&&<div style={{color:C.accent,fontSize:8,fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>👤 {c.parceiro}</div>}
                <div style={{color:C.muted,fontSize:8}}>{[...c.banks].join(', ')||'—'}{c.count>1?' ('+c.count+' prop.)':''}</div>
                <div style={{fontWeight:600,color:C.warn,fontSize:9}}>{fmtCur(c.total)}</div>
              </div>)}
              {clients.length>5&&<div style={{marginTop:3,color:C.accent,fontSize:9,fontWeight:600}}>+{clients.length-5} outros...</div>}
            </div>}
          </div>})}
        </div>
        {/* POR PARCEIRO - PRÓXIMOS 5 DIAS (COM DATA) */}
        {parcComDataList.length>0&&<div style={{marginTop:14,background:C.warn+'08',borderRadius:10,padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:C.warn,marginBottom:8}}>📅 Por Parceiro nos Próximos 5 Dias — {totalClientsCom} clientes · {fmtCur(totalCom)}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>
            {parcComDataList.slice(0,12).map(pr=><div key={pr.parceiro} onClick={()=>openParcDrilldown(pr,pr.items,'Próximos 5 dias')} style={{background:C.card,border:'1px solid '+C.warn+'66',borderRadius:8,padding:'10px 12px',cursor:'pointer',transition:'transform .1s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.warn} onMouseLeave={e=>e.currentTarget.style.borderColor=C.warn+'66'}>
              <div style={{fontSize:10,fontWeight:700,color:C.warn,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',justifyContent:'space-between'}}><span>{pr.parceiro}</span><span style={{fontSize:9,opacity:.6}}>→</span></div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontSize:16,fontWeight:800}}>{pr.qtdClients}</div>
                <div style={{fontSize:10,color:C.muted}}>cliente{pr.qtdClients>1?'s':''}</div>
              </div>
              <div style={{fontSize:11,fontWeight:600,color:C.warn}}>{fmtCur(pr.total)}</div>
            </div>)}
          </div>
        </div>}
        {/* AGUARDANDO SEM DATA - POR PARCEIRO */}
        {parcSemList.length>0&&<div style={{marginTop:12,background:C.surface,borderRadius:10,padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8}}>📋 Aguardando sem data prevista — {totalSemClients} clientes · {fmtCur(totalSem)}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>
            {parcSemList.slice(0,12).map(pr=><div key={pr.parceiro} onClick={()=>openParcDrilldown(pr,pr.items,'Aguardando')} style={{background:C.card,border:'1px solid '+C.border,borderRadius:8,padding:'10px 12px',cursor:'pointer',transition:'transform .1s'}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <div style={{fontSize:10,fontWeight:700,color:C.accent,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',justifyContent:'space-between'}}><span>{pr.parceiro}</span><span style={{fontSize:9,opacity:.6}}>→</span></div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontSize:16,fontWeight:800}}>{pr.qtdClients}</div>
                <div style={{fontSize:10,color:C.muted}}>cliente{pr.qtdClients>1?'s':''}</div>
              </div>
              <div style={{fontSize:11,fontWeight:600,color:C.warn}}>{fmtCur(pr.total)}</div>
            </div>)}
          </div>
        </div>}
      </div>
    })()}

    {/* KPIs PRINCIPAIS - CLICÁVEIS com breakdown por parceiro */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8}}>
      {[
        {k:'enviado',label:'ENVIADO CIP',color:C.accent,value:totalEnviado,count:enviadas.length,sub:'propostas',items:enviadas,bg:C.card},
        {k:'chegou',label:'CHEGOU CIP',color:C.warn,value:totalChegou,count:chegou.length,sub:'saldos',items:chegou,bg:C.card},
        {k:'pago',label:'PAGO',color:C.accent2,value:totalPago,count:pagas.length,sub:'integrados',items:pagas,bg:C.card},
        {k:'naoPago',label:'NÃO FOI PAGO',color:C.danger,value:totalNaoPago,count:naoPagas.length,sub:'cancel./recus.',items:naoPagas,bg:C.card},
        {k:'trocoNeg',label:'TROCO NEGATIVO',color:'#F97316',value:Math.abs(totalTrocoNeg),count:trocoNeg.length,sub:'casos',items:trocoNeg,bg:C.card},
        {k:'retido',label:'RETENÇÃO CLIENTE',color:C.info,value:totalRetido,count:retidas.length,sub:'retidos',items:retidas,bg:C.card},
        {k:'aChegar',label:'⏳ A CHEGAR DA CIP',color:C.warn,value:totalAChegar,count:aChegarCip.length,sub:'no fluxo',items:aChegarCip,bg:C.warn+'15'}
      ].map(kpi=><div key={kpi.k} onClick={()=>setKpiDrilldown({type:kpi.k,label:kpi.label,items:kpi.items,color:kpi.color})} style={{background:kpi.bg,border:'2px solid '+kpi.color,borderRadius:10,padding:'12px 14px',cursor:'pointer',transition:'transform .1s',userSelect:'none'}} onMouseDown={e=>e.currentTarget.style.transform='scale(.98)'} onMouseUp={e=>e.currentTarget.style.transform='scale(1)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
        <div style={{fontSize:9,fontWeight:700,color:kpi.color,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{kpi.label}</span><span style={{fontSize:9,opacity:.6}}>→</span></div>
        <div style={{fontSize:18,fontWeight:800,color:kpi.color}}>{fmtCur(kpi.value)}</div>
        <div style={{fontSize:9,color:C.muted}}>{kpi.count} {kpi.sub}</div>
      </div>)}
      <div style={{background:'#EF444418',border:'1px solid #EF444433',borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:9,fontWeight:700,color:C.danger}}>NÃO CHEGOU CIP</div>
        <div style={{fontSize:18,fontWeight:800,color:C.danger}}>{fmtCur(naoChegou)}</div>
      </div>
    </div>

    {/* Percentuais */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
      {[
        {l:'Chegou / Enviado %',v:pctChegou,c:C.warn},
        {l:'Pago / Chegou %',v:pctPagoChegou,c:C.accent2},
        {l:'Pago / Enviado %',v:pctPagoEnviado,c:C.accent2},
        {l:'Não foi Pago / Chegou %',v:pctNaoPagoChegou,c:C.danger},
        {l:'Retenção %',v:pctRetencao,c:C.info}
      ].map(x=><div key={x.l} style={{background:C.card,border:'1px solid '+C.border,borderRadius:10,padding:'10px 12px'}}>
        <div style={{fontSize:8,fontWeight:700,color:C.muted,textTransform:'uppercase'}}>{x.l}</div>
        <div style={{fontSize:20,fontWeight:800,color:x.c}}>{x.v.toFixed(0)}%</div>
      </div>)}
    </div>

    {/* ═══ ANÁLISE DOS RETORNOS — FUNIL + PERFORMANCE POR BANCO ═══ */}
    {(()=>{
      // Funil consolidado
      const tot=fd.length
      const sk=k=>fd.filter(r=>r.status_key===k).length
      const skSet=arr=>fd.filter(r=>arr.includes(r.status_key)).length
      const pagas=sk('integrated'),retidas=sk('retained'),canceladas=sk('canceled'),rejeitadas=sk('rejected_ctc')
      const andamento=skSet(['awaiting_portability','awaiting_cip','awaiting_send_to_cip','awaiting_formalization','awaiting_endorsement','awaiting_payment','awaiting_manual_analysis','documents_not_found','accepted','proposal_cadastrada','awaiting_portability_endorsement','balance_returned_awaiting_manual_approval','balance_awaiting_auto_payment'])
      const pct=v=>tot?(v/tot*100):0
      // Performance por banco origem
      const bm={}
      fd.forEach(r=>{const k=r.origin_bank_name;if(!k||k==='?')return;if(!bm[k])bm[k]={total:0,pagas:0,retidas:0,canceladas:0,rejeitadas:0,andamento:0,vl:0}
        bm[k].total++;bm[k].vl+=(Number(r.origin_due_balance)||0)
        if(r.status_key==='integrated')bm[k].pagas++
        else if(r.status_key==='retained')bm[k].retidas++
        else if(r.status_key==='canceled')bm[k].canceladas++
        else if(r.status_key==='rejected_ctc')bm[k].rejeitadas++
        else bm[k].andamento++
      })
      const bankRows=Object.entries(bm).filter(([,d])=>d.total>=10).map(([k,d])=>({banco:k,...d,pctRet:d.total?d.retidas/d.total*100:0,pctPago:d.total?d.pagas/d.total*100:0,pctCanc:d.total?d.canceladas/d.total*100:0})).sort((a,b)=>b.total-a.total)
      const colRet=v=>v>=40?C.danger:v>=25?C.warn:v>=15?C.info:C.accent2
      const colPago=v=>v>=20?C.accent2:v>=10?C.warn:C.danger
      return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,display:'flex',flexDirection:'column',gap:14}}>
        <div>
          <div style={{fontSize:13,fontWeight:800,marginBottom:2}}>📊 Análise dos Retornos — Funil Consolidado</div>
          <div style={{fontSize:10,color:C.muted}}>Distribuição por desfecho final · base {tot} propostas</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8}}>
          <div style={{background:C.accent2+'15',borderLeft:'4px solid '+C.accent2,borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:9,fontWeight:700,color:C.accent2}}>🟢 INTEGRADAS (PAGAS)</div><div style={{fontSize:18,fontWeight:800,color:C.accent2}}>{pagas} <span style={{fontSize:11}}>({pct(pagas).toFixed(1)}%)</span></div></div>
          <div style={{background:C.warn+'15',borderLeft:'4px solid '+C.warn,borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:9,fontWeight:700,color:C.warn}}>🟠 RETIDAS</div><div style={{fontSize:18,fontWeight:800,color:C.warn}}>{retidas} <span style={{fontSize:11}}>({pct(retidas).toFixed(1)}%)</span></div></div>
          <div style={{background:C.danger+'15',borderLeft:'4px solid '+C.danger,borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:9,fontWeight:700,color:C.danger}}>🔴 CANCELADAS</div><div style={{fontSize:18,fontWeight:800,color:C.danger}}>{canceladas} <span style={{fontSize:11}}>({pct(canceladas).toFixed(1)}%)</span></div></div>
          <div style={{background:'#F9731615',borderLeft:'4px solid #F97316',borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:9,fontWeight:700,color:'#F97316'}}>🔻 REJEITADAS CIP</div><div style={{fontSize:18,fontWeight:800,color:'#F97316'}}>{rejeitadas} <span style={{fontSize:11}}>({pct(rejeitadas).toFixed(1)}%)</span></div></div>
          <div style={{background:C.info+'15',borderLeft:'4px solid '+C.info,borderRadius:8,padding:'10px 12px'}}><div style={{fontSize:9,fontWeight:700,color:C.info}}>🟡 EM ANDAMENTO</div><div style={{fontSize:18,fontWeight:800,color:C.info}}>{andamento} <span style={{fontSize:11}}>({pct(andamento).toFixed(1)}%)</span></div></div>
        </div>
        {bankRows.length>0&&<>
          <div style={{borderTop:'1px solid '+C.border,paddingTop:10}}>
            <div style={{fontSize:13,fontWeight:800,marginBottom:2}}>🏦 Performance por Banco Origem</div>
            <div style={{fontSize:10,color:C.muted,marginBottom:8}}>Mín. 10 propostas · % retido (vermelho = alta retenção) · % pago (verde = boa conversão)</div>
            <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead><tr style={{background:C.surface}}>{['Banco','Total','Vl. Total','% Retido','% Pago','% Cancel.','Em Andam.','Pagas','Retidas','Cancel.'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
                <tbody>{bankRows.map(b=><tr key={b.banco} style={{borderBottom:'1px solid '+C.border}}>
                  <td style={{padding:'7px 10px',fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.banco}</td>
                  <td style={{padding:'7px 10px',fontWeight:700}}>{b.total}</td>
                  <td style={{padding:'7px 10px',color:C.muted}}>{fmtCur(b.vl)}</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:colRet(b.pctRet)}}>{b.pctRet.toFixed(0)}%</td>
                  <td style={{padding:'7px 10px',fontWeight:700,color:colPago(b.pctPago)}}>{b.pctPago.toFixed(0)}%</td>
                  <td style={{padding:'7px 10px',color:C.muted}}>{b.pctCanc.toFixed(0)}%</td>
                  <td style={{padding:'7px 10px',color:C.info}}>{b.andamento}</td>
                  <td style={{padding:'7px 10px',color:C.accent2}}>{b.pagas}</td>
                  <td style={{padding:'7px 10px',color:C.warn}}>{b.retidas}</td>
                  <td style={{padding:'7px 10px',color:C.danger}}>{b.canceladas}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>
        </>}
      </div>
    })()}

    {/* FILTROS */}
    <div style={{display:'flex',gap:6,flexWrap:'wrap',background:C.card,border:'1px solid '+C.border,borderRadius:10,padding:'10px 14px',alignItems:'center'}}>
      <input value={se} onChange={e=>sSe(e.target.value)} placeholder="🔍 Cliente, CPF ou proposta..." style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11,flex:1,minWidth:180}}/>
      <select value={fSource} onChange={e=>sFSource(e.target.value)} style={{background:C.surface,border:'1px solid '+(fSource!=='all'?C.accent:C.border),borderRadius:6,color:fSource!=='all'?C.accent:C.text,padding:'6px 10px',fontSize:11,fontWeight:fSource!=='all'?600:400}}><option value="all">🌐 Todas fontes</option><option value="quali">🔵 QualiBanking</option><option value="consig360">🟠 Consig360</option></select>
      <select value={fBanco} onChange={e=>sFBanco(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todos bancos</option>{bancos.map(b=><option key={b} value={b}>{b}</option>)}</select>
      <select value={fStatus} onChange={e=>sFStatus(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todos status</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <select value={fOp} onChange={e=>sFOp(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'6px 10px',fontSize:11}}><option value="">Todas operações</option>{operations.map(o=><option key={o} value={o}>{o}</option>)}</select>
      {!isParceiroView&&<select value={fParceiro} onChange={e=>sFParceiro(e.target.value)} style={{background:C.surface,border:'1px solid '+(fParceiro?C.accent:C.border),borderRadius:6,color:fParceiro?C.accent:C.text,padding:'6px 10px',fontSize:11,minWidth:160,fontWeight:fParceiro?600:400}}><option value="">👤 Todos parceiros</option>{allParceiros.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
      <div style={{display:'flex',gap:4,alignItems:'center',fontSize:9,color:C.muted}}>
        <span style={{fontWeight:600}}>Retorno CIP:</span>
        <input type="date" value={fDataRetornoDe} onChange={e=>sFDataRetornoDe(e.target.value)} style={{background:C.surface,border:'1px solid '+(fDataRetornoDe?C.accent2:C.border),borderRadius:6,color:C.text,padding:'5px 8px',fontSize:10}}/>
        <span>→</span>
        <input type="date" value={fDataRetornoAte} onChange={e=>sFDataRetornoAte(e.target.value)} style={{background:C.surface,border:'1px solid '+(fDataRetornoAte?C.accent2:C.border),borderRadius:6,color:C.text,padding:'5px 8px',fontSize:10}}/>
      </div>
      {(fBanco||fStatus||fOp||se||fDataRetornoDe||fDataRetornoAte||fParceiro)&&<button onClick={()=>{sFBanco('');sFStatus('');sFOp('');sSe('');sFDataRetornoDe('');sFDataRetornoAte('');sFParceiro('')}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.muted,padding:'6px 10px',fontSize:10,cursor:'pointer'}}>✕ Limpar</button>}
    </div>
    {/* Indicador visual quando filtro de parceiro ativo */}
    {fParceiro&&!isParceiroView&&<div style={{background:C.accent+'15',border:'1px solid '+C.accent+'55',borderRadius:8,padding:'8px 14px',fontSize:11,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>👤 Visualizando apenas <strong>{allParceiros.find(p=>p.id===fParceiro)?.nome||'?'}</strong></span><button onClick={()=>sFParceiro('')} style={{background:'none',border:'none',color:C.accent,cursor:'pointer',fontWeight:600,fontSize:11}}>✕ Mostrar todos</button></div>}

    {/* RANKINGS tipo Power BI */}
    <div className="rg2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.accent}}>Top Banco Enviado CIP</div>
        {topEnviado.length===0?<div style={{fontSize:10,color:C.muted}}>Sem dados</div>:topEnviado.map(([k,x])=><BarRow key={k} label={k} value={x.v} max={maxBar(topEnviado)} color={C.accent} fmt={fmtCur}/>)}
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.warn}}>Top Banco Chegou CIP</div>
        {topChegou.length===0?<div style={{fontSize:10,color:C.muted}}>Sem dados</div>:topChegou.map(([k,x])=><BarRow key={k} label={k} value={x.v} max={maxBar(topChegou)} color={C.warn} fmt={fmtCur}/>)}
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.accent2}}>Top Banco Pago</div>
        {topPago.length===0?<div style={{fontSize:10,color:C.muted}}>Sem dados</div>:topPago.map(([k,x])=><BarRow key={k} label={k} value={x.v} max={maxBar(topPago)} color={C.accent2} fmt={fmtCur}/>)}
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.info}}>Top Banco % Chegou CIP</div>
        {topPctChegou.length===0?<div style={{fontSize:10,color:C.muted}}>Sem dados</div>:topPctChegou.map(([k,x])=><BarRow key={k} label={k} value={x.pct} max={100} color={C.info} fmt={v=>v.toFixed(0)+'%'}/>)}
      </div>
    </div>

    {/* RANKING: Bancos que MAIS RETÊM saldo */}
    {bancosRetem.length>0&&<div style={{background:C.card,border:'2px solid '+C.danger+'44',borderRadius:14,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:C.danger}}>⚠️ Bancos que Menos Mandam Saldo CIP</div>
          <div style={{fontSize:10,color:C.muted}}>Ordenado do pior retorno ao melhor · mínimo 3 propostas enviadas</div>
        </div>
        <div style={{fontSize:10,color:C.muted}}>% = saldo retornado / total enviado</div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead><tr style={{background:C.surface}}>{['Banco Origem','Enviadas','Saldo Chegou','Pendentes','% Retorno','Valor Travado'].map(h=><th key={h} style={{padding:'7px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
          <tbody>{bancosRetem.map(([k,x])=>{
            const cor=x.pct<25?C.danger:x.pct<40?'#F97316':x.pct<60?C.warn:C.accent2
            const emoji=x.pct<25?'🔴':x.pct<40?'🟠':x.pct<60?'🟡':'🟢'
            return<tr key={k} style={{borderBottom:'1px solid '+C.border}}>
              <td style={{padding:'7px 10px',fontWeight:600}}>{emoji} {k}</td>
              <td style={{padding:'7px 10px'}}>{x.env}</td>
              <td style={{padding:'7px 10px',color:C.accent2,fontWeight:600}}>{x.ch}</td>
              <td style={{padding:'7px 10px',color:C.muted}}>{x.pending}</td>
              <td style={{padding:'7px 10px',fontWeight:700,color:cor}}>{x.pct.toFixed(1)}%</td>
              <td style={{padding:'7px 10px',fontWeight:600,color:C.danger}}>{fmtCur(x.pendingVal)}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
      <div style={{marginTop:8,fontSize:10,color:C.muted,fontStyle:'italic'}}>💡 Valor travado = saldo das propostas pendentes que ainda não retornaram</div>
    </div>}

    {/* TABELA DETALHADA */}
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Portabilidades — {fd.length} registros</div>
      <div style={{overflowX:'auto',maxHeight:500,borderRadius:8,border:'1px solid '+C.border}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead><tr style={{background:C.surface,position:'sticky',top:0,zIndex:1}}>{['Fonte','Data','Proposta','Cliente','Parceiro','Banco Origem','Banco Destino','Saldo Dev.','Retorno CIP','Vl. Bruto','Troco','Status','Op.','Link','Ações'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
          <tbody>{fd.slice(0,500).map(r=><tr key={r._source+':'+r.id} onClick={()=>setSelRow(r)} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
            <td style={{padding:'5px 8px'}}><span style={{fontSize:8,padding:'2px 5px',borderRadius:3,background:r._src_color+'22',color:r._src_color,fontWeight:700}}>{r._source==='quali'?'🔵':'🟠'}</span></td>
            <td style={{padding:'5px 8px',whiteSpace:'nowrap'}}>{fmtDate(r.proposal_date)}</td>
            <td style={{padding:'5px 8px',fontWeight:600}}>{r.contract_number||r.proposal_number||r.code}</td>
            <td style={{padding:'5px 8px',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.borrower_name}</td>
            <td style={{padding:'5px 8px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:9,fontWeight:600,color:C.accent}}>{r.parceiro_nome||'—'}</td>
            <td style={{padding:'5px 8px',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:9}}>{r.origin_bank_name||'—'}</td>
            <td style={{padding:'5px 8px',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:9}}>{r.destination_bank_name||'—'}</td>
            <td style={{padding:'5px 8px',fontWeight:600,color:C.accent}}>{fmtCur(r.origin_due_balance)}</td>
            <td style={{padding:'5px 8px',fontSize:10,whiteSpace:'nowrap',color:r.origin_due_balance_returned?C.accent2:(r.origin_due_balance_expected_date?C.warn:C.muted),fontWeight:r.origin_due_balance_returned?600:400}}>{r.origin_due_balance_date?'🟢 '+fmtDate(r.origin_due_balance_date):(r.origin_due_balance_expected_date?'⏳ '+fmtDate(r.origin_due_balance_expected_date):'—')}</td>
            <td style={{padding:'5px 8px',fontWeight:600}}>{fmtCur(r.loan_value)}</td>
            <td style={{padding:'5px 8px',fontWeight:600,color:(r.net_value||0)<0?C.danger:C.accent2}}>{fmtCur(r.net_value)}</td>
            <td style={{padding:'5px 8px'}}><span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:(r.status_color||C.muted)+'22',color:r.status_color||C.muted,fontWeight:600}}>{r.status_name||'—'}</span></td>
            <td style={{padding:'5px 8px',fontSize:9}}>{r.operation_type}</td>
            <td style={{padding:'5px 8px'}} onClick={e=>e.stopPropagation()}>{r.formalization_url?<a href={r.formalization_url} target="_blank" rel="noopener noreferrer" style={{fontSize:14,textDecoration:'none'}} title="Link de formalização">🔗</a>:<span style={{color:C.muted,fontSize:10}}>—</span>}</td>
            <td style={{padding:'5px 8px'}}><span style={{fontSize:9,color:C.accent,fontWeight:600}}>👁</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    {/* MODAL DETALHE */}
    {selRow&&<PortabilityDetailModal row={selRow} onClose={()=>setSelRow(null)} onReload={loadData} user={user}/>}

    {/* MODAL DRILLDOWN */}
    {kpiDrilldown&&(()=>{
      const items=kpiDrilldown.items||[]
      const isPartnerDays=kpiDrilldown.type==='partner-days'
      // Se partner-days: mostra propostas individuais
      if(isPartnerDays){
        return<div onClick={()=>setKpiDrilldown(null)} style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'2px solid '+kpiDrilldown.color,borderRadius:14,width:900,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto',padding:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:kpiDrilldown.color}}>{kpiDrilldown.label}</div>
                <div style={{fontSize:11,color:C.muted}}>{items.length} propostas</div>
              </div>
              <button onClick={()=>setKpiDrilldown(null)} style={{background:'none',border:'none',color:C.muted,fontSize:24,cursor:'pointer'}}>×</button>
            </div>
            <div style={{overflowX:'auto',borderRadius:8,border:'1px solid '+C.border,maxHeight:500,overflowY:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                <thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Cliente','CPF','Banco Origem','Proposta','Retorno Previsto','Saldo','Status'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                <tbody>{items.sort((a,b)=>(a.origin_due_balance_expected_date||'').localeCompare(b.origin_due_balance_expected_date||'')).map(r=><tr key={r.id} onClick={()=>{setSelRow(r);setKpiDrilldown(null)}} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
                  <td style={{padding:'5px 8px',fontWeight:600,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.borrower_name}</td>
                  <td style={{padding:'5px 8px',fontSize:9,fontFamily:'monospace'}}>{r.borrower_identity}</td>
                  <td style={{padding:'5px 8px',fontSize:9,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.origin_bank_name||'—'}</td>
                  <td style={{padding:'5px 8px',fontSize:9}}>{r.contract_number||r.proposal_number||'—'}</td>
                  <td style={{padding:'5px 8px',fontSize:9,color:C.warn}}>{r.origin_due_balance_expected_date?fmtDate(r.origin_due_balance_expected_date):'—'}</td>
                  <td style={{padding:'5px 8px',fontWeight:600,color:kpiDrilldown.color}}>{fmtCur(r.origin_due_balance)}</td>
                  <td style={{padding:'5px 8px'}}><span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:(r.status_color||C.muted)+'22',color:r.status_color||C.muted,fontWeight:600}}>{r.status_name||'—'}</span></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div style={{marginTop:10,fontSize:10,color:C.muted}}>💡 Clique na proposta pra ver detalhes completos</div>
          </div>
        </div>
      }
      // Caso padrão: agrupa por parceiro
      const byPartner={}
      items.forEach(r=>{
        const k=r.parceiro_nome||r.agente_digitacao||'(Sem parceiro identificado)'
        if(!byPartner[k])byPartner[k]={nome:k,items:[],count:0,value:0,phone:null,email:null}
        byPartner[k].items.push(r)
        byPartner[k].count++
        byPartner[k].value+=(Number(r.origin_due_balance)||Number(r.loan_value)||0)
      })
      const partnerRows=Object.values(byPartner).sort((a,b)=>b.value-a.value)
      partnerRows.forEach(pr=>{
        const match=allParceiros.find(p=>p.nome&&p.nome.toUpperCase().trim()===pr.nome.toUpperCase().trim())
        if(match){pr.phone=match.telefone;pr.email=match.email;pr.parceiro_id=match.id}
      })
      return<div onClick={()=>setKpiDrilldown(null)} style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
        <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'2px solid '+kpiDrilldown.color,borderRadius:14,width:800,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto',padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:kpiDrilldown.color}}>{kpiDrilldown.label}</div>
              <div style={{fontSize:11,color:C.muted}}>{items.length} propostas · {partnerRows.length} parceiros responsáveis</div>
            </div>
            <button onClick={()=>setKpiDrilldown(null)} style={{background:'none',border:'none',color:C.muted,fontSize:24,cursor:'pointer'}}>×</button>
          </div>
          <div style={{overflowX:'auto',borderRadius:8,border:'1px solid '+C.border}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead><tr style={{background:C.surface}}>{['Parceiro','Contato','Qtd','Valor','Ação'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
              <tbody>{partnerRows.map(pr=><tr key={pr.nome} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'8px 10px',fontWeight:600,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pr.nome}{!pr.parceiro_id&&pr.nome!=='(Sem parceiro identificado)'&&<span style={{fontSize:8,color:C.warn,marginLeft:6}}>[não cadastrado]</span>}</td>
                <td style={{padding:'8px 10px',fontSize:10}}>{pr.phone?<span style={{color:C.accent}}>📞 {pr.phone}</span>:<span style={{color:C.muted}}>—</span>}</td>
                <td style={{padding:'8px 10px',fontWeight:600}}>{pr.count}</td>
                <td style={{padding:'8px 10px',fontWeight:600,color:kpiDrilldown.color}}>{fmtCur(pr.value)}</td>
                <td style={{padding:'8px 10px'}}>
                  <div style={{display:'flex',gap:4}}>
                    {pr.phone&&<a href={'https://wa.me/'+String(pr.phone).replace(/\D/g,'')+'?text='+encodeURIComponent('Olá '+pr.nome.split(' ')[0]+', referente às '+pr.count+' propostas com status "'+kpiDrilldown.label+'"...')} target="_blank" rel="noopener noreferrer" style={{background:'#25D366',color:'#fff',padding:'4px 8px',borderRadius:6,textDecoration:'none',fontSize:9,fontWeight:700}}>📱 WhatsApp</a>}
                    <button onClick={()=>{setKpiDrilldown({type:'partner-days',label:'Propostas: '+pr.nome,items:pr.items,color:kpiDrilldown.color})}} style={{background:C.accent,color:'#fff',border:'none',borderRadius:6,padding:'4px 8px',fontSize:9,fontWeight:700,cursor:'pointer'}}>👁 Ver propostas</button>
                  </div>
                </td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{marginTop:14,fontSize:10,color:C.muted}}>💡 Clique em "Ver propostas" para ver a lista de propostas do parceiro.</div>
        </div>
      </div>
    })()}
  </div>
}

/* ═══ MODAL DETALHE PORTABILIDADE COM AÇÕES ═══ */
function PortabilityDetailModal({row,onClose,onReload,user}){
  const[tab,sTab]=useState('info')
  const[uploading,setUploading]=useState(false),[uploadMsg,setUploadMsg]=useState('')
  const[approving,setApproving]=useState(false),[approveMsg,setApproveMsg]=useState('')
  const[recalc,setRecalc]=useState(null),[recalcError,setRecalcError]=useState('')
  const[rate,setRate]=useState(row.rate?String(row.rate):'1.8'),[hasInsurance,setHasInsurance]=useState(false),[reformalize,setReformalize]=useState(false)
  const[actions,setActions]=useState([])
  const[apiRules,setApiRules]=useState([])
  const fileRef=useRef(null)
  useEffect(()=>{
    // Carrega histórico de ações
    supabase.from('portabilidade_actions').select('*').eq('quali_id',row.quali_id).order('created_at',{ascending:false}).limit(20).then(({data})=>setActions(data||[]))
  },[row.quali_id])
  const callProxy=async(action,params={})=>{
    const r=await fetch('https://rirsmtyuyqxsoxqbgtpu.supabase.co/functions/v1/proxy-qualibanking',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,qualiId:row.quali_id,portabilidadeId:row.id,performedBy:user?.id,...params})
    })
    return r.json()
  }
  const uploadFile=async(file)=>{
    if(!file)return
    setUploading(true);setUploadMsg('Enviando arquivo...')
    try{
      const path=row.quali_id+'/'+Date.now()+'_'+file.name.replace(/[^\w.-]/g,'_')
      const{data:upData,error:upErr}=await supabase.storage.from('portabilidade-docs').upload(path,file,{upsert:false})
      if(upErr)throw upErr
      const{data:pub}=supabase.storage.from('portabilidade-docs').getPublicUrl(upData.path)
      setUploadMsg('Registrando na QualiBanking...')
      const res=await callProxy('upload_document',{url:pub.publicUrl})
      if(res.ok)setUploadMsg('✓ Arquivo enviado e registrado! ID QualiBanking: '+(res.data?.id||'—'))
      else setUploadMsg('Erro QualiBanking: '+(res.data?.messages?.[0]?.text||res.error||JSON.stringify(res.data).slice(0,200)))
    }catch(e){setUploadMsg('Erro: '+e.message)}
    setUploading(false)
    if(fileRef.current)fileRef.current.value=''
  }
  const doRecalc=async()=>{
    setApproving(true);setRecalcError('');setRecalc(null);setApproveMsg('Recalculando condições...')
    const ruleId=row.raw_data?.rule?.id
    if(!ruleId){setRecalcError('Sem ruleId. Não é possível recalcular.');setApproving(false);return}
    const res=await callProxy('recalculate',{ruleId,hasInsurance,refinanceRate:parseFloat(rate)})
    if(res.ok){setRecalc(res.data);setApproveMsg('✓ Simulação OK. Revise e clique Aceitar.')}
    else setRecalcError(res.data?.messages?.[0]?.text||res.error||'Erro desconhecido')
    setApproving(false)
  }
  const doAccept=async()=>{
    if(!recalc){setRecalcError('Simule antes de aceitar');return}
    if(!confirm('Confirmar ACEITE DO SALDO para '+row.borrower_name+'?\nTaxa: '+rate+'%\nSeguro: '+(hasInsurance?'Sim':'Não')+'\n\nEsta ação é FINAL.'))return
    setApproving(true);setApproveMsg('Aceitando termos...')
    const ruleId=row.raw_data?.rule?.id
    const res=await callProxy('accept_terms',{ruleId,hasInsurance,refinanceRate:parseFloat(rate),reformalize})
    if(res.ok){setApproveMsg('✓ Termos aceitos! Status: '+(res.data?.status||'—'));if(onReload)onReload()}
    else setApproveMsg('Erro: '+(res.data?.messages?.[0]?.text||res.error||JSON.stringify(res.data).slice(0,200)))
    setApproving(false)
  }
  const canApprove=row.origin_due_balance_returned&&!['integrated','canceled','rejected_ctc','proposal_expired'].includes(row.status_key)
  const tabs=[{id:'info',l:'📋 Detalhes'},{id:'docs',l:'📎 Documentos'},{id:'actions',l:'⚡ Ações'},{id:'history',l:'📜 Histórico'}]
  return<div onClick={onClose} style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,width:800,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto',padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <h3 style={{margin:0,fontSize:16}}>{row.borrower_name}</h3>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:24,cursor:'pointer'}}>×</button>
      </div>
      <div style={{fontSize:10,color:C.muted,marginBottom:12}}>Proposta {row.contract_number||row.proposal_number} · CPF {row.borrower_identity} · {row.borrower_phone||'sem telefone'}</div>
      {/* LINKS DE FORMALIZAÇÃO E DOCUMENTO */}
      {(row.formalization_url||row.document_url)&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {row.formalization_url&&<a href={row.formalization_url} target="_blank" rel="noopener noreferrer" style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6}}>🔗 Link de Formalização</a>}
        {row.document_url&&<a href={row.document_url} target="_blank" rel="noopener noreferrer" style={{background:C.surface,color:C.accent,border:'1px solid '+C.accent,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6}}>📄 Ver Contrato</a>}
        {row.signature_type&&<span style={{fontSize:10,color:C.muted,alignSelf:'center'}}>Assinatura: {row.signature_type} ({row.signature_provider||'—'})</span>}
      </div>}
      <div style={{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap'}}>{tabs.map(t=><button key={t.id} onClick={()=>sTab(t.id)} style={{padding:'5px 12px',borderRadius:7,border:'1px solid '+(tab===t.id?C.accent:C.border),background:tab===t.id?C.abg:'transparent',color:tab===t.id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:tab===t.id?600:400}}>{t.l}</button>)}</div>

      {tab==='info'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[
          ['Banco Origem',row.origin_bank_name],['Banco Destino',row.destination_bank_name],
          ['Operação',row.operation_type],['Status',row.status_name],
          ['Saldo Devedor',fmtCur(row.origin_due_balance)],['Vl. Bruto',fmtCur(row.loan_value)],
          ['Vl. Líquido (Troco)',fmtCur(row.net_value)],['Parcela',fmtCur(row.installment_value)],
          ['Prazo',row.term?row.term+' meses':'—'],['Taxa',(row.rate||0).toFixed(2)+'%'],
          ['Parcelas Pagas (origem)',row.origin_installments_paid],['Parcelas Restantes (origem)',row.origin_installments_remaining],
          ['Data Proposta',fmtDate(row.proposal_date)],['Data Contrato',fmtDate(row.contract_date)],
          ['Enviado CIP',fmtDate(row.cip_submission_date)],['Retorno Esperado CIP',fmtDate(row.origin_due_balance_expected_date)],
          ['Retorno CIP (Real)',row.origin_due_balance_date?fmtDate(row.origin_due_balance_date):'—'],['Saldo Chegou?',row.origin_due_balance_returned?'✓ Sim':'Não'],
          ['Número CIP',row.portability_number||'—'],['Assinado?',row.assigned?'✓ Sim':'Não']
        ].map(([l,v])=><div key={l} style={{background:C.surface,borderRadius:6,padding:'8px 10px'}}>
          <div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:'uppercase'}}>{l}</div>
          <div style={{fontSize:12,fontWeight:600}}>{v||'—'}</div>
        </div>)}
      </div>}

      {tab==='docs'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{background:C.accent+'11',border:'1px solid '+C.accent+'44',borderRadius:10,padding:14}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:6}}>📎 Anexar documento à proposta</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:10}}>O arquivo será carregado no storage do OpsManager e associado à proposta na QualiBanking.</div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e=>uploadFile(e.target.files?.[0])} disabled={uploading} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,padding:8,fontSize:11,width:'100%',boxSizing:'border-box'}}/>
          {uploadMsg&&<div style={{marginTop:8,fontSize:11,padding:'6px 10px',borderRadius:6,background:uploadMsg.includes('✓')?C.accent2+'22':C.warn+'22',color:uploadMsg.includes('✓')?C.accent2:C.warn}}>{uploadMsg}</div>}
        </div>
      </div>}

      {tab==='actions'&&<div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{background:canApprove?C.accent2+'11':C.muted+'11',border:'1px solid '+(canApprove?C.accent2+'44':C.muted+'44'),borderRadius:10,padding:14}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>✅ Aprovar Saldo</div>
          {!canApprove&&<div style={{fontSize:11,color:C.warn,padding:'6px 10px',background:C.warn+'22',borderRadius:6,marginBottom:10}}>⚠️ Só é possível aprovar quando o saldo retornou da CIP e status permite.</div>}
          {canApprove&&<>
            <div style={{fontSize:10,color:C.muted,marginBottom:10}}>1. Simule as condições. 2. Revise. 3. Aceite.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
              <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>TAXA (% a.m.)</label><input type="number" step="0.0001" value={rate} onChange={e=>setRate(e.target.value)} disabled={approving} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,padding:'6px 10px',fontSize:11,width:'100%',boxSizing:'border-box'}}/></div>
              <div style={{display:'flex',gap:14,alignItems:'center'}}>
                <label style={{fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><input type="checkbox" checked={hasInsurance} onChange={e=>setHasInsurance(e.target.checked)} disabled={approving}/> Com seguro</label>
                <label style={{fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><input type="checkbox" checked={reformalize} onChange={e=>setReformalize(e.target.checked)} disabled={approving}/> Reformalizar</label>
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={doRecalc} disabled={approving} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,fontSize:12,cursor:approving?'wait':'pointer',flex:1}}>🧮 Simular Recálculo</button>
              <button onClick={doAccept} disabled={approving||!recalc} style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,fontSize:12,cursor:(approving||!recalc)?'not-allowed':'pointer',opacity:(approving||!recalc)?.4:1,flex:1}}>✅ Aceitar Saldo</button>
            </div>
            {recalcError&&<div style={{marginTop:8,fontSize:11,padding:'6px 10px',borderRadius:6,background:C.danger+'22',color:C.danger}}>{recalcError}</div>}
            {approveMsg&&<div style={{marginTop:8,fontSize:11,padding:'6px 10px',borderRadius:6,background:approveMsg.includes('✓')?C.accent2+'22':C.warn+'22',color:approveMsg.includes('✓')?C.accent2:C.warn}}>{approveMsg}</div>}
            {recalc&&<div style={{marginTop:10,background:C.surface,borderRadius:8,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:C.accent}}>📊 Resultado da Simulação</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:10}}>
                {[['Valor Empréstimo',fmtCur(recalc.recalculation?.loanValue)],['Vl. Líquido',fmtCur(recalc.recalculation?.netValue)],['Parcela',fmtCur(recalc.recalculation?.installmentValue)],['Prazo',recalc.recalculation?.term+' meses'],['Taxa Mensal',(recalc.recalculation?.rate||0).toFixed(4)+'%'],['CET Anual',(recalc.recalculation?.totalEffectiveCostAnnual||0).toFixed(2)+'%'],['IOF',fmtCur(recalc.recalculation?.iofValue)],['Seguro',fmtCur(recalc.recalculation?.insuranceValue||0)]].map(([l,v])=><div key={l} style={{padding:'4px 8px',background:C.card,borderRadius:4}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>{l}</div><div style={{fontWeight:600}}>{v}</div></div>)}
              </div>
            </div>}
          </>}
        </div>
      </div>}

      {tab==='history'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{fontSize:12,fontWeight:700,color:C.muted}}>📜 Timeline de status (QualiBanking)</div>
        {row.raw_data?.timeline?.length>0?row.raw_data.timeline.map((ev,i)=><div key={i} style={{background:C.surface,borderRadius:8,padding:10,borderLeft:'3px solid '+(ev.partnerStatus?.color||C.muted)}}>
          <div style={{fontSize:11,fontWeight:700}}>{ev.partnerStatus?.displayText||ev.status}</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{new Date(ev.createdAt).toLocaleString('pt-BR')}</div>
          {ev.description&&<div style={{fontSize:10,marginTop:4}}>{ev.description}</div>}
        </div>):<div style={{fontSize:10,color:C.muted}}>Sem timeline disponível</div>}
        <div style={{fontSize:12,fontWeight:700,color:C.muted,marginTop:10}}>⚡ Ações executadas no OpsManager</div>
        {actions.length===0?<div style={{fontSize:10,color:C.muted}}>Nenhuma ação executada ainda</div>:actions.map(a=><div key={a.id} style={{background:C.surface,borderRadius:8,padding:10,borderLeft:'3px solid '+(a.success?C.accent2:C.danger)}}>
          <div style={{fontSize:11,fontWeight:700}}>{a.action_type} {a.success?'✓':'✕'}</div>
          <div style={{fontSize:9,color:C.muted,marginTop:2}}>{new Date(a.created_at).toLocaleString('pt-BR')}</div>
          {a.error_message&&<div style={{fontSize:9,color:C.danger,marginTop:4}}>{a.error_message}</div>}
        </div>)}
      </div>}
    </div>
  </div>
}

/* ═══ ALERTAS — digitação + produção ═══ */
function Alertas({curOps,prevOps,curProd,prevProd}){
  const[selP,setSelP]=useState(null)
  const ags=[...new Set(curOps.concat(prevOps).map(o=>o.agente).filter(Boolean))]
  const st=ags.map(a=>{
    const cu=curOps.filter(o=>o.agente===a),pv=prevOps.filter(o=>o.agente===a)
    const cDig=cu.length,pDig=pv.length
    const cProd=curProd.filter(o=>o.agente===a),pProd=prevProd.filter(o=>o.agente===a)
    const cProdR=cProd.reduce((s,o)=>s+(o.vrBruto||0),0),pProdR=pProd.reduce((s,o)=>s+(o.vrBruto||0),0)
    const varDig=pDig?((cDig-pDig)/pDig*100):(cDig>0?100:0)
    const varProd=pProdR?((cProdR-pProdR)/pProdR*100):(cProdR>0?100:0)
    const cv=cDig?(cProd.length/cDig*100):0
    let flag='ok',reason=''
    if(cDig===0&&pDig>0){flag='parado';reason='Sem digitação no mês'}
    else if(cDig>0&&cProd.length===0){flag='sem_producao';reason='Digitando mas sem produção'}
    else if(varProd<=-40){flag='queda_prod';reason='Queda de '+Math.abs(varProd).toFixed(0)+'% na produção'}
    else if(varDig<=-40){flag='queda_dig';reason='Queda de '+Math.abs(varDig).toFixed(0)+'% nas digitações'}
    else if(cv<20&&cDig>5){flag='baixa_conv';reason='Conversão de apenas '+cv.toFixed(0)+'%'}
    return{nm:a,cDig,pDig,cProd:cProd.length,pProd:pProd.length,cProdR,pProdR,varDig,varProd,cv,flag,reason}
  }).sort((a,b)=>{const o={parado:0,sem_producao:1,queda_prod:2,queda_dig:3,baixa_conv:4,ok:5};return(o[a.flag]??9)-(o[b.flag]??9)})
  const alertas=st.filter(s=>s.flag!=='ok')
  const ic=f=>f==='parado'?'🔴':f==='sem_producao'?'🟠':f==='queda_prod'?'🔴':f==='queda_dig'?'🟡':f==='baixa_conv'?'🟡':'↗'
  const vc=v=>v>0?'+'+v.toFixed(0)+'%':v.toFixed(0)+'%'
  const vC=v=>v>0?C.accent2:v<-10?C.danger:C.warn
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <h2 style={{fontWeight:800,fontSize:20}}>Alertas — Ação em Parceiros</h2>
      <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label="Parados" value={st.filter(s=>s.flag==='parado').length} color={C.danger}/>
        <Stat label="Sem Produção" value={st.filter(s=>s.flag==='sem_producao').length} color={'#F97316'}/>
        <Stat label="Queda Produção" value={st.filter(s=>s.flag==='queda_prod').length} color={C.danger}/>
        <Stat label="Queda Digitação" value={st.filter(s=>s.flag==='queda_dig').length} color={C.warn}/>
        <Stat label="Baixa Conversão" value={st.filter(s=>s.flag==='baixa_conv').length} color={C.warn}/>
      </div>
      {alertas.length>0&&<div style={{background:'#EF444418',border:'1px solid #EF444433',borderRadius:12,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,color:C.danger,marginBottom:6}}>⚠ {alertas.length} parceiros precisam de ação</div>
        {alertas.slice(0,15).map(s=><div key={s.nm} style={{fontSize:11,padding:'3px 0',cursor:'pointer'}} onClick={()=>setSelP(s.nm)}>
          {ic(s.flag)} <strong>{s.nm}</strong> — <span style={{color:C.muted}}>{s.reason}</span>
        </div>)}
      </div>}
      <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead><tr style={{background:C.surface}}>
            {['','Parceiro','Dig.Mês','Dig.Ant.','Var.Dig.','Prod.Mês','Prod.Ant.','Var.Prod.','Conv.','Ação'].map(h=><th key={h} style={{padding:'7px 8px',textAlign:'left',color:C.muted,fontSize:7,textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>)}
          </tr></thead>
          <tbody>{st.map(s=><tr key={s.nm} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}} onClick={()=>setSelP(s.nm)}>
            <td style={{padding:'6px 8px',fontSize:12}}>{ic(s.flag)}</td>
            <td style={{padding:'6px 8px',fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.nm}</td>
            <td style={{padding:'6px 8px'}}>{s.cDig}</td>
            <td style={{padding:'6px 8px',color:C.muted}}>{s.pDig}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:vC(s.varDig)}}>{vc(s.varDig)}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:C.accent2}}>{fmtCur(s.cProdR)}</td>
            <td style={{padding:'6px 8px',color:C.muted}}>{fmtCur(s.pProdR)}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:vC(s.varProd)}}>{vc(s.varProd)}</td>
            <td style={{padding:'6px 8px',fontWeight:600,color:s.cv>=50?C.accent2:s.cv>=30?C.warn:C.danger}}>{s.cv.toFixed(0)}%</td>
            <td style={{padding:'6px 8px',fontSize:9,color:s.flag==='ok'?C.muted:C.danger}}>{s.flag==='ok'?'—':s.reason}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <PartnerHealth name={selP} ops={curOps} onClose={()=>setSelP(null)}/>
    </div>
  )
}

/* ═══ USUARIOS ═══ */
function Usuarios({user}){
  const ALL_TELAS=['dashboard','ops','producao','analise','estrategico','ranking','portabilidade','recebimentos','alertas','parceiros','neocompra','workbank','pancartao']
  const[users,setUsers]=useState([]),[loading,setLoading]=useState(true),[showNew,setShowNew]=useState(false)
  const[nome,setNome]=useState(''),[email,setEmail]=useState(''),[senha,setSenha]=useState(''),[perfil,setPerfil]=useState('operador'),[msg,setMsg]=useState('')
  const[editTelas,setEditTelas]=useState(null),[editUser,setEditUser]=useState(null)
  const[edNome,setEdNome]=useState(''),[edEmail,setEdEmail]=useState(''),[edSenha,setEdSenha]=useState(''),[edPerfil,setEdPerfil]=useState('operador'),[edParceiroId,setEdParceiroId]=useState('')
  const[parceiroId,setParceiroId]=useState('')
  const[allParceiros,setAllParceiros]=useState([])
  const[showSenha,setShowSenha]=useState({})
  const[sups,setSups]=useState([])
  useEffect(()=>{
    supabase.from('usuarios').select('*').order('nome').then(({data})=>{setUsers(data||[]);setLoading(false)})
    supabase.from('parceiros').select('cod_agente,nome,cod_supervisor').then(({data})=>{
      if(!data)return
      const supCods=new Set(data.map(p=>p.cod_supervisor).filter(Boolean))
      const supList=data.filter(p=>supCods.has(p.cod_agente)).map(p=>({cod:p.cod_agente,nome:p.nome}))
      setSups(supList.length?supList:[...supCods].map(c=>({cod:c,nome:c})))
    })
    supabase.from('parceiros').select('id,nome,telefone,ativo').order('nome').then(({data})=>setAllParceiros(data||[]))
  },[])
  const reload=async()=>{const{data}=await supabase.from('usuarios').select('*').order('nome');setUsers(data||[])}
  const openEdit=u=>{setEditUser(u);setEdNome(u.nome);setEdEmail(u.email);setEdSenha(u.senha||'');setEdPerfil(u.perfil||'operador');setEdParceiroId(u.parceiro_id||'')}
  const saveEdit=async()=>{
    if(!edNome.trim()||!edEmail.trim()){setMsg('Nome e email s\u00e3o obrigat\u00f3rios');return}
    if(!edSenha.trim()){setMsg('A senha n\u00e3o pode ficar vazia');return}
    if(edPerfil==='parceiro'&&!edParceiroId){setMsg('Perfil Parceiro exige v\u00ednculo com parceiro');return}
    const upd={nome:edNome.trim(),email:edEmail.trim(),senha:edSenha.trim(),perfil:edPerfil,parceiro_id:edParceiroId||null}
    const{error}=await supabase.from('usuarios').update(upd).eq('id',editUser.id)
    if(error){setMsg('Erro ao salvar: '+error.message);return}
    setMsg('\u2713 '+edNome+' atualizado com sucesso! Senha: '+edSenha.trim())
    setEditUser(null);await reload()
  }
  const createUser=async(e)=>{
    e.preventDefault()
    if(!nome.trim()||!email.trim()||!senha.trim()){setMsg('Preencha todos os campos');return}
    if(perfil==='parceiro'&&!parceiroId){setMsg('Perfil Parceiro exige sele\u00e7\u00e3o de parceiro');return}
    const telasDefault=perfil==='parceiro'?['meuportal']:ALL_TELAS.slice(0,3)
    const{error}=await supabase.from('usuarios').insert({nome:nome.trim(),email:email.trim(),senha:senha.trim(),perfil,parceiro_id:parceiroId||null,telas:telasDefault})
    if(error){setMsg('Erro ao criar: '+error.message);return}
    setMsg('\u2713 Usu\u00e1rio '+nome+' criado! Senha: '+senha)
    setNome('');setEmail('');setSenha('');setParceiroId('');setShowNew(false);await reload()
  }
  const changeSenha=async(u,novaSenha)=>{
    if(!novaSenha||!novaSenha.trim()){setMsg('Senha n\u00e3o pode ser vazia');return}
    const{error}=await supabase.from('usuarios').update({senha:novaSenha.trim()}).eq('id',u.id)
    if(error){setMsg('Erro: '+error.message);return}
    setMsg('\u2713 Senha de '+u.nome+' alterada para: '+novaSenha.trim())
    await reload()
  }
  if(user.perfil!=='admin')return<div style={{padding:28,textAlign:'center',color:C.muted}}>Restrito</div>
  const inp={background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box',fontFamily:'Outfit,sans-serif'}
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Usu\u00e1rios ({users.length})</h2><button onClick={()=>setShowNew(!showNew)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,fontSize:12,cursor:'pointer'}}>+ Novo</button></div>
    {msg&&<div style={{background:C.accent+'22',color:C.accent,padding:'8px 12px',borderRadius:8,fontSize:12}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',color:C.muted,cursor:'pointer'}}>\u00d7</button></div>}
    {showNew&&<form onSubmit={createUser} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:10,alignItems:'end'}}>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>NOME</label><input value={nome} onChange={e=>setNome(e.target.value)} required autoComplete="off" style={inp}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>EMAIL / LOGIN</label><input value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="off" style={inp}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>SENHA</label><input value={senha} onChange={e=>setSenha(e.target.value)} required autoComplete="new-password" style={inp}/></div>
      <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>PERFIL</label><select value={perfil} onChange={e=>setPerfil(e.target.value)} style={inp}><option value="operador">Operador</option><option value="gestor">Gestor</option><option value="admin">Admin</option><option value="parceiro">Parceiro</option></select></div>
      {perfil==='parceiro'&&<div style={{gridColumn:'1/-1'}}><label style={{fontSize:9,color:C.accent,fontWeight:600,display:'block',marginBottom:3}}>PARCEIRO VINCULADO *</label><select value={parceiroId} onChange={e=>setParceiroId(e.target.value)} required style={{...inp,border:'1px solid '+C.accent}}><option value="">Selecione o parceiro...</option>{allParceiros.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} {p.telefone?'('+p.telefone+')':''}</option>)}</select></div>}
      <button type="submit" style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Criar</button>
    </form>}
    {editUser&&<div style={{background:C.card,border:'1px solid '+C.warn+'66',borderRadius:14,padding:16}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Editar: <strong style={{color:C.warn}}>{editUser.nome}</strong></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:10,alignItems:'end'}}>
        <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>NOME</label><input value={edNome} onChange={e=>setEdNome(e.target.value)} autoComplete="off" style={inp}/></div>
        <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>EMAIL / LOGIN</label><input value={edEmail} onChange={e=>setEdEmail(e.target.value)} autoComplete="off" style={inp}/></div>
        <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>SENHA</label><input value={edSenha} onChange={e=>setEdSenha(e.target.value)} autoComplete="new-password" style={{...inp,border:'1px solid '+C.warn}}/></div>
        <div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>PERFIL</label><select value={edPerfil} onChange={e=>setEdPerfil(e.target.value)} style={inp}><option value="operador">Operador</option><option value="gestor">Gestor</option><option value="admin">Admin</option><option value="parceiro">Parceiro</option></select></div>
        {edPerfil==='parceiro'&&<div style={{gridColumn:'1/-1'}}><label style={{fontSize:9,color:C.accent,fontWeight:600,display:'block',marginBottom:3}}>PARCEIRO VINCULADO *</label><select value={edParceiroId} onChange={e=>setEdParceiroId(e.target.value)} required style={{...inp,border:'1px solid '+C.accent}}><option value="">Selecione o parceiro...</option>{allParceiros.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome} {p.telefone?'('+p.telefone+')':''}</option>)}</select></div>}
        <div style={{display:'flex',gap:6}}><button onClick={saveEdit} style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Salvar</button><button onClick={()=>setEditUser(null)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.muted,padding:'8px 12px',cursor:'pointer'}}>\u00d7</button></div>
      </div>
    </div>}
    {editTelas&&<div style={{background:C.card,border:'1px solid '+C.accent+'66',borderRadius:14,padding:16}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Permiss\u00f5es de tela: <strong style={{color:C.accent}}>{editTelas.nome}</strong></div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
        {ALL_TELAS.map(t=>{const has=(editTelas.telas||[]).includes(t);return<button key={t} onClick={async()=>{const nTelas=has?(editTelas.telas||[]).filter(x=>x!==t):[...(editTelas.telas||[]),t];await supabase.from('usuarios').update({telas:nTelas}).eq('id',editTelas.id);setEditTelas({...editTelas,telas:nTelas});await reload()}} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(has?C.accent2:C.border),background:has?C.accent2+'22':'transparent',color:has?C.accent2:C.muted,fontSize:11,fontWeight:has?600:400,cursor:'pointer'}}>{has?'\u2713 ':''}{t}</button>})}
      </div>
      <button onClick={()=>setEditTelas(null)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',fontSize:11,cursor:'pointer'}}>Fechar</button>
    </div>}
    {!loading&&<div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Nome','Email','Senha','Perfil','Carteira','Telas','Status','A\u00e7\u00f5es'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
      <tbody>{users.map(u=><tr key={u.id} style={{borderBottom:'1px solid '+C.border}}>
        <td style={{padding:'8px 10px',fontWeight:600}}>{u.nome}</td>
        <td style={{padding:'8px 10px'}}>{u.email}</td>
        <td style={{padding:'8px 10px'}}><div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:10,fontFamily:'monospace'}}>{showSenha[u.id]?u.senha:'\u2022\u2022\u2022\u2022\u2022\u2022'}</span><button onClick={()=>setShowSenha(p=>({...p,[u.id]:!p[u.id]}))} style={{background:'none',border:'none',color:C.muted,fontSize:10,cursor:'pointer',padding:0}}>{showSenha[u.id]?'\ud83d\ude48':'\ud83d\udc41'}</button></div></td>
        <td style={{padding:'8px 10px'}}><select value={u.perfil} onChange={async e=>{const{error}=await supabase.from('usuarios').update({perfil:e.target.value}).eq('id',u.id);if(error)setMsg('Erro: '+error.message);else{setMsg('\u2713 Perfil de '+u.nome+' alterado');await reload()}}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:4,color:C.text,padding:'2px 6px',fontSize:10}}><option value="operador">Operador</option><option value="gestor">Gestor</option><option value="admin">Admin</option><option value="parceiro">Parceiro</option></select></td>
        <td style={{padding:'8px 10px'}}><select value={u.cod_supervisor||''} onChange={async e=>{const{error}=await supabase.from('usuarios').update({cod_supervisor:e.target.value||null}).eq('id',u.id);if(error)setMsg('Erro: '+error.message);else await reload()}} style={{background:C.surface,border:'1px solid '+(u.cod_supervisor?C.accent2:C.border),borderRadius:4,color:u.cod_supervisor?C.accent2:C.text,padding:'2px 6px',fontSize:10,minWidth:100}}><option value="">Todos (admin)</option>{sups.map(s=><option key={s.cod} value={s.cod}>{s.nome} ({s.cod})</option>)}</select></td>
        <td style={{padding:'8px 10px'}}><button onClick={()=>setEditTelas(u)} style={{background:C.accent+'22',color:C.accent,border:'none',borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:600,cursor:'pointer'}}>{(u.telas||[]).length} telas \u270f</button></td>
        <td style={{padding:'8px 10px'}}><Badge text={u.ativo?'Ativo':'Inativo'} color={u.ativo?C.accent2:C.danger}/></td>
        <td style={{padding:'8px 10px'}}><div style={{display:'flex',gap:4}}>
          <button onClick={()=>openEdit(u)} style={{background:C.accent+'22',color:C.accent,border:'none',borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:600,cursor:'pointer'}}>\u270f Editar</button>
          <button onClick={async()=>{const{error}=await supabase.from('usuarios').update({ativo:!u.ativo}).eq('id',u.id);if(error)setMsg('Erro: '+error.message);else{setMsg('\u2713 '+u.nome+(u.ativo?' desativado':' ativado'));await reload()}}} style={{background:u.ativo?'#EF444418':C.accent2+'22',color:u.ativo?C.danger:C.accent2,border:'none',borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:600,cursor:'pointer'}}>{u.ativo?'Desativar':'Ativar'}</button>
        </div></td>
      </tr>)}</tbody></table></div>}
  </div>
}

/* ═══ NAV ═══ */
/* ═══ ANÁLISE CRUZADA (TABELA DINÂMICA) ═══ */
function Analise({myAgents}){
  const{per,setPer,ops,loading,customDf,setCustomDf,customDt,setCustomDt,applyCustom}=useOps('mes',myAgents)
  const DIMS=[{id:'banco',l:'Banco',fn:o=>o.banco||'?'},{id:'operacao',l:'Operação',fn:o=>o.operacao||'?'},{id:'convenio',l:'Convênio',fn:o=>o.convenio||'?'},{id:'agente',l:'Parceiro',fn:o=>o.agente||'?'},{id:'situacao',l:'Situação',fn:o=>o.situacao||'?'}]
  const[dim1,setDim1]=useState('banco'),[dim2,setDim2]=useState('operacao'),[showQtd,setShowQtd]=useState(false)
  const[selCell,setSelCell]=useState(null),[dim3,setDim3]=useState(null)
  const d1=DIMS.find(d=>d.id===dim1),d2=DIMS.find(d=>d.id===dim2)
  // Build pivot
  const pivot=useMemo(()=>{
    const mx={},rowTotals={},colTotals={},rowCount={},colCount={}
    let grandTotal=0,grandCount=0
    ops.forEach(o=>{
      const r=d1.fn(o),c=d2.fn(o),v=o.vrBruto||0
      if(!mx[r])mx[r]={};if(!mx[r][c])mx[r][c]={v:0,c:0}
      mx[r][c].v+=v;mx[r][c].c++
      rowTotals[r]=(rowTotals[r]||0)+v;rowCount[r]=(rowCount[r]||0)+1
      colTotals[c]=(colTotals[c]||0)+v;colCount[c]=(colCount[c]||0)+1
      grandTotal+=v;grandCount++
    })
    const rows=Object.keys(mx).sort((a,b)=>(rowTotals[b]||0)-(rowTotals[a]||0))
    const cols=[...new Set(ops.map(d2.fn))].sort((a,b)=>(colTotals[b]||0)-(colTotals[a]||0))
    let maxVal=0;rows.forEach(r=>cols.forEach(c=>{const cell=mx[r]?.[c];if(cell){const v=showQtd?cell.c:cell.v;if(v>maxVal)maxVal=v}}))
    return{mx,rows,cols,rowTotals,colTotals,rowCount,colCount,grandTotal,grandCount,maxVal}
  },[ops,dim1,dim2,showQtd])
  // Drilldown data
  const drillOps=selCell?ops.filter(o=>d1.fn(o)===selCell.r&&d2.fn(o)===selCell.c):[]
  // Sub-pivot for dim3
  const subPivot=useMemo(()=>{
    if(!dim3||!selCell||!drillOps.length)return null
    const d3=DIMS.find(d=>d.id===dim3)
    if(!d3)return null
    const m={};drillOps.forEach(o=>{const k=d3.fn(o);if(!m[k])m[k]={v:0,c:0,fin:0};m[k].v+=(o.vrBruto||0);m[k].c++;if(isFin(o))m[k].fin++})
    return{dim:d3,data:Object.entries(m).sort((a,b)=>b[1].v-a[1].v)}
  },[drillOps,dim3,selCell])
  const heatBg=(val)=>{if(!val||!pivot.maxVal)return'transparent';const pct=val/pivot.maxVal;return`rgba(59,130,246,${Math.min(pct*0.25,0.25)})`}
  const fin=ops.filter(isFin),est=ops.filter(isEst),cv=ops.length?(fin.length/ops.length*100):0
  const sel={background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'6px 10px',fontSize:11,fontFamily:'Outfit,sans-serif'}
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
      <h2 style={{fontWeight:800,fontSize:20}}>Análise Cruzada</h2>
      <ExportBtn ops={ops} name={'analise-'+per}/>
    </div>
    <PeriodBar per={per} setPer={setPer} loading={loading} customDf={customDf} customDt={customDt} setCustomDf={setCustomDf} setCustomDt={setCustomDt} onApplyCustom={applyCustom}/>
    <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Total" value={ops.length} sub={fmtCur(pivot.grandTotal)}/>
      <Stat label="Finalizadas" value={fin.length} sub={fmtCur(fin.reduce((s,o)=>s+(o.vrBruto||0),0))} color={C.accent2}/>
      <Stat label="Estornos" value={est.length} color={C.danger}/>
      <Stat label="Conversão" value={cv.toFixed(0)+'%'} color={cv>=50?C.accent2:cv>=30?C.warn:C.danger}/>
      <Stat label={d1.l+'s'} value={pivot.rows.length}/>
      <Stat label={d2.l+'s'} value={pivot.cols.length}/>
    </div>
    {/* SELETORES */}
    <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:'12px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:10,color:C.muted,fontWeight:600}}>LINHAS:</span>
        <select value={dim1} onChange={e=>{setDim1(e.target.value);setSelCell(null)}} style={sel}>{DIMS.filter(d=>d.id!==dim2).map(d=><option key={d.id} value={d.id}>{d.l}</option>)}</select>
      </div>
      <span style={{fontSize:14,color:C.muted}}>×</span>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:10,color:C.muted,fontWeight:600}}>COLUNAS:</span>
        <select value={dim2} onChange={e=>{setDim2(e.target.value);setSelCell(null)}} style={sel}>{DIMS.filter(d=>d.id!==dim1).map(d=><option key={d.id} value={d.id}>{d.l}</option>)}</select>
      </div>
      <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
        <button onClick={()=>setShowQtd(false)} style={{padding:'5px 12px',borderRadius:6,fontSize:10,border:'1px solid '+(showQtd?C.border:C.accent),background:showQtd?'transparent':C.abg,color:showQtd?C.muted:C.accent,fontWeight:showQtd?400:600,cursor:'pointer'}}>R$ Valor</button>
        <button onClick={()=>setShowQtd(true)} style={{padding:'5px 12px',borderRadius:6,fontSize:10,border:'1px solid '+(!showQtd?C.border:C.accent),background:!showQtd?'transparent':C.abg,color:!showQtd?C.muted:C.accent,fontWeight:!showQtd?400:600,cursor:'pointer'}}># Qtd</button>
      </div>
      <button onClick={()=>{const tmp=dim1;setDim1(dim2);setDim2(tmp);setSelCell(null)}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.accent,padding:'5px 10px',fontSize:10,cursor:'pointer',fontWeight:600}}>⇄ Inverter</button>
    </div>
    {/* TABELA PIVOT */}
    {!loading&&pivot.rows.length>0&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,overflowX:'auto'}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>{d1.l} × {d2.l} {selCell&&<button onClick={()=>setSelCell(null)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.accent,padding:'2px 8px',fontSize:9,cursor:'pointer',marginLeft:8}}>✕ Limpar seleção</button>}</div>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
        <thead><tr style={{background:C.surface}}>
          <th style={{padding:'6px 10px',textAlign:'left',color:C.muted,fontSize:8,position:'sticky',left:0,background:C.surface,zIndex:1}}>{d1.l}</th>
          {pivot.cols.map(c=><th key={c} style={{padding:'6px 8px',textAlign:'right',color:C.muted,fontSize:8,whiteSpace:'nowrap',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis'}}>{c}</th>)}
          <th style={{padding:'6px 10px',textAlign:'right',color:C.accent,fontSize:8,fontWeight:700}}>TOTAL</th>
        </tr></thead>
        <tbody>{pivot.rows.map(r=><tr key={r} style={{borderBottom:'1px solid '+C.border}}>
          <td style={{padding:'5px 10px',fontWeight:600,whiteSpace:'nowrap',position:'sticky',left:0,background:C.card,zIndex:1,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis'}}>{r}</td>
          {pivot.cols.map(c=>{const cell=pivot.mx[r]?.[c];const val=cell?(showQtd?cell.c:cell.v):0;const isSelected=selCell?.r===r&&selCell?.c===c;return<td key={c} onClick={()=>setSelCell(cell?{r,c}:null)} style={{padding:'5px 8px',textAlign:'right',fontWeight:val?600:400,color:val?C.text:C.border,background:isSelected?C.accent+'33':heatBg(val),cursor:cell?'pointer':'default',borderRadius:isSelected?4:0}}>{val?(showQtd?val:fmtCur(val)):'—'}</td>})}
          <td style={{padding:'5px 10px',textAlign:'right',fontWeight:700,color:C.accent,background:C.surface}}>{showQtd?(pivot.rowCount[r]||0):fmtCur(pivot.rowTotals[r]||0)}</td>
        </tr>)}</tbody>
        <tfoot><tr style={{background:C.surface}}>
          <td style={{padding:'6px 10px',fontWeight:700,position:'sticky',left:0,background:C.surface,zIndex:1}}>TOTAL</td>
          {pivot.cols.map(c=><td key={c} style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:C.accent}}>{showQtd?(pivot.colCount[c]||0):fmtCur(pivot.colTotals[c]||0)}</td>)}
          <td style={{padding:'6px 10px',textAlign:'right',fontWeight:800,color:C.accent2}}>{showQtd?pivot.grandCount:fmtCur(pivot.grandTotal)}</td>
        </tr></tfoot>
      </table>
    </div>}
    {/* DRILLDOWN — ao clicar em célula */}
    {selCell&&drillOps.length>0&&<div style={{background:C.card,border:'1px solid '+C.accent+'44',borderRadius:14,padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:8}}>
        <div>
          <span style={{fontSize:13,fontWeight:700,color:C.accent}}>{selCell.r}</span>
          <span style={{fontSize:13,color:C.muted}}> × </span>
          <span style={{fontSize:13,fontWeight:700,color:C.accent2}}>{selCell.c}</span>
          <span style={{fontSize:11,color:C.muted,marginLeft:8}}>— {drillOps.length} registros — {fmtCur(drillOps.reduce((s,o)=>s+(o.vrBruto||0),0))}</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:9,color:C.muted,fontWeight:600}}>Detalhar por:</span>
          <select value={dim3||''} onChange={e=>setDim3(e.target.value||null)} style={sel}>
            <option value="">— Nenhum —</option>
            {DIMS.filter(d=>d.id!==dim1&&d.id!==dim2).map(d=><option key={d.id} value={d.id}>{d.l}</option>)}
          </select>
          <ExportBtn ops={drillOps} name={selCell.r+'-'+selCell.c}/>
        </div>
      </div>
      {/* Sub-agrupamento por 3ª dimensão */}
      {subPivot&&<div style={{marginBottom:14}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10,marginBottom:10}}>
          <thead><tr style={{background:C.surface}}>{[subPivot.dim.l,'Qtd','Valor','Conversão','%'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{subPivot.data.map(([k,d])=>{const pct=drillOps.reduce((s,o)=>s+(o.vrBruto||0),0);const cvn=d.c?(d.fin/d.c*100):0;return<tr key={k} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'5px 8px',fontWeight:600}}>{k}</td>
            <td style={{padding:'5px 8px'}}>{d.c}</td>
            <td style={{padding:'5px 8px',fontWeight:600,color:C.accent}}>{fmtCur(d.v)}</td>
            <td style={{padding:'5px 8px',fontWeight:600,color:cvn>=50?C.accent2:cvn>=30?C.warn:C.danger}}>{cvn.toFixed(0)}%</td>
            <td style={{padding:'5px 8px',color:C.muted}}>{pct?(d.v/pct*100).toFixed(0):0}%</td>
          </tr>})}</tbody>
        </table>
      </div>}
      {/* Lista detalhada */}
      <div style={{overflowX:'auto',maxHeight:300,borderRadius:8,border:'1px solid '+C.border}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Data','Cliente','CPF','Situação','Agente','Vl.Base'].map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{drillOps.slice(0,200).map(o=><tr key={o.id} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'4px 8px',whiteSpace:'nowrap'}}>{fmtDate(o.data)}</td>
            <td style={{padding:'4px 8px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.cliente}</td>
            <td style={{padding:'4px 8px',fontSize:9}}>{o.cpf}</td>
            <td style={{padding:'4px 8px'}}><Badge text={o.situacao||'—'} color={sitCol(o.situacao)}/></td>
            <td style={{padding:'4px 8px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.agente}</td>
            <td style={{padding:'4px 8px',fontWeight:600}}>{fmtCur(o.vrBruto)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </div>
}

/* ═══ NOTIFICAÇÕES ═══ */
function Notificacoes(){
  const[tab,sTab]=useState('historico')
  const[notifs,setNotifs]=useState([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState('')
  const[cfg,setCfg]=useState({}),[loadingCfg,setLoadingCfg]=useState(true)
  const[testing,setTesting]=useState(false),[running,setRunning]=useState(false)
  const[mapList,setMapList]=useState([]),[parcList,setParcList]=useState([])
  const[portabList,setPortabList]=useState([]),[selCpf,setSelCpf]=useState(''),[selParc,setSelParc]=useState('')
  const loadAll=async()=>{
    setLoading(true)
    const{data:n}=await supabase.from('notificacoes_portabilidade').select('*').order('created_at',{ascending:false}).limit(500)
    setNotifs(n||[])
    const{data:c}=await supabase.from('notificacoes_config').select('*')
    const cmap={};(c||[]).forEach(r=>cmap[r.key]=r.value);setCfg(cmap);setLoadingCfg(false)
    const{data:m}=await supabase.from('portabilidade_parceiro_map').select('*, parceiros(nome, telefone)')
    setMapList(m||[])
    const{data:p}=await supabase.from('parceiros').select('id, nome, telefone, telefone_notificacao, ativo').order('nome')
    setParcList(p||[])
    const{data:port}=await supabase.from('portabilidades_enriched').select('id, quali_id, borrower_name, borrower_identity, status_name, parceiro_nome, telefone_envio').order('proposal_date',{ascending:false}).limit(500)
    setPortabList(port||[])
    setLoading(false)
  }
  useEffect(()=>{loadAll()},[])
  const saveCfg=async(key,value)=>{
    const{error}=await supabase.from('notificacoes_config').update({value,updated_at:new Date().toISOString()}).eq('key',key)
    if(error)setMsg('Erro: '+error.message)
    else{setCfg(p=>({...p,[key]:value}));setMsg('✓ Configuração salva')}
  }
  const runSync=async()=>{
    setRunning(true);setMsg('Sincronizando QualiBanking...')
    try{
      const today=new Date(),from=new Date(today);from.setDate(from.getDate()-7)
      const r=await fetch('https://rirsmtyuyqxsoxqbgtpu.supabase.co/functions/v1/sync-qualibanking?from='+localDate(from)+'&to='+localDate(today)+'&onlyPortability=true&delayMs=800&field=proposalDate')
      const j=await r.json()
      setMsg(j.ok?'✓ '+j.upserted+' portabilidades sincronizadas':'Erro: '+(j.error||'falhou'))
    }catch(e){setMsg('Erro: '+e.message)}
    setRunning(false)
  }
  const runNotify=async()=>{
    setTesting(true);setMsg('Processando notificações...')
    try{
      const r=await fetch('https://rirsmtyuyqxsoxqbgtpu.supabase.co/functions/v1/notify-portability-whatsapp',{method:'POST'})
      const j=await r.json()
      setMsg(j.ok?'✓ Avaliado: '+j.evaluated+' | Enviado: '+j.sent+' | Skipped: '+j.skipped+' | Falhou: '+j.failed:'Erro: '+(j.error||'falhou'))
      await loadAll()
    }catch(e){setMsg('Erro: '+e.message)}
    setTesting(false)
  }
  const addMap=async()=>{
    if(!selCpf||!selParc){setMsg('Selecione CPF e parceiro');return}
    const{error}=await supabase.from('portabilidade_parceiro_map').upsert({borrower_identity:selCpf,parceiro_id:selParc},{onConflict:'borrower_identity'})
    if(error)setMsg('Erro: '+error.message)
    else{setMsg('✓ Mapeamento salvo');setSelCpf('');setSelParc('');await loadAll()}
  }
  const removeMap=async(id)=>{
    await supabase.from('portabilidade_parceiro_map').delete().eq('id',id)
    await loadAll()
  }
  const savePhone=async(parceiroId,telefone)=>{
    await supabase.from('parceiros').update({telefone_notificacao:telefone}).eq('id',parceiroId)
    setMsg('✓ Telefone salvo')
    await loadAll()
  }
  // Stats de notificações
  const stats={
    total:notifs.length,
    sent:notifs.filter(n=>n.status==='sent').length,
    failed:notifs.filter(n=>n.status==='failed').length,
    skipped:notifs.filter(n=>n.status==='skipped').length
  }
  const statusColor=s=>s==='sent'?C.accent2:s==='failed'?C.danger:s==='skipped'?C.muted:C.warn
  const triggerEmoji=t=>({balance_arrived:'🟢',balance_retained:'⚠️',balance_rejected:'❌',balance_expired:'⏰',integrated:'✅',canceled:'🔴',status_change:'📋'})[t]||'📋'
  const tabs=[{id:'historico',l:'📜 Histórico'},{id:'config',l:'⚙️ Configurações'},{id:'mapeamento',l:'🔗 Mapeamento CPF→Parceiro'},{id:'telefones',l:'📞 Telefones Parceiros'}]
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
      <h2 style={{fontWeight:800,fontSize:20}}>Notificações WhatsApp</h2>
      <div style={{display:'flex',gap:6}}>
        <button onClick={runSync} disabled={running} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>🔄 Sync Quali</button>
        <button onClick={runNotify} disabled={testing} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:testing?'wait':'pointer',fontWeight:600,fontSize:12,opacity:testing?.6:1}}>{testing?'⏳ Processando...':'▶ Processar Notificações'}</button>
      </div>
    </div>
    {msg&&<div style={{background:msg.includes('✓')?C.accent2+'22':C.warn+'22',color:msg.includes('✓')?C.accent2:C.warn,padding:'8px 14px',borderRadius:8,fontSize:12}}>{msg}<button onClick={()=>setMsg('')} style={{float:'right',background:'none',border:'none',color:'inherit',cursor:'pointer'}}>×</button></div>}
    {/* Alerta dry_run */}
    {cfg.dry_run===true&&<div style={{background:C.warn+'22',color:C.warn,padding:'10px 14px',borderRadius:10,fontSize:12,fontWeight:600}}>⚠️ MODO TESTE (dry_run) — notificações NÃO são enviadas, apenas registradas. Desative na aba Configurações quando estiver tudo OK.</div>}
    {/* KPIs */}
    <div className="rflex" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Total Registros" value={stats.total}/>
      <Stat label="Enviadas" value={stats.sent} color={C.accent2}/>
      <Stat label="Falharam" value={stats.failed} color={C.danger}/>
      <Stat label="Skipped (dry_run/duplicata)" value={stats.skipped} color={C.muted}/>
    </div>
    {/* Tabs */}
    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{tabs.map(t=><button key={t.id} onClick={()=>sTab(t.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(tab===t.id?C.accent:C.border),background:tab===t.id?C.abg:'transparent',color:tab===t.id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:tab===t.id?600:400}}>{t.l}</button>)}</div>

    {/* ABA HISTÓRICO */}
    {tab==='historico'&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
      <div style={{overflowX:'auto',maxHeight:600,borderRadius:8,border:'1px solid '+C.border}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
          <thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Data','Trigger','Status','Destinatário','Telefone','Mensagem (preview)'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{notifs.map(n=><tr key={n.id} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'5px 8px',whiteSpace:'nowrap',fontSize:9}}>{new Date(n.created_at).toLocaleString('pt-BR')}</td>
            <td style={{padding:'5px 8px',fontSize:11}}>{triggerEmoji(n.trigger_type)} <span style={{fontSize:9,color:C.muted}}>{n.trigger_type}</span></td>
            <td style={{padding:'5px 8px'}}><Badge text={n.status} color={statusColor(n.status)}/></td>
            <td style={{padding:'5px 8px',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.recipient_name||'—'}</td>
            <td style={{padding:'5px 8px',fontFamily:'monospace',fontSize:9}}>{n.recipient_phone}</td>
            <td style={{padding:'5px 8px',fontSize:9,color:C.muted,maxWidth:350,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(n.message||'').replace(/\n/g,' ')}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}

    {/* ABA CONFIG */}
    {tab==='config'&&!loadingCfg&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{fontSize:12,fontWeight:700}}>⚙️ Configurações Gerais</div>
      {[
        {k:'enabled',l:'Sistema de notificações ativo',type:'bool'},
        {k:'dry_run',l:'Modo teste (NÃO envia WhatsApp)',type:'bool',danger:true},
        {k:'fallback_to_admin',l:'Fallback: enviar para admin quando sem parceiro',type:'bool'},
        {k:'send_to_client',l:'Enviar também para o cliente final',type:'bool'},
        {k:'business_hours_only',l:'Apenas em horário comercial (8-18h seg-sex)',type:'bool'},
        {k:'admin_phone',l:'Telefone admin (fallback)',type:'text'},
        {k:'evolution_url',l:'URL Evolution API',type:'text'},
        {k:'evolution_instance',l:'Instância Evolution',type:'text'}
      ].map(s=><div key={s.k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'8px 10px',background:C.surface,borderRadius:8}}>
        <div><div style={{fontSize:11,fontWeight:600,color:s.danger&&cfg[s.k]===true?C.warn:C.text}}>{s.l}</div><div style={{fontSize:9,color:C.muted}}>{s.k}</div></div>
        {s.type==='bool'?<label style={{cursor:'pointer'}}><input type="checkbox" checked={cfg[s.k]===true} onChange={e=>saveCfg(s.k,e.target.checked)}/> <span style={{fontSize:11,color:cfg[s.k]===true?C.accent2:C.muted,fontWeight:600}}>{cfg[s.k]===true?'Ativo':'Inativo'}</span></label>:<input defaultValue={cfg[s.k]||''} onBlur={e=>{if(e.target.value!==cfg[s.k])saveCfg(s.k,e.target.value)}} style={{background:C.card,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'5px 10px',fontSize:11,minWidth:250}}/>}
      </div>)}
      <div style={{fontSize:10,color:C.muted,fontStyle:'italic'}}>💡 Templates de mensagens são editáveis via SQL na tabela <code>notificacoes_config</code> → key <code>templates</code></div>
    </div>}

    {/* ABA MAPEAMENTO */}
    {tab==='mapeamento'&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>➕ Associar CPF do cliente a um parceiro</div>
        <div style={{display:'flex',gap:8,alignItems:'end'}}>
          <div style={{flex:1}}>
            <label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>CLIENTE (CPF)</label>
            <select value={selCpf} onChange={e=>setSelCpf(e.target.value)} style={{width:'100%',background:C.surface,border:'1px solid '+C.border,borderRadius:7,padding:'6px 10px',fontSize:11}}>
              <option value="">Selecione...</option>
              {portabList.filter(p=>!p.parceiro_nome).map(p=><option key={p.id} value={p.borrower_identity}>{p.borrower_name} — {p.borrower_identity}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:2}}>PARCEIRO</label>
            <select value={selParc} onChange={e=>setSelParc(e.target.value)} style={{width:'100%',background:C.surface,border:'1px solid '+C.border,borderRadius:7,padding:'6px 10px',fontSize:11}}>
              <option value="">Selecione...</option>
              {parcList.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <button onClick={addMap} style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Salvar</button>
        </div>
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Mapeamentos ativos ({mapList.length})</div>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead><tr style={{background:C.surface}}>{['CPF','Parceiro','Telefone','Criado em',''].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
          <tbody>{mapList.map(m=><tr key={m.id} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'6px 8px',fontFamily:'monospace',fontSize:10}}>{m.borrower_identity||m.quali_id}</td>
            <td style={{padding:'6px 8px',fontWeight:600}}>{m.parceiros?.nome||'—'}</td>
            <td style={{padding:'6px 8px'}}>{m.parceiros?.telefone||'—'}</td>
            <td style={{padding:'6px 8px',fontSize:9}}>{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
            <td style={{padding:'6px 8px'}}><button onClick={()=>removeMap(m.id)} style={{background:C.danger+'22',color:C.danger,border:'none',borderRadius:4,padding:'2px 8px',fontSize:10,cursor:'pointer'}}>Remover</button></td>
          </tr>)}</tbody>
        </table></div>
        {mapList.length===0&&<div style={{textAlign:'center',color:C.muted,fontSize:10,padding:14}}>Nenhum mapeamento manual. Use o form acima para associar CPFs a parceiros.</div>}
      </div>
    </div>}

    {/* ABA TELEFONES */}
    {tab==='telefones'&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>📞 Telefones de Notificação — {parcList.length} parceiros</div>
      <div style={{fontSize:10,color:C.muted,marginBottom:10}}>💡 Use "Telefone Notificação" para um número dedicado (diferente do cadastro principal)</div>
      <div style={{overflowX:'auto',maxHeight:500}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Parceiro','Status','Tel. Principal','Tel. Notificação (editável)'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead>
        <tbody>{parcList.map(p=><tr key={p.id} style={{borderBottom:'1px solid '+C.border}}>
          <td style={{padding:'6px 8px',fontWeight:600,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nome}</td>
          <td style={{padding:'6px 8px'}}><Badge text={p.ativo?'Ativo':'Inativo'} color={p.ativo?C.accent2:C.danger}/></td>
          <td style={{padding:'6px 8px',fontFamily:'monospace',fontSize:10,color:p.telefone?C.text:C.muted}}>{p.telefone||'—'}</td>
          <td style={{padding:'6px 8px'}}><input defaultValue={p.telefone_notificacao||''} placeholder="Ex: 5515999998888" onBlur={e=>{if(e.target.value!==(p.telefone_notificacao||''))savePhone(p.id,e.target.value)}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:4,color:C.text,padding:'4px 8px',fontSize:10,fontFamily:'monospace',width:180}}/></td>
        </tr>)}</tbody>
      </table></div>
    </div>}
  </div>
}

const NAV=[{id:'dashboard',l:'Dashboard',i:'📊'},{id:'ops',l:'Operações',i:'💼'},{id:'producao',l:'Produção',i:'🏦'},{id:'analise',l:'Análise',i:'📋'},{id:'estrategico',l:'Estratégico',i:'🤝'},{id:'ranking',l:'Ranking',i:'🏆'},{id:'portabilidade',l:'Portabilidade',i:'🔄'},{id:'notificacoes',l:'Notificações',i:'📱'},{id:'recebimentos',l:'Recebimentos',i:'💰'},{id:'alertas',l:'Alertas',i:'📈'},{id:'parceiros',l:'Parceiros',i:'🤝'},{id:'neocompra',l:'Esteira Compra',i:'🛒'},{id:'workbank',l:'WorkBank',i:'📤'},{id:'pancartao',l:'Cartão Pan',i:'💳'},{id:'usuarios',l:'Usuários',i:'👤'}]

/* ═══ CONFERÊNCIA CREFISA (Baixa Renda / Bolsa Família) ═══ */
const cfNorm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'')
const cfDig=v=>String(v==null?'':v).replace(/\D/g,'')
const cfPct=v=>{if(v==null||v==='')return null;const n=parseFloat(String(v).replace('%','').replace(',','.').replace(/[^\d.\-]/g,''));return isNaN(n)?null:n}
const cfMoney=v=>'R$ '+(Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const cfOwn=k=>!!k&&(k.startsWith('50471')||k.startsWith('50472'))  // carteira própria LhamasCred (demais prefixos = outra carteira)
const cfExport=(rows,name)=>{if(!rows||!rows.length)return;const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'dados');XLSX.writeFile(wb,name+'.xlsx')}
function cfParsePlanilha(wb){
  const ws=wb.Sheets[wb.SheetNames[0]]
  const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''})
  if(!aoa.length)return[]
  let hi=aoa.findIndex(row=>Array.isArray(row)&&row.some(c=>cfNorm(c)==='cpf')&&row.some(c=>cfNorm(c).includes('contrato')))
  if(hi<0)hi=0
  const H=aoa[hi].map(cfNorm)
  const col=(...nd)=>{for(let i=0;i<H.length;i++)if(nd.some(n=>H[i].includes(n)))return i;return -1}
  const colAll=(...nd)=>{for(let i=0;i<H.length;i++)if(nd.every(n=>H[i].includes(n)))return i;return -1}
  const ci={
    cpf:col('cpf'),contrato:col('contrato'),
    projSafra:colAll('projetad','safra'),proj:col('projetad'),
    vencido:col('vencid'),atraso:col('atraso'),
    inadbr:colAll('inad','br'),zerobr:colAll('zero','pag','br'),
    produto:col('tipoproduto','produto'),bancodeb:col('bancodebito','bancodeb','bancodebit')
  }
  const projIdx=ci.projSafra>=0?ci.projSafra:ci.proj
  const rows=[]
  for(let r=hi+1;r<aoa.length;r++){
    const row=aoa[r];if(!Array.isArray(row))continue
    const contrato=cfDig(row[ci.contrato]),cpf=cfDig(row[ci.cpf])
    if(!contrato&&!cpf)continue
    rows.push({contrato,cpf,
      projSafra:projIdx>=0?pNum(row[projIdx]):0,
      vencido:ci.vencido>=0?pNum(row[ci.vencido]):0,
      atraso:ci.atraso>=0?parseInt(cfDig(row[ci.atraso])||'0',10):0,
      inadBR:ci.inadbr>=0?cfPct(row[ci.inadbr]):null,
      zeroBR:ci.zerobr>=0?cfPct(row[ci.zerobr]):null,
      produto:ci.produto>=0?String(row[ci.produto]||''):'',
      bancoDeb:ci.bancodeb>=0?String(row[ci.bancodeb]||''):''})
  }
  return rows
}
const cfCpf11=v=>{const d=cfDig(v);return d.length>=9&&d.length<=11?d.padStart(11,'0'):d}
function cfParseAcordos(wb){
  const ws=wb.Sheets[wb.SheetNames[0]]
  const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''})
  let hi=aoa.findIndex(r=>Array.isArray(r)&&r.some(c=>cfNorm(c)==='statuspagto'))
  if(hi<0)return[]
  const H=aoa[hi].map(cfNorm)
  const ix=n=>H.indexOf(n)
  const ci={anoMes:ix('anomes'),usuario:ix('nomeusuario'),cliente:ix('nomecliente'),cpf:ix('cpf'),tel:ix('tel'),contrato:ix('codcontrato'),acordo:ix('numeroacordo'),dataAcordo:ix('dataacordo'),atraso:ix('diasatraso'),status:ix('statuspagto'),vlrPago:ix('vlrpago'),plano:ix('plano'),faixa:ix('faixaatraso'),vlrCom:ix('valorcalculadoporfaixacomissao')}
  const rows=[]
  for(let r=hi+1;r<aoa.length;r++){const row=aoa[r];if(!Array.isArray(row))continue
    const cpf=cfCpf11(row[ci.cpf]);if(!cpf)continue
    rows.push({anoMes:String(row[ci.anoMes]||''),usuario:String(row[ci.usuario]||'(sem)'),cliente:String(row[ci.cliente]||''),cpf,tel:String(row[ci.tel]||''),contrato:cfDig(row[ci.contrato]),acordo:String(row[ci.acordo]||''),dataAcordo:String(row[ci.dataAcordo]||''),atraso:parseInt(cfDig(row[ci.atraso])||'0',10),status:String(row[ci.status]||'').toUpperCase(),vlrPago:pNum(row[ci.vlrPago]),plano:String(row[ci.plano]||''),faixa:String(row[ci.faixa]||''),vlrCom:pNum(row[ci.vlrCom])})}
  return rows
}
function ConferenciaCrefisa(){
  const[inad,setInad]=useState(null),[adim,setAdim]=useState(null)
  const[cart,setCart]=useState(null)
  const[loading,setLoading]=useState(false),[prog,setProg]=useState(''),[err,setErr]=useState('')
  const[sub,setSub]=useState('cobertura')
  const[selSafra,setSelSafra]=useState(null),[selAg,setSelAg]=useState(null)
  const[acordos,setAcordos]=useState(null)
  const inadRef=useRef(),adimRef=useRef(),acRef=useRef()
  const readFile=(file,setter,tipo,parser)=>{const rd=new FileReader();rd.onload=ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const rows=(parser||cfParsePlanilha)(wb);if(!rows.length){setErr('Não reconheci o formato de '+tipo+' — confira se é o arquivo certo.');return}setter({nome:file.name,rows});setErr('')}catch(e){setErr('Erro lendo '+tipo+': '+e.message)}};rd.readAsArrayBuffer(file)}
  const fetchCarteira=async()=>{
    setLoading(true);setErr('');setCart(null)
    const d12=new Date();d12.setMonth(d12.getMonth()-12);const piso=d12.toISOString().slice(0,10)
    const PAGE=1000;let all=[],from=0
    try{
      while(true){
        const{data,error}=await supabase.from('digitacoes')
          .select('contrato,cpf,cliente,vr_bruto,vr_parcela,prazo,situacao,produto,data,agente')
          .eq('banco','CREFISACP').gte('data',piso).not('contrato','is',null)
          .or('contrato.like.50471*,contrato.like.50472*')
          .in('situacao',['CONCRETIZADO','CRC CLIENTE','PAGO','INTEGRADA','PAGO C/PENDÊNCIA','PORTABILIDADE AVERBADA'])
          .not('agente','ilike','%teste%').not('cliente','ilike','%teste%')
          .range(from,from+PAGE-1)
        if(error){setErr('Erro carteira: '+error.message);break}
        if(!data||!data.length)break
        all=all.concat(data);setProg('Carregando carteira... '+all.length)
        if(data.length<PAGE)break;from+=PAGE
      }
      setCart({piso,rows:all})
    }catch(e){setErr('Erro: '+e.message)}
    setLoading(false);setProg('')
  }
  const R=useMemo(()=>{
    if(!cart)return null
    // Une as DUAS planilhas num único conjunto "reportados pela Crefisa", por contrato.
    // Status real (devendo) vem de Valor Vencido / Dias em Atraso, NÃO da planilha de origem.
    const rep=new Map()
    const addRep=(rows,origem)=>{(rows||[]).forEach(r=>{if(!r.contrato||!cfOwn(r.contrato))return;const e=rep.get(r.contrato)||{contrato:r.contrato,cpf:r.cpf,vencido:0,atraso:0,projSafra:0,inadBR:null,origens:new Set()};e.vencido=Math.max(e.vencido,r.vencido||0);e.atraso=Math.max(e.atraso,r.atraso||0);if((r.projSafra||0)>e.projSafra)e.projSafra=r.projSafra||0;if(r.inadBR!=null)e.inadBR=r.inadBR;e.origens.add(origem);rep.set(r.contrato,e)})}
    addRep(inad?.rows,'Inadimplência');addRep(adim?.rows,'Adimplência')
    const isDevendo=e=>(e.vencido>0)  // inadimplente = SÓ quem tem valor vencido em aberto > 0
    // Base = finalizados próprios (own)
    const constam=[],naoConsta=[]
    const own=cart.rows.filter(c=>cfOwn(cfDig(c.contrato)))  // só carteira própria (50471/50472)
    const cartM=new Map()
    own.forEach(c=>{const k=cfDig(c.contrato);if(!k)return;cartM.set(k,c)
      const r=rep.get(k)
      if(r)constam.push({...c,_r:r,dev:isDevendo(r)})
      else naoConsta.push(c)})
    // Mês de corte = safra mais recente presente na planilha. O que é posterior ainda não entrou (não é "falta").
    const cutoff=constam.reduce((m,c)=>{const s=(c.data||'').slice(0,7);return s>m?s:m},'')
    const posterior=naoConsta.filter(c=>(c.data||'').slice(0,7)>cutoff)  // originado após o corte da planilha
    const faltaReal=naoConsta.filter(c=>!((c.data||'').slice(0,7)>cutoff))  // dentro do período → falta de verdade
    const inadimplentes=constam.filter(c=>c.dev)
    const adimplentes=constam.filter(c=>!c.dev)
    // Safra fora do padrão: parcela ≠ R$159 ou prazo ≠ 12 (possível anomalia)
    const anomalias=own.filter(c=>{const p=Number(c.vr_parcela)||0,pz=String(c.prazo||'').trim();return (p>0&&Math.abs(p-159)>0.5)||(pz!==''&&pz!=='12')})
    // Reportados pela Crefisa que NÃO estão entre os finalizados próprios (em análise, cancelado, fora 12m ou nº divergente)
    const foraFinal=[];rep.forEach((r,k)=>{if(!cartM.has(k))foraFinal.push({contrato:k,cpf:r.cpf,projSafra:r.projSafra,vencido:r.vencido,atraso:r.atraso,origem:[...r.origens].join(' + ')})})
    const total=own.length
    const noPeriodo=constam.length+faltaReal.length  // universo dentro do período coberto pela planilha
    const cobertura=noPeriodo>0?(constam.length/noPeriodo*100):0
    const taxaInad=constam.length>0?(inadimplentes.length/constam.length*100):0
    const taxaTotal=total>0?(inadimplentes.length/total*100):0
    const vencidoTot=constam.reduce((s,c)=>s+(c._r.vencido||0),0)
    const projConstam=constam.reduce((s,c)=>s+(c._r.projSafra||0),0)
    const valCart=own.reduce((s,c)=>s+(Number(c.vr_bruto)||0),0)
    const inadReport=[...rep.values()].map(r=>r.inadBR).filter(v=>v!=null)
    const inadReportAvg=inadReport.length?(inadReport.reduce((a,b)=>a+b,0)/inadReport.length):null
    const faixas={'só vencido':0,'1-30':0,'31-60':0,'61-90':0,'90+':0}
    inadimplentes.forEach(c=>{const d=c._r.atraso||0;if(d<=0)faixas['só vencido']++;else if(d<=30)faixas['1-30']++;else if(d<=60)faixas['31-60']++;else if(d<=90)faixas['61-90']++;else faixas['90+']++})
    // Agrupa por SAFRA (mês de originação) e por USUÁRIO/agente — inadimplência sobre os que constam
    const finBySafra=new Map(),finByAg=new Map()
    own.forEach(c=>{const s=(c.data||'').slice(0,7)||'?';finBySafra.set(s,(finBySafra.get(s)||0)+1);const a=c.agente||'(sem agente)';finByAg.set(a,(finByAg.get(a)||0)+1)})
    const grpS=new Map(),grpA=new Map()
    const bump=(m,key,c)=>{const e=m.get(key)||{key,constam:0,inad:0,vencido:0,proj:0};e.constam++;if(c.dev)e.inad++;e.vencido+=(c._r.vencido||0);e.proj+=(c._r.projSafra||0);m.set(key,e)}
    constam.forEach(c=>{bump(grpS,(c.data||'').slice(0,7)||'?',c);bump(grpA,c.agente||'(sem agente)',c)})
    const safras=[...grpS.values()].map(e=>({...e,fin:finBySafra.get(e.key)||e.constam,pctInad:e.constam?e.inad/e.constam*100:0})).sort((a,b)=>a.key.localeCompare(b.key))
    const usuarios=[...grpA.values()].map(e=>({...e,fin:finByAg.get(e.key)||e.constam,pctInad:e.constam?e.inad/e.constam*100:0})).sort((a,b)=>b.vencido-a.vencido)
    return{constam,naoConsta,posterior,faltaReal,cutoff,noPeriodo,inadimplentes,adimplentes,anomalias,foraFinal,total,cobertura,taxaInad,taxaTotal,vencidoTot,projConstam,valCart,inadReportAvg,faixas,safras,usuarios,repCount:rep.size}
  },[cart,inad,adim])
  const FileBox=({label,state,onPick,inputRef,color})=>(
    <div style={{flex:1,minWidth:200,background:C.card,border:'1px dashed '+(state?color:C.border),borderRadius:12,padding:14}}>
      <div style={{fontSize:11,fontWeight:700,color:state?color:C.muted,marginBottom:6}}>{label}</div>
      {state?<div style={{fontSize:11,color:C.text}}>✓ {state.nome}<div style={{fontSize:10,color:C.muted,marginTop:2}}>{state.rows.length} contratos lidos</div></div>:<div style={{fontSize:10,color:C.muted}}>Nenhuma planilha carregada</div>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)onPick(f)}}/>
      <button onClick={()=>inputRef.current?.click()} style={{marginTop:8,padding:'6px 12px',borderRadius:7,border:'1px solid '+C.border,background:C.surface,color:C.text,fontSize:11,cursor:'pointer'}}>📂 {state?'Trocar':'Selecionar'} arquivo</button>
    </div>
  )
  const th={padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}
  const td={padding:'7px 10px',fontSize:11,borderBottom:'1px solid '+C.border}
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div><h2 style={{fontWeight:800,fontSize:20,margin:0}}>🔍 Conferência Crefisa</h2><div style={{fontSize:11,color:C.muted,marginTop:2}}>Baixa Renda / Bolsa Família · FINALIZADOS dos últimos 12 meses · só carteira própria (contratos 50471/50472) · cruzado por nº de contrato</div></div>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <FileBox label="📋 Planilha Crefisa — safra (inadimplência)" state={inad} onPick={f=>readFile(f,setInad,'inadimplência')} inputRef={inadRef} color={C.danger}/>
      <FileBox label="📗 Adimplência (opcional — normalmente já vem na de cima)" state={adim} onPick={f=>readFile(f,setAdim,'adimplência')} inputRef={adimRef} color={C.accent2}/>
      <FileBox label="🤝 Acordos de cobrança (RelAcordosCrefisa — opcional)" state={acordos} onPick={f=>readFile(f,setAcordos,'acordos',cfParseAcordos)} inputRef={acRef} color={C.info}/>
      <div style={{display:'flex',flexDirection:'column',justifyContent:'center',gap:6,minWidth:170}}>
        <button onClick={fetchCarteira} disabled={loading||(!inad&&!adim)} style={{padding:'12px 18px',borderRadius:10,border:'none',background:(loading||(!inad&&!adim))?C.border:C.accent,color:'#fff',fontWeight:700,fontSize:13,cursor:(loading||(!inad&&!adim))?'default':'pointer'}}>{loading?'Processando...':'▶ Confrontar carteira'}</button>
        {prog&&<div style={{fontSize:10,color:C.warn}}>{prog}</div>}
        {cart&&!loading&&<div style={{fontSize:10,color:C.accent2}}>✓ {cart.rows.length} finalizados na carteira (desde {cart.piso})</div>}
      </div>
    </div>
    {err&&<div style={{background:'#EF444418',color:C.danger,padding:'10px 14px',borderRadius:8,fontSize:12}}>{err}</div>}
    {R&&<>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label="Finalizados 12m" value={R.total} sub={cfMoney(R.valCart)}/>
        <Stat label="Constam na Crefisa" value={R.constam.length} sub={R.cobertura.toFixed(1)+'% de cobertura'} color={C.accent2}/>
        <Stat label="Falta reportar" value={R.faltaReal.length} sub={R.posterior.length?('+'+R.posterior.length+' de período novo'):('até '+(R.cutoff||'—'))} color={C.warn}/>
        <Stat label="Inadimplentes" value={R.inadimplentes.length} sub={'Vencido '+cfMoney(R.vencidoTot)} color={C.danger}/>
        <Stat label="Taxa inad. real" value={R.taxaInad.toFixed(1)+'%'} sub={'dos '+R.constam.length+' que constam'} color={C.danger}/>
        <Stat label="% inad. Crefisa (planilha)" value={R.inadReportAvg!=null?R.inadReportAvg.toFixed(1)+'%':'—'} sub="média reportada"/>
      </div>
      {(()=>{const ofS=R.safras.reduce((a,b)=>b.vencido>((a&&a.vencido)||-1)?b:a,null);const ofA=R.usuarios[0];const perda=R.projConstam>0?(R.vencidoTot/R.projConstam*100):0
      return<div style={{background:C.abg,border:'1px solid '+C.accent+'44',borderRadius:12,padding:'12px 16px',fontSize:12,lineHeight:1.7}}>
        <b>📌 Leitura rápida:</b> dos <b>{R.noPeriodo}</b> finalizados até <b>{R.cutoff||'—'}</b>, <b style={{color:C.accent2}}>{R.constam.length}</b> constam na Crefisa ({R.cobertura.toFixed(1)}%) e <b style={{color:C.warn}}>{R.faltaReal.length}</b> faltam.
        {' '}Devendo: <b style={{color:C.danger}}>{R.inadimplentes.length}</b> ({R.taxaInad.toFixed(1)}%) — <b style={{color:C.danger}}>{cfMoney(R.vencidoTot)}</b> vencido de {cfMoney(R.projConstam)} projetado (<b style={{color:perda>=30?C.danger:C.warn}}>{perda.toFixed(1)}% de perda</b>).
        {ofS?<> Safra ofensora: <b style={{color:C.danger}}>{ofS.key}</b> ({cfMoney(ofS.vencido)}).</>:null}
        {ofA?<> Maior ofensor: <b style={{color:C.danger}}>{(ofA.key||'').split(' ').slice(0,3).join(' ')}</b> ({cfMoney(ofA.vencido)}).</>:null}
      </div>})()}
      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
        {[{id:'cobertura',l:'🧩 Cobertura (o que falta)'},{id:'inadimplencia',l:'📕 Inadimplência'},{id:'safras',l:'📅 Safras & Ofensores'},{id:'cobranca',l:'🤝 Cobrança'},{id:'valores',l:'💵 Safra'}].map(t=><button key={t.id} onClick={()=>setSub(t.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(sub===t.id?C.accent:C.border),background:sub===t.id?C.abg:'transparent',color:sub===t.id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:sub===t.id?600:400}}>{t.l}</button>)}
      </div>
      {sub==='cobertura'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>Dos {R.noPeriodo} finalizados até {R.cutoff||'—'} (período da planilha), quantos a Crefisa está acompanhando?</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:10}}>{R.posterior.length>0?R.posterior.length+' contratos originados depois de '+R.cutoff+' foram excluídos da cobertura — ainda não entraram na planilha (não é falta).':'A planilha cobre até '+(R.cutoff||'—')+'.'}</div>
          <div style={{display:'flex',height:26,borderRadius:8,overflow:'hidden',border:'1px solid '+C.border}}>
            <div style={{width:R.cobertura+'%',background:C.accent2,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700}} title="Constam na planilha">{R.cobertura>=10?R.cobertura.toFixed(1)+'%':''}</div>
            <div style={{flex:1,background:C.warn,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,fontWeight:700}} title="Falta">{(100-R.cobertura)>=8?(100-R.cobertura).toFixed(1)+'%':''}</div>
          </div>
          <div style={{display:'flex',gap:16,marginTop:10,fontSize:12,flexWrap:'wrap'}}>
            <span><b style={{color:C.accent2}}>{R.constam.length}</b> constam</span>
            <span><b style={{color:C.warn}}>{R.faltaReal.length}</b> faltam de verdade (dentro do período)</span>
            {R.posterior.length>0&&<span><b style={{color:C.info}}>{R.posterior.length}</b> de período novo (após {R.cutoff})</span>}
          </div>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:C.warn}}>🧩 Faltam de verdade — finalizados até {R.cutoff||'—'} que a Crefisa NÃO reportou ({R.faltaReal.length})</div>
            <button onClick={()=>cfExport(R.faltaReal.map(c=>({contrato:c.contrato,cpf:c.cpf,cliente:c.cliente,valor:c.vr_bruto,parcela:c.vr_parcela,prazo:c.prazo,situacao:c.situacao,data:c.data,agente:c.agente})),'crefisa-falta-reportar')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Contratos finalizados dentro do período da planilha que não aparecem nela — a Crefisa pode não estar considerando essa safra. Investigar.</div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:360,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Cliente','Valor','Situação','Data','Agente'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{R.faltaReal.slice(0,500).map((c,i)=><tr key={i}><td style={td}>{c.contrato}</td><td style={{...td,color:C.muted}}>{c.cpf}</td><td style={td}>{(c.cliente||'').slice(0,28)}</td><td style={td}>{cfMoney(c.vr_bruto)}</td><td style={td}><Badge text={c.situacao||'—'} color={C.info}/></td><td style={td}>{fmtDate?fmtDate(c.data):c.data}</td><td style={{...td,color:C.muted}}>{(c.agente||'').slice(0,18)}</td></tr>)}</tbody></table></div>
          {R.faltaReal.length>500&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>Mostrando 500 de {R.faltaReal.length}. Exporte para ver todos.</div>}
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:C.info}}>📤 Na planilha da Crefisa mas NÃO entre os finalizados 12m ({R.foraFinal.length})</div>
            <button onClick={()=>cfExport(R.foraFinal,'crefisa-fora-finalizados')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Contratos que a Crefisa reportou mas não achamos entre os finalizados dos últimos 12 meses (em análise, cancelado, período anterior ou nº divergente).</div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:300,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Proj. Safra','Vencido','Atraso','Planilha'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{R.foraFinal.slice(0,500).map((c,i)=><tr key={i}><td style={td}>{c.contrato}</td><td style={{...td,color:C.muted}}>{c.cpf}</td><td style={td}>{cfMoney(c.projSafra)}</td><td style={td}>{cfMoney(c.vencido)}</td><td style={td}>{c.atraso||0}d</td><td style={td}><Badge text={c.origem} color={C.info}/></td></tr>)}</tbody></table></div>
        </div>
      </div>}
      {sub==='inadimplencia'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Taxa de inadimplência</div>
            <div style={{fontSize:10,color:C.muted,marginBottom:8}}>Devendo = só quem tem Valor Vencido em aberto &gt; 0.</div>
            <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:12}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.muted}}>Real (devendo / finalizados que constam)</span><b style={{color:C.danger}}>{R.taxaInad.toFixed(2)}%</b></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.muted}}>Devendo sobre todos os finalizados 12m</span><b>{R.taxaTotal.toFixed(2)}%</b></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.muted}}>Reportada Crefisa (% inad BR média)</span><b>{R.inadReportAvg!=null?R.inadReportAvg.toFixed(2)+'%':'—'}</b></div>
              {R.inadReportAvg!=null&&<div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid '+C.border,paddingTop:8}}><span style={{color:C.muted}}>Diferença (real − reportada)</span><b style={{color:Math.abs(R.taxaInad-R.inadReportAvg)>5?C.danger:C.accent2}}>{(R.taxaInad-R.inadReportAvg>=0?'+':'')+(R.taxaInad-R.inadReportAvg).toFixed(2)} pp</b></div>}
            </div>
          </div>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Inadimplentes por dias em atraso</div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {Object.entries(R.faixas).map(([k,v])=>{const pct=R.inadimplentes.length?(v/R.inadimplentes.length*100):0;return<div key={k} style={{display:'flex',alignItems:'center',gap:8,fontSize:11}}><span style={{width:66,color:C.muted}}>{k==='só vencido'?k:k+' dias'}</span><div style={{flex:1,background:C.surface,borderRadius:5,height:14,overflow:'hidden'}}><div style={{width:pct+'%',height:'100%',background:k==='só vencido'?C.muted:k==='90+'?C.danger:C.warn}}/></div><span style={{width:60,textAlign:'right'}}>{v} ({pct.toFixed(0)}%)</span></div>})}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Stat label="Devendo (inadimplentes)" value={R.inadimplentes.length} small color={C.danger}/>
          <Stat label="Em dia (adimplentes)" value={R.adimplentes.length} small color={C.accent2}/>
          <Stat label="Valor vencido total" value={cfMoney(R.vencidoTot)} small color={C.danger}/>
          <Stat label="Proj. safra (constam)" value={cfMoney(R.projConstam)} small/>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:C.danger}}>📕 Finalizados devendo ({R.inadimplentes.length})</div>
            <button onClick={()=>cfExport(R.inadimplentes.map(c=>({contrato:c.contrato,cpf:c.cpf,cliente:c.cliente,valor:c.vr_bruto,vencido:c._r.vencido,dias_atraso:c._r.atraso,situacao:c.situacao,agente:c.agente})),'crefisa-inadimplentes')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:360,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Cliente','Valor','Vencido','Atraso','Agente'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{R.inadimplentes.slice(0,500).map((c,i)=><tr key={i}><td style={td}>{c.contrato}</td><td style={{...td,color:C.muted}}>{c.cpf}</td><td style={td}>{(c.cliente||'').slice(0,26)}</td><td style={td}>{cfMoney(c.vr_bruto)}</td><td style={{...td,color:C.danger,fontWeight:600}}>{cfMoney(c._r.vencido)}</td><td style={td}>{c._r.atraso||0}d</td><td style={{...td,color:C.muted}}>{(c.agente||'').slice(0,16)}</td></tr>)}</tbody></table></div>
        </div>
      </div>}
      {sub==='safras'&&(()=>{
        const ofS=R.safras.reduce((a,b)=>b.vencido>((a&&a.vencido)||-1)?b:a,null)
        // Drill-down: base filtrada pela safra selecionada
        const base=selSafra?R.constam.filter(c=>(c.data||'').slice(0,7)===selSafra):R.constam
        const grp=new Map()
        base.forEach(c=>{const a=c.agente||'(sem agente)';const e=grp.get(a)||{key:a,constam:0,inad:0,venc:0};e.constam++;if(c.dev){e.inad++;e.venc+=(c._r.vencido||0)}grp.set(a,e)})
        const ags=[...grp.values()].map(e=>({...e,pct:e.constam?e.inad/e.constam*100:0})).sort((a,b)=>b.venc-a.venc)
        const devList=selAg?base.filter(c=>c.dev&&(c.agente||'(sem agente)')===selAg):[]
        return<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700}}>📅 Inadimplência por safra (mês de originação){ofS?<span style={{color:C.danger,fontWeight:400}}> · ofensora: {ofS.key}</span>:''}</div>
            <button onClick={()=>cfExport(R.safras.map(s=>({safra:s.key,finalizados:s.fin,constam:s.constam,inadimplentes:s.inad,pct_inad:+s.pctInad.toFixed(1),vencido:+s.vencido.toFixed(2),proj_safra:+s.proj.toFixed(2),pct_perda:s.proj>0?+(s.vencido/s.proj*100).toFixed(1):0})),'crefisa-safras')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>👆 Clique numa safra para ver os ofensores só daquele mês. % Perda = vencido ÷ projetado. Safra ofensora = maior vencido.</div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:400,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Safra','Finalizados','Constam','Inadimpl.','% Inad','Vencido','Proj. Safra','% Perda'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{R.safras.map((s,i)=>{const perda=s.proj>0?(s.vencido/s.proj*100):0;const sel=selSafra===s.key;return<tr key={i} onClick={()=>{setSelSafra(sel?null:s.key);setSelAg(null)}} style={{cursor:'pointer',background:sel?C.abg:ofS&&s.key===ofS.key?'#EF444410':'transparent',outline:sel?'1px solid '+C.accent:'none'}}><td style={{...td,fontWeight:600,color:sel?C.accent:C.text}}>{sel?'▶ ':''}{s.key}</td><td style={td}>{s.fin}</td><td style={td}>{s.constam}</td><td style={{...td,color:C.danger}}>{s.inad}</td><td style={{...td,fontWeight:700,color:s.pctInad>=30?C.danger:s.pctInad>=15?C.warn:C.text}}>{s.pctInad.toFixed(1)}%</td><td style={{...td,fontWeight:600,color:C.danger}}>{cfMoney(s.vencido)}</td><td style={td}>{cfMoney(s.proj)}</td><td style={{...td,fontWeight:700,color:perda>=30?C.danger:perda>=15?C.warn:C.accent2}}>{perda.toFixed(1)}%</td></tr>})}</tbody></table></div>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700}}>👤 Agentes ofensores{selSafra?<span style={{color:C.accent}}> · safra {selSafra}</span>:' · todas as safras'}{selSafra&&<button onClick={()=>{setSelSafra(null);setSelAg(null)}} style={{marginLeft:8,fontSize:9,padding:'2px 8px',borderRadius:5,border:'1px solid '+C.border,background:C.surface,color:C.muted,cursor:'pointer'}}>✕ limpar filtro</button>}</div>
            <button onClick={()=>cfExport(ags.map(u=>({agente:u.key,constam:u.constam,inadimplentes:u.inad,pct_inad:+u.pct.toFixed(1),vencido:+u.venc.toFixed(2)})),'crefisa-ofensores'+(selSafra?'-'+selSafra:''))} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>👆 Clique num agente para abrir os contratos devendo dele (lista de cobrança). Ordenado por vencido.</div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:340,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['#','Agente','Constam','Inadimpl.','% Inad','Vencido'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{ags.slice(0,200).map((u,i)=>{const sel=selAg===u.key;return<tr key={i} onClick={()=>setSelAg(sel?null:u.key)} style={{cursor:'pointer',background:sel?C.abg:'transparent',outline:sel?'1px solid '+C.accent:'none'}}><td style={{...td,color:C.muted}}>{i+1}</td><td style={{...td,fontWeight:600,color:sel?C.accent:C.text}}>{sel?'▶ ':''}{(u.key||'').slice(0,34)}</td><td style={td}>{u.constam}</td><td style={{...td,color:C.danger}}>{u.inad}</td><td style={{...td,fontWeight:700,color:u.pct>=30?C.danger:u.pct>=15?C.warn:C.text}}>{u.pct.toFixed(1)}%</td><td style={{...td,fontWeight:600,color:C.danger}}>{cfMoney(u.venc)}</td></tr>})}</tbody></table></div>
        </div>
        {selAg&&<div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:C.danger}}>📞 Contratos devendo de {(selAg||'').slice(0,34)}{selSafra?' · safra '+selSafra:''} ({devList.length})</div>
            <button onClick={()=>cfExport(devList.map(c=>({contrato:c.contrato,cpf:c.cpf,cliente:c.cliente,vencido:c._r.vencido,dias_atraso:c._r.atraso,safra:(c.data||'').slice(0,7),valor:c.vr_bruto})),'cobranca-'+(selAg||'').split(' ')[0].toLowerCase()+(selSafra?'-'+selSafra:''))} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.danger,background:'#EF444410',color:C.danger,fontWeight:600,cursor:'pointer'}}>⬇ Exportar lista de cobrança</button>
          </div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:340,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Cliente','Safra','Vencido','Atraso'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{devList.sort((a,b)=>(b._r.vencido||0)-(a._r.vencido||0)).map((c,i)=><tr key={i}><td style={td}>{c.contrato}</td><td style={{...td,color:C.muted}}>{c.cpf}</td><td style={td}>{(c.cliente||'').slice(0,28)}</td><td style={td}>{(c.data||'').slice(0,7)}</td><td style={{...td,fontWeight:700,color:C.danger}}>{cfMoney(c._r.vencido)}</td><td style={td}>{c._r.atraso||0}d</td></tr>)}</tbody></table></div>
        </div>}
      </div>})()}
      {sub==='cobranca'&&(()=>{
        if(!acordos)return<div style={{background:C.card,border:'1px dashed '+C.border,borderRadius:14,padding:36,textAlign:'center',color:C.muted,fontSize:12}}>Suba o relatório <b>RelAcordosCrefisa</b> (exportado do painel da Crefisa) no box 🤝 acima para conferir a cobrança.</div>
        const rows=acordos.rows
        const pagos=rows.filter(r=>r.status==='PAGO')
        const conv=rows.length?pagos.length/rows.length*100:0
        const vlrRec=pagos.reduce((s,r)=>s+r.vlrPago,0)
        const comReal=pagos.reduce((s,r)=>s+r.vlrCom,0)
        // Cruzamento por CPF: inadimplentes da safra BR × acordos
        const acCpf=new Set(rows.map(r=>r.cpf))
        const inadSem=R.inadimplentes.filter(c=>!acCpf.has(cfCpf11(c.cpf))).sort((a,b)=>(b._r.vencido||0)-(a._r.vencido||0))
        const inadCom=R.inadimplentes.length-inadSem.length
        const vencSem=inadSem.reduce((s,c)=>s+(c._r.vencido||0),0)
        // Ranking operadores de cobrança
        const ops=new Map()
        rows.forEach(r=>{const e=ops.get(r.usuario)||{key:r.usuario,tot:0,pagos:0,vlr:0,com:0};e.tot++;if(r.status==='PAGO'){e.pagos++;e.vlr+=r.vlrPago;e.com+=r.vlrCom}ops.set(r.usuario,e)})
        const opsRank=[...ops.values()].map(e=>({...e,conv:e.tot?e.pagos/e.tot*100:0})).sort((a,b)=>b.vlr-a.vlr)
        return<div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Stat label="Acordos (grupo todo)" value={rows.length} sub={acordos.nome.slice(0,28)}/>
          <Stat label="Pagos" value={pagos.length} sub={conv.toFixed(1)+'% de conversão'} color={C.accent2}/>
          <Stat label="Recuperado" value={cfMoney(vlrRec)} color={C.accent2}/>
          <Stat label="Comissão de cobrança" value={cfMoney(comReal)} sub="sobre acordos pagos" color={C.accent}/>
        </div>
        <div style={{background:inadSem.length>0?'#EF444412':C.abg,border:'1px solid '+(inadSem.length>0?C.danger:C.accent2),borderRadius:12,padding:'12px 16px',fontSize:12,lineHeight:1.7}}>
          <b>📌 Conferência Bolsa Família × Cobrança:</b> dos <b style={{color:C.danger}}>{R.inadimplentes.length}</b> inadimplentes da safra BR, <b style={{color:C.accent2}}>{inadCom}</b> têm acordo de cobrança e <b style={{color:C.danger}}>{inadSem.length}</b> estão <b>SEM NENHUM ACORDO</b> — {cfMoney(vencSem)} vencido sem ninguém cobrando.
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:C.danger}}>🚨 Inadimplentes BR sem acordo de cobrança ({inadSem.length})</div>
            <button onClick={()=>cfExport(inadSem.map(c=>({contrato:c.contrato,cpf:c.cpf,cliente:c.cliente,vencido:c._r.vencido,dias_atraso:c._r.atraso,safra:(c.data||'').slice(0,7),agente:c.agente})),'crefisa-inadimplentes-sem-cobranca')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.danger,background:'#EF444410',color:C.danger,fontWeight:600,cursor:'pointer'}}>⬇ Exportar para acionar cobrança</button>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Clientes devendo na safra Bolsa Família que não aparecem no relatório de acordos — ordenados do maior vencido. Cruzamento por CPF.</div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:360,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Cliente','Safra','Vencido','Atraso','Agente'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{inadSem.slice(0,500).map((c,i)=><tr key={i}><td style={td}>{c.contrato}</td><td style={{...td,color:C.muted}}>{c.cpf}</td><td style={td}>{(c.cliente||'').slice(0,26)}</td><td style={td}>{(c.data||'').slice(0,7)}</td><td style={{...td,fontWeight:700,color:C.danger}}>{cfMoney(c._r.vencido)}</td><td style={td}>{c._r.atraso||0}d</td><td style={{...td,color:C.muted}}>{(c.agente||'').slice(0,16)}</td></tr>)}</tbody></table></div>
          {inadSem.length>500&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>Mostrando 500 de {inadSem.length}. Exporte para ver todos.</div>}
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700}}>🏆 Operadores de cobrança — por valor recuperado</div>
            <button onClick={()=>cfExport(opsRank.map(o=>({operador:o.key,acordos:o.tot,pagos:o.pagos,conversao:+o.conv.toFixed(1),recuperado:+o.vlr.toFixed(2),comissao:+o.com.toFixed(2)})),'crefisa-operadores-cobranca')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:320,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['#','Operador','Acordos','Pagos','Conv.','Recuperado','Comissão'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{opsRank.slice(0,100).map((o,i)=><tr key={i}><td style={{...td,color:C.muted}}>{i+1}</td><td style={{...td,fontWeight:600}}>{(o.key||'').slice(0,32)}</td><td style={td}>{o.tot}</td><td style={{...td,color:C.accent2}}>{o.pagos}</td><td style={{...td,fontWeight:700,color:o.conv>=70?C.accent2:o.conv>=50?C.warn:C.danger}}>{o.conv.toFixed(0)}%</td><td style={{...td,fontWeight:600,color:C.accent2}}>{cfMoney(o.vlr)}</td><td style={{...td,color:C.accent}}>{cfMoney(o.com)}</td></tr>)}</tbody></table></div>
        </div>
      </div>})()}
      {sub==='valores'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{fontSize:12,fontWeight:700}}>💵 Safra dos contratos que constam</div>
        <div style={{fontSize:10,color:C.muted}}>Safra padrão = parcela R$ 159,00 × 12x. "Valor Projetado Safra" é o recebível projetado da planilha (não o valor do empréstimo).</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Stat label="Contratos na safra (constam)" value={R.constam.length}/>
          <Stat label="Valor Projetado Safra" value={cfMoney(R.projConstam)} color={C.accent2}/>
          <Stat label="Valor Vencido total" value={cfMoney(R.vencidoTot)} color={C.danger}/>
        </div>
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:12,fontWeight:700,color:C.warn}}>⚠️ Finalizados com safra fora do padrão — parcela ≠ R$159 ou prazo ≠ 12 ({R.anomalias.length})</div>
            <button onClick={()=>cfExport(R.anomalias.map(c=>({contrato:c.contrato,cpf:c.cpf,cliente:c.cliente,parcela:c.vr_parcela,prazo:c.prazo,valor:c.vr_bruto,situacao:c.situacao})),'crefisa-safra-anomalias')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
          </div>
          <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Contratos próprios cuja parcela ou prazo destoam do padrão de safra Baixa Renda — verificar.</div>
          {R.anomalias.length===0?<div style={{padding:24,textAlign:'center',color:C.accent2,fontSize:13}}>✓ Todos com parcela R$ 159,00 e prazo 12x.</div>:
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:420,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Cliente','Parcela','Prazo','Valor','Situação'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{R.anomalias.slice(0,500).map((c,i)=><tr key={i}><td style={td}>{c.contrato}</td><td style={{...td,color:C.muted}}>{c.cpf}</td><td style={td}>{(c.cliente||'').slice(0,24)}</td><td style={{...td,fontWeight:600,color:Math.abs((Number(c.vr_parcela)||0)-159)>0.5?C.danger:C.text}}>{cfMoney(c.vr_parcela)}</td><td style={{...td,fontWeight:600,color:String(c.prazo).trim()!=='12'?C.danger:C.text}}>{c.prazo||'—'}</td><td style={td}>{cfMoney(c.vr_bruto)}</td><td style={td}><Badge text={c.situacao||'—'} color={C.info}/></td></tr>)}</tbody></table></div>}
        </div>
      </div>}
    </>}
    {!R&&!loading&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:40,textAlign:'center',color:C.muted}}>
      <div style={{fontSize:13,marginBottom:6}}>Suba a planilha de <b>inadimplência (safra)</b> da Crefisa e clique em <b style={{color:C.accent}}>Confrontar carteira</b>. A de adimplência é opcional.</div>
      <div style={{fontSize:11}}>O sistema cruza por número de contrato (504720…) com os contratos FINALIZADOS da CREFISACP dos últimos 12 meses e mostra cobertura (o que falta a Crefisa reportar), taxa de inadimplência real e divergências de valor.</div>
    </div>}
  </div>
}

/* ═══ PARCEIRO COBRANÇA (funil: vendeu → efetivou → recebeu) ═══ */
const cfNum=v=>{if(v==null||v==='')return 0;if(typeof v==='number')return v;const t=String(v).replace(/[R$\s]/g,'');if(t.includes(','))return parseFloat(t.replace(/\./g,'').replace(',','.'))||0;return parseFloat(t)||0}
const cfCt=v=>cfDig(v).replace(/^0+/,'')  // contrato normalizado p/ cruzamento
const cfMes=v=>{if(typeof v==='number'&&v>45000&&v<47000)return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,7);const s=String(v||'').trim();return /^\d{4}-\d{2}/.test(s)?s.slice(0,7):null}
function cfParseVendas(wb){
  const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''})
  let hi=aoa.findIndex(r=>Array.isArray(r)&&r.some(c=>cfNorm(c)==='cpf')&&r.some(c=>cfNorm(c)==='contrato'))
  if(hi<0)return[]
  const H=aoa[hi].map(cfNorm)
  const ci={cpf:H.indexOf('cpf'),ct:H.indexOf('contrato'),vt:H.indexOf('valortotal'),tel:H.indexOf('telefone')}
  const rows=[]
  for(let r=hi+1;r<aoa.length;r++){const row=aoa[r];if(!Array.isArray(row))continue
    const ct=cfCt(row[ci.ct]);if(!ct)continue
    // data pode mudar de coluna (linhas de junho têm coluna extra) — procura na linha
    let mes=null;for(const cell of row){const m=cfMes(cell);if(m){mes=m;break}}
    rows.push({ct,cpf:cfCpf11(row[ci.cpf]),vt:cfNum(row[ci.vt]),tel:cfDig(row[ci.tel]),mes:mes||'?'})}
  return rows
}
function cfParseComissao(wb){
  const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''})
  let hi=aoa.findIndex(r=>Array.isArray(r)&&r.some(c=>{const n=cfNorm(c);return n.includes('numerocontrato')||n.includes('numcontrato')}))
  if(hi<0)return[]
  const H=aoa[hi].map(cfNorm)
  const find=(...names)=>{for(const n of names){const i=H.findIndex(h=>h.includes(n));if(i>=0)return i}return -1}
  const ci={ct:find('numerocontrato','numcontrato'),ac:find('numeroacordo','numacordo'),vp:find('valorpagocnab','vlrpagocnab'),vc:find('valorcomissao','vlrcalcomissao'),np:find('numparcreneg'),us:find('nomeusuarioacordo','nomeusuario'),login:find('loginusuario')}
  if(ci.us<0&&ci.login>=0)ci.us=ci.login+1  // no formato .ods o nome vem logo após o login
  const rows=[]
  for(let r=hi+1;r<aoa.length;r++){const row=aoa[r];if(!Array.isArray(row))continue
    const ct=cfCt(row[ci.ct]);if(!ct)continue
    rows.push({ct,ac:cfDig(row[ci.ac]),vp:cfNum(row[ci.vp]),vc:cfNum(row[ci.vc]),np:parseInt(cfDig(row[ci.np])||'1',10),us:String(row[ci.us]||'(sem)')})}
  return rows
}
function ParceiroCobranca(){
  const[vendas,setVendas]=useState(null),[acomp,setAcomp]=useState(null),[coms,setComs]=useState([])
  const[err,setErr]=useState(''),[fSt,setFSt]=useState('todos'),[fMes,setFMes]=useState(null)
  const[opsCred,setOpsCred]=useState(null)  // Map acordo -> {dt: data_nosso_credito, vp: valor pago} vindo do OPS (histórico importado)
  const vRef=useRef(),aRef=useRef(),cRef=useRef()
  useEffect(()=>{(async()=>{
    // Carrega do OPS os créditos de cobrança já importados (produto CREFISA CP - COBRANCA...) — chave: proposta = nº do acordo
    const PAGE=1000;let all=[],from=0
    while(true){
      const{data,error}=await supabase.from('digitacoes').select('proposta,vr_bruto,data_nosso_credito,data').ilike('produto','%cobran%').not('data_nosso_credito','is',null).range(from,from+PAGE-1)
      if(error||!data||!data.length)break
      all=all.concat(data);if(data.length<PAGE)break;from+=PAGE
    }
    const m=new Map()
    all.forEach(r=>{const k=cfDig(r.proposta);if(!k)return;const e=m.get(k);if(!e||String(r.data_nosso_credito)>String(e.dt))m.set(k,{dt:String(r.data_nosso_credito).slice(0,10),vp:Number(r.vr_bruto)||0})})
    setOpsCred(m)
  })()},[])
  const read=(file,parser,cb,tipo)=>{const rd=new FileReader();rd.onload=ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const rows=parser(wb);if(!rows.length){setErr('Não reconheci o formato de '+tipo+' ('+file.name+')');return}setErr('');cb({nome:file.name,rows})}catch(e){setErr('Erro lendo '+tipo+': '+e.message)}};rd.readAsArrayBuffer(file)}
  const R=useMemo(()=>{
    if(!vendas)return null
    const vCt=new Set(vendas.rows.map(v=>v.ct)),vCpf=new Set(vendas.rows.map(v=>v.cpf))
    const vTot=vendas.rows.reduce((s,v)=>s+v.vt,0)
    const porMes={};vendas.rows.forEach(v=>porMes[v.mes]=(porMes[v.mes]||0)+1)
    // efetivação
    let efet=[],efetPagos=[],semReg=0,vlrCliente=0
    if(acomp){
      efet=acomp.rows.filter(a=>vCt.has(a.ct)||vCpf.has(a.cpf))
      efetPagos=efet.filter(a=>a.st==='PAGO')
      vlrCliente=efetPagos.reduce((s,a)=>s+(a.vlrPago||0),0)
      const acCt=new Set(acomp.rows.map(a=>a.ct))
      semReg=[...vCt].filter(c=>!acCt.has(c)).length
    }
    // comissões
    const com=coms.flatMap(f=>f.rows.map(r=>({...r,arq:f.nome})))
    const comTot=com.reduce((s,c)=>s+c.vc,0)
    const comV=com.filter(c=>vCt.has(c.ct)),comO=com.filter(c=>!vCt.has(c.ct))
    const p2=com.filter(c=>c.np>1)
    const comCt=new Set(com.map(c=>c.ct))
    const pipeline=vendas.rows.filter(v=>!comCt.has(v.ct))
    const pipeCt=new Set(pipeline.map(p=>p.ct))
    const porArq=coms.map(f=>({nome:f.nome,n:f.rows.length,v:f.rows.reduce((s,r)=>s+r.vc,0)}))
    const porUs=new Map();com.forEach(c=>{const e=porUs.get(c.us)||{key:c.us,n:0,v:0};e.n++;e.v+=c.vc;porUs.set(c.us,e)})
    const usRank=[...porUs.values()].sort((a,b)=>b.v-a.v)
    // Status venda a venda + recorrência (precisa do acompanhamento)
    let stRows=[],nPago=0,nNaoPago=0,nNaoConsta=0,pagoComRecN=0,pagoComRecV=0,pagoSemRecN=0,recorrentes=[]
    if(acomp){
      const acSt=new Map()
      acomp.rows.forEach(a=>{const e=acSt.get(a.ct)||{st:'',cli:'',vp:0,acs:[]};e.cli=e.cli||a.cliente||'';if(a.st==='PAGO'){e.st='PAGO';e.vp+=(a.vlrPago||0)}else if(!e.st)e.st=a.st||'';if(a.acordo)e.acs.push(cfDig(a.acordo));acSt.set(a.ct,e)})
      const comCt=new Map()
      com.forEach(c=>{const e=comCt.get(c.ct)||{n:0,v:0,maxNp:0};e.n++;e.v+=c.vc;e.maxNp=Math.max(e.maxNp,c.np);comCt.set(c.ct,e)})
      const seen=new Set()
      vendas.rows.forEach(v=>{if(seen.has(v.ct))return;seen.add(v.ct)
        const a=acSt.get(v.ct),c=comCt.get(v.ct)
        const st=a?(a.st||'—'):'NÃO CONSTA'
        if(!a)nNaoConsta++;else if(a.st==='PAGO')nPago++;else nNaoPago++
        if(a&&a.st==='PAGO'){if(c){pagoComRecN++;pagoComRecV+=c.v;if(c.n>=2||c.maxNp>=2)recorrentes.push({ct:v.ct,cli:a.cli,cpf:v.cpf,tel:v.tel,parc:c.n,maxNp:c.maxNp,rec:c.v,mes:v.mes})}else pagoSemRecN++}
        // Cruza com OPS: algum acordo deste contrato já teve NOSSO CRÉDITO?
        let opsN=0,opsV=0,opsDt=''
        if(opsCred&&a)a.acs.forEach(ac=>{const o=opsCred.get(ac);if(o){opsN++;opsV+=o.vp;if(o.dt>opsDt)opsDt=o.dt}})
        stRows.push({ct:v.ct,cpf:v.cpf,cli:a?a.cli:'',vt:v.vt,st,cliPagou:a?a.vp:0,recN:c?c.n:0,recV:c?c.v:0,maxNp:c?c.maxNp:0,opsN,opsV,opsDt,mes:v.mes||'?'})})
      recorrentes.sort((a,b)=>b.rec-a.rec)
    }
    // 4 categorias do funil por contrato vendido — "recebemos" = comissão na apuração OU crédito no OPS:
    // 💰 recebemos · ⏳ ainda não recebemos (cliente pagou, sem crédito) · ❌ cliente não pagou · 🔁 recorrência (2+ parcelas/créditos)
    const recebeu=r=>r.recN>0||r.opsN>0
    const isRecorr=r=>recebeu(r)&&(r.recN>=2||r.maxNp>=2||r.opsN>=2)
    const bucketOf=r=>recebeu(r)?'REC':(r.st==='PAGO'?'PEND':'NAOPAGOU')
    const bkRec=stRows.filter(recebeu)
    const bkPendN=stRows.filter(r=>bucketOf(r)==='PEND').length
    const bkNaoPagouN=stRows.filter(r=>bucketOf(r)==='NAOPAGOU').length
    const bkRecorr=stRows.filter(isRecorr)
    const bkOpsOnlyN=stRows.filter(r=>r.opsN>0&&r.recN===0).length  // crédito no OPS sem apuração carregada (meses antigos)
    // Recebimento por MÊS DE VENDA nas mesmas 4 categorias
    const mesesVenda=(()=>{const m=new Map()
      stRows.forEach(r=>{const e=m.get(r.mes)||{mes:r.mes,vendidos:0,recebeu:0,recV:0,pagoSemCom:0,naoPagou:0,recorr:0}
        e.vendidos++
        if(recebeu(r)){e.recebeu++;e.recV+=r.recV;if(isRecorr(r))e.recorr++}
        else if(r.st==='PAGO')e.pagoSemCom++
        else e.naoPagou++
        m.set(r.mes,e)})
      return[...m.values()].sort((a,b)=>a.mes.localeCompare(b.mes))})()
    return{vCt,vTot,porMes,efet,efetPagos,semReg,vlrCliente,com,comTot,comV,comO,p2,pipeline:[...pipeCt],pipelineN:pipeCt.size,porArq,usRank,
      stRows,mesesVenda,isRecorr,bucketOf,recebeu,bkRecN:bkRec.length,bkRecV:bkRec.reduce((s,r)=>s+r.recV,0),bkPendN,bkNaoPagouN,bkRecorrN:bkRecorr.length,bkRecorrV:bkRecorr.reduce((s,r)=>s+r.recV,0),bkOpsOnlyN,
      nPago,nNaoPago,nNaoConsta,pagoComRecN,pagoComRecV,pagoSemRecN,recorrentes,
      comVTot:comV.reduce((s,c)=>s+c.vc,0),comOTot:comO.reduce((s,c)=>s+c.vc,0),p2Tot:p2.reduce((s,c)=>s+c.vc,0)}
  },[vendas,acomp,coms,opsCred])
  const Box=({label,state,onPick,inputRef,color,multi})=>(
    <div style={{flex:1,minWidth:190,background:C.card,border:'1px dashed '+(state&&(!multi||state.length)?color:C.border),borderRadius:12,padding:12}}>
      <div style={{fontSize:11,fontWeight:700,color:(state&&(!multi||state.length))?color:C.muted,marginBottom:5}}>{label}</div>
      {multi?(state.length?state.map((f,i)=><div key={i} style={{fontSize:10,color:C.text}}>✓ {f.nome} ({f.rows.length})</div>):<div style={{fontSize:10,color:C.muted}}>Nenhum arquivo</div>)
        :(state?<div style={{fontSize:10,color:C.text}}>✓ {state.nome}<div style={{color:C.muted}}>{state.rows.length} linhas</div></div>:<div style={{fontSize:10,color:C.muted}}>Nenhum arquivo</div>)}
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.ods,.csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)onPick(f);e.target.value=''}}/>
      <div style={{display:'flex',gap:6,marginTop:7}}>
        <button onClick={()=>inputRef.current?.click()} style={{padding:'5px 10px',borderRadius:7,border:'1px solid '+C.border,background:C.surface,color:C.text,fontSize:10,cursor:'pointer'}}>📂 {multi?'Adicionar':'Selecionar'}</button>
        {multi&&state.length>0&&<button onClick={()=>setComs([])} style={{padding:'5px 10px',borderRadius:7,border:'1px solid '+C.border,background:C.surface,color:C.danger,fontSize:10,cursor:'pointer'}}>✕ Limpar</button>}
      </div>
    </div>
  )
  const th={padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}
  const td={padding:'7px 10px',fontSize:11,borderBottom:'1px solid '+C.border}
  const pct=(a,b)=>b>0?(a/b*100).toFixed(1)+'%':'—'
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div><h2 style={{fontWeight:800,fontSize:20,margin:0}}>🤝 Parceiro Cobrança</h2><div style={{fontSize:11,color:C.muted,marginTop:2}}>Funil do parceiro de cobrança Crefisa: vendeu → efetivou → recebemos · cruzado por nº de contrato</div></div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <Box label="1️⃣ Vendas do parceiro" state={vendas} onPick={f=>read(f,cfParseVendas,setVendas,'vendas')} inputRef={vRef} color={C.accent}/>
      <Box label="2️⃣ Acompanhamento (RelAcordosCrefisa)" state={acomp} onPick={f=>read(f,w=>cfParseAcordos(w).map(r=>({...r,ct:cfCt(r.contrato||''),st:r.status})),setAcomp,'acompanhamento')} inputRef={aRef} color={C.info}/>
      <Box label="3️⃣ Apurações de comissão (pode somar vários meses)" state={coms} onPick={f=>read(f,cfParseComissao,x=>setComs(p=>[...p,x]),'comissão')} inputRef={cRef} color={C.accent2} multi/>
    </div>
    <div style={{fontSize:10,color:opsCred?C.accent2:C.muted}}>{opsCred?'🏦 Histórico do OPS carregado automaticamente: '+opsCred.size+' acordos com NOSSO CRÉDITO (recebimento em conta) — cobre os meses sem apuração.':'🏦 Carregando histórico de créditos do OPS...'}</div>
    {err&&<div style={{background:'#EF444418',color:C.danger,padding:'10px 14px',borderRadius:8,fontSize:12}}>{err}</div>}
    {!R&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:36,textAlign:'center',color:C.muted,fontSize:12}}>Suba pelo menos a planilha de <b>vendas do parceiro</b>. Acompanhamento e apurações completam o funil.</div>}
    {R&&<>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label="Vendeu" value={vendas.rows.length} sub={cfMoney(R.vTot)+' · '+Object.entries(R.porMes).sort().map(([m,n])=>m+': '+n).join(' · ')}/>
        <Stat label="💰 Vendeu e recebemos" value={acomp?R.bkRecN:'—'} sub={acomp?(cfMoney(R.bkRecV)+' comissão'+(R.bkOpsOnlyN?' · '+R.bkOpsOnlyN+' via OPS (sem apuração)':'')):'suba o acompanhamento'} color={C.accent2}/>
        <Stat label="⏳ Vendeu e ainda não recebemos" value={(acomp&&coms.length)?R.bkPendN:'—'} sub="cliente pagou · comissão a caminho" color={C.warn}/>
        <Stat label="❌ Vendeu e cliente não pagou" value={acomp?R.bkNaoPagouN:'—'} sub={acomp?pct(R.bkNaoPagouN,R.stRows.length)+' das vendas':''} color={C.danger}/>
        <Stat label="🔁 Recorrência de trás" value={(acomp&&coms.length)?R.bkRecorrN:'—'} sub={(acomp&&coms.length)?cfMoney(R.bkRecorrV)+' · pagando 2ª+ parcela':''} color={C.accent}/>
        <Stat label="Recebido total (geral)" value={coms.length?cfMoney(R.comTot):'—'} sub={coms.length?'inclui fora das vendas deste parceiro':'suba as apurações'}/>
      </div>
      {coms.length>0&&<div style={{background:C.abg,border:'1px solid '+C.accent+'44',borderRadius:12,padding:'12px 16px',fontSize:12,lineHeight:1.7}}>
        <b>📌 Leitura rápida:</b> o parceiro vendeu <b>{vendas.rows.length}</b> acordos ({cfMoney(R.vTot)}).
        {acomp?<> Efetivação: <b style={{color:C.accent2}}>{pct(R.efetPagos.length,R.efet.length)}</b> pagos, cliente pagou <b>{cfMoney(R.vlrCliente)}</b>.</>:null}
        {' '}Recebemos <b>{cfMoney(R.comTot)}</b> de comissão — <b style={{color:C.accent2}}>{cfMoney(R.comVTot)}</b> das vendas dele e <b style={{color:C.warn}}>{cfMoney(R.comOTot)}</b> de fora (inclui {cfMoney(R.p2Tot)} de cauda de acordos antigos).
        {acomp?<> Dos <b style={{color:C.accent2}}>{R.nPago}</b> pagos: <b>{R.pagoComRecN}</b> já geraram comissão ({cfMoney(R.pagoComRecV)}) e <b style={{color:C.warn}}>{R.pagoSemRecN}</b> pagaram mas a comissão ainda não veio.</>:null}
        {' '}<b style={{color:C.accent}}>{R.pipelineN}</b> contratos vendidos ainda não geraram comissão — pipeline das próximas apurações.
      </div>}
      {acomp&&coms.length>0&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:700}}>📆 Recebimento por mês de venda {fMes&&<button onClick={()=>setFMes(null)} style={{marginLeft:8,fontSize:9,padding:'2px 8px',borderRadius:5,border:'1px solid '+C.border,background:C.surface,color:C.muted,cursor:'pointer'}}>✕ limpar filtro {fMes}</button>}</div>
          <button onClick={()=>cfExport(R.mesesVenda.map(m=>({mes_venda:m.mes,vendidos:m.vendidos,vendeu_e_recebemos:m.recebeu,comissao_recebida:+m.recV.toFixed(2),ainda_nao_recebemos:m.pagoSemCom,cliente_nao_pagou:m.naoPagou,recorrencia:m.recorr})),'parceiro-recebimento-por-mes')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
        </div>
        <div style={{fontSize:10,color:C.muted,marginBottom:6}}>👆 Clique num mês para filtrar a lista de baixo. "Ainda não recebemos" = cliente pagou o acordo mas a comissão não veio na apuração (cobrar Crefisa / aguardar próxima).</div>
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface}}>{['Mês da venda','Vendidos','💰 Recebemos','R$ recebido','⏳ Ainda não recebemos','❌ Cliente não pagou','🔁 Recorrência','% recebido'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>
          {R.mesesVenda.map((m,i)=>{const sel=fMes===m.mes;const pctR=m.vendidos?(m.recebeu/m.vendidos*100):0;return<tr key={i} onClick={()=>setFMes(sel?null:m.mes)} style={{cursor:'pointer',background:sel?C.abg:'transparent',outline:sel?'1px solid '+C.accent:'none'}}><td style={{padding:'7px 10px',fontSize:11,fontWeight:700,color:sel?C.accent:C.text,borderBottom:'1px solid '+C.border}}>{sel?'▶ ':''}{m.mes}</td><td style={{padding:'7px 10px',fontSize:11,borderBottom:'1px solid '+C.border}}>{m.vendidos}</td><td style={{padding:'7px 10px',fontSize:11,fontWeight:600,color:C.accent2,borderBottom:'1px solid '+C.border}}>{m.recebeu}</td><td style={{padding:'7px 10px',fontSize:11,fontWeight:700,color:C.accent2,borderBottom:'1px solid '+C.border}}>{cfMoney(m.recV)}</td><td style={{padding:'7px 10px',fontSize:11,fontWeight:600,color:C.warn,borderBottom:'1px solid '+C.border}}>{m.pagoSemCom}</td><td style={{padding:'7px 10px',fontSize:11,color:C.danger,borderBottom:'1px solid '+C.border}}>{m.naoPagou}</td><td style={{padding:'7px 10px',fontSize:11,fontWeight:600,color:C.accent,borderBottom:'1px solid '+C.border}}>{m.recorr}</td><td style={{padding:'7px 10px',fontSize:11,fontWeight:700,color:pctR>=50?C.accent2:pctR>=25?C.warn:C.danger,borderBottom:'1px solid '+C.border}}>{pctR.toFixed(0)}%</td></tr>})}
        </tbody></table></div>
      </div>}
      {acomp&&(()=>{const baseRows=fMes?R.stRows.filter(r=>r.mes===fMes):R.stRows
        const cRec=baseRows.filter(r=>r.recN>0).length
        const cPend=baseRows.filter(r=>R.bucketOf(r)==='PEND').length
        const cNaoPagou=baseRows.filter(r=>R.bucketOf(r)==='NAOPAGOU').length
        const cRecorr=baseRows.filter(R.isRecorr).length
        return<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,flexWrap:'wrap',gap:6}}>
          <div style={{fontSize:12,fontWeight:700}}>🔎 Venda a venda{fMes?' — vendas de '+fMes:''} ({baseRows.length} contratos)</div>
          <button onClick={()=>cfExport(baseRows.map(r=>({contrato:r.ct,cpf:r.cpf,cliente:r.cli,mes_venda:r.mes,valor_acordo:r.vt,categoria:R.recebeu(r)?(R.isRecorr(r)?'RECEBEMOS + RECORRÊNCIA':'RECEBEMOS'):(r.st==='PAGO'?'AINDA NÃO RECEBEMOS':'CLIENTE NÃO PAGOU'),status_acordo:r.st,cliente_pagou:+(r.cliPagou||0).toFixed(2),parcelas_comissao:r.recN,comissao_recebida:+(r.recV||0).toFixed(2),nosso_credito_data:r.opsDt||'',nosso_credito_valor:+(r.opsV||0).toFixed(2)})),'parceiro-status-vendas'+(fMes?'-'+fMes:''))} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
          {[{id:'todos',l:'Todos ('+baseRows.length+')'},{id:'RECEBEU',l:'💰 Vendeu e recebemos ('+cRec+')'},{id:'PEND',l:'⏳ Ainda não recebemos ('+cPend+')'},{id:'NAOPAGOU',l:'❌ Cliente não pagou ('+cNaoPagou+')'},{id:'RECORR',l:'🔁 Recorrência ('+cRecorr+')'}].map(t=>
            <button key={t.id} onClick={()=>setFSt(t.id)} style={{padding:'5px 12px',borderRadius:7,border:'1px solid '+(fSt===t.id?C.accent:C.border),background:fSt===t.id?C.abg:'transparent',color:fSt===t.id?C.accent:C.muted,fontSize:10,cursor:'pointer',fontWeight:fSt===t.id?600:400}}>{t.l}</button>)}
        </div>
        {(()=>{const fr=baseRows.filter(r=>fSt==='todos'?true:fSt==='RECEBEU'?r.recN>0:fSt==='PEND'?R.bucketOf(r)==='PEND':fSt==='NAOPAGOU'?R.bucketOf(r)==='NAOPAGOU':fSt==='RECORR'?R.isRecorr(r):true)
        return<><div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:380,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Contrato','CPF','Cliente','Vlr acordo','Status','Cliente pagou','Parc. com.','Comissão','🏦 Nosso crédito'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {fr.slice(0,500).map((r,i)=><tr key={i}><td style={td}>{r.ct}</td><td style={{...td,color:C.muted}}>{r.cpf}</td><td style={td}>{(r.cli||'—').slice(0,26)}</td><td style={td}>{cfMoney(r.vt)}</td><td style={td}><Badge text={r.st} color={r.st==='PAGO'?C.accent2:r.st==='NÃO CONSTA'?C.muted:C.danger}/></td><td style={{...td,color:C.accent2}}>{r.cliPagou?cfMoney(r.cliPagou):'—'}</td><td style={{...td,textAlign:'center'}}>{r.recN||'—'}</td><td style={{...td,fontWeight:600,color:r.recV?C.accent:C.muted}}>{r.recV?cfMoney(r.recV):'—'}</td><td style={{...td,fontSize:10,color:r.opsN?C.accent2:C.muted,whiteSpace:'nowrap'}}>{r.opsN?fmtDate(r.opsDt)+' · '+cfMoney(r.opsV):'—'}</td></tr>)}
        </tbody></table></div>
        {fr.length>500&&<div style={{fontSize:10,color:C.muted,marginTop:4}}>Mostrando 500 de {fr.length}. Exporte para ver todos.</div>}</>})()}
      </div>})()}
      {acomp&&coms.length>0&&(()=>{const recs=fMes?R.recorrentes.filter(r=>r.mes===fMes):R.recorrentes
        return<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:700,color:C.accent2}}>🔁 Clientes de recorrência — pagos com 2+ parcelas de comissão{fMes?' · vendas de '+fMes:''} ({recs.length})</div>
          <button onClick={()=>cfExport(recs.map(r=>({contrato:r.ct,cliente:r.cli,cpf:r.cpf,telefone:r.tel,mes_venda:r.mes,parcelas_comissao:r.parc,max_parcela_reneg:r.maxNp,comissao_recebida:+r.rec.toFixed(2)})),'parceiro-clientes-recorrencia'+(fMes?'-'+fMes:''))} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.accent2,background:C.accent2+'15',color:C.accent2,fontWeight:600,cursor:'pointer'}}>⬇ Exportar recorrentes</button>
        </div>
        <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Clientes que pagaram o acordo e continuam pagando parcelas — a receita recorrente da carteira. Comissão total deles: <b style={{color:C.accent2}}>{cfMoney(recs.reduce((s,r)=>s+r.rec,0))}</b></div>
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:340,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Cliente','CPF','Telefone','Mês venda','Parc. com.','Máx. parc. reneg','Recebido'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {recs.slice(0,300).map((r,i)=><tr key={i}><td style={{...td,fontWeight:600}}>{(r.cli||'—').slice(0,30)}</td><td style={{...td,color:C.muted}}>{r.cpf}</td><td style={{...td,color:C.muted}}>{r.tel||'—'}</td><td style={{...td,color:C.muted}}>{r.mes||'—'}</td><td style={{...td,textAlign:'center'}}>{r.parc}</td><td style={{...td,textAlign:'center'}}>{r.maxNp}</td><td style={{...td,fontWeight:700,color:C.accent2}}>{cfMoney(r.rec)}</td></tr>)}
        </tbody></table></div>
      </div>})()}
      {coms.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Comissão por apuração</div>
          <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface}}>{['Arquivo','Linhas','Comissão'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {R.porArq.map((f,i)=><tr key={i}><td style={td}>{f.nome.slice(0,34)}</td><td style={td}>{f.n}</td><td style={{...td,fontWeight:600,color:C.accent2}}>{cfMoney(f.v)}</td></tr>)}
          </tbody></table>
        </div>
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>Comissão por operador</div>
          <div style={{maxHeight:200,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface}}>{['Operador','Linhas','Comissão'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {R.usRank.slice(0,15).map((u,i)=><tr key={i}><td style={td}>{(u.key||'').slice(0,28)}</td><td style={td}>{u.n}</td><td style={{...td,fontWeight:600,color:C.accent2}}>{cfMoney(u.v)}</td></tr>)}
          </tbody></table></div>
        </div>
      </div>}
      {coms.length>0&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:700,color:C.accent}}>⏳ Pipeline — contratos vendidos que ainda não geraram comissão ({R.pipelineN})</div>
          <button onClick={()=>cfExport(vendas.rows.filter(v=>R.pipeline.includes(v.ct)).map(v=>({contrato:v.ct,cpf:v.cpf,telefone:v.tel,valor_acordo:v.vt,mes_venda:v.mes})),'parceiro-pipeline-sem-comissao')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
        </div>
        <div style={{fontSize:10,color:C.muted}}>É o dinheiro que ainda vem: acordos vendidos cujas parcelas ainda não apareceram em nenhuma apuração carregada.</div>
      </div>}
    </>}
  </div>
}

/* ═══ ESTEIRA COMPRA (NeoCrédito RECOMPRA) ═══ */
const NC_FASES=[
  {id:'pend',l:'📌 Pendência',color:'#F59E0B',sits:['PENDENCIA','PENDENTE']},
  {id:'banco',l:'🏦 Em andamento',color:'#0EA5E9',sits:['ANDAMENTO','ANALISE BANCO']},
  {id:'int',l:'✅ Integrado / Averbado',color:'#10B981',sits:['INTEGRADO','INTEGRADA','CONCRETIZADO']},
  {id:'reprov',l:'❌ Reprovado / Cancelado',color:'#EF4444',sits:['REPROVADO','REPROVADA','CANCELADA','PROPOSTA REPROVADA']},
]
function ncFase(r){
  const s=(r.situacao||'').toUpperCase()
  for(const f of NC_FASES)if(f.sits.includes(s))return f.id
  return 'pend'
}
function cfParseComissaoNeo(wb){
  const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''})
  let hi=aoa.findIndex(r=>Array.isArray(r)&&r.some(c=>cfNorm(c)==='proposta')&&r.some(c=>cfNorm(c)==='usuario'))
  if(hi<0)return[]
  const H=aoa[hi].map(cfNorm)
  const find=(...ns)=>{for(const n of ns){const i=H.findIndex(h=>h===n||h.includes(n));if(i>=0)return i}return -1}
  const ci={us:find('usuario'),prop:find('proposta'),cpf:find('cpf'),nome:find('nome'),cms:find('liquido','cmsr','cms'),vb:find('valorbruto'),tipo:find('tipo')}
  const rows=[]
  for(let r=hi+1;r<aoa.length;r++){const row=aoa[r];if(!Array.isArray(row))continue
    const prop=cfDig(row[ci.prop]);if(!prop)continue
    rows.push({prop,usuario:String(row[ci.us]||'(sem)').trim(),cpf:cfCpf11(row[ci.cpf]),nome:String(row[ci.nome]||''),cms:cfNum(row[ci.cms]),vb:ci.vb>=0?cfNum(row[ci.vb]):0,tipo:String(row[ci.tipo]||'')})}
  return rows
}
const WB_HDR=["NUM_BANCO","NOM_BANCO","NUM_PROPOSTA","NUM_CONTRATO","DSC_TIPO_PROPOSTA_EMPRESTIMO","COD_PRODUTO","DSC_PRODUTO","DAT_CTR_INCLUSAO","DSC_SITUACAO_EMPRESTIMO","DAT_EMPRESTIMO","COD_EMPREGADOR","DSC_CONVENIO","COD_ORGAO","NOM_ORGAO","COD_PRODUTOR_VENDA","NOM_PRODUTOR_VENDA","NIC_CTR_USUARIO","COD_CPF_CLIENTE","NOM_CLIENTE","DAT_NASCIMENTO","NUM_IDENTIDADE","NOM_LOGRADOURO","NUM_PREDIO","DSC_CMPLMNT_ENDRC","NOM_BAIRRO","NOM_LOCALIDADE","SIG_UNIDADE_FEDERACAO","COD_ENDRCMNT_PSTL","NUM_TELEFONE","NUM_TELEFONE_CELULAR","NOM_MAE","NOM_PAI","NUM_BENEFICIO","QTD_PARCELA","VAL_PRESTACAO","VAL_BRUTO","VAL_SALDO_RECOMPRA","VAL_SALDO_REFINANCIAMENTO","VAL_LIQUIDO","PCR_PMT_PAGO_REF","DAT_CREDITO","DAT_CONFIRMACAO","VAL_REPASSE","PCL_COMISSAO","VAL_COMISSAO","COD_UNIDADE_EMPRESA","COD_SITUACAO_EMPRESTIMO","DAT_ESTORNO","DSC_OBSERVACAO","NUM_CPF_AGENTE","NUM_OBJETO_ECT","PCL_TAXA_EMPRESTIMO","DSC_TIPO_FORMULARIO_EMPRESTIMO","DSC_TIPO_CREDITO_EMPRESTIMO","NOM_GRUPO_UNIDADE_EMPRESA","COD_PROPOSTA_EMPRESTIMO","COD_GRUPO_UNIDADE_EMPRESA","COD_TIPO_FUNCAO","COD_TIPO_PROPOSTA_EMPRESTIMO","COD_LOJA_DIGITACAO","VAL_SEGURO"]
// Fontes de esteira integradas — novas esteiras entram aqui (num = código do banco no WorkBank)
const WB_FONTES=[{id:'NEOCREDITO',l:'NeoCrédito (Konsig)',num:410},{id:'CREFISA',l:'Crefisa (Baixa Renda)',num:789,nom:'CREFISACP'}]
function WorkBankExport(){
  const th={padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}
  const td={padding:'7px 10px',fontSize:11,borderBottom:'1px solid '+C.border}
  const[fonte,setFonte]=useState('NEOCREDITO')
  const[rows,setRows]=useState(null),[wbd,setWbd]=useState(new Map()),[loading,setLoading]=useState(true),[err,setErr]=useState('')
  const[de,setDe]=useState(''),[ate,setAte]=useState('')
  const[sit,setSit]=useState('todas'),[parc,setParc]=useState(''),[soNovas,setSoNovas]=useState(true),[msg,setMsg]=useState('')
  async function carregar(){
    setLoading(true);setErr('')
    try{
    if(fonte==='CREFISA'){
      const{data:cf,error:ec}=await supabase.from('crefisa_esteira').select('*').limit(5000)
      if(ec)throw ec
      setWbd(new Map((cf||[]).map(x=>[String(x.contrato_id),{
        proposta:String(x.contrato_id),prazo:x.prazo,tabela_nome:x.tabela,exportado_em:x.exportado_em}])))
      setRows((cf||[]).map(r=>({
        proposta:String(r.contrato||r.contrato_id),chave:String(r.contrato_id),
        cpf:r.cpf,cliente:r.cliente,esteira:'crefisa',
        data:r.data_digitacao||'',datahoras:r.data_sub_status,
        situacao:/FINALIZADO|APROVADA/i.test(r.sub_status||'')?'INT':(/CANCELADA|REJEITADO/i.test(r.sub_status||'')?'REP':'AND'),
        situacao_banco:r.sub_status||r.sit_banco||'',
        vr_bruto:Number(r.vr_bruto)||0,vr_parcela:Number(r.vr_parcela)||0,vr_liquido:Number(r.vr_liquido)||0,
        operacao:r.tipo_contrato||'',convenio:r.convenio||'',usuario:r.vendedor||'',
        parceiro:r.parceiro||'',prazo:r.prazo,tabela:r.tabela,login:r.login_sub_usuario||'',sit_pagto:r.sit_pagamento||'',sit_banco_cru:r.sit_banco||'',
        data_nosso_credito:r.data_pagamento||null
      })))
      setLoading(false);return
    }
      const{data:est,error:e1}=await supabase.from('konsig_esteira').select('proposta,cpf,nome,situacao,status,valorbruto,valorparcela,valorliquido,datahorac,datahoras,tipooperacao_nome,convenio_nome,usuario_nome,esteira').limit(5000)
      if(e1)throw e1
      const{data:dig}=await supabase.from('digitacoes').select('proposta,agente').eq('banco','NEOCREDITO').limit(5000)
      const dm=new Map();(dig||[]).forEach(x=>{if(x.proposta)dm.set(String(x.proposta).replace(/\D/g,''),(x.agente||'').trim())})
      const{data:w}=await supabase.from('workbank_dados').select('*')
      setWbd(new Map((w||[]).map(x=>[String(x.proposta),x])))
      setRows((est||[]).map(r=>({
        proposta:String(r.proposta),cpf:r.cpf,cliente:r.nome,esteira:r.esteira,
        data:(String(r.datahorac||'')).slice(0,10),datahoras:r.datahoras,
        situacao:String(r.situacao||'').toUpperCase(),
        situacao_banco:((r.situacao||'')+' - '+(r.status||'')).trim(),
        vr_bruto:Number(r.valorbruto)||0,vr_parcela:Number(r.valorparcela)||0,vr_liquido:Number(r.valorliquido)||0,
        operacao:r.tipooperacao_nome||'',convenio:r.convenio_nome||'',usuario:r.usuario_nome||'',
        parceiro:dm.get(String(r.proposta).replace(/\D/g,''))||'',
        data_nosso_credito:(String(r.situacao||'').toUpperCase()==='INT')?(String(r.datahoras||'')).slice(0,10):null
      })))
    }catch(e){setErr('Erro ao carregar: '+(e.message||e))}
    setLoading(false)
  }
  useEffect(()=>{carregar()},[fonte])
  if(loading)return<div style={{padding:40,textAlign:'center',color:C.muted}}>Carregando esteira...</div>
  if(err)return<div style={{padding:20,color:C.danger}}>{err}</div>
  const g=(rows||[]).filter(r=>{
    if(de&&r.data<de)return false
    if(ate&&r.data>ate)return false
    if(sit==='aberto'&&!(r.situacao==='PEN'||r.situacao==='AND'))return false
    if(['PEN','AND','INT','REP'].includes(sit)&&r.situacao!==sit)return false
    if(parc&&r.parceiro!==parc)return false
    if(soNovas&&wbd.get(r.proposta)?.exportado_em)return false
    return true
  }).sort((a,b)=>String(b.data).localeCompare(String(a.data)))
  const gv=g.reduce((t,r)=>t+r.vr_bruto,0)
  const completas=fonte==='CREFISA'?g.filter(r=>r.proposta&&r.prazo).length:g.filter(r=>wbd.get(r.proposta)?.tabela_nome).length
  const jaExp=(rows||[]).filter(r=>wbd.get(r.proposta)?.exportado_em).length
  const parcs={};(rows||[]).forEach(r=>{if(r.parceiro)parcs[r.parceiro]=(parcs[r.parceiro]||0)+1})
  async function gerar(){
    if(!g.length)return
    const cpfF=c=>{const x=String(c||'').replace(/\D/g,'').padStart(11,'0');return x.slice(0,3)+'.'+x.slice(3,6)+'.'+x.slice(6,9)+'-'+x.slice(9)}
    const D=v=>{if(!v)return null;const d=new Date(String(v).length<=10?v+'T12:00:00':v);return isNaN(d)?null:d}
    const hoje=new Date();hoje.setHours(12,0,0,0)
    const fnt=WB_FONTES.find(f=>f.id===fonte)||WB_FONTES[0]
    const linhas=g.map(r=>{
      const w=wbd.get(r.chave||r.proposta)||{}
      const tipo=fonte==='CREFISA'?(/REFIN/i.test(r.operacao||'')?'REFINANCIAMENTO':'NOVO'):(/COMPRA/i.test(r.operacao||'')?'RECOMPRA':'CARTÃO')
      const o={};WB_HDR.forEach(h=>o[h]=null)
      o.NUM_BANCO=fnt.num;o.NOM_BANCO=fnt.nom||fnt.id
      o.NUM_PROPOSTA=r.proposta;o.NUM_CONTRATO=r.proposta
      o.DSC_TIPO_PROPOSTA_EMPRESTIMO=tipo
      o.DSC_PRODUTO=fonte==='CREFISA'?((r.convenio||'')+'-'+(r.tabela||'')):((w.tabela_nome||r.tabela)?((r.convenio||'')+'-'+(w.tabela_nome||r.tabela)+'-'+tipo):null)
      o.DAT_CTR_INCLUSAO=hoje
      o.DSC_SITUACAO_EMPRESTIMO=fonte==='CREFISA'?(/PAGO AO CLIENTE/i.test(r.sit_pagto||'')?'PAGO':(r.sit_banco_cru||'EM ANALISE')):(r.situacao_banco||'')
      o.DAT_EMPRESTIMO=D(r.data);o.NIC_CTR_USUARIO=fonte==='CREFISA'?(r.login||r.parceiro||''):(r.parceiro||'')
      o.COD_CPF_CLIENTE=fonte==='CREFISA'?Number(String(r.cpf||'').replace(/\D/g,''))||null:cpfF(r.cpf)
      o.NOM_CLIENTE=r.cliente||''
      o.DAT_NASCIMENTO=fonte==='CREFISA'?D('1990-01-01'):D(w.nascimento)   // Crefisa: o relatório não traz nascimento; o Work aceita o placeholder
      o.QTD_PARCELA=(w.prazo||r.prazo)?Number(w.prazo||r.prazo):null
      o.VAL_PRESTACAO=r.vr_parcela||null;o.VAL_BRUTO=r.vr_bruto||null;o.VAL_LIQUIDO=r.vr_liquido||null
      o.DAT_CREDITO=D(w.dat_credito||r.data_nosso_credito)
      o.DSC_TIPO_FORMULARIO_EMPRESTIMO='DIGITAL'
      return WB_HDR.map(h=>o[h])
    })
    const ws=XLSX.utils.aoa_to_sheet([WB_HDR,...linhas],{cellDates:true})
    const bk=XLSX.utils.book_new();XLSX.utils.book_append_sheet(bk,ws,'Planilha1')
    XLSX.writeFile(bk,'Arquivo Padrao WORKBANK.xlsx',{cellDates:true})
    const inc=g.length-completas
    // marca como exportadas (pra não duplicar na importação do Work)
    try{
      const agora=new Date().toISOString()
      const tab=fonte==='CREFISA'?'crefisa_esteira':'workbank_dados'
      const ups=g.map(r=>fonte==='CREFISA'?{contrato_id:r.chave,exportado_em:agora}:{proposta:r.proposta,exportado_em:agora})
      for(let i=0;i<ups.length;i+=200){
        const{error}=await supabase.from(tab).upsert(ups.slice(i,i+200),{onConflict:fonte==='CREFISA'?'contrato_id':'proposta'})
        if(error)throw error
      }
      setMsg('✓ '+g.length+' propostas no arquivo'+(inc?(' · ⚠️ '+inc+' sem dados completos (o robô preenche aos poucos)'):'')+' · marcadas como exportadas')
      carregar()
    }catch(e){setMsg('✓ arquivo gerado, mas não consegui marcar como exportadas: '+(e.message||e)+' — rode: ALTER TABLE workbank_dados ADD COLUMN exportado_em timestamptz;')}
  }
  const chip=(id,l)=><button key={id} onClick={()=>setSit(id)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(sit===id?C.accent:C.border),background:sit===id?C.abg:'transparent',color:sit===id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:sit===id?700:400}}>{l}</button>
  return<div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div>
        <div style={{fontSize:16,fontWeight:800}}>📤 WorkBank — central de exportação</div>
        <div style={{fontSize:11,color:C.muted}}>Gera o "Arquivo Padrao WORKBANK" (61 colunas) pra importar no Work · marca o que já saiu pra não duplicar</div>
      </div>
      <button onClick={carregar} style={{fontSize:11,padding:'7px 14px',borderRadius:8,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>🔄 Atualizar</button>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Na esteira" value={(rows||[]).length} sub="propostas sincronizadas"/>
      <Stat label="No filtro atual" value={g.length} sub={cfMoney(gv)} color={C.accent}/>
      <Stat label="Prontas pra exportar" value={completas} sub="com nascimento/parcelas/produto" color={C.accent2}/>
      <Stat label="Já exportadas" value={jaExp} sub="marcadas em rodadas anteriores" color={C.muted}/>
    </div>
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <select value={fonte} onChange={e=>setFonte(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'7px 10px',fontSize:11,outline:'none'}}>
          {WB_FONTES.map(f=><option key={f.id} value={f.id}>{f.l}</option>)}
        </select>
        <span style={{fontSize:11,color:C.muted}}>digitadas de</span>
        <input type="date" value={de} onChange={e=>setDe(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 8px',fontSize:11,outline:'none'}}/>
        <span style={{fontSize:11,color:C.muted}}>até</span>
        <input type="date" value={ate} onChange={e=>setAte(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 8px',fontSize:11,outline:'none'}}/>
        <select value={parc} onChange={e=>setParc(e.target.value)} style={{background:C.surface,border:'1px solid '+(parc?C.accent:C.border),borderRadius:8,color:parc?C.accent:C.text,padding:'7px 10px',fontSize:11,outline:'none',maxWidth:220}}>
          <option value="">Parceiro: todos</option>
          {Object.entries(parcs).sort((a,b)=>b[1]-a[1]).map(([k,n])=><option key={k} value={k}>{k.slice(0,30)} ({n})</option>)}
        </select>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {chip('todas','Todas')}{chip('aberto','Em aberto')}{chip('PEN','📌 Pendência')}{chip('AND','🏦 Andamento')}{chip('INT','✅ Integradas')}{chip('REP','❌ Reprovadas')}
        </div>
        <label style={{fontSize:11,display:'flex',alignItems:'center',gap:5,color:C.text,fontWeight:600}}>
          <input type="checkbox" checked={soNovas} onChange={e=>setSoNovas(e.target.checked)}/> só as ainda não exportadas
        </label>
        <div style={{flex:1}}/>
        <button onClick={gerar} disabled={!g.length} style={{padding:'10px 22px',borderRadius:9,border:'none',background:g.length?C.accent2:C.border,color:'#fff',fontWeight:800,fontSize:13,cursor:g.length?'pointer':'default'}}>📄 Gerar arquivo WorkBank ({g.length})</button>
      </div>
      {msg&&<div style={{fontSize:11,color:msg.includes('não consegui')?C.warn:C.accent2,fontWeight:600}}>{msg}</div>}
    </div>
    <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:480,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Proposta','Cliente','Digitada','Situação','Valor','Parcelas','Nascimento','Produto','Parceiro','Exportada'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
      {g.slice(0,200).map((r,i)=>{const w=wbd.get(r.chave||r.proposta)||{};return<tr key={i}>
        <td style={{...td,fontSize:10}}>{r.proposta}</td>
        <td style={{...td,fontWeight:600}}>{(r.cliente||'—').slice(0,24)}</td>
        <td style={{...td,fontSize:10}}>{fmtDate(r.data)}</td>
        <td style={{...td,fontSize:10}}>{r.situacao_banco}</td>
        <td style={{...td,fontWeight:600}}>{cfMoney(r.vr_bruto)}</td>
        <td style={{...td,textAlign:'center'}}>{w.prazo?Number(w.prazo):<span style={{color:C.warn}}>…</span>}</td>
        <td style={{...td,fontSize:10}}>{w.nascimento?fmtDate(w.nascimento):<span style={{color:C.warn}}>…</span>}</td>
        <td style={{...td,fontSize:10}}>{w.tabela_nome||<span style={{color:C.warn}}>aguardando robô</span>}</td>
        <td style={{...td,fontSize:10,color:C.accent}}>{(r.parceiro||'—').slice(0,18)}</td>
        <td style={{...td,fontSize:10}}>{w.exportado_em?'✓ '+fmtDate(w.exportado_em):'—'}</td>
      </tr>})}
    </tbody></table></div>
    {g.length>200&&<div style={{fontSize:10,color:C.muted}}>Mostrando 200 de {g.length} — o arquivo sai com todas.</div>}
  </div>
}
function EsteiraCompra(){
  const[rows,setRows]=useState(null),[loading,setLoading]=useState(true)
  const[fase,setFase]=useState(null),[per,setPer]=useState('tudo')
  const[cms,setCms]=useState([]),[err,setErr]=useState('')
  const[syncInfo,setSyncInfo]=useState(null),[tokenMsg,setTokenMsg]=useState(''),[fEst,setFEst]=useState('todas')
  const[portalMsg,setPortalMsg]=useState('')
  const[busca,setBusca]=useState(''),[gFiltro,setGFiltro]=useState('aberto'),[gStatus,setGStatus]=useState(''),[gParc,setGParc]=useState(''),[expandido,setExpandido]=useState(null)
  async function wbExport(lista){
    const HDR=["NUM_BANCO","NOM_BANCO","NUM_PROPOSTA","NUM_CONTRATO","DSC_TIPO_PROPOSTA_EMPRESTIMO","COD_PRODUTO","DSC_PRODUTO","DAT_CTR_INCLUSAO","DSC_SITUACAO_EMPRESTIMO","DAT_EMPRESTIMO","COD_EMPREGADOR","DSC_CONVENIO","COD_ORGAO","NOM_ORGAO","COD_PRODUTOR_VENDA","NOM_PRODUTOR_VENDA","NIC_CTR_USUARIO","COD_CPF_CLIENTE","NOM_CLIENTE","DAT_NASCIMENTO","NUM_IDENTIDADE","NOM_LOGRADOURO","NUM_PREDIO","DSC_CMPLMNT_ENDRC","NOM_BAIRRO","NOM_LOCALIDADE","SIG_UNIDADE_FEDERACAO","COD_ENDRCMNT_PSTL","NUM_TELEFONE","NUM_TELEFONE_CELULAR","NOM_MAE","NOM_PAI","NUM_BENEFICIO","QTD_PARCELA","VAL_PRESTACAO","VAL_BRUTO","VAL_SALDO_RECOMPRA","VAL_SALDO_REFINANCIAMENTO","VAL_LIQUIDO","PCR_PMT_PAGO_REF","DAT_CREDITO","DAT_CONFIRMACAO","VAL_REPASSE","PCL_COMISSAO","VAL_COMISSAO","COD_UNIDADE_EMPRESA","COD_SITUACAO_EMPRESTIMO","DAT_ESTORNO","DSC_OBSERVACAO","NUM_CPF_AGENTE","NUM_OBJETO_ECT","PCL_TAXA_EMPRESTIMO","DSC_TIPO_FORMULARIO_EMPRESTIMO","DSC_TIPO_CREDITO_EMPRESTIMO","NOM_GRUPO_UNIDADE_EMPRESA","COD_PROPOSTA_EMPRESTIMO","COD_GRUPO_UNIDADE_EMPRESA","COD_TIPO_FUNCAO","COD_TIPO_PROPOSTA_EMPRESTIMO","COD_LOJA_DIGITACAO","VAL_SEGURO"]
    const{data:wbd}=await supabase.from('workbank_dados').select('*')
    const W=new Map((wbd||[]).map(x=>[String(x.proposta),x]))
    const cpfF=c=>{const x=String(c||'').replace(/\D/g,'').padStart(11,'0');return x.slice(0,3)+'.'+x.slice(3,6)+'.'+x.slice(6,9)+'-'+x.slice(9)}
    const D=v=>{if(!v)return null;const d=new Date(String(v).length<=10?v+'T12:00:00':v);return isNaN(d)?null:d}
    const hoje=new Date();hoje.setHours(12,0,0,0)
    let semDados=0
    const linhas=lista.map(r=>{
      const w=W.get(String(r.proposta))||{}
      if(!w.tabela_nome)semDados++
      const tipo=/COMPRA/i.test(r.operacao||'')?'RECOMPRA':'CARTÃO'
      const o={};HDR.forEach(h=>o[h]=null)
      o.NUM_BANCO=410;o.NOM_BANCO='NEOCREDITO'
      o.NUM_PROPOSTA=r.proposta;o.NUM_CONTRATO=r.proposta
      o.DSC_TIPO_PROPOSTA_EMPRESTIMO=tipo
      o.DSC_PRODUTO=w.tabela_nome?((r.convenio||'')+'-'+w.tabela_nome+'-'+tipo):null
      o.DAT_CTR_INCLUSAO=hoje
      o.DSC_SITUACAO_EMPRESTIMO=r.situacao_banco||''
      o.DAT_EMPRESTIMO=D(r.data)
      o.NIC_CTR_USUARIO=r.parceiro||''
      o.COD_CPF_CLIENTE=cpfF(r.cpf);o.NOM_CLIENTE=r.cliente||''
      o.DAT_NASCIMENTO=D(w.nascimento)
      o.QTD_PARCELA=w.prazo?Number(w.prazo):null
      o.VAL_PRESTACAO=r.vr_parcela||null;o.VAL_BRUTO=r.vr_bruto||null;o.VAL_LIQUIDO=r.vr_liquido||null
      o.DAT_CREDITO=D(w.dat_credito||r.data_nosso_credito)
      o.DSC_TIPO_FORMULARIO_EMPRESTIMO='DIGITAL'
      return HDR.map(h=>o[h])
    })
    const ws=XLSX.utils.aoa_to_sheet([HDR,...linhas],{cellDates:true})
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,ws,'Planilha1')
    XLSX.writeFile(book,'Arquivo Padrao WORKBANK.xlsx',{cellDates:true})
    if(semDados)alert(semDados+' proposta(s) ainda sem dados completos (nascimento/parcelas/produto) — o robô preenche aos poucos; exporte de novo mais tarde pra completar.')
  }
  const[parcList,setParcList]=useState([]),[selParc,setSelParc]=useState(''),[parcTel,setParcTel]=useState(''),[parcRecebe,setParcRecebe]=useState(true),[parcMsg,setParcMsg]=useState('')
  const cmsRef=useRef(),tokRefL=useRef(),tokRefE=useRef(),portRefJ=useRef(),portRefT=useRef(),gestaoRef=useRef()
  const loadRows=async()=>{
    setLoading(true)
    const PAGE=1000;let all=[],from=0
    while(true){
      const{data,error}=await supabase.from('konsig_esteira').select('*').range(from,from+PAGE-1)
      if(error){setErr('Erro: '+error.message);break}
      if(!data||!data.length)break
      all=all.concat(data);if(data.length<PAGE)break;from+=PAGE
    }
    // Cruza com o WorkBank (digitacoes NEOCREDITO) por nº de proposta → parceiro (agente) + digitador (usuario)
    const digMap=new Map();let dfrom=0
    while(true){
      const{data:dg}=await supabase.from('digitacoes').select('proposta,agente,usuario').eq('banco','NEOCREDITO').range(dfrom,dfrom+PAGE-1)
      if(!dg||!dg.length)break
      dg.forEach(d=>{if(d.proposta)digMap.set(cfDig(d.proposta),{agente:(d.agente||'').trim(),usuario:(d.usuario||'').trim()})})
      if(dg.length<PAGE)break;dfrom+=PAGE
    }
    // Margem do Portal do Consignado (tabela separada, por CPF) — 🟢 aberto / 🔴 averbado
    const margemMap=new Map()
    const{data:pm}=await supabase.from('portal_margem').select('cpf,status,benef_disp,benef_bruta,prox_folha,ref,checked_at')
    ;(pm||[]).forEach(m=>margemMap.set(String(m.cpf),m))
    const mapped=all.map(r=>{
      const dig=digMap.get(cfDig(r.proposta))
      const parceiro=(dig&&dig.agente)?dig.agente:(dig&&dig.usuario)?dig.usuario:(r.usuario_nome||'(sem parceiro)')
      const mg=margemMap.get(String(r.cpf))
      return{
      proposta:r.proposta,cpf:r.cpf,cliente:r.nome,esteira:r.esteira||'?',
      data:(String(r.datahorac||'')).slice(0,10),datahoras:r.datahoras,
      vr_bruto:Number(r.valorbruto)||0,vr_parcela:Number(r.valorparcela)||0,vr_liquido:Number(r.valorliquido)||0,
      situacao:(r.situacao_descricao||'').toUpperCase(),
      situacao_banco:((r.situacao||'')+' - '+(r.status||'')).trim(),
      usuario:r.usuario_nome||'',agente:r.usuario_nome||'',parceiro,
      corban:r.corban_nome||'',convenio:r.convenio_nome||'',operacao:r.tipooperacao_nome||'',
      obs_texto:r.obs_texto||'',obs_autor:r.obs_autor||'',obs_data:r.obs_data||null,
      margem:mg?{status:mg.status,disp:mg.benef_disp,bruta:mg.benef_bruta,folha:mg.prox_folha,ref:mg.ref,at:mg.checked_at}:null,
      crc_cliente:null,data_nosso_credito:(r.situacao==='INT')?(String(r.datahoras||'')).slice(0,10):null
    }})
    setRows(mapped);setLoading(false)
    const{data:cfg}=await supabase.from('konsig_config').select('key,value,updated_at')
    if(cfg){const m={};cfg.forEach(c=>m[c.key]=c);setSyncInfo(m)}
    const{data:pl}=await supabase.from('parceiros').select('id,nome,telefone_notificacao,receber_notificacoes').order('nome')
    if(pl)setParcList(pl)
  }
  useEffect(()=>{loadRows()},[])
  const saveToken=async(label,ref)=>{
    const tk=(ref.current?.value||'').trim();if(!tk){setTokenMsg('Cole o token da esteira '+label);return}
    setTokenMsg('Salvando '+label+'...')
    const{error}=await supabase.from('konsig_config').upsert([{key:'konsig_token_'+label,value:tk,updated_at:new Date().toISOString()},{key:'konsig_expirado_'+label,value:'0',updated_at:new Date().toISOString()}],{onConflict:'key'})
    setTokenMsg(error?('Erro: '+error.message):'✓ Token '+label+' salvo! Salve os 2 e clique em "Sincronizar esteira agora".')
    if(!error&&ref.current)ref.current.value=''
  }
  const savePortal=async()=>{
    const js=(portRefJ.current?.value||'').trim(),tk=(portRefT.current?.value||'').trim()
    if(!js||!tk){setPortalMsg('Cole o JSESSIONID e o securitytoken');return}
    setPortalMsg('Salvando sessão do portal...')
    const now=new Date().toISOString()
    const{error}=await supabase.from('konsig_config').upsert([
      {key:'portal_jsession',value:js,updated_at:now},{key:'portal_token',value:tk,updated_at:now},
      {key:'portal_ativo',value:'1',updated_at:now},{key:'portal_sessao_ok',value:'1',updated_at:now},{key:'portal_updated',value:now,updated_at:now},
      {key:'portal_run_now',value:now,updated_at:now},{key:'portal_run_status',value:'solicitado '+new Date().toLocaleTimeString('pt-BR'),updated_at:now}
    ],{onConflict:'key'})
    setPortalMsg(error?('Erro: '+error.message):'✓ Sessão salva e consulta disparada! O robô roda em até ~1 min — acompanhe o status abaixo.')
    if(!error){if(portRefJ.current)portRefJ.current.value='';if(portRefT.current)portRefT.current.value=''}
  }
  const dispararPortal=async()=>{
    setPortalMsg('Disparando consulta de margens...')
    const now=new Date().toISOString()
    const{error}=await supabase.from('konsig_config').upsert([
      {key:'portal_run_now',value:now,updated_at:now},{key:'portal_run_status',value:'solicitado '+new Date().toLocaleTimeString('pt-BR'),updated_at:now}
    ],{onConflict:'key'})
    setPortalMsg(error?('Erro: '+error.message):'✓ Consulta disparada! O robô roda em até ~1 min — acompanhe o status abaixo.')
    setTimeout(loadRows,5000)
  }
  const sincronizarEsteira=async()=>{
    setTokenMsg('Disparando sincronização das esteiras...')
    const now=new Date().toISOString()
    const{error}=await supabase.from('konsig_config').upsert([
      {key:'sync_run_now',value:now,updated_at:now},{key:'sync_run_status',value:'solicitado '+new Date().toLocaleTimeString('pt-BR'),updated_at:now}
    ],{onConflict:'key'})
    setTokenMsg(error?('Erro: '+error.message):'✓ Sincronização disparada! O robô puxa as esteiras em até ~1 min.')
    setTimeout(loadRows,8000)
  }
  const onSelParc=id=>{setSelParc(id);const p=parcList.find(x=>x.id===id);setParcTel(p?.telefone_notificacao||'');setParcRecebe(p?.receber_notificacoes!==false);setParcMsg('')}
  const salvarTelParc=async()=>{
    if(!selParc){setParcMsg('Escolha um parceiro');return}
    const tel=parcTel.split(/[,;\n]/).map(s=>s.trim()).filter(Boolean).map(n=>{if(/@/.test(n))return n;const d=n.replace(/\D/g,'');return d.length<=11?('55'+d):d}).join(',')
    const{error}=await supabase.from('parceiros').update({telefone_notificacao:tel,receber_notificacoes:parcRecebe}).eq('id',selParc)
    setParcMsg(error?('Erro: '+error.message):'✓ Telefones salvos ('+(tel?tel.split(',').length:0)+')')
    if(!error){setParcTel(tel);loadRows()}
  }
  const readCms=f=>{const rd=new FileReader();rd.onload=ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const rs=cfParseComissaoNeo(wb);if(!rs.length){setErr('Não reconheci o formato de comissão NEO ('+f.name+')');return}setErr('');setCms(p=>[...p,{nome:f.name,rows:rs}])}catch(e){setErr('Erro lendo comissão: '+e.message)}};rd.readAsArrayBuffer(f)}
  const R=useMemo(()=>{
    if(!rows)return null
    const hoje=NOW
    const dias=d=>{if(!d)return null;const dt=new Date(String(d).slice(0,10)+'T00:00:00');return isNaN(dt)?null:Math.floor((hoje-dt)/86400000)}
    const pFrom=per==='mes'?localDate(new Date(hoje.getFullYear(),hoje.getMonth(),1)):per==='90d'?localDate(new Date(hoje-90*86400000)):per==='ano'?hoje.getFullYear()+'-01-01':'2000-01-01'
    const base=rows.filter(r=>(r.data||'')>=pFrom).filter(r=>fEst==='todas'||r.esteira===fEst).map(r=>({...r,_fase:ncFase(r),_dias:dias(r.datahoras||r.data),_ciclo:r.data_nosso_credito?Math.max(0,Math.floor((new Date(String(r.data_nosso_credito).slice(0,10))-new Date(String(r.data).slice(0,10)))/86400000)):null}))
    const byFase={};NC_FASES.forEach(f=>byFase[f.id]={n:0,v:0,rows:[]})
    base.forEach(r=>{const f=byFase[r._fase]||byFase.pend;f.n++;f.v+=(r.vr_bruto||0);f.rows.push(r)})
    NC_FASES.forEach(f=>byFase[f.id].rows.sort((a,b)=>(b._dias||0)-(a._dias||0)))
    const decididas=byFase.int.n+byFase.reprov.n
    const aprovadas=byFase.int.n
    const ciclos=base.filter(r=>r._ciclo!=null).map(r=>r._ciclo)
    const cicloMed=ciclos.length?ciclos.reduce((a,b)=>a+b,0)/ciclos.length:null
    // Sub-status do banco (situacao_banco): averbação, margem, pendências e reprovações POR MOTIVO
    const sb=r=>String(r.situacao_banco||'').trim().toUpperCase()
    const averbadas=base.filter(r=>sb(r).startsWith('INT'))  // integrada / TED emitida = averbado e liberado
    const margemProb=base.filter(r=>sb(r).includes('MARGEM'))
    const grpMotivo=(pref)=>{const m=new Map();base.forEach(r=>{const s=sb(r);if(!s.startsWith(pref))return;const motivo=s.replace(/^(AND|PEN|REP|INT)\s*-\s*/,'')||s;const e=m.get(motivo)||{motivo,n:0,v:0};e.n++;e.v+=(r.vr_bruto||0);m.set(motivo,e)});return[...m.values()].sort((a,b)=>b.n-a.n)}
    const pendMotivos=grpMotivo('PEN'),repMotivos=grpMotivo('REP'),andMotivos=grpMotivo('AND')
    // Pendências a direcionar POR PARCEIRO (pendência + em andamento = precisam de ação; ordenado por qtd)
    const emAberto=base.filter(r=>r._fase==='pend'||r._fase==='banco')
    const porParceiro=(()=>{const m=new Map();emAberto.forEach(r=>{const k=r.parceiro||'(sem parceiro)';const e=m.get(k)||{parceiro:k,n:0,v:0,pend:0,band:0,rows:[]};e.n++;e.v+=(r.vr_bruto||0);if(r._fase==='pend')e.pend++;else e.band++;e.rows.push(r);m.set(k,e)});return[...m.values()].sort((a,b)=>b.n-a.n)})()
    // Aging: há quantos dias estão parados os em aberto (pendência + andamento)
    const agingDef=[{k:'0–7 dias',min:0,max:7,c:C.accent2},{k:'8–15 dias',min:8,max:15,c:C.info},{k:'16–30 dias',min:16,max:30,c:C.warn},{k:'31+ dias',min:31,max:1e9,c:C.danger}]
    const aging=agingDef.map(b=>{const rs=emAberto.filter(r=>r._dias!=null&&r._dias>=b.min&&r._dias<=b.max);return{k:b.k,c:b.c,n:rs.length,v:rs.reduce((s,r)=>s+(r.vr_bruto||0),0),rows:rs.sort((a,b)=>(b._dias||0)-(a._dias||0))}})
    const diasArr=emAberto.map(r=>r._dias).filter(d=>d!=null)
    const diasMed=diasArr.length?Math.round(diasArr.reduce((a,b)=>a+b,0)/diasArr.length):0
    const diasMax=diasArr.length?Math.max(...diasArr):0
    // Margem ABERTA (Disponível=Bruta): desaverbou, PODE ATUAR. E bloqueadas (servidor não deixa consultar).
    const margemAberta=base.filter(r=>r.margem&&r.margem.status==='aberto').sort((a,b)=>(a._dias||0)-(b._dias||0))
    const margemBloqueada=base.filter(r=>r.margem&&r.margem.status==='bloqueado')
    const margemAverbada=base.filter(r=>r.margem&&r.margem.status==='averbado')
    // Aguardando liquidação — análise cliente a cliente (o que interessa pra compra); tempo = dias desde a última mudança de status
    const aguardLiq=base.filter(r=>/AGUARD LIQUIDACAO/i.test(r.situacao_banco||'')).map(r=>({...r,_diasLiq:diasUteisAte(r.datahoras)})).sort((a,b)=>(b._diasLiq||0)-(a._diasLiq||0))
    const aguardLiqVal=aguardLiq.reduce((s,r)=>s+(r.vr_bruto||0),0)
    const aguardLiqMed=aguardLiq.length?Math.round(aguardLiq.reduce((s,r)=>s+(r._diasLiq||0),0)/aguardLiq.filter(r=>r._diasLiq!=null).length):0
    // comissão NEO
    const cmsAll=cms.flatMap(f=>f.rows)
    const cmsMap=new Map();cmsAll.forEach(c=>{const e=cmsMap.get(c.prop)||{cms:0,usuario:c.usuario};e.cms+=c.cms;cmsMap.set(c.prop,e)})
    const okFases=['int']
    const concluidas=base.filter(r=>okFases.includes(r._fase))
    const comCms=concluidas.filter(r=>cmsMap.has(cfDig(r.proposta)))
    const semCms=concluidas.filter(r=>!cmsMap.has(cfDig(r.proposta)))
    const porVend=new Map();cmsAll.forEach(c=>{const e=porVend.get(c.usuario)||{key:c.usuario,n:0,v:0};e.n++;e.v+=c.cms;porVend.set(c.usuario,e)})
    return{base,byFase,decididas,aprovadas,taxaAprov:decididas?aprovadas/decididas*100:0,cicloMed,
      averbadas,margemProb,pendMotivos,repMotivos,andMotivos,emAberto,porParceiro,aging,diasMed,diasMax,margemAberta,margemBloqueada,margemAverbada,aguardLiq,aguardLiqVal,aguardLiqMed,
      cmsAll,cmsTot:cmsAll.reduce((s,c)=>s+c.cms,0),comCms,semCms,porVend:[...porVend.values()].sort((a,b)=>b.v-a.v)}
  },[rows,per,cms,fEst])
  const th={padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}
  const td={padding:'7px 10px',fontSize:11,borderBottom:'1px solid '+C.border}
  const agCol=d=>d==null?C.muted:d>30?C.danger:d>15?C.warn:C.text
  const sbCol=s=>{const u=String(s||'').toUpperCase();if(u.includes('MARGEM'))return C.danger;if(u.startsWith('INT'))return C.accent2;if(u.startsWith('REP'))return C.danger;if(u.startsWith('PEN'))return C.warn;if(u.startsWith('AND'))return C.info;return C.muted}
  const mgCell=m=>{
    if(!m||!m.status)return<span style={{color:C.muted}}>—</span>
    const tip='Consultado '+(m.at?new Date(m.at).toLocaleString('pt-BR'):'')+(m.ref?' · ref '+m.ref:'')
    if(m.status==='aberto')return<span style={{color:C.accent2,fontWeight:700}} title={tip+' · Disponível = Bruta (margem inteira livre)'}>🟢 ABERTA · {cfMoney(m.bruta)}{m.folha?' · folha '+m.folha:''}</span>
    if(m.status==='averbado')return<span style={{color:C.danger,fontWeight:700}} title={tip+' · livre / teto (ainda consumindo)'}>🔴 {cfMoney(m.disp)} / {cfMoney(m.bruta)}{m.folha?' · folha '+m.folha:''}</span>
    if(m.status==='bloqueado')return<span style={{color:C.warn,fontSize:10}} title={'Servidor não permite a consulta de margem no portal (ESCC8017)'}>🔒 bloqueado</span>
    const lbl={erro:'erro',sem_matricula:'s/ matríc',sem_dado:'s/ dado',aviso:'aviso'}[m.status]||m.status
    return<span style={{color:C.muted,fontSize:9}} title={tip}>{lbl}</span>
  }
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div><h2 style={{fontWeight:800,fontSize:20,margin:0}}>🛒 Esteira Compra — NeoCrédito <span style={{fontSize:10,fontWeight:600,color:C.accent2,background:C.accent2+'18',padding:'2px 8px',borderRadius:6,verticalAlign:'middle'}}>● AO VIVO</span></h2><div style={{fontSize:11,color:C.muted,marginTop:2}}>Puxada direto do Konsig (api.konsig.com.br) pelo robô do escritório{syncInfo?.konsig_last_sync?' · última atualização: '+new Date(syncInfo.konsig_last_sync.value).toLocaleString('pt-BR'):''}{syncInfo?.konsig_last_status?' · '+syncInfo.konsig_last_status.value:''}</div></div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <button onClick={loadRows} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+C.border,background:C.surface,color:C.accent,fontSize:11,cursor:'pointer'}}>🔄 Recarregar</button>
        <div style={{display:'flex',gap:4}}>{[{id:'mes',l:'Mês'},{id:'90d',l:'90 dias'},{id:'ano',l:String(NOW.getFullYear())},{id:'tudo',l:'Tudo'}].map(p=><button key={p.id} onClick={()=>setPer(p.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(per===p.id?C.accent:C.border),background:per===p.id?C.abg:'transparent',color:per===p.id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:per===p.id?600:400}}>{p.l}</button>)}</div>
      </div>
    </div>
    {(()=>{const rel=v=>{if(!v)return '';const min=Math.round((Date.now()-new Date(v).getTime())/60000);const t=min<60?('há '+min+'min'):('há '+Math.floor(min/60)+'h'+String(min%60).padStart(2,'0'));return t};const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'—';const chip={display:'inline-flex',alignItems:'center',gap:6,background:C.card,border:'1px solid '+C.border,borderRadius:8,padding:'6px 12px',fontSize:11};const ks=syncInfo?.konsig_last_sync?.value,pl=syncInfo?.portal_last?.value;const cor=v=>{if(!v)return C.muted;const min=(Date.now()-new Date(v).getTime())/60000;return min<180?C.accent2:C.warn};return<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <span style={chip}>🔑 <span style={{color:C.muted}}>Esteira atualizada:</span> <b>{fmt(ks)}</b> <span style={{color:cor(ks),fontWeight:600}}>{rel(ks)?'· '+rel(ks):''}</span></span>
      <span style={chip}>🏛️ <span style={{color:C.muted}}>Margens consultadas:</span> <b>{fmt(pl)}</b> <span style={{color:cor(pl),fontWeight:600}}>{rel(pl)?'· '+rel(pl):''}</span></span>
    </div>})()}
    <div style={{display:'flex',gap:4}}>{[{id:'todas',l:'Todas as esteiras'},{id:'lhamas',l:'🏠 Lhamas'},{id:'externa',l:'🌐 Externa'}].map(e=><button key={e.id} onClick={()=>setFEst(e.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(fEst===e.id?C.accent2:C.border),background:fEst===e.id?C.accent2+'18':'transparent',color:fEst===e.id?C.accent2:C.muted,fontSize:11,cursor:'pointer',fontWeight:fEst===e.id?700:400}}>{e.l}</button>)}</div>
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:11,fontWeight:700}}>🔑 Tokens Konsig do dia <span style={{fontWeight:400,color:C.muted}}>· cole de manhã (F12 → Network → req "proposta" → copie o authorization=)</span></div>
      {[{label:'lhamas',l:'🏠 Lhamas',ref:tokRefL},{label:'externa',l:'🌐 Externa',ref:tokRefE}].map(t=>{const exp=syncInfo?.['konsig_expirado_'+t.label]?.value==='1';return<div key={t.label} style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:600,width:90,color:exp?C.danger:C.text}}>{t.l}{exp?' ⚠️':''}</span>
        <input ref={t.ref} type="password" placeholder={'token da esteira '+t.label+(exp?' (EXPIROU — cole novo)':'')} style={{flex:1,minWidth:200,background:C.surface,border:'1px solid '+(exp?C.danger:C.border),borderRadius:7,color:C.text,padding:'7px 11px',fontSize:11,outline:'none'}}/>
        <button onClick={()=>saveToken(t.label,t.ref)} style={{padding:'7px 16px',borderRadius:8,border:'none',background:C.accent,color:'#fff',fontWeight:600,fontSize:11,cursor:'pointer'}}>Salvar</button>
      </div>})}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <button onClick={sincronizarEsteira} style={{padding:'8px 18px',borderRadius:8,border:'1px solid '+C.accent2,background:C.accent2+'15',color:C.accent2,fontWeight:700,fontSize:12,cursor:'pointer'}}>🔄 Sincronizar esteira agora</button>
        <span style={{fontSize:10,color:C.muted}}>depois de salvar os 2 tokens · o robô puxa em ~1 min</span>
        {syncInfo?.sync_run_status&&<span style={{fontSize:11,fontWeight:600,color:String(syncInfo.sync_run_status.value).includes('✓')?C.accent2:String(syncInfo.sync_run_status.value).includes('erro')?C.danger:C.warn}}>· {syncInfo.sync_run_status.value}</span>}
      </div>
      {tokenMsg&&<span style={{fontSize:11,color:tokenMsg.includes('✓')?C.accent2:tokenMsg.includes('Erro')?C.danger:C.muted}}>{tokenMsg}</span>}
    </div>
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:11,fontWeight:700}}>🏛️ Sessão do Portal do Consignado <span style={{fontWeight:400,color:C.muted}}>· logue de manhã e cole aqui (F12 → Network → req "pesquisarMargem" → Cabeçalhos: cookie JSESSIONID e securitytoken)</span>
        {syncInfo?.portal_sessao_ok&&<span style={{marginLeft:8,fontSize:10,fontWeight:700,color:syncInfo.portal_sessao_ok.value==='1'?C.accent2:C.danger}}>{syncInfo.portal_sessao_ok.value==='1'?'● sessão ativa':'● sessão caiu — logar de novo'}</span>}
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:600,width:90}}>JSESSIONID</span>
        <input ref={portRefJ} type="password" placeholder="valor do cookie JSESSIONID=..." style={{flex:1,minWidth:200,background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 11px',fontSize:11,outline:'none'}}/>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:600,width:90}}>securitytoken</span>
        <input ref={portRefT} type="password" placeholder="header securitytoken: WW2X-..." style={{flex:1,minWidth:200,background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 11px',fontSize:11,outline:'none'}}/>
        <button onClick={savePortal} style={{padding:'7px 16px',borderRadius:8,border:'none',background:C.accent,color:'#fff',fontWeight:600,fontSize:11,cursor:'pointer'}}>Salvar e consultar</button>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <button onClick={dispararPortal} style={{padding:'8px 18px',borderRadius:8,border:'1px solid '+C.accent2,background:C.accent2+'15',color:C.accent2,fontWeight:700,fontSize:12,cursor:'pointer'}}>🔍 Consultar margens agora</button>
        <span style={{fontSize:10,color:C.muted}}>usa a sessão já salva · o robô roda em ~1 min</span>
        {syncInfo?.portal_run_status&&<span style={{fontSize:11,fontWeight:600,color:String(syncInfo.portal_run_status.value).includes('✓')?C.accent2:String(syncInfo.portal_run_status.value).includes('erro')?C.danger:C.warn}}>· {syncInfo.portal_run_status.value}</span>}
      </div>
      {(portalMsg||syncInfo?.portal_status)&&<span style={{fontSize:11,color:portalMsg.includes('✓')?C.accent2:portalMsg.includes('Erro')?C.danger:C.muted}}>{portalMsg||('robô: '+syncInfo.portal_status.value)}</span>}
    </div>
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:11,fontWeight:700}}>📱 Telefones de aviso por parceiro <span style={{fontWeight:400,color:C.muted}}>· cadastre 1 ou mais números (separe por vírgula) — o disparo avisa todos</span></div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <select value={selParc} onChange={e=>onSelParc(e.target.value)} style={{minWidth:240,background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:11,outline:'none'}}>
          <option value="">— escolha o parceiro —</option>
          {parcList.map(p=><option key={p.id} value={p.id}>{(p.nome||'').slice(0,40)}{p.telefone_notificacao?' ✓':''}</option>)}
        </select>
        <input value={parcTel} onChange={e=>setParcTel(e.target.value)} disabled={!selParc} placeholder="ex.: 15998583505 · ou ID de grupo (…@g.us)" style={{flex:1,minWidth:200,background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 11px',fontSize:11,outline:'none',opacity:selParc?1:.5}}/>
        <label style={{fontSize:11,display:'flex',alignItems:'center',gap:5,color:C.muted}}><input type="checkbox" checked={parcRecebe} onChange={e=>setParcRecebe(e.target.checked)} disabled={!selParc}/> receber avisos</label>
        <button onClick={salvarTelParc} disabled={!selParc} style={{padding:'7px 16px',borderRadius:8,border:'none',background:selParc?C.accent:C.border,color:'#fff',fontWeight:600,fontSize:11,cursor:selParc?'pointer':'default'}}>Salvar</button>
      </div>
      {parcMsg&&<span style={{fontSize:11,color:parcMsg.includes('✓')?C.accent2:parcMsg.includes('Erro')?C.danger:C.muted}}>{parcMsg}</span>}
      <span style={{fontSize:10,color:C.muted}}>💡 pode cadastrar quantos parceiros quiser — cada um com seus telefones (DDI 55 automático). Pra enviar num <b>grupo</b>, cole o ID do grupo (termina em <code>@g.us</code>) — o número de envio precisa estar no grupo.</span>
    </div>
    {err&&<div style={{background:'#EF444418',color:C.danger,padding:'10px 14px',borderRadius:8,fontSize:12}}>{err}</div>}
    {loading&&<div style={{padding:30,textAlign:'center',color:C.muted}}>Carregando esteira...</div>}
    {R&&<>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label="Compras no período" value={R.base.length} sub={cfMoney(R.base.reduce((s,r)=>s+(r.vr_bruto||0),0))}/>
        <Stat label="Taxa de aprovação" value={R.taxaAprov.toFixed(0)+'%'} sub={'sobre '+R.decididas+' decididas'} color={R.taxaAprov>=60?C.accent2:C.warn}/>
        <Stat label="Averbadas / liberadas" value={R.averbadas.length} sub="TED emitida (margem liberada)" color={C.accent2}/>
        <Stat label="Barrada por margem" value={R.margemProb.length} sub="insuficiente / negativa / zerada" color={R.margemProb.length?C.danger:C.muted}/>
        <Stat label="Em aberto (pend + andamento)" value={R.byFase.pend.n+R.byFase.banco.n} sub={cfMoney(R.byFase.pend.v+R.byFase.banco.v)+' na esteira'} color={C.warn}/>
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderLeft:'4px solid '+C.accent2,borderRadius:14,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6,marginBottom:6}}>
          <div style={{fontSize:13,fontWeight:800}}>🟢 Margem ABERTA — atuar agora ({R.margemAberta.length})</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:10,color:C.muted}}>desaverbou (Disponível = Bruta) · 🔴 {R.margemAverbada.length} ainda consumindo · 🔒 {R.margemBloqueada.length} bloqueadas</span>
            {R.margemAberta.length>0&&<button onClick={()=>cfExport(R.margemAberta.map(r=>({proposta:r.proposta,cpf:r.cpf,cliente:r.cliente,margem_teto:r.margem?.bruta,proxima_folha:r.margem?.folha,parceiro:r.parceiro,dias:r._dias})),'margem-aberta-atuar')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.accent2,background:C.accent2+'12',color:C.accent2,cursor:'pointer'}}>⬇ Exportar</button>}
          </div>
        </div>
        {R.margemAberta.length===0
          ? <div style={{fontSize:11,color:C.muted,background:C.surface,borderRadius:8,padding:'10px 12px'}}>Nenhuma margem aberta no momento — as aguardando liquidação ainda têm contrato consumindo a margem. O robô marca 🟢 aqui automaticamente no instante em que <b>Disponível = Bruta</b> (o contrato antigo sair).</div>
          : <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:320,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Cliente','CPF','Proposta','Margem (teto)','Próx. folha','Parceiro','Dias'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
            {R.margemAberta.map((r,i)=><tr key={i}><td style={{...td,fontWeight:600}}>{(r.cliente||'—').slice(0,26)}</td><td style={{...td,fontSize:10}}>{r.cpf}</td><td style={{...td,fontSize:10}}>{r.proposta}</td><td style={{...td,fontWeight:700,color:C.accent2}}>{cfMoney(r.margem?.bruta)}</td><td style={{...td,fontSize:10}}>{r.margem?.folha||'—'}</td><td style={{...td,fontSize:10}}>{(r.parceiro||'—').slice(0,22)}</td><td style={{...td,fontWeight:700,color:agCol(r._dias)}}>{r._dias!=null?r._dias+'d':'—'}</td></tr>)}
          </tbody></table></div>}
      </div>
      {R.aguardLiq.length>0&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6,marginBottom:8}}>
          <div>
            <div style={{fontSize:13,fontWeight:800}}>🔄 Aguardando liquidação — análise ({R.aguardLiq.length})</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>{cfMoney(R.aguardLiqVal)} · tempo médio <b>{R.aguardLiqMed} dias úteis</b> · mais demorada <b style={{color:R.aguardLiq[0]?._diasLiq>4?C.danger:C.text}}>{R.aguardLiq[0]?._diasLiq||0} dias úteis</b> · ordenado por tempo (mais antigo = prioridade)</div>
          </div>
          <button onClick={()=>cfExport(R.aguardLiq.map(r=>({cliente:r.cliente,cpf:r.cpf,proposta:r.proposta,dias_uteis_liquidacao:r._diasLiq,dias_corridos_esteira:r._dias,operacao:r.operacao,valor:r.vr_bruto,margem_status:r.margem?.status||'',margem_livre:r.margem?.disp,margem_teto:r.margem?.bruta,proxima_folha:r.margem?.folha,digitador:r.usuario,parceiro:r.parceiro})),'aguardando-liquidacao')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
        </div>
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:460,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Cliente','CPF','Dias úteis','Operação','Valor','Margem benefício','Próx. folha','Parceiro','Digitador'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {R.aguardLiq.map((r,i)=><tr key={i}><td style={{...td,fontWeight:600}}>{(r.cliente||'—').slice(0,24)}</td><td style={{...td,fontSize:10}}>{r.cpf}</td><td style={{...td,fontWeight:700,color:r._diasLiq>4?C.danger:r._diasLiq===4?C.warn:C.text}}>{r._diasLiq!=null?r._diasLiq+' du':'—'}</td><td style={{...td,fontSize:10,color:C.info}}>{(r.operacao||'—').slice(0,16)}</td><td style={{...td,fontWeight:600}}>{cfMoney(r.vr_bruto)}</td><td style={{...td,fontSize:10}}>{mgCell(r.margem)}</td><td style={{...td,fontSize:10}}>{r.margem?.folha||'—'}</td><td style={{...td,fontSize:10,fontWeight:600,color:C.accent}}>{(r.parceiro||'—').slice(0,18)}</td><td style={{...td,fontSize:10,color:C.muted}}>{(r.usuario||'—').slice(0,14)}</td></tr>)}
        </tbody></table></div>
      </div>}
      {(()=>{
        const q=busca.trim().toLowerCase(),qd=q.replace(/\D/g,'')
        const g=R.base.filter(r=>{
          if(gFiltro==='aberto'&&!(r._fase==='pend'||r._fase==='banco'))return false
          if(gFiltro==='pend'&&r._fase!=='pend')return false
          if(gFiltro==='andamento'&&r._fase!=='banco')return false
          if(gFiltro==='liquidacao'&&!/AGUARD LIQUIDACAO/i.test(r.situacao_banco||''))return false
          if(gFiltro==='reprov'&&r._fase!=='reprov')return false
          if(gStatus&&String(r.situacao_banco||'').toUpperCase()!==gStatus)return false
          if(gParc&&(r.parceiro||'')!==gParc)return false
          if(q){const t=(r.cliente||'').toLowerCase().includes(q)||String(r.proposta||'').includes(q)||(r.parceiro||'').toLowerCase().includes(q);const c=qd.length>=3&&(r.cpf||'').includes(qd);if(!t&&!c)return false}
          return true
        }).sort((a,b)=>(b._dias||0)-(a._dias||0))
        const gv=g.reduce((s,r)=>s+(r.vr_bruto||0),0)
        return <div ref={gestaoRef} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div style={{fontSize:13,fontWeight:800}}>📇 Gestão detalhada — {g.length} propostas · {cfMoney(gv)}</div>
            <button onClick={()=>cfExport(g.map(r=>({cliente:r.cliente,cpf:r.cpf,proposta:r.proposta,esteira:r.esteira,data:r.data,dias:r._dias,operacao:r.operacao,convenio:r.convenio,valor:r.vr_bruto,parcela:r.vr_parcela,situacao:r.situacao,detalhe_banco:r.situacao_banco,margem_status:r.margem?.status||'',margem_livre:r.margem?.disp,margem_teto:r.margem?.bruta,prox_folha:r.margem?.folha,digitador:r.usuario,parceiro:r.parceiro,ultima_obs:r.obs_texto,obs_autor:r.obs_autor})),'gestao-esteira-'+gFiltro+(gStatus?('-'+gStatus.toLowerCase().replace(/s+/g,'-')):''))} style={{fontSize:11,padding:'6px 12px',borderRadius:7,border:'1px solid '+C.accent,background:C.abg,color:C.accent,fontWeight:600,cursor:'pointer'}}>⬇ Exportar {g.length}</button>
            <button onClick={()=>wbExport(g)} style={{fontSize:11,padding:'6px 12px',borderRadius:7,border:'1px solid '+C.accent2,background:C.accent2+'12',color:C.accent2,fontWeight:700,cursor:'pointer'}}>📄 WorkBank {g.length}</button>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 buscar por nome, CPF, nº da proposta ou parceiro" style={{flex:1,minWidth:220,background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'8px 12px',fontSize:12,outline:'none'}}/>
            {(()=>{const pc={};R.base.forEach(r=>{const k=(r.parceiro||'').trim();if(k)pc[k]=(pc[k]||0)+1})
              const pops=Object.entries(pc).sort((a,b)=>b[1]-a[1])
              return <select value={gParc} onChange={e=>setGParc(e.target.value)} style={{background:C.surface,border:'1px solid '+(gParc?C.accent:C.border),borderRadius:8,color:gParc?C.accent:C.text,padding:'7px 10px',fontSize:11,outline:'none',fontWeight:gParc?700:400,maxWidth:230}}>
                <option value="">Parceiro: todos</option>
                {pops.map(([k,n])=><option key={k} value={k}>{k.slice(0,30)} ({n})</option>)}
              </select>})()}
            {(()=>{const cnt={};R.base.forEach(r=>{
              if(gFiltro==='aberto'&&!(r._fase==='pend'||r._fase==='banco'))return
              if(gFiltro==='pend'&&r._fase!=='pend')return
              if(gFiltro==='andamento'&&r._fase!=='banco')return
              if(gFiltro==='liquidacao'&&!/AGUARD LIQUIDACAO/i.test(r.situacao_banco||''))return
              if(gFiltro==='reprov'&&r._fase!=='reprov')return
              const k=String(r.situacao_banco||'').toUpperCase().trim();if(k)cnt[k]=(cnt[k]||0)+1})
              const ops=Object.entries(cnt).sort((a,b)=>b[1]-a[1])
              return <select value={gStatus} onChange={e=>setGStatus(e.target.value)} style={{background:C.surface,border:'1px solid '+(gStatus?C.accent:C.border),borderRadius:8,color:gStatus?C.accent:C.text,padding:'7px 10px',fontSize:11,outline:'none',fontWeight:gStatus?700:400,maxWidth:230}}>
                <option value="">Status: todos</option>
                {ops.map(([k,n])=><option key={k} value={k}>{k.slice(0,30)} ({n})</option>)}
              </select>})()}
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{[{id:'aberto',l:'Em aberto'},{id:'pend',l:'📌 Pendência'},{id:'andamento',l:'🏦 Andamento'},{id:'liquidacao',l:'🔄 Aguard. liquidação'},{id:'reprov',l:'❌ Reprovadas'},{id:'todas',l:'Todas'}].map(f=><button key={f.id} onClick={()=>{setGFiltro(f.id);setGStatus('')}} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(gFiltro===f.id?C.accent:C.border),background:gFiltro===f.id?C.abg:'transparent',color:gFiltro===f.id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:gFiltro===f.id?700:400}}>{f.l}</button>)}</div>
          </div>
          <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:560,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['','Cliente','CPF','Proposta','Dias','Cartão / operação','Valor','Situação','Detalhe banco','Margem','Parceiro','Digitador'].map((h,i)=><th key={i} style={th}>{h}</th>)}</tr></thead><tbody>
            {g.slice(0,400).flatMap((r,i)=>{const exp=expandido===r.proposta;return [
              <tr key={i+'a'} onClick={()=>setExpandido(exp?null:r.proposta)} style={{cursor:'pointer',background:exp?C.abg:'transparent'}}>
                <td style={{...td,color:C.muted}}>{exp?'▼':'▶'}</td>
                <td style={{...td,fontWeight:600}}>{(r.cliente||'—').slice(0,24)}</td>
                <td style={{...td,fontSize:10}}>{r.cpf}</td>
                <td style={{...td,fontSize:10}}>{r.proposta}</td>
                <td style={{...td,fontWeight:700,color:agCol(r._dias)}}>{r._dias!=null?r._dias+'d':'—'}</td>
                <td style={{...td,fontSize:10,color:C.info}}>{(r.operacao||'—').slice(0,16)}</td>
                <td style={{...td,fontWeight:600}}>{cfMoney(r.vr_bruto)}</td>
                <td style={td}><Badge text={r.situacao||'—'} color={sbCol(r.situacao_banco)}/></td>
                <td style={{...td,fontSize:10,fontWeight:600,color:sbCol(r.situacao_banco)}}>{r.situacao_banco||'—'}</td>
                <td style={{...td,fontSize:10}}>{mgCell(r.margem)}</td>
                <td style={{...td,fontSize:10,fontWeight:600,color:C.accent}}>{(r.parceiro||'—').slice(0,18)}</td>
                <td style={{...td,fontSize:10,color:C.muted}}>{(r.usuario||'—').slice(0,14)}</td>
              </tr>,
              exp?<tr key={i+'b'}><td colSpan={12} style={{padding:'0 10px 12px 30px',background:C.abg}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,fontSize:11,padding:'10px 0'}}>
                  <div><span style={{color:C.muted}}>Esteira:</span> <b>{r.esteira}</b></div>
                  <div><span style={{color:C.muted}}>Convênio:</span> <b>{r.convenio||'—'}</b></div>
                  <div><span style={{color:C.muted}}>Parceiro:</span> <b>{r.parceiro||'—'}</b></div>
                  <div><span style={{color:C.muted}}>Corban:</span> <b>{r.corban||'—'}</b></div>
                  <div><span style={{color:C.muted}}>Digitado em:</span> <b>{fmtDate(r.data)}</b></div>
                  <div><span style={{color:C.muted}}>Valor parcela:</span> <b>{cfMoney(r.vr_parcela)}</b></div>
                  <div><span style={{color:C.muted}}>Próxima folha:</span> <b>{r.margem?.folha||'—'}</b></div>
                  <div><span style={{color:C.muted}}>Margem benefício:</span> {mgCell(r.margem)}</div>
                </div>
                <div style={{fontSize:11,background:C.card,border:'1px solid '+C.border,borderRadius:8,padding:'8px 10px'}}>
                  <b style={{color:C.accent}}>📝 Última observação do banco {r.obs_autor?('· '+r.obs_autor):''} {r.obs_data?('· '+fmtDate(r.obs_data)):''}</b>
                  <div style={{marginTop:4,color:r.obs_texto?C.text:C.muted}}>{r.obs_texto||'sem observação registrada'}</div>
                </div>
              </td></tr>:null
            ]})}
          </tbody></table></div>
          {g.length>400&&<div style={{fontSize:10,color:C.muted}}>Mostrando 400 de {g.length} — refine a busca.</div>}
        </div>
      })()}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {NC_FASES.map(f=>{const d=R.byFase[f.id];const sel=fase===f.id;return<div key={f.id} onClick={()=>setFase(sel?null:f.id)} style={{flex:1,minWidth:130,background:sel?C.abg:C.card,border:'1px solid '+(sel?C.accent:C.border),borderLeft:'4px solid '+f.color,borderRadius:12,padding:'12px 14px',cursor:'pointer'}}>
          <div style={{fontSize:10,fontWeight:700,color:sel?C.accent:C.muted}}>{f.l}</div>
          <div style={{fontSize:20,fontWeight:800,marginTop:4}}>{d.n}</div>
          <div style={{fontSize:10,color:C.muted}}>{cfMoney(d.v)}</div>
        </div>})}
      </div>
      {fase&&(()=>{const f=NC_FASES.find(x=>x.id===fase);const list=R.byFase[fase].rows
        return<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:700}}>{f.l} — {list.length} propostas (mais paradas primeiro)</div>
          <button onClick={()=>cfExport(list.map(r=>({proposta:r.proposta,cpf:r.cpf,cliente:r.cliente,data:r.data,valor:r.vr_bruto,situacao:r.situacao,detalhe_banco:r.situacao_banco,dias:r._dias,digitador:r.usuario,agente:r.agente,crc:r.crc_cliente,nosso_credito:r.data_nosso_credito})),'esteira-compra-'+fase)} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
        </div>
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:400,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Proposta','Cliente','Valor','Convênio','Cartão / operação','Margem benefício','Situação','Detalhe banco','Dias','Parceiro','Digitador','📝 Última observação'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {list.slice(0,300).map((r,i)=><tr key={i}><td style={td}>{r.proposta}</td><td style={td}>{(r.cliente||'—').slice(0,18)}</td><td style={{...td,fontWeight:600}}>{cfMoney(r.vr_bruto)}</td><td style={{...td,fontSize:10}}>{r.convenio||'—'}</td><td style={{...td,fontSize:10,color:C.info}}>{(r.operacao||'—')}</td><td style={{...td,fontSize:10}}>{mgCell(r.margem)}</td><td style={td}><Badge text={r.situacao||'—'} color={f.color}/></td><td style={{...td,fontSize:10,fontWeight:600,color:sbCol(r.situacao_banco)}}>{r.situacao_banco||'—'}</td><td style={{...td,fontWeight:700,color:agCol(r._dias)}}>{r._dias!=null?r._dias+'d':'—'}</td><td style={{...td,fontSize:10,fontWeight:600,color:C.accent}}>{(r.parceiro||'—').slice(0,18)}</td><td style={{...td,color:C.muted,fontSize:10}}>{(r.usuario||'—').slice(0,16)}</td><td style={{...td,fontSize:10,maxWidth:300}} title={r.obs_texto?(r.obs_autor+' · '+fmtDate(r.obs_data)+': '+r.obs_texto):''}>{r.obs_texto?<span><b style={{color:C.accent}}>{(r.obs_autor||'').split(' ')[0]}:</b> {r.obs_texto.slice(0,80)}{r.obs_texto.length>80?'…':''}</span>:<span style={{color:C.muted}}>—</span>}</td></tr>)}
        </tbody></table></div>
      </div>})()}
      {R.emAberto.length>0&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
        <div style={{fontSize:12,fontWeight:700}}>⏱️ Aging — há quantos dias estão parados</div>
        <div style={{fontSize:10,color:C.muted,marginBottom:8}}>{R.emAberto.length} em aberto (pendência + andamento) · média <b>{R.diasMed} dias</b> · mais parada <b style={{color:R.diasMax>30?C.danger:C.text}}>{R.diasMax} dias</b></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {R.aging.map((b,i)=><div key={i} style={{flex:1,minWidth:120,background:C.surface,border:'1px solid '+C.border,borderLeft:'4px solid '+b.c,borderRadius:10,padding:'10px 12px'}}>
            <div style={{fontSize:10,fontWeight:700,color:b.c}}>{b.k}</div>
            <div style={{fontSize:22,fontWeight:800,marginTop:2}}>{b.n}</div>
            <div style={{fontSize:10,color:C.muted}}>{cfMoney(b.v)}</div>
          </div>)}
        </div>
      </div>}
      {R.porParceiro.length>0&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <div style={{fontSize:12,fontWeight:700,color:C.warn}}>📋 Pendências a direcionar — por parceiro ({R.emAberto.length} em aberto) <span style={{fontWeight:400,color:C.muted,fontSize:10}}>· clique num parceiro pra ver as propostas dele</span></div>
          <button onClick={()=>cfExport(R.emAberto.map(r=>({parceiro:r.parceiro,proposta:r.proposta,cpf:r.cpf,cliente:r.cliente,esteira:r.esteira,situacao:r.situacao,detalhe:r.situacao_banco,dias:r._dias,valor:r.vr_bruto,digitador:r.usuario})),'esteira-pendencias-por-parceiro')} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'1px solid '+C.border,background:C.surface,color:C.accent,cursor:'pointer'}}>⬇ Exportar</button>
        </div>
        <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Parceiro vem do que foi importado do WorkBank (agente/digitador), cruzado por nº de proposta. Pendência = precisa de ação (documentação, assinatura, boleto...) · Andamento = aguardando o banco.</div>
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:380,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Parceiro','Em aberto','📌 Pendência','🏦 Andamento','Valor'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {R.porParceiro.map((p,i)=><tr key={i} onClick={()=>{setBusca(p.parceiro||'');setGFiltro('todas');gestaoRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}} style={{cursor:'pointer'}} title={'Ver as propostas de '+(p.parceiro||'')+' na gestão detalhada'}><td style={{...td,fontWeight:600,color:C.accent}}>{(p.parceiro||'—').slice(0,38)}</td><td style={{...td,fontWeight:700}}>{p.n}</td><td style={{...td,color:p.pend?C.warn:C.muted,fontWeight:p.pend?700:400}}>{p.pend||'—'}</td><td style={{...td,color:p.band?C.info:C.muted}}>{p.band||'—'}</td><td style={{...td,fontWeight:600}}>{cfMoney(p.v)}</td></tr>)}
        </tbody></table></div>
      </div>}
      {(R.pendMotivos.length>0||R.repMotivos.length>0||R.andMotivos.length>0)&&<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🔍 Onde está travado — por etapa/motivo do banco (situacao_banco)</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          {[{t:'⏳ Em andamento no banco',arr:R.andMotivos,col:C.info},{t:'📌 Pendências (ação nossa/cliente)',arr:R.pendMotivos,col:C.warn},{t:'❌ Reprovadas — por motivo',arr:R.repMotivos,col:C.danger}].map((g,gi)=><div key={gi}>
            <div style={{fontSize:11,fontWeight:700,color:g.col,marginBottom:4}}>{g.t} {g.arr.length>0&&'('+g.arr.reduce((s,x)=>s+x.n,0)+')'}</div>
            {g.arr.length===0?<div style={{fontSize:10,color:C.muted,padding:'6px 0'}}>—</div>:
            <div style={{display:'flex',flexDirection:'column',gap:3}}>{g.arr.map((m,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'3px 6px',borderRadius:5,background:C.surface}}><span style={{color:m.motivo.includes('MARGEM')?C.danger:C.text,fontWeight:m.motivo.includes('MARGEM')?700:400}}>{m.motivo.slice(0,30)}</span><b>{m.n}</b></div>)}</div>}
          </div>)}
        </div>
      </div>}
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
          <div style={{fontSize:12,fontWeight:700}}>💵 Conferência de comissão NEO {cms.length>0&&<span style={{color:C.muted,fontWeight:400}}>· {cms.map(f=>f.nome.slice(0,22)).join(' · ')}</span>}</div>
          <div style={{display:'flex',gap:6}}>
            <input ref={cmsRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)readCms(f);e.target.value=''}}/>
            <button onClick={()=>cmsRef.current?.click()} style={{padding:'6px 12px',borderRadius:7,border:'1px solid '+C.accent,background:C.abg,color:C.accent,fontSize:11,fontWeight:600,cursor:'pointer'}}>📂 Adicionar planilha COMISSAO NEO</button>
            {cms.length>0&&<button onClick={()=>setCms([])} style={{padding:'6px 12px',borderRadius:7,border:'1px solid '+C.border,background:C.surface,color:C.danger,fontSize:11,cursor:'pointer'}}>✕ Limpar</button>}
          </div>
        </div>
        {cms.length>0&&<>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Stat label="Comissão nas planilhas" value={cfMoney(R.cmsTot)} small color={C.accent2}/>
            <Stat label="Concluídas COM comissão" value={R.comCms.length} small color={C.accent2}/>
            <Stat label="Concluídas SEM comissão" value={R.semCms.length} small color={R.semCms.length?C.danger:C.accent2}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div style={{fontSize:11,fontWeight:700,color:C.danger}}>🚨 Concluídas sem comissão na planilha ({R.semCms.length})</div>
                <button onClick={()=>cfExport(R.semCms.map(r=>({proposta:r.proposta,cpf:r.cpf,cliente:r.cliente,data:r.data,valor:r.vr_bruto,situacao:r.situacao})),'neo-concluidas-sem-comissao')} style={{fontSize:9,padding:'3px 8px',borderRadius:5,border:'1px solid '+C.danger,background:'#EF444410',color:C.danger,cursor:'pointer'}}>⬇ Exportar</button>
              </div>
              <div style={{overflowY:'auto',maxHeight:220,borderRadius:8,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse'}}><tbody>
                {R.semCms.slice(0,100).map((r,i)=><tr key={i}><td style={{...td,fontSize:10}}>{r.proposta}</td><td style={{...td,fontSize:10}}>{(r.cliente||'').slice(0,20)}</td><td style={{...td,fontSize:10,fontWeight:600}}>{cfMoney(r.vr_bruto)}</td><td style={{...td,fontSize:10}}>{fmtDate(r.data)}</td></tr>)}
              </tbody></table></div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,marginBottom:4}}>🏆 Comissão por vendedor</div>
              <div style={{overflowY:'auto',maxHeight:220,borderRadius:8,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse'}}><tbody>
                {R.porVend.map((v,i)=><tr key={i}><td style={{...td,fontSize:10,fontWeight:600}}>{(v.key||'').slice(0,26)}</td><td style={{...td,fontSize:10}}>{v.n} props</td><td style={{...td,fontSize:10,fontWeight:700,color:C.accent2}}>{cfMoney(v.v)}</td></tr>)}
              </tbody></table></div>
            </div>
          </div>
        </>}
        {!cms.length&&<div style={{fontSize:11,color:C.muted}}>Suba as planilhas "COMISSAO NEO" (por vendedor) — cruzo por nº de proposta com a esteira e mostro: concluídas sem comissão (cobrar), e o total por vendedor.</div>}
      </div>
    </>}
  </div>
}


/* ═══ CARTÃO PAN — consulta em lote no panconsig ═══ */
function PanCartao(){
  const[rows,setRows]=useState(null),[cfg,setCfg]=useState({}),[busca,setBusca]=useState(''),[f,setF]=useState('sim'),[err,setErr]=useState('')
  const[curl,setCurl]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(''),[filaTot,setFilaTot]=useState(null)
  const load=async()=>{
    const PAGE=1000;let all=[],from=0
    while(true){const{data,error}=await supabase.from('pan_cartao').select('*').range(from,from+PAGE-1)
      if(error){setErr('Erro: '+error.message);break}
      if(!data||!data.length)break
      all=all.concat(data);if(data.length<PAGE)break;from+=PAGE}
    setRows(all)
    const{data:c}=await supabase.from('konsig_config').select('key,value,updated_at').in('key',['pan_run_status','pan_quota','pan_quota_max','pan_max_sessao','pan_sessao_uso','pan_cookie','pan_run_now'])
    if(c){const m={};c.forEach(x=>m[x.key]=x);setCfg(m)}
    const{count}=await supabase.from('pan_base').select('cpf',{count:'exact',head:true})
    setFilaTot(count??null)
  }
  const cfgSet=async rows=>await supabase.from('konsig_config').upsert(rows.map(r=>({...r,updated_at:new Date().toISOString()})),{onConflict:'key'})
  // Cola o cURL do panconsig (F12 → botão direito na requisição → Copiar como cURL) e extrai a sessão
  const salvarSessao=async()=>{
    setMsg('');setBusy('sessao')
    try{
      let t=curl
      // desfaz o escape do cmd do Windows: ^" ^& ^! ^$ ^%^
      t=t.replace(/\^([\s\S])/g,'$1')      // desfaz o escape do cmd: ^" vira ", ^& vira &, ^^ vira ^
      let m=t.match(/(?:-b|--cookie)\s+"([\s\S]*?)"\s*(?:\\?\s*\n|\s+-H|\s+--)/)||t.match(/(?:-b|--cookie)\s+"([\s\S]*?)"/)
      if(!m){setMsg('❌ Não achei o cookie no que você colou. Copie de novo com "Copiar como cURL (cmd)".');setBusy('');return}
      const cookie=m[1].replace(/\s*\n\s*/g,' ').trim()
      const fis=(t.match(/FISession=([A-Za-z0-9]+)/)||[])[1]
      const org=(t.match(/Origem3=(\d+)/)||[])[1]
      const up=[{key:'pan_cookie',value:cookie}]
      if(fis)up.push({key:'pan_fisession',value:fis})
      if(org)up.push({key:'pan_origem',value:org})
      const{error}=await cfgSet(up)
      if(error)setMsg('❌ '+error.message)
      else{setMsg('✅ Sessão salva ('+cookie.length+' caracteres'+(fis?', FISession '+fis:'')+'). Agora clique em ▶️ Rodar agora.');setCurl('');load()}
    }catch(e){setMsg('❌ '+e.message)}
    setBusy('')
  }
  const rodarAgora=async()=>{
    setMsg('');setBusy('rodar')
    const{error}=await cfgSet([{key:'pan_run_now',value:String(Date.now())}])
    setMsg(error?('❌ '+error.message):'✅ Pedido enviado. O robô do escritório começa em até 45 segundos — acompanhe aqui em cima.')
    setBusy('');setTimeout(load,3000)
  }
  // Sobe uma planilha (CSV) pra fila da nuvem — o robô consulta direto de lá, sem depender de arquivo em PC nenhum
  const subirPlanilha=async file=>{
    if(!file)return
    setMsg('');setBusy('upload')
    try{
      const txt=(await file.text()).replace(/^﻿/,'')
      const linhas=txt.split(/\r?\n/).filter(l=>l.trim())
      if(!linhas.length){setMsg('❌ Planilha vazia.');setBusy('');return}
      const sep=(linhas[0].match(/;/g)||[]).length>=(linhas[0].match(/,/g)||[]).length?';':','
      const corta=l=>{const o=[];let c='',a=false;for(const ch of l){if(ch==='"'){a=!a;continue}if(ch===sep&&!a){o.push(c);c='';continue}c+=ch}o.push(c);return o.map(s=>s.trim())}
      const head=corta(linhas[0]).map(h=>h.toUpperCase().replace(/[^A-Z]/g,''))
      const iCpf=head.findIndex(h=>/^CPF/.test(h)),iNome=head.findIndex(h=>/NOME|CLIENTE/.test(h)),iMat=head.findIndex(h=>/MATRICULA/.test(h))
      if(iCpf<0){setMsg('❌ Não achei a coluna CPF. Cabeçalho lido: '+corta(linhas[0]).join(' | '));setBusy('');return}
      const vistos=new Set(),novos=[]
      for(let i=1;i<linhas.length;i++){
        const c=corta(linhas[i]);const cpf=String(c[iCpf]||'').replace(/\D/g,'')
        if(cpf.length<11)continue
        const k=cpf.slice(-11);if(vistos.has(k))continue;vistos.add(k)
        novos.push({cpf:k,nome:iNome>=0?(c[iNome]||'').slice(0,120):null,matricula:iMat>=0?(c[iMat]||'').slice(0,40):null,base:file.name.replace(/\.csv$/i,'').slice(0,60)})
      }
      if(!novos.length){setMsg('❌ Não achei nenhum CPF válido na planilha.');setBusy('');return}
      for(let i=0;i<novos.length;i+=500){
        const{error}=await supabase.from('pan_base').upsert(novos.slice(i,i+500),{onConflict:'cpf'})
        if(error){setMsg('❌ '+error.message);setBusy('');return}
        setMsg('Enviando... '+Math.min(i+500,novos.length)+' de '+novos.length)
      }
      setMsg('✅ '+novos.length.toLocaleString('pt-BR')+' CPFs na fila da nuvem. Cole a sessão e clique em ▶️ Rodar agora.')
      load()
    }catch(e){setMsg('❌ '+e.message)}
    setBusy('')
  }
  useEffect(()=>{load();const t=setInterval(load,20000);return()=>clearInterval(t)},[])
  const J=k=>{try{return JSON.parse(cfg[k]?.value||'{}')}catch{return{}}}
  const run=J('pan_run_status'),quota=J('pan_quota'),uso=J('pan_sessao_uso')
  const QMAX=parseInt(cfg.pan_quota_max?.value||'1000',10),SMAX=parseInt(cfg.pan_max_sessao?.value||'150',10)
  const hojeStr=new Date().toLocaleDateString('sv')
  const usadoHoje=quota.dia===hojeStr?(quota.n||0):0
  const R=useMemo(()=>{
    if(!rows)return null
    const sim=rows.filter(r=>r.tem_cartao==='SIM'),nao=rows.filter(r=>r.tem_cartao==='NAO')
    const emp={};sim.forEach(r=>{const k=r.empregador||'(sem)';emp[k]=(emp[k]||0)+1})
    const st={};sim.forEach(r=>{const k=r.status_cartao||'(sem)';st[k]=(st[k]||0)+1})
    return{sim,nao,emp:Object.entries(emp).sort((a,b)=>b[1]-a[1]),st:Object.entries(st).sort((a,b)=>b[1]-a[1])}
  },[rows])
  const th={padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}
  const td={padding:'7px 10px',fontSize:11,borderBottom:'1px solid '+C.border}
  const fmtC=c=>{const x=String(c||'').replace(/\D/g,'').padStart(11,'0');return x.slice(0,3)+'.'+x.slice(3,6)+'.'+x.slice(6,9)+'-'+x.slice(9)}
  const gov=v=>/GOV SP BENEF/i.test(v||'')
  const lista=useMemo(()=>{
    if(!R)return[]
    let l=f==='sim'?R.sim:f==='nao'?R.nao:rows
    const q=busca.trim().toLowerCase(),qd=q.replace(/\D/g,'')
    if(q)l=l.filter(r=>(r.nome||'').toLowerCase().includes(q)||(qd.length>=3&&String(r.cpf||'').includes(qd))||(r.empregador||'').toLowerCase().includes(q))
    return l
  },[R,rows,f,busca])
  return<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div><h2 style={{fontWeight:800,fontSize:20,margin:0}}>💳 Cartão Pan — consulta em lote</h2>
        <div style={{fontSize:11,color:C.muted,marginTop:2}}>O robô do escritório consulta o panconsig e diz quem tem cartão. Esta tela atualiza sozinha a cada 20s.</div></div>
      <button onClick={load} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+C.border,background:C.surface,color:C.accent,fontSize:11,cursor:'pointer'}}>🔄 Recarregar</button>
    </div>
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
      <div style={{fontSize:12,fontWeight:800,marginBottom:4}}>🎮 Painel de controle</div>
      <div style={{fontSize:11,color:C.muted,marginBottom:12}}>
        Tudo é feito por aqui. <b>1)</b> suba a planilha uma vez · <b>2)</b> cole a sessão do Pan · <b>3)</b> clique em Rodar.
        A sessão do Pan dura cerca de <b>160 consultas</b>, então repita os passos 2 e 3 quando ele parar.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
        <div style={{background:C.surface,border:'1px solid '+C.border,borderRadius:10,padding:12}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>1️⃣ Planilha (fila da nuvem)</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:8}}>
            CSV com coluna <b>CPF</b> (e opcionalmente NOME / MATRICULA). CPF repetido não duplica.
            {filaTot!=null?<> Hoje há <b style={{color:C.accent}}>{filaTot.toLocaleString('pt-BR')}</b> CPFs na fila.</>:null}
          </div>
          <input type="file" accept=".csv,text/csv" disabled={busy==='upload'}
            onChange={e=>{const fl=e.target.files?.[0];e.target.value='';subirPlanilha(fl)}}
            style={{fontSize:10,color:C.muted,width:'100%'}}/>
        </div>
        <div style={{background:C.surface,border:'1px solid '+C.border,borderRadius:10,padding:12}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>2️⃣ Sessão do Pan</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:8}}>
            No panconsig: <b>F12</b> → aba <b>Network</b> → faça 1 consulta de CPF → botão direito na linha <b>UI.SolServicoCartEmitidoV2.aspx</b> → <b>Copiar</b> → <b>Copiar como cURL (cmd)</b>. Cole abaixo.
          </div>
          <textarea value={curl} onChange={e=>setCurl(e.target.value)} placeholder="cole aqui o cURL copiado do panconsig..."
            style={{width:'100%',height:60,fontSize:10,fontFamily:'monospace',padding:8,borderRadius:8,border:'1px solid '+C.border,background:C.card,color:C.text,resize:'vertical',boxSizing:'border-box'}}/>
          <button onClick={salvarSessao} disabled={!curl.trim()||busy==='sessao'}
            style={{marginTop:8,width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid '+C.border,background:curl.trim()?C.accent:C.surface,color:curl.trim()?'#fff':C.muted,fontSize:11,fontWeight:700,cursor:curl.trim()?'pointer':'default'}}>
            {busy==='sessao'?'salvando...':'💾 Salvar sessão'}
          </button>
        </div>
        <div style={{background:C.surface,border:'1px solid '+C.border,borderRadius:10,padding:12,display:'flex',flexDirection:'column'}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>3️⃣ Rodar</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:8,flex:1}}>
            Manda o robô do escritório começar agora, usando a fila da nuvem. Ele respeita a quota do dia e para sozinho quando a sessão cair.
          </div>
          <button onClick={rodarAgora} disabled={busy==='rodar'||run.rodando}
            style={{padding:'10px 12px',borderRadius:8,border:'none',background:run.rodando?C.surface:C.accent2,color:run.rodando?C.muted:'#fff',fontSize:12,fontWeight:800,cursor:run.rodando?'default':'pointer'}}>
            {run.rodando?'● já está rodando':(busy==='rodar'?'enviando...':'▶️ Rodar agora')}
          </button>
        </div>
      </div>
      {msg?<div style={{marginTop:10,fontSize:11,padding:'8px 10px',borderRadius:8,background:C.surface,border:'1px solid '+C.border}}>{msg}</div>:null}
    </div>
    <div style={{background:C.card,border:'1px solid '+C.border,borderLeft:'4px solid '+(run.rodando?C.accent2:C.border),borderRadius:14,padding:14}}>
      <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>
        {run.rodando?<span style={{color:C.accent2}}>● RODANDO AGORA</span>:<span style={{color:C.muted}}>○ parado</span>}
        {run.base?<span style={{color:C.muted,fontWeight:400}}> · base: {run.base}</span>:null}
        {run.em?<span style={{color:C.muted,fontWeight:400,fontSize:10}}> · {new Date(run.em).toLocaleString('pt-BR')}</span>:null}
      </div>
      {run.total?<div style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}>
          <span><b>{(run.feitos||0).toLocaleString('pt-BR')}</b> de <b>{(run.total||0).toLocaleString('pt-BR')}</b> CPFs consultados</span>
          <span style={{color:C.accent}}>{Math.round((run.feitos||0)/(run.total||1)*100)}%</span>
        </div>
        <div style={{height:10,background:C.surface,borderRadius:6,overflow:'hidden',border:'1px solid '+C.border}}>
          <div style={{height:'100%',width:Math.min(100,Math.round((run.feitos||0)/(run.total||1)*100))+'%',background:C.accent2}}/>
        </div>
        <div style={{fontSize:10,color:C.muted,marginTop:4}}>faltam {((run.total||0)-(run.feitos||0)).toLocaleString('pt-BR')} · ~{Math.ceil(((run.total||0)-(run.feitos||0))/QMAX)} dias no ritmo de {QMAX}/dia</div>
      </div>:null}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label='Consultas hoje' value={usadoHoje+'/'+QMAX} sub={usadoHoje>=QMAX?'limite do dia atingido':'restam '+(QMAX-usadoHoje)} small color={usadoHoje>=QMAX?C.warn:C.accent2}/>
        <Stat label='Nesta sessão' value={(uso.n||0)+'/'+SMAX} sub={(uso.n||0)>=SMAX?'precisa de sessão nova':'restam '+(SMAX-(uso.n||0))} small color={(uso.n||0)>=SMAX?C.danger:C.text}/>
        <Stat label='Velocidade' value='~9 min' sub='a cada 150 CPFs' small/>
      </div>
    </div>
    {err&&<div style={{background:'#EF444418',color:C.danger,padding:'10px 14px',borderRadius:8,fontSize:12}}>{err}</div>}
    {!rows&&<div style={{padding:30,textAlign:'center',color:C.muted}}>Carregando...</div>}
    {R&&<>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label='Total consultado' value={rows.length.toLocaleString('pt-BR')}/>
        <Stat label='✅ TEM cartão' value={R.sim.length.toLocaleString('pt-BR')} sub={rows.length?Math.round(R.sim.length/rows.length*100)+'% da base':''} color={C.accent2}/>
        <Stat label='⚪ NÃO tem' value={R.nao.length.toLocaleString('pt-BR')} color={C.muted}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🏛️ Cartões por convênio</div>
          {R.emp.map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'4px 8px',borderRadius:6,background:C.surface,marginBottom:3}}>
            <span style={{fontWeight:gov(k)?700:400,color:gov(k)?C.accent:C.text}}>{k}</span><b>{v}</b></div>)}
        </div>
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>💳 Situação do cartão</div>
          {R.st.map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'4px 8px',borderRadius:6,background:C.surface,marginBottom:3}}>
            <span style={{color:/Bloquead/i.test(k)?C.warn:C.accent2}}>{k}</span><b>{v}</b></div>)}
        </div>
      </div>
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
          <div style={{fontSize:13,fontWeight:800}}>📋 Clientes — {lista.length.toLocaleString('pt-BR')}</div>
          <button onClick={()=>cfExport(lista.map(r=>({cpf:fmtC(r.cpf),nome:r.nome,tem_cartao:r.tem_cartao,convenio:r.empregador,status:r.status_cartao,situacao:r.situacao_cartao,limite:r.limite_disponivel,matricula:r.matricula,cartao:r.numero_cartao})),'pan-cartao-'+f)} style={{fontSize:11,padding:'6px 12px',borderRadius:7,border:'1px solid '+C.accent,background:C.abg,color:C.accent,fontWeight:600,cursor:'pointer'}}>⬇ Exportar {lista.length}</button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder='🔍 buscar por nome, CPF ou convênio' style={{flex:1,minWidth:220,background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'8px 12px',fontSize:12,outline:'none'}}/>
          <div style={{display:'flex',gap:4}}>{[{id:'sim',l:'✅ Com cartão'},{id:'nao',l:'⚪ Sem cartão'},{id:'todos',l:'Todos'}].map(x=><button key={x.id} onClick={()=>setF(x.id)} style={{padding:'6px 12px',borderRadius:8,border:'1px solid '+(f===x.id?C.accent:C.border),background:f===x.id?C.abg:'transparent',color:f===x.id?C.accent:C.muted,fontSize:11,cursor:'pointer',fontWeight:f===x.id?700:400}}>{x.l}</button>)}</div>
        </div>
        <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border,maxHeight:520,overflowY:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['CPF','Cliente','Cartão?','Convênio','Status','Situação','Limite','Matrícula'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
          {lista.slice(0,500).map((r,i)=><tr key={i}>
            <td style={{...td,fontSize:10}}>{fmtC(r.cpf)}</td>
            <td style={{...td,fontWeight:600}}>{(r.nome||'—').slice(0,26)}</td>
            <td style={{...td,fontWeight:700,color:r.tem_cartao==='SIM'?C.accent2:C.muted}}>{r.tem_cartao==='SIM'?'✅ SIM':r.tem_cartao==='NAO'?'—':r.tem_cartao}</td>
            <td style={{...td,fontSize:10,fontWeight:gov(r.empregador)?700:400,color:gov(r.empregador)?C.accent:C.text}}>{r.empregador||'—'}</td>
            <td style={{...td,fontSize:10,color:/Bloquead/i.test(r.status_cartao||'')?C.warn:C.text}}>{r.status_cartao||'—'}</td>
            <td style={{...td,fontSize:10,color:C.muted}}>{(r.situacao_cartao||'—').slice(0,28)}</td>
            <td style={{...td,fontSize:10}}>{r.limite_disponivel||'—'}</td>
            <td style={{...td,fontSize:10,color:C.muted}}>{r.matricula||'—'}</td>
          </tr>)}
        </tbody></table></div>
        {lista.length>500&&<div style={{fontSize:10,color:C.muted}}>Mostrando 500 de {lista.length} — refine a busca ou exporte.</div>}
      </div>
    </>}
  </div>
}

/* ═══ MAIN APP ═══ */
export default function App(){
  const[user,setUser]=useState(null),[view,setView]=useState('dashboard'),[loginError,setLoginError]=useState('')
  const[curOps,setCurOps]=useState([]),[prevOps,setPrevOps]=useState([])
  const[curProd,setCurProd]=useState([]),[prevProd,setPrevProd]=useState([])
  const[prevProdProp,setPrevProdProp]=useState([])
  const[m2Prop,setM2Prop]=useState([]),[m3Prop,setM3Prop]=useState([])
  const[prodYear,setProdYear]=useState([])
  const[myAgents,setMyAgents]=useState(null)
  const[refreshKey,setRefreshKey]=useState(0)
  const refreshAll=()=>setRefreshKey(k=>k+1)
  // Fast dashboard data via RPC
  const[dash,setDash]=useState(null)
  const[dailyData,setDailyData]=useState([])
  const[monthlyData,setMonthlyData]=useState([])
  const[bizDays,setBizDays]=useState([]) // last 5 business days
  const[propComp,setPropComp]=useState({})
  const[weekCur,setWeekCur]=useState([])
  const[weekPrev,setWeekPrev]=useState([])
  const[bankWeekCur,setBankWeekCur]=useState([])
  const[bankWeekPrev,setBankWeekPrev]=useState([])
  const[bankMonthly,setBankMonthly]=useState([])
  useEffect(()=>{try{const s=localStorage.getItem('om-session');if(s){const u=JSON.parse(s);if(u?.nome){setUser(u);
    // Refresh dos campos críticos do banco (corrige cache stale: cod_supervisor, telas, perfil, parceiro_id)
    supabase.from('usuarios').select('cod_supervisor,telas,perfil,parceiro_id,ativo').eq('id',u.id).single().then(({data})=>{
      if(data&&data.ativo!==false){
        const fresh={...u,cod_supervisor:data.cod_supervisor||'',telas:data.telas||u.telas,perfil:data.perfil||u.perfil,parceiro_id:data.parceiro_id||null}
        if(JSON.stringify(fresh)!==JSON.stringify(u)){
          localStorage.setItem('om-session',JSON.stringify(fresh))
          setUser(fresh)
        }
      }
    })
  }}}catch(e){}},[])
  // Se parceiro logado, força view=meuportal
  useEffect(()=>{if(user?.perfil==='parceiro'&&view!=='meuportal')setView('meuportal')},[user,view])
  useEffect(()=>{if(!user)return
    if(user.cod_supervisor){
      // Inclui agentes sob o supervisor + o próprio supervisor (parceiro com cod_agente=cod_supervisor)
      supabase.from('parceiros').select('nome').or(`cod_supervisor.eq.${user.cod_supervisor},cod_agente.eq.${user.cod_supervisor}`).then(({data})=>{
        if(data&&data.length)setMyAgents(new Set(data.map(p=>p.nome)))
      })
    }
    const now=new Date(),y=now.getFullYear(),mo=now.getMonth(),day=now.getDate()
    const mesF=localDate(new Date(y,mo,1)),mesT=localDate(new Date(y,mo+1,0))
    const antF=localDate(new Date(y,mo-1,1)),antT=localDate(new Date(y,mo,0))
    const todayStr=localDate(now)
    const yest=new Date(now);yest.setDate(yest.getDate()-1);const yesterdayStr=localDate(yest)
    // ⚠ Visão restrita por supervisor (Fabricio/NEWS): pula RPCs agregadas (sem filtro de agente)
    // O Dashboard usa fallback dos arrays brutos (já filtrados via myAgents)
    const isRestrita=!!user.cod_supervisor
    // 1. Dashboard summary — 1 query
    if(!isRestrita)supabase.rpc('dashboard_summary',{dt_from:mesF,dt_to:mesT,prev_from:antF,prev_to:antT}).then(({data,error})=>{
      if(!error&&data)setDash(typeof data==='string'?JSON.parse(data):data)
    })
    // 2. Digitações diárias — 1 query
    const d30=new Date(now);d30.setDate(d30.getDate()-30)
    if(!isRestrita)supabase.rpc('daily_stats',{dt_from:localDate(d30),dt_to:todayStr}).then(({data,error})=>{if(!error&&data)setDailyData(data)})
    // 3. Produção 12 meses — 1 query
    const y12f=localDate(new Date(y,mo-11,1))
    if(!isRestrita)supabase.rpc('monthly_prod',{dt_from:y12f,dt_to:mesT}).then(({data,error})=>{if(!error&&data)setMonthlyData(data)})
    // 4. Últimos 5 dias úteis (skip se visão restrita — RPC não filtra agente)
    if(!isRestrita){
      const loadBizDays=async()=>{
        const days=[],d=new Date(now)
        while(days.length<5){
          if(d.getDay()!==0&&d.getDay()!==6)days.push(localDate(d))
          d.setDate(d.getDate()-1)
        }
        const results=[]
        for(const dt of days){
          const{data,error}=await supabase.rpc('day_detail',{target_date:dt})
          if(!error&&data){const p=typeof data==='string'?JSON.parse(data):data;results.push({date:dt,...p})}
          else results.push({date:dt,total_dig:0,total_val:0,parceiros:0,top_parceiros:null,top_bancos:null})
        }
        setBizDays(results)
      }
      loadBizDays()
    }
    // 5. Análise semanal — semana atual vs anterior (filtramos por myAgents pós-RPC)
    const loadWeek=async()=>{
      const dow=now.getDay()||7 // 1=seg..7=dom
      const wStart=new Date(now);wStart.setDate(now.getDate()-(dow-1))
      const wEnd=new Date(now)
      const pwStart=new Date(wStart);pwStart.setDate(pwStart.getDate()-7)
      const pwEnd=new Date(wStart);pwEnd.setDate(pwEnd.getDate()-1)
      const{data:d1}=await supabase.rpc('agent_period_stats',{dt_from:localDate(wStart),dt_to:localDate(wEnd)})
      const{data:d2}=await supabase.rpc('agent_period_stats',{dt_from:localDate(pwStart),dt_to:localDate(pwEnd)})
      if(d1)setWeekCur(d1)
      if(d2)setWeekPrev(d2)
    }
    loadWeek()
    // 6. Bancos — semanal + mensal (skip se restrita: RPC bank_stats não filtra agente)
    if(!isRestrita){
      const loadBanks=async()=>{
        const dow=now.getDay()||7
        const wStart=new Date(now);wStart.setDate(now.getDate()-(dow-1))
        const wEnd=new Date(now)
        const pwStart=new Date(wStart);pwStart.setDate(pwStart.getDate()-7)
        const pwEnd=new Date(wStart);pwEnd.setDate(pwEnd.getDate()-1)
        const{data:bw1}=await supabase.rpc('bank_stats',{dt_from:localDate(wStart),dt_to:localDate(wEnd)})
        const{data:bw2}=await supabase.rpc('bank_stats',{dt_from:localDate(pwStart),dt_to:localDate(pwEnd)})
        if(bw1)setBankWeekCur(bw1)
        if(bw2)setBankWeekPrev(bw2)
        const m6f=localDate(new Date(y,mo-5,1))
        const{data:bm}=await supabase.rpc('bank_monthly',{dt_from:m6f,dt_to:mesT})
        if(bm)setBankMonthly(bm)
      }
      loadBanks()
    }
    // 5. Comparativo proporcional (skip se restrita)
    if(!isRestrita){
      const loadComp=async()=>{
        const comp={}
        for(let i=1;i<=3;i++){
          const mDate=localDate(new Date(y,mo-i,1))
          const{data,error}=await supabase.rpc('prod_proporcional',{target_month:mDate,ate_dia:day})
          if(!error&&data)comp['m'+i]=typeof data==='string'?JSON.parse(data):data
        }
        setPropComp(comp)
      }
      loadComp()
    }
    // Legacy — carrega dados brutos para outras telas
    fetchOps('mes').then(d=>setCurOps(d))
    fetchOps('ant').then(d=>setPrevOps(d))
    fetchProd('mes').then(d=>setCurProd(d))
    fetchProd('ant').then(d=>setPrevProd(d))
    // Modo restrito: popula 12 meses para cálculos locais (RPCs agregadas não filtram agente)
    if(isRestrita){
      const m12f=localDate(new Date(y,mo-11,1))
      const m1f=localDate(new Date(y,mo-1,1)),m1t=localDate(new Date(y,mo,0))
      const m2f=localDate(new Date(y,mo-2,1)),m2t=localDate(new Date(y,mo-1,0))
      const m3f=localDate(new Date(y,mo-3,1)),m3t=localDate(new Date(y,mo-2,0))
      fetchProd('custom',null,m12f,mesT).then(d=>setProdYear(d))
      // Comparativos proporcionais — fetchProd até o mesmo dia do mês
      fetchProd('custom',null,m1f,localDate(new Date(y,mo-1,Math.min(day,new Date(y,mo,0).getDate())))).then(d=>setPrevProdProp(d))
      fetchProd('custom',null,m2f,localDate(new Date(y,mo-2,Math.min(day,new Date(y,mo-1,0).getDate())))).then(d=>setM2Prop(d))
      fetchProd('custom',null,m3f,localDate(new Date(y,mo-3,Math.min(day,new Date(y,mo-2,0).getDate())))).then(d=>setM3Prop(d))
    }
  },[user,refreshKey])
  // Filter by team - stable refs when no filter
  const tCurOps=myAgents?curOps.filter(o=>myAgents.has(o.agente)):curOps
  const tPrevOps=myAgents?prevOps.filter(o=>myAgents.has(o.agente)):prevOps
  const tCurProd=myAgents?curProd.filter(o=>myAgents.has(o.agente)):curProd
  const tPrevProd=myAgents?prevProd.filter(o=>myAgents.has(o.agente)):prevProd
  const tPrevProdProp=myAgents?prevProdProp.filter(o=>myAgents.has(o.agente)):prevProdProp
  const tM2Prop=myAgents?m2Prop.filter(o=>myAgents.has(o.agente)):m2Prop
  const tM3Prop=myAgents?m3Prop.filter(o=>myAgents.has(o.agente)):m3Prop
  const tProdYear=myAgents?prodYear.filter(o=>myAgents.has(o.agente)):prodYear
  // Filtra retornos de agent_period_stats (weekCur/weekPrev) por agentes do supervisor
  const tWeekCur=myAgents?weekCur.filter(r=>myAgents.has(r.agente||r.nome)):weekCur
  const tWeekPrev=myAgents?weekPrev.filter(r=>myAgents.has(r.agente||r.nome)):weekPrev
  // Modo restrito: agrega localmente os dados que viriam das RPCs
  const tMonthlyData=useMemo(()=>{
    if(!myAgents||monthlyData.length>0)return monthlyData
    const byMes={}
    tProdYear.forEach(o=>{const mes=(o.crcCliente||o.data||'').slice(0,7);if(!mes)return;if(!byMes[mes])byMes[mes]={mes,qtd:0,total:0};byMes[mes].qtd++;byMes[mes].total+=(o.vrBruto||0)})
    return Object.values(byMes).sort((a,b)=>a.mes.localeCompare(b.mes))
  },[myAgents,monthlyData,tProdYear])
  const tBankMonthly=useMemo(()=>{
    if(!myAgents||bankMonthly.length>0)return bankMonthly
    const byMB={}
    const now=new Date(),y=now.getFullYear(),mo=now.getMonth()
    const m6=new Date(y,mo-5,1)
    tProdYear.forEach(o=>{const dt=new Date((o.crcCliente||o.data||'')+'T00:00:00');if(dt<m6||isNaN(dt))return;const mes=localDate(dt).slice(0,7);const banco=o.banco||'?';const k=mes+'|'+banco;if(!byMB[k])byMB[k]={mes,banco,dig_total:0,qtd:0};byMB[k].dig_total+=(o.vrBruto||0);byMB[k].qtd++})
    return Object.values(byMB)
  },[myAgents,bankMonthly,tProdYear])
  const tBankWeek=useMemo(()=>{
    if(!myAgents)return{cur:bankWeekCur,prev:bankWeekPrev}
    const now=new Date(),dow=now.getDay()||7
    const wStart=new Date(now);wStart.setDate(now.getDate()-(dow-1));wStart.setHours(0,0,0,0)
    const pwStart=new Date(wStart);pwStart.setDate(pwStart.getDate()-7)
    const pwEnd=new Date(wStart);pwEnd.setDate(pwEnd.getDate()-1);pwEnd.setHours(23,59,59,999)
    const agg=(arr)=>{const m={};arr.forEach(o=>{const b=o.banco||'?';if(!m[b])m[b]={banco:b,dig_count:0,dig_total:0};m[b].dig_count++;m[b].dig_total+=(o.vrBruto||0)});return Object.values(m)}
    const inRange=(o,a,b)=>{const dt=new Date((o.data||'')+'T00:00:00');return dt>=a&&dt<=b}
    const cur=agg(tCurOps.filter(o=>{const dt=new Date((o.data||'')+'T00:00:00');return dt>=wStart&&dt<=now}))
    const prev=agg([...tCurOps,...tPrevOps].filter(o=>inRange(o,pwStart,pwEnd)))
    return{cur,prev}
  },[myAgents,bankWeekCur,bankWeekPrev,tCurOps,tPrevOps])
  const tPropComp=useMemo(()=>{
    if(!myAgents||Object.keys(propComp).length>0)return propComp
    return{
      m1:{total:tPrevProdProp.reduce((s,o)=>s+(o.vrBruto||0),0),qtd:tPrevProdProp.length},
      m2:{total:tM2Prop.reduce((s,o)=>s+(o.vrBruto||0),0),qtd:tM2Prop.length},
      m3:{total:tM3Prop.reduce((s,o)=>s+(o.vrBruto||0),0),qtd:tM3Prop.length}
    }
  },[myAgents,propComp,tPrevProdProp,tM2Prop,tM3Prop])

  async function handleLogin(e){e.preventDefault();setLoginError('');const fd=new FormData(e.target);const{data,error}=await supabase.from('usuarios').select('*').eq('email',fd.get('email')).eq('senha',fd.get('senha')).eq('ativo',true).single();if(error||!data){setLoginError('Email/senha incorretos');return}supabase.from('usuarios').update({ultimo_acesso:new Date().toISOString()}).eq('id',data.id).then(()=>{});const session={id:data.id,nome:data.nome,email:data.email,perfil:data.perfil,telas:data.telas||["dashboard","ops","producao"],cod_supervisor:data.cod_supervisor||'',parceiro_id:data.parceiro_id||null};localStorage.setItem('om-session',JSON.stringify(session));setUser(session)}
  async function handleImport(batch){
    const rows=batch.map(toDb)
    // Usa stored procedure — executa direto no PostgreSQL, sem limite REST
    const{data,error}=await supabase.rpc('import_digitacoes',{rows})
    if(error){
      console.error('RPC import err:',error.message,'— fallback upsert')
      // Fallback: upsert em chunks de 20
      for(let i=0;i<rows.length;i+=20){
        const chunk=rows.slice(i,i+20)
        const{error:e2}=await supabase.from('digitacoes').upsert(chunk,{onConflict:'proposta,banco',ignoreDuplicates:false})
        if(e2)for(const row of chunk){await supabase.from('digitacoes').upsert([row],{onConflict:'proposta,banco',ignoreDuplicates:false})}
        if(i+20<rows.length)await new Promise(r=>setTimeout(r,100))
      }
    }else{
      const r=typeof data==='string'?JSON.parse(data):data
      if(r?.fail>0)console.warn(`Import: ${r.ok} ok, ${r.fail} falhas`)
    }
  }

  if(!user)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:C.bg,fontFamily:'Outfit,sans-serif',color:C.text}}><form onSubmit={handleLogin} style={{background:C.card,border:'1px solid '+C.border,borderRadius:20,padding:'40px 36px',width:'95%',maxWidth:380}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}><div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,'+C.accent+','+C.accent2+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff'}}>O</div><h1 style={{fontSize:22,fontWeight:800,margin:0}}>OpsManager</h1></div><p style={{color:C.muted,fontSize:12,marginBottom:24}}>Gestão de Digitações</p>{loginError&&<div style={{background:'#EF444418',color:C.danger,padding:'8px 12px',borderRadius:8,fontSize:12,marginBottom:12}}>{loginError}</div>}<div style={{marginBottom:8}}><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>EMAIL</label><input name="email" type="email" required placeholder="seu@email.com" style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'10px 12px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'Outfit,sans-serif'}}/></div><div style={{marginBottom:16}}><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>SENHA</label><input name="senha" type="password" required placeholder="Sua senha" style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'10px 12px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'Outfit,sans-serif'}}/></div><button type="submit" style={{width:'100%',padding:'12px 0',fontSize:14,borderRadius:10,border:'none',background:C.accent,color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>Entrar</button></form></div>

  const PARCEIRO_NAV=[{id:'meuportal',l:'Meu Portal',i:'👤'}]
  const levels={operador:1,gestor:2,admin:3,parceiro:0}
  const nav=user.perfil==='parceiro'?PARCEIRO_NAV:NAV.filter(n=>{if(user.perfil==='admin')return true;return(user.telas||['dashboard','ops','producao']).includes(n.id)})
  return<div style={{display:'flex',minHeight:'100vh',fontFamily:'Outfit,sans-serif',color:C.text,background:C.bg}}>
    {/* SIDEBAR */}
    <div className="sidebar" style={{width:195,background:C.card,borderRight:'1px solid '+C.border,display:'flex',flexDirection:'column',flexShrink:0}}>
      <div style={{padding:'20px 14px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <div style={{width:26,height:26,borderRadius:7,background:'linear-gradient(135deg,'+C.accent+','+C.accent2+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>O</div>
          <h1 style={{fontSize:14,fontWeight:800,margin:0}}>OpsManager</h1>
        </div>
        <div style={{fontSize:8,color:C.accent2,marginTop:4,marginLeft:33}}>● Supabase</div>
      </div>
      <nav style={{flex:1,padding:'2px 7px',overflowY:'auto'}}>{nav.map(n=><button key={n.id} onClick={()=>setView(n.id)} style={{display:'flex',alignItems:'center',gap:7,width:'100%',padding:'7px 9px',marginBottom:1,borderRadius:7,border:'none',background:view===n.id?C.abg:'transparent',color:view===n.id?C.accent:C.muted,fontFamily:'Outfit,sans-serif',fontSize:11,fontWeight:view===n.id?600:400,cursor:'pointer',textAlign:'left'}}><span style={{fontSize:13}}>{n.i}</span>{n.l}</button>)}</nav>
      <div style={{padding:'10px 14px',borderTop:'1px solid '+C.border}}><div style={{fontSize:11,fontWeight:600}}>{user.nome}</div><div style={{fontSize:9,color:C.muted,marginBottom:2}}>{user.perfil}{user.cod_supervisor?' · Equipe':''}</div>{myAgents&&<div style={{fontSize:8,color:C.accent,marginBottom:2}}>👥 {myAgents.size} parceiros</div>}<div style={{display:'flex',gap:8}}><button onClick={refreshAll} style={{fontSize:9,color:C.accent,background:'none',border:'none',cursor:'pointer',padding:0}}>🔄 Atualizar</button><button onClick={()=>{localStorage.removeItem('om-session');setUser(null)}} style={{fontSize:9,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Sair →</button></div></div>
    </div>
    {/* CONTENT */}
    <div className="main-content" style={{flex:1,padding:'20px 24px',overflowY:'auto',overflowX:'hidden'}}>
      {view==='dashboard'&&<Dashboard curOps={tCurOps} prevOps={tPrevOps} curProd={tCurProd} prevProd={tPrevProd} prevProdProp={tPrevProdProp} m2Prop={tM2Prop} m3Prop={tM3Prop} myAgents={myAgents} prodYear={tProdYear} dash={dash} dailyData={dailyData} monthlyData={myAgents?tMonthlyData:monthlyData} bizDays={bizDays} propComp={myAgents?{}:propComp} weekCur={tWeekCur} weekPrev={tWeekPrev} bankWeekCur={myAgents?tBankWeek.cur:bankWeekCur} bankWeekPrev={myAgents?tBankWeek.prev:bankWeekPrev} bankMonthly={myAgents?tBankMonthly:bankMonthly}/>}
      {view==='ops'&&<Operacoes onImport={handleImport} myAgents={myAgents} onDone={refreshAll}/>}
      {view==='producao'&&<Producao myAgents={myAgents}/>}
      {view==='analise'&&<Analise myAgents={myAgents}/>}
      {view==='estrategico'&&<Estrategico myAgents={myAgents}/>}
      {view==='ranking'&&<Ranking myAgents={myAgents}/>}
      {view==='portabilidade'&&<Portabilidade myAgents={myAgents}/>}
      {view==='consig360'&&<Consig360 user={user}/>}
      {view==='notificacoes'&&<Notificacoes/>}
      {view==='meuportal'&&(user.parceiro_id?<Portabilidade filterParceiroId={user.parceiro_id} user={user}/>:<div style={{padding:40,textAlign:'center',color:C.muted}}>⚠️ Seu usuário não está vinculado a um parceiro. Contate o administrador.</div>)}
      {view==='recebimentos'&&<Recebimentos myAgents={myAgents}/>}
      {view==='alertas'&&<Alertas curOps={tCurOps} prevOps={tPrevOps} curProd={tCurProd} prevProd={tPrevProd}/>}
      {view==='parceiros'&&<Parceiros curOps={tCurOps} curProd={tCurProd} myAgents={myAgents}/>}
      
      
      {view==='neocompra'&&<EsteiraCompra/>}
      {view==='pancartao'&&<PanCartao/>}
      {view==='workbank'&&<WorkBankExport/>}
      {view==='usuarios'&&<Usuarios user={user}/>}
    </div>
  </div>
}
