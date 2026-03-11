import { useState, useEffect, useCallback, useRef, useMemo } from "react";

const K = { ops: "ops-v4", partners: "part-v4" };
async function load(k) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } }
async function save(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch (e) { console.error(e); } }
const uid = () => Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
const TODAY = new Date().toISOString().split("T")[0];
const NOW = new Date();
const fmtCur = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => { if (!d) return "—"; const p = d.split("-"); return p.length === 3 ? p[2]+"/"+p[1]+"/"+p[0] : d; };
const isFinal = o => ["FINALIZADO","PAGO","AVERBADO","CONCRETIZADO","PAGO C/ PENDENCIA","PAGO C/ PENDÊNCIA"].includes((o.situacaoBanco||"").toUpperCase());

const C = {
  bg:"#0A0E17",surface:"#0F1520",card:"#141B2B",border:"#1C2538",
  text:"#DAE0ED",muted:"#5B6B85",accent:"#3B82F6",accent2:"#10B981",
  warn:"#F59E0B",danger:"#EF4444",info:"#38BDF8",
  accentBg:"#3B82F622",accent2Bg:"#10B98122",warnBg:"#F59E0B18",dangerBg:"#EF444418",
};

function sitColor(s){s=(s||"").toUpperCase();if(["FINALIZADO","PAGO","AVERBADO","APROVADO","CONCRETIZADO","PAGO C/ PENDENCIA","PAGO C/ PENDÊNCIA"].includes(s))return C.accent2;if(["ESTORNADO","CANCELADO","RECUSADO"].includes(s))return C.danger;if(["EM ANÁLISE","PENDENTE"].includes(s))return C.warn;return C.info;}

function Btn({children,variant="primary",style,disabled,...p}){const base={border:"none",borderRadius:8,fontFamily:"Outfit",fontWeight:600,fontSize:12,cursor:disabled?"not-allowed":"pointer",padding:"8px 16px",transition:"all .15s",opacity:disabled?0.4:1};const vs={primary:{background:C.accent,color:"#fff"},success:{background:C.accent2,color:"#fff"},ghost:{background:C.surface,color:C.text,border:"1px solid "+C.border},danger:{background:C.dangerBg,color:C.danger,border:"1px solid "+C.danger+"44"}};return<button style={{...base,...vs[variant],...style}} disabled={disabled} {...p}>{children}</button>;}

function Modal({open,onClose,title,children,width=560}){if(!open)return null;return(<div style={{position:"fixed",inset:0,background:"#000000BB",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:C.card,border:"1px solid "+C.border,borderRadius:16,width,maxWidth:"96vw",maxHeight:"92vh",overflowY:"auto",display:"flex",flexDirection:"column"}}><div style={{padding:"14px 20px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{fontFamily:"Outfit",fontWeight:700,fontSize:15,margin:0}}>{title}</h3><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer"}}>×</button></div><div style={{padding:"16px 20px",flex:1}}>{children}</div></div></div>);}

function Stat({label,value,sub,color}){return(<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"16px 18px",flex:1,minWidth:130}}><div style={{fontSize:10,color:C.muted,marginBottom:5,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:20,fontWeight:700,fontFamily:"Outfit",color:color||C.text}}>{value}</div>{sub&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{sub}</div>}</div>);}

function Field({label,value,onChange,type="text",options,placeholder,style:st}){const base={background:C.surface,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"7px 11px",fontSize:12,outline:"none",width:"100%",fontFamily:"Outfit"};return(<div style={{display:"flex",flexDirection:"column",gap:3,...st}}>{label&&<label style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:.3}}>{label}</label>}{options?<select value={value||""} onChange={e=>onChange(e.target.value)} style={{...base,cursor:"pointer"}}><option value="">— Todos —</option>{options.map(o=>typeof o==="object"?<option key={o.value} value={o.value}>{o.label}</option>:<option key={o} value={o}>{o}</option>)}</select>:type==="textarea"?<textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={3} placeholder={placeholder} style={{...base,resize:"vertical"}}/>:<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>}</div>);}

function Badge({text,color}){return<span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:color+"22",color,fontWeight:600,whiteSpace:"nowrap"}}>{text}</span>;}

/* Period Filter reusable */
function usePeriod(){
  const [periodo,setPeriodo]=useState("mes");const [dateFrom,setDateFrom]=useState("");const [dateTo,setDateTo]=useState("");
  const presets=useMemo(()=>{const y=NOW.getFullYear();const m=NOW.getMonth();const fmt=d=>d.toISOString().split("T")[0];const f=(yr,mo)=>fmt(new Date(yr,mo,1));const l=(yr,mo)=>fmt(new Date(yr,mo+1,0));return{mes:{from:f(y,m),to:l(y,m),label:"Mês Atual"},anterior:{from:f(y,m-1),to:l(y,m-1),label:"Mês Anterior"},trimestre:{from:f(y,m-2),to:l(y,m),label:"Trimestre"},semestre:{from:f(y,m-5),to:l(y,m),label:"Semestre"},ano:{from:y+"-01-01",to:y+"-12-31",label:String(y)},tudo:{from:"2000-01-01",to:"2099-12-31",label:"Tudo"}};},[]);
  useEffect(()=>{if(periodo!=="custom"){const p=presets[periodo];if(p){setDateFrom(p.from);setDateTo(p.to);}}},[periodo,presets]);
  const filterOps=(ops)=>ops.filter(o=>o.data&&o.data>=dateFrom&&o.data<=dateTo);
  const label=periodo==="custom"?fmtDate(dateFrom)+" a "+fmtDate(dateTo):presets[periodo]?.label||"";
  return{periodo,setPeriodo,dateFrom,setDateFrom,dateTo,setDateTo,presets,filterOps,label};
}

function PeriodBar({p}){return(<div style={{display:"flex",flexDirection:"column",gap:8}}>
  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>{Object.entries(p.presets).map(([k,v])=>(<button key={k} onClick={()=>p.setPeriodo(k)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(p.periodo===k?C.accent:C.border),background:p.periodo===k?C.accentBg:"transparent",color:p.periodo===k?C.accent:C.muted,fontSize:10,fontWeight:p.periodo===k?600:400,cursor:"pointer",fontFamily:"Outfit"}}>{v.label}</button>))}<button onClick={()=>p.setPeriodo("custom")} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+(p.periodo==="custom"?C.accent:C.border),background:p.periodo==="custom"?C.accentBg:"transparent",color:p.periodo==="custom"?C.accent:C.muted,fontSize:10,fontWeight:p.periodo==="custom"?600:400,cursor:"pointer",fontFamily:"Outfit"}}>Personalizado</button></div>
  {p.periodo==="custom"&&<div style={{display:"flex",gap:8}}><Field label="De" value={p.dateFrom} onChange={p.setDateFrom} type="date" style={{minWidth:120}}/><Field label="Até" value={p.dateTo} onChange={p.setDateTo} type="date" style={{minWidth:120}}/></div>}
  <div style={{fontSize:10,color:C.muted}}>Período: <strong style={{color:C.text}}>{p.label}</strong></div>
</div>);}

function useSheetJS(){const[r,setR]=useState(!!window.XLSX);useEffect(()=>{if(window.XLSX){setR(true);return;}const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=()=>setR(true);document.head.appendChild(s);},[]);return r;}

const USERS=[{username:"admin",password:"admin123",name:"Administrador",role:"Gerente"}];
function Login({onLogin}){const[u,setU]=useState("");const[p,setP]=useState("");const[err,setErr]=useState("");const go=()=>{const f=USERS.find(x=>x.username===u&&x.password===p);if(f)onLogin(f);else setErr("Usuário ou senha inválidos");};return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,"+C.bg+",#0D1322)",fontFamily:"Outfit"}}><div style={{background:C.card,border:"1px solid "+C.border,borderRadius:20,padding:"44px 38px",width:370,boxShadow:"0 20px 60px #00000066"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,"+C.accent+","+C.accent2+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>O</div><h1 style={{fontSize:22,fontWeight:800}}>OpsManager</h1></div><p style={{color:C.muted,fontSize:12,marginBottom:28}}>Sistema de Gestão de Digitações</p>{err&&<div style={{background:C.dangerBg,color:C.danger,padding:"8px 12px",borderRadius:8,fontSize:12,marginBottom:12}}>{err}</div>}<Field label="Usuário" value={u} onChange={setU} placeholder="admin"/><div style={{height:8}}/><Field label="Senha" value={p} onChange={setP} type="password" placeholder="••••••"/><div style={{height:16}}/><Btn onClick={go} style={{width:"100%",padding:"11px 0",fontSize:13,borderRadius:10}}>Entrar</Btn><div style={{color:C.muted,fontSize:10,marginTop:18,textAlign:"center"}}>Acesso: admin / admin123</div></div></div>);}

/* IMPORT OPS */
const IMPORT_FIELDS={id_ext:{label:"ID",aliases:["id"]},banco:{label:"Banco",aliases:["banco"]},cpf:{label:"CPF",aliases:["cpf"]},cliente:{label:"Cliente",aliases:["cliente","nome"]},proposta:{label:"Proposta",aliases:["proposta"]},contrato:{label:"Nº Contrato",aliases:["contrato","nº contrato"]},data:{label:"Data",aliases:["data","date"]},prazo:{label:"Prazo",aliases:["prazo"]},vrBruto:{label:"Vr. Bruto",aliases:["vr. bruto","vr bruto","bruto"]},vrParcela:{label:"Vr. Parcela",aliases:["vr. parcela","vr parcela"]},vrLiquido:{label:"Vr. Líquido",aliases:["vr. líquido","vr liquido","vr. liquido"]},vrRepasse:{label:"Vr. Repasse",aliases:["vr. repasse","vr repasse","repasse"]},vrSeguro:{label:"Vr. Seguro",aliases:["vr. seguro"]},taxa:{label:"Taxa",aliases:["taxa"]},operacao:{label:"Operação",aliases:["operação","operacao"]},situacao:{label:"Situação",aliases:["situação","situacao","status"]},produto:{label:"Produto",aliases:["produto"]},convenio:{label:"Convênio",aliases:["convênio","convenio"]},agente:{label:"Agente",aliases:["agente"]},situacaoBanco:{label:"Sit. Banco",aliases:["situação banco","situacao banco","sit. banco"]},obsSituacao:{label:"Obs. Sit.",aliases:["obs. situação banco","obs situação","obs. situacao"]},usuario:{label:"Usuário",aliases:["usuário","usuario"]}};

function normalizeDate(v){if(!v)return"";if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400*1000));return!isNaN(d.getTime())?d.toISOString().split("T")[0]:"";}const s=String(v).trim();const m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);if(m)return(m[3].length===2?"20"+m[3]:m[3])+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return"";}
function parseNum(v){if(v==null||v==="")return 0;if(typeof v==="number")return v;return parseFloat(String(v).replace(/[R$\s.]/g,"").replace(",","."))||0;}

function ImportModal({open,onClose,onImport}){
  const xlsxOk=useSheetJS();const fileRef=useRef(null);const[step,setStep]=useState(1);const[rawRows,setRawRows]=useState([]);const[headers,setHeaders]=useState([]);const[mapping,setMapping]=useState({});const[preview,setPreview]=useState([]);const[errors,setErrors]=useState([]);const[drag,setDrag]=useState(false);const[fileName,setFileName]=useState("");
  const reset=()=>{setStep(1);setRawRows([]);setHeaders([]);setMapping({});setPreview([]);setErrors([]);setFileName("");};
  useEffect(()=>{if(!open)reset();},[open]);
  const autoMap=(cols)=>{const m={};Object.entries(IMPORT_FIELDS).forEach(([f,def])=>{const found=cols.find(c=>{const cl=c.toLowerCase().trim();return def.aliases.some(a=>cl===a||cl.includes(a));});if(found)m[f]=found;});return m;};
  const parseFile=(file)=>{if(!xlsxOk||!window.XLSX){setErrors(["Aguarde..."]);return;}setFileName(file.name);setErrors([]);const reader=new FileReader();reader.onload=(e)=>{try{const wb=window.XLSX.read(new Uint8Array(e.target.result),{type:"array"});const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});if(!rows.length){setErrors(["Planilha vazia"]);return;}setRawRows(rows);const cols=Object.keys(rows[0]);setHeaders(cols);setMapping(autoMap(cols));setStep(2);}catch(err){setErrors(["Erro: "+err.message]);}};reader.readAsArrayBuffer(file);};
  const buildPreview=()=>{const errs=[];const built=rawRows.map((row,i)=>{const cliente=mapping.cliente?String(row[mapping.cliente]||"").trim():"";const proposta=mapping.proposta?String(row[mapping.proposta]||"").trim():"";const valid=!!(cliente||proposta);if(!valid)errs.push("Ln "+(i+2)+": sem cliente/proposta");return{_row:i+2,_valid:valid,id:uid(),id_ext:mapping.id_ext?String(row[mapping.id_ext]||"").trim():"",banco:mapping.banco?String(row[mapping.banco]||"").trim():"",cpf:mapping.cpf?String(row[mapping.cpf]||"").trim():"",cliente,proposta,contrato:mapping.contrato?String(row[mapping.contrato]||"").trim():"",data:normalizeDate(mapping.data?row[mapping.data]:""),prazo:mapping.prazo?String(row[mapping.prazo]||"").trim():"",vrBruto:parseNum(mapping.vrBruto?row[mapping.vrBruto]:""),vrParcela:parseNum(mapping.vrParcela?row[mapping.vrParcela]:""),vrLiquido:parseNum(mapping.vrLiquido?row[mapping.vrLiquido]:""),vrRepasse:parseNum(mapping.vrRepasse?row[mapping.vrRepasse]:""),vrSeguro:parseNum(mapping.vrSeguro?row[mapping.vrSeguro]:""),taxa:mapping.taxa?String(row[mapping.taxa]||"").trim():"",operacao:mapping.operacao?String(row[mapping.operacao]||"").trim().toUpperCase():"",situacao:mapping.situacao?String(row[mapping.situacao]||"").trim().toUpperCase():"",produto:mapping.produto?String(row[mapping.produto]||"").trim():"",convenio:mapping.convenio?String(row[mapping.convenio]||"").trim().toUpperCase():"",agente:mapping.agente?String(row[mapping.agente]||"").trim():"",situacaoBanco:mapping.situacaoBanco?String(row[mapping.situacaoBanco]||"").trim().toUpperCase():"",obsSituacao:mapping.obsSituacao?String(row[mapping.obsSituacao]||"").trim():"",usuario:mapping.usuario?String(row[mapping.usuario]||"").trim():""};});setErrors(errs);setPreview(built);setStep(3);};
  const doImport=()=>{const valid=preview.filter(p=>p._valid).map(({_row,_valid,...r})=>r);onImport(valid);onClose();};
  const downloadTemplate=()=>{if(!window.XLSX)return;const ws=window.XLSX.utils.aoa_to_sheet([["ID","BANCO","CPF","CLIENTE","PROPOSTA","Nº CONTRATO","DATA","PRAZO","VR. BRUTO","VR. PARCELA","VR. LÍQUIDO","VR. REPASSE","VR. SEGURO","TAXA","OPERAÇÃO","SITUAÇÃO","PRODUTO","CONVÊNIO","AGENTE","SITUAÇÃO BANCO","OBS. SITUAÇÃO BANCO","USUÁRIO"],["18011","QUALIBANKING","015.566.609-60","ELIZABETH APARECIDA","QUA0000556121","QUA0000556121","31/01/2025","84","9205.32","217.79","7978.97","7978.97","0","1.80","NOVO","ESTORNADO","TOP PLUS TX 1,80%","INSS","NEWS NEGOCIOS","FINALIZADO","","Bruno Moraes"]]);const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,"Digitações");window.XLSX.writeFile(wb,"modelo_digitacoes.xlsx");};
  if(!open)return null;const validCount=preview.filter(p=>p._valid).length;const totalR=preview.filter(p=>p._valid).reduce((s,o)=>s+(o.vrRepasse||0),0);
  return(<div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:C.card,border:"1px solid "+C.border,borderRadius:18,width:760,maxWidth:"97vw",maxHeight:"92vh",overflowY:"auto"}}><div style={{padding:"16px 22px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h3 style={{fontFamily:"Outfit",fontWeight:700,fontSize:15,margin:0}}>Importar Digitações</h3><div style={{display:"flex",gap:12,marginTop:7}}>{["Upload","Mapear","Revisar"].map((s,i)=>(<div key={s} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:20,borderRadius:"50%",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",background:step>i+1?C.accent2:step===i+1?C.accent:C.border,color:step>=i+1?"#fff":C.muted}}>{step>i+1?"✓":i+1}</div><span style={{fontSize:11,color:step===i+1?C.text:C.muted}}>{s}</span>{i<2&&<span style={{color:C.border}}>›</span>}</div>))}</div></div><button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:22,cursor:"pointer"}}>×</button></div>
    <div style={{padding:"18px 22px"}}>
      {step===1&&(<div style={{display:"flex",flexDirection:"column",gap:12}}><div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files?.[0];if(f)parseFile(f);}} onClick={()=>fileRef.current?.click()} style={{border:"2px dashed "+(drag?C.accent:C.border),borderRadius:14,padding:"38px 20px",textAlign:"center",background:drag?C.accentBg:C.surface,cursor:"pointer"}}><div style={{fontSize:34,marginBottom:6}}>📂</div><div style={{fontSize:13,fontWeight:600}}>{xlsxOk?"Arraste ou clique":"Carregando..."}</div><div style={{fontSize:11,color:C.muted}}>Suporta .xlsx, .xls e .csv</div><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)parseFile(f);}} style={{display:"none"}}/></div>{errors.map((e,i)=><div key={i} style={{background:C.dangerBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.danger}}>{e}</div>)}<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.surface,borderRadius:10,padding:"11px 16px",border:"1px solid "+C.border}}><div><div style={{fontSize:12,fontWeight:600}}>📥 Baixar modelo</div></div><Btn variant="ghost" onClick={downloadTemplate} style={{fontSize:11}}>Baixar .xlsx</Btn></div></div>)}
      {step===2&&(<div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{background:C.surface,borderRadius:8,padding:"8px 14px",fontSize:12,color:C.muted,border:"1px solid "+C.border}}>Arquivo: <strong style={{color:C.text}}>{fileName}</strong> · {rawRows.length} linhas · <strong style={{color:C.accent2}}>{Object.keys(mapping).length}</strong> detectados</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>{Object.entries(IMPORT_FIELDS).map(([field,def])=>(<div key={field} style={{display:"flex",flexDirection:"column",gap:2}}><label style={{fontSize:9,color:mapping[field]?C.accent:C.muted,fontWeight:600,textTransform:"uppercase"}}>{def.label}</label><select value={mapping[field]??""} onChange={e=>setMapping(m=>({...m,[field]:e.target.value||undefined}))} style={{background:C.surface,border:"1px solid "+(mapping[field]?C.accent+"66":C.border),borderRadius:6,color:mapping[field]?C.text:C.muted,padding:"5px 7px",fontSize:11,outline:"none",cursor:"pointer"}}><option value="">— Ignorar —</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></div>))}</div><div style={{display:"flex",gap:8,marginTop:6}}><Btn variant="ghost" onClick={reset}>← Voltar</Btn><Btn onClick={buildPreview} style={{flex:1}}>Revisar →</Btn></div></div>)}
      {step===3&&(<div style={{display:"flex",flexDirection:"column",gap:10}}>{errors.length>0&&<div style={{background:C.warnBg,borderRadius:8,padding:"8px 12px"}}>{errors.slice(0,5).map((e,i)=><div key={i} style={{fontSize:11,color:C.warn}}>{e}</div>)}</div>}<div style={{fontSize:12}}><strong style={{color:C.accent2}}>{validCount}</strong> válidas · Repasse: <strong style={{color:C.accent}}>{fmtCur(totalR)}</strong></div><div style={{overflowX:"auto",maxHeight:280,borderRadius:8,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["","Cliente","Banco","Operação","Situação","Agente","Repasse"].map(h=><th key={h} style={{padding:"7px 8px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:9,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{preview.slice(0,60).map(p=>(<tr key={p.id} style={{borderBottom:"1px solid "+C.border,opacity:p._valid?1:0.35}}><td style={{padding:"5px 8px",color:p._valid?C.accent2:C.danger,fontWeight:700}}>{p._valid?"✓":"✕"}</td><td style={{padding:"5px 8px"}}>{p.cliente}</td><td style={{padding:"5px 8px"}}>{p.banco}</td><td style={{padding:"5px 8px"}}>{p.operacao}</td><td style={{padding:"5px 8px"}}><Badge text={p.situacao||"—"} color={sitColor(p.situacao)}/></td><td style={{padding:"5px 8px"}}>{p.agente}</td><td style={{padding:"5px 8px",fontWeight:600}}>{fmtCur(p.vrRepasse)}</td></tr>))}</tbody></table></div><div style={{display:"flex",gap:8}}><Btn variant="ghost" onClick={()=>setStep(2)}>←</Btn><Btn variant="success" onClick={doImport} style={{flex:1}} disabled={validCount===0}>✓ Importar {validCount} ({fmtCur(totalR)})</Btn></div></div>)}
    </div></div></div>);
}

/* EXPORT */
function ExportModal({open,onClose,ops}){
  const xlsxOk=useSheetJS();const[f,setF]=useState({banco:"",operacao:"",convenio:"",agente:"",situacao:"",dateFrom:"",dateTo:""});const allOf=(key)=>[...new Set(ops.map(o=>o[key]).filter(Boolean))].sort();
  const filtered=ops.filter(o=>(!f.banco||o.banco===f.banco)&&(!f.operacao||o.operacao===f.operacao)&&(!f.convenio||o.convenio===f.convenio)&&(!f.agente||o.agente===f.agente)&&(!f.situacao||o.situacao===f.situacao)&&(!f.dateFrom||o.data>=f.dateFrom)&&(!f.dateTo||o.data<=f.dateTo));
  const doExport=()=>{if(!window.XLSX)return;const rows=filtered.map(o=>({"Data":o.data,"Banco":o.banco,"CPF":o.cpf,"Cliente":o.cliente,"Proposta":o.proposta,"Nº Contrato":o.contrato,"Prazo":o.prazo,"Vr. Bruto":o.vrBruto,"Vr. Parcela":o.vrParcela,"Vr. Líquido":o.vrLiquido,"Vr. Repasse":o.vrRepasse,"Taxa":o.taxa,"Operação":o.operacao,"Situação":o.situacao,"Produto":o.produto,"Convênio":o.convenio,"Agente":o.agente,"Sit. Banco":o.situacaoBanco}));const ws=window.XLSX.utils.json_to_sheet(rows);const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,"Digitações");window.XLSX.writeFile(wb,"digitacoes_"+TODAY+".xlsx");onClose();};
  return(<Modal open={open} onClose={onClose} title="Exportar" width={660}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}><Field label="Banco" value={f.banco} onChange={v=>setF(x=>({...x,banco:v}))} options={allOf("banco")}/><Field label="Operação" value={f.operacao} onChange={v=>setF(x=>({...x,operacao:v}))} options={allOf("operacao")}/><Field label="Convênio" value={f.convenio} onChange={v=>setF(x=>({...x,convenio:v}))} options={allOf("convenio")}/><Field label="Agente" value={f.agente} onChange={v=>setF(x=>({...x,agente:v}))} options={allOf("agente")}/><Field label="Situação" value={f.situacao} onChange={v=>setF(x=>({...x,situacao:v}))} options={allOf("situacao")}/><Field label="De" value={f.dateFrom} onChange={v=>setF(x=>({...x,dateFrom:v}))} type="date"/><Field label="Até" value={f.dateTo} onChange={v=>setF(x=>({...x,dateTo:v}))} type="date"/></div><div style={{background:C.surface,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12}}><strong style={{color:C.accent}}>{filtered.length}</strong> registros · Repasse: <strong style={{color:C.accent2}}>{fmtCur(filtered.reduce((s,o)=>s+(o.vrRepasse||0),0))}</strong></div><Btn variant="success" onClick={doExport} style={{width:"100%"}} disabled={!xlsxOk||filtered.length===0}>📤 Exportar {filtered.length}</Btn></Modal>);
}

/* DASHBOARD */
function Dashboard({ops}){
  const p=usePeriod();const filtered=p.filterOps(ops);
  const totalR=filtered.reduce((s,o)=>s+(o.vrRepasse||0),0);const fin=filtered.filter(isFinal);const finR=fin.reduce((s,o)=>s+(o.vrRepasse||0),0);const agentes=[...new Set(filtered.map(o=>o.agente).filter(Boolean))];const totalB=filtered.reduce((s,o)=>s+(o.vrBruto||0),0);
  const topP=useMemo(()=>{const map={};filtered.forEach(o=>{const a=o.agente||"Sem Agente";if(!map[a])map[a]={r:0,c:0,fc:0};map[a].r+=(o.vrRepasse||0);map[a].c++;if(isFinal(o))map[a].fc++;});return Object.entries(map).sort((a,b)=>b[1].r-a[1].r).slice(0,8);},[filtered]);
  const byOp=useMemo(()=>{const map={};filtered.forEach(o=>{const op=o.operacao||"OUTROS";if(!map[op])map[op]={r:0,c:0};map[op].r+=(o.vrRepasse||0);map[op].c++;});return Object.entries(map).sort((a,b)=>b[1].r-a[1].r);},[filtered]);
  const bySit=useMemo(()=>{const map={};filtered.forEach(o=>{const s=o.situacao||"SEM SIT.";if(!map[s])map[s]={c:0,r:0};map[s].c++;map[s].r+=(o.vrRepasse||0);});return Object.entries(map).sort((a,b)=>b[1].c-a[1].c);},[filtered]);
  const months={};filtered.forEach(o=>{const m=o.data?.slice(0,7);if(m){if(!months[m])months[m]={r:0,c:0};months[m].r+=(o.vrRepasse||0);months[m].c++;}});const sorted=Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);const maxR=Math.max(...sorted.map(s=>s[1].r),1);
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Dashboard</h2></div>
    <PeriodBar p={p}/>
    {ops.length===0?<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"40px 20px",textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>📋</div><div style={{fontSize:14,fontWeight:600}}>Nenhuma digitação</div><div style={{fontSize:12,color:C.muted}}>Vá em Operações → Importar</div></div>:<>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Stat label="Produção (Repasse)" value={fmtCur(totalR)} color={C.accent}/><Stat label="Repasse Pago" value={fmtCur(finR)} color={C.accent2} sub={fin.length+" pagas"}/><Stat label="Digitações" value={filtered.length}/><Stat label="Parceiros" value={agentes.length}/><Stat label="Vr. Bruto" value={fmtCur(totalB)} color={C.info}/></div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}}>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Produção Mensal</div><div style={{display:"flex",gap:4,alignItems:"flex-end",height:110}}>{sorted.map(([m,v])=>(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{fontSize:8,color:C.muted}}>{fmtCur(v.r)}</div><div style={{width:"100%",maxWidth:40,background:"linear-gradient(180deg,"+C.accent+","+C.accent2+")",borderRadius:5,height:Math.max(6,(v.r/maxR)*90)+"%"}}/><div style={{fontSize:8,color:C.muted}}>{m.slice(5)}/{m.slice(2,4)}</div></div>))}</div></div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}><div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Situação</div>{bySit.slice(0,6).map(([sit,d])=>{const pct=filtered.length?(d.c/filtered.length*100):0;return(<div key={sit} style={{marginBottom:7}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{color:sitColor(sit),fontWeight:600}}>{sit}</span><span style={{color:C.muted}}>{d.c}</span></div><div style={{height:5,background:C.surface,borderRadius:3}}><div style={{height:"100%",background:sitColor(sit),borderRadius:3,width:pct+"%"}}/></div></div>);})}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}><div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Top Parceiros</div>{topP.map(([ag,d],i)=>(<div key={ag} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderBottom:"1px solid "+C.border}}><div style={{width:20,height:20,borderRadius:6,background:i<3?C.accent:C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:i<3?"#fff":C.muted,flexShrink:0}}>{i+1}</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ag}</div><div style={{fontSize:9,color:C.muted}}>{d.c} dig · {d.fc} pagas</div></div><div style={{fontSize:11,fontWeight:700,color:C.accent2,flexShrink:0}}>{fmtCur(d.r)}</div></div>))}</div>
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}><div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Por Operação</div>{byOp.map(([op,d])=>{const pct=totalR?(d.r/totalR*100):0;return(<div key={op} style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{fontWeight:600}}>{op}</span><span style={{color:C.accent}}>{fmtCur(d.r)}</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{flex:1,height:6,background:C.surface,borderRadius:3}}><div style={{height:"100%",background:C.accent,borderRadius:3,width:pct+"%"}}/></div><span style={{fontSize:9,color:C.muted}}>{d.c}</span></div></div>);})}</div>
      </div>
    </>}
  </div>);
}

/* OPERACOES */
function Operacoes({ops,setOps}){
  const[importOpen,setImportOpen]=useState(false);const[exportOpen,setExportOpen]=useState(false);const[search,setSearch]=useState("");const[fSit,setFSit]=useState("");const[fBanco,setFBanco]=useState("");const[fOp,setFOp]=useState("");const[detail,setDetail]=useState(null);
  const allSit=[...new Set(ops.map(o=>o.situacao).filter(Boolean))].sort();const allBancos=[...new Set(ops.map(o=>o.banco).filter(Boolean))].sort();const allOps=[...new Set(ops.map(o=>o.operacao).filter(Boolean))].sort();
  const filtered=ops.filter(o=>(!fSit||o.situacao===fSit)&&(!fBanco||o.banco===fBanco)&&(!fOp||o.operacao===fOp)).filter(o=>{if(!search)return true;const s=search.toLowerCase();return(o.cliente?.toLowerCase().includes(s)||o.proposta?.toLowerCase().includes(s)||o.agente?.toLowerCase().includes(s)||o.cpf?.includes(s));}).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Operações</h2><div style={{display:"flex",gap:6}}><Btn variant="ghost" onClick={()=>setImportOpen(true)}>📥 Importar</Btn><Btn variant="ghost" onClick={()=>setExportOpen(true)}>📤 Exportar</Btn></div></div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"flex-end"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{background:C.surface,border:"1px solid "+C.border,borderRadius:7,color:C.text,padding:"7px 12px",fontSize:12,outline:"none",flex:1,minWidth:180,fontFamily:"Outfit"}}/><Field value={fSit} onChange={setFSit} options={allSit} style={{minWidth:100}}/><Field value={fBanco} onChange={setFBanco} options={allBancos} style={{minWidth:100}}/><Field value={fOp} onChange={setFOp} options={allOps} style={{minWidth:100}}/></div>
    <div style={{fontSize:11,color:C.muted}}>{filtered.length} registros · Repasse: <strong style={{color:C.accent}}>{fmtCur(filtered.reduce((s,o)=>s+(o.vrRepasse||0),0))}</strong></div>
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["Data","Cliente","Banco","Operação","Situação","Convênio","Agente","Repasse"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{filtered.slice(0,200).map(o=>(<tr key={o.id} style={{borderBottom:"1px solid "+C.border,cursor:"pointer"}} onClick={()=>setDetail(o)}><td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>{fmtDate(o.data)}</td><td style={{padding:"8px 10px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cliente||"—"}</td><td style={{padding:"8px 10px"}}>{o.banco}</td><td style={{padding:"8px 10px"}}>{o.operacao}</td><td style={{padding:"8px 10px"}}><Badge text={o.situacao||"—"} color={sitColor(o.situacao)}/></td><td style={{padding:"8px 10px"}}>{o.convenio}</td><td style={{padding:"8px 10px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.agente}</td><td style={{padding:"8px 10px",fontWeight:600}}>{fmtCur(o.vrRepasse)}</td></tr>))}</tbody></table>{filtered.length===0&&<div style={{padding:28,textAlign:"center",color:C.muted,fontSize:12}}>Nenhuma digitação. Importe sua planilha.</div>}</div>
    <Modal open={!!detail} onClose={()=>setDetail(null)} title="Detalhes" width={520}>{detail&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>{[["Cliente",detail.cliente],["CPF",detail.cpf],["Proposta",detail.proposta],["Contrato",detail.contrato],["Data",fmtDate(detail.data)],["Banco",detail.banco],["Operação",detail.operacao],["Situação",detail.situacao],["Convênio",detail.convenio],["Agente",detail.agente],["Prazo",detail.prazo],["Taxa",detail.taxa],["Bruto",fmtCur(detail.vrBruto)],["Parcela",fmtCur(detail.vrParcela)],["Líquido",fmtCur(detail.vrLiquido)],["Repasse",fmtCur(detail.vrRepasse)],["Produto",detail.produto],["Sit. Banco",detail.situacaoBanco]].map(([l,v])=>(<div key={l}><div style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontWeight:500}}>{v||"—"}</div></div>))}</div>}</Modal>
    <ImportModal open={importOpen} onClose={()=>setImportOpen(false)} onImport={imported=>setOps(prev=>[...prev,...imported])}/>
    <ExportModal open={exportOpen} onClose={()=>setExportOpen(false)} ops={ops}/>
  </div>);
}

/* KANBAN */
function Kanban({ops,setOps}){
  const per=usePeriod();const[fAgente,setFAgente]=useState("");const[fOp,setFOp]=useState("");const[fBanco,setFBanco]=useState("");const[detail,setDetail]=useState(null);
  const base=per.filterOps(ops);const filtered=base.filter(o=>(!fAgente||o.agente===fAgente)&&(!fOp||o.operacao===fOp)&&(!fBanco||o.banco===fBanco));
  const allSituacoes=useMemo(()=>{const sits=[...new Set(ops.map(o=>o.situacao).filter(Boolean))];const order=["NOVO","PENDENTE","EM ANÁLISE","APROVADO","PAGO","CONCRETIZADO","PAGO C/ PENDENCIA","ESTORNADO","CANCELADO","RECUSADO"];return sits.sort((a,b)=>{const ai=order.indexOf(a);const bi=order.indexOf(b);return(ai===-1?99:ai)-(bi===-1?99:bi);});},[ops]);
  const moveSit=(id,ns)=>{setOps(prev=>prev.map(o=>o.id===id?{...o,situacao:ns}:o));};
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Kanban</h2>
    <PeriodBar p={per}/>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"flex-end"}}><Field label="Parceiro" value={fAgente} onChange={setFAgente} options={[...new Set(base.map(o=>o.agente).filter(Boolean))].sort()} style={{minWidth:140}}/><Field label="Operação" value={fOp} onChange={setFOp} options={[...new Set(base.map(o=>o.operacao).filter(Boolean))].sort()} style={{minWidth:110}}/><Field label="Banco" value={fBanco} onChange={setFBanco} options={[...new Set(base.map(o=>o.banco).filter(Boolean))].sort()} style={{minWidth:110}}/>{(fAgente||fOp||fBanco)&&<Btn variant="ghost" onClick={()=>{setFAgente("");setFOp("");setFBanco("");}} style={{fontSize:11}}>Limpar</Btn>}</div>
    <div style={{fontSize:10,color:C.muted}}>{filtered.length} digitações · Repasse: <strong style={{color:C.accent}}>{fmtCur(filtered.reduce((s,o)=>s+(o.vrRepasse||0),0))}</strong></div>
    {allSituacoes.length===0?<div style={{background:C.card,borderRadius:14,padding:32,textAlign:"center",color:C.muted}}>Importe digitações</div>:
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8}}>{allSituacoes.map(sit=>{const items=filtered.filter(o=>o.situacao===sit);const sc=sitColor(sit);const r=items.reduce((s,o)=>s+(o.vrRepasse||0),0);return(<div key={sit} style={{minWidth:200,flex:1,background:C.surface,borderRadius:12,border:"1px solid "+C.border,display:"flex",flexDirection:"column"}}><div style={{padding:"10px 12px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={{fontSize:11,fontWeight:700,color:sc}}>{sit}</span><div style={{fontSize:9,color:C.muted}}>{fmtCur(r)}</div></div><span style={{fontSize:10,background:sc+"22",color:sc,padding:"2px 7px",borderRadius:8,fontWeight:700}}>{items.length}</span></div><div style={{padding:5,display:"flex",flexDirection:"column",gap:3,flex:1,maxHeight:380,overflowY:"auto"}}>{items.slice(0,25).map(o=>(<div key={o.id} onClick={()=>setDetail(o)} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"7px 9px",cursor:"pointer"}}><div style={{fontSize:10,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cliente||o.proposta}</div><div style={{fontSize:9,color:C.muted}}>{o.banco} · {o.operacao} · {fmtCur(o.vrRepasse)}</div><div style={{fontSize:8,color:C.muted}}>{o.agente}</div><div style={{display:"flex",gap:2,marginTop:4,flexWrap:"wrap"}}>{allSituacoes.filter(s=>s!==sit).slice(0,3).map(s=>(<button key={s} onClick={e=>{e.stopPropagation();moveSit(o.id,s);}} style={{fontSize:7,padding:"1px 4px",borderRadius:3,border:"1px solid "+C.border,background:C.surface,color:sitColor(s),cursor:"pointer",fontWeight:600}}>→{s}</button>))}</div></div>))}{items.length===0&&<div style={{fontSize:10,color:C.muted,textAlign:"center",padding:12}}>—</div>}</div></div>);})}</div>}
    <Modal open={!!detail} onClose={()=>setDetail(null)} title="Detalhes" width={480}>{detail&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>{[["Cliente",detail.cliente],["CPF",detail.cpf],["Banco",detail.banco],["Operação",detail.operacao],["Situação",detail.situacao],["Agente",detail.agente],["Repasse",fmtCur(detail.vrRepasse)],["Bruto",fmtCur(detail.vrBruto)],["Data",fmtDate(detail.data)]].map(([l,v])=>(<div key={l}><div style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontWeight:500}}>{v||"—"}</div></div>))}</div>}</Modal>
  </div>);
}

/* PORTABILIDADE */
function Portabilidade({ops}){
  const per=usePeriod();const filtered=per.filterOps(ops);
  const portOps=useMemo(()=>filtered.filter(o=>(o.operacao||"").toUpperCase()==="PORTABILIDADE"),[filtered]);
  const byBanco=useMemo(()=>{const map={};portOps.forEach(o=>{const b=o.banco||"SEM BANCO";if(!map[b])map[b]={d:0,p:0,rd:0,rp:0};map[b].d++;map[b].rd+=(o.vrRepasse||0);if(isFinal(o)){map[b].p++;map[b].rp+=(o.vrRepasse||0);}});return Object.entries(map).sort((a,b)=>b[1].d-a[1].d);},[portOps]);
  const byAg=useMemo(()=>{const map={};portOps.forEach(o=>{const a=o.agente||"SEM AGENTE";if(!map[a])map[a]={d:0,p:0,rd:0,rp:0};map[a].d++;map[a].rd+=(o.vrRepasse||0);if(isFinal(o)){map[a].p++;map[a].rp+=(o.vrRepasse||0);}});return Object.entries(map).sort((a,b)=>b[1].d-a[1].d);},[portOps]);
  const tD=portOps.length;const tP=portOps.filter(isFinal).length;const tRD=portOps.reduce((s,o)=>s+(o.vrRepasse||0),0);const tRP=portOps.filter(isFinal).reduce((s,o)=>s+(o.vrRepasse||0),0);const conv=tD?(tP/tD*100):0;
  const RateBar=({rate})=>(<div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:50,height:6,background:C.surface,borderRadius:3}}><div style={{height:"100%",background:rate>=50?C.accent2:rate>=30?C.warn:C.danger,borderRadius:3,width:rate+"%"}}/></div><span style={{fontWeight:600,color:rate>=50?C.accent2:rate>=30?C.warn:C.danger,fontSize:11}}>{rate.toFixed(1)}%</span></div>);
  const TBL=({data,nameLabel})=>(<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{[nameLabel,"Digitado","Pago","% Conv.","Rep. Dig.","Rep. Pago"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:9,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{data.map(([n,d])=>{const r=d.d?(d.p/d.d*100):0;return(<tr key={n} style={{borderBottom:"1px solid "+C.border}}><td style={{padding:"8px 10px",fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n}</td><td style={{padding:"8px 10px"}}>{d.d}</td><td style={{padding:"8px 10px",color:C.accent2,fontWeight:600}}>{d.p}</td><td style={{padding:"8px 10px"}}><RateBar rate={r}/></td><td style={{padding:"8px 10px"}}>{fmtCur(d.rd)}</td><td style={{padding:"8px 10px",fontWeight:600,color:C.accent2}}>{fmtCur(d.rp)}</td></tr>);})}</tbody></table></div>);
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Portabilidade</h2>
    <PeriodBar p={per}/>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Stat label="Digitado" value={tD} sub={"Rep: "+fmtCur(tRD)}/><Stat label="Pago" value={tP} sub={"Rep: "+fmtCur(tRP)} color={C.accent2}/><Stat label="Conversão" value={conv.toFixed(1)+"%"} color={conv>=50?C.accent2:conv>=30?C.warn:C.danger}/></div>
    {portOps.length===0?<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}>Nenhuma PORTABILIDADE no período</div>:<>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}><div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Por Banco</div><TBL data={byBanco} nameLabel="Banco"/></div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}><div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Por Parceiro</div><TBL data={byAg} nameLabel="Parceiro"/></div>
    </>}
  </div>);
}

/* PARCEIROS – import base + visão estratégica */
function Parceiros({ops,partners,setPartners}){
  const per=usePeriod();const filtered=per.filterOps(ops);
  const[importOpen,setImportOpen]=useState(false);const[selected,setSelected]=useState(null);
  const xlsxOk=useSheetJS();const fileRef=useRef(null);

  // auto-detect agents from ops who aren't in partners list
  const opsAgentes=[...new Set(ops.map(o=>o.agente).filter(Boolean))];
  const missingCount=opsAgentes.filter(a=>!partners.some(p=>p.name===a)).length;

  const autoImportAgents=()=>{const existing=new Set(partners.map(p=>p.name));const newP=opsAgentes.filter(a=>!existing.has(a)).map(a=>({id:uid(),name:a,contato:"",obs:""}));if(newP.length)setPartners(prev=>[...prev,...newP]);};

  const importPartners=(file)=>{if(!xlsxOk||!window.XLSX)return;const reader=new FileReader();reader.onload=(e)=>{try{const wb=window.XLSX.read(new Uint8Array(e.target.result),{type:"array"});const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});const cols=Object.keys(rows[0]||{});const nameCol=cols.find(c=>{const cl=c.toLowerCase();return cl.includes("nome")||cl.includes("parceiro")||cl.includes("agente")||cl.includes("name");});const contatoCol=cols.find(c=>{const cl=c.toLowerCase();return cl.includes("contato")||cl.includes("telefone")||cl.includes("email")||cl.includes("fone");});const obsCol=cols.find(c=>{const cl=c.toLowerCase();return cl.includes("obs")||cl.includes("nota")||cl.includes("observ");});
    const existing=new Set(partners.map(p=>p.name.toLowerCase()));const newP=[];
    rows.forEach(row=>{const name=nameCol?String(row[nameCol]||"").trim():"";if(name&&!existing.has(name.toLowerCase())){existing.add(name.toLowerCase());newP.push({id:uid(),name,contato:contatoCol?String(row[contatoCol]||"").trim():"",obs:obsCol?String(row[obsCol]||"").trim():""});}});
    if(newP.length)setPartners(prev=>[...prev,...newP]);alert(newP.length+" parceiros importados!");}catch(err){alert("Erro: "+err.message);}};reader.readAsArrayBuffer(file);};

  // Strategic data per partner
  const pStats=useMemo(()=>{return partners.map(p=>{const all=filtered.filter(o=>o.agente===p.name);const allTime=ops.filter(o=>o.agente===p.name);const r=all.reduce((s,o)=>s+(o.vrRepasse||0),0);const b=all.reduce((s,o)=>s+(o.vrBruto||0),0);const fin=all.filter(isFinal);const finR=fin.reduce((s,o)=>s+(o.vrRepasse||0),0);const conv=all.length?(fin.length/all.length*100):0;
    const byOp={};all.forEach(o=>{const op=o.operacao||"OUTROS";if(!byOp[op])byOp[op]={c:0,r:0,fc:0};byOp[op].c++;byOp[op].r+=(o.vrRepasse||0);if(isFinal(o))byOp[op].fc++;});
    const byBanco={};all.forEach(o=>{const bk=o.banco||"OUTROS";if(!byBanco[bk])byBanco[bk]={c:0,r:0,fc:0};byBanco[bk].c++;byBanco[bk].r+=(o.vrRepasse||0);if(isFinal(o))byBanco[bk].fc++;});
    const bySit={};all.forEach(o=>{const s=o.situacao||"SEM SIT.";if(!bySit[s])bySit[s]={c:0,r:0};bySit[s].c++;bySit[s].r+=(o.vrRepasse||0);});
    const months={};allTime.forEach(o=>{const m=o.data?.slice(0,7);if(m){if(!months[m])months[m]={r:0,c:0};months[m].r+=(o.vrRepasse||0);months[m].c++;}});
    const lastOp=[...allTime].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];
    return{...p,count:all.length,repasse:r,bruto:b,finCount:fin.length,finRepasse:finR,conv,byOp:Object.entries(byOp).sort((a,b)=>b[1].r-a[1].r),byBanco:Object.entries(byBanco).sort((a,b)=>b[1].r-a[1].r),bySit:Object.entries(bySit).sort((a,b)=>b[1].c-a[1].c),months:Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6),lastDate:lastOp?.data,totalAllTime:allTime.length};
  }).sort((a,b)=>b.repasse-a.repasse);},[partners,filtered,ops]);

  const sel=selected?pStats.find(p=>p.id===selected):null;

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Parceiros</h2>
      <div style={{display:"flex",gap:6}}>
        {missingCount>0&&<Btn variant="warn" onClick={autoImportAgents} style={{background:C.warnBg,color:C.warn,border:"1px solid "+C.warn+"44"}}>⚡ Importar {missingCount} das digitações</Btn>}
        <Btn variant="ghost" onClick={()=>fileRef.current?.click()}>📥 Importar planilha</Btn>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)importPartners(f);}} style={{display:"none"}}/>
      </div>
    </div>
    <PeriodBar p={per}/>
    <div style={{fontSize:10,color:C.muted}}>{partners.length} parceiros cadastrados · {pStats.filter(p=>p.count>0).length} com digitações no período</div>

    {!sel ? (
      /* LIST VIEW */
      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["Parceiro","Digitações","Repasse","Pagas","Conv.%","Última",""].map(h=><th key={h} style={{padding:"9px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:9,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
        <tbody>{pStats.map(p=>(<tr key={p.id} style={{borderBottom:"1px solid "+C.border,cursor:"pointer"}} onClick={()=>setSelected(p.id)}>
          <td style={{padding:"8px 10px",fontWeight:600}}>{p.name}</td>
          <td style={{padding:"8px 10px"}}>{p.count}</td>
          <td style={{padding:"8px 10px",fontWeight:600,color:C.accent}}>{fmtCur(p.repasse)}</td>
          <td style={{padding:"8px 10px",color:C.accent2}}>{p.finCount}</td>
          <td style={{padding:"8px 10px"}}><span style={{color:p.conv>=50?C.accent2:p.conv>=30?C.warn:C.danger,fontWeight:600}}>{p.conv.toFixed(0)}%</span></td>
          <td style={{padding:"8px 10px"}}>{p.lastDate?fmtDate(p.lastDate):"—"}</td>
          <td style={{padding:"8px 10px"}}><span style={{color:C.accent,fontSize:10}}>Ver →</span></td>
        </tr>))}</tbody></table>
        {pStats.length===0&&<div style={{padding:28,textAlign:"center",color:C.muted}}>Nenhum parceiro. Importe sua base ou as digitações.</div>}
      </div>
    ) : (
      /* STRATEGIC VIEW */
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setSelected(null)} style={{background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:C.accent,padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"Outfit"}}>← Voltar</button>
          <h3 style={{fontFamily:"Outfit",fontWeight:700,fontSize:18}}>{sel.name}</h3>
          {sel.contato&&<span style={{fontSize:11,color:C.muted}}>{sel.contato}</span>}
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Stat label="Digitações (período)" value={sel.count}/>
          <Stat label="Repasse" value={fmtCur(sel.repasse)} color={C.accent}/>
          <Stat label="Pagas" value={sel.finCount} sub={fmtCur(sel.finRepasse)} color={C.accent2}/>
          <Stat label="Conversão" value={sel.conv.toFixed(1)+"%"} color={sel.conv>=50?C.accent2:sel.conv>=30?C.warn:C.danger}/>
          <Stat label="Total Geral" value={sel.totalAllTime} sub={"Desde o início"}/>
        </div>

        {/* Trend */}
        {sel.months.length>0&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Evolução Mensal</div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end",height:90}}>{(()=>{const mx=Math.max(...sel.months.map(([,v])=>v.r),1);return sel.months.map(([m,v])=>(<div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{fontSize:8,color:C.muted}}>{fmtCur(v.r)}</div><div style={{width:"100%",maxWidth:38,background:"linear-gradient(180deg,"+C.accent+","+C.accent2+")",borderRadius:4,height:Math.max(4,(v.r/mx)*80)+"%"}}/><div style={{fontSize:8,color:C.muted}}>{m.slice(5)}/{m.slice(2,4)}</div></div>));})()}</div>
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {/* By Operação */}
          <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Por Operação</div>
            {sel.byOp.map(([op,d])=>{const rate=d.c?(d.fc/d.c*100):0;return(<div key={op} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{fontWeight:600}}>{op}</span><span style={{color:C.accent}}>{fmtCur(d.r)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted}}><span>{d.c} dig · {d.fc} pagas</span><span style={{color:rate>=50?C.accent2:rate>=30?C.warn:C.danger,fontWeight:600}}>{rate.toFixed(0)}% conv.</span></div>
            </div>);})}
            {sel.byOp.length===0&&<div style={{fontSize:11,color:C.muted}}>Sem dados</div>}
          </div>

          {/* By Banco */}
          <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Por Banco</div>
            {sel.byBanco.map(([bk,d])=>{const rate=d.c?(d.fc/d.c*100):0;return(<div key={bk} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}><span style={{fontWeight:600}}>{bk}</span><span style={{color:C.accent}}>{fmtCur(d.r)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted}}><span>{d.c} dig · {d.fc} pagas</span><span style={{color:rate>=50?C.accent2:rate>=30?C.warn:C.danger,fontWeight:600}}>{rate.toFixed(0)}%</span></div>
            </div>);})}
            {sel.byBanco.length===0&&<div style={{fontSize:11,color:C.muted}}>Sem dados</div>}
          </div>
        </div>

        {/* Situação breakdown */}
        <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:18}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Situação das Digitações</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{sel.bySit.map(([sit,d])=>(<div key={sit} style={{background:C.surface,borderRadius:8,padding:"8px 14px",border:"1px solid "+C.border,minWidth:100}}>
            <div style={{fontSize:16,fontWeight:700,color:sitColor(sit)}}>{d.c}</div>
            <div style={{fontSize:10,color:sitColor(sit),fontWeight:600}}>{sit}</div>
            <div style={{fontSize:9,color:C.muted}}>{fmtCur(d.r)}</div>
          </div>))}</div>
        </div>

        {/* Pontos para conversa */}
        <div style={{background:C.card,border:"1px solid "+C.accent+"33",borderRadius:14,padding:18}}>
          <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:10}}>📌 Pontos para Conversa</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:12}}>
            {sel.count===0&&<div style={{color:C.danger}}>⚠ Nenhuma digitação no período — verificar atividade do parceiro</div>}
            {sel.conv<30&&sel.count>0&&<div style={{color:C.danger}}>⚠ Conversão baixa ({sel.conv.toFixed(0)}%) — revisar qualidade das digitações e estornos</div>}
            {sel.conv>=30&&sel.conv<50&&sel.count>0&&<div style={{color:C.warn}}>⚡ Conversão razoável ({sel.conv.toFixed(0)}%) — espaço para melhorar, alinhar bancos e produtos</div>}
            {sel.conv>=50&&sel.count>0&&<div style={{color:C.accent2}}>✓ Boa conversão ({sel.conv.toFixed(0)}%) — manter estratégia e buscar aumentar volume</div>}
            {sel.byOp.length>0&&<div>📊 Principal operação: <strong>{sel.byOp[0][0]}</strong> ({sel.byOp[0][1].c} dig, {fmtCur(sel.byOp[0][1].r)} repasse)</div>}
            {sel.byBanco.length>0&&<div>🏦 Principal banco: <strong>{sel.byBanco[0][0]}</strong> ({sel.byBanco[0][1].c} dig)</div>}
            {sel.bySit.find(([s])=>s==="ESTORNADO")&&<div style={{color:C.danger}}>⚠ {sel.bySit.find(([s])=>s==="ESTORNADO")[1].c} estornos ({fmtCur(sel.bySit.find(([s])=>s==="ESTORNADO")[1].r)}) — investigar motivos</div>}
            {sel.months.length>=2&&(()=>{const last=sel.months[sel.months.length-1][1].r;const prev=sel.months[sel.months.length-2][1].r;const v=prev?((last-prev)/prev*100):0;return v<-20?<div style={{color:C.danger}}>📉 Queda de {Math.abs(v).toFixed(0)}% no último mês — atenção</div>:v>20?<div style={{color:C.accent2}}>📈 Crescimento de {v.toFixed(0)}% no último mês — reconhecer</div>:null;})()}
          </div>
        </div>
      </div>
    )}
  </div>);
}

/* ANÁLISE */
function Analise({ops}){
  const per=usePeriod();const filtered=per.filterOps(ops);
  const agentes=[...new Set(ops.map(o=>o.agente).filter(Boolean))];
  const curMonth=NOW.toISOString().slice(0,7);const prevDate=new Date(NOW.getFullYear(),NOW.getMonth()-1,1);const prevMonth=prevDate.toISOString().slice(0,7);
  const stats=agentes.map(a=>{const all=filtered.filter(o=>o.agente===a);const cur=ops.filter(o=>o.agente===a&&o.data?.startsWith(curMonth));const prev=ops.filter(o=>o.agente===a&&o.data?.startsWith(prevMonth));const curR=cur.reduce((s,o)=>s+(o.vrRepasse||0),0);const prevR=prev.reduce((s,o)=>s+(o.vrRepasse||0),0);const variation=prevR?((curR-prevR)/prevR*100):(curR>0?100:0);const lastOp=[...ops.filter(o=>o.agente===a)].sort((a,b)=>(b.data||"").localeCompare(a.data||""))[0];const daysSince=lastOp?Math.floor((NOW-new Date(lastOp.data))/86400000):999;const fin=all.filter(isFinal);const conv=all.length?(fin.length/all.length*100):0;let alert="ok";if(cur.length===0&&prev.length>0)alert="inactive";else if(variation<=-30)alert="drop_heavy";else if(variation<0)alert="drop_light";return{name:a,curCount:cur.length,prevCount:prev.length,curR,prevR,variation,daysSince,lastDate:lastOp?.data,alert,periodCount:all.length,periodR:all.reduce((s,o)=>s+(o.vrRepasse||0),0),conv};}).sort((a,b)=>{const order={inactive:0,drop_heavy:1,drop_light:2,ok:3};return(order[a.alert]??4)-(order[b.alert]??4);});
  const alertCount=stats.filter(p=>["inactive","drop_heavy"].includes(p.alert)).length;
  const days=[];for(let i=29;i>=0;i--){const d=new Date(NOW);d.setDate(d.getDate()-i);const ds=d.toISOString().split("T")[0];const dayOps=ops.filter(o=>o.data===ds);days.push({date:ds,count:dayOps.length,r:dayOps.reduce((s,o)=>s+(o.vrRepasse||0),0)});}const maxC=Math.max(...days.map(d=>d.count),1);
  if(ops.length===0)return<div style={{padding:30,textAlign:"center",color:C.muted}}>Importe digitações</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <h2 style={{fontFamily:"Outfit",fontWeight:800,fontSize:20}}>Análise de Digitações</h2>
    <PeriodBar p={per}/>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Stat label="Mês Atual" value={ops.filter(o=>o.data?.startsWith(curMonth)).length} sub={ops.filter(o=>o.data?.startsWith(prevMonth)).length+" no anterior"}/><Stat label="Em Queda" value={stats.filter(p=>["drop_heavy","drop_light"].includes(p.alert)).length} color={C.warn}/><Stat label="Sem Digitar" value={stats.filter(p=>p.alert==="inactive").length} color={C.danger}/><Stat label="Alertas" value={alertCount} color={alertCount?C.danger:C.accent2}/></div>
    {alertCount>0&&<div style={{background:C.dangerBg,border:"1px solid "+C.danger+"33",borderRadius:12,padding:14}}><div style={{fontSize:12,fontWeight:700,color:C.danger,marginBottom:6}}>⚠ Atenção</div>{stats.filter(p=>["inactive","drop_heavy"].includes(p.alert)).map(pp=>(<div key={pp.name} style={{fontSize:11,padding:"3px 0",display:"flex",gap:6,alignItems:"center"}}><span style={{color:pp.alert==="inactive"?C.danger:C.warn}}>{pp.alert==="inactive"?"🔴":"🟡"}</span><strong>{pp.name}</strong><span style={{color:C.muted}}>— {pp.alert==="inactive"?"Sem digitação (última: "+(pp.lastDate?fmtDate(pp.lastDate):"nunca")+")":"Queda de "+Math.abs(pp.variation).toFixed(0)+"%"}</span></div>))}</div>}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:16}}><div style={{fontSize:12,fontWeight:600,marginBottom:12}}>Digitações Diárias (30 dias)</div><div style={{display:"flex",gap:2,alignItems:"flex-end",height:90}}>{days.map(d=>(<div key={d.date} style={{flex:1}} title={fmtDate(d.date)+": "+d.count}><div style={{width:"100%",background:d.date===TODAY?C.accent:C.accent+"55",borderRadius:2,height:Math.max(2,(d.count/maxC)*80)+"%"}}/></div>))}</div><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{fontSize:9,color:C.muted}}>{fmtDate(days[0]?.date)}</span><span style={{fontSize:9,color:C.accent}}>Hoje</span></div></div>
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid "+C.border}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:C.surface}}>{["","Parceiro","No Período","Repasse","Mês Atual","Anterior","Variação","Conv.","Última","Dias"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:C.muted,fontSize:9,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{stats.map(pp=>{const icon=pp.alert==="inactive"?"🔴":pp.alert==="drop_heavy"?"🔴":pp.alert==="drop_light"?"🟡":"↗";const vc=pp.variation>0?C.accent2:pp.variation<-30?C.danger:pp.variation<0?C.warn:C.text;return(<tr key={pp.name} style={{borderBottom:"1px solid "+C.border}}><td style={{padding:"8px 10px",fontSize:13}}>{icon}</td><td style={{padding:"8px 10px",fontWeight:600,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pp.name}</td><td style={{padding:"8px 10px"}}>{pp.periodCount}</td><td style={{padding:"8px 10px",fontWeight:600,color:C.accent}}>{fmtCur(pp.periodR)}</td><td style={{padding:"8px 10px"}}>{pp.curCount}</td><td style={{padding:"8px 10px"}}>{pp.prevCount}</td><td style={{padding:"8px 10px",fontWeight:600,color:vc}}>{pp.variation>0?"+":""}{pp.variation.toFixed(0)}%</td><td style={{padding:"8px 10px"}}><span style={{color:pp.conv>=50?C.accent2:pp.conv>=30?C.warn:C.danger,fontWeight:600}}>{pp.conv.toFixed(0)}%</span></td><td style={{padding:"8px 10px"}}>{pp.lastDate?fmtDate(pp.lastDate):"—"}</td><td style={{padding:"8px 10px",color:pp.daysSince>30?C.danger:pp.daysSince>14?C.warn:C.text}}>{pp.daysSince<999?pp.daysSince+"d":"—"}</td></tr>);})}</tbody></table></div>
  </div>);
}

/* MAIN APP */
const NAV=[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"ops",label:"Operações",icon:"💼"},{id:"kanban",label:"Kanban",icon:"📋"},{id:"parceiros",label:"Parceiros",icon:"🤝"},{id:"portabilidade",label:"Portabilidade",icon:"🔄"},{id:"analise",label:"Análise",icon:"📈"}];

export default function App(){
  const[user,setUser]=useState(null);const[view,setView]=useState("dashboard");const[ops,setOpsRaw]=useState([]);const[partners,setPartnersRaw]=useState([]);const[loaded,setLoaded]=useState(false);
  const setOps=useCallback(fn=>{setOpsRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(K.ops,next);return next;});},[]);
  const setPartners=useCallback(fn=>{setPartnersRaw(prev=>{const next=typeof fn==="function"?fn(prev):fn;save(K.partners,next);return next;});},[]);
  useEffect(()=>{(async()=>{const[o,p]=await Promise.all([load(K.ops),load(K.partners)]);setOpsRaw(o||[]);setPartnersRaw(p||[]);setLoaded(true);})();},[]);
  if(!user)return<Login onLogin={setUser}/>;
  if(!loaded)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,color:C.text,fontFamily:"Outfit"}}>Carregando...</div>;
  const agentes=[...new Set(ops.map(o=>o.agente).filter(Boolean))];const curMonth=NOW.toISOString().slice(0,7);const inact=agentes.filter(a=>!ops.some(o=>o.agente===a&&o.data?.startsWith(curMonth))).length;
  return(<><style>{"@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');*{margin:0;padding:0;box-sizing:border-box;}body{background:"+C.bg+";color:"+C.text+";font-family:'Outfit',sans-serif;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:"+C.bg+";}::-webkit-scrollbar-thumb{background:"+C.border+";border-radius:3px;}select option{background:"+C.surface+";color:"+C.text+";}"}</style>
    <div style={{display:"flex",minHeight:"100vh"}}>
      <div style={{width:210,background:C.card,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"22px 18px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+","+C.accent2+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff"}}>O</div><h1 style={{fontSize:16,fontWeight:800}}>OpsManager</h1></div><div style={{fontSize:10,color:C.muted,marginTop:3,marginLeft:38}}>{ops.length} digitações · {partners.length} parceiros</div></div>
        <nav style={{flex:1,padding:"4px 10px"}}>{NAV.map(n=>{const active=view===n.id;const badge=n.id==="analise"?inact:n.id==="parceiros"?partners.length:0;return(<button key={n.id} onClick={()=>setView(n.id)} style={{display:"flex",alignItems:"center",gap:9,width:"100%",padding:"9px 11px",marginBottom:1,borderRadius:9,border:"none",background:active?C.accentBg:"transparent",color:active?C.accent:C.muted,fontFamily:"Outfit",fontSize:12,fontWeight:active?600:400,cursor:"pointer",textAlign:"left"}}><span style={{fontSize:15}}>{n.icon}</span>{n.label}{n.id==="analise"&&badge>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:7}}>{badge}</span>}</button>);})}</nav>
        <div style={{padding:"14px 18px",borderTop:"1px solid "+C.border}}><div style={{fontSize:12,fontWeight:600}}>{user.name}</div><div style={{fontSize:10,color:C.muted,marginBottom:6}}>{user.role}</div><button onClick={()=>setUser(null)} style={{fontSize:10,color:C.danger,background:"none",border:"none",cursor:"pointer",padding:0}}>Sair →</button></div>
      </div>
      <div style={{flex:1,padding:"24px 28px",overflowY:"auto",maxWidth:"calc(100vw - 210px)"}}>
        {view==="dashboard"&&<Dashboard ops={ops}/>}
        {view==="ops"&&<Operacoes ops={ops} setOps={setOps}/>}
        {view==="kanban"&&<Kanban ops={ops} setOps={setOps}/>}
        {view==="parceiros"&&<Parceiros ops={ops} partners={partners} setPartners={setPartners}/>}
        {view==="portabilidade"&&<Portabilidade ops={ops}/>}
        {view==="analise"&&<Analise ops={ops}/>}
      </div>
    </div>
  </>);
}
