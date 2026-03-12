import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import * as XLSX from 'xlsx'

/* ═══════════════════════════════════════════════════════════════════
   OpsManager — Vercel + Supabase Edition
   ═══════════════════════════════════════════════════════════════════ */

// ── THEME ─────────────────────────────────────────────────────────
const C = {
  bg:'#0A0E17', surface:'#0F1520', card:'#141B2B', border:'#1C2538',
  text:'#DAE0ED', muted:'#5B6B85', accent:'#3B82F6', accent2:'#10B981',
  warn:'#F59E0B', danger:'#EF4444', info:'#38BDF8', abg:'#3B82F622',
}

// ── UTILS ─────────────────────────────────────────────────────────
const NOW = new Date()
const TODAY = NOW.toISOString().split('T')[0]
const fmtCur = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtDate = d => { if(!d) return '—'; const p = String(d).split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : d }
const isFinal = o => ['FINALIZADO','PAGO','AVERBADO','CONCRETIZADO','PAGO C/ PENDENCIA','PAGO C/ PENDÊNCIA'].includes((o.situacaoBanco||'').toUpperCase())
const sitColor = s => { s=(s||'').toUpperCase(); if(['FINALIZADO','PAGO','AVERBADO','APROVADO','CONCRETIZADO','PAGO C/ PENDENCIA','PAGO C/ PENDÊNCIA'].includes(s)) return C.accent2; if(['ESTORNADO','CANCELADO','RECUSADO'].includes(s)) return C.danger; if(['EM ANÁLISE','PENDENTE'].includes(s)) return C.warn; return C.info }
function nDate(v) { if(!v) return ''; if(typeof v==='number'){const d=new Date(Math.round((v-25569)*86400*1000));return !isNaN(d.getTime())?d.toISOString().split('T')[0]:'';} const s=String(v).trim(),m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if(m) return (m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; return '' }
function pNum(v) { if(v==null||v==='') return 0; if(typeof v==='number') return v; return parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.'))||0 }

// ── DB MAPPING ────────────────────────────────────────────────────
function fromDb(r) {
  return { id:r.id, id_ext:r.id_ext||'', banco:r.banco||'', cpf:r.cpf||'', cliente:r.cliente||'',
    proposta:r.proposta||'', contrato:r.contrato||'', data:r.data||'', prazo:r.prazo||'',
    vrBruto:Number(r.vr_bruto)||0, vrParcela:Number(r.vr_parcela)||0, vrLiquido:Number(r.vr_liquido)||0,
    vrRepasse:Number(r.vr_repasse)||0, vrSeguro:Number(r.vr_seguro)||0, taxa:r.taxa||'',
    operacao:r.operacao||'', situacao:r.situacao||'', produto:r.produto||'', convenio:r.convenio||'',
    agente:r.agente||'', situacaoBanco:r.situacao_banco||'', obsSituacao:r.obs_situacao||'',
    usuario:r.usuario||'', crcCliente:r.crc_cliente||'', dataNossoCredito:r.data_nosso_credito||'' }
}
function toDb(o) {
  return { id_ext:o.id_ext||'', banco:o.banco||'', cpf:o.cpf||'', cliente:o.cliente||'',
    proposta:o.proposta||'', contrato:o.contrato||'', data:o.data||null, prazo:o.prazo||'',
    vr_bruto:o.vrBruto||0, vr_parcela:o.vrParcela||0, vr_liquido:o.vrLiquido||0,
    vr_repasse:o.vrRepasse||0, vr_seguro:o.vrSeguro||0, taxa:o.taxa||'',
    operacao:o.operacao||'', situacao:o.situacao||'', produto:o.produto||'', convenio:o.convenio||'',
    agente:o.agente||'', situacao_banco:o.situacaoBanco||'', obs_situacao:o.obsSituacao||'',
    usuario:o.usuario||'', crc_cliente:o.crcCliente||null, data_nosso_credito:o.dataNossoCredito||null }
}

// ── SHARED UI ─────────────────────────────────────────────────────
function Btn({children, variant='primary', style, disabled, onClick}) {
  const base = {border:'none',borderRadius:8,fontFamily:'Outfit',fontWeight:600,fontSize:12,cursor:disabled?'not-allowed':'pointer',padding:'8px 16px',opacity:disabled?0.4:1}
  const vs = {primary:{background:C.accent,color:'#fff'},success:{background:C.accent2,color:'#fff'},ghost:{background:C.surface,color:C.text,border:'1px solid '+C.border},danger:{background:'#EF444418',color:C.danger}}
  return <button style={{...base,...(vs[variant]||vs.primary),...style}} disabled={disabled} onClick={onClick}>{children}</button>
}
function Stat({label,value,sub,color}) {
  return <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:12,padding:'14px 16px',flex:1,minWidth:120}}>
    <div style={{fontSize:9,color:C.muted,marginBottom:4,fontWeight:600,textTransform:'uppercase'}}>{label}</div>
    <div style={{fontSize:18,fontWeight:700,color:color||C.text}}>{value}</div>
    {sub && <div style={{fontSize:10,color:C.muted,marginTop:2}}>{sub}</div>}
  </div>
}
function Field({label,value,onChange,type='text',options,placeholder,style:st}) {
  const b = {background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 11px',fontSize:12,outline:'none',width:'100%',fontFamily:'Outfit'}
  return <div style={{display:'flex',flexDirection:'column',gap:3,...st}}>
    {label && <label style={{fontSize:9,color:C.muted,fontWeight:600,textTransform:'uppercase'}}>{label}</label>}
    {options
      ? <select value={value||''} onChange={e=>onChange(e.target.value)} style={{...b,cursor:'pointer'}}>
          <option value="">— Todos —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      : <input type={type} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={b}/>
    }
  </div>
}
function Badge({text,color}) { return <span style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:color+'22',color,fontWeight:600}}>{text}</span> }

// ── PERIOD FILTER ─────────────────────────────────────────────────
function usePeriod() {
  const [per,setPer] = useState('mes')
  const [df,setDf] = useState('')
  const [dt,setDt] = useState('')
  const y = NOW.getFullYear(), mo = NOW.getMonth()
  const fmt = d => d.toISOString().split('T')[0]
  const f = (a,b) => fmt(new Date(a,b,1))
  const l = (a,b) => fmt(new Date(a,b+1,0))
  const pr = {
    mes:{f:f(y,mo),t:l(y,mo),n:'Mês Atual'}, ant:{f:f(y,mo-1),t:l(y,mo-1),n:'Mês Anterior'},
    tri:{f:f(y,mo-2),t:l(y,mo),n:'Trimestre'}, sem:{f:f(y,mo-5),t:l(y,mo),n:'Semestre'},
    ano:{f:y+'-01-01',t:y+'-12-31',n:String(y)}, tudo:{f:'2000-01-01',t:'2099-12-31',n:'Tudo'}
  }
  useEffect(() => { if(per!=='custom' && pr[per]) { setDf(pr[per].f); setDt(pr[per].t) } }, [per])
  return { per, setPer, df, setDf, dt, setDt, pr,
    filter: ops => ops.filter(o => o.data && o.data>=df && o.data<=dt),
    label: per==='custom' ? fmtDate(df)+' a '+fmtDate(dt) : (pr[per]?.n||'')
  }
}
function PeriodBar({p}) {
  return <div style={{display:'flex',flexDirection:'column',gap:6}}>
    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
      {Object.entries(p.pr).map(([k,v]) =>
        <button key={k} onClick={()=>p.setPer(k)} style={{padding:'4px 10px',borderRadius:6,border:'1px solid '+(p.per===k?C.accent:C.border),background:p.per===k?C.abg:'transparent',color:p.per===k?C.accent:C.muted,fontSize:10,fontWeight:p.per===k?600:400,cursor:'pointer',fontFamily:'Outfit'}}>{v.n}</button>
      )}
      <button onClick={()=>p.setPer('custom')} style={{padding:'4px 10px',borderRadius:6,border:'1px solid '+(p.per==='custom'?C.accent:C.border),background:p.per==='custom'?C.abg:'transparent',color:p.per==='custom'?C.accent:C.muted,fontSize:10,cursor:'pointer',fontFamily:'Outfit'}}>Custom</button>
    </div>
    {p.per==='custom' && <div style={{display:'flex',gap:8}}><Field label="De" value={p.df} onChange={p.setDf} type="date" style={{minWidth:120}}/><Field label="Até" value={p.dt} onChange={p.setDt} type="date" style={{minWidth:120}}/></div>}
    <div style={{fontSize:10,color:C.muted}}>Período: <strong style={{color:C.text}}>{p.label}</strong></div>
  </div>
}

// ── IMPORT FIELDS ─────────────────────────────────────────────────
const IMP = {
  id_ext:{l:'ID',a:['id']}, banco:{l:'Banco',a:['banco']}, cpf:{l:'CPF',a:['cpf']},
  cliente:{l:'Cliente',a:['cliente','nome']}, proposta:{l:'Proposta',a:['proposta']},
  contrato:{l:'Nº Contrato',a:['contrato','nº contrato']}, data:{l:'Data',a:['data','date']},
  prazo:{l:'Prazo',a:['prazo']}, vrBruto:{l:'Vr. Bruto',a:['vr. bruto','vr bruto','bruto']},
  vrParcela:{l:'Vr. Parcela',a:['vr. parcela','vr parcela']},
  vrLiquido:{l:'Vr. Líquido',a:['vr. líquido','vr liquido']},
  vrRepasse:{l:'Vr. Repasse',a:['vr. repasse','vr repasse','repasse']},
  vrSeguro:{l:'Vr. Seguro',a:['vr. seguro']}, taxa:{l:'Taxa',a:['taxa']},
  operacao:{l:'Operação',a:['operação','operacao']},
  situacao:{l:'Situação',a:['situação','situacao','status']},
  produto:{l:'Produto',a:['produto']}, convenio:{l:'Convênio',a:['convênio','convenio']},
  agente:{l:'Agente',a:['agente']},
  situacaoBanco:{l:'Sit. Banco',a:['situação banco','situacao banco','sit. banco']},
  obsSituacao:{l:'Obs.',a:['obs. situação banco','obs situação']},
  usuario:{l:'Usuário',a:['usuário','usuario']},
  crcCliente:{l:'CRC Cliente',a:['crc cliente','crc','data crc']},
  dataNossoCredito:{l:'Nosso Crédito',a:['nosso crédito','nosso credito','dt nosso crédito']},
}

// ── IMPORT MODAL ──────────────────────────────────────────────────
function ImportModal({open, onClose, onImport}) {
  const fr = useRef(null)
  const [step,setStep] = useState(1)
  const [raw,setRaw] = useState([])
  const [hd,setHd] = useState([])
  const [mp,setMp] = useState({})
  const [pv,setPv] = useState([])
  const [er,setEr] = useState([])
  const [fn,setFn] = useState('')
  const [busy,setBusy] = useState(false)

  useEffect(() => { if(!open) { setStep(1);setRaw([]);setHd([]);setMp({});setPv([]);setEr([]);setFn('');setBusy(false) } }, [open])

  function autoMap(cols) {
    const m = {}
    Object.entries(IMP).forEach(([f,def]) => {
      const found = cols.find(c => { const cl=c.toLowerCase().trim(); return def.a.some(a => cl===a || cl.includes(a)) })
      if(found) m[f] = found
    })
    return m
  }

  function parse(file) {
    setFn(file.name); setEr([])
    const rd = new FileReader()
    rd.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'})
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''})
        if(!rows.length) { setEr(['Planilha vazia']); return }
        setRaw(rows)
        const cols = Object.keys(rows[0])
        setHd(cols)
        setMp(autoMap(cols))
        setStep(2)
      } catch(ex) { setEr(['Erro: '+ex.message]) }
    }
    rd.readAsArrayBuffer(file)
  }

  function build() {
    const errs = []
    const built = raw.map((row,i) => {
      const cl = mp.cliente ? String(row[mp.cliente]||'').trim() : ''
      const pr = mp.proposta ? String(row[mp.proposta]||'').trim() : ''
      const ok = !!(cl||pr)
      if(!ok) errs.push(i+2)
      const g = f => mp[f] ? String(row[mp[f]]||'').trim() : ''
      const gu = f => g(f).toUpperCase()
      return {
        _v:ok, cliente:cl, proposta:pr, id_ext:g('id_ext'), banco:g('banco'), cpf:g('cpf'),
        contrato:g('contrato'), data:nDate(mp.data?row[mp.data]:''), prazo:g('prazo'),
        vrBruto:pNum(mp.vrBruto?row[mp.vrBruto]:''), vrParcela:pNum(mp.vrParcela?row[mp.vrParcela]:''),
        vrLiquido:pNum(mp.vrLiquido?row[mp.vrLiquido]:''), vrRepasse:pNum(mp.vrRepasse?row[mp.vrRepasse]:''),
        vrSeguro:pNum(mp.vrSeguro?row[mp.vrSeguro]:''), taxa:g('taxa'),
        operacao:gu('operacao'), situacao:gu('situacao'), produto:g('produto'), convenio:gu('convenio'),
        agente:g('agente'), situacaoBanco:gu('situacaoBanco'), obsSituacao:g('obsSituacao'),
        usuario:g('usuario'), crcCliente:nDate(mp.crcCliente?row[mp.crcCliente]:''),
        dataNossoCredito:nDate(mp.dataNossoCredito?row[mp.dataNossoCredito]:''),
      }
    })
    setEr(errs); setPv(built); setStep(3)
  }

  async function doImport() {
    setBusy(true)
    const valid = pv.filter(p=>p._v).map(({_v,...r})=>r)
    await onImport(valid)
    setBusy(false)
    onClose()
  }

  if(!open) return null
  const vc = pv.filter(p=>p._v).length
  const tR = pv.filter(p=>p._v).reduce((s,o)=>s+(o.vrRepasse||0),0)

  return (
    <div style={{position:'fixed',inset:0,background:'#000000CC',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:18,width:760,maxWidth:'97vw',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{padding:'16px 22px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontFamily:'Outfit',fontWeight:700,fontSize:15,margin:0}}>Importar Digitações — Etapa {step}/3</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:22,cursor:'pointer'}}>×</button>
        </div>
        <div style={{padding:'16px 22px'}}>
          {step===1 && <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div onClick={()=>fr.current?.click()} style={{border:'2px dashed '+C.border,borderRadius:14,padding:'36px 20px',textAlign:'center',background:C.surface,cursor:'pointer'}}>
              <div style={{fontSize:32,marginBottom:6}}>📂</div>
              <div style={{fontSize:13,fontWeight:600}}>Clique para selecionar arquivo</div>
              <div style={{fontSize:11,color:C.muted}}>.xlsx, .xls, .csv</div>
              <input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)parse(f)}} style={{display:'none'}}/>
            </div>
            {er.length>0 && <div style={{background:'#EF444418',borderRadius:8,padding:'8px 12px',fontSize:12,color:C.danger}}>{er[0]}</div>}
          </div>}
          {step===2 && <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontSize:12,color:C.muted}}>Arquivo: <strong style={{color:C.text}}>{fn}</strong> — {raw.length} linhas — <strong style={{color:C.accent2}}>{Object.keys(mp).length}</strong> detectados</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
              {Object.entries(IMP).map(([f,def]) =>
                <div key={f} style={{display:'flex',flexDirection:'column',gap:2}}>
                  <label style={{fontSize:8,color:mp[f]?C.accent:C.muted,fontWeight:600,textTransform:'uppercase'}}>{def.l}</label>
                  <select value={mp[f]||''} onChange={e=>{const v=e.target.value;setMp(prev=>({...prev,[f]:v||undefined}))}} style={{background:C.surface,border:'1px solid '+(mp[f]?C.accent+'66':C.border),borderRadius:6,color:mp[f]?C.text:C.muted,padding:'4px 6px',fontSize:10,outline:'none',cursor:'pointer'}}>
                    <option value="">—</option>
                    {hd.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={()=>setStep(1)}>←</Btn>
              <Btn onClick={build} style={{flex:1}}>Revisar →</Btn>
            </div>
          </div>}
          {step===3 && <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {er.length>0 && <div style={{background:C.warn+'18',borderRadius:8,padding:'6px 12px',fontSize:11,color:C.warn}}>{er.length} linhas ignoradas</div>}
            <div style={{fontSize:12}}><strong style={{color:C.accent2}}>{vc}</strong> válidas — Repasse: <strong style={{color:C.accent}}>{fmtCur(tR)}</strong></div>
            <div style={{overflowX:'auto',maxHeight:260,borderRadius:8,border:'1px solid '+C.border}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                <thead><tr style={{background:C.surface}}>
                  {['','Cliente','Banco','Op.','Situação','Agente','Repasse'].map(h => <th key={h} style={{padding:'6px 8px',textAlign:'left',fontWeight:600,color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}
                </tr></thead>
                <tbody>{pv.slice(0,50).map((p,i) =>
                  <tr key={i} style={{borderBottom:'1px solid '+C.border,opacity:p._v?1:0.3}}>
                    <td style={{padding:'4px 8px',color:p._v?C.accent2:C.danger,fontWeight:700}}>{p._v?'✓':'✕'}</td>
                    <td style={{padding:'4px 8px'}}>{p.cliente}</td>
                    <td style={{padding:'4px 8px'}}>{p.banco}</td>
                    <td style={{padding:'4px 8px'}}>{p.operacao}</td>
                    <td style={{padding:'4px 8px'}}><Badge text={p.situacao||'—'} color={sitColor(p.situacao)}/></td>
                    <td style={{padding:'4px 8px'}}>{p.agente}</td>
                    <td style={{padding:'4px 8px',fontWeight:600}}>{fmtCur(p.vrRepasse)}</td>
                  </tr>
                )}</tbody>
              </table>
            </div>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="ghost" onClick={()=>setStep(2)}>←</Btn>
              <Btn variant="success" onClick={doImport} disabled={vc===0||busy} style={{flex:1}}>
                {busy ? 'Gravando no banco...' : '✓ Importar '+vc+' digitações'}
              </Btn>
            </div>
          </div>}
        </div>
      </div>
    </div>
  )
}

// ── EXPORT ────────────────────────────────────────────────────────
function ExportModal({open, onClose, ops}) {
  const [f,sf] = useState({})
  const aOf = k => [...new Set(ops.map(o=>o[k]).filter(Boolean))].sort()
  const fd = ops.filter(o =>
    (!f.banco||o.banco===f.banco)&&(!f.operacao||o.operacao===f.operacao)&&
    (!f.agente||o.agente===f.agente)&&(!f.situacao||o.situacao===f.situacao)&&
    (!f.df||o.data>=f.df)&&(!f.dt||o.data<=f.dt)
  )
  function go() {
    const ws = XLSX.utils.json_to_sheet(fd.map(o=>({Data:o.data,Banco:o.banco,CPF:o.cpf,Cliente:o.cliente,Proposta:o.proposta,Operação:o.operacao,Situação:o.situacao,Convênio:o.convenio,Agente:o.agente,'Vr.Repasse':o.vrRepasse,'Vr.Bruto':o.vrBruto,'Sit.Banco':o.situacaoBanco,CRC:o.crcCliente,'Nosso Crédito':o.dataNossoCredito})))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Dig')
    XLSX.writeFile(wb,'digitacoes_'+TODAY+'.xlsx')
    onClose()
  }
  if(!open) return null
  return <div style={{position:'fixed',inset:0,background:'#000000BB',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:'1px solid '+C.border,borderRadius:16,width:640,maxWidth:'96vw',maxHeight:'92vh',overflowY:'auto'}}>
      <div style={{padding:'14px 20px',borderBottom:'1px solid '+C.border,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{fontWeight:700,fontSize:15,margin:0}}>Exportar</h3>
        <button onClick={onClose} style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer'}}>×</button>
      </div>
      <div style={{padding:'16px 20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          <Field label="Banco" value={f.banco||''} onChange={v=>sf(x=>({...x,banco:v}))} options={aOf('banco')}/>
          <Field label="Op." value={f.operacao||''} onChange={v=>sf(x=>({...x,operacao:v}))} options={aOf('operacao')}/>
          <Field label="Agente" value={f.agente||''} onChange={v=>sf(x=>({...x,agente:v}))} options={aOf('agente')}/>
          <Field label="Sit." value={f.situacao||''} onChange={v=>sf(x=>({...x,situacao:v}))} options={aOf('situacao')}/>
          <Field label="De" value={f.df||''} onChange={v=>sf(x=>({...x,df:v}))} type="date"/>
          <Field label="Até" value={f.dt||''} onChange={v=>sf(x=>({...x,dt:v}))} type="date"/>
        </div>
        <div style={{background:C.surface,borderRadius:8,padding:'8px 14px',marginBottom:10,fontSize:12}}>
          <strong style={{color:C.accent}}>{fd.length}</strong> registros — {fmtCur(fd.reduce((s,o)=>s+(o.vrRepasse||0),0))}
        </div>
        <Btn variant="success" onClick={go} style={{width:'100%'}} disabled={!fd.length}>📤 Exportar</Btn>
      </div>
    </div>
  </div>
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function Dashboard({ops}) {
  const p = usePeriod()
  const f = p.filter(ops)
  const tR = f.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const fin = f.filter(isFinal)
  const fR = fin.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const ags = [...new Set(f.map(o=>o.agente).filter(Boolean))]

  const bySit = useMemo(() => {
    const m = {}; f.forEach(o => { const k=o.situacao||'?'; m[k]=(m[k]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1])
  }, [f])

  const byOp = useMemo(() => {
    const m = {}; f.forEach(o => { const k=o.operacao||'?'; if(!m[k])m[k]={r:0,c:0}; m[k].r+=(o.vrRepasse||0);m[k].c++ })
    return Object.entries(m).sort((a,b)=>b[1].r-a[1].r)
  }, [f])

  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <h2 style={{fontWeight:800,fontSize:20}}>Dashboard</h2>
    <PeriodBar p={p}/>
    {!ops.length
      ? <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:'36px 20px',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>
          <div style={{fontSize:13,fontWeight:600}}>Nenhuma digitação</div>
          <div style={{fontSize:12,color:C.muted}}>Vá em Operações → Importar</div>
        </div>
      : <>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <Stat label="Produção" value={fmtCur(tR)} color={C.accent}/>
          <Stat label="Pago" value={fmtCur(fR)} color={C.accent2} sub={fin.length+' ops'}/>
          <Stat label="Digitações" value={f.length}/>
          <Stat label="Parceiros" value={ags.length}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Situação</div>
            {bySit.slice(0,7).map(([s,c]) =>
              <div key={s} style={{marginBottom:5}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10}}>
                  <span style={{color:sitColor(s),fontWeight:600}}>{s}</span>
                  <span style={{color:C.muted}}>{c}</span>
                </div>
                <div style={{height:4,background:C.surface,borderRadius:2}}>
                  <div style={{height:'100%',background:sitColor(s),borderRadius:2,width:(c/(f.length||1)*100)+'%'}}/>
                </div>
              </div>
            )}
          </div>
          <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
            <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Operações</div>
            {byOp.map(([op,d]) =>
              <div key={op} style={{marginBottom:6}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10}}>
                  <span style={{fontWeight:600}}>{op}</span>
                  <span style={{color:C.accent}}>{fmtCur(d.r)}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <div style={{flex:1,height:5,background:C.surface,borderRadius:2}}>
                    <div style={{height:'100%',background:C.accent,borderRadius:2,width:(d.r/(tR||1)*100)+'%'}}/>
                  </div>
                  <span style={{fontSize:8,color:C.muted}}>{d.c}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    }
  </div>
}

// ── OPERAÇÕES ─────────────────────────────────────────────────────
function Operacoes({ops, onImport}) {
  const [io,sio] = useState(false)
  const [eo,seo] = useState(false)
  const [se,sse] = useState('')
  const [fs,sfs] = useState('')
  const aS = [...new Set(ops.map(o=>o.situacao).filter(Boolean))].sort()
  const fd = ops
    .filter(o => !fs||o.situacao===fs)
    .filter(o => { if(!se) return true; const s=se.toLowerCase(); return (o.cliente||'').toLowerCase().includes(s)||(o.agente||'').toLowerCase().includes(s)||(o.cpf||'').includes(s) })
    .sort((a,b) => (b.data||'').localeCompare(a.data||''))

  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <h2 style={{fontWeight:800,fontSize:20}}>Operações</h2>
      <div style={{display:'flex',gap:6}}>
        <Btn variant="ghost" onClick={()=>sio(true)}>📥 Importar</Btn>
        <Btn variant="ghost" onClick={()=>seo(true)}>📤 Exportar</Btn>
      </div>
    </div>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <input value={se} onChange={e=>sse(e.target.value)} placeholder="Buscar..." style={{background:C.surface,border:'1px solid '+C.border,borderRadius:7,color:C.text,padding:'7px 12px',fontSize:12,outline:'none',flex:1,minWidth:160,fontFamily:'Outfit'}}/>
      <Field value={fs} onChange={sfs} options={aS} style={{minWidth:90}}/>
    </div>
    <div style={{fontSize:10,color:C.muted}}>{fd.length} registros — {fmtCur(fd.reduce((s,o)=>s+(o.vrRepasse||0),0))}</div>
    <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead><tr style={{background:C.surface}}>
          {['Data','Cliente','Banco','Op.','Situação','Agente','Repasse'].map(h =>
            <th key={h} style={{padding:'8px 9px',textAlign:'left',fontWeight:600,color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>
          )}
        </tr></thead>
        <tbody>{fd.slice(0,300).map(o =>
          <tr key={o.id} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'7px 9px',whiteSpace:'nowrap'}}>{fmtDate(o.data)}</td>
            <td style={{padding:'7px 9px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.cliente||'—'}</td>
            <td style={{padding:'7px 9px'}}>{o.banco}</td>
            <td style={{padding:'7px 9px'}}>{o.operacao}</td>
            <td style={{padding:'7px 9px'}}><Badge text={o.situacao||'—'} color={sitColor(o.situacao)}/></td>
            <td style={{padding:'7px 9px',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.agente}</td>
            <td style={{padding:'7px 9px',fontWeight:600}}>{fmtCur(o.vrRepasse)}</td>
          </tr>
        )}</tbody>
      </table>
      {!fd.length && <div style={{padding:24,textAlign:'center',color:C.muted}}>Nenhuma digitação. Importe sua planilha.</div>}
    </div>
    <ImportModal open={io} onClose={()=>sio(false)} onImport={onImport}/>
    <ExportModal open={eo} onClose={()=>seo(false)} ops={ops}/>
  </div>
}

// ── PRODUÇÃO ──────────────────────────────────────────────────────
function Producao({ops}) {
  const per = usePeriod(); const f = per.filter(ops)
  const [tab,sTab] = useState('banco')
  const tR = f.reduce((s,o)=>s+(o.vrRepasse||0),0)
  const data = useMemo(() => {
    const kFn = tab==='banco'?o=>o.banco:tab==='convenio'?o=>o.convenio:o=>o.operacao
    const m = {}
    f.forEach(o => { const k=kFn(o)||'?'; if(!m[k]) m[k]={c:0,r:0,fc:0,fr:0}; m[k].c++; m[k].r+=(o.vrRepasse||0); if(isFinal(o)){m[k].fc++;m[k].fr+=(o.vrRepasse||0)} })
    return Object.entries(m).sort((a,b)=>b[1].r-a[1].r)
  }, [f,tab])

  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <h2 style={{fontWeight:800,fontSize:20}}>Produção</h2>
    <PeriodBar p={per}/>
    <div style={{display:'flex',gap:4}}>
      {[{id:'banco',n:'🏦 Banco'},{id:'convenio',n:'📑 Convênio'},{id:'operacao',n:'⚡ Operação'}].map(t =>
        <button key={t.id} onClick={()=>sTab(t.id)} style={{padding:'6px 14px',borderRadius:8,border:'1px solid '+(tab===t.id?C.accent:C.border),background:tab===t.id?C.abg:'transparent',color:tab===t.id?C.accent:C.muted,fontSize:11,fontWeight:tab===t.id?600:400,cursor:'pointer',fontFamily:'Outfit'}}>{t.n}</button>
      )}
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Repasse" value={fmtCur(tR)} color={C.accent}/>
      <Stat label="Digitações" value={f.length}/>
    </div>
    <div style={{overflowX:'auto',borderRadius:10,border:'1px solid '+C.border}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
        <thead><tr style={{background:C.surface}}>
          {[tab==='banco'?'Banco':tab==='convenio'?'Convênio':'Operação','Dig.','Repasse','%','Pago','Conv.'].map(h =>
            <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>
          )}
        </tr></thead>
        <tbody>{data.map(([n,d]) => {
          const pct=tR?(d.r/tR*100):0; const cv=d.c?(d.fc/d.c*100):0
          return <tr key={n} style={{borderBottom:'1px solid '+C.border}}>
            <td style={{padding:'8px 10px',fontWeight:700}}>{n}</td>
            <td style={{padding:'8px 10px'}}>{d.c}</td>
            <td style={{padding:'8px 10px',fontWeight:600,color:C.accent}}>{fmtCur(d.r)}</td>
            <td style={{padding:'8px 10px',color:C.muted}}>{pct.toFixed(0)}%</td>
            <td style={{padding:'8px 10px',color:C.accent2,fontWeight:600}}>{fmtCur(d.fr)}</td>
            <td style={{padding:'8px 10px'}}><span style={{fontWeight:600,color:cv>=50?C.accent2:cv>=30?C.warn:C.danger}}>{cv.toFixed(0)}%</span></td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </div>
}

// ── RECEBIMENTOS ──────────────────────────────────────────────────
function Recebimentos({ops}) {
  const per = usePeriod(); const f = per.filter(ops)
  const pend = useMemo(()=>f.filter(o=>o.crcCliente&&!o.dataNossoCredito),[f])
  const rec = useMemo(()=>f.filter(o=>o.crcCliente&&o.dataNossoCredito),[f])
  const pR = pend.reduce((s,o)=>s+(o.vrRepasse||0),0)

  const byBanco = useMemo(() => {
    const m = {}
    pend.forEach(o => { const b=o.banco||'?'; if(!m[b])m[b]={c:0,r:0}; m[b].c++; m[b].r+=(o.vrRepasse||0) })
    return Object.entries(m).sort((a,b)=>b[1].r-a[1].r)
  }, [pend])

  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <h2 style={{fontWeight:800,fontSize:20}}>Recebimentos Pendentes</h2>
    <PeriodBar p={per}/>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <Stat label="Pendentes" value={pend.length} sub={fmtCur(pR)} color={C.danger}/>
      <Stat label="Recebidas" value={rec.length} sub={fmtCur(rec.reduce((s,o)=>s+(o.vrRepasse||0),0))} color={C.accent2}/>
    </div>
    {!pend.length
      ? <div style={{background:C.card,borderRadius:14,padding:28,textAlign:'center',color:C.muted}}>Nenhuma pendência (mapeie CRC CLIENTE e NOSSO CRÉDITO na importação)</div>
      : <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Por Banco</div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:C.surface}}>
              {['Banco','Qtd','Pendente'].map(h => <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:C.muted,fontSize:8,textTransform:'uppercase'}}>{h}</th>)}
            </tr></thead>
            <tbody>{byBanco.map(([b,d]) =>
              <tr key={b} style={{borderBottom:'1px solid '+C.border}}>
                <td style={{padding:'8px 10px',fontWeight:700}}>{b}</td>
                <td style={{padding:'8px 10px'}}>{d.c}</td>
                <td style={{padding:'8px 10px',fontWeight:600,color:C.danger}}>{fmtCur(d.r)}</td>
              </tr>
            )}</tbody>
          </table>
        </div>
    }
  </div>
}

// ── NAV ───────────────────────────────────────────────────────────
const NAV = [
  {id:'dashboard',l:'Dashboard',i:'📊'},
  {id:'ops',l:'Operações',i:'💼'},
  {id:'producao',l:'Produção',i:'🏦'},
  {id:'recebimentos',l:'Recebimentos',i:'💰'},
]

// ── LOGIN ─────────────────────────────────────────────────────────
function Login({onLogin}) {
  const [u,setU] = useState('')
  const [p,setP] = useState('')
  const [err,setErr] = useState('')
  function go() {
    if(u.trim().length>=2 && p.trim().length>=2) onLogin({name:u.trim(),role:'Gestor'})
    else setErr('Preencha nome e senha')
  }
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg}}>
    <div style={{background:C.card,border:'1px solid '+C.border,borderRadius:20,padding:'40px 36px',width:370}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
        <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,'+C.accent+','+C.accent2+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff'}}>O</div>
        <h1 style={{fontSize:22,fontWeight:800}}>OpsManager</h1>
      </div>
      <p style={{color:C.muted,fontSize:12,marginBottom:28}}>Gestão de Digitações</p>
      {err && <div style={{background:'#EF444418',color:C.danger,padding:'8px 12px',borderRadius:8,fontSize:12,marginBottom:12}}>{err}</div>}
      <Field label="Usuário" value={u} onChange={v=>{setU(v);setErr('')}} placeholder="Seu nome"/>
      <div style={{height:8}}/>
      <Field label="Senha" value={p} onChange={v=>{setP(v);setErr('')}} type="password" placeholder="Sua senha"/>
      <div style={{height:16}}/>
      <Btn onClick={go} style={{width:'100%',padding:'11px 0',fontSize:13,borderRadius:10}}>Entrar</Btn>
    </div>
  </div>
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [user,setUser] = useState(null)
  const [ops,setOps] = useState([])
  const [view,setView] = useState('dashboard')
  const [status,setStatus] = useState('')

  // Load data from Supabase on mount
  useEffect(() => {
    setStatus('loading')
    supabase.from('digitacoes').select('*').order('data',{ascending:false})
      .then(({data,error}) => {
        if(error) { console.error(error); setStatus('error') }
        else { setOps((data||[]).map(fromDb)); setStatus('') }
      })
      .catch(e => { console.error(e); setStatus('error') })
  }, [])

  // Import handler
  async function handleImport(rows) {
    setStatus('saving')
    try {
      for(let i=0; i<rows.length; i+=500) {
        const batch = rows.slice(i,i+500).map(toDb)
        const {error} = await supabase.from('digitacoes').insert(batch)
        if(error) throw error
      }
      // Reload
      const {data} = await supabase.from('digitacoes').select('*').order('data',{ascending:false})
      setOps((data||[]).map(fromDb))
      setStatus('')
    } catch(e) { console.error(e); setStatus('error') }
  }

  if(!user) return <Login onLogin={setUser}/>

  return <div style={{display:'flex',minHeight:'100vh'}}>
    {/* Sidebar */}
    <div style={{width:195,background:C.card,borderRight:'1px solid '+C.border,display:'flex',flexDirection:'column',flexShrink:0}}>
      <div style={{padding:'20px 14px 10px'}}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <div style={{width:26,height:26,borderRadius:7,background:'linear-gradient(135deg,'+C.accent+','+C.accent2+')',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>O</div>
          <h1 style={{fontSize:14,fontWeight:800}}>OpsManager</h1>
        </div>
        <div style={{fontSize:9,color:C.muted,marginTop:2,marginLeft:33}}>
          {ops.length} digitações
          {status==='loading' && ' · Carregando...'}
          {status==='saving' && ' · 💾 Salvando...'}
          {status==='error' && ' · ⚠ Erro'}
        </div>
        <div style={{fontSize:8,color:C.accent2,marginTop:2,marginLeft:33}}>● Supabase</div>
      </div>
      <nav style={{flex:1,padding:'2px 7px'}}>
        {NAV.map(n => {
          const a = view===n.id
          return <button key={n.id} onClick={()=>setView(n.id)} style={{display:'flex',alignItems:'center',gap:7,width:'100%',padding:'7px 9px',marginBottom:1,borderRadius:7,border:'none',background:a?C.abg:'transparent',color:a?C.accent:C.muted,fontFamily:'Outfit',fontSize:11,fontWeight:a?600:400,cursor:'pointer',textAlign:'left'}}>
            <span style={{fontSize:13}}>{n.i}</span>{n.l}
          </button>
        })}
      </nav>
      <div style={{padding:'10px 14px',borderTop:'1px solid '+C.border}}>
        <div style={{fontSize:11,fontWeight:600}}>{user.name}</div>
        <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{user.role}</div>
        <button onClick={()=>setUser(null)} style={{fontSize:9,color:C.danger,background:'none',border:'none',cursor:'pointer',padding:0}}>Sair →</button>
      </div>
    </div>
    {/* Content */}
    <div style={{flex:1,padding:'20px 24px',overflowY:'auto',maxWidth:'calc(100vw - 195px)'}}>
      {view==='dashboard' && <Dashboard ops={ops}/>}
      {view==='ops' && <Operacoes ops={ops} onImport={handleImport}/>}
      {view==='producao' && <Producao ops={ops}/>}
      {view==='recebimentos' && <Recebimentos ops={ops}/>}
    </div>
  </div>
}
