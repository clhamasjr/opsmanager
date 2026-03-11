import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* STORAGE — keys are FINAL, never change */
const K = { ops: "opsmanager-ops", cad: "opsmanager-cad" };
async function load(k) {
  try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function save(k, v) {
  try { await window.storage.set(k, JSON.stringify(v)); }
  catch (e) { console.error("Erro ao salvar:", e); }
}
/* Also try to migrate old data */
async function migrateOld() {
  const oldKeys = ["ops-v4","ops-v3","ops-v2","ops-data-v2","ops-data"];
  for (const ok of oldKeys) {
    try { const r = await window.storage.get(ok); if (r) { const d = JSON.parse(r.value); if (d && d.length > 0) return d; } } catch {}
  }
  return null;
}
async function migrateOldCad() {
  const oldKeys = ["part-v4","part-v3","partners-data-v2","partners-data"];
  for (const ok of oldKeys) {
    try { const r = await window.storage.get(ok); if (r) { const d = JSON.parse(r.value); if (d && d.length > 0) return d; } } catch {}
  }
  return null;
}

const uid = () => Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
const TODAY = new Date().toISOString().split("T")[0];
const NOW = new Date();
const fmtCur = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = d => { if(!d)return"—";const p=d.split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:d; };
const isFinal = o => ["FINALIZADO","PAGO","AVERBADO","CONCRETIZADO","PAGO C/ PENDENCIA","PAGO C/ PENDÊNCIA"].includes((o.situacaoBanco||"").toUpperCase());

const C={bg:"#0A0E17",surface:"#0F1520",card:"#141B2B",border:"#1C2538",text:"#DAE0ED",muted:"#5B6B85",accent:"#3B82F6",accent2:"#10B981",warn:"#F59E0B",danger:"#EF4444",info:"#38BDF8",accentBg:"#3B82F622",accent2Bg:"#10B98122",warnBg:"#F59E0B18",dangerBg:"#EF444418"};

function sitColor(s){s=(s||"").toUpperCase();if(["FINALIZADO","PAGO","AVERBADO","APROVADO","CONCRETIZADO","PAGO C/ PENDENCIA","PAGO C/ PENDÊNCIA"].includes(s))return C.accent2;if(["ESTORNADO","CANCELADO","RECUSADO"].includes(s))return C.danger;if(["EM ANÁLISE","PENDENTE"].includes(s))return C.warn;return C.info;}

function Btn({children,variant="primary",style,disabled,...p}){const base={border:"none",borderRadius:8,fontFamily:"Outfit",fontWeight:600,fontSize:12,cursor:disabled?"not-allowed":"pointer",padding:"8px 16px",transition:"all .15s",opacity:disabled?.4:1};const vs={primary:{background:C.accent,color:"#fff"},success:{background:C.accent2,color:"#fff"},ghost:{background:C.surface,color:C.text,border:"1px solid "+C.border},danger:{background:C.dangerBg,color:C.danger}};return<button style={{...base,...vs[variant],...style}} disabled={disabled} {...p}>{children}</button>;}

function Modal({open,onClose,title,children,width=560}){if(!open)return null;return(<div style={{position:"fixed",inset:0,background:"#000000BB",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:C.card,border:"1px solid "+C.border,borderRadius:16,width,maxWidth:"96vw",maxHeight:"92vh",overflowY:"auto"}}><div style={{padding:"14px 20px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{fontFamily:"Outfit",fontWeight:700,fontSize:15,margin:0}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>×</button></div><div style={{padding:"16px 20px"}}>{children}</div></div></div>);}

function Stat({label,value,sub,color}){return(<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"14px 16px",flex:1,minWidth:120}}><div style={{fontSize:9,color:C.muted,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:18,fontWeight:700,fontFamily:"Outfit",color:color||C.text}}>{value}</div>{sub&&<div style={{fontSize:10,color:C.muted,marginTop:2}}>{sub}</div>}</div>);}

function Field({label,value,onChange,type="text",options,placeholder,style:st}){const base={background:C.surface,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"7px 11px",fontSize:12,outline:"none",width:"100%",fontFamily:"Outfit"};return(<div style={{display:"flex",flexDirection:"column",gap:3,...st}}>{label&&<label style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase"}}>{label}</label>}{options?<select value={value||""} onChange={e=>onChange(e.target.value)} style={{...base,cursor:"pointer"}}><option value="">— Todos —</option>{options.map(o=>typeof o==="object"?<option key={o.value} value={o.value}>{o.label}</option>:<option key={o} value={o}>{o}</option>)}</select>:<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>}</div>);}

function Badge({text,color}){return<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:color+"22",color,fontWeight:600,whiteSpace:"nowrap"}}>{text}</span>;}

function usePeriod(){const[periodo,setPeriodo]=useState("mes");const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");const presets=useMemo(()=>{const y=NOW.getFullYear(),m=NOW.getMonth(),fmt=d=>d.toISOString().split("T")[0],f=(yr,mo)=>fmt(new Date(yr,mo,1)),l=(yr,mo)=>fmt(new Date(yr,mo+1,0));return{mes:{from:f(y,m),to:l(y,m),label:"Mês Atual"},anterior:{from:f(y,m-1),to:l(y,m-1),label:"Mês Anterior"},trimestre:{from:f(y,m-2),to:l(y,m),label:"Trimestre"},semestre:{from:f(y,m-5),to:l(y,m),label:"Semestre"},ano:{from:y+"-01-01",to:y+"-12-31",label:String(y)},tudo:{from:"2000-01-01",to:"2099-12-31",label:"Tudo"}};},[]);useEffect(()=>{if(periodo!=="custom"){const p=presets[periodo];if(p){setDateFrom(p.from);setDateTo(p.to);}}},[periodo,presets]);return{periodo,setPeriodo,dateFrom,setDateFrom,dateTo,setDateTo,presets,filterOps:ops=>ops.filter(o=>o.data&&o.data>=dateFrom&&o.data<=dateTo),label:periodo==="custom"?fmtDate(dateFrom)+" a "+fmtDate(dateTo):presets[periodo]?.label||""};}

function PeriodBar({p}){return(<div style={{display:"flex",flexDirection:"column",gap:6}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{Object.entries(p.presets).map(([k,v])=>(<button key={k} onClick={()=>p.setPeriodo(k)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(p.periodo===k?C.accent:C.border),background:p.periodo===k?C.accentBg:"transparent",color:p.periodo===k?C.accent:C.muted,fontSize:10,fontWeight:p.periodo===k?600:400,cursor:"pointer",fontFamily:"Outfit"}}>{v.label}</button>))}<button onClick={()=>p.setPeriodo("custom")} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(p.periodo==="custom"?C.accent:C.border),background:p.periodo==="custom"?C.accentBg:"transparent",color:p.periodo==="custom"?C.accent:C.muted,fontSize:10,cursor:"pointer",fontFamily:"Outfit"}}>Personalizado</button></div>{p.periodo==="custom"&&<div style={{display:"flex",gap:8}}><Field label="De" value={p.dateFrom} onChange={p.setDateFrom} type="date" style={{minWidth:120}}/><Field label="Até" value={p.dateTo} onChange={p.setDateTo} type="date" style={{minWidth:120}}/></div>}<div style={{fontSize:10,color:C.muted}}>Período: <strong style={{color:C.text}}>{p.label}</strong></div></div>);}

function useSheetJS(){const[r,setR]=useState(!!window.XLSX);useEffect(()=>{if(window.XLSX){setR(true);return;}const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=()=>setR(true);document.head.appendChild(s);},[]);return r;}

/* LOGIN — production */
function Login({onLogin}){const[u,setU]=useState("");const[p,setP]=useState("");const[err,setErr]=useState("");
  const go=()=>{if(u.trim().length>=3&&p.trim().length>=3)onLogin({name:u.trim(),role:"Gestor"});else setErr("Preencha usuário e senha (mín. 3 caracteres)");};
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,"+C.bg+",#0D1322)",fontFamily:"Outfit"}}><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,padding:"44px 38px",width:370,boxShadow:"0 20px 60px #00000066"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,"+C.accent+","+C.accent2+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>O</div><h1 style={{fontSize:22,fontWeight:800}}>OpsManager</h1></div><p style={{color:C.muted,fontSize:12,marginBottom:28}}>Sistema de Gestão de Digitações</p>{err&&<div style={{background:C.dangerBg,color:C.danger,padding:"8px 12px",borderRadius:8,fontSize:12,marginBottom:12}}>{err}</div>}<Field label="Usuário" value={u} onChange={v=>{setU(v);setErr("");}} placeholder="Seu nome"/><div style={{height:8}}/><Field label="Senha" value={p} onChange={v=>{setP(v);setErr("");}} type="password" placeholder="Sua senha"/><div style={{height:16}}/><Btn onClick={go} style={{width:"100%",padding:"11px 0",fontSize:13,borderRadius:10}}>Entrar</Btn></div></div>);}

/* IMPORT OPS */
const IMP={id_ext:{l:"ID",a:["id"]},banco:{l:"Banco",a:["banco"]},cpf:{l:"CPF",a:["cpf"]},cliente:{l:"Cliente",a:["cliente","nome"]},proposta:{l:"Proposta",a:["proposta"]},contrato:{l:"Nº Contrato",a:["contrato","nº contrato"]},data:{l:"Data",a:["data","date"]},prazo:{l:"Prazo",a:["prazo"]},vrBruto:{l:"Vr. Bruto",a:["vr. bruto","vr bruto","bruto"]},vrParcela:{l:"Vr. Parcela",a:["vr. parcela","vr parcela"]},vrLiquido:{l:"Vr. Líquido",a:["vr. líquido","vr liquido","vr. liquido"]},vrRepasse:{l:"Vr. Repasse",a:["vr. repasse","vr repasse","repasse"]},vrSeguro:{l:"Vr. Seguro",a:["vr. seguro"]},taxa:{l:"Taxa",a:["taxa"]},operacao:{l:"Operação",a:["operação","operacao"]},situacao:{l:"Situação",a:["situação","situacao","status"]},produto:{l:"Produto",a:["produto"]},convenio:{l:"Convênio",a:["convênio","convenio"]},agente:{l:"Agente",a:["agente"]},situacaoBanco:{l:"Sit. Banco",a:["situação banco","situacao banco","sit. banco"]},obsSituacao:{l:"Obs. Sit.",a:["obs. situação banco","obs situação","obs. situacao"]},usuario:{l:"Usuário",a:["usuário","usuario"]}};
function nDate(v){if(!v)return"";if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400*1000));return!isNaN(d.getTime())?d.toISOString().split("T")[0]:"";}const s=String(v).trim(),m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);if(m)return(m[3].length===2?"20"+m[3]:m[3])+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return"";}
function pNum(v){if(v==null||v==="")return 0;if(typeof v==="number")return v;return parseFloat(String(v).replace(/[R$\s.]/g,"").replace(",","."))||0;}

function ImportModal({open,onClose,onImport}){
  const xl=useSheetJS();const fr=useRef(null);const[step,setStep]=useState(1);const[raw,setRaw]=useState([]);const[hd,setHd]=useState([]);const[mp,setMp]=useState({});const[pv,setPv]=useState([]);const[er,setEr]=useState([]);const[dr,setDr]=useState(false);const[fn,setFn]=useState("");
  const reset=()=>{setStep(1);setRaw([]);setHd([]);setMp({});setPv([]);setEr([]);setFn("");};
  useEffect(()=>{if(!open)reset();},[open]);
  const autoMap=cols=>{const m={};Object.entries(IMP).forEach(([f,def])=>{const found=cols.find(c=>{const cl=c.toLowerCase().trim();return def.a.some(a=>cl===a||cl.includes(a));});if(found)m[f]=found;});return m;};
  const parse=file=>{if(!xl||!window.XLSX)return;setFn(file.name);setEr([]);const rd=new FileReader();rd.onload=e=>{try{const wb=window.XLSX.read(new Uint8Array(e.target.result),{type:"array"});const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});if(!rows.length){setEr(["Planilha vazia"]);return;}setRaw(rows);const cols=Object.keys(rows[0]);setHd(cols);setMp(autoMap(cols));setStep(2);}catch(e){setEr(["Erro: "+e.message]);}};rd.readAsArrayBuffer(file);};
  const build=()=>{const errs=[];const built=raw.map((row,i)=>{const cl=mp.cliente?String(row[mp.cliente]||"").trim():"",pr=mp.proposta?String(row[mp.proposta]||"").trim():"",ok=!!(cl||pr);if(!ok)errs.push("Ln "+(i+2));return{_v:ok,id:uid(),id_ext:mp.id_ext?String(row[mp.id_ext]||"").trim():"",banco:mp.banco?String(row[mp.banco]||"").trim():"",cpf:mp.cpf?String(row[mp.cpf]||"").trim():"",cliente:cl,proposta:pr,contrato:mp.contrato?String(row[mp.contrato]||"").trim():"",data:nDate(mp.data?row[mp.data]:""),prazo:mp.prazo?String(row[mp.prazo]||"").trim():"",vrBruto:pNum(mp.vrBruto?row[mp.vrBruto]:""),vrParcela:pNum(mp.vrParcela?row[mp.vrParcela]:""),vrLiquido:pNum(mp.vrLiquido?row[mp.vrLiquido]:""),vrRepasse:pNum(mp.vrRepasse?row[mp.vrRepasse]:""),vrSeguro:pNum(mp.vrSeguro?row[mp.vrSeguro]:""),taxa:mp.taxa?String(row[mp.taxa]||"").trim():"",operacao:mp.operacao?String(row[mp.operacao]||"").trim().toUpperCase():"",situacao:mp.situacao?String(row[mp.situacao]||"").trim().toUpperCase():"",produto:mp.produto?String(row[mp.produto]||"").trim():"",convenio:mp.convenio?String(row[mp.convenio]||"").trim().toUpperCase():"",agente:mp.agente?String(row[mp.agente]||"").trim():"",situacaoBanco:mp.situacaoBanco?String(row[mp.situacaoBanco]||"").trim().toUpperCase():"",obsSituacao:mp.obsSituacao?String(row[mp.obsSituacao]||"").trim():"",usuario:mp.usuario?String(row[mp.usuario]||"").trim():""};});setEr(errs);setPv(built);setStep(3);};
  const go=()=>{onImport(pv.filter(p=>p._v).map(({_v,...r})=>r));onClose();};
  const dl=()=>{if(!window.XLSX)return;const ws=window.XLSX.utils.aoa_to_sheet([["ID","BANCO","CPF","CLIENTE","PROPOSTA","Nº CONTRATO","DATA","PRAZO","VR. BRUTO","VR. PARCELA","VR. LÍQUIDO","VR. REPASSE","VR. SEGURO","TAXA","OPERAÇÃO","SITUAÇÃO","PRODUTO","CONVÊNIO","AGENTE","SITUAÇÃO BANCO","OBS. SITUAÇÃO BANCO","USUÁRIO"],["18011","QUALIBANKING","015.566.609-60","ELIZABETH APARECIDA","QUA556121","QUA556121","31/01/2025","84","9205.32","217.79","7978.97","7978.97","0","1.80","NOVO","ESTORNADO","TOP PLUS 1,80%","INSS","NEWS NEGOCIOS","FINALIZADO","","Bruno Moraes"]]);const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,"Digitações");window.XLSX.writeFile(wb,"modelo_digitacoes.xlsx");};
  if(!open)return null;const vc=pv.filter(p=>p._v).length,tR=pv.filter(p=>p._v).reduce((s,o)=>s+(o.vrRepasse||0),0);
  return(<div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:C.card,border:"1px solid "+C.border,borderRadius:18,width:760,maxWidth:"97vw",maxHeight:"92vh",overflowY:"auto"}}><div style={{padding:"16px 22px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h3 style={{fontFamily:"Outfit",fontWeight:700,fontSize:15,margin:0}}>Importar Digitações</h3><div style={{display:"flex",gap:10,marginTop:6}}>{["Upload","Mapear","Revisar"].map((s,i)=>(<div key={s} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:18,height:18,borderRadius:"50%",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",background:step>i+1?C.accent2:step===i+1?C.accent:C.border,color:step>=i+1?"#fff":C.muted}}>{step>i+1?"✓":i+1}</div><span style={{fontSize:10,color:step===i+1?C.text:C.muted}}>{s}</span></div>))}</div></div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button></div>
    <div style={{padding:"16px 22px"}}>
      {step===1&&<div style={{display:"flex",flexDirection:"column",gap:12}}><div onDragOver={e=>{e.preventDefault();setDr(true);}} onDragLeave={()=>setDr(false)} onDrop={e=>{e.preventDefault();setDr(false);const f=e.dataTransfer.files?.[0];if(f)parse(f);}} onClick={()=>fr.current?.click()} style={{border:"2px dashed "+(dr?C.accent:C.border),borderRadius:14,padding:"36px 20px",textAlign:"center",background:dr?C.accentBg:C.surface,cursor:"pointer"}}><div style={{fontSize:32,marginBottom:6}}>📂</div><div style={{fontSize:13,fontWeight:600}}>{xl?"Arraste ou clique para selecionar":"Carregando..."}</div><div style={{fontSize:11,color:C.muted}}>Suporta .xlsx, .xls, .csv</div><input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)parse(f);}} style={{display:"none"}}/></div>{er.map((e,i)=><div key={i} style={{background:C.dangerBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.danger}}>{e}</div>)}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,borderRadius:10,padding:"10px 14px",border:"1px solid "+C.border}}><span style={{fontSize:12,fontWeight:600}}>📥 Baixar modelo</span><Btn variant="ghost" onClick={dl} style={{fontSize:11}}>Baixar .xlsx</Btn></div></div>}
      {step===2&&<div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{fontSize:12,color:C.muted}}>Arquivo: <strong style={{color:C.text}}>{fn}</strong> · {raw.length} linhas · <strong style={{color:C.accent2}}>{Object.keys(mp).length}</strong> detectados</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{Object.entries(IMP).map(([f,def])=>(<div key={f} style={{display:"flex",flexDirection:"column",gap:2}}><label style={{fontSize:8,color:mp[f]?C.accent:C.muted,fontWeight:600,textTransform:"uppercase"}}>{def.l}</label><select value={mp[f]??""} onChange={e=>setMp(m=>({...m,[f]:e.target.value||undefined}))} style={{background:C.surface,border:"1px solid "+(mp[f]?C.accent+"66":C.border),borderRadius:6,color:mp[f]?C.text:C.muted,padding:"4px 6px",fontSize:10,outline:"none",cursor:"pointer"}}><option value="">—</option>{hd.map(h=><option key={h} value={h}>{h}</option>)}</select></div>))}</div><div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={reset}>←</Btn><Btn onClick={build} style={{flex:1}}>Revisar →</Btn></div></div>}
      {step===3&&<div style={{display:"flex",flexDirection:"column",gap:10}}>{er.length>0&&<div style={{background:C.warnBg,borderRadius:8,padding:"6px 12px",fontSize:11,color:C.warn}}>{er.length} linhas sem cliente/proposta (ignoradas)</div>}<div style={{fontSize:12}}><strong style={{color:C.accent2}}>{vc}</strong> válidas · Repasse: <strong style={{color:C.accent}}>{fmtCur(tR)}</strong></div><div style={{overflowX:"auto",maxHeight:260,borderRadius:8,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}><thead><tr style={{background:C.surface}}>{["","Cliente","Banco","Op.","Situação","Agente","Repasse"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{pv.slice(0,50).map(p=>(<tr key={p.id} style={{borderBottom:"1px solid "+C.border,opacity:p._v?1:.3}}><td style={{padding:"4px 8px",color:p._v?C.accent2:C.danger,fontWeight:700}}>{p._v?"✓":"✕"}</td><td style={{padding:"4px 8px"}}>{p.cliente}</td><td style={{padding:"4px 8px"}}>{p.banco}</td><td style={{padding:"4px 8px"}}>{p.operacao}</td><td style={{padding:"4px 8px"}}><Badge text={p.situacao||"—"} color={sitColor(p.situacao)}/></td><td style={{padding:"4px 8px"}}>{p.agente}</td><td style={{padding:"4px 8px",fontWeight:600}}>{fmtCur(p.vrRepasse)}</td></tr>))}</tbody></table></div><div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(2)}>←</Btn><Btn variant="success" onClick={go} style={{flex:1}} disabled={vc===0}>✓ Importar {vc} ({fmtCur(tR)})</Btn></div></div>}
    </div></div></div>);
}

function ExportModal({open,onClose,ops}){const xl=useSheetJS();const[f,setF]=useState({banco:"",operacao:"",convenio:"",agente:"",situacao:"",dateFrom:"",dateTo:""});const aOf=k=>[...new Set(ops.map(o=>o[k]).filter(Boolean))].sort();const fd=ops.filter(o=>(!f.banco||o.banco===f.banco)&&(!f.operacao||o.operacao===f.operacao)&&(!f.convenio||o.convenio===f.convenio)&&(!f.agente||o.agente===f.agente)&&(!f.situacao||o.situacao===f.situacao)&&(!f.dateFrom||o.data>=f.dateFrom)&&(!f.dateTo||o.data<=f.dateTo));const go=()=>{if(!window.XLSX)return;const ws=window.XLSX.utils.json_to_sheet(fd.map(o=>({"Data":o.data,"Banco":o.banco,"CPF":o.cpf,"Cliente":o.cliente,"Proposta":o.proposta,"Operação":o.operacao,"Situação":o.situacao,"Convênio":o.convenio,"Agente":o.agente,"Vr. Repasse":o.vrRepasse,"Vr. Bruto":o.vrBruto,"Sit. Banco":o.situacaoBanco})));const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,"Dig");window.XLSX.writeFile(wb,"digitacoes_"+TODAY+".xlsx");onClose();};return(<Modal open={open} onClose={onClose} title="Exportar" width={640}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}><Field label="Banco" value={f.banco} onChange={v=>setF(x=>({...x,banco:v}))} options={aOf("banco")}/><Field label="Operação" value={f.operacao} onChange={v=>setF(x=>({...x,operacao:v}))} options={aOf("operacao")}/><Field label="Convênio" value={f.convenio} onChange={v=>setF(x=>({...x,convenio:v}))} options={aOf("convenio")}/><Field label="Agente" value={f.agente} onChange={v=>setF(x=>({...x,agente:v}))} options={aOf("agente")}/><Field label="Situação" value={f.situacao} onChange={v=>setF(x=>({...x,situacao:v}))} options={aOf("situacao")}/><Field label="De" value={f.dateFrom} onChange={v=>setF(x=>({...x,dateFrom:v}))} type="date"/><Field label="Até" value={f.dateTo} onChange={v=>setF(x=>({...x,dateTo:v}))} type="date"/></div><div style={{background:C.surface,borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12}}><strong style={{color:C.accent}}>{fd.length}</strong> · Repasse: <strong style={{color:C.accent2}}>{fmtCur(fd.reduce((s,o)=>s+(o.vrRepasse||0),0))}</strong></div><Btn variant="success" onClick={go} style={{width:"100%"}} disabled={!xl||!fd.length}>📤 Exportar {fd.length}</Btn></Modal>);}

/* DASHBOARD */
function Dashboard({ops}){const p=usePeriod();const f=p.filterOps(ops);const tR=f.reduce((s,o)=>s+(o.vrRepasse||0),0);const fin=f.filter(isFinal);const fR=fin.reduce((s,o)=>s+(o.vrRepasse||0),0);const ags=[...new Set(f.map(o=>o.agente).filter(Boolean))];const tB=f.reduce((s,o)=>s+(o.vrBruto||0),0);
  const topP=useMemo(()=>{const m={};f.forEach(o=>{const a=o.agente||"?";if(!m[a])m[a]={r:0,c:0,fc:0};m[a].r+=(o.vrRepasse||0);m[a].c++;if(isFinal(o))m[a].fc++;});return Object.entries(m).sort((a,b)=>b[1].r-a[1].r).slice(0,8);},[f]);
  const byOp=useMemo(()=>{const m={};f.forEach(o=>{const op=o.operacao||"OUTROS";if(!m[op])m[op]={r:0,c:0};m[op].r+=(o.vrRepasse||0);m[op].c++;});return Object.entries(m).sort((a,b)=>b[1].r-a[1].r);},[f]);
  const bySit=useMemo(()=>{const m={};f.forEach(o=>{const s=o.situacao||"?";if(!m[s])m[s]={c:0,r:0};m[s].c++;m[s].r+=(o.vrRepasse||0);});return Object.entries(m).sort((a,b)=>b[1].c-a[1].c);},[f]);
  const mo={};f.forEach(o=>{const m=o.data?.slice(0,7);if(m){if(!mo[m])mo[m]={r:0,c:0};mo[m].r+=(o.vrRepasse||0);mo[m].c++;}});const srt=Object.entries(mo).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);const mx=Math.max(...srt.map(s=>s[1].r),1);
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Dashboard</h2><PeriodBar p={p}/>
    {ops.length===0?<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"36px 20px",textAlign:"center"}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13,fontWeight:600}}>Nenhuma digitação</div><div style={{fontSize:12,color:C.muted}}>Vá em Operações → Importar</div></div>:<>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Stat label="Produção (Repasse)" value={fmtCur(tR)} color={C.accent}/><Stat label="Pago" value={fmtCur(fR)} color={C.accent2} sub={fin.length+" ops"}/><Stat label="Digitações" value={f.length}/><Stat label="Parceiros" value={ags.length}/><Stat label="Bruto" value={fmtCur(tB)} color={C.info}/></div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Produção Mensal</div><div style={{display:"flex",gap:3,alignItems:"flex-end",height:100}}>{srt.map(([m,v])=>(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:7,color:C.muted}}>{fmtCur(v.r)}</div><div style={{width:"100%",maxWidth:36,background:"linear-gradient(180deg,"+C.accent+","+C.accent2+")",borderRadius:4,height:Math.max(4,(v.r/mx)*85)+"%"}}/><div style={{fontSize:7,color:C.muted}}>{m.slice(5)}/{m.slice(2,4)}</div></div>))}</div></div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Situação</div>{bySit.slice(0,7).map(([s,d])=>(<div key={s} style={{marginBottom:5}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:1}}><span style={{color:sitColor(s),fontWeight:600}}>{s}</span><span style={{color:C.muted}}>{d.c}</span></div><div style={{height:4,background:C.surface,borderRadius:2}}><div style={{height:"100%",background:sitColor(s),borderRadius:2,width:(d.c/(f.length||1)*100)+"%"}}/></div></div>))}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Top Parceiros</div>{topP.map(([ag,d],i)=>(<div key={ag} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:"1px solid "+C.border}}><div style={{width:18,height:18,borderRadius:5,background:i<3?C.accent:C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:i<3?"#fff":C.muted,flexShrink:0}}>{i+1}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:10,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ag}</div><div style={{fontSize:8,color:C.muted}}>{d.c} dig · {d.fc} pagas</div></div><div style={{fontSize:10,fontWeight:700,color:C.accent2,flexShrink:0}}>{fmtCur(d.r)}</div></div>))}</div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Operações</div>{byOp.map(([op,d])=>(<div key={op} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:1}}><span style={{fontWeight:600}}>{op}</span><span style={{color:C.accent}}>{fmtCur(d.r)}</span></div><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{flex:1,height:5,background:C.surface,borderRadius:2}}><div style={{height:"100%",background:C.accent,borderRadius:2,width:(d.r/(tR||1)*100)+"%"}}/></div><span style={{fontSize:8,color:C.muted}}>{d.c}</span></div></div>))}</div></div>
    </>}</div>);}

/* OPERACOES */
function Operacoes({ops,setOps}){const[io,sio]=useState(false);const[eo,seo]=useState(false);const[se,sse]=useState("");const[fs,sfs]=useState("");const[fb,sfb]=useState("");const[fo,sfo]=useState("");const[dt,sdt]=useState(null);
  const aS=[...new Set(ops.map(o=>o.situacao).filter(Boolean))].sort(),aB=[...new Set(ops.map(o=>o.banco).filter(Boolean))].sort(),aO=[...new Set(ops.map(o=>o.operacao).filter(Boolean))].sort();
  const fd=ops.filter(o=>(!fs||o.situacao===fs)&&(!fb||o.banco===fb)&&(!fo||o.operacao===fo)).filter(o=>{if(!se)return true;const s=se.toLowerCase();return(o.cliente?.toLowerCase().includes(s)||o.proposta?.toLowerCase().includes(s)||o.agente?.toLowerCase().includes(s)||o.cpf?.includes(s));}).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Operações</h2><div style={{display:"flex",gap:6}}><Btn variant="ghost" onClick={()=>sio(true)}>📥 Importar</Btn><Btn variant="ghost" onClick={()=>seo(true)}>📤 Exportar</Btn></div></div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><input value={se} onChange={e=>sse(e.target.value)} placeholder="Buscar..." style={{background:C.surface,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"7px 12px",fontSize:12,outline:"none",flex:1,minWidth:160,fontFamily:"Outfit"}}/><Field value={fs} onChange={sfs} options={aS} style={{minWidth:90}}/><Field value={fb} onChange={sfb} options={aB} style={{minWidth:90}}/><Field value={fo} onChange={sfo} options={aO} style={{minWidth:90}}/></div>
    <div style={{fontSize:10,color:C.muted}}>{fd.length} registros · Repasse: <strong style={{color:C.accent}}>{fmtCur(fd.reduce((s,o)=>s+(o.vrRepasse||0),0))}</strong></div>
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["Data","Cliente","Banco","Op.","Situação","Conv.","Agente","Repasse"].map(h=><th key={h} style={{padding:"8px 9px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{fd.slice(0,200).map(o=>(<tr key={o.id} style={{borderBottom:"1px solid "+C.border,cursor:"pointer"}} onClick={()=>sdt(o)}><td style={{padding:"7px 9px",whiteSpace:"nowrap"}}>{fmtDate(o.data)}</td><td style={{padding:"7px 9px",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cliente||"—"}</td><td style={{padding:"7px 9px"}}>{o.banco}</td><td style={{padding:"7px 9px"}}>{o.operacao}</td><td style={{padding:"7px 9px"}}><Badge text={o.situacao||"—"} color={sitColor(o.situacao)}/></td><td style={{padding:"7px 9px"}}>{o.convenio}</td><td style={{padding:"7px 9px",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.agente}</td><td style={{padding:"7px 9px",fontWeight:600}}>{fmtCur(o.vrRepasse)}</td></tr>))}</tbody></table>{fd.length===0&&<div style={{padding:24,textAlign:"center",color:C.muted}}>Nenhuma digitação. Importe sua planilha.</div>}</div>
    <Modal open={!!dt} onClose={()=>sdt(null)} title="Detalhes" width={500}>{dt&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>{[["Cliente",dt.cliente],["CPF",dt.cpf],["Proposta",dt.proposta],["Contrato",dt.contrato],["Data",fmtDate(dt.data)],["Banco",dt.banco],["Operação",dt.operacao],["Situação",dt.situacao],["Convênio",dt.convenio],["Agente",dt.agente],["Prazo",dt.prazo],["Taxa",dt.taxa],["Bruto",fmtCur(dt.vrBruto)],["Parcela",fmtCur(dt.vrParcela)],["Líquido",fmtCur(dt.vrLiquido)],["Repasse",fmtCur(dt.vrRepasse)],["Produto",dt.produto],["Sit. Banco",dt.situacaoBanco]].map(([l,v])=>(<div key={l}><div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:1}}>{l}</div><div style={{fontWeight:500}}>{v||"—"}</div></div>))}</div>}</Modal>
    <ImportModal open={io} onClose={()=>sio(false)} onImport={d=>setOps(p=>[...p,...d])}/><ExportModal open={eo} onClose={()=>seo(false)} ops={ops}/>
  </div>);}

/* KANBAN */
function Kanban({ops,setOps}){const per=usePeriod();const[fa,sfa]=useState("");const[fo,sfo]=useState("");const[fb,sfb]=useState("");const[dt,sdt]=useState(null);const base=per.filterOps(ops);const fd=base.filter(o=>(!fa||o.agente===fa)&&(!fo||o.operacao===fo)&&(!fb||o.banco===fb));
  const sits=useMemo(()=>{const s=[...new Set(ops.map(o=>o.situacao).filter(Boolean))];const ord=["NOVO","PENDENTE","EM ANÁLISE","APROVADO","PAGO","CONCRETIZADO","PAGO C/ PENDENCIA","ESTORNADO","CANCELADO","RECUSADO"];return s.sort((a,b)=>(ord.indexOf(a)===-1?99:ord.indexOf(a))-(ord.indexOf(b)===-1?99:ord.indexOf(b)));},[ops]);
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Kanban</h2><PeriodBar p={per}/>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}><Field label="Parceiro" value={fa} onChange={sfa} options={[...new Set(base.map(o=>o.agente).filter(Boolean))].sort()} style={{minWidth:130}}/><Field label="Op." value={fo} onChange={sfo} options={[...new Set(base.map(o=>o.operacao).filter(Boolean))].sort()} style={{minWidth:100}}/><Field label="Banco" value={fb} onChange={sfb} options={[...new Set(base.map(o=>o.banco).filter(Boolean))].sort()} style={{minWidth:100}}/>{(fa||fo||fb)&&<Btn variant="ghost" onClick={()=>{sfa("");sfo("");sfb("");}} style={{fontSize:10,marginTop:14}}>Limpar</Btn>}</div>
    <div style={{fontSize:10,color:C.muted}}>{fd.length} dig · {fmtCur(fd.reduce((s,o)=>s+(o.vrRepasse||0),0))}</div>
    {sits.length===0?<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}>Importe digitações</div>:<div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6}}>{sits.map(sit=>{const it=fd.filter(o=>o.situacao===sit);const sc=sitColor(sit);const r=it.reduce((s,o)=>s+(o.vrRepasse||0),0);return(<div key={sit} style={{minWidth:190,flex:1,background:C.surface,borderRadius:10,border:"1px solid "+C.border}}><div style={{padding:"8px 10px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={{fontSize:11,fontWeight:700,color:sc}}>{sit}</span><div style={{fontSize:8,color:C.muted}}>{fmtCur(r)}</div></div><span style={{fontSize:9,background:sc+"22",color:sc,padding:"2px 6px",borderRadius:6,fontWeight:700}}>{it.length}</span></div><div style={{padding:4,display:"flex",flexDirection:"column",gap:3,maxHeight:360,overflowY:"auto"}}>{it.slice(0,25).map(o=>(<div key={o.id} onClick={()=>sdt(o)} style={{background:C.card,border:"1px solid "+C.border,borderRadius:7,padding:"6px 8px",cursor:"pointer"}}><div style={{fontSize:10,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cliente||o.proposta}</div><div style={{fontSize:8,color:C.muted}}>{o.banco} · {o.operacao} · {fmtCur(o.vrRepasse)}</div><div style={{fontSize:7,color:C.muted}}>{o.agente}</div><div style={{display:"flex",gap:2,marginTop:3,flexWrap:"wrap"}}>{sits.filter(s=>s!==sit).slice(0,3).map(s=>(<button key={s} onClick={e=>{e.stopPropagation();setOps(prev=>prev.map(x=>x.id===o.id?{...x,situacao:s}:x));}} style={{fontSize:7,padding:"1px 3px",borderRadius:3,border:"1px solid "+C.border,background:C.surface,color:sitColor(s),cursor:"pointer",fontWeight:600}}>→{s}</button>))}</div></div>))}{it.length===0&&<div style={{padding:10,textAlign:"center",color:C.muted,fontSize:9}}>—</div>}</div></div>);})}</div>}
    <Modal open={!!dt} onClose={()=>sdt(null)} title="Detalhes" width={460}>{dt&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>{[["Cliente",dt.cliente],["Banco",dt.banco],["Op.",dt.operacao],["Situação",dt.situacao],["Agente",dt.agente],["Repasse",fmtCur(dt.vrRepasse)],["Bruto",fmtCur(dt.vrBruto)],["Data",fmtDate(dt.data)]].map(([l,v])=>(<div key={l}><div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:"uppercase"}}>{l}</div><div style={{fontWeight:500}}>{v||"—"}</div></div>))}</div>}</Modal>
  </div>);}

/* CADASTROS */
function Cadastros({ops,cad,setCad}){
  const per=usePeriod();const filtered=per.filterOps(ops);const xl=useSheetJS();const fr=useRef(null);const[search,setSearch]=useState("");const[fStatus,setFStatus]=useState("");

  const opsAgentes=[...new Set(ops.map(o=>o.agente).filter(Boolean))];
  const missing=opsAgentes.filter(a=>!cad.some(c=>c.name.toLowerCase()===a.toLowerCase()));

  const autoImport=()=>{const nw=missing.map(a=>({id:uid(),name:a,contato:"",obs:"",status:"Ativo"}));if(nw.length)setCad(prev=>[...prev,...nw]);};

  const importFile=file=>{if(!xl||!window.XLSX)return;const rd=new FileReader();rd.onload=e=>{try{const wb=window.XLSX.read(new Uint8Array(e.target.result),{type:"array"});const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});const cols=Object.keys(rows[0]||{});const nc=cols.find(c=>/nome|parceiro|agente|name/i.test(c));const cc=cols.find(c=>/contato|telefone|email|fone/i.test(c));const oc=cols.find(c=>/obs|nota/i.test(c));const sc=cols.find(c=>/status|situação|ativo/i.test(c));
    const ex=new Set(cad.map(c=>c.name.toLowerCase()));const nw=[];
    rows.forEach(r=>{const n=nc?String(r[nc]||"").trim():"";if(n&&!ex.has(n.toLowerCase())){ex.add(n.toLowerCase());nw.push({id:uid(),name:n,contato:cc?String(r[cc]||"").trim():"",obs:oc?String(r[oc]||"").trim():"",status:sc?String(r[sc]||"Ativo").trim():"Ativo"});}});
    if(nw.length)setCad(prev=>[...prev,...nw]);}catch(e){alert("Erro: "+e.message);}};rd.readAsArrayBuffer(file);};

  const stats=useMemo(()=>cad.map(c=>{const all=filtered.filter(o=>o.agente?.toLowerCase()===c.name.toLowerCase());const allTime=ops.filter(o=>o.agente?.toLowerCase()===c.name.toLowerCase());const r=all.reduce((s,o)=>s+(o.vrRepasse||0),0);const fin=all.filter(isFinal);const lastOp=[...allTime].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];const days=lastOp?Math.floor((NOW-new Date(lastOp.data))/86400000):999;
    let computed="Ativo";if(all.length===0&&days>60)computed="Improdutivo";else if(all.length===0&&days>30)computed="Inativo";else if(all.length===0)computed="Sem produção";
    return{...c,count:all.length,repasse:r,finCount:fin.length,conv:all.length?(fin.length/all.length*100):0,lastDate:lastOp?.data,days,computed,totalAll:allTime.length};}).sort((a,b)=>b.repasse-a.repasse),[cad,filtered,ops]);

  const byStatus=useMemo(()=>{const m={Ativo:0,Inativo:0,Improdutivo:0,"Sem produção":0};stats.forEach(s=>{m[s.computed]=(m[s.computed]||0)+1;});return Object.entries(m).filter(([,v])=>v>0);},[stats]);

  const fd=stats.filter(s=>(!search||s.name.toLowerCase().includes(search.toLowerCase()))&&(!fStatus||s.computed===fStatus));

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Cadastros</h2>
      <div style={{display:"flex",gap:6}}>
        {missing.length>0&&<Btn onClick={autoImport} style={{background:C.warnBg,color:C.warn,border:"1px solid "+C.warn+"44",fontSize:11}}>⚡ Importar {missing.length} das digitações</Btn>}
        <Btn variant="ghost" onClick={()=>fr.current?.click()} style={{fontSize:11}}>📥 Importar planilha</Btn>
        <input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)importFile(f);}} style={{display:"none"}}/>
      </div>
    </div>
    <PeriodBar p={per}/>

    {/* Summary cards */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <Stat label="Total Cadastrados" value={cad.length}/>
      {byStatus.map(([s,c])=>{const col=s==="Ativo"?C.accent2:s==="Improdutivo"?C.danger:s==="Inativo"?C.warn:C.muted;return<Stat key={s} label={s} value={c} color={col}/>;})}
      <Stat label="Com Produção" value={stats.filter(s=>s.count>0).length} color={C.accent}/>
    </div>

    {/* Status breakdown visual */}
    {cad.length>0&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}>
      <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Distribuição</div>
      <div style={{display:"flex",height:24,borderRadius:6,overflow:"hidden"}}>{byStatus.map(([s,c])=>{const col=s==="Ativo"?C.accent2:s==="Improdutivo"?C.danger:s==="Inativo"?C.warn:C.muted;const pct=cad.length?(c/cad.length*100):0;return pct>0?<div key={s} style={{width:pct+"%",background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:600,minWidth:pct>5?0:20}} title={s+": "+c}>{pct>10?s+" ("+c+")":c}</div>:null;})}</div>
    </div>}

    {/* Filters */}
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar parceiro..." style={{background:C.surface,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"7px 12px",fontSize:12,outline:"none",flex:1,minWidth:160,fontFamily:"Outfit"}}/>
      <Field value={fStatus} onChange={setFStatus} options={byStatus.map(([s])=>s)} style={{minWidth:110}}/>
    </div>

    {/* Table */}
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["Parceiro","Status","Digitações","Repasse","Pagas","Conv.","Última","Dias","Total"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
    <tbody>{fd.map(s=>{const col=s.computed==="Ativo"?C.accent2:s.computed==="Improdutivo"?C.danger:s.computed==="Inativo"?C.warn:C.muted;return(<tr key={s.id} style={{borderBottom:"1px solid "+C.border}}>
      <td style={{padding:"8px 10px",fontWeight:600}}>{s.name}</td>
      <td style={{padding:"8px 10px"}}><Badge text={s.computed} color={col}/></td>
      <td style={{padding:"8px 10px"}}>{s.count}</td>
      <td style={{padding:"8px 10px",fontWeight:600,color:C.accent}}>{fmtCur(s.repasse)}</td>
      <td style={{padding:"8px 10px",color:C.accent2}}>{s.finCount}</td>
      <td style={{padding:"8px 10px"}}><span style={{color:s.conv>=50?C.accent2:s.conv>=30?C.warn:C.danger,fontWeight:600}}>{s.conv.toFixed(0)}%</span></td>
      <td style={{padding:"8px 10px"}}>{s.lastDate?fmtDate(s.lastDate):"Nunca"}</td>
      <td style={{padding:"8px 10px",color:s.days>60?C.danger:s.days>30?C.warn:C.text}}>{s.days<999?s.days+"d":"—"}</td>
      <td style={{padding:"8px 10px"}}>{s.totalAll}</td>
    </tr>);})}</tbody></table>
    {fd.length===0&&<div style={{padding:24,textAlign:"center",color:C.muted}}>Nenhum cadastro. Importe parceiros.</div>}
    </div>
  </div>);}

/* PARCEIROS – strategic view */
function Parceiros({ops,cad}){const per=usePeriod();const f=per.filterOps(ops);const[sel,sSel]=useState(null);
  const agentes=[...new Set(ops.map(o=>o.agente).filter(Boolean))];
  const list=useMemo(()=>agentes.map(a=>{const all=f.filter(o=>o.agente===a);const allT=ops.filter(o=>o.agente===a);const r=all.reduce((s,o)=>s+(o.vrRepasse||0),0);const fn=all.filter(isFinal);const fR=fn.reduce((s,o)=>s+(o.vrRepasse||0),0);const cv=all.length?(fn.length/all.length*100):0;
    const bOp={};all.forEach(o=>{const op=o.operacao||"?";if(!bOp[op])bOp[op]={c:0,r:0,fc:0};bOp[op].c++;bOp[op].r+=(o.vrRepasse||0);if(isFinal(o))bOp[op].fc++;});
    const bBk={};all.forEach(o=>{const b=o.banco||"?";if(!bBk[b])bBk[b]={c:0,r:0,fc:0};bBk[b].c++;bBk[b].r+=(o.vrRepasse||0);if(isFinal(o))bBk[b].fc++;});
    const bSit={};all.forEach(o=>{const s=o.situacao||"?";if(!bSit[s])bSit[s]={c:0,r:0};bSit[s].c++;bSit[s].r+=(o.vrRepasse||0);});
    const mo={};allT.forEach(o=>{const m=o.data?.slice(0,7);if(m){if(!mo[m])mo[m]={r:0,c:0};mo[m].r+=(o.vrRepasse||0);mo[m].c++;}});
    const last=[...allT].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];
    return{name:a,count:all.length,r,fR,fC:fn.length,cv,byOp:Object.entries(bOp).sort((x,y)=>y[1].r-x[1].r),byBanco:Object.entries(bBk).sort((x,y)=>y[1].r-x[1].r),bySit:Object.entries(bSit).sort((x,y)=>y[1].c-x[1].c),months:Object.entries(mo).sort((x,y)=>x[0].localeCompare(y[0])).slice(-6),lastDate:last?.data,totalAll:allT.length,contato:cad.find(c=>c.name.toLowerCase()===a.toLowerCase())?.contato||""};
  }).sort((a,b)=>b.r-a.r),[agentes,f,ops,cad]);
  const s=sel?list.find(l=>l.name===sel):null;
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Visão Estratégica</h2><PeriodBar p={per}/>
    {!s?<div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["Parceiro","Dig.","Repasse","Pagas","Conv.","Última",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{list.map(p=>(<tr key={p.name} style={{borderBottom:"1px solid "+C.border,cursor:"pointer"}} onClick={()=>sSel(p.name)}><td style={{padding:"8px 10px",fontWeight:600}}>{p.name}</td><td style={{padding:"8px 10px"}}>{p.count}</td><td style={{padding:"8px 10px",fontWeight:600,color:C.accent}}>{fmtCur(p.r)}</td><td style={{padding:"8px 10px",color:C.accent2}}>{p.fC}</td><td style={{padding:"8px 10px"}}><span style={{color:p.cv>=50?C.accent2:p.cv>=30?C.warn:C.danger,fontWeight:600}}>{p.cv.toFixed(0)}%</span></td><td style={{padding:"8px 10px"}}>{p.lastDate?fmtDate(p.lastDate):"—"}</td><td style={{padding:"8px 10px",color:C.accent,fontSize:10}}>Ver →</td></tr>))}</tbody></table>{list.length===0&&<div style={{padding:24,textAlign:"center",color:C.muted}}>Importe digitações primeiro</div>}</div>
    :<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button onClick={()=>sSel(null)} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:C.accent,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"Outfit"}}>← Voltar</button><h3 style={{fontFamily:"Outfit",fontWeight:700,fontSize:17}}>{s.name}</h3>{s.contato&&<span style={{fontSize:10,color:C.muted}}>{s.contato}</span>}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Stat label="Digitações" value={s.count}/><Stat label="Repasse" value={fmtCur(s.r)} color={C.accent}/><Stat label="Pagas" value={s.fC} sub={fmtCur(s.fR)} color={C.accent2}/><Stat label="Conversão" value={s.cv.toFixed(1)+"%"} color={s.cv>=50?C.accent2:s.cv>=30?C.warn:C.danger}/><Stat label="Total Geral" value={s.totalAll}/></div>
      {s.months.length>0&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Evolução</div><div style={{display:"flex",gap:5,alignItems:"flex-end",height:80}}>{(()=>{const mx=Math.max(...s.months.map(([,v])=>v.r),1);return s.months.map(([m,v])=>(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:7,color:C.muted}}>{fmtCur(v.r)}</div><div style={{width:"100%",maxWidth:34,background:"linear-gradient(180deg,"+C.accent+","+C.accent2+")",borderRadius:4,height:Math.max(4,(v.r/mx)*70)+"%"}}/><div style={{fontSize:7,color:C.muted}}>{m.slice(5)}</div></div>));})()}</div></div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Por Operação</div>{s.byOp.map(([op,d])=>{const rt=d.c?(d.fc/d.c*100):0;return(<div key={op} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{fontWeight:600}}>{op}</span><span style={{color:C.accent}}>{fmtCur(d.r)}</span></div><div style={{fontSize:9,color:C.muted}}>{d.c} dig · {d.fc} pagas · <span style={{color:rt>=50?C.accent2:rt>=30?C.warn:C.danger,fontWeight:600}}>{rt.toFixed(0)}%</span></div></div>);})}</div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Por Banco</div>{s.byBanco.map(([b,d])=>{const rt=d.c?(d.fc/d.c*100):0;return(<div key={b} style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10}}><span style={{fontWeight:600}}>{b}</span><span style={{color:C.accent}}>{fmtCur(d.r)}</span></div><div style={{fontSize:9,color:C.muted}}>{d.c} dig · {d.fc} pagas · <span style={{color:rt>=50?C.accent2:rt>=30?C.warn:C.danger,fontWeight:600}}>{rt.toFixed(0)}%</span></div></div>);})}</div>
      </div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Situações</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{s.bySit.map(([st,d])=>(<div key={st} style={{background:C.surface,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.border}}><div style={{fontSize:15,fontWeight:700,color:sitColor(st)}}>{d.c}</div><div style={{fontSize:9,color:sitColor(st),fontWeight:600}}>{st}</div><div style={{fontSize:8,color:C.muted}}>{fmtCur(d.r)}</div></div>))}</div></div>
      <div style={{background:C.card,border:"1px solid "+C.accent+"33",borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:8}}>📌 Pontos para Conversa</div><div style={{display:"flex",flexDirection:"column",gap:4,fontSize:11}}>
        {s.count===0&&<div style={{color:C.danger}}>⚠ Sem digitação no período — verificar atividade</div>}
        {s.cv<30&&s.count>0&&<div style={{color:C.danger}}>⚠ Conversão baixa ({s.cv.toFixed(0)}%) — revisar qualidade e estornos</div>}
        {s.cv>=30&&s.cv<50&&s.count>0&&<div style={{color:C.warn}}>⚡ Conversão razoável ({s.cv.toFixed(0)}%) — alinhar bancos e produtos</div>}
        {s.cv>=50&&s.count>0&&<div style={{color:C.accent2}}>✓ Boa conversão ({s.cv.toFixed(0)}%) — manter e aumentar volume</div>}
        {s.byOp.length>0&&<div>📊 Principal: <strong>{s.byOp[0][0]}</strong> ({s.byOp[0][1].c} dig, {fmtCur(s.byOp[0][1].r)})</div>}
        {s.byBanco.length>0&&<div>🏦 Banco principal: <strong>{s.byBanco[0][0]}</strong></div>}
        {s.bySit.find(([x])=>x==="ESTORNADO")&&<div style={{color:C.danger}}>⚠ {s.bySit.find(([x])=>x==="ESTORNADO")[1].c} estornos — investigar</div>}
        {s.months.length>=2&&(()=>{const l=s.months[s.months.length-1][1].r,p=s.months[s.months.length-2][1].r,v=p?((l-p)/p*100):0;return v<-20?<div style={{color:C.danger}}>📉 Queda de {Math.abs(v).toFixed(0)}% último mês</div>:v>20?<div style={{color:C.accent2}}>📈 Crescimento de {v.toFixed(0)}%</div>:null;})()}
      </div></div>
    </div>}
  </div>);}

/* PORTABILIDADE */
function Portabilidade({ops}){const per=usePeriod();const f=per.filterOps(ops);const port=useMemo(()=>f.filter(o=>(o.operacao||"").toUpperCase()==="PORTABILIDADE"),[f]);
  const bB=useMemo(()=>{const m={};port.forEach(o=>{const b=o.banco||"?";if(!m[b])m[b]={d:0,p:0,rd:0,rp:0};m[b].d++;m[b].rd+=(o.vrRepasse||0);if(isFinal(o)){m[b].p++;m[b].rp+=(o.vrRepasse||0);}});return Object.entries(m).sort((a,b)=>b[1].d-a[1].d);},[port]);
  const bA=useMemo(()=>{const m={};port.forEach(o=>{const a=o.agente||"?";if(!m[a])m[a]={d:0,p:0,rd:0,rp:0};m[a].d++;m[a].rd+=(o.vrRepasse||0);if(isFinal(o)){m[a].p++;m[a].rp+=(o.vrRepasse||0);}});return Object.entries(m).sort((a,b)=>b[1].d-a[1].d);},[port]);
  const tD=port.length,tP=port.filter(isFinal).length,tRD=port.reduce((s,o)=>s+(o.vrRepasse||0),0),tRP=port.filter(isFinal).reduce((s,o)=>s+(o.vrRepasse||0),0),cv=tD?(tP/tD*100):0;
  const RB=({r})=>(<div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:45,height:5,background:C.surface,borderRadius:3}}><div style={{height:"100%",background:r>=50?C.accent2:r>=30?C.warn:C.danger,borderRadius:3,width:r+"%"}}/></div><span style={{fontWeight:600,color:r>=50?C.accent2:r>=30?C.warn:C.danger,fontSize:10}}>{r.toFixed(1)}%</span></div>);
  const TB=({data,nl})=>(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{[nl,"Dig.","Pago","Conv.","Rep. Dig.","Rep. Pago"].map(h=><th key={h} style={{padding:"7px 9px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{data.map(([n,d])=>{const r=d.d?(d.p/d.d*100):0;return(<tr key={n} style={{borderBottom:"1px solid "+C.border}}><td style={{padding:"7px 9px",fontWeight:600,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n}</td><td style={{padding:"7px 9px"}}>{d.d}</td><td style={{padding:"7px 9px",color:C.accent2,fontWeight:600}}>{d.p}</td><td style={{padding:"7px 9px"}}><RB r={r}/></td><td style={{padding:"7px 9px"}}>{fmtCur(d.rd)}</td><td style={{padding:"7px 9px",fontWeight:600,color:C.accent2}}>{fmtCur(d.rp)}</td></tr>);})}</tbody></table></div>);
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Portabilidade</h2><PeriodBar p={per}/>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Stat label="Digitado" value={tD} sub={fmtCur(tRD)}/><Stat label="Pago" value={tP} sub={fmtCur(tRP)} color={C.accent2}/><Stat label="Conversão" value={cv.toFixed(1)+"%"} color={cv>=50?C.accent2:cv>=30?C.warn:C.danger}/></div>
    {port.length===0?<div style={{background:C.card,borderRadius:14,padding:24,textAlign:"center",color:C.muted}}>Nenhuma PORTABILIDADE no período</div>:<><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Banco</div><TB data={bB} nl="Banco"/></div><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Parceiro</div><TB data={bA} nl="Parceiro"/></div></>}
  </div>);}

/* PRODUÇÃO – por Banco, Convênio, Operação */
function Producao({ops}){const per=usePeriod();const f=per.filterOps(ops);const[tab,setTab]=useState("banco");
  const totalR=f.reduce((s,o)=>s+(o.vrRepasse||0),0);const totalB=f.reduce((s,o)=>s+(o.vrBruto||0),0);const totalFin=f.filter(isFinal);const totalFR=totalFin.reduce((s,o)=>s+(o.vrRepasse||0),0);

  const buildData=(keyFn)=>{const m={};f.forEach(o=>{const k=keyFn(o)||"SEM INFO";if(!m[k])m[k]={c:0,r:0,br:0,fc:0,fr:0,subs:{},parceiros:{}};m[k].c++;m[k].r+=(o.vrRepasse||0);m[k].br+=(o.vrBruto||0);if(isFinal(o)){m[k].fc++;m[k].fr+=(o.vrRepasse||0);}
    // sub-breakdown depends on tab
    const sub=tab==="banco"?o.operacao||"?":tab==="convenio"?o.operacao||"?":o.banco||"?";
    if(!m[k].subs[sub])m[k].subs[sub]={c:0,r:0,fc:0};m[k].subs[sub].c++;m[k].subs[sub].r+=(o.vrRepasse||0);if(isFinal(o))m[k].subs[sub].fc++;
    // top parceiros
    const ag=o.agente||"?";if(!m[k].parceiros[ag])m[k].parceiros[ag]={c:0,r:0,fc:0};m[k].parceiros[ag].c++;m[k].parceiros[ag].r+=(o.vrRepasse||0);if(isFinal(o))m[k].parceiros[ag].fc++;
  });return Object.entries(m).sort((a,b)=>b[1].r-a[1].r);};

  const data=useMemo(()=>{
    if(tab==="banco")return buildData(o=>o.banco);
    if(tab==="convenio")return buildData(o=>o.convenio);
    return buildData(o=>o.operacao);
  },[f,tab]);

  const subLabel=tab==="banco"?"Operações":tab==="convenio"?"Operações":"Bancos";
  const tabs=[{id:"banco",label:"Por Banco",icon:"🏦"},{id:"convenio",label:"Por Convênio",icon:"📑"},{id:"operacao",label:"Por Operação",icon:"⚡"}];

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Produção</h2>
    <PeriodBar p={per}/>

    {/* Tabs */}
    <div style={{display:"flex",gap:4}}>{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid "+(tab===t.id?C.accent:C.border),background:tab===t.id?C.accentBg:"transparent",color:tab===t.id?C.accent:C.muted,fontSize:12,fontWeight:tab===t.id?600:400,cursor:"pointer",fontFamily:"Outfit",display:"flex",alignItems:"center",gap:5}}><span>{t.icon}</span>{t.label}</button>))}</div>

    {/* Summary */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <Stat label="Repasse Total" value={fmtCur(totalR)} color={C.accent}/>
      <Stat label="Pago" value={fmtCur(totalFR)} color={C.accent2} sub={totalFin.length+" ops"}/>
      <Stat label="Bruto" value={fmtCur(totalB)} color={C.info}/>
      <Stat label="Digitações" value={f.length}/>
      <Stat label={tab==="banco"?"Bancos":tab==="convenio"?"Convênios":"Operações"} value={data.length}/>
    </div>

    {/* Ranking table */}
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>
        {[tab==="banco"?"Banco":tab==="convenio"?"Convênio":"Operação","Dig.","Repasse","%","Pago","Conv.","Bruto","Top Parceiro"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}
      </tr></thead><tbody>{data.map(([name,d])=>{
        const pct=totalR?(d.r/totalR*100):0;const cv=d.c?(d.fc/d.c*100):0;
        const topP=Object.entries(d.parceiros).sort((a,b)=>b[1].r-a[1].r)[0];
        return(<tr key={name} style={{borderBottom:"1px solid "+C.border}}>
          <td style={{padding:"8px 10px",fontWeight:700}}>{name}</td>
          <td style={{padding:"8px 10px"}}>{d.c}</td>
          <td style={{padding:"8px 10px",fontWeight:600,color:C.accent}}>{fmtCur(d.r)}</td>
          <td style={{padding:"8px 10px"}}><div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:40,height:5,background:C.surface,borderRadius:2}}><div style={{height:"100%",background:C.accent,borderRadius:2,width:pct+"%"}}/></div><span style={{fontSize:9,color:C.muted}}>{pct.toFixed(1)}%</span></div></td>
          <td style={{padding:"8px 10px",color:C.accent2,fontWeight:600}}>{fmtCur(d.fr)}</td>
          <td style={{padding:"8px 10px"}}><span style={{fontWeight:600,color:cv>=50?C.accent2:cv>=30?C.warn:C.danger}}>{cv.toFixed(0)}%</span></td>
          <td style={{padding:"8px 10px"}}>{fmtCur(d.br)}</td>
          <td style={{padding:"8px 10px",fontSize:10}}>{topP?<span>{topP[0]} <span style={{color:C.muted}}>({topP[1].c})</span></span>:"—"}</td>
        </tr>);
      })}</tbody></table>
      {data.length===0&&<div style={{padding:24,textAlign:"center",color:C.muted}}>Sem dados no período</div>}
    </div>

    {/* Detail cards */}
    {data.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
      {data.slice(0,12).map(([name,d])=>{
        const cv=d.c?(d.fc/d.c*100):0;
        const subs=Object.entries(d.subs).sort((a,b)=>b[1].r-a[1].r);
        const tops=Object.entries(d.parceiros).sort((a,b)=>b[1].r-a[1].r).slice(0,5);
        return(<div key={name} style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:14,fontWeight:700}}>{name}</span>
            <span style={{fontSize:10,color:C.muted}}>{d.c} dig</span>
          </div>

          {/* Metrics */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
            <div><div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:"uppercase"}}>Repasse</div><div style={{fontSize:13,fontWeight:700,color:C.accent}}>{fmtCur(d.r)}</div></div>
            <div><div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:"uppercase"}}>Pago</div><div style={{fontSize:13,fontWeight:700,color:C.accent2}}>{fmtCur(d.fr)}</div></div>
            <div><div style={{fontSize:8,color:C.muted,fontWeight:600,textTransform:"uppercase"}}>Conv.</div><div style={{fontSize:13,fontWeight:700,color:cv>=50?C.accent2:cv>=30?C.warn:C.danger}}>{cv.toFixed(0)}%</div></div>
          </div>

          {/* Sub breakdown */}
          <div style={{fontSize:10,fontWeight:600,marginBottom:4,color:C.muted}}>{subLabel}</div>
          {subs.slice(0,5).map(([sub,sd])=>{const sr=d.r?(sd.r/d.r*100):0;return(<div key={sub} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0"}}>
            <span style={{fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</span>
            <div style={{width:40,height:4,background:C.surface,borderRadius:2,flexShrink:0}}><div style={{height:"100%",background:C.info,borderRadius:2,width:sr+"%"}}/></div>
            <span style={{fontSize:9,color:C.muted,minWidth:28,textAlign:"right"}}>{sd.c}</span>
            <span style={{fontSize:9,fontWeight:600,minWidth:65,textAlign:"right"}}>{fmtCur(sd.r)}</span>
          </div>);})}

          {/* Top parceiros */}
          {tops.length>0&&<><div style={{fontSize:10,fontWeight:600,marginBottom:4,marginTop:8,color:C.muted}}>Top Parceiros</div>
          {tops.map(([ag,ad],i)=>{const acv=ad.c?(ad.fc/ad.c*100):0;return(<div key={ag} style={{display:"flex",alignItems:"center",gap:6,padding:"2px 0"}}>
            <span style={{fontSize:9,color:i<3?C.accent:C.muted,fontWeight:700,width:12}}>{i+1}</span>
            <span style={{fontSize:10,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ag}</span>
            <span style={{fontSize:9,color:acv>=50?C.accent2:acv>=30?C.warn:C.danger,fontWeight:600}}>{acv.toFixed(0)}%</span>
            <span style={{fontSize:9,fontWeight:600,minWidth:60,textAlign:"right"}}>{fmtCur(ad.r)}</span>
          </div>);})}
          </>}
        </div>);
      })}
    </div>}
  </div>);
}

/* ANÁLISE */
function Analise({ops}){const per=usePeriod();const f=per.filterOps(ops);const ags=[...new Set(ops.map(o=>o.agente).filter(Boolean))];const cM=NOW.toISOString().slice(0,7);const pM=new Date(NOW.getFullYear(),NOW.getMonth()-1,1).toISOString().slice(0,7);
  const st=ags.map(a=>{const al=f.filter(o=>o.agente===a);const cu=ops.filter(o=>o.agente===a&&o.data?.startsWith(cM));const pv=ops.filter(o=>o.agente===a&&o.data?.startsWith(pM));const cR=cu.reduce((s,o)=>s+(o.vrRepasse||0),0),pR=pv.reduce((s,o)=>s+(o.vrRepasse||0),0);const vr=pR?((cR-pR)/pR*100):(cR>0?100:0);const lo=[...ops.filter(o=>o.agente===a)].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];const ds=lo?Math.floor((NOW-new Date(lo.data))/86400000):999;const fn=al.filter(isFinal);let al2="ok";if(cu.length===0&&pv.length>0)al2="inactive";else if(vr<=-30)al2="drop";else if(vr<0)al2="soft";return{name:a,cc:cu.length,pc:pv.length,cR,pR,vr,ds,ld:lo?.data,al:al2,fc:al.length,fr:al.reduce((s,o)=>s+(o.vrRepasse||0),0),cv:al.length?(fn.length/al.length*100):0};}).sort((a,b)=>{const o={inactive:0,drop:1,soft:2,ok:3};return(o[a.al]??4)-(o[b.al]??4);});
  const ac=st.filter(s=>["inactive","drop"].includes(s.al)).length;
  const days=[];for(let i=29;i>=0;i--){const d=new Date(NOW);d.setDate(d.getDate()-i);const ds=d.toISOString().split("T")[0];const do2=ops.filter(o=>o.data===ds);days.push({d:ds,c:do2.length,r:do2.reduce((s,o)=>s+(o.vrRepasse||0),0)});}const mxC=Math.max(...days.map(d=>d.c),1);
  if(!ops.length)return<div style={{padding:28,textAlign:"center",color:C.muted}}>Importe digitações</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Análise</h2><PeriodBar p={per}/>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Stat label="Mês Atual" value={ops.filter(o=>o.data?.startsWith(cM)).length} sub={ops.filter(o=>o.data?.startsWith(pM)).length+" anterior"}/><Stat label="Em Queda" value={st.filter(s=>["drop","soft"].includes(s.al)).length} color={C.warn}/><Stat label="Sem Digitar" value={st.filter(s=>s.al==="inactive").length} color={C.danger}/><Stat label="Alertas" value={ac} color={ac?C.danger:C.accent2}/></div>
    {ac>0&&<div style={{background:C.dangerBg,border:"1px solid "+C.danger+"33",borderRadius:12,padding:12}}><div style={{fontSize:11,fontWeight:700,color:C.danger,marginBottom:4}}>⚠ Atenção</div>{st.filter(s=>["inactive","drop"].includes(s.al)).map(s=>(<div key={s.name} style={{fontSize:10,padding:"2px 0"}}><span style={{color:s.al==="inactive"?C.danger:C.warn}}>{s.al==="inactive"?"🔴":"🟡"}</span> <strong>{s.name}</strong> <span style={{color:C.muted}}>— {s.al==="inactive"?"Sem digitação (última: "+(s.ld?fmtDate(s.ld):"nunca")+")":"Queda de "+Math.abs(s.vr).toFixed(0)+"%"}</span></div>))}</div>}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:14}}><div style={{fontSize:11,fontWeight:600,marginBottom:10}}>Digitações Diárias (30d)</div><div style={{display:"flex",gap:2,alignItems:"flex-end",height:80}}>{days.map(d=>(<div key={d.d} style={{flex:1}} title={fmtDate(d.d)+": "+d.c}><div style={{width:"100%",background:d.d===TODAY?C.accent:C.accent+"55",borderRadius:2,height:Math.max(2,(d.c/mxC)*70)+"%"}}/></div>))}</div><div style={{display:"flex",justifyContent:"space-between",marginTop:3}}><span style={{fontSize:8,color:C.muted}}>{fmtDate(days[0]?.d)}</span><span style={{fontSize:8,color:C.accent}}>Hoje</span></div></div>
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}><thead><tr style={{background:C.surface}}>{["","Parceiro","Período","Repasse","Mês","Ant.","Var.","Conv.","Última","Dias"].map(h=><th key={h} style={{padding:"7px 8px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:8,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{st.map(s=>{const ic=s.al==="inactive"?"🔴":s.al==="drop"?"🔴":s.al==="soft"?"🟡":"↗";const vc=s.vr>0?C.accent2:s.vr<-30?C.danger:s.vr<0?C.warn:C.text;return(<tr key={s.name} style={{borderBottom:"1px solid "+C.border}}><td style={{padding:"7px 8px",fontSize:12}}>{ic}</td><td style={{padding:"7px 8px",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</td><td style={{padding:"7px 8px"}}>{s.fc}</td><td style={{padding:"7px 8px",fontWeight:600,color:C.accent}}>{fmtCur(s.fr)}</td><td style={{padding:"7px 8px"}}>{s.cc}</td><td style={{padding:"7px 8px"}}>{s.pc}</td><td style={{padding:"7px 8px",fontWeight:600,color:vc}}>{s.vr>0?"+":""}{s.vr.toFixed(0)}%</td><td style={{padding:"7px 8px"}}><span style={{color:s.cv>=50?C.accent2:s.cv>=30?C.warn:C.danger,fontWeight:600}}>{s.cv.toFixed(0)}%</span></td><td style={{padding:"7px 8px"}}>{s.ld?fmtDate(s.ld):"—"}</td><td style={{padding:"7px 8px",color:s.ds>30?C.danger:s.ds>14?C.warn:C.text}}>{s.ds<999?s.ds+"d":"—"}</td></tr>);})}</tbody></table></div>
  </div>);}

/* MAIN */
const NAV=[{id:"dashboard",l:"Dashboard",i:"📊"},{id:"ops",l:"Operações",i:"💼"},{id:"kanban",l:"Kanban",i:"📋"},{id:"cadastros",l:"Cadastros",i:"📁"},{id:"parceiros",l:"Estratégico",i:"🤝"},{id:"producao",l:"Produção",i:"🏦"},{id:"portabilidade",l:"Portabilidade",i:"🔄"},{id:"analise",l:"Análise",i:"📈"}];

export default function App(){
  const[user,setUser]=useState(null);const[view,setView]=useState("dashboard");const[ops,setOpsR]=useState([]);const[cad,setCadR]=useState([]);const[loaded,setLoaded]=useState(false);
  const setOps=useCallback(fn=>{setOpsR(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(K.ops,next);return next;});},[]);
  const setCad=useCallback(fn=>{setCadR(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(K.cad,next);return next;});},[]);
  useEffect(()=>{(async()=>{let o=await load(K.ops);if(!o||!o.length)o=await migrateOld();let c=await load(K.cad);if(!c||!c.length)c=await migrateOldCad();setOpsR(o||[]);setCadR(c||[]);if(o&&o.length)save(K.ops,o);if(c&&c.length)save(K.cad,c);setLoaded(true);})();},[]);
  if(!user)return<Login onLogin={setUser}/>;
  if(!loaded)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,color:C.text,fontFamily:"Outfit"}}>Carregando...</div>;
  const ags=[...new Set(ops.map(o=>o.agente).filter(Boolean))];const cM=NOW.toISOString().slice(0,7);const inact=ags.filter(a=>!ops.some(o=>o.agente===a&&o.data?.startsWith(cM))).length;
  return(<><style>{"@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');*{margin:0;padding:0;box-sizing:border-box;}body{background:"+C.bg+";color:"+C.text+";font-family:'Outfit',sans-serif;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:"+C.bg+";}::-webkit-scrollbar-thumb{background:"+C.border+";border-radius:3px;}select option{background:"+C.surface+";color:"+C.text+";}"}</style>
    <div style={{display:"flex",minHeight:"100vh"}}>
      <div style={{width:200,background:C.card,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 16px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,"+C.accent+","+C.accent2+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>O</div><h1 style={{fontSize:15,fontWeight:800}}>OpsManager</h1></div><div style={{fontSize:9,color:C.muted,marginTop:2,marginLeft:36}}>{ops.length} dig · {cad.length} cad</div></div>
        <nav style={{flex:1,padding:"2px 8px"}}>{NAV.map(n=>{const a=view===n.id;const bg=n.id==="analise"&&inact>0;return(<button key={n.id} onClick={()=>setView(n.id)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",marginBottom:1,borderRadius:8,border:"none",background:a?C.accentBg:"transparent",color:a?C.accent:C.muted,fontFamily:"Outfit",fontSize:11,fontWeight:a?600:400,cursor:"pointer",textAlign:"left"}}><span style={{fontSize:14}}>{n.i}</span>{n.l}{bg&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:6}}>{inact}</span>}</button>);})}</nav>
        <div style={{padding:"12px 16px",borderTop:"1px solid "+C.border}}><div style={{fontSize:11,fontWeight:600}}>{user.name}</div><div style={{fontSize:9,color:C.muted,marginBottom:5}}>{user.role}</div><button onClick={()=>setUser(null)} style={{fontSize:9,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:0}}>Sair →</button></div>
      </div>
      <div style={{flex:1,padding:"22px 26px",overflowY:"auto",maxWidth:"calc(100vw - 200px)"}}>
        {view==="dashboard"&&<Dashboard ops={ops}/>}
        {view==="ops"&&<Operacoes ops={ops} setOps={setOps}/>}
        {view==="kanban"&&<Kanban ops={ops} setOps={setOps}/>}
        {view==="cadastros"&&<Cadastros ops={ops} cad={cad} setCad={setCad}/>}
        {view==="parceiros"&&<Parceiros ops={ops} cad={cad}/>}
        {view==="producao"&&<Producao ops={ops}/>}
        {view==="portabilidade"&&<Portabilidade ops={ops}/>}
        {view==="analise"&&<Analise ops={ops}/>}
      </div>
    </div>
  </>);}
