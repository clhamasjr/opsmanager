import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE
   ═══════════════════════════════════════════════════════════════════════════ */
const KEYS = { ops: "ops-data-v2", partners: "partners-data-v2", proposals: "proposals-data-v2" };
async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch (e) { console.error("save err", e); }
}
const uid = () => "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
const TODAY = new Date().toISOString().split("T")[0];
const fmtCur = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const fmtDate = d => { if (!d) return "—"; const p = d.split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

/* ═══════════════════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg: "#0B0F1A", surface: "#111827", card: "#151C2C", border: "#1E293B",
  text: "#E8ECF4", muted: "#64748B", accent: "#6366F1", accent2: "#22C55E",
  warn: "#F59E0B", danger: "#EF4444", info: "#38BDF8",
};

/* ═══════════════════════════════════════════════════════════════════════════
   SEED DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const SEED_PARTNERS = [
  { id: "p1", name: "TechVentures SP", segment: "Tecnologia", region: "Sudeste", status: "Ativo" },
  { id: "p2", name: "AgriNorte Ltda", segment: "Agronegócio", region: "Norte", status: "Ativo" },
  { id: "p3", name: "FinGroup Brasil", segment: "Financeiro", region: "Sul", status: "Ativo" },
  { id: "p4", name: "RetailMax", segment: "Varejo", region: "Nordeste", status: "Ativo" },
  { id: "p5", name: "Construtech CE", segment: "Construção", region: "Nordeste", status: "Inativo" },
];
const SEED_OPS = [
  { id: "o1", date: "2026-01-10", partner: "p1", type: "Venda", value: 48000, status: "Concluída", banco: "BMG", operacao: "NOVO", convenio: "INSS", agente: "Ana Lima", situacaoBanco: "FINALIZADO", notes: "" },
  { id: "o2", date: "2026-01-22", partner: "p2", type: "Contrato", value: 120000, status: "Em andamento", banco: "PAN", operacao: "PORTABILIDADE", convenio: "SIAPE", agente: "Carlos Rocha", situacaoBanco: "PENDENTE", notes: "" },
  { id: "o3", date: "2026-02-05", partner: "p3", type: "Venda", value: 75000, status: "Concluída", banco: "C6", operacao: "NOVO", convenio: "INSS", agente: "Bruno Moraes", situacaoBanco: "FINALIZADO", notes: "" },
  { id: "o4", date: "2026-02-18", partner: "p1", type: "Renovação", value: 36000, status: "Concluída", banco: "BMG", operacao: "REFINANCIAMENTO", convenio: "INSS", agente: "Ana Lima", situacaoBanco: "FINALIZADO", notes: "" },
  { id: "o5", date: "2026-03-01", partner: "p4", type: "Venda", value: 22000, status: "Cancelada", banco: "SAFRA", operacao: "NOVO", convenio: "PREFEITURA", agente: "Marcos Silva", situacaoBanco: "ESTORNADO", notes: "" },
  { id: "o6", date: "2026-03-05", partner: "p2", type: "Venda", value: 55000, status: "Concluída", banco: "PAN", operacao: "NOVO", convenio: "INSS", agente: "Carlos Rocha", situacaoBanco: "FINALIZADO", notes: "" },
  { id: "o7", date: "2026-03-08", partner: "p3", type: "Contrato", value: 98000, status: "Em andamento", banco: "C6", operacao: "PORTABILIDADE", convenio: "SIAPE", agente: "Bruno Moraes", situacaoBanco: "PENDENTE", notes: "" },
  { id: "o8", date: "2026-03-10", partner: "p1", type: "Venda", value: 61000, status: "Concluída", banco: "BMG", operacao: "NOVO", convenio: "INSS", agente: "Ana Lima", situacaoBanco: "FINALIZADO", notes: "" },
];
const SEED_PROPOSALS = [
  { id: "pr1", title: "Expansão de Contrato 2026", partner: "p1", value: 95000, type: "Renovação", priority: "Alta", dueDate: "2026-05-15", responsible: "Ana Lima", notes: "Cliente sinalizou interesse", status: "Negociação", history: [{ status: "Prospecção", date: "2026-01-15", note: "Primeiro contato", user: "admin" }, { status: "Negociação", date: "2026-02-10", note: "Proposta enviada", user: "admin" }] },
  { id: "pr2", title: "Novo Contrato Safra", partner: "p2", value: 140000, type: "Contrato", priority: "Alta", dueDate: "2026-06-01", responsible: "Carlos Rocha", notes: "", status: "Proposta Enviada", history: [{ status: "Prospecção", date: "2026-02-01", note: "", user: "admin" }, { status: "Proposta Enviada", date: "2026-03-01", note: "", user: "admin" }] },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
function Btn({ children, variant = "primary", style, ...p }) {
  const base = { border: "none", borderRadius: 8, fontFamily: "DM Sans", fontWeight: 600, fontSize: 12, cursor: "pointer", padding: "8px 16px", transition: "all .15s" };
  const variants = {
    primary: { background: C.accent, color: "#fff" },
    success: { background: C.accent2, color: "#fff" },
    ghost: { background: C.surface, color: C.text, border: `1px solid ${C.border}` },
    danger: { background: C.danger + "22", color: C.danger, border: `1px solid ${C.danger}44` },
  };
  return <button style={{ ...base, ...variants[variant], ...style }} {...p}>{children}</button>;
}

function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000CC", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, width, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "18px 22px", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "Syne", color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", options, placeholder, style: st }) {
  const base = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 12, outline: "none", width: "100%", fontFamily: "DM Sans" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...st }}>
      {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>{label}</label>}
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...base, cursor: "pointer" }}>
          <option value="">— Selecione —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} placeholder={placeholder} style={{ ...base, resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHEETJS LOADER (critical for import/export)
   ═══════════════════════════════════════════════════════════════════════════ */
function useSheetJS() {
  const [ready, setReady] = useState(!!window.XLSX);
  useEffect(() => {
    if (window.XLSX) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => { setReady(true); };
    s.onerror = () => { console.error("Failed to load SheetJS"); };
    document.head.appendChild(s);
  }, []);
  return ready;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN
   ═══════════════════════════════════════════════════════════════════════════ */
const USERS = [
  { username: "admin", password: "admin123", name: "Administrador", role: "Gerente" },
  { username: "parceiro", password: "123456", name: "Parceiro Demo", role: "Parceiro" },
];

function Login({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState("");
  const go = () => {
    const found = USERS.find(x => x.username === u && x.password === p);
    if (found) onLogin(found); else setErr("Usuário ou senha inválidos");
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "DM Sans" }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "40px 36px", width: 360 }}>
        <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>OpsManager</h1>
        <p style={{ color: C.muted, fontSize: 12, marginBottom: 24 }}>Sistema de Gestão de Operações</p>
        {err && <div style={{ background: C.danger + "22", color: C.danger, padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <InputField label="Usuário" value={u} onChange={setU} placeholder="admin" />
        <div style={{ height: 10 }} />
        <InputField label="Senha" value={p} onChange={setP} type="password" placeholder="••••••" />
        <div style={{ height: 16 }} />
        <Btn onClick={go} style={{ width: "100%", padding: "10px 0" }}>Entrar</Btn>
        <div style={{ color: C.muted, fontSize: 10, marginTop: 16, textAlign: "center" }}>Demo: admin / admin123</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */
function Dashboard({ ops, partners, proposals }) {
  const total = ops.reduce((s, o) => s + (o.value || 0), 0);
  const concluded = ops.filter(o => o.status === "Concluída");
  const activePartners = partners.filter(p => p.status === "Ativo").length;
  const openProposals = (proposals || []).filter(p => !["Fechado", "Perdido"].includes(p.status)).length;
  const months = {};
  ops.forEach(o => { const m = o.date?.slice(0, 7); if (m) months[m] = (months[m] || 0) + (o.value || 0); });
  const sorted = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  const max = Math.max(...sorted.map(s => s[1]), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20 }}>Dashboard</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Receita Total" value={fmtCur(total)} color={C.accent2} />
        <StatCard label="Operações" value={ops.length} sub={`${concluded.length} concluídas`} />
        <StatCard label="Parceiros Ativos" value={activePartners} />
        <StatCard label="Propostas Abertas" value={openProposals} color={C.warn} />
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Receita Mensal</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
          {sorted.map(([m, v]) => (
            <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: C.muted }}>{fmtCur(v)}</div>
              <div style={{ width: "100%", maxWidth: 48, background: C.accent, borderRadius: 6, height: Math.max(8, (v / max) * 100) + "%" }} />
              <div style={{ fontSize: 10, color: C.muted }}>{m.slice(5)}/{m.slice(2, 4)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top Parceiros</div>
        {partners.filter(p => p.status === "Ativo").slice(0, 5).map(p => {
          const pOps = ops.filter(o => o.partner === p.id);
          const pVal = pOps.reduce((s, o) => s + (o.value || 0), 0);
          return (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12 }}>{p.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.accent2 }}>{fmtCur(pVal)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARTNERS
   ═══════════════════════════════════════════════════════════════════════════ */
function Partners({ partners, setPartners, ops }) {
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: "", segment: "", region: "", status: "Ativo" });
  const [search, setSearch] = useState("");

  const openNew = () => { setForm({ name: "", segment: "", region: "", status: "Ativo" }); setEdit(null); setModal(true); };
  const openEdit = p => { setForm({ ...p }); setEdit(p.id); setModal(true); };
  const doSave = () => {
    if (!form.name.trim()) return;
    if (edit) setPartners(ps => ps.map(p => p.id === edit ? { ...p, ...form } : p));
    else setPartners(ps => [...ps, { ...form, id: uid() }]);
    setModal(false);
  };

  const filtered = partners.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20 }}>Parceiros</h2>
        <Btn onClick={openNew}>+ Novo Parceiro</Btn>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar parceiro..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 14px", fontSize: 12, outline: "none", fontFamily: "DM Sans" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filtered.map(p => {
          const pOps = ops.filter(o => o.partner === p.id);
          const pVal = pOps.reduce((s, o) => s + (o.value || 0), 0);
          return (
            <div key={p.id} onClick={() => openEdit(p)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "border-color .15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: p.status === "Ativo" ? C.accent2 + "22" : C.danger + "22", color: p.status === "Ativo" ? C.accent2 : C.danger }}>{p.status}</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>{p.segment} · {p.region}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{pOps.length} ops · {fmtCur(pVal)}</div>
            </div>
          );
        })}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? "Editar Parceiro" : "Novo Parceiro"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <InputField label="Nome" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <InputField label="Segmento" value={form.segment} onChange={v => setForm(f => ({ ...f, segment: v }))} options={["Tecnologia", "Agronegócio", "Financeiro", "Varejo", "Construção", "Saúde", "Educação", "Outro"]} />
          <InputField label="Região" value={form.region} onChange={v => setForm(f => ({ ...f, region: v }))} options={["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"]} />
          <InputField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={["Ativo", "Inativo"]} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Btn onClick={doSave} style={{ flex: 1 }}>Salvar</Btn>
            {edit && <Btn variant="danger" onClick={() => { setPartners(ps => ps.filter(p => p.id !== edit)); setModal(false); }}>Excluir</Btn>}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPERATIONS
   ═══════════════════════════════════════════════════════════════════════════ */
const BANCOS = ["BMG", "PAN", "C6", "SAFRA", "MASTER", "OLÉ", "ITAÚ", "BRADESCO", "SANTANDER", "DAYCOVAL", "MERCANTIL"];
const OPERACOES = ["NOVO", "PORTABILIDADE", "REFINANCIAMENTO", "CARTÃO", "SAQUE FGTS", "MARGEM LIVRE"];
const CONVENIOS = ["INSS", "SIAPE", "PREFEITURA", "GOV. ESTADO", "FORÇAS ARMADAS", "PRIVADO"];
const SIT_BANCO = ["PENDENTE", "FINALIZADO", "ESTORNADO", "EM ANÁLISE", "AVERBADO"];

function Operations({ ops, setOps, partners }) {
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [form, setForm] = useState({ date: TODAY, partner: "", type: "Venda", value: "", status: "Em andamento", banco: "", operacao: "", convenio: "", agente: "", situacaoBanco: "", notes: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const openNew = () => { setForm({ date: TODAY, partner: "", type: "Venda", value: "", status: "Em andamento", banco: "", operacao: "", convenio: "", agente: "", situacaoBanco: "", notes: "" }); setEdit(null); setModal(true); };
  const openEdit = o => { setForm({ ...o, value: String(o.value || "") }); setEdit(o.id); setModal(true); };
  const doSave = () => {
    if (!form.partner) return;
    const data = { ...form, value: parseFloat(String(form.value).replace(/[^\d.,]/g, "").replace(",", ".")) || 0 };
    if (edit) setOps(os => os.map(o => o.id === edit ? { ...o, ...data } : o));
    else setOps(os => [...os, { ...data, id: uid() }]);
    setModal(false);
  };

  const handleImport = (imported) => {
    setOps(prev => [...prev, ...imported]);
  };

  const filtered = ops
    .filter(o => !statusFilter || o.status === statusFilter)
    .filter(o => {
      if (!search) return true;
      const p = partners.find(x => x.id === o.partner);
      const s = search.toLowerCase();
      return (p?.name?.toLowerCase().includes(s)) || o.type?.toLowerCase().includes(s) || o.banco?.toLowerCase().includes(s) || o.agente?.toLowerCase().includes(s);
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20 }}>Operações</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={() => setImportOpen(true)}>📥 Importar</Btn>
          <Btn variant="ghost" onClick={() => setExportOpen(true)}>📤 Exportar</Btn>
          <Btn onClick={openNew}>+ Nova Operação</Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 12px", fontSize: 12, outline: "none", flex: 1, minWidth: 160, fontFamily: "DM Sans" }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "7px 10px", fontSize: 12, cursor: "pointer", fontFamily: "DM Sans" }}>
          <option value="">Todos os status</option>
          {["Em andamento", "Concluída", "Cancelada"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {["Data", "Parceiro", "Banco", "Operação", "Convênio", "Agente", "Valor", "Sit. Banco", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: C.muted, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const p = partners.find(x => x.id === o.partner);
              const sc = o.status === "Concluída" ? C.accent2 : o.status === "Cancelada" ? C.danger : C.warn;
              return (
                <tr key={o.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmtDate(o.date)}</td>
                  <td style={{ padding: "10px 12px" }}>{p?.name || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{o.banco || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{o.operacao || o.type || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{o.convenio || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{o.agente || "—"}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{fmtCur(o.value)}</td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: o.situacaoBanco === "FINALIZADO" ? C.accent2 + "22" : o.situacaoBanco === "ESTORNADO" ? C.danger + "22" : C.warn + "22", color: o.situacaoBanco === "FINALIZADO" ? C.accent2 : o.situacaoBanco === "ESTORNADO" ? C.danger : C.warn }}>{o.situacaoBanco || "—"}</span></td>
                  <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: sc + "22", color: sc }}>{o.status}</span></td>
                  <td style={{ padding: "10px 12px" }}><button onClick={() => openEdit(o)} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12 }}>✏</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 12 }}>Nenhuma operação encontrada</div>}
      </div>

      {/* Modal Nova/Editar Op */}
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? "Editar Operação" : "Nova Operação"} width={620}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InputField label="Data" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" />
          <InputField label="Parceiro" value={form.partner} onChange={v => setForm(f => ({ ...f, partner: v }))} options={partners.map(p => p.id)} />
          <InputField label="Banco" value={form.banco} onChange={v => setForm(f => ({ ...f, banco: v }))} options={BANCOS} />
          <InputField label="Operação" value={form.operacao} onChange={v => setForm(f => ({ ...f, operacao: v }))} options={OPERACOES} />
          <InputField label="Convênio" value={form.convenio} onChange={v => setForm(f => ({ ...f, convenio: v }))} options={CONVENIOS} />
          <InputField label="Agente" value={form.agente} onChange={v => setForm(f => ({ ...f, agente: v }))} />
          <InputField label="Valor (R$)" value={form.value} onChange={v => setForm(f => ({ ...f, value: v }))} />
          <InputField label="Situação Banco" value={form.situacaoBanco} onChange={v => setForm(f => ({ ...f, situacaoBanco: v }))} options={SIT_BANCO} />
          <InputField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={["Em andamento", "Concluída", "Cancelada"]} />
          <InputField label="Tipo" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} options={["Venda", "Contrato", "Renovação", "Outro"]} />
        </div>
        <div style={{ marginTop: 10 }}>
          <InputField label="Observações" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} type="textarea" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn onClick={doSave} style={{ flex: 1 }}>Salvar</Btn>
          {edit && <Btn variant="danger" onClick={() => { setOps(os => os.filter(o => o.id !== edit)); setModal(false); }}>Excluir</Btn>}
        </div>
      </Modal>

      {/* Export Modal */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} ops={ops} partners={partners} />

      {/* Import Modal */}
      <ImportOpsModal open={importOpen} onClose={() => setImportOpen(false)} partners={partners} onImport={handleImport} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function ExportModal({ open, onClose, ops, partners }) {
  const xlsxReady = useSheetJS();
  const [filters, setFilters] = useState({ banco: "", operacao: "", convenio: "", agente: "", situacaoBanco: "", parceiro: "", dateFrom: "", dateTo: "" });

  const allBancos = [...new Set(ops.map(o => o.banco).filter(Boolean))].sort();
  const allOps = [...new Set(ops.map(o => o.operacao || o.type).filter(Boolean))].sort();
  const allConvenios = [...new Set(ops.map(o => o.convenio).filter(Boolean))].sort();
  const allAgentes = [...new Set(ops.map(o => o.agente).filter(Boolean))].sort();
  const allSituacoes = [...new Set(ops.map(o => o.situacaoBanco).filter(Boolean))].sort();

  const filtered = ops.filter(o => {
    return (!filters.banco || o.banco === filters.banco) &&
      (!filters.operacao || (o.operacao || o.type) === filters.operacao) &&
      (!filters.convenio || o.convenio === filters.convenio) &&
      (!filters.agente || o.agente === filters.agente) &&
      (!filters.situacaoBanco || o.situacaoBanco === filters.situacaoBanco) &&
      (!filters.parceiro || o.partner === filters.parceiro) &&
      (!filters.dateFrom || o.date >= filters.dateFrom) &&
      (!filters.dateTo || o.date <= filters.dateTo);
  });

  const doExport = () => {
    if (!window.XLSX) return;
    const rows = filtered.map(o => {
      const p = partners.find(x => x.id === o.partner);
      return { "Data": o.date, "Parceiro": p?.name ?? "", "Banco": o.banco ?? "", "Operação": o.operacao || o.type || "", "Convênio": o.convenio ?? "", "Agente": o.agente ?? "", "Valor (R$)": o.value, "Sit. Banco": o.situacaoBanco ?? "", "Status": o.status, "Observações": o.notes ?? "" };
    });
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Digitações");
    window.XLSX.writeFile(wb, `digitacoes_${TODAY}.xlsx`);
    onClose();
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Exportar Digitações" width={640}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        <InputField label="Banco" value={filters.banco} onChange={v => setFilters(f => ({ ...f, banco: v }))} options={allBancos} />
        <InputField label="Operação" value={filters.operacao} onChange={v => setFilters(f => ({ ...f, operacao: v }))} options={allOps} />
        <InputField label="Convênio" value={filters.convenio} onChange={v => setFilters(f => ({ ...f, convenio: v }))} options={allConvenios} />
        <InputField label="Agente" value={filters.agente} onChange={v => setFilters(f => ({ ...f, agente: v }))} options={allAgentes} />
        <InputField label="Sit. Banco" value={filters.situacaoBanco} onChange={v => setFilters(f => ({ ...f, situacaoBanco: v }))} options={allSituacoes} />
        <InputField label="Parceiro" value={filters.parceiro} onChange={v => setFilters(f => ({ ...f, parceiro: v }))} options={partners.map(p => p.id)} />
        <InputField label="De" value={filters.dateFrom} onChange={v => setFilters(f => ({ ...f, dateFrom: v }))} type="date" />
        <InputField label="Até" value={filters.dateTo} onChange={v => setFilters(f => ({ ...f, dateTo: v }))} type="date" />
      </div>
      <div style={{ background: C.surface, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
        <strong style={{ color: C.accent }}>{filtered.length}</strong> operação(ões) selecionada(s) · Total: <strong style={{ color: C.accent2 }}>{fmtCur(filtered.reduce((s, o) => s + (o.value || 0), 0))}</strong>
      </div>
      <Btn onClick={doExport} style={{ width: "100%" }} variant="success" disabled={!xlsxReady}>
        {xlsxReady ? `📤 Exportar ${filtered.length} registros` : "Carregando..."}
      </Btn>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT OPERATIONS MODAL (FIXED)
   ═══════════════════════════════════════════════════════════════════════════ */
const IMPORT_MAP = {
  banco: { label: "Banco", aliases: ["banco"] },
  cpf: { label: "CPF", aliases: ["cpf", "cpf/cnpj"] },
  cliente: { label: "Cliente", aliases: ["cliente", "nome", "name"] },
  proposta: { label: "Proposta", aliases: ["proposta", "nº proposta", "n proposta"] },
  contrato: { label: "Nº Contrato", aliases: ["contrato", "nº contrato", "n contrato", "numero contrato"] },
  data: { label: "Data", aliases: ["data", "date", "dt"] },
  prazo: { label: "Prazo", aliases: ["prazo", "parcelas"] },
  vrBruto: { label: "Vr. Bruto", aliases: ["vr. bruto", "vr bruto", "valor bruto", "bruto"] },
  vrParcela: { label: "Vr. Parcela", aliases: ["vr. parcela", "vr parcela", "parcela"] },
  vrLiquido: { label: "Vr. Líquido", aliases: ["vr. líquido", "vr liquido", "vr. liquido", "líquido", "liquido"] },
  vrRepasse: { label: "Vr. Repasse", aliases: ["vr. repasse", "vr repasse", "repasse"] },
  taxa: { label: "Taxa", aliases: ["taxa", "tax"] },
  operacao: { label: "Operação", aliases: ["operação", "operacao", "tipo operação", "tipo"] },
  situacao: { label: "Situação", aliases: ["situação", "situacao", "status"] },
  produto: { label: "Produto", aliases: ["produto", "product"] },
  convenio: { label: "Convênio", aliases: ["convênio", "convenio"] },
  agente: { label: "Agente", aliases: ["agente", "agent", "vendedor"] },
  situacaoBanco: { label: "Situação Banco", aliases: ["situação banco", "situacao banco", "sit. banco", "sit banco"] },
  obsSituacao: { label: "Obs. Situação", aliases: ["obs. situação banco", "obs situação", "obs. situacao", "observação"] },
  usuario: { label: "Usuário", aliases: ["usuário", "usuario", "user"] },
};

function normalizeImportDate(v) {
  if (!v) return "";
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return "";
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

function ImportOpsModal({ open, onClose, partners, onImport }) {
  const xlsxReady = useSheetJS();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setStep(1); setRawRows([]); setHeaders([]); setMapping({});
    setPreview([]); setErrors([]); setFileName(""); setDragActive(false);
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const autoDetectMapping = (cols) => {
    const m = {};
    Object.entries(IMPORT_MAP).forEach(([field, def]) => {
      const found = cols.find(col => {
        const cl = col.toLowerCase().trim();
        return def.aliases.some(a => cl === a || cl.includes(a));
      });
      if (found) m[field] = found;
    });
    return m;
  };

  const parseFile = (file) => {
    if (!xlsxReady || !window.XLSX) {
      setErrors(["SheetJS ainda não carregou. Aguarde e tente novamente."]);
      return;
    }
    setFileName(file.name);
    setErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = window.XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) {
          setErrors(["Planilha vazia ou sem cabeçalho. Verifique se a primeira linha contém os nomes das colunas."]);
          return;
        }
        setRawRows(rows);
        const cols = Object.keys(rows[0]);
        setHeaders(cols);
        const detected = autoDetectMapping(cols);
        setMapping(detected);
        setStep(2);
      } catch (err) {
        setErrors(["Erro ao ler arquivo: " + err.message]);
      }
    };
    reader.onerror = () => setErrors(["Falha ao ler o arquivo."]);
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e) => { const f = e.target.files?.[0]; if (f) parseFile(f); };
  const handleDrop = (e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); };

  const buildPreview = () => {
    const errs = [];
    const built = rawRows.map((row, i) => {
      const cliente = mapping.cliente ? String(row[mapping.cliente] || "").trim() : "";
      const proposta = mapping.proposta ? String(row[mapping.proposta] || "").trim() : "";
      const banco = mapping.banco ? String(row[mapping.banco] || "").trim() : "";

      if (!cliente && !proposta) errs.push(`Linha ${i + 2}: sem cliente nem proposta`);

      // Try to match partner by banco name or agente
      const agenteRaw = mapping.agente ? String(row[mapping.agente] || "").trim() : "";
      const matchedPartner = partners.find(p =>
        p.name.toLowerCase() === agenteRaw.toLowerCase() ||
        p.name.toLowerCase().includes(agenteRaw.toLowerCase().split(" ")[0]?.toLowerCase() || "___")
      );

      return {
        _row: i + 2,
        _valid: !!(cliente || proposta),
        id: uid(),
        date: normalizeImportDate(mapping.data ? row[mapping.data] : ""),
        partner: matchedPartner?.id || "",
        type: mapping.operacao ? String(row[mapping.operacao] || "").trim() : "Venda",
        value: parseNumber(mapping.vrBruto ? row[mapping.vrBruto] : (mapping.vrLiquido ? row[mapping.vrLiquido] : "")),
        status: "Em andamento",
        banco: banco,
        operacao: mapping.operacao ? String(row[mapping.operacao] || "").trim() : "",
        convenio: mapping.convenio ? String(row[mapping.convenio] || "").trim() : "",
        agente: agenteRaw,
        situacaoBanco: mapping.situacaoBanco ? String(row[mapping.situacaoBanco] || "").trim() : "",
        notes: [
          mapping.cpf ? `CPF: ${row[mapping.cpf]}` : "",
          mapping.cliente ? `Cliente: ${row[mapping.cliente]}` : "",
          mapping.proposta ? `Proposta: ${row[mapping.proposta]}` : "",
          mapping.contrato ? `Contrato: ${row[mapping.contrato]}` : "",
          mapping.obsSituacao ? `Obs: ${row[mapping.obsSituacao]}` : "",
        ].filter(Boolean).join(" | "),
        // extra visible fields for preview
        _cliente: cliente,
        _proposta: proposta,
        _vrBruto: fmtCur(parseNumber(mapping.vrBruto ? row[mapping.vrBruto] : "")),
        _situacao: mapping.situacao ? String(row[mapping.situacao] || "").trim() : "",
      };
    });
    setErrors(errs);
    setPreview(built);
    setStep(3);
  };

  const handleImport = () => {
    const valid = preview.filter(p => p._valid);
    // strip preview-only fields
    const clean = valid.map(({ _row, _valid, _cliente, _proposta, _vrBruto, _situacao, ...rest }) => rest);
    onImport(clean);
    onClose();
  };

  const downloadTemplate = () => {
    if (!window.XLSX) return;
    const ws = window.XLSX.utils.aoa_to_sheet([
      ["ID", "BANCO", "CPF", "CLIENTE", "PROPOSTA", "Nº CONTRATO", "DATA", "PRAZO", "VR. BRUTO", "VR. PARCELA", "VR. LÍQUIDO", "VR. REPASSE", "VR. SEGURO", "TAXA", "OPERAÇÃO", "SITUAÇÃO", "PRODUTO", "CONVÊNIO", "AGENTE", "SITUAÇÃO BANCO", "OBS. SITUAÇÃO BANCO", "USUÁRIO"],
      ["18011", "QUALIBANKING", "015.566.609-60", "ELIZABETH APARECIDA", "QUA0000556121", "QUA0000556121", "31/01/2025", "84", "9205.32", "217.79", "7978.97", "7978.97", "0", "1.80", "NOVO", "ESTORNADO", "TOP PLUS TX 1,80%", "INSS", "NEWS NEGOCIOS", "FINALIZADO", "", "Bruno Moraes"],
    ]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Digitações");
    window.XLSX.writeFile(wb, "modelo_digitacoes.xlsx");
  };

  if (!open) return null;

  const validCount = preview.filter(p => p._valid).length;
  const invalidCount = preview.length - validCount;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000CC", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, width: 740, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, margin: 0 }}>Importar Digitações em Lote</h3>
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              {["Upload", "Mapear Colunas", "Revisar"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", background: step > i + 1 ? C.accent2 : step === i + 1 ? C.accent : C.border, color: step >= i + 1 ? "#fff" : C.muted }}>{step > i + 1 ? "✓" : i + 1}</div>
                  <span style={{ fontSize: 11, color: step === i + 1 ? C.text : C.muted, fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
                  {i < 2 && <span style={{ color: C.border, fontSize: 11, marginLeft: 6 }}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          {/* Step 1: Upload */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragActive ? C.accent : C.border}`, borderRadius: 14, padding: "40px 24px", textAlign: "center", background: dragActive ? C.accent + "08" : C.surface, cursor: "pointer", transition: "all .2s" }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{xlsxReady ? "Arraste ou clique para selecionar" : "Carregando biblioteca..."}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Suporta .xlsx, .xls e .csv</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />
              </div>
              {errors.map((e, i) => <div key={i} style={{ background: C.danger + "18", border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.danger }}>{e}</div>)}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>📥 Baixar modelo de planilha</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Formato compatível com PROPOSTAS_DIGITADAS</div>
                </div>
                <Btn variant="ghost" onClick={downloadTemplate} style={{ fontSize: 11 }}>Baixar .xlsx</Btn>
              </div>
              <div style={{ background: C.surface, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                <strong style={{ color: C.accent }}>Colunas detectadas automaticamente:</strong> ID, BANCO, CPF, CLIENTE, PROPOSTA, Nº CONTRATO, DATA, PRAZO, VR. BRUTO, VR. PARCELA, VR. LÍQUIDO, VR. REPASSE, TAXA, OPERAÇÃO, SITUAÇÃO, PRODUTO, CONVÊNIO, AGENTE, SITUAÇÃO BANCO, OBS. SITUAÇÃO BANCO, USUÁRIO
              </div>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: C.surface, borderRadius: 10, padding: "9px 14px", border: `1px solid ${C.border}`, fontSize: 12, color: C.muted }}>
                Arquivo: <strong style={{ color: C.text }}>{fileName}</strong> · {rawRows.length} linha(s) · {headers.length} coluna(s)
              </div>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Campos detectados automaticamente ({Object.keys(mapping).length} de {Object.keys(IMPORT_MAP).length}). Ajuste se necessário:</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {Object.entries(IMPORT_MAP).map(([field, def]) => (
                  <div key={field} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10, color: mapping[field] ? C.accent : C.muted, fontWeight: 600 }}>{def.label}</label>
                    <select
                      value={mapping[field] ?? ""}
                      onChange={e => setMapping(m => ({ ...m, [field]: e.target.value || undefined }))}
                      style={{ background: C.surface, border: `1px solid ${mapping[field] ? C.accent + "66" : C.border}`, borderRadius: 7, color: mapping[field] ? C.text : C.muted, padding: "6px 8px", fontSize: 11, outline: "none", cursor: "pointer" }}
                    >
                      <option value="">— Ignorar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => { reset(); }}>← Voltar</Btn>
                <Btn onClick={buildPreview} style={{ flex: 1 }}>Revisar Importação →</Btn>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Import */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {errors.length > 0 && (
                <div style={{ background: C.warn + "18", border: `1px solid ${C.warn}44`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.warn, marginBottom: 3 }}>⚠ {errors.length} aviso(s)</div>
                  {errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 11, color: C.warn }}>{e}</div>)}
                  {errors.length > 5 && <div style={{ fontSize: 11, color: C.warn }}>... e mais {errors.length - 5}</div>}
                </div>
              )}
              <div style={{ fontSize: 12, color: C.muted }}>
                <strong style={{ color: C.accent2 }}>{validCount}</strong> digitações prontas para importar
                {invalidCount > 0 && <span style={{ color: C.danger }}> · {invalidCount} ignoradas</span>}
              </div>
              <div style={{ overflowX: "auto", maxHeight: 300, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: C.surface, position: "sticky", top: 0 }}>
                      {["", "Cliente", "Proposta", "Banco", "Operação", "Convênio", "Agente", "Vr. Bruto", "Sit. Banco"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 50).map(p => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: p._valid ? 1 : 0.4 }}>
                        <td style={{ padding: "6px 10px", color: p._valid ? C.accent2 : C.danger, fontWeight: 700 }}>{p._valid ? "✓" : "✕"}</td>
                        <td style={{ padding: "6px 10px" }}>{p._cliente}</td>
                        <td style={{ padding: "6px 10px" }}>{p._proposta}</td>
                        <td style={{ padding: "6px 10px" }}>{p.banco}</td>
                        <td style={{ padding: "6px 10px" }}>{p.operacao}</td>
                        <td style={{ padding: "6px 10px" }}>{p.convenio}</td>
                        <td style={{ padding: "6px 10px" }}>{p.agente}</td>
                        <td style={{ padding: "6px 10px" }}>{p._vrBruto}</td>
                        <td style={{ padding: "6px 10px" }}>{p.situacaoBanco}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && <div style={{ padding: 10, textAlign: "center", fontSize: 11, color: C.muted }}>Mostrando 50 de {preview.length} linhas</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setStep(2)}>← Voltar</Btn>
                <Btn onClick={handleImport} variant="success" style={{ flex: 1 }} disabled={validCount === 0}>
                  ✓ Importar {validCount} digitações
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROPOSALS (KANBAN)
   ═══════════════════════════════════════════════════════════════════════════ */
const PROPOSAL_STAGES = ["Prospecção", "Proposta Enviada", "Negociação", "Fechado", "Perdido"];
const VALID_PRIORITY = ["Baixa", "Média", "Alta"];
const VALID_TYPES = ["Venda", "Contrato", "Renovação", "Outro"];

function Proposals({ proposals, setProposals, partners, currentUser }) {
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ title: "", partner: "", value: "", type: "Venda", priority: "Média", dueDate: "", responsible: "", notes: "", status: "Prospecção" });

  const openNew = () => { setForm({ title: "", partner: "", value: "", type: "Venda", priority: "Média", dueDate: "", responsible: "", notes: "", status: "Prospecção" }); setEdit(null); setModal(true); };
  const openEdit = p => { setForm({ ...p, value: String(p.value || "") }); setEdit(p.id); setModal(true); };

  const doSave = () => {
    if (!form.title.trim()) return;
    const data = { ...form, value: parseNumber(form.value) };
    if (edit) {
      setProposals(ps => ps.map(p => {
        if (p.id !== edit) return p;
        const changed = p.status !== data.status;
        const hist = changed ? [...(p.history || []), { status: data.status, date: TODAY, note: "", user: currentUser }] : p.history;
        return { ...p, ...data, history: hist };
      }));
    } else {
      setProposals(ps => [...ps, { ...data, id: uid(), history: [{ status: data.status, date: TODAY, note: "Criado", user: currentUser }] }]);
    }
    setModal(false);
  };

  const moveStage = (id, newStatus) => {
    setProposals(ps => ps.map(p => {
      if (p.id !== id) return p;
      return { ...p, status: newStatus, history: [...(p.history || []), { status: newStatus, date: TODAY, note: "", user: currentUser }] };
    }));
  };

  const handleProposalImport = (imported) => {
    setProposals(prev => [...prev, ...imported]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20 }}>Propostas</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={() => setImportOpen(true)}>📥 Importar</Btn>
          <Btn onClick={openNew}>+ Nova Proposta</Btn>
        </div>
      </div>
      {/* Kanban */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10 }}>
        {PROPOSAL_STAGES.map(stage => {
          const items = proposals.filter(p => p.status === stage);
          const stageColor = stage === "Fechado" ? C.accent2 : stage === "Perdido" ? C.danger : stage === "Negociação" ? C.warn : C.accent;
          return (
            <div key={stage} style={{ minWidth: 220, flex: 1, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: stageColor }}>{stage}</span>
                <span style={{ fontSize: 10, background: stageColor + "22", color: stageColor, padding: "2px 8px", borderRadius: 8 }}>{items.length}</span>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {items.map(p => {
                  const partner = partners.find(x => x.id === p.partner);
                  return (
                    <div key={p.id} onClick={() => openEdit(p)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", transition: "border-color .15s" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{partner?.name || "—"} · {fmtCur(p.value)}</div>
                      {p.dueDate && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Prazo: {fmtDate(p.dueDate)}</div>}
                      {/* Move buttons */}
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        {PROPOSAL_STAGES.filter(s => s !== stage).map(s => (
                          <button key={s} onClick={e => { e.stopPropagation(); moveStage(p.id, s); }} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer" }}>→ {s.slice(0, 4)}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: 16 }}>Vazio</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={edit ? "Editar Proposta" : "Nova Proposta"} width={560}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InputField label="Título" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} style={{ gridColumn: "1 / -1" }} />
          <InputField label="Parceiro" value={form.partner} onChange={v => setForm(f => ({ ...f, partner: v }))} options={partners.map(p => p.id)} />
          <InputField label="Valor (R$)" value={form.value} onChange={v => setForm(f => ({ ...f, value: v }))} />
          <InputField label="Tipo" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} options={VALID_TYPES} />
          <InputField label="Prioridade" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={VALID_PRIORITY} />
          <InputField label="Prazo" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} type="date" />
          <InputField label="Responsável" value={form.responsible} onChange={v => setForm(f => ({ ...f, responsible: v }))} />
          <InputField label="Status" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={PROPOSAL_STAGES} style={{ gridColumn: "1 / -1" }} />
        </div>
        <div style={{ marginTop: 10 }}>
          <InputField label="Observações" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} type="textarea" />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn onClick={doSave} style={{ flex: 1 }}>Salvar</Btn>
          {edit && <Btn variant="danger" onClick={() => { setProposals(ps => ps.filter(p => p.id !== edit)); setModal(false); }}>Excluir</Btn>}
        </div>
      </Modal>

      {/* Import Proposals */}
      <ImportProposalModal open={importOpen} onClose={() => setImportOpen(false)} partners={partners} onImport={handleProposalImport} currentUser={currentUser} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT PROPOSALS MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const PROP_IMPORT_FIELDS = [
  { key: "title", label: "Título", aliases: ["título", "titulo", "proposta", "nome"] },
  { key: "partner", label: "Parceiro", aliases: ["parceiro", "cliente", "partner"] },
  { key: "value", label: "Valor", aliases: ["valor", "value", "montante", "vr. bruto"] },
  { key: "type", label: "Tipo", aliases: ["tipo", "type", "operação"] },
  { key: "priority", label: "Prioridade", aliases: ["prioridade", "priority"] },
  { key: "status", label: "Status", aliases: ["status", "etapa", "fase", "situação"] },
  { key: "dueDate", label: "Prazo", aliases: ["prazo", "data", "vencimento", "date"] },
  { key: "responsible", label: "Responsável", aliases: ["responsável", "responsavel", "vendedor", "agente"] },
  { key: "notes", label: "Observações", aliases: ["obs", "nota", "observações", "comment"] },
];

function normalizePropStatus(v) {
  if (!v) return "Prospecção";
  const s = String(v).toLowerCase().trim();
  const map = { "prospecção": "Prospecção", "prospeccao": "Prospecção", "enviada": "Proposta Enviada", "proposta enviada": "Proposta Enviada", "negociação": "Negociação", "negociacao": "Negociação", "fechado": "Fechado", "won": "Fechado", "ganho": "Fechado", "perdido": "Perdido", "lost": "Perdido" };
  return map[s] || PROPOSAL_STAGES.find(st => st.toLowerCase().includes(s)) || "Prospecção";
}

function ImportProposalModal({ open, onClose, partners, onImport, currentUser }) {
  const xlsxReady = useSheetJS();
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => { setStep(1); setRawRows([]); setHeaders([]); setMapping({}); setPreview([]); setErrors([]); setFileName(""); };
  useEffect(() => { if (!open) reset(); }, [open]);

  const parseFile = (file) => {
    if (!xlsxReady || !window.XLSX) { setErrors(["Aguarde o carregamento da biblioteca."]); return; }
    setFileName(file.name); setErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        if (!rows.length) { setErrors(["Planilha vazia"]); return; }
        setRawRows(rows);
        const cols = Object.keys(rows[0]);
        setHeaders(cols);
        const m = {};
        PROP_IMPORT_FIELDS.forEach(f => {
          const found = cols.find(c => f.aliases.some(a => c.toLowerCase().trim().includes(a)));
          if (found) m[f.key] = found;
        });
        setMapping(m);
        setStep(2);
      } catch (err) { setErrors(["Erro: " + err.message]); }
    };
    reader.readAsArrayBuffer(file);
  };

  const buildPreview = () => {
    const errs = [];
    const built = rawRows.map((row, i) => {
      const title = mapping.title ? String(row[mapping.title] || "").trim() : "";
      const partnerRaw = mapping.partner ? String(row[mapping.partner] || "").trim() : "";
      if (!title) errs.push(`Linha ${i + 2}: título vazio`);
      const matched = partners.find(p => p.name.toLowerCase().trim() === partnerRaw.toLowerCase() || p.name.toLowerCase().includes(partnerRaw.toLowerCase().split(" ")[0] || "___"));
      if (partnerRaw && !matched) errs.push(`Linha ${i + 2}: parceiro "${partnerRaw}" não encontrado`);
      return {
        _row: i + 2, _valid: !!title, _partnerRaw: partnerRaw,
        id: uid(), title, partner: matched?.id || "",
        value: parseNumber(mapping.value ? row[mapping.value] : ""),
        type: mapping.type ? String(row[mapping.type] || "Venda").trim() : "Venda",
        priority: mapping.priority ? (VALID_PRIORITY.includes(String(row[mapping.priority]).trim()) ? String(row[mapping.priority]).trim() : "Média") : "Média",
        status: normalizePropStatus(mapping.status ? row[mapping.status] : ""),
        dueDate: normalizeImportDate(mapping.dueDate ? row[mapping.dueDate] : ""),
        responsible: mapping.responsible ? String(row[mapping.responsible] || "").trim() : "",
        notes: mapping.notes ? String(row[mapping.notes] || "").trim() : "",
        history: [{ status: "Prospecção", date: TODAY, note: "Importado via planilha", user: currentUser }],
      };
    });
    setErrors(errs); setPreview(built); setStep(3);
  };

  const handleImport = () => {
    const valid = preview.filter(p => p._valid).map(({ _row, _valid, _partnerRaw, ...rest }) => rest);
    onImport(valid);
    onClose();
  };

  const downloadTemplate = () => {
    if (!window.XLSX) return;
    const ws = window.XLSX.utils.aoa_to_sheet([
      ["Título", "Parceiro", "Valor (R$)", "Tipo", "Prioridade", "Status", "Prazo (dd/mm/aaaa)", "Responsável", "Observações"],
      ["Renovação Contrato 2026", "TechVentures SP", 95000, "Renovação", "Alta", "Negociação", "15/05/2026", "Ana Lima", ""],
    ]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Propostas");
    window.XLSX.writeFile(wb, "modelo_propostas.xlsx");
  };

  if (!open) return null;
  const validCount = preview.filter(p => p._valid).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000CC", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, width: 700, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 15, margin: 0 }}>Importar Propostas</h3>
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              {["Upload", "Mapear", "Revisar"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", background: step > i + 1 ? C.accent2 : step === i + 1 ? C.accent : C.border, color: step >= i + 1 ? "#fff" : C.muted }}>{step > i + 1 ? "✓" : i + 1}</div>
                  <span style={{ fontSize: 11, color: step === i + 1 ? C.text : C.muted }}>{s}</span>
                  {i < 2 && <span style={{ color: C.border, marginLeft: 4 }}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div onDragOver={e => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={e => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }} onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${dragActive ? C.accent : C.border}`, borderRadius: 14, padding: "40px 24px", textAlign: "center", background: dragActive ? C.accent + "08" : C.surface, cursor: "pointer" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{xlsxReady ? "Arraste ou clique" : "Carregando..."}</div>
                <div style={{ fontSize: 11, color: C.muted }}>.xlsx, .xls ou .csv</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} style={{ display: "none" }} />
              </div>
              {errors.map((e, i) => <div key={i} style={{ background: C.danger + "18", padding: "8px 12px", borderRadius: 8, fontSize: 12, color: C.danger }}>{e}</div>)}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>📥 Baixar modelo</span>
                <Btn variant="ghost" onClick={downloadTemplate} style={{ fontSize: 11 }}>Baixar .xlsx</Btn>
              </div>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: C.muted }}>Arquivo: <strong style={{ color: C.text }}>{fileName}</strong> · {rawRows.length} linhas</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {PROP_IMPORT_FIELDS.map(f => (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10, color: mapping[f.key] ? C.accent : C.muted, fontWeight: 600 }}>{f.label}</label>
                    <select value={mapping[f.key] ?? ""} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))} style={{ background: C.surface, border: `1px solid ${mapping[f.key] ? C.accent + "66" : C.border}`, borderRadius: 7, color: mapping[f.key] ? C.text : C.muted, padding: "6px 8px", fontSize: 11, outline: "none", cursor: "pointer" }}>
                      <option value="">— Ignorar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Btn variant="ghost" onClick={reset}>← Voltar</Btn>
                <Btn onClick={buildPreview} style={{ flex: 1 }}>Revisar →</Btn>
              </div>
            </div>
          )}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {errors.length > 0 && <div style={{ background: C.warn + "18", borderRadius: 8, padding: "10px 14px" }}>{errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 11, color: C.warn }}>{e}</div>)}</div>}
              <div style={{ fontSize: 12 }}><strong style={{ color: C.accent2 }}>{validCount}</strong> propostas prontas</div>
              <div style={{ overflowX: "auto", maxHeight: 260, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead><tr style={{ background: C.surface }}>{["", "Título", "Parceiro", "Valor", "Status"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.muted, fontSize: 10 }}>{h}</th>)}</tr></thead>
                  <tbody>{preview.slice(0, 50).map(p => <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: p._valid ? 1 : 0.4 }}><td style={{ padding: "6px 10px", color: p._valid ? C.accent2 : C.danger, fontWeight: 700 }}>{p._valid ? "✓" : "✕"}</td><td style={{ padding: "6px 10px" }}>{p.title}</td><td style={{ padding: "6px 10px" }}>{p._partnerRaw}</td><td style={{ padding: "6px 10px" }}>{fmtCur(p.value)}</td><td style={{ padding: "6px 10px" }}>{p.status}</td></tr>)}</tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setStep(2)}>← Voltar</Btn>
                <Btn onClick={handleImport} variant="success" style={{ flex: 1 }} disabled={validCount === 0}>✓ Importar {validCount} propostas</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYSIS
   ═══════════════════════════════════════════════════════════════════════════ */
function Analise({ ops, partners }) {
  const now = new Date();
  const curMonth = now.toISOString().slice(0, 7);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);

  const curOps = ops.filter(o => o.date?.startsWith(curMonth));
  const prevOps = ops.filter(o => o.date?.startsWith(prevMonth));

  const activePartners = partners.filter(p => p.status === "Ativo");

  const partnerStats = activePartners.map(p => {
    const cur = curOps.filter(o => o.partner === p.id);
    const prev = prevOps.filter(o => o.partner === p.id);
    const curVal = cur.reduce((s, o) => s + (o.value || 0), 0);
    const prevVal = prev.reduce((s, o) => s + (o.value || 0), 0);
    const lastOp = ops.filter(o => o.partner === p.id).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
    const daysSince = lastOp ? Math.floor((now - new Date(lastOp.date)) / 86400000) : 999;
    const variation = prevVal > 0 ? ((curVal - prevVal) / prevVal * 100) : (curVal > 0 ? 100 : 0);

    let alert = "ok";
    if (cur.length === 0 && prev.length > 0) alert = "inactive";
    else if (variation <= -30) alert = "drop_heavy";
    else if (variation < 0) alert = "drop_light";
    else if (prev.length === 0 && cur.length === 0) alert = "never";

    return { ...p, curCount: cur.length, prevCount: prev.length, curVal, prevVal, variation, daysSince, lastDate: lastOp?.date, alert };
  }).sort((a, b) => {
    const order = { inactive: 0, drop_heavy: 1, drop_light: 2, never: 3, ok: 4 };
    return (order[a.alert] ?? 5) - (order[b.alert] ?? 5);
  });

  const alertCount = partnerStats.filter(p => ["inactive", "drop_heavy"].includes(p.alert)).length;

  // Daily chart last 30 days
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const dayOps = ops.filter(o => o.date === ds);
    days.push({ date: ds, count: dayOps.length, value: dayOps.reduce((s, o) => s + (o.value || 0), 0) });
  }
  const maxCount = Math.max(...days.map(d => d.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20 }}>Análise de Digitações</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Digitações no Mês" value={curOps.length} sub={`${prevOps.length} no mês anterior`} />
        <StatCard label="Parceiros em Queda" value={partnerStats.filter(p => ["drop_heavy", "drop_light"].includes(p.alert)).length} color={C.warn} />
        <StatCard label="Sem Digitar no Mês" value={partnerStats.filter(p => p.alert === "inactive").length} color={C.danger} />
        <StatCard label="Total com Alerta" value={alertCount} color={alertCount > 0 ? C.danger : C.accent2} />
      </div>

      {/* Alerts */}
      {alertCount > 0 && (
        <div style={{ background: C.danger + "12", border: `1px solid ${C.danger}33`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.danger, marginBottom: 8 }}>⚠ Parceiros que precisam de atenção</div>
          {partnerStats.filter(p => ["inactive", "drop_heavy"].includes(p.alert)).map(p => (
            <div key={p.id} style={{ fontSize: 12, padding: "4px 0", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: p.alert === "inactive" ? C.danger : C.warn }}>{p.alert === "inactive" ? "🔴" : "🟡"}</span>
              <strong>{p.name}</strong>
              <span style={{ color: C.muted }}>— {p.alert === "inactive" ? `Sem digitação no mês (última: ${p.lastDate ? fmtDate(p.lastDate) : "nunca"})` : `Queda de ${Math.abs(p.variation).toFixed(0)}%`}</span>
            </div>
          ))}
        </div>
      )}

      {/* Daily chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Digitações Diárias (últimos 30 dias)</div>
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 100 }}>
          {days.map(d => {
            const isToday = d.date === TODAY;
            return (
              <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${fmtDate(d.date)}: ${d.count} ops`}>
                <div style={{ width: "100%", background: isToday ? C.accent : C.accent + "66", borderRadius: 3, height: Math.max(3, (d.count / maxCount) * 90), transition: "height .3s" }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: C.muted }}>{fmtDate(days[0]?.date)}</span>
          <span style={{ fontSize: 10, color: C.muted }}>Hoje</span>
        </div>
      </div>

      {/* Partner table */}
      <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              {["Sinal", "Parceiro", "Mês Atual", "Mês Anterior", "Variação", "Última Digitação", "Dias"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: C.muted, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partnerStats.map(p => {
              const alertIcon = p.alert === "inactive" ? "🔴" : p.alert === "drop_heavy" ? "🔴" : p.alert === "drop_light" ? "🟡" : p.alert === "never" ? "○" : "↗";
              const varColor = p.variation > 0 ? C.accent2 : p.variation < -30 ? C.danger : p.variation < 0 ? C.warn : C.text;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 12px", fontSize: 14 }}>{alertIcon}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "10px 12px" }}>{p.curCount} ops · {fmtCur(p.curVal)}</td>
                  <td style={{ padding: "10px 12px" }}>{p.prevCount} ops · {fmtCur(p.prevVal)}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: varColor }}>{p.variation > 0 ? "+" : ""}{p.variation.toFixed(0)}%</td>
                  <td style={{ padding: "10px 12px" }}>{p.lastDate ? fmtDate(p.lastDate) : "—"}</td>
                  <td style={{ padding: "10px 12px", color: p.daysSince > 30 ? C.danger : p.daysSince > 14 ? C.warn : C.text }}>{p.daysSince < 999 ? `${p.daysSince}d` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PERFORMANCE
   ═══════════════════════════════════════════════════════════════════════════ */
function Performance({ ops, partners }) {
  const ranked = partners.filter(p => p.status === "Ativo").map(p => {
    const pOps = ops.filter(o => o.partner === p.id);
    const total = pOps.reduce((s, o) => s + (o.value || 0), 0);
    const concluded = pOps.filter(o => o.status === "Concluída");
    return { ...p, opsCount: pOps.length, total, concludedCount: concluded.length, concludedVal: concluded.reduce((s, o) => s + (o.value || 0), 0) };
  }).sort((a, b) => b.total - a.total);

  const maxVal = Math.max(...ranked.map(r => r.total), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 20 }}>Performance</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ranked.map((p, i) => (
          <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: i < 3 ? C.accent : C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: i < 3 ? "#fff" : C.muted }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.accent2 }}>{fmtCur(p.total)}</span>
              </div>
              <div style={{ height: 6, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", background: i < 3 ? C.accent : C.accent + "66", borderRadius: 3, width: (p.total / maxVal * 100) + "%", transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{p.opsCount} operações · {p.concludedCount} concluídas · {p.segment}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════ */
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "analise", label: "Análise", icon: "📈" },
  { id: "proposals", label: "Propostas", icon: "📋" },
  { id: "ops", label: "Operações", icon: "💼" },
  { id: "partners", label: "Parceiros", icon: "🤝" },
  { id: "performance", label: "Performance", icon: "🏆" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [ops, setOpsRaw] = useState([]);
  const [partners, setPartnersRaw] = useState([]);
  const [proposals, setProposalsRaw] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const setOps = useCallback(fn => { setOpsRaw(prev => { const next = typeof fn === "function" ? fn(prev) : fn; save(KEYS.ops, next); return next; }); }, []);
  const setPartners = useCallback(fn => { setPartnersRaw(prev => { const next = typeof fn === "function" ? fn(prev) : fn; save(KEYS.partners, next); return next; }); }, []);
  const setProposals = useCallback(fn => { setProposalsRaw(prev => { const next = typeof fn === "function" ? fn(prev) : fn; save(KEYS.proposals, next); return next; }); }, []);

  useEffect(() => {
    (async () => {
      const [o, p, pr] = await Promise.all([load(KEYS.ops), load(KEYS.partners), load(KEYS.proposals)]);
      setOpsRaw(o || SEED_OPS);
      setPartnersRaw(p || SEED_PARTNERS);
      setProposalsRaw(pr || SEED_PROPOSALS);
      setLoaded(true);
    })();
  }, []);

  if (!user) return <Login onLogin={setUser} />;
  if (!loaded) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.text, fontFamily: "DM Sans" }}>Carregando...</div>;

  const alertPartners = partners.filter(p => p.status === "Ativo").filter(p => {
    const curMonth = new Date().toISOString().slice(0, 7);
    const curOps = ops.filter(o => o.partner === p.id && o.date?.startsWith(curMonth));
    return curOps.length === 0;
  }).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${C.bg}; color: ${C.text}; font-family: "DM Sans", sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        select option { background: ${C.surface}; color: ${C.text}; }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <div style={{ width: 220, background: C.card, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "24px 20px 16px" }}>
            <h1 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 800 }}>OpsManager</h1>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Gestão de Operações</div>
          </div>
          <nav style={{ flex: 1, padding: "0 12px" }}>
            {NAV.map(n => {
              const active = view === n.id;
              const badge = n.id === "analise" ? alertPartners : n.id === "proposals" ? (proposals || []).filter(p => !["Fechado", "Perdido"].includes(p.status)).length : 0;
              return (
                <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", marginBottom: 2, borderRadius: 10, border: "none", background: active ? C.accent + "22" : "transparent", color: active ? C.accent : C.muted, fontFamily: "DM Sans", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", textAlign: "left", transition: "all .15s", position: "relative" }}>
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  {n.label}
                  {badge > 0 && <span style={{ marginLeft: "auto", background: n.id === "analise" ? C.danger : C.accent, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8 }}>{badge}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{user.role}</div>
            <button onClick={() => setUser(null)} style={{ fontSize: 11, color: C.danger, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sair →</button>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto", maxWidth: "calc(100vw - 220px)" }}>
          {view === "dashboard" && <Dashboard ops={ops} partners={partners} proposals={proposals} />}
          {view === "analise" && <Analise ops={ops} partners={partners} />}
          {view === "proposals" && <Proposals proposals={proposals} setProposals={setProposals} partners={partners} currentUser={user.username} />}
          {view === "ops" && <Operations ops={ops} setOps={setOps} partners={partners} />}
          {view === "partners" && <Partners partners={partners} setPartners={setPartners} ops={ops} />}
          {view === "performance" && <Performance ops={ops} partners={partners} />}
        </div>
      </div>
    </>
  );
}
