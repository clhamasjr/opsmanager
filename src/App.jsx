import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'
import * as XLSX from 'xlsx'

/* ═══ THEME ═══ */
const C={bg:'#0A0E17',surface:'#0F1520',card:'#141B2B',border:'#1C2538',text:'#DAE0ED',muted:'#5B6B85',accent:'#3B82F6',accent2:'#10B981',warn:'#F59E0B',danger:'#EF4444',info:'#38BDF8',abg:'#3B82F622'}
const NOW=new Date(),CUR_M=NOW.toISOString().slice(0,7),PREV_M=new Date(NOW.getFullYear(),NOW.getMonth()-1,1).toISOString().slice(0,7)

/* ═══ UTILS ═══ */
const fmtCur=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDate=d=>{if(!d)return'—';const p=String(d).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:d}
const isFin=o=>['FINALIZADO','PAGO','AVERBADO','CONCRETIZADO','PAGO C/ PENDENCIA','PAGO C/ PENDÊNCIA','FINALIZADO / PAGO','PAGO AO CLIENTE','PAGO - CRÉDITO ENVIADO'].includes((o.situacaoBanco||'').toUpperCase())
const isEst=o=>['ESTORNADO','CANCELADO','CANCELADA','RECUSADA','REPROVADA','REPROVADO','NEGADO','NEGADA','PROPOSTA REPROVADA','CANCELADO PELO CLIENTE'].includes((o.situacao||'').toUpperCase())
const isPend=o=>!isFin(o)&&!isEst(o)
const sitCol=s=>{s=(s||'').toUpperCase();if(['FINALIZADO','PAGO','AVERBADO','APROVADO','CONCRETIZADO'].includes(s))return C.accent2;if(['ESTORNADO','CANCELADO','CANCELADA','RECUSADA','REPROVADA'].includes(s))return C.danger;if(['EM ANÁLISE','PENDENTE','ANALISE BANCO'].includes(s))return C.warn;return C.info}
function nDate(v){if(!v)return'';if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400*1000));return!isNaN(d.getTime())?d.toISOString().split('T')[0]:''}const s=String(v).trim(),m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);if(m)return(m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);return''}
function pNum(v){if(v==null||v==='')return 0;if(typeof v==='number')return v;return parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.'))||0}
const fixDate=v=>{if(!v)return'';const s=String(v).trim();return s.length>=10&&s[4]==='-'?s.slice(0,10):s}
const fromDb=r=>({id:r.id,id_ext:r.id_ext||'',banco:r.banco||'',cpf:r.cpf||'',cliente:r.cliente||'',proposta:r.proposta||'',contrato:r.contrato||'',data:fixDate(r.data),prazo:r.prazo||'',vrBruto:Number(r.vr_bruto)||0,vrParcela:Number(r.vr_parcela)||0,vrLiquido:Number(r.vr_liquido)||0,vrRepasse:Number(r.vr_repasse)||0,vrSeguro:Number(r.vr_seguro)||0,taxa:r.taxa||'',operacao:r.operacao||'',situacao:r.situacao||'',produto:r.produto||'',convenio:r.convenio||'',agente:r.agente||'',situacaoBanco:r.situacao_banco||'',obsSituacao:r.obs_situacao||'',usuario:r.usuario||'',crcCliente:fixDate(r.crc_cliente),dataNossoCredito:fixDate(r.data_nosso_credito)})
const toDb=o=>({id_ext:o.id_ext||'',banco:o.banco||'',cpf:o.cpf||'',cliente:o.cliente||'',proposta:o.proposta||'',contrato:o.contrato||'',data:o.data||null,prazo:o.prazo||'',vr_bruto:o.vrBruto||0,vr_parcela:o.vrParcela||0,vr_liquido:o.vrLiquido||0,vr_repasse:o.vrRepasse||0,vr_seguro:o.vrSeguro||0,taxa:o.taxa||'',operacao:o.operacao||'',situacao:o.situacao||'',produto:o.produto||'',convenio:o.convenio||'',agente:o.agente||'',situacao_banco:o.situacaoBanco||'',obs_situacao:o.obsSituacao||'',usuario:o.usuario||'',crc_cliente:o.crcCliente||null,data_nosso_credito:o.dataNossoCredito||null})

/* ═══ PERIODS ═══ */
const PERIODS=(()=>{const y=NOW.getFullYear(),m=NOW.getMonth(),d=(a,b)=>new Date(a,b,1).toISOString().split('T')[0],e=(a,b)=>new Date(a,b+1,0).toISOString().split('T')[0];return{mes:{n:'Mês Atual',f:d(y,m),t:e(y,m)},ant:{n:'Mês Anterior',f:d(y,m-1),t:e(y,m-1)},tri:{n:'Trimestre',f:d(y,m-2),t:e(y,m)},sem:{n:'Semestre',f:d(y,m-5),t:e(y,m)},ano:{n:String(y),f:y+'-01-01',t:y+'-12-31'},tudo:{n:'Tudo',f:'2000-01-01',t:'2099-12-31'}}})()

/* ═══ SERVER-SIDE FETCH ═══ */
async function fetchOps(per,onProgress){
  const r=PERIODS[per]||PERIODS.tudo;const PAGE=1000;let all=[],from=0
  while(true){
    let q=supabase.from('digitacoes').select('*').range(from,from+PAGE-1)
    if(per!=='tudo')q=q.gte('data',r.f).lte('data',r.t)
    const{data,error}=await q
    if(error||!data||data.length===0)break
    all=all.concat(data);if(onProgress)onProgress(all.length)
    if(data.length<PAGE)break;from+=PAGE
  }
  return all.map(fromDb)
}

/* ═══ BUSINESS DAYS ═══ */
function countBD(s,e){let c=0;const d=new Date(s);while(d<=e){if(d.getDay()!==0&&d.getDay()!==6)c++;d.setDate(d.getDate()+1)}return c}
function getProj(ops){const y=NOW.getFullYear(),m=NOW.getMonth(),f=new Date(y,m,1),l=new Date(y,m+1,0),ye=new Date(NOW);ye.setDate(ye.getDate()-1);const duT=countBD(f,l),duP=countBD(f,ye<f?f:ye),duR=duT-duP,mo=ops.filter(o=>o.data&&o.data.startsWith(CUR_M)),rep=mo.reduce((s,o)=>s+(o.vrRepasse||0),0),dig=mo.length,mdR=duP>0?rep/duP:0,mdD=duP>0?dig/duP:0,fin=mo.filter(isFin),fR=fin.reduce((s,o)=>s+(o.vrRepasse||0),0);return{duT,duP,duR,rep,dig,mdR,mdD,pR:mdR*duT,pD:Math.round(mdD*duT),fR,fC:fin.length}}

/* ═══ UI ATOMS ═══ */
function Stat({label,value,sub,color,small}){return<div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:small?'10px 12px':'14px 16px',flex:1,minWidth:small?90:120}}><div style={{fontSize:small?8:9,color:C.muted,marginBottom:3,fontWeight:600,textTransform:'uppercase'}}>{label}</div><div style={{fontSize:small?14:18,fontWeight:700,color:color||C.text}}>{value}</div>{sub&&<div style={{fontSize:small?9:10,color:C.muted,marginTop:2}}>{sub}</div>}</div>}
function Badge({text,color}){return<span style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:color+'22',color,fontWeight:600}}>{text}</span>}
function PeriodBar({per,setPer,loading}){return<div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6,alignItems:'center'}}>{Object.entries(PERIODS).map(([k,v])=><button key={k} onClick={()=>setPer(k)} disabled={loading} style={{padding:'5px 12px',borderRadius:6,fontFamily:'Outfit,sans-serif',fontSize:10,border:'1px solid '+(per===k?C.accent:C.border),background:per===k?C.abg:'transparent',color:per===k?C.accent:C.muted,fontWeight:per===k?700:400,cursor:loading?'wait':'pointer',opacity:loading?.5:1}}>{v.n}</button>)}{loading&&<span style={{fontSize:10,color:C.warn,marginLeft:8}}>⏳</span>}</div>}

/* ═══ EXPORT XLSX ═══ */
function exportXlsx(ops,filename){
  const ws=XLSX.utils.json_to_sheet(ops.map(o=>({Data:o.data,Banco:o.banco,CPF:o.cpf,Cliente:o.cliente,Proposta:o.proposta,'Operação':o.operacao,'Situação':o.situacao,'Sit.Banco':o.situacaoBanco,'Convênio':o.convenio,Agente:o.agente,Repasse:o.vrRepasse,Bruto:o.vrBruto,Líquido:o.vrLiquido,Parcela:o.vrParcela,CRC:o.crcCliente,'Nosso Crédito':o.dataNossoCredito})))
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Dados');XLSX.writeFile(wb,filename+'.xlsx')
}
function ExportBtn({ops,name}){return<button onClick={()=>exportXlsx(ops,name||'export')} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'6px 14px',cursor:'pointer',fontWeight:600,fontSize:11}}>📤 Exportar ({ops.length})</button>}

/* ═══ HOOK: useOps ═══ */
function useOps(defaultPer){
  const[per,setPer]=useState(defaultPer||'mes'),[ops,setOps]=useState([]),[loading,setLoading]=useState(false),[count,setCount]=useState(0)
  useEffect(()=>{let c=false;setLoading(true);fetchOps(per,n=>{if(!c)setCount(n)}).then(d=>{if(!c){setOps(d);setCount(d.length)}}).catch(()=>{}).finally(()=>{if(!c)setLoading(false)});return()=>{c=true}},[per])
  return{per,setPer,ops,loading,count}
}

/* ═══ IMPORT MODAL ═══ */
const IMP={id_ext:{l:'ID',a:['id']},banco:{l:'Banco',a:['banco']},cpf:{l:'CPF',a:['cpf']},cliente:{l:'Cliente',a:['cliente','nome']},proposta:{l:'Proposta',a:['proposta']},contrato:{l:'Contrato',a:['contrato']},data:{l:'Data',a:['data']},prazo:{l:'Prazo',a:['prazo']},vrBruto:{l:'Bruto',a:['vr. bruto','bruto']},vrParcela:{l:'Parcela',a:['vr. parcela']},vrLiquido:{l:'Líquido',a:['vr. líquido','vr liquido']},vrRepasse:{l:'Repasse',a:['vr. repasse','repasse']},vrSeguro:{l:'Seguro',a:['vr. seguro']},taxa:{l:'Taxa',a:['taxa']},operacao:{l:'Operação',a:['operação','operacao']},situacao:{l:'Situação',a:['situação','situacao','status']},produto:{l:'Produto',a:['produto']},convenio:{l:'Convênio',a:['convênio','convenio']},agente:{l:'Agente',a:['agente']},situacaoBanco:{l:'Sit.Banco',a:['situação banco','sit. banco']},obsSituacao:{l:'Obs.',a:['obs. situação']},usuario:{l:'Usuário',a:['usuário','usuario']},crcCliente:{l:'CRC',a:['crc cliente','crc','data crc']},dataNossoCredito:{l:'N.Crédito',a:['nosso crédito','nosso credito']}}

function ImportModal({open,onClose,onImport}){
  const fr=useRef(null),[step,setStep]=useState(1),[raw,setRaw]=useState([]),[hd,setHd]=useState([]),[mp,setMp]=useState({}),[pv,setPv]=useState([]),[fn,setFn]=useState(''),[busy,setBusy]=useState(false),[progress,setProg]=useState('')
  useEffect(()=>{if(!open){setStep(1);setRaw([]);setHd([]);setMp({});setPv([]);setFn('');setBusy(false);setProg('')}},[open])
  if(!open)return null
  const vc=pv.filter(p=>p._v).length,tR=pv.filter(p=>p._v).reduce((s,o)=>s+(o.vrRepasse||0),0)
  return(
    <div style={{position:'fixed',inset:0,background:'#000c',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:18,width:760,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{padding:'16px 22px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between'}}><h3 style={{fontWeight:700,fontSize:15,margin:0}}>Importar — Etapa {step}/3</h3><button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>×</button></div>
        <div style={{padding:'16px 22px'}}>
          {step===1&&<div onClick={()=>fr.current?.click()} style={{border:'2px dashed '+C.border,borderRadius:14,padding:'36px 20px',textAlign:'center',cursor:'pointer',background:C.surface}}><div style={{fontSize:32}}>📂</div><div style={{fontSize:13,fontWeight:600,marginTop:8}}>Clique para selecionar</div><input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const file=e.target.files?.[0];if(!file)return;setFn(file.name);const rd=new FileReader();rd.onload=ev=>{try{const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length)return;setRaw(rows);const cols=Object.keys(rows[0]);setHd(cols);const m={};Object.entries(IMP).forEach(([f,def])=>{const found=cols.find(c=>def.a.some(a=>c.toLowerCase().includes(a)));if(found)m[f]=found});setMp(m);setStep(2)}catch(ex){alert(ex.message)}};rd.readAsArrayBuffer(file)}} style={{display:'none'}}/></div>}
          {step===2&&<div style={{display:'flex',flexDirection:'column',gap:10}}><div style={{fontSize:12,color:C.muted}}>{fn} — {raw.length} linhas — {Object.keys(mp).length} detectados</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>{Object.entries(IMP).map(([f,def])=><div key={f}><label style={{fontSize:8,color:mp[f]?C.accent:C.muted,fontWeight:600}}>{def.l}</label><select value={mp[f]||''} onChange={e=>setMp(p=>({...p,[f]:e.target.value||undefined}))} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:4,fontSize:10,width:'100%'}}><option value="">—</option>{hd.map(h=><option key={h} value={h}>{h}</option>)}</select></div>)}</div><div style={{display:'flex',gap:8}}><button onClick={()=>setStep(1)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'8px 16px',cursor:'pointer'}}>←</button><button onClick={()=>{const built=raw.map(row=>{const cl=mp.cliente?String(row[mp.cliente]||'').trim():'';const pr=mp.proposta?String(row[mp.proposta]||'').trim():'';const ok=!!(cl||pr);const g=f=>mp[f]?String(row[mp[f]]||'').trim():'';const gu=f=>g(f).toUpperCase();return{_v:ok,cliente:cl,proposta:pr,id_ext:g('id_ext'),banco:g('banco'),cpf:g('cpf'),contrato:g('contrato'),data:nDate(mp.data?row[mp.data]:''),prazo:g('prazo'),vrBruto:pNum(mp.vrBruto?row[mp.vrBruto]:''),vrParcela:pNum(mp.vrParcela?row[mp.vrParcela]:''),vrLiquido:pNum(mp.vrLiquido?row[mp.vrLiquido]:''),vrRepasse:pNum(mp.vrRepasse?row[mp.vrRepasse]:''),vrSeguro:pNum(mp.vrSeguro?row[mp.vrSeguro]:''),taxa:g('taxa'),operacao:gu('operacao'),situacao:gu('situacao'),produto:g('produto'),convenio:gu('convenio'),agente:g('agente'),situacaoBanco:gu('situacaoBanco'),obsSituacao:g('obsSituacao'),usuario:g('usuario'),crcCliente:nDate(mp.crcCliente?row[mp.crcCliente]:''),dataNossoCredito:nDate(mp.dataNossoCredito?row[mp.dataNossoCredito]:'')}});setPv(built);setStep(3)}} style={{flex:1,background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Revisar →</button></div></div>}
          {step===3&&<div style={{display:'flex',flexDirection:'column',gap:10}}><div style={{fontSize:12}}><strong style={{color:C.accent2}}>{vc}</strong> válidas — {fmtCur(tR)}</div>{progress&&<div style={{fontSize:11,color:C.warn}}>{progress}</div>}<div style={{overflowX:'auto',maxHeight:260,borderRadius:8,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}><thead><tr style={{background:C.surface}}>{['','Cliente','Banco','Sit.','Agente','Repasse'].map(h=><th key={h} style={{padding:'5px 7px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{pv.slice(0,40).map((p,i)=><tr key={i} style={{borderBottom:'1px solid '+C.border,opacity:p._v?1:.3}}><td style={{padding:'3px 7px',color:p._v?C.accent2:C.danger}}>{p._v?'✓':'✕'}</td><td style={{padding:'3px 7px'}}>{p.cliente}</td><td style={{padding:'3px 7px'}}>{p.banco}</td><td style={{padding:'3px 7px'}}>{p.situacao}</td><td style={{padding:'3px 7px'}}>{p.agente}</td><td style={{padding:'3px 7px',fontWeight:600}}>{fmtCur(p.vrRepasse)}</td></tr>)}</tbody></table></div><div style={{display:'flex',gap:8}}><button onClick={()=>setStep(2)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:8,color:C.text,padding:'8px 16px',cursor:'pointer'}}>←</button><button onClick={async()=>{setBusy(true);const valid=pv.filter(p=>p._v).map(({_v,...r})=>r);const total=valid.length;for(let i=0;i<total;i+=500){setProg(`Gravando ${Math.min(i+500,total)}/${total}...`);await onImport(valid.slice(i,i+500))}setBusy(false);setProg('');onClose()}} disabled={!vc||busy} style={{flex:1,background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer',opacity:(!vc||busy)?.4:1}}>{busy?progress||'Gravando...':'✓ Importar '+vc}</button></div></div>}
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
  const r=al.reduce((s,o)=>s+(o.vrRepasse||0),0),fR=fin.reduce((s,o)=>s+(o.vrRepasse||0),0),eR=est.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const cv=al.length?(fin.length/al.length*100):0,estP=al.length?(est.length/al.length*100):0
  const bB={};al.forEach(o=>{const k=o.banco||'?';if(!bB[k])bB[k]={c:0,r:0,f:0};bB[k].c++;bB[k].r+=(o.vrRepasse||0);if(isFin(o))bB[k].f++})
  const bO={};al.forEach(o=>{const k=o.operacao||'?';if(!bO[k])bO[k]={c:0,r:0,f:0};bO[k].c++;bO[k].r+=(o.vrRepasse||0);if(isFin(o))bO[k].f++})
  const bS={};al.forEach(o=>{const k=o.situacao||'?';if(!bS[k])bS[k]={c:0,r:0};bS[k].c++;bS[k].r+=(o.vrRepasse||0)})
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
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <Stat label="Total" value={al.length} small/><Stat label="Repasse" value={fmtCur(r)} color={C.accent} small/>
            <Stat label="Pagas" value={fin.length} sub={fmtCur(fR)} color={C.accent2} small/>
            <Stat label="Em Andamento" value={pend.length} sub={fmtCur(pend.reduce((s,o)=>s+(o.vrRepasse||0),0))} color={C.warn} small/>
            <Stat label="Estornos" value={est.length} sub={estP.toFixed(0)+'%'} color={C.danger} small/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
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
              {pend.length>0&&<div style={{color:C.info}}>📋 {pend.length} propostas em andamento ({fmtCur(pend.reduce((s,o)=>s+(o.vrRepasse||0),0))})</div>}
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
function Dashboard({curOps,prevOps}){
  const{per,setPer,ops,loading,count}=useOps('mes')
  const f=ops,tR=f.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const fin=f.filter(isFin),fR=fin.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const est=f.filter(isEst),pend=f.filter(isPend)
  const ags=[...new Set(f.map(o=>o.agente).filter(Boolean))]
  // Situações com valores
  const bySit={};f.forEach(o=>{const k=o.situacao||'?';if(!bySit[k])bySit[k]={c:0,r:0};bySit[k].c++;bySit[k].r+=(o.vrRepasse||0)})
  const sitArr=Object.entries(bySit).sort((a,b)=>b[1].c-a[1].c)
  // Top parceiros
  const topM={};f.forEach(o=>{const a=o.agente||'?';if(!topM[a])topM[a]={r:0,c:0,fc:0};topM[a].r+=(o.vrRepasse||0);topM[a].c++;if(isFin(o))topM[a].fc++})
  const topP=Object.entries(topM).sort((a,b)=>b[1].r-a[1].r).slice(0,10)
  // Comparativo mês atual vs anterior
  const curR=curOps.reduce((s,o)=>s+(o.vrRepasse||0),0),prevR=prevOps.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const varProd=prevR?((curR-prevR)/prevR*100):(curR>0?100:0)
  const curDig=curOps.length,prevDig=prevOps.length,varDig=prevDig?((curDig-prevDig)/prevDig*100):(curDig>0?100:0)
  const curFin=curOps.filter(isFin).length,prevFin=prevOps.filter(isFin).length,varFin=prevFin?((curFin-prevFin)/prevFin*100):(curFin>0?100:0)
  const curEst=curOps.filter(isEst).length,prevEst=prevOps.filter(isEst).length
  // Projeção
  const proj=getProj(curOps),pctDU=proj.duT?(proj.duP/proj.duT*100):0
  // Por banco no período
  const byBanco={};f.forEach(o=>{const k=o.banco||'?';if(!byBanco[k])byBanco[k]={c:0,r:0,f:0};byBanco[k].c++;byBanco[k].r+=(o.vrRepasse||0);if(isFin(o))byBanco[k].f++})
  const bancoArr=Object.entries(byBanco).sort((a,b)=>b[1].r-a[1].r).slice(0,8)
  const[selP,setSelP]=useState(null)
  const vc=(v)=>v>0?'+'+v.toFixed(0)+'%':v.toFixed(0)+'%'
  const vCol=(v)=>v>0?C.accent2:v<-10?C.danger:C.warn

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 style={{fontWeight:800,fontSize:20}}>Dashboard</h2><ExportBtn ops={ops} name={'dashboard-'+per}/></div>
      <PeriodBar per={per} setPer={setPer} loading={loading}/>
      <div style={{fontSize:10,color:C.muted}}>{count} digitações no período</div>

      {/* COMPARATIVO MÊS ATUAL vs ANTERIOR */}
      <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>📊 Mês Atual vs Anterior</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PRODUÇÃO</div><div style={{fontSize:14,fontWeight:700,color:C.accent}}>{fmtCur(curR)}</div><div style={{fontSize:10,fontWeight:600,color:vCol(varProd)}}>{vc(varProd)}</div><div style={{fontSize:8,color:C.muted}}>ant: {fmtCur(prevR)}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>DIGITAÇÕES</div><div style={{fontSize:14,fontWeight:700}}>{curDig}</div><div style={{fontSize:10,fontWeight:600,color:vCol(varDig)}}>{vc(varDig)}</div><div style={{fontSize:8,color:C.muted}}>ant: {prevDig}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>FINALIZADAS</div><div style={{fontSize:14,fontWeight:700,color:C.accent2}}>{curFin}</div><div style={{fontSize:10,fontWeight:600,color:vCol(varFin)}}>{vc(varFin)}</div><div style={{fontSize:8,color:C.muted}}>ant: {prevFin}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>ESTORNOS</div><div style={{fontSize:14,fontWeight:700,color:curEst>prevEst?C.danger:C.accent2}}>{curEst}</div><div style={{fontSize:10,color:C.muted}}>ant: {prevEst}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PARCEIROS</div><div style={{fontSize:14,fontWeight:700}}>{[...new Set(curOps.map(o=>o.agente).filter(Boolean))].length}</div><div style={{fontSize:10,color:C.muted}}>ant: {[...new Set(prevOps.map(o=>o.agente).filter(Boolean))].length}</div></div>
        </div>
      </div>

      {/* PROJEÇÃO */}
      <div style={{background:C.card,border:'1px solid '+C.accent+'44',borderRadius:14,padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{fontSize:13,fontWeight:700,color:C.accent}}>📅 Projeção Mês</span><span style={{fontSize:10,color:C.muted}}>{proj.duP}/{proj.duT} DU · Restam {proj.duR}</span></div>
        <div style={{height:6,background:C.surface,borderRadius:4,marginBottom:12}}><div style={{height:'100%',background:'linear-gradient(90deg,'+C.accent+','+C.accent2+')',borderRadius:4,width:pctDU+'%'}}/></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>REALIZADO</div><div style={{fontSize:14,fontWeight:700,color:C.accent}}>{fmtCur(proj.rep)}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PROJEÇÃO</div><div style={{fontSize:14,fontWeight:700,color:C.accent2}}>{fmtCur(proj.pR)}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>FALTA</div><div style={{fontSize:14,fontWeight:700,color:C.warn}}>{fmtCur(Math.max(0,proj.pR-proj.rep))}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>MÉDIA/DU</div><div style={{fontSize:14,fontWeight:700}}>{fmtCur(proj.mdR)}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:8,color:C.muted,fontWeight:600}}>PAGO</div><div style={{fontSize:14,fontWeight:700,color:C.accent2}}>{fmtCur(proj.fR)}</div></div>
        </div>
      </div>

      {/* CARDS PERÍODO */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <Stat label="Produção (período)" value={fmtCur(tR)} color={C.accent}/>
        <Stat label="Pagas" value={fmtCur(fR)} color={C.accent2} sub={fin.length+' ops'}/>
        <Stat label="Em Andamento" value={pend.length} sub={fmtCur(pend.reduce((s,o)=>s+(o.vrRepasse||0),0))} color={C.warn}/>
        <Stat label="Estornos" value={est.length} sub={fmtCur(est.reduce((s,o)=>s+(o.vrRepasse||0),0))} color={C.danger}/>
        <Stat label="Parceiros" value={ags.length}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
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
          {topP.map(([ag,d],i)=>{const cv=d.c?(d.fc/d.c*100):0;return<div key={ag} onClick={()=>setSelP(ag)} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',borderBottom:'1px solid '+C.border,cursor:'pointer'}}>
            <span style={{fontSize:10,fontWeight:700,color:i<3?C.accent:C.muted,width:16}}>{i+1}</span>
            <div style={{flex:1,fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ag}</div>
            <span style={{fontSize:9,color:cv>=50?C.accent2:cv>=30?C.warn:C.danger,fontWeight:600}}>{cv.toFixed(0)}%</span>
            <span style={{fontSize:10,fontWeight:700,color:C.accent2}}>{fmtCur(d.r)}</span>
          </div>})}
        </div>

        {/* POR BANCO */}
        <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Por Banco</div>
          {bancoArr.map(([b,d])=>{const cv=d.c?(d.f/d.c*100):0;return<div key={b} style={{marginBottom:5}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10}}><span style={{fontWeight:600}}>{b}</span><span style={{color:C.accent}}>{fmtCur(d.r)} <span style={{color:C.muted}}>({d.c})</span></span></div>
            <div style={{height:4,background:C.surface,borderRadius:2}}><div style={{height:'100%',background:C.accent,borderRadius:2,width:(d.r/(tR||1)*100)+'%'}}/></div>
          </div>})}
        </div>
      </div>
      <PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/>
    </div>
  )
}

/* ═══ OPERAÇÕES ═══ */
function Operacoes({onImport}){
  const{per,setPer,ops,loading,count}=useOps('mes')
  const[io,sio]=useState(false),[se,sse]=useState(''),[fs,sfs]=useState(''),[selP,setSelP]=useState(null)
  const aS=[...new Set(ops.map(o=>o.situacao).filter(Boolean))].sort()
  const fd=ops.filter(o=>!fs||o.situacao===fs).filter(o=>{if(!se)return true;const s=se.toLowerCase();return(o.cliente||'').toLowerCase().includes(s)||(o.agente||'').toLowerCase().includes(s)||(o.cpf||'').includes(s)}).sort((a,b)=>(b.data||'').localeCompare(a.data||''))
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}><h2 style={{fontWeight:800,fontSize:20}}>Operações</h2><div style={{display:'flex',gap:6}}><ExportBtn ops={fd} name={'operacoes-'+per}/><button onClick={()=>sio(true)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontWeight:600,fontSize:12}}>📥 Importar</button></div></div>
      <PeriodBar per={per} setPer={setPer} loading={loading}/>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><input value={se} onChange={e=>sse(e.target.value)} placeholder="Buscar..." style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 12px',fontSize:12,outline:'none',flex:1,minWidth:160}}/><select value={fs} onChange={e=>sfs(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 11px',fontSize:12}}><option value="">— Situação —</option>{aS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
      <div style={{fontSize:10,color:C.muted}}>{fd.length} de {count} — {fmtCur(fd.reduce((s,o)=>s+(o.vrRepasse||0),0))}</div>
      <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Data','Cliente','Banco','Op.','Situação','Agente','Repasse'].map(h=><th key={h} style={{padding:'8px 9px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{fd.slice(0,500).map(o=><tr key={o.id} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 9px',whiteSpace:'nowrap'}}>{fmtDate(o.data)}</td><td style={{padding:'7px 9px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.cliente||'—'}</td><td style={{padding:'7px 9px'}}>{o.banco}</td><td style={{padding:'7px 9px'}}>{o.operacao}</td><td style={{padding:'7px 9px'}}><Badge text={o.situacao||'—'} color={sitCol(o.situacao)}/></td><td style={{padding:'7px 9px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer',color:C.accent}} onClick={()=>setSelP(o.agente)}>{o.agente}</td><td style={{padding:'7px 9px',fontWeight:600}}>{fmtCur(o.vrRepasse)}</td></tr>)}</tbody></table></div>
      <ImportModal open={io} onClose={()=>sio(false)} onImport={onImport}/>
      <PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/>
    </div>
  )
}

/* ═══ PRODUÇÃO ═══ */
function Producao(){const{per,setPer,ops,loading}=useOps('mes');const[tab,sTab]=useState('banco');const tR=ops.reduce((s,o)=>s+(o.vrRepasse||0),0);const kFn=tab==='banco'?o=>o.banco:tab==='convenio'?o=>o.convenio:o=>o.operacao;const m={};ops.forEach(o=>{const k=kFn(o)||'?';if(!m[k])m[k]={c:0,r:0,fc:0,fr:0};m[k].c++;m[k].r+=(o.vrRepasse||0);if(isFin(o)){m[k].fc++;m[k].fr+=(o.vrRepasse||0)}});const data=Object.entries(m).sort((a,b)=>b[1].r-a[1].r);return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Produção</h2><ExportBtn ops={ops} name={'producao-'+per}/></div><PeriodBar per={per} setPer={setPer} loading={loading}/><div style={{display:'flex',gap:4}}>{[{id:'banco',n:'🏦 Banco'},{id:'convenio',n:'📑 Convênio'},{id:'operacao',n:'⚡ Operação'}].map(t=><button key={t.id} onClick={()=>sTab(t.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(tab===t.id?C.accent:C.border),background:tab===t.id?C.abg:'transparent',color:tab===t.id?C.accent:C.muted,fontSize:11,cursor:'pointer'}}>{t.n}</button>)}</div><div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{[tab==='banco'?'Banco':tab==='convenio'?'Convênio':'Operação','Dig.','Repasse','%','Pago','Conv.'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{data.map(([n,d])=>{const pct=tR?(d.r/tR*100):0,cv=d.c?(d.fc/d.c*100):0;return<tr key={n} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'8px 10px',fontWeight:700}}>{n}</td><td style={{padding:'8px 10px'}}>{d.c}</td><td style={{padding:'8px 10px',fontWeight:600,color:C.accent}}>{fmtCur(d.r)}</td><td style={{padding:'8px 10px',color:C.muted}}>{pct.toFixed(0)}%</td><td style={{padding:'8px 10px',color:C.accent2,fontWeight:600}}>{fmtCur(d.fr)}</td><td style={{padding:'8px 10px',fontWeight:600,color:cv>=50?C.accent2:cv>=30?C.warn:C.danger}}>{cv.toFixed(0)}%</td></tr>})}</tbody></table></div></div>}

/* ═══ ESTRATÉGICO ═══ */
function Estrategico(){const{per,setPer,ops,loading}=useOps('tudo');const[sel,sSel]=useState(null),[selP,setSelP]=useState(null);const list=(()=>{const ags=[...new Set(ops.map(o=>o.agente).filter(Boolean))];return ags.map(a=>{const al=ops.filter(o=>o.agente===a),fn=al.filter(isFin),est=al.filter(isEst),r=al.reduce((s,o)=>s+(o.vrRepasse||0),0),cv=al.length?(fn.length/al.length*100):0,er=al.length?(est.length/al.length*100):0;return{name:a,c:al.length,r,fC:fn.length,cv,estC:est.length,er}}).sort((a,b)=>b.r-a.r)})();return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Estratégico</h2><ExportBtn ops={ops} name={'estrategico-'+per}/></div><PeriodBar per={per} setPer={setPer} loading={loading}/><div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Parceiro','Dig.','Repasse','Conv.','Estornos','Health',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{list.map(p=>{const h=p.cv>=60?'🟢':p.cv>=40?'🟡':p.cv>=25?'🟠':'🔴';return<tr key={p.name} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}} onClick={()=>setSelP(p.name)}><td style={{padding:'8px 10px',fontWeight:600}}>{p.name}</td><td style={{padding:'8px 10px'}}>{p.c}</td><td style={{padding:'8px 10px',fontWeight:600,color:C.accent}}>{fmtCur(p.r)}</td><td style={{padding:'8px 10px',fontWeight:600,color:p.cv>=50?C.accent2:p.cv>=30?C.warn:C.danger}}>{p.cv.toFixed(0)}%</td><td style={{padding:'8px 10px',color:p.estC?C.danger:C.muted}}>{p.estC} ({p.er.toFixed(0)}%)</td><td style={{padding:'8px 10px',fontSize:14}}>{h}</td><td style={{color:C.accent}}>→</td></tr>})}</tbody></table></div><PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/></div>}

/* ═══ RANKING ═══ */
function Ranking(){const{per,setPer,ops,loading}=useOps('mes');const[selP,setSelP]=useState(null);const data=(()=>{const ags=[...new Set(ops.map(o=>o.agente).filter(Boolean))];return ags.map(a=>{const al=ops.filter(o=>o.agente===a),fn=al.filter(isFin),est=al.filter(isEst),r=al.reduce((s,o)=>s+(o.vrRepasse||0),0),cv=al.length?(fn.length/al.length*100):0;return{name:a,c:al.length,r,cv,estC:est.length}}).sort((a,b)=>b.r-a.r)})();return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Ranking</h2><ExportBtn ops={ops} name={'ranking-'+per}/></div><PeriodBar per={per} setPer={setPer} loading={loading}/><div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['#','Parceiro','Dig.','Repasse','Conv.','Est.','Health'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{data.map((d,i)=>{const h=d.cv>=60?'🟢':d.cv>=40?'🟡':d.cv>=25?'🟠':'🔴';return<tr key={d.name} style={{borderBottom:'1px solid '+C.border,cursor:'pointer'}} onClick={()=>setSelP(d.name)}><td style={{padding:'8px 10px'}}><span style={{display:'inline-flex',width:22,height:22,borderRadius:6,background:i<3?C.accent:C.surface,alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:i<3?'#fff':C.muted}}>{i+1}</span></td><td style={{padding:'8px 10px',fontWeight:600}}>{d.name}</td><td style={{padding:'8px 10px'}}>{d.c}</td><td style={{padding:'8px 10px',fontWeight:600,color:C.accent}}>{fmtCur(d.r)}</td><td style={{padding:'8px 10px',fontWeight:600,color:d.cv>=50?C.accent2:d.cv>=30?C.warn:C.danger}}>{d.cv.toFixed(0)}%</td><td style={{padding:'8px 10px',color:d.estC?C.danger:C.muted}}>{d.estC}</td><td style={{fontSize:14}}>{h}</td></tr>})}</tbody></table></div><PartnerHealth name={selP} ops={ops} onClose={()=>setSelP(null)}/></div>}

/* ═══ RECEBIMENTOS ═══ */
function Recebimentos(){const{per,setPer,ops,loading}=useOps('tudo');const[fB,sFB]=useState('');const pend=ops.filter(o=>o.crcCliente&&!o.dataNossoCredito),rec=ops.filter(o=>o.crcCliente&&o.dataNossoCredito);const pR=pend.reduce((s,o)=>s+(o.vrRepasse||0),0);const byBanco=(()=>{const m={};pend.forEach(o=>{const b=o.banco||'?';if(!m[b])m[b]={c:0,r:0,ds:[]};m[b].c++;m[b].r+=(o.vrRepasse||0);if(o.crcCliente)m[b].ds.push(Math.floor((NOW-new Date(o.crcCliente))/86400000))});return Object.entries(m).map(([b,d])=>({b,...d,md:d.ds.length?Math.round(d.ds.reduce((a,b)=>a+b,0)/d.ds.length):0,mx:d.ds.length?Math.max(...d.ds):0})).sort((a,b)=>b.r-a.r)})();const byAg=(()=>{const m={};pend.forEach(o=>{const a=o.agente||'?';if(!m[a])m[a]={c:0,r:0};m[a].c++;m[a].r+=(o.vrRepasse||0)});return Object.entries(m).sort((a,b)=>b[1].r-a[1].r)})();const aging=(()=>{const fx={'0-15d':[0,0],'16-30d':[0,0],'31-60d':[0,0],'61-90d':[0,0],'90+d':[0,0]};pend.forEach(o=>{if(!o.crcCliente)return;const d=Math.floor((NOW-new Date(o.crcCliente))/86400000),k=d<=15?'0-15d':d<=30?'16-30d':d<=60?'31-60d':d<=90?'61-90d':'90+d';fx[k][0]++;fx[k][1]+=(o.vrRepasse||0)});return Object.entries(fx)})();const filt=fB?pend.filter(o=>o.banco===fB):pend;return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Recebimentos</h2><ExportBtn ops={pend} name={'recebimentos-pendentes'}/></div><PeriodBar per={per} setPer={setPer} loading={loading}/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Stat label="Pendentes" value={pend.length} sub={fmtCur(pR)} color={C.danger}/><Stat label="Recebidas" value={rec.length} sub={fmtCur(rec.reduce((s,o)=>s+(o.vrRepasse||0),0))} color={C.accent2}/></div>{pend.length>0&&<><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Aging</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{aging.map(([k,[c,r]])=>{const col=k.includes('90')||k.includes('61')?C.danger:k.includes('31')?C.warn:C.info;return c>0?<div key={k} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:10,padding:'10px 16px'}}><div style={{fontSize:18,fontWeight:700,color:col}}>{c}</div><div style={{fontSize:10,fontWeight:600,color:col}}>{k}</div><div style={{fontSize:9,color:C.muted}}>{fmtCur(r)}</div></div>:null})}</div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Banco</div><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Banco','Qtd','Pendente','Média','Máx'].map(h=><th key={h} style={{padding:'7px 9px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{byBanco.map(b=><tr key={b.b} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 9px',fontWeight:700}}>{b.b}</td><td style={{padding:'7px 9px'}}>{b.c}</td><td style={{padding:'7px 9px',fontWeight:600,color:C.danger}}>{fmtCur(b.r)}</td><td style={{padding:'7px 9px',color:b.md>60?C.danger:b.md>30?C.warn:C.text}}>{b.md}d</td><td style={{padding:'7px 9px',color:b.mx>90?C.danger:C.warn}}>{b.mx}d</td></tr>)}</tbody></table></div><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Parceiro</div><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Parceiro','Qtd','Pendente'].map(h=><th key={h} style={{padding:'7px 9px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{byAg.slice(0,20).map(([a,d])=><tr key={a} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 9px',fontWeight:600}}>{a}</td><td style={{padding:'7px 9px'}}>{d.c}</td><td style={{padding:'7px 9px',fontWeight:600,color:C.danger}}>{fmtCur(d.r)}</td></tr>)}</tbody></table></div></div><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:10,alignItems:'center'}}><span style={{fontSize:12,fontWeight:700}}>Analítico</span><div style={{display:'flex',gap:6}}><select value={fB} onChange={e=>sFB(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:6,color:C.text,padding:'4px 8px',fontSize:10}}><option value="">— Banco —</option>{[...new Set(pend.map(o=>o.banco).filter(Boolean))].sort().map(b=><option key={b} value={b}>{b}</option>)}</select><ExportBtn ops={filt} name={'receb-analitico'}/></div></div><div style={{overflowX:'auto',maxHeight:350,borderRadius:8,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}><thead><tr style={{background:C.surface,position:'sticky',top:0}}>{['Cliente','Banco','Op.','Agente','Repasse','CRC','Dias'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{filt.slice(0,500).map(o=>{const d=o.crcCliente?Math.floor((NOW-new Date(o.crcCliente))/86400000):0;return<tr key={o.id} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'5px 8px'}}>{o.cliente}</td><td style={{padding:'5px 8px'}}>{o.banco}</td><td style={{padding:'5px 8px'}}>{o.operacao}</td><td style={{padding:'5px 8px'}}>{o.agente}</td><td style={{padding:'5px 8px',fontWeight:600,color:C.danger}}>{fmtCur(o.vrRepasse)}</td><td style={{padding:'5px 8px'}}>{fmtDate(o.crcCliente)}</td><td style={{padding:'5px 8px',fontWeight:600,color:d>90?C.danger:d>30?C.warn:C.text}}>{d}d</td></tr>})}</tbody></table></div></div></>}</div>}

/* ═══ ESTORNOS ═══ */
function Estornos(){const{per,setPer,ops,loading}=useOps('mes');const est=ops.filter(isEst);const byBanco=(()=>{const m={};est.forEach(o=>{const b=o.banco||'?';if(!m[b])m[b]={c:0,r:0};m[b].c++;m[b].r+=(o.vrRepasse||0)});return Object.entries(m).sort((a,b)=>b[1].c-a[1].c)})();const byAg=(()=>{const m={};est.forEach(o=>{const a=o.agente||'?';if(!m[a])m[a]={c:0,r:0,t:0};m[a].c++;m[a].r+=(o.vrRepasse||0)});ops.forEach(o=>{const a=o.agente||'?';if(m[a])m[a].t++});return Object.entries(m).map(([a,d])=>({a,...d,pct:d.t?(d.c/d.t*100):0})).sort((a,b)=>b.pct-a.pct)})();return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Estornos</h2><ExportBtn ops={est} name={'estornos-'+per}/></div><PeriodBar per={per} setPer={setPer} loading={loading}/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Stat label="Estornos" value={est.length} color={C.danger}/><Stat label="Perda" value={fmtCur(est.reduce((s,o)=>s+(o.vrRepasse||0),0))} color={C.danger}/></div>{est.length>0&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Banco</div><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Banco','Qtd','Perda'].map(h=><th key={h} style={{padding:'7px 9px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{byBanco.map(([b,d])=><tr key={b} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 9px',fontWeight:600}}>{b}</td><td style={{padding:'7px 9px',color:C.danger}}>{d.c}</td><td style={{padding:'7px 9px',color:C.danger}}>{fmtCur(d.r)}</td></tr>)}</tbody></table></div><div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10,color:C.danger}}>Top Estornadores</div><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Parceiro','Est.','%','Perda'].map(h=><th key={h} style={{padding:'7px 9px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{byAg.slice(0,15).map(a=><tr key={a.a} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 9px',fontWeight:600}}>{a.a}</td><td style={{padding:'7px 9px',color:C.danger}}>{a.c}</td><td style={{padding:'7px 9px',fontWeight:600,color:a.pct>20?C.danger:a.pct>10?C.warn:C.text}}>{a.pct.toFixed(0)}%</td><td style={{padding:'7px 9px',color:C.danger}}>{fmtCur(a.r)}</td></tr>)}</tbody></table></div></div>}</div>}

/* ═══ ALERTAS ═══ */
function Alertas({curOps,prevOps}){const ags=[...new Set(curOps.concat(prevOps).map(o=>o.agente).filter(Boolean))];const st=ags.map(a=>{const cu=curOps.filter(o=>o.agente===a),pv=prevOps.filter(o=>o.agente===a),cR=cu.reduce((s,o)=>s+(o.vrRepasse||0),0),pR=pv.reduce((s,o)=>s+(o.vrRepasse||0),0),vr=pR?((cR-pR)/pR*100):(cR>0?100:0);let flag='ok';if(cu.length===0&&pv.length>0)flag='parado';else if(vr<=-30)flag='queda';return{nm:a,cc:cu.length,pc:pv.length,vr,flag}}).sort((a,b)=>{const o={parado:0,queda:1,ok:2};return(o[a.flag]??3)-(o[b.flag]??3)});return<div style={{display:'flex',flexDirection:'column',gap:14}}><h2 style={{fontWeight:800,fontSize:20}}>Alertas</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Stat label="Parados" value={st.filter(s=>s.flag==='parado').length} color={C.danger}/><Stat label="Em Queda" value={st.filter(s=>s.flag==='queda').length} color={C.warn}/></div>{st.filter(s=>s.flag!=='ok').length>0&&<div style={{background:'#EF444418',border:'1px solid #EF444433',borderRadius:12,padding:14}}><div style={{fontSize:12,fontWeight:700,color:C.danger,marginBottom:6}}>⚠ Ação necessária</div>{st.filter(s=>s.flag!=='ok').map(s=><div key={s.nm} style={{fontSize:11,padding:'3px 0'}}>{s.flag==='parado'?'🔴':'🟡'} <strong>{s.nm}</strong> — {s.flag==='parado'?'Parado no mês':'Queda '+Math.abs(s.vr).toFixed(0)+'%'}</div>)}</div>}<div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}><thead><tr style={{background:C.surface}}>{['','Parceiro','Mês','Ant.','Var.'].map(h=><th key={h} style={{padding:'7px 8px',textAlign:'left',color:C.muted,fontSize:8}}>{h}</th>)}</tr></thead><tbody>{st.map(s=><tr key={s.nm} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'7px 8px'}}>{s.flag==='parado'?'🔴':s.flag==='queda'?'🟡':'↗'}</td><td style={{padding:'7px 8px',fontWeight:600}}>{s.nm}</td><td style={{padding:'7px 8px'}}>{s.cc}</td><td style={{padding:'7px 8px'}}>{s.pc}</td><td style={{padding:'7px 8px',fontWeight:600,color:s.vr>0?C.accent2:s.vr<-30?C.danger:C.warn}}>{s.vr>0?'+':''}{s.vr.toFixed(0)}%</td></tr>)}</tbody></table></div></div>}

/* ═══ USUARIOS ═══ */
function Usuarios({user}){const[users,setUsers]=useState([]),[loading,setLoading]=useState(true),[showNew,setShowNew]=useState(false),[nome,setNome]=useState(''),[email,setEmail]=useState(''),[senha,setSenha]=useState(''),[perfil,setPerfil]=useState('operador'),[msg,setMsg]=useState('');useEffect(()=>{supabase.from('usuarios').select('*').order('nome').then(({data})=>{setUsers(data||[]);setLoading(false)})},[]);if(user.perfil!=='admin')return<div style={{padding:28,textAlign:'center',color:C.muted}}>Restrito</div>;return<div style={{display:'flex',flexDirection:'column',gap:14}}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{fontWeight:800,fontSize:20}}>Usuários</h2><button onClick={()=>setShowNew(!showNew)} style={{background:C.accent,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,fontSize:12,cursor:'pointer'}}>+ Novo</button></div>{msg&&<div style={{background:C.accent+'22',color:C.accent,padding:'8px 12px',borderRadius:8,fontSize:12}}>{msg}</div>}{showNew&&<form onSubmit={async e=>{e.preventDefault();const{error}=await supabase.from('usuarios').insert({nome,email,senha,perfil});if(error){setMsg(error.message);return}setMsg('Criado!');setNome('');setEmail('');setSenha('');setShowNew(false);const{data}=await supabase.from('usuarios').select('*').order('nome');setUsers(data||[])}} style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16,display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:10,alignItems:'end'}}><div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>NOME</label><input value={nome} onChange={e=>setNome(e.target.value)} required style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div><div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>EMAIL</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div><div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>SENHA</label><input value={senha} onChange={e=>setSenha(e.target.value)} required style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%',boxSizing:'border-box'}}/></div><div><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>PERFIL</label><select value={perfil} onChange={e=>setPerfil(e.target.value)} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 10px',fontSize:12,width:'100%'}}><option value="operador">Operador</option><option value="gestor">Gestor</option><option value="admin">Admin</option></select></div><button type="submit" style={{background:C.accent2,color:'#fff',border:'none',borderRadius:8,padding:'8px 16px',fontWeight:600,cursor:'pointer'}}>Criar</button></form>}{!loading&&<div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}><thead><tr style={{background:C.surface}}>{['Nome','Email','Perfil','Status','Ações'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id} style={{borderBottom:'1px solid '+C.border}}><td style={{padding:'8px 10px',fontWeight:600}}>{u.nome}</td><td style={{padding:'8px 10px'}}>{u.email}</td><td style={{padding:'8px 10px'}}><select value={u.perfil} onChange={async e=>{await supabase.from('usuarios').update({perfil:e.target.value}).eq('id',u.id);const{data}=await supabase.from('usuarios').select('*').order('nome');setUsers(data||[])}} style={{background:C.surface,border:'1px solid '+C.border,borderRadius:4,color:C.text,padding:'2px 6px',fontSize:10}}><option value="operador">Operador</option><option value="gestor">Gestor</option><option value="admin">Admin</option></select></td><td style={{padding:'8px 10px'}}><Badge text={u.ativo?'Ativo':'Inativo'} color={u.ativo?C.accent2:C.danger}/></td><td style={{padding:'8px 10px'}}><button onClick={async()=>{await supabase.from('usuarios').update({ativo:!u.ativo}).eq('id',u.id);const{data}=await supabase.from('usuarios').select('*').order('nome');setUsers(data||[])}} style={{background:u.ativo?'#EF444418':C.accent2+'22',color:u.ativo?C.danger:C.accent2,border:'none',borderRadius:6,padding:'4px 10px',fontSize:10,fontWeight:600,cursor:'pointer'}}>{u.ativo?'Desativar':'Ativar'}</button></td></tr>)}</tbody></table></div>}</div>}

/* ═══ NAV ═══ */
const NAV=[{id:'dashboard',l:'Dashboard',i:'📊',min:'operador'},{id:'ops',l:'Operações',i:'💼',min:'operador'},{id:'producao',l:'Produção',i:'🏦',min:'operador'},{id:'estrategico',l:'Estratégico',i:'🤝',min:'gestor'},{id:'ranking',l:'Ranking',i:'🏆',min:'gestor'},{id:'recebimentos',l:'Recebimentos',i:'💰',min:'gestor'},{id:'estornos',l:'Estornos',i:'⚠',min:'gestor'},{id:'alertas',l:'Alertas',i:'📈',min:'gestor'},{id:'usuarios',l:'Usuários',i:'👤',min:'admin'}]

/* ═══ MAIN APP ═══ */
export default function App(){
  const[user,setUser]=useState(null),[view,setView]=useState('dashboard'),[loginError,setLoginError]=useState('')
  const[curOps,setCurOps]=useState([]),[prevOps,setPrevOps]=useState([])
  useEffect(()=>{try{const s=localStorage.getItem('om-session');if(s){const u=JSON.parse(s);if(u?.nome)setUser(u)}}catch(e){}},[])
  useEffect(()=>{if(!user)return;fetchOps('mes').then(d=>setCurOps(d)).catch(()=>{});fetchOps('ant').then(d=>setPrevOps(d)).catch(()=>{})},[user])

  async function handleLogin(e){e.preventDefault();setLoginError('');const fd=new FormData(e.target);const{data,error}=await supabase.from('usuarios').select('*').eq('email',fd.get('email')).eq('senha',fd.get('senha')).eq('ativo',true).single();if(error||!data){setLoginError('Email/senha incorretos');return}supabase.from('usuarios').update({ultimo_acesso:new Date().toISOString()}).eq('id',data.id).then(()=>{});const session={id:data.id,nome:data.nome,email:data.email,perfil:data.perfil};localStorage.setItem('om-session',JSON.stringify(session));setUser(session)}
  async function handleImport(batch){const{error}=await supabase.from('digitacoes').upsert(batch.map(toDb),{onConflict:'proposta,banco',ignoreDuplicates:false});if(error)await supabase.from('digitacoes').insert(batch.map(toDb))}

  if(!user)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,fontFamily:'Outfit,sans-serif',color:C.text}}><form onSubmit={handleLogin} style={{background:C.card,border:'1px solid '+C.border,borderRadius:20,padding:'40px 36px',width:380}}><div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}><div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,'+C.accent+','+C.accent2+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff'}}>O</div><h1 style={{fontSize:22,fontWeight:800,margin:0}}>OpsManager</h1></div><p style={{color:C.muted,fontSize:12,marginBottom:24}}>Gestão de Digitações</p>{loginError&&<div style={{background:'#EF444418',color:C.danger,padding:'8px 12px',borderRadius:8,fontSize:12,marginBottom:12}}>{loginError}</div>}<div style={{marginBottom:8}}><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>EMAIL</label><input name="email" type="email" required placeholder="seu@email.com" style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'10px 12px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'Outfit,sans-serif'}}/></div><div style={{marginBottom:16}}><label style={{fontSize:9,color:C.muted,fontWeight:600,display:'block',marginBottom:3}}>SENHA</label><input name="senha" type="password" required placeholder="Sua senha" style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'10px 12px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box',fontFamily:'Outfit,sans-serif'}}/></div><button type="submit" style={{width:'100%',padding:'12px 0',fontSize:14,borderRadius:10,border:'none',background:C.accent,color:'#fff',fontWeight:700,cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>Entrar</button></form></div>

  const levels={operador:1,gestor:2,admin:3},nav=NAV.filter(n=>(levels[n.min]||1)<=(levels[user.perfil]||1))
  return<div style={{display:'flex',minHeight:'100vh',fontFamily:'Outfit,sans-serif',color:C.text,background:C.bg}}>
    <div style={{width:195,background:C.card,borderRight:'1px solid '+C.border,display:'flex',flexDirection:'column',flexShrink:0}}>
      <div style={{padding:'20px 14px 10px'}}><div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:26,height:26,borderRadius:7,background:'linear-gradient(135deg,'+C.accent+','+C.accent2+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>O</div><h1 style={{fontSize:14,fontWeight:800,margin:0}}>OpsManager</h1></div><div style={{fontSize:8,color:C.accent2,marginTop:4,marginLeft:33}}>● Supabase</div></div>
      <nav style={{flex:1,padding:'2px 7px',overflowY:'auto'}}>{nav.map(n=><button key={n.id} onClick={()=>setView(n.id)} style={{display:'flex',alignItems:'center',gap:7,width:'100%',padding:'7px 9px',marginBottom:1,borderRadius:7,border:'none',background:view===n.id?C.abg:'transparent',color:view===n.id?C.accent:C.muted,fontFamily:'Outfit,sans-serif',fontSize:11,fontWeight:view===n.id?600:400,cursor:'pointer',textAlign:'left'}}><span style={{fontSize:13}}>{n.i}</span>{n.l}</button>)}</nav>
      <div style={{padding:'10px 14px',borderTop:'1px solid '+C.border}}><div style={{fontSize:11,fontWeight:600}}>{user.nome}</div><div style={{fontSize:9,color:C.muted,marginBottom:4}}>{user.perfil}</div><button onClick={()=>{localStorage.removeItem('om-session');setUser(null)}} style={{fontSize:9,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Sair →</button></div>
    </div>
    <div style={{flex:1,padding:'20px 24px',overflowY:'auto'}}>
      {view==='dashboard'&&<Dashboard curOps={curOps} prevOps={prevOps}/>}
      {view==='ops'&&<Operacoes onImport={handleImport}/>}
      {view==='producao'&&<Producao/>}
      {view==='estrategico'&&<Estrategico/>}
      {view==='ranking'&&<Ranking/>}
      {view==='recebimentos'&&<Recebimentos/>}
      {view==='estornos'&&<Estornos/>}
      {view==='alertas'&&<Alertas curOps={curOps} prevOps={prevOps}/>}
      {view==='usuarios'&&<Usuarios user={user}/>}
    </div>
  </div>
}
