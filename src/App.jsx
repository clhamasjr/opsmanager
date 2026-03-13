import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'
import * as XLSX from 'xlsx'

/* ── THEME ── */
const C = {
  bg: '#0A0E17', surface: '#0F1520', card: '#141B2B', border: '#1C2538',
  text: '#DAE0ED', muted: '#5B6B85', accent: '#3B82F6', accent2: '#10B981',
  warn: '#F59E0B', danger: '#EF4444', info: '#38BDF8', abg: '#3B82F622'
}

/* ── UTILS ── */
const NOW = new Date()
const TODAY = NOW.toISOString().split('T')[0]
const CUR_M = NOW.toISOString().slice(0, 7)
const PREV_M = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1).toISOString().slice(0, 7)

function fmtCur(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(d) {
  if (!d) return '—'
  const p = String(d).split('-')
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d
}
function isFin(o) {
  return !!(o.crcCliente && o.crcCliente !== '' && o.crcCliente !== '—')
}
function isPendReceb(o) {
  return isFin(o) && (!o.dataNossoCredito || o.dataNossoCredito === '' || o.dataNossoCredito === '—')
}
function isRecebido(o) {
  return isFin(o) && !!(o.dataNossoCredito && o.dataNossoCredito !== '' && o.dataNossoCredito !== '—')
}
function isEst(o) {
  return ['ESTORNADO', 'CANCELADO', 'CANCELADA', 'RECUSADA', 'REPROVADA', 'REPROVADO', 'NEGADO', 'NEGADA'].includes((o.situacao || '').toUpperCase())
}
function sitCol(s) {
  s = (s || '').toUpperCase()
  if (['FINALIZADO', 'PAGO', 'AVERBADO', 'APROVADO', 'CONCRETIZADO'].includes(s)) return C.accent2
  if (['ESTORNADO', 'CANCELADO', 'CANCELADA', 'RECUSADA', 'REPROVADA'].includes(s)) return C.danger
  if (['EM ANÁLISE', 'PENDENTE', 'ANALISE BANCO'].includes(s)) return C.warn
  return C.info
}
function nDate(v) {
  if (!v) return ''
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : ''
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return ''
}
function pNum(v) {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return v
  return parseFloat(String(v).replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

/* ── DIAS ÚTEIS ── */
function isBusinessDay(d) {
  const day = d.getDay()
  return day !== 0 && day !== 6
}
function countBusinessDays(start, end) {
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    if (isBusinessDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}
function getMonthProjection(ops) {
  const y = NOW.getFullYear(), m = NOW.getMonth()
  const firstDay = new Date(y, m, 1)
  const lastDay = new Date(y, m + 1, 0)
  const yesterday = new Date(NOW); yesterday.setDate(yesterday.getDate() - 1)
  
  const duTotal = countBusinessDays(firstDay, lastDay)
  const duPassados = countBusinessDays(firstDay, yesterday < firstDay ? firstDay : yesterday)
  const duRestantes = duTotal - duPassados
  
  const mesStr = NOW.toISOString().slice(0, 7)
  const opsMes = ops.filter((o) => o.data && o.data.startsWith(mesStr))
  const repMes = opsMes.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const digMes = opsMes.length
  
  const mediaDiaRep = duPassados > 0 ? repMes / duPassados : 0
  const mediaDiaDig = duPassados > 0 ? digMes / duPassados : 0
  const projecaoRep = mediaDiaRep * duTotal
  const projecaoDig = Math.round(mediaDiaDig * duTotal)
  
  const finMes = opsMes.filter(isFin)
  const repPago = finMes.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  
  return { duTotal, duPassados, duRestantes, repMes, digMes, mediaDiaRep, mediaDiaDig, projecaoRep, projecaoDig, repPago, finCount: finMes.length, mesStr }
}

/* ── DB MAPPING ── */
function fromDb(r) {
  return {
    id: r.id, id_ext: r.id_ext || '', banco: r.banco || '', cpf: r.cpf || '',
    cliente: r.cliente || '', proposta: r.proposta || '', contrato: r.contrato || '',
    data: r.data || '', prazo: r.prazo || '',
    vrBruto: Number(r.vr_bruto) || 0, vrParcela: Number(r.vr_parcela) || 0,
    vrLiquido: Number(r.vr_liquido) || 0, vrRepasse: Number(r.vr_repasse) || 0,
    vrSeguro: Number(r.vr_seguro) || 0, taxa: r.taxa || '',
    operacao: r.operacao || '', situacao: r.situacao || '', produto: r.produto || '',
    convenio: r.convenio || '', agente: r.agente || '',
    situacaoBanco: r.situacao_banco || '', obsSituacao: r.obs_situacao || '',
    usuario: r.usuario || '', crcCliente: r.crc_cliente || '',
    dataNossoCredito: r.data_nosso_credito || ''
  }
}
function toDb(o) {
  return {
    id_ext: o.id_ext || '', banco: o.banco || '', cpf: o.cpf || '',
    cliente: o.cliente || '', proposta: o.proposta || '', contrato: o.contrato || '',
    data: o.data || null, prazo: o.prazo || '',
    vr_bruto: o.vrBruto || 0, vr_parcela: o.vrParcela || 0,
    vr_liquido: o.vrLiquido || 0, vr_repasse: o.vrRepasse || 0,
    vr_seguro: o.vrSeguro || 0, taxa: o.taxa || '',
    operacao: o.operacao || '', situacao: o.situacao || '', produto: o.produto || '',
    convenio: o.convenio || '', agente: o.agente || '',
    situacao_banco: o.situacaoBanco || '', obs_situacao: o.obsSituacao || '',
    usuario: o.usuario || '', crc_cliente: o.crcCliente || null,
    data_nosso_credito: o.dataNossoCredito || null
  }
}

/* ── SMALL UI COMPONENTS ── */
function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 12, padding: '14px 16px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 9, color: C.muted, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Badge({ text, color }) {
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: color + '22', color: color, fontWeight: 600 }}>{text}</span>
}

function usePeriod() {
  const [per, setPer] = useState('tudo')
  const [customDf, setCustomDf] = useState('')
  const [customDt, setCustomDt] = useState('')
  const y = NOW.getFullYear(), mo = NOW.getMonth()
  const fmt = (d) => d.toISOString().split('T')[0]
  const pr = {
    mes: { f: fmt(new Date(y, mo, 1)), t: fmt(new Date(y, mo + 1, 0)), n: 'Mês Atual' },
    ant: { f: fmt(new Date(y, mo - 1, 1)), t: fmt(new Date(y, mo, 0)), n: 'Mês Anterior' },
    tri: { f: fmt(new Date(y, mo - 2, 1)), t: fmt(new Date(y, mo + 1, 0)), n: 'Trimestre' },
    sem: { f: fmt(new Date(y, mo - 5, 1)), t: fmt(new Date(y, mo + 1, 0)), n: 'Semestre' },
    ano: { f: y + '-01-01', t: y + '-12-31', n: String(y) },
    tudo: { f: '2000-01-01', t: '2099-12-31', n: 'Tudo' }
  }
  const df = per === 'custom' ? (customDf || '2000-01-01') : (pr[per] ? pr[per].f : '2000-01-01')
  const dt = per === 'custom' ? (customDt || '2099-12-31') : (pr[per] ? pr[per].t : '2099-12-31')
  return {
    per, setPer, df, dt, setDf: setCustomDf, setDt: setCustomDt, pr,
    filter: (ops) => ops.filter((o) => o.data && o.data >= df && o.data <= dt),
    label: per === 'custom' ? fmtDate(customDf) + ' a ' + fmtDate(customDt) : (pr[per] ? pr[per].n : '')
  }
}

function PeriodBar({ p }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.entries(p.pr).map(([k, v]) => (
          <button key={k} onClick={() => p.setPer(k)} style={{
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid ' + (p.per === k ? C.accent : C.border),
            background: p.per === k ? C.abg : 'transparent',
            color: p.per === k ? C.accent : C.muted,
            fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit,sans-serif'
          }}>{v.n}</button>
        ))}
        <button onClick={() => p.setPer('custom')} style={{
          padding: '4px 10px', borderRadius: 6,
          border: '1px solid ' + (p.per === 'custom' ? C.accent : C.border),
          background: p.per === 'custom' ? C.abg : 'transparent',
          color: p.per === 'custom' ? C.accent : C.muted,
          fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit,sans-serif'
        }}>Personalizado</button>
      </div>
      {p.per === 'custom' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>DE</label>
            <input type="date" value={p.df} onChange={(e) => p.setDf(e.target.value)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'Outfit,sans-serif' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>ATÉ</label>
            <input type="date" value={p.dt} onChange={(e) => p.setDt(e.target.value)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'Outfit,sans-serif' }} />
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: C.muted }}>Período: <strong style={{ color: C.text }}>{p.label}</strong></div>
    </div>
  )
}

/* ── IMPORT MODAL ── */
const IMP_FIELDS = {
  id_ext: { l: 'ID', a: ['id'] }, banco: { l: 'Banco', a: ['banco'] }, cpf: { l: 'CPF', a: ['cpf'] },
  cliente: { l: 'Cliente', a: ['cliente', 'nome'] }, proposta: { l: 'Proposta', a: ['proposta'] },
  contrato: { l: 'Contrato', a: ['contrato'] }, data: { l: 'Data', a: ['data', 'date'] },
  prazo: { l: 'Prazo', a: ['prazo'] }, vrBruto: { l: 'Bruto', a: ['vr. bruto', 'bruto'] },
  vrParcela: { l: 'Parcela', a: ['vr. parcela'] }, vrLiquido: { l: 'Líquido', a: ['vr. líquido', 'vr liquido'] },
  vrRepasse: { l: 'Repasse', a: ['vr. repasse', 'repasse'] }, vrSeguro: { l: 'Seguro', a: ['vr. seguro'] },
  taxa: { l: 'Taxa', a: ['taxa'] }, operacao: { l: 'Operação', a: ['operação', 'operacao'] },
  situacao: { l: 'Situação', a: ['situação', 'situacao', 'status'] },
  produto: { l: 'Produto', a: ['produto'] }, convenio: { l: 'Convênio', a: ['convênio', 'convenio'] },
  agente: { l: 'Agente', a: ['agente'] },
  situacaoBanco: { l: 'Sit.Banco', a: ['situação banco', 'sit. banco'] },
  obsSituacao: { l: 'Obs.', a: ['obs. situação'] }, usuario: { l: 'Usuário', a: ['usuário', 'usuario'] },
  crcCliente: { l: 'CRC', a: ['crc cliente', 'crc', 'data crc'] },
  dataNossoCredito: { l: 'N.Crédito', a: ['nosso crédito', 'nosso credito'] }
}

function ImportModal({ open, onClose, onImport }) {
  const fr = useRef(null)
  const [step, setStep] = useState(1)
  const [raw, setRaw] = useState([])
  const [hd, setHd] = useState([])
  const [mp, setMp] = useState({})
  const [pv, setPv] = useState([])
  const [fn, setFn] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) { setStep(1); setRaw([]); setHd([]); setMp({}); setPv([]); setFn(''); setBusy(false) }
  }, [open])

  if (!open) return null

  function handleFile(file) {
    setFn(file.name)
    const rd = new FileReader()
    rd.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
        if (!rows.length) return
        setRaw(rows)
        const cols = Object.keys(rows[0])
        setHd(cols)
        const m = {}
        Object.entries(IMP_FIELDS).forEach(([f, def]) => {
          const found = cols.find((c) => { const cl = c.toLowerCase(); return def.a.some((a) => cl === a || cl.includes(a)) })
          if (found) m[f] = found
        })
        setMp(m)
        setStep(2)
      } catch (ex) { alert('Erro: ' + ex.message) }
    }
    rd.readAsArrayBuffer(file)
  }

  function buildPreview() {
    const built = raw.map((row) => {
      const cl = mp.cliente ? String(row[mp.cliente] || '').trim() : ''
      const pr = mp.proposta ? String(row[mp.proposta] || '').trim() : ''
      const ok = !!(cl || pr)
      const g = (f) => mp[f] ? String(row[mp[f]] || '').trim() : ''
      const gu = (f) => g(f).toUpperCase()
      return {
        _v: ok, cliente: cl, proposta: pr, id_ext: g('id_ext'), banco: g('banco'),
        cpf: g('cpf'), contrato: g('contrato'), data: nDate(mp.data ? row[mp.data] : ''),
        prazo: g('prazo'), vrBruto: pNum(mp.vrBruto ? row[mp.vrBruto] : ''),
        vrParcela: pNum(mp.vrParcela ? row[mp.vrParcela] : ''),
        vrLiquido: pNum(mp.vrLiquido ? row[mp.vrLiquido] : ''),
        vrRepasse: pNum(mp.vrRepasse ? row[mp.vrRepasse] : ''),
        vrSeguro: pNum(mp.vrSeguro ? row[mp.vrSeguro] : ''),
        taxa: g('taxa'), operacao: gu('operacao'), situacao: gu('situacao'),
        produto: g('produto'), convenio: gu('convenio'), agente: g('agente'),
        situacaoBanco: gu('situacaoBanco'), obsSituacao: g('obsSituacao'),
        usuario: g('usuario'), crcCliente: nDate(mp.crcCliente ? row[mp.crcCliente] : ''),
        dataNossoCredito: nDate(mp.dataNossoCredito ? row[mp.dataNossoCredito] : '')
      }
    })
    setPv(built)
    setStep(3)
  }

  async function doImport() {
    setBusy(true)
    const valid = pv.filter((p) => p._v).map(({ _v, ...r }) => r)
    await onImport(valid)
    setBusy(false)
    onClose()
  }

  const vc = pv.filter((p) => p._v).length
  const tR = pv.filter((p) => p._v).reduce((s, o) => s + (o.vrRepasse || 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 18, width: 760, maxWidth: '97vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>Importar — Etapa {step}/3</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '16px 22px' }}>
          {step === 1 && (
            <div onClick={() => fr.current && fr.current.click()} style={{ border: '2px dashed ' + C.border, borderRadius: 14, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: C.surface }}>
              <div style={{ fontSize: 32 }}>📂</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Clique para selecionar</div>
              <input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]) }} style={{ display: 'none' }} />
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: C.muted }}>{fn} — {raw.length} linhas — {Object.keys(mp).length} detectados</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {Object.entries(IMP_FIELDS).map(([f, def]) => (
                  <div key={f}>
                    <label style={{ fontSize: 8, color: mp[f] ? C.accent : C.muted, fontWeight: 600 }}>{def.l}</label>
                    <select value={mp[f] || ''} onChange={(e) => setMp((prev) => ({ ...prev, [f]: e.target.value || undefined }))} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, color: C.text, padding: '4px', fontSize: 10, width: '100%' }}>
                      <option value="">—</option>
                      {hd.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, color: C.text, padding: '8px 16px', cursor: 'pointer' }}>←</button>
                <button onClick={buildPreview} style={{ flex: 1, background: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Revisar →</button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12 }}><strong style={{ color: C.accent2 }}>{vc}</strong> válidas — {fmtCur(tR)}</div>
              <div style={{ overflowX: 'auto', maxHeight: 260, borderRadius: 8, border: '1px solid ' + C.border }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead><tr style={{ background: C.surface }}>
                    {['', 'Cliente', 'Banco', 'Sit.', 'Agente', 'Repasse'].map((h) => <th key={h} style={{ padding: '5px 7px', textAlign: 'left', color: C.muted, fontSize: 8 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {pv.slice(0, 40).map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid ' + C.border, opacity: p._v ? 1 : 0.3 }}>
                        <td style={{ padding: '3px 7px', color: p._v ? C.accent2 : C.danger }}>{p._v ? '✓' : '✕'}</td>
                        <td style={{ padding: '3px 7px' }}>{p.cliente}</td>
                        <td style={{ padding: '3px 7px' }}>{p.banco}</td>
                        <td style={{ padding: '3px 7px' }}>{p.situacao}</td>
                        <td style={{ padding: '3px 7px' }}>{p.agente}</td>
                        <td style={{ padding: '3px 7px', fontWeight: 600 }}>{fmtCur(p.vrRepasse)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(2)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, color: C.text, padding: '8px 16px', cursor: 'pointer' }}>←</button>
                <button onClick={doImport} disabled={!vc || busy} style={{ flex: 1, background: C.accent2, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', opacity: (!vc || busy) ? 0.4 : 1 }}>{busy ? 'Gravando...' : '✓ Importar ' + vc}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── VIEWS ── */
function Dashboard({ ops }) {
  const p = usePeriod()
  const f = p.filter(ops)
  const tR = f.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const fin = f.filter(isFin)
  const fR = fin.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const pendR = f.filter(isPendReceb)
  const pendRR = pendR.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const receb = f.filter(isRecebido)
  const recebR = receb.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const est = f.filter(isEst)
  const ags = [...new Set(f.map((o) => o.agente).filter(Boolean))]
  const bySit = useMemo(() => {
    const m = {}; f.forEach((o) => { const k = o.situacao || '?'; m[k] = (m[k] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [f])
  const topP = useMemo(() => {
    const m = {}; f.forEach((o) => { const a = o.agente || '?'; if (!m[a]) m[a] = { r: 0, c: 0, fc: 0 }; m[a].r += (o.vrRepasse || 0); m[a].c++; if (isFin(o)) m[a].fc++ })
    return Object.entries(m).sort((a, b) => b[1].r - a[1].r).slice(0, 8)
  }, [f])
  const byOp = useMemo(() => {
    const m = {}; f.forEach((o) => { const k = o.operacao || '?'; if (!m[k]) m[k] = { r: 0, c: 0 }; m[k].r += (o.vrRepasse || 0); m[k].c++ })
    return Object.entries(m).sort((a, b) => b[1].r - a[1].r)
  }, [f])
  const monthly = useMemo(() => {
    const m = {}; f.forEach((o) => { const mo = o.data?.slice(0, 7); if (mo) { if (!m[mo]) m[mo] = { r: 0, c: 0 }; m[mo].r += (o.vrRepasse || 0); m[mo].c++ } })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
  }, [f])
  const mxM = Math.max(...monthly.map(([, v]) => v.r), 1)

  if (!ops.length) return <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: '36px 20px', textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📋</div><div style={{ fontSize: 13, fontWeight: 600 }}>Nenhuma digitação</div><div style={{ fontSize: 12, color: C.muted }}>Vá em Operações → Importar</div></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Dashboard</h2>
      <PeriodBar p={p} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Stat label="Produção" value={fmtCur(tR)} color={C.accent} />
        <Stat label="Pago (CRC)" value={fmtCur(fR)} color={C.accent2} sub={fin.length + ' ops'} />
        <Stat label="Pend. Receber" value={fmtCur(pendRR)} color={C.warn} sub={pendR.length + ' ops'} />
        <Stat label="Recebido" value={fmtCur(recebR)} color={C.info} sub={receb.length + ' ops'} />
        <Stat label="Estornos" value={est.length} sub={fmtCur(est.reduce((s, o) => s + (o.vrRepasse || 0), 0))} color={C.danger} />
        <Stat label="Digitações" value={f.length} />
        <Stat label="Parceiros" value={ags.length} />
      </div>

      {/* PROJEÇÃO MÊS ATUAL */}
      {(() => {
        const proj = getMonthProjection(ops)
        const pctDU = proj.duTotal ? (proj.duPassados / proj.duTotal * 100) : 0
        return (
          <div style={{ background: C.card, border: '1px solid ' + C.accent + '44', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>📅 Projeção Mês Atual</div>
              <div style={{ fontSize: 10, color: C.muted }}>
                {proj.duPassados}/{proj.duTotal} dias úteis ({pctDU.toFixed(0)}%) · Restam <strong style={{ color: C.accent }}>{proj.duRestantes}</strong> DU
              </div>
            </div>
            <div style={{ height: 6, background: C.surface, borderRadius: 4, marginBottom: 14 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,' + C.accent + ',' + C.accent2 + ')', borderRadius: 4, width: pctDU + '%', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Realizado</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{fmtCur(proj.repMes)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{proj.digMes} digitações</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Projeção Mês</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent2 }}>{fmtCur(proj.projecaoRep)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>~{proj.projecaoDig} digitações</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Média/DU</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmtCur(proj.mediaDiaRep)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{proj.mediaDiaDig.toFixed(1)} dig/dia</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Pago no Mês</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.accent2 }}>{fmtCur(proj.repPago)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{proj.finCount} ops finalizadas</div>
              </div>
            </div>
          </div>
        )
      })()}
      {monthly.length > 0 && (
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Produção Mensal</div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 100 }}>
            {monthly.map(([m, v]) => (
              <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 7, color: C.muted }}>{fmtCur(v.r)}</div>
                <div style={{ width: '100%', maxWidth: 36, background: 'linear-gradient(180deg,' + C.accent + ',' + C.accent2 + ')', borderRadius: 4, height: Math.max(4, (v.r / mxM) * 85) + '%' }} />
                <div style={{ fontSize: 7, color: C.muted }}>{m.slice(5)}/{m.slice(2, 4)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Situação</div>
          {bySit.slice(0, 8).map(([s, c]) => (
            <div key={s} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: sitCol(s), fontWeight: 600 }}>{s}</span>
                <span style={{ color: C.muted }}>{c}</span>
              </div>
              <div style={{ height: 4, background: C.surface, borderRadius: 2 }}>
                <div style={{ height: '100%', background: sitCol(s), borderRadius: 2, width: (c / (f.length || 1) * 100) + '%' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Top Parceiros</div>
          {topP.map(([ag, d], i) => (
            <div key={ag} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderBottom: '1px solid ' + C.border }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: i < 3 ? C.accent : C.muted, width: 16 }}>{i + 1}</span>
              <div style={{ flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag}</div>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.accent2 }}>{fmtCur(d.r)}</span>
            </div>
          ))}
        </div>
      </div>
      {byOp.length > 0 && (
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Por Operação</div>
          {byOp.map(([op, d]) => (
            <div key={op} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ fontWeight: 600 }}>{op}</span>
                <span style={{ color: C.accent }}>{fmtCur(d.r)} <span style={{ color: C.muted }}>({d.c})</span></span>
              </div>
              <div style={{ height: 5, background: C.surface, borderRadius: 2 }}>
                <div style={{ height: '100%', background: C.accent, borderRadius: 2, width: (d.r / (tR || 1) * 100) + '%' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Operacoes({ ops, onImport }) {
  const [io, sio] = useState(false)
  const [eo, seo] = useState(false)
  const [se, sse] = useState('')
  const [fs, sfs] = useState('')
  const [fb, sfb] = useState('')
  const aS = [...new Set(ops.map((o) => o.situacao).filter(Boolean))].sort()
  const aB = [...new Set(ops.map((o) => o.banco).filter(Boolean))].sort()
  const fd = ops.filter((o) => (!fs || o.situacao === fs) && (!fb || o.banco === fb)).filter((o) => {
    if (!se) return true
    const s = se.toLowerCase()
    return (o.cliente || '').toLowerCase().includes(s) || (o.agente || '').toLowerCase().includes(s) || (o.cpf || '').includes(s)
  }).sort((a, b) => (b.data || '').localeCompare(a.data || ''))

  function doExport() {
    const ws = XLSX.utils.json_to_sheet(fd.map((o) => ({
      Data: o.data, Banco: o.banco, CPF: o.cpf, Cliente: o.cliente, Proposta: o.proposta,
      'Operação': o.operacao, 'Situação': o.situacao, 'Convênio': o.convenio, Agente: o.agente,
      Repasse: o.vrRepasse, Bruto: o.vrBruto, 'Sit.Banco': o.situacaoBanco,
      CRC: o.crcCliente, 'Nosso Crédito': o.dataNossoCredito
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Digitações')
    XLSX.writeFile(wb, 'digitacoes_' + TODAY + '.xlsx')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontWeight: 800, fontSize: 20 }}>Operações</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => sio(true)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, color: C.text, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>📥 Importar</button>
          <button onClick={doExport} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, color: C.text, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>📤 Exportar</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input value={se} onChange={(e) => sse(e.target.value)} placeholder="Buscar..." style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '7px 12px', fontSize: 12, outline: 'none', flex: 1, minWidth: 160 }} />
        <select value={fs} onChange={(e) => sfs(e.target.value)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '7px 11px', fontSize: 12 }}>
          <option value="">— Situação —</option>
          {aS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fb} onChange={(e) => sfb(e.target.value)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '7px 11px', fontSize: 12 }}>
          <option value="">— Banco —</option>
          {aB.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 10, color: C.muted }}>{fd.length} registros — {fmtCur(fd.reduce((s, o) => s + (o.vrRepasse || 0), 0))}</div>
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid ' + C.border }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ background: C.surface }}>
            {['Data', 'Cliente', 'Banco', 'Op.', 'Situação', 'Agente', 'Repasse'].map((h) => (
              <th key={h} style={{ padding: '8px 9px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {fd.slice(0, 300).map((o) => (
              <tr key={o.id} style={{ borderBottom: '1px solid ' + C.border }}>
                <td style={{ padding: '7px 9px', whiteSpace: 'nowrap' }}>{fmtDate(o.data)}</td>
                <td style={{ padding: '7px 9px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.cliente || '—'}</td>
                <td style={{ padding: '7px 9px' }}>{o.banco}</td>
                <td style={{ padding: '7px 9px' }}>{o.operacao}</td>
                <td style={{ padding: '7px 9px' }}><Badge text={o.situacao || '—'} color={sitCol(o.situacao)} /></td>
                <td style={{ padding: '7px 9px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.agente}</td>
                <td style={{ padding: '7px 9px', fontWeight: 600 }}>{fmtCur(o.vrRepasse)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!fd.length && <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>Nenhuma digitação</div>}
      </div>
      <ImportModal open={io} onClose={() => sio(false)} onImport={onImport} />
    </div>
  )
}

function Producao({ ops }) {
  const p = usePeriod(); const f = p.filter(ops)
  const [tab, sTab] = useState('banco')
  const tR = f.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const data = useMemo(() => {
    const kFn = tab === 'banco' ? (o) => o.banco : tab === 'convenio' ? (o) => o.convenio : (o) => o.operacao
    const m = {}
    f.forEach((o) => { const k = kFn(o) || '?'; if (!m[k]) m[k] = { c: 0, r: 0, fc: 0, fr: 0 }; m[k].c++; m[k].r += (o.vrRepasse || 0); if (isFin(o)) { m[k].fc++; m[k].fr += (o.vrRepasse || 0) } })
    return Object.entries(m).sort((a, b) => b[1].r - a[1].r)
  }, [f, tab])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Produção</h2>
      <PeriodBar p={p} />
      <div style={{ display: 'flex', gap: 4 }}>
        {[{ id: 'banco', n: '🏦 Banco' }, { id: 'convenio', n: '📑 Convênio' }, { id: 'operacao', n: '⚡ Operação' }].map((t) => (
          <button key={t.id} onClick={() => sTab(t.id)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid ' + (tab === t.id ? C.accent : C.border), background: tab === t.id ? C.abg : 'transparent', color: tab === t.id ? C.accent : C.muted, fontSize: 11, cursor: 'pointer' }}>{t.n}</button>
        ))}
      </div>

      {/* PROJEÇÃO MENSAL */}
      {(() => {
        const proj = getMonthProjection(ops)
        const pctDU = proj.duTotal ? (proj.duPassados / proj.duTotal * 100) : 0
        const faltaRep = proj.projecaoRep - proj.repMes
        return (
          <div style={{ background: C.card, border: '1px solid ' + C.accent + '44', borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>📊 Posição do Mês + Projeção</div>
              <div style={{ fontSize: 10, color: C.muted }}>{proj.duPassados}/{proj.duTotal} DU · Restam <strong style={{ color: C.accent }}>{proj.duRestantes}</strong></div>
            </div>
            <div style={{ height: 8, background: C.surface, borderRadius: 4, marginBottom: 12, position: 'relative' }}>
              <div style={{ height: '100%', background: C.accent, borderRadius: 4, width: pctDU + '%' }} />
              <div style={{ position: 'absolute', top: -2, left: pctDU + '%', width: 2, height: 12, background: C.text, borderRadius: 1 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, marginBottom: 2 }}>REALIZADO</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>{fmtCur(proj.repMes)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{proj.digMes} dig</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, marginBottom: 2 }}>PROJEÇÃO</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.accent2 }}>{fmtCur(proj.projecaoRep)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>~{proj.projecaoDig} dig</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, marginBottom: 2 }}>FALTA</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.warn }}>{fmtCur(faltaRep > 0 ? faltaRep : 0)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>p/ atingir projeção</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, marginBottom: 2 }}>MÉDIA/DU</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{fmtCur(proj.mediaDiaRep)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{proj.mediaDiaDig.toFixed(1)} dig/dia</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, marginBottom: 2 }}>PAGO MÊS</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.accent2 }}>{fmtCur(proj.repPago)}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{proj.finCount} finalizadas</div>
              </div>
            </div>
          </div>
        )
      })()}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid ' + C.border }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ background: C.surface }}>
            {[tab === 'banco' ? 'Banco' : tab === 'convenio' ? 'Convênio' : 'Operação', 'Dig.', 'Repasse', 'Pago (CRC)', 'Conv.'].map((h) => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.map(([n, d]) => {
              const cv = d.c ? (d.fc / d.c * 100) : 0
              return (
                <tr key={n} style={{ borderBottom: '1px solid ' + C.border }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{n}</td>
                  <td style={{ padding: '8px 10px' }}>{d.c}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: C.accent }}>{fmtCur(d.r)}</td>
                  <td style={{ padding: '8px 10px', color: C.accent2, fontWeight: 600 }}>{fmtCur(d.fr)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: cv >= 50 ? C.accent2 : cv >= 30 ? C.warn : C.danger }}>{cv.toFixed(0)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Estrategico({ ops }) {
  const p = usePeriod(); const f = p.filter(ops)
  const [sel, sSel] = useState(null)
  const list = useMemo(() => {
    const ags = [...new Set(f.map((o) => o.agente).filter(Boolean))]
    return ags.map((a) => {
      const al = f.filter((o) => o.agente === a)
      const fn = al.filter(isFin); const est = al.filter(isEst)
      const r = al.reduce((s, o) => s + (o.vrRepasse || 0), 0)
      const cv = al.length ? (fn.length / al.length * 100) : 0
      const er = al.length ? (est.length / al.length * 100) : 0
      const bO = {}; al.forEach((o) => { const k = o.operacao || '?'; if (!bO[k]) bO[k] = { c: 0, r: 0 }; bO[k].c++; bO[k].r += (o.vrRepasse || 0) })
      const bB = {}; al.forEach((o) => { const k = o.banco || '?'; if (!bB[k]) bB[k] = { c: 0, r: 0 }; bB[k].c++; bB[k].r += (o.vrRepasse || 0) })
      const lo = [...ops.filter((o) => o.agente === a)].sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0]
      return { name: a, c: al.length, r, fC: fn.length, cv, estC: est.length, er, bO: Object.entries(bO).sort((a, b) => b[1].r - a[1].r), bB: Object.entries(bB).sort((a, b) => b[1].r - a[1].r), ld: lo?.data }
    }).sort((a, b) => b.r - a.r)
  }, [f, ops])
  const s = sel ? list.find((l) => l.name === sel) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Estratégico</h2>
      <PeriodBar p={p} />
      {!s ? (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid ' + C.border }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr style={{ background: C.surface }}>
              {['Parceiro', 'Dig.', 'Repasse', 'Conv.', 'Estornos', 'Última', ''].map((h) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.name} style={{ borderBottom: '1px solid ' + C.border, cursor: 'pointer' }} onClick={() => sSel(p.name)}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: '8px 10px' }}>{p.c}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: C.accent }}>{fmtCur(p.r)}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: p.cv >= 50 ? C.accent2 : p.cv >= 30 ? C.warn : C.danger }}>{p.cv.toFixed(0)}%</td>
                  <td style={{ padding: '8px 10px', color: p.estC ? C.danger : C.muted }}>{p.estC} ({p.er.toFixed(0)}%)</td>
                  <td style={{ padding: '8px 10px' }}>{p.ld ? fmtDate(p.ld) : '—'}</td>
                  <td style={{ color: C.accent }}>→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => sSel(null)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, color: C.accent, padding: '5px 10px', cursor: 'pointer', fontSize: 11, alignSelf: 'flex-start' }}>← Voltar</button>
          <h3 style={{ fontWeight: 700, fontSize: 17 }}>{s.name}</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Stat label="Digitações" value={s.c} /><Stat label="Repasse" value={fmtCur(s.r)} color={C.accent} />
            <Stat label="Conv." value={s.cv.toFixed(0) + '%'} color={s.cv >= 50 ? C.accent2 : s.cv >= 30 ? C.warn : C.danger} />
            <Stat label="Estornos" value={s.estC} sub={s.er.toFixed(0) + '%'} color={s.estC ? C.danger : C.muted} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Operações</div>
              {s.bO.map(([op, d]) => <div key={op} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0' }}><span style={{ fontWeight: 600 }}>{op} ({d.c})</span><span style={{ color: C.accent }}>{fmtCur(d.r)}</span></div>)}
            </div>
            <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Bancos</div>
              {s.bB.map(([b, d]) => <div key={b} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0' }}><span style={{ fontWeight: 600 }}>{b} ({d.c})</span><span style={{ color: C.accent }}>{fmtCur(d.r)}</span></div>)}
            </div>
          </div>
          <div style={{ background: C.card, border: '1px solid ' + C.accent + '33', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 8 }}>📌 Pontos para Conversa</div>
            <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {s.cv < 30 && s.c > 0 && <div style={{ color: C.danger }}>⚠ Conversão baixa ({s.cv.toFixed(0)}%)</div>}
              {s.cv >= 50 && s.c > 0 && <div style={{ color: C.accent2 }}>✓ Boa conversão — manter</div>}
              {s.er > 20 && <div style={{ color: C.danger }}>⚠ {s.estC} estornos ({s.er.toFixed(0)}%) — URGENTE</div>}
              {s.bO[0] && <div>Principal op: <strong>{s.bO[0][0]}</strong></div>}
              {s.bB[0] && <div>Principal banco: <strong>{s.bB[0][0]}</strong></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Ranking({ ops }) {
  const p = usePeriod(); const f = p.filter(ops)
  const data = useMemo(() => {
    const ags = [...new Set(f.map((o) => o.agente).filter(Boolean))]
    return ags.map((a) => {
      const al = f.filter((o) => o.agente === a)
      const fn = al.filter(isFin); const est = al.filter(isEst)
      const r = al.reduce((s, o) => s + (o.vrRepasse || 0), 0)
      const cv = al.length ? (fn.length / al.length * 100) : 0
      const cu = ops.filter((o) => o.agente === a && o.data && o.data.startsWith(CUR_M))
      const pv = ops.filter((o) => o.agente === a && o.data && o.data.startsWith(PREV_M))
      const cuR = cu.reduce((s, o) => s + (o.vrRepasse || 0), 0)
      const pvR = pv.reduce((s, o) => s + (o.vrRepasse || 0), 0)
      const trend = pvR ? ((cuR - pvR) / pvR * 100) : (cuR > 0 ? 100 : 0)
      return { name: a, c: al.length, r, cv, estC: est.length, cuC: cu.length, cuR, trend }
    }).sort((a, b) => b.r - a.r)
  }, [f, ops])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Ranking</h2>
      <PeriodBar p={p} />
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid ' + C.border }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead><tr style={{ background: C.surface }}>
            {['#', 'Parceiro', 'Dig.', 'Repasse', 'Conv.', 'Estornos', 'Mês', 'Tendência'].map((h) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.name} style={{ borderBottom: '1px solid ' + C.border }}>
                <td style={{ padding: '8px 10px' }}><span style={{ display: 'inline-flex', width: 22, height: 22, borderRadius: 6, background: i < 3 ? C.accent : C.surface, alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: i < 3 ? '#fff' : C.muted }}>{i + 1}</span></td>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{d.name}</td>
                <td style={{ padding: '8px 10px' }}>{d.c}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: C.accent }}>{fmtCur(d.r)}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: d.cv >= 50 ? C.accent2 : d.cv >= 30 ? C.warn : C.danger }}>{d.cv.toFixed(0)}%</td>
                <td style={{ padding: '8px 10px', color: d.estC ? C.danger : C.muted }}>{d.estC || '0'}</td>
                <td style={{ padding: '8px 10px' }}>{d.cuC} · {fmtCur(d.cuR)}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: d.trend > 0 ? C.accent2 : d.trend < -20 ? C.danger : C.warn }}>{d.trend > 0 ? '+' : ''}{d.trend.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Recebimentos({ ops }) {
  const p = usePeriod(); const f = p.filter(ops)
  const [fB, sFB] = useState('')
  const [fA, sFA] = useState('')
  const pend = useMemo(() => f.filter(isPendReceb), [f])
  const rec = useMemo(() => f.filter(isRecebido), [f])
  const totalPago = useMemo(() => f.filter(isFin), [f])
  const pR = pend.reduce((s, o) => s + (o.vrRepasse || 0), 0)
  const recR = rec.reduce((s, o) => s + (o.vrRepasse || 0), 0)

  const byBanco = useMemo(() => {
    const m = {}
    pend.forEach((o) => {
      const b = o.banco || '?'
      if (!m[b]) m[b] = { c: 0, r: 0, ds: [] }
      m[b].c++; m[b].r += (o.vrRepasse || 0)
      if (o.crcCliente) m[b].ds.push(Math.floor((NOW - new Date(o.crcCliente)) / 86400000))
    })
    return Object.entries(m).map(([b, d]) => ({
      b, ...d, md: d.ds.length ? Math.round(d.ds.reduce((a, b) => a + b, 0) / d.ds.length) : 0,
      mx: d.ds.length ? Math.max(...d.ds) : 0
    })).sort((a, b) => b.r - a.r)
  }, [pend])

  const byAgente = useMemo(() => {
    const m = {}
    pend.forEach((o) => {
      const a = o.agente || '?'
      if (!m[a]) m[a] = { c: 0, r: 0, ds: [] }
      m[a].c++; m[a].r += (o.vrRepasse || 0)
      if (o.crcCliente) m[a].ds.push(Math.floor((NOW - new Date(o.crcCliente)) / 86400000))
    })
    return Object.entries(m).map(([a, d]) => ({
      a, ...d[1] ? d : d, nm: a, cnt: d.c, rep: d.r,
      md: d.ds.length ? Math.round(d.ds.reduce((x, y) => x + y, 0) / d.ds.length) : 0
    })).sort((a, b) => b.rep - a.rep)
  }, [pend])

  const byOp = useMemo(() => {
    const m = {}
    pend.forEach((o) => {
      const k = o.operacao || '?'
      if (!m[k]) m[k] = { c: 0, r: 0 }
      m[k].c++; m[k].r += (o.vrRepasse || 0)
    })
    return Object.entries(m).sort((a, b) => b[1].r - a[1].r)
  }, [pend])

  const byMes = useMemo(() => {
    const m = {}
    pend.forEach((o) => {
      const mes = o.crcCliente ? o.crcCliente.slice(0, 7) : o.data ? o.data.slice(0, 7) : null
      if (!mes) return
      if (!m[mes]) m[mes] = { c: 0, r: 0 }
      m[mes].c++; m[mes].r += (o.vrRepasse || 0)
    })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]))
  }, [pend])

  const aging = useMemo(() => {
    const fx = { '0-15d': 0, '16-30d': 0, '31-60d': 0, '61-90d': 0, '90+d': 0 }
    const fR = { '0-15d': 0, '16-30d': 0, '31-60d': 0, '61-90d': 0, '90+d': 0 }
    pend.forEach((o) => {
      if (!o.crcCliente) return
      const d = Math.floor((NOW - new Date(o.crcCliente)) / 86400000)
      const k = d <= 15 ? '0-15d' : d <= 30 ? '16-30d' : d <= 60 ? '31-60d' : d <= 90 ? '61-90d' : '90+d'
      fx[k]++; fR[k] += (o.vrRepasse || 0)
    })
    return Object.entries(fx).map(([f, c]) => ({ f, c, r: fR[f] }))
  }, [pend])

  const filt = pend.filter((o) => (!fB || o.banco === fB) && (!fA || o.agente === fA))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Recebimentos Pendentes</h2>
      <PeriodBar p={p} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Stat label="Total Pago (CRC)" value={totalPago.length} sub={fmtCur(totalPago.reduce((s, o) => s + (o.vrRepasse || 0), 0))} color={C.accent2} />
        <Stat label="Pendente Receber" value={pend.length} sub={fmtCur(pR)} color={C.danger} />
        <Stat label="Já Recebido" value={rec.length} sub={fmtCur(recR)} color={C.info} />
        <Stat label="% Pendente" value={totalPago.length ? (pend.length / totalPago.length * 100).toFixed(0) + '%' : '0%'} color={C.warn} />
      </div>

      {!pend.length ? (
        <div style={{ background: C.card, borderRadius: 14, padding: 28, textAlign: 'center', color: C.muted }}>
          Nenhuma pendência — mapeie CRC CLIENTE e NOSSO CRÉDITO na importação
        </div>
      ) : (
        <>
          {/* AGING */}
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Aging — Tempo sem receber</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {aging.map((a) => {
                const col = a.f.includes('90') || a.f.includes('61') ? C.danger : a.f.includes('31') ? C.warn : C.info
                const pct = pend.length ? (a.c / pend.length * 100) : 0
                return a.c > 0 ? (
                  <div key={a.f} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 10, padding: '10px 16px', minWidth: 100 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: col }}>{a.c}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: col }}>{a.f}</div>
                    <div style={{ fontSize: 9, color: C.muted }}>{fmtCur(a.r)}</div>
                    <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: '100%', background: col, borderRadius: 2, width: pct + '%' }} />
                    </div>
                  </div>
                ) : null
              })}
            </div>
          </div>

          {/* EVOLUÇÃO MENSAL */}
          {byMes.length > 1 && (
            <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Pendências por Mês (CRC Cliente)</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
                {(() => {
                  const mx = Math.max(...byMes.map(([, v]) => v.r), 1)
                  return byMes.map(([m, v]) => (
                    <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ fontSize: 7, color: C.muted }}>{v.c}</div>
                      <div style={{ width: '100%', maxWidth: 30, background: C.danger, borderRadius: 3, height: Math.max(4, (v.r / mx) * 65) + '%', opacity: 0.8 }} />
                      <div style={{ fontSize: 7, color: C.muted }}>{m.slice(5)}/{m.slice(2, 4)}</div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* POR BANCO */}
            <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Por Banco</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: C.surface }}>
                  {['Banco', 'Qtd', 'Pendente', 'Média', 'Máx'].map((h) => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {byBanco.map((b) => (
                    <tr key={b.b} style={{ borderBottom: '1px solid ' + C.border }}>
                      <td style={{ padding: '7px 9px', fontWeight: 700 }}>{b.b}</td>
                      <td style={{ padding: '7px 9px' }}>{b.c}</td>
                      <td style={{ padding: '7px 9px', fontWeight: 600, color: C.danger }}>{fmtCur(b.r)}</td>
                      <td style={{ padding: '7px 9px', color: b.md > 60 ? C.danger : b.md > 30 ? C.warn : C.text }}>{b.md}d</td>
                      <td style={{ padding: '7px 9px', color: b.mx > 90 ? C.danger : C.warn, fontWeight: 600 }}>{b.mx}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* POR OPERAÇÃO */}
            <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Por Operação</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead><tr style={{ background: C.surface }}>
                  {['Operação', 'Qtd', 'Pendente'].map((h) => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {byOp.map(([op, d]) => (
                    <tr key={op} style={{ borderBottom: '1px solid ' + C.border }}>
                      <td style={{ padding: '7px 9px', fontWeight: 600 }}>{op}</td>
                      <td style={{ padding: '7px 9px' }}>{d.c}</td>
                      <td style={{ padding: '7px 9px', fontWeight: 600, color: C.danger }}>{fmtCur(d.r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* POR PARCEIRO */}
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Por Parceiro</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ background: C.surface }}>
                {['Parceiro', 'Qtd', 'Pendente', 'Média Dias'].map((h) => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {byAgente.map((a) => (
                  <tr key={a.nm} style={{ borderBottom: '1px solid ' + C.border }}>
                    <td style={{ padding: '7px 9px', fontWeight: 600 }}>{a.nm}</td>
                    <td style={{ padding: '7px 9px' }}>{a.cnt}</td>
                    <td style={{ padding: '7px 9px', fontWeight: 600, color: C.danger }}>{fmtCur(a.rep)}</td>
                    <td style={{ padding: '7px 9px', color: a.md > 60 ? C.danger : a.md > 30 ? C.warn : C.text }}>{a.md}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ANALÍTICO */}
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Analítico</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={fB} onChange={(e) => sFB(e.target.value)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, color: C.text, padding: '4px 8px', fontSize: 10 }}>
                  <option value="">— Banco —</option>
                  {[...new Set(pend.map((o) => o.banco).filter(Boolean))].sort().map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={fA} onChange={(e) => sFA(e.target.value)} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, color: C.text, padding: '4px 8px', fontSize: 10 }}>
                  <option value="">— Parceiro —</option>
                  {[...new Set(pend.map((o) => o.agente).filter(Boolean))].sort().map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {(fB || fA) && <button onClick={() => { sFB(''); sFA('') }} style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 6, color: C.muted, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }}>Limpar</button>}
              </div>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>{filt.length} pendências — {fmtCur(filt.reduce((s, o) => s + (o.vrRepasse || 0), 0))}</div>
            <div style={{ overflowX: 'auto', maxHeight: 400, borderRadius: 8, border: '1px solid ' + C.border }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead><tr style={{ background: C.surface, position: 'sticky', top: 0 }}>
                  {['Cliente', 'CPF', 'Banco', 'Op.', 'Agente', 'Repasse', 'CRC Cliente', 'Dias'].map((h) => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filt.slice(0, 300).map((o) => {
                    const dias = o.crcCliente ? Math.floor((NOW - new Date(o.crcCliente)) / 86400000) : 0
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid ' + C.border }}>
                        <td style={{ padding: '5px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.cliente}</td>
                        <td style={{ padding: '5px 8px' }}>{o.cpf}</td>
                        <td style={{ padding: '5px 8px' }}>{o.banco}</td>
                        <td style={{ padding: '5px 8px' }}>{o.operacao}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.agente}</td>
                        <td style={{ padding: '5px 8px', fontWeight: 600, color: C.danger }}>{fmtCur(o.vrRepasse)}</td>
                        <td style={{ padding: '5px 8px' }}>{fmtDate(o.crcCliente)}</td>
                        <td style={{ padding: '5px 8px', fontWeight: 600, color: dias > 90 ? C.danger : dias > 30 ? C.warn : C.text }}>{dias}d</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Portabilidade({ ops }) {
  const p = usePeriod(); const f = p.filter(ops)
  const port = useMemo(() => f.filter((o) => (o.operacao || '').toUpperCase() === 'PORTABILIDADE'), [f])
  const tD = port.length
  const tP = port.filter(isFin).length
  const cv = tD ? (tP / tD * 100) : 0

  const byBanco = useMemo(() => {
    const m = {}
    port.forEach((o) => { const b = o.banco || '?'; if (!m[b]) m[b] = { d: 0, p: 0, rd: 0, rp: 0 }; m[b].d++; m[b].rd += (o.vrRepasse || 0); if (isFin(o)) { m[b].p++; m[b].rp += (o.vrRepasse || 0) } })
    return Object.entries(m).sort((a, b) => b[1].d - a[1].d)
  }, [port])

  const byAgente = useMemo(() => {
    const m = {}
    port.forEach((o) => { const a = o.agente || '?'; if (!m[a]) m[a] = { d: 0, p: 0, rd: 0, rp: 0 }; m[a].d++; m[a].rd += (o.vrRepasse || 0); if (isFin(o)) { m[a].p++; m[a].rp += (o.vrRepasse || 0) } })
    return Object.entries(m).sort((a, b) => b[1].d - a[1].d)
  }, [port])

  function PortTable({ data, nameLabel }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead><tr style={{ background: C.surface }}>
          {[nameLabel, 'Dig.', 'Pago', 'Conv.', 'Rep.Dig.', 'Rep.Pago'].map((h) => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: C.muted, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {data.map(([n, x]) => {
            const r = x.d ? (x.p / x.d * 100) : 0
            return (
              <tr key={n} style={{ borderBottom: '1px solid ' + C.border }}>
                <td style={{ padding: '7px 9px', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</td>
                <td style={{ padding: '7px 9px' }}>{x.d}</td>
                <td style={{ padding: '7px 9px', color: C.accent2, fontWeight: 600 }}>{x.p}</td>
                <td style={{ padding: '7px 9px', fontWeight: 600, color: r >= 50 ? C.accent2 : r >= 30 ? C.warn : C.danger }}>{r.toFixed(0)}%</td>
                <td style={{ padding: '7px 9px' }}>{fmtCur(x.rd)}</td>
                <td style={{ padding: '7px 9px', fontWeight: 600, color: C.accent2 }}>{fmtCur(x.rp)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Portabilidade</h2>
      <PeriodBar p={p} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Stat label="Digitado" value={tD} sub={fmtCur(port.reduce((s, o) => s + (o.vrRepasse || 0), 0))} />
        <Stat label="Pago" value={tP} sub={fmtCur(port.filter(isFin).reduce((s, o) => s + (o.vrRepasse || 0), 0))} color={C.accent2} />
        <Stat label="Conv." value={cv.toFixed(1) + '%'} color={cv >= 50 ? C.accent2 : cv >= 30 ? C.warn : C.danger} />
      </div>
      {!port.length ? (
        <div style={{ background: C.card, borderRadius: 14, padding: 24, textAlign: 'center', color: C.muted }}>Nenhuma PORTABILIDADE no período</div>
      ) : (
        <>
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Por Banco</div>
            <PortTable data={byBanco} nameLabel="Banco" />
          </div>
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Por Parceiro</div>
            <PortTable data={byAgente} nameLabel="Parceiro" />
          </div>
        </>
      )}
    </div>
  )
}

function Estornos({ ops }) {
  const p = usePeriod(); const f = p.filter(ops)
  const est = useMemo(() => f.filter(isEst), [f])
  const byBanco = useMemo(() => {
    const m = {}; est.forEach((o) => { const b = o.banco || '?'; if (!m[b]) m[b] = { c: 0, r: 0 }; m[b].c++; m[b].r += (o.vrRepasse || 0) })
    return Object.entries(m).sort((a, b) => b[1].c - a[1].c)
  }, [est])
  const byAg = useMemo(() => {
    const m = {}; est.forEach((o) => { const a = o.agente || '?'; if (!m[a]) m[a] = { c: 0, r: 0, t: 0 }; m[a].c++; m[a].r += (o.vrRepasse || 0) })
    f.forEach((o) => { const a = o.agente || '?'; if (m[a]) m[a].t++ })
    return Object.entries(m).map(([a, d]) => ({ a, ...d, pct: d.t ? (d.c / d.t * 100) : 0 })).sort((a, b) => b.pct - a.pct)
  }, [est, f])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Estornos</h2>
      <PeriodBar p={p} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Stat label="Estornos" value={est.length} color={C.danger} />
        <Stat label="Perda" value={fmtCur(est.reduce((s, o) => s + (o.vrRepasse || 0), 0))} color={C.danger} />
      </div>
      {est.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Por Banco</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ background: C.surface }}>
                {['Banco', 'Qtd', 'Perda'].map((h) => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: C.muted, fontSize: 8 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {byBanco.map(([b, d]) => <tr key={b} style={{ borderBottom: '1px solid ' + C.border }}><td style={{ padding: '7px 9px', fontWeight: 600 }}>{b}</td><td style={{ padding: '7px 9px', color: C.danger }}>{d.c}</td><td style={{ padding: '7px 9px', color: C.danger }}>{fmtCur(d.r)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: C.danger }}>Top Estornadores</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr style={{ background: C.surface }}>
                {['Parceiro', 'Est.', '%', 'Perda'].map((h) => <th key={h} style={{ padding: '7px 9px', textAlign: 'left', color: C.muted, fontSize: 8 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {byAg.slice(0, 15).map((a) => <tr key={a.a} style={{ borderBottom: '1px solid ' + C.border }}><td style={{ padding: '7px 9px', fontWeight: 600 }}>{a.a}</td><td style={{ padding: '7px 9px', color: C.danger }}>{a.c}</td><td style={{ padding: '7px 9px', fontWeight: 600, color: a.pct > 20 ? C.danger : a.pct > 10 ? C.warn : C.text }}>{a.pct.toFixed(0)}%</td><td style={{ padding: '7px 9px', color: C.danger }}>{fmtCur(a.r)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Alertas({ ops }) {
  const ags = [...new Set(ops.map((o) => o.agente).filter(Boolean))]
  const st = useMemo(() => ags.map((a) => {
    const cu = ops.filter((o) => o.agente === a && o.data && o.data.startsWith(CUR_M))
    const pv = ops.filter((o) => o.agente === a && o.data && o.data.startsWith(PREV_M))
    const cR = cu.reduce((s, o) => s + (o.vrRepasse || 0), 0)
    const pR = pv.reduce((s, o) => s + (o.vrRepasse || 0), 0)
    const vr = pR ? ((cR - pR) / pR * 100) : (cR > 0 ? 100 : 0)
    const lo = [...ops.filter((o) => o.agente === a)].sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0]
    const ds = lo ? Math.floor((NOW - new Date(lo.data)) / 86400000) : 999
    let flag = 'ok'
    if (cu.length === 0 && pv.length > 0) flag = 'parado'
    else if (vr <= -30) flag = 'queda'
    return { nm: a, cc: cu.length, pc: pv.length, cR, vr, ds, ld: lo?.data, flag }
  }).sort((a, b) => {
    const o = { parado: 0, queda: 1, ok: 2 }
    return (o[a.flag] ?? 3) - (o[b.flag] ?? 3)
  }), [ags, ops])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontWeight: 800, fontSize: 20 }}>Alertas</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Stat label="Parados" value={st.filter((s) => s.flag === 'parado').length} color={C.danger} />
        <Stat label="Em Queda" value={st.filter((s) => s.flag === 'queda').length} color={C.warn} />
      </div>
      {st.filter((s) => s.flag !== 'ok').length > 0 && (
        <div style={{ background: '#EF444418', border: '1px solid #EF444433', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 6 }}>⚠ Ação necessária</div>
          {st.filter((s) => s.flag !== 'ok').map((s) => (
            <div key={s.nm} style={{ fontSize: 11, padding: '3px 0' }}>
              {s.flag === 'parado' ? '🔴' : '🟡'} <strong>{s.nm}</strong> — {s.flag === 'parado' ? 'Parado (última: ' + (s.ld ? fmtDate(s.ld) : 'nunca') + ')' : 'Queda ' + Math.abs(s.vr).toFixed(0) + '%'}
            </div>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid ' + C.border }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead><tr style={{ background: C.surface }}>
            {['', 'Parceiro', 'Mês', 'Ant.', 'Var.', 'Última', 'Dias'].map((h) => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', color: C.muted, fontSize: 8 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {st.map((s) => (
              <tr key={s.nm} style={{ borderBottom: '1px solid ' + C.border }}>
                <td style={{ padding: '7px 8px' }}>{s.flag === 'parado' ? '🔴' : s.flag === 'queda' ? '🟡' : '↗'}</td>
                <td style={{ padding: '7px 8px', fontWeight: 600 }}>{s.nm}</td>
                <td style={{ padding: '7px 8px' }}>{s.cc}</td>
                <td style={{ padding: '7px 8px' }}>{s.pc}</td>
                <td style={{ padding: '7px 8px', fontWeight: 600, color: s.vr > 0 ? C.accent2 : s.vr < -30 ? C.danger : C.warn }}>{s.vr > 0 ? '+' : ''}{s.vr.toFixed(0)}%</td>
                <td style={{ padding: '7px 8px' }}>{s.ld ? fmtDate(s.ld) : '—'}</td>
                <td style={{ padding: '7px 8px', color: s.ds > 30 ? C.danger : C.text }}>{s.ds < 999 ? s.ds + 'd' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── NAV ── */
const NAV = [
  { id: 'dashboard', l: 'Dashboard', i: '📊' },
  { id: 'ops', l: 'Operações', i: '💼' },
  { id: 'producao', l: 'Produção', i: '🏦' },
  { id: 'estrategico', l: 'Estratégico', i: '🤝' },
  { id: 'ranking', l: 'Ranking', i: '🏆' },
  { id: 'portabilidade', l: 'Portabilidade', i: '🔄' },
  { id: 'recebimentos', l: 'Recebimentos', i: '💰' },
  { id: 'estornos', l: 'Estornos', i: '⚠' },
  { id: 'alertas', l: 'Alertas', i: '📈' },
]

/* ── MAIN APP ── */
export default function App() {
  const [user, setUser] = useState(null)
  const [ops, setOps] = useState([])
  const [view, setView] = useState('dashboard')
  const [status, setStatus] = useState('')

  // Load data after login
  useEffect(() => {
    if (!user) return
    setStatus('loading')
    supabase.from('digitacoes').select('*').order('data', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOps(data.map(fromDb))
        setStatus(error ? 'error' : '')
      })
      .catch(() => setStatus('error'))
  }, [user])

  async function handleImport(rows) {
    setStatus('saving')
    try {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('digitacoes').insert(rows.slice(i, i + 500).map(toDb))
        if (error) throw error
      }
      const { data } = await supabase.from('digitacoes').select('*').order('data', { ascending: false })
      if (data) setOps(data.map(fromDb))
      setStatus('')
    } catch (e) { console.error(e); setStatus('error') }
  }

  /* ── LOGIN SCREEN ── */
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: 'Outfit,sans-serif', color: C.text }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.target)
            const nome = formData.get('nome')
            if (nome && nome.length >= 2) {
              setUser({ name: nome, role: 'Gestor' })
            }
          }}
          style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 20, padding: '40px 36px', width: 370 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,' + C.accent + ',' + C.accent2 + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>O</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>OpsManager</h1>
          </div>
          <p style={{ color: C.muted, fontSize: 12, marginBottom: 28 }}>Gestão de Digitações</p>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 9, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>USUÁRIO</label>
            <input name="nome" required minLength={2} placeholder="Seu nome" autoComplete="off" style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '10px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Outfit,sans-serif' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 9, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>SENHA</label>
            <input name="senha" type="password" required minLength={2} placeholder="Sua senha" style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 7, color: C.text, padding: '10px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'Outfit,sans-serif' }} />
          </div>
          <button type="submit" style={{ width: '100%', padding: '12px 0', fontSize: 14, borderRadius: 10, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>Entrar</button>
        </form>
      </div>
    )
  }

  /* ── MAIN LAYOUT ── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Outfit,sans-serif', color: C.text, background: C.bg }}>
      <div style={{ width: 195, background: C.card, borderRight: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,' + C.accent + ',' + C.accent2 + ')', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>O</div>
            <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>OpsManager</h1>
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 2, marginLeft: 33 }}>
            {ops.length} digitações
            {status === 'loading' ? ' · ⏳' : status === 'saving' ? ' · 💾' : status === 'error' ? ' · ⚠' : ''}
          </div>
          <div style={{ fontSize: 8, color: C.accent2, marginTop: 2, marginLeft: 33 }}>● Supabase</div>
        </div>
        <nav style={{ flex: 1, padding: '2px 7px', overflowY: 'auto' }}>
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 9px', marginBottom: 1,
              borderRadius: 7, border: 'none', background: view === n.id ? C.abg : 'transparent',
              color: view === n.id ? C.accent : C.muted, fontFamily: 'Outfit,sans-serif', fontSize: 11,
              fontWeight: view === n.id ? 600 : 400, cursor: 'pointer', textAlign: 'left'
            }}>
              <span style={{ fontSize: 13 }}>{n.i}</span>{n.l}
            </button>
          ))}
        </nav>
        <div style={{ padding: '10px 14px', borderTop: '1px solid ' + C.border }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{user.name}</div>
          <button onClick={() => setUser(null)} style={{ fontSize: 9, color: C.danger, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}>Sair →</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
        {view === 'dashboard' && <Dashboard ops={ops} />}
        {view === 'ops' && <Operacoes ops={ops} onImport={handleImport} />}
        {view === 'producao' && <Producao ops={ops} />}
        {view === 'estrategico' && <Estrategico ops={ops} />}
        {view === 'ranking' && <Ranking ops={ops} />}
        {view === 'portabilidade' && <Portabilidade ops={ops} />}
        {view === 'recebimentos' && <Recebimentos ops={ops} />}
        {view === 'estornos' && <Estornos ops={ops} />}
        {view === 'alertas' && <Alertas ops={ops} />}
      </div>
    </div>
  )
}
