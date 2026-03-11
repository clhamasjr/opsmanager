import { useState, useEffect, useCallback, useRef } from "react";

// ── Storage helpers ──────────────────────────────────────────────────────────
const KEYS = { ops: "ops-data", partners: "partners-data", proposals: "proposals-data" };

async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function save(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch {}
}

// ── Seed ─────────────────────────────────────────────────────────────────────
const SEED_PARTNERS = [
  { id: "p1", name: "TechVentures SP", segment: "Tecnologia", region: "Sudeste", status: "Ativo" },
  { id: "p2", name: "AgriNorte Ltda", segment: "Agronegócio", region: "Norte", status: "Ativo" },
  { id: "p3", name: "FinGroup Brasil", segment: "Financeiro", region: "Sul", status: "Ativo" },
  { id: "p4", name: "RetailMax", segment: "Varejo", region: "Nordeste", status: "Ativo" },
  { id: "p5", name: "Construtech CE", segment: "Construção", region: "Nordeste", status: "Inativo" },
];

// Campos baseados na planilha real PROPOSTAS_DIGITADAS.xlsx
// AGENTE=parceiro, USUÁRIO=digitador, OPERAÇÃO=tipo, SITUAÇÃO=status interno, SITUAÇÃO BANCO=sit. banco
const SEED_OPS = [
  { id:"o1",  date:"2025-01-31", partner:"p1", banco:"QUALIBANKING",   operacao:"NOVO",          convenio:"INSS",       usuario:"Bruno Bortoli",        cpf:"015.566.609-60", cliente:"ELIZABETH RODRIGUES",    proposta:"QUA0000556121", contrato:"QUA0000556121", prazo:84, value:9205.32,  vrParcela:217.79,  vrLiquido:7978.97,  vrRepasse:7978.97, taxa:1.80, produto:"TOP PLUS - TX 1,80%",           situacao:"ESTORNADO",          situacaoBanco:"FINALIZADO",    notes:"" },
  { id:"o2",  date:"2025-01-31", partner:"p2", banco:"QUALIBANKING",   operacao:"PORTAB/REFIN",  convenio:"INSS",       usuario:"Rubineia Ferreira",     cpf:"260.535.018-59", cliente:"ANDREA ALVES CARDOSO",   proposta:"QUA0000558782", contrato:"QUA0000558782", prazo:70, value:19667.83, vrParcela:477.22,  vrLiquido:19667.83, vrRepasse:19667.83,taxa:1.59, produto:"INSS - PORT + REFIN",            situacao:"CANCELADA",          situacaoBanco:"CANCELADO",     notes:"" },
  { id:"o3",  date:"2025-01-31", partner:"p1", banco:"QUALIBANKING",   operacao:"NOVO",          convenio:"INSS",       usuario:"Dafini Machado",        cpf:"154.375.948-36", cliente:"ANICE DE OLIVEIRA",       proposta:"QUA0000559852", contrato:"QUA0000559852", prazo:84, value:2248.81,  vrParcela:53.30,   vrLiquido:1949.11,  vrRepasse:1949.11, taxa:1.80, produto:"INSS - NOVO - TOP PLUS",         situacao:"ESTORNADO",          situacaoBanco:"FINALIZADO",    notes:"" },
  { id:"o4",  date:"2025-01-31", partner:"p3", banco:"BRB - INCONTA",  operacao:"PORTABILIDADE", convenio:"INSS",       usuario:"LHAMASCRED PROMOTORA",  cpf:"789.196.575-72", cliente:"ROSEMARY MOREIRA",        proposta:"1151915",       contrato:"1151915",       prazo:84, value:19259.97, vrParcela:431.00,  vrLiquido:0,        vrRepasse:19259.97,taxa:1.66, produto:"BRB - INSS - NOVO - 1,85%",      situacao:"CANCELADA",          situacaoBanco:"Cancelada",     notes:"" },
  { id:"o5",  date:"2025-02-10", partner:"p2", banco:"PAN",            operacao:"REFINANCIAMENTO",convenio:"INSS",      usuario:"Ana Lima",              cpf:"046.411.458-65", cliente:"IRACI ANANIAS SANTOS",    proposta:"1152005",       contrato:"1152005",       prazo:84, value:11217.70, vrParcela:251.03,  vrLiquido:0,        vrRepasse:11217.70,taxa:1.66, produto:"INSS PORTABILIDADE",              situacao:"CANCELADA",          situacaoBanco:"Cancelada",     notes:"" },
  { id:"o6",  date:"2025-02-15", partner:"p4", banco:"FACTA FINANCEIRA",operacao:"NOVO",          convenio:"FGTS",      usuario:"Carlos Rocha",          cpf:"035.372.718-08", cliente:"RICARDO MONTEIRO",        proposta:"FAC0001234",    contrato:"FAC0001234",    prazo:60, value:5073.54,  vrParcela:120.25,  vrLiquido:4397.39,  vrRepasse:4397.39, taxa:1.80, produto:"FGTS - NOVO",                    situacao:"CONCRETIZADO",       situacaoBanco:"PAGO",          notes:"" },
  { id:"o7",  date:"2025-02-20", partner:"p1", banco:"C6 BANK",        operacao:"CARTÃO",         convenio:"INSS",      usuario:"Mariana Costa",         cpf:"123.456.789-00", cliente:"JOSE CARLOS SILVA",       proposta:"C6B0004567",    contrato:"C6B0004567",    prazo:96, value:15000.00, vrParcela:200.00,  vrLiquido:13500.00, vrRepasse:13500.00,taxa:1.55, produto:"CARTÃO CONSIGNADO INSS",          situacao:"ANDAMENTO",          situacaoBanco:"EM ANALISE",    notes:"" },
  { id:"o8",  date:"2025-03-01", partner:"p3", banco:"CAPITAL CONSIG", operacao:"NOVO",           convenio:"FEDERAL",   usuario:"João Melo",             cpf:"987.654.321-00", cliente:"MARIA APARECIDA SOUZA",   proposta:"CAP0007890",    contrato:"CAP0007890",    prazo:72, value:32000.00, vrParcela:520.00,  vrLiquido:29000.00, vrRepasse:29000.00,taxa:1.70, produto:"FEDERAL - NOVO",                  situacao:"CONCRETIZADO",       situacaoBanco:"PAGO",          notes:"" },
  { id:"o9",  date:"2025-03-10", partner:"p2", banco:"PAGBANK",        operacao:"PORTAB/REFIN",   convenio:"PREFEITURAS",usuario:"Ana Lima",             cpf:"111.222.333-44", cliente:"PEDRO HENRIQUE COSTA",    proposta:"PAG0002345",    contrato:"PAG0002345",    prazo:84, value:25000.00, vrParcela:380.00,  vrLiquido:22000.00, vrRepasse:22000.00,taxa:1.65, produto:"PREFEITURAS - PORT+REFIN",        situacao:"ANALISE BANCO",      situacaoBanco:"ANALISE BANCO", notes:"Aguardando retorno" },
  { id:"o10", date:"2025-03-15", partner:"p4", banco:"PAN",            operacao:"NOVO",           convenio:"INSS",      usuario:"Carlos Rocha",          cpf:"555.666.777-88", cliente:"LUIZA FERNANDES",         proposta:"PAN0008901",    contrato:"PAN0008901",    prazo:84, value:8500.00,  vrParcela:185.00,  vrLiquido:7200.00,  vrRepasse:7200.00, taxa:1.80, produto:"INSS - NOVO TOP PLUS",            situacao:"CONCRETIZADO",       situacaoBanco:"PAGO",          notes:"" },
  { id:"o11", date:"2025-03-20", partner:"p1", banco:"QUALIBANKING",   operacao:"RECOMPRA",       convenio:"INSS",      usuario:"Bruno Bortoli",         cpf:"222.333.444-55", cliente:"ANTONIO CARLOS LIMA",     proposta:"QUA0001112",    contrato:"QUA0001112",    prazo:60, value:12000.00, vrParcela:240.00,  vrLiquido:10500.00, vrRepasse:10500.00,taxa:1.75, produto:"INSS - RECOMPRA",                 situacao:"PROPOSTA CADASTRADA",situacaoBanco:"INTEGRADA",     notes:"" },
  { id:"o12", date:"2025-04-01", partner:"p3", banco:"TOTALCASH",      operacao:"CARTÃO BENEFÍCIO",convenio:"INSS",     usuario:"Mariana Costa",         cpf:"333.444.555-66", cliente:"FRANCISCA OLIVEIRA",      proposta:"TOT0003456",    contrato:"TOT0003456",    prazo:0,  value:3200.00,  vrParcela:0,        vrLiquido:3200.00,  vrRepasse:3200.00, taxa:0,    produto:"CARTÃO BENEFÍCIO INSS",           situacao:"CONCRETIZADO",       situacaoBanco:"PAGO",          notes:"" },
];

const TODAY = new Date().toISOString().split("T")[0];

const SEED_PROPOSALS = [
  {
    id: "pr1", title: "Expansão de Contrato 2025", partner: "p1", value: 95000, type: "Renovação",
    priority: "Alta", dueDate: "2025-05-15", responsible: "Ana Lima", notes: "Cliente sinalizou interesse em ampliar escopo.",
    status: "Negociação",
    history: [
      { status: "Prospecção", date: "2025-03-01", note: "Primeiro contato realizado", user: "admin" },
      { status: "Proposta Enviada", date: "2025-03-10", note: "Proposta formal enviada por email", user: "admin" },
      { status: "Negociação", date: "2025-03-22", note: "Reunião de alinhamento de valores", user: "admin" },
    ],
  },
  {
    id: "pr2", title: "Novo Contrato Safra 2025/26", partner: "p2", value: 140000, type: "Contrato",
    priority: "Alta", dueDate: "2025-06-01", responsible: "Carlos Rocha", notes: "",
    status: "Proposta Enviada",
    history: [
      { status: "Prospecção", date: "2025-02-15", note: "Lead qualificado pela equipe comercial", user: "admin" },
      { status: "Proposta Enviada", date: "2025-03-05", note: "Proposta enviada aguardando retorno", user: "admin" },
    ],
  },
  {
    id: "pr3", title: "Parceria Financeira Q2", partner: "p3", value: 60000, type: "Parceria",
    priority: "Média", dueDate: "2025-04-30", responsible: "Mariana Costa", notes: "Decisor ainda em férias.",
    status: "Prospecção",
    history: [
      { status: "Prospecção", date: "2025-03-18", note: "Indicação de um cliente atual", user: "admin" },
    ],
  },
  {
    id: "pr4", title: "Venda Plano Retail Plus", partner: "p4", value: 28000, type: "Venda",
    priority: "Baixa", dueDate: "2025-05-10", responsible: "João Melo", notes: "",
    status: "Aprovação Interna",
    history: [
      { status: "Prospecção", date: "2025-02-20", note: "", user: "admin" },
      { status: "Proposta Enviada", date: "2025-02-28", note: "Proposta simplificada enviada", user: "admin" },
      { status: "Negociação", date: "2025-03-08", note: "Contraproposta do cliente recebida", user: "admin" },
      { status: "Aprovação Interna", date: "2025-03-20", note: "Aguardando aprovação da diretoria", user: "admin" },
    ],
  },
];

const STAGES = [
  { id: "Prospecção",        color: "#7C83FD", icon: "◎" },
  { id: "Proposta Enviada",  color: "#00C2FF", icon: "◈" },
  { id: "Negociação",        color: "#FFB830", icon: "◬" },
  { id: "Aprovação Interna", color: "#9B59B6", icon: "◆" },
  { id: "Fechado",           color: "#00FFB2", icon: "✦" },
  { id: "Perdido",           color: "#FF4D6A", icon: "✕" },
];

const PRIORITY_COLOR = { Alta: "#FF4D6A", Média: "#FFB830", Baixa: "#00FFB2" };

const C = {
  bg: "#070B14", surface: "#0D1526", card: "#111D35", border: "#1E3058",
  accent: "#00C2FF", accent2: "#00FFB2", warn: "#FFB830", danger: "#FF4D6A",
  text: "#E8F0FF", muted: "#5A7AA8",
};

const SITUACAO_COLOR = {
  "CONCRETIZADO":          "#00FFB2",
  "PAGO":                  "#00FFB2",
  "PAGO C/PENDÊNCIA":      "#FFB830",
  "PORTABILIDADE AVERBADA":"#00C2FF",
  "ANDAMENTO":             "#00C2FF",
  "PROPOSTA CADASTRADA":   "#7C83FD",
  "ANALISE BANCO":         "#FFB830",
  "EM ANALISE":            "#FFB830",
  "CRC CLIENTE":           "#FFB830",
  "CANCELADA":             "#FF4D6A",
  "ESTORNADO":             "#FF4D6A",
  "PROPOSTA REPROVADA":    "#FF4D6A",
};
const SIT_BANCO_COLOR = {
  "FINALIZADO":            "#00FFB2",
  "PAGO":                  "#00FFB2",
  "PAGO AO CLIENTE":       "#00FFB2",
  "PAGAMENTO REALIZADO":   "#00FFB2",
  "CONCRETIZADO":          "#00FFB2",
  "INTEGRADA":             "#00C2FF",
  "INTEGRADO":             "#00C2FF",
  "INT - FINALIZADO":      "#00C2FF",
  "INT - TED EMITIDA":     "#00C2FF",
  "Portabilidade Averbada":"#00C2FF",
  "EM ANALISE":            "#FFB830",
  "ANALISE BANCO":         "#FFB830",
  "TRATATIVA COMERCIAL":   "#FFB830",
  "TRATATIVA PARCEIROS":   "#FFB830",
  "aberto":                "#FFB830",
  "CANCELADO":             "#FF4D6A",
  "CANCELADA":             "#FF4D6A",
  "Cancelada":             "#FF4D6A",
  "NEGADA":                "#FF4D6A",
  "REPROVADO":             "#FF4D6A",
  "REPROVADA":             "#FF4D6A",
  "REPROVADO CRÉDITO":     "#FF4D6A",
  "REP - REPROVADO PELO BANCO":     "#FF4D6A",
  "REP - SOLICITADO PELO CORRETOR": "#FF4D6A",
};
const STATUS_COLOR = {
  "Concluída": "#00FFB2", "Em andamento": "#FFB830", "Cancelada": "#FF4D6A",
  "Ativo": "#00FFB2", "Inativo": "#FF4D6A",
};

const BANCOS_LIST    = ["QUALIBANKING","BRB","BRB - INCONTA","C6 BANK","CAPITAL CONSIG","CREFISACP","FACTA FINANCEIRA","INBURSA","LOTUS","NEOCREDITO","PAGBANK","PAN","PRATA DIGITAL","TOTALCASH","Outro"];
const OPERACOES_LIST = ["NOVO","PORTABILIDADE","PORTAB/REFIN","REFINANCIAMENTO","RECOMPRA","CARTÃO","CARTÃO BENEFÍCIO","Outro"];
const CONVENIOS_LIST = ["INSS","FGTS","FEDERAL","ESTADUAIS","PREFEITURAS","BAIXA RENDA","Outro"];
const SITUACOES_LIST = ["PROPOSTA CADASTRADA","ANDAMENTO","ANALISE BANCO","EM ANALISE","CRC CLIENTE","PORTABILIDADE AVERBADA","CONCRETIZADO","PAGO","PAGO C/PENDÊNCIA","ESTORNADO","CANCELADA","PROPOSTA REPROVADA"];
const SIT_BANCO_LIST = ["EM ANALISE","ANALISE BANCO","INTEGRADA","INTEGRADO","INT - FINALIZADO","INT - TED EMITIDA","FINALIZADO","PAGO","PAGO AO CLIENTE","PAGAMENTO REALIZADO","CONCRETIZADO","Portabilidade Averbada","TRATATIVA COMERCIAL","TRATATIVA PARCEIROS","CANCELADO","CANCELADA","NEGADA","REPROVADO","REPROVADA","REPROVADO CRÉDITO","REP - REPROVADO PELO BANCO","REP - SOLICITADO PELO CORRETOR"];

const fmtBRL = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const uid = () => Math.random().toString(36).slice(2, 9);
const stageColor = (s) => STAGES.find(x => x.id === s)?.color ?? C.muted;

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: ${C.surface}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  input, select, textarea { font-family: 'DM Sans', sans-serif; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .fade-in { animation: fadeIn .3s ease both; }
  .slide-in { animation: slideIn .3s ease both; }
`;

// ── Base components ───────────────────────────────────────────────────────────
function Pill({ label, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 9px",
      borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: .4,
      background: color + "20", color, border: `1px solid ${color}40`,
    }}>{label}</span>
  );
}

function Card({ children, style, onClick, hover }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hover && setHov(true)}
      onMouseLeave={() => hover && setHov(false)}
      style={{
        background: hov ? "#152040" : C.card,
        border: `1px solid ${hov ? C.accent + "55" : C.border}`,
        borderRadius: 14, padding: 20, transition: "all .18s",
        cursor: onClick ? "pointer" : "default", ...style,
      }}>{children}</div>
  );
}

function Input({ label, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</label>}
      <input {...props}
        onFocus={e => { setFocus(true); props.onFocus?.(e); }}
        onBlur={e => { setFocus(false); props.onBlur?.(e); }}
        style={{
          background: C.surface, border: `1px solid ${focus ? C.accent : C.border}`,
          borderRadius: 8, color: C.text, padding: "9px 12px", fontSize: 13,
          outline: "none", transition: "border .2s", ...props.style,
        }} />
    </div>
  );
}

function Sel({ label, options, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</label>}
      <select {...props} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.text, padding: "9px 12px", fontSize: 13, outline: "none", cursor: "pointer", ...props.style,
      }}>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </div>
  );
}

function Btn({ children, variant = "primary", ...props }) {
  const [hov, setHov] = useState(false);
  const s = {
    primary: { background: hov ? "#00A8E0" : C.accent, color: C.bg, border: "none" },
    ghost: { background: hov ? C.accent + "18" : "transparent", color: C.accent, border: `1px solid ${C.accent}44` },
    danger: { background: hov ? C.danger + "33" : C.danger + "18", color: C.danger, border: `1px solid ${C.danger}44` },
    success: { background: hov ? C.accent2 + "33" : C.accent2 + "18", color: C.accent2, border: `1px solid ${C.accent2}44` },
    muted: { background: hov ? C.border : "transparent", color: C.muted, border: `1px solid ${C.border}` },
  };
  return (
    <button {...props}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: "8px 18px", borderRadius: 8, fontFamily: "DM Sans", fontWeight: 600,
        fontSize: 13, cursor: "pointer", transition: "all .15s", ...s[variant], ...props.style,
      }}>{children}</button>
  );
}

function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000BB", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div className="fade-in" onClick={e => e.stopPropagation()} style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
        padding: 28, width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = C.accent, icon }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 14, right: 16, fontSize: 22, opacity: .12 }}>{icon}</div>
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 26, fontFamily: "Syne", fontWeight: 800, color }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: C.muted }}>{sub}</span>}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
    </Card>
  );
}

function BarChart({ data, height = 140 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingTop: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div title={fmtBRL(d.value)} style={{
            width: "100%", borderRadius: "4px 4px 0 0",
            height: `${(d.value / max) * (height - 30)}px`,
            background: `linear-gradient(180deg, ${C.accent}, ${C.accent}88)`,
            transition: "height .5s ease", minHeight: 2,
          }} />
          <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Proposal Form ─────────────────────────────────────────────────────────────
function ProposalForm({ form, setForm, partners }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Input label="Título da Proposta *" value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Renovação Contrato 2025" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Sel label="Parceiro *" value={form.partner}
          onChange={e => setForm(f => ({ ...f, partner: e.target.value }))}
          options={[{ value: "", label: "Selecione..." }, ...partners.map(p => ({ value: p.id, label: p.name }))]} />
        <Input label="Valor (R$)" type="number" value={form.value}
          onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0.00" />
        <Sel label="Tipo" value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          options={["Venda", "Contrato", "Renovação", "Parceria", "Outro"]} />
        <Sel label="Prioridade" value={form.priority}
          onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
          options={["Alta", "Média", "Baixa"]} />
        <Input label="Prazo" type="date" value={form.dueDate}
          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        <Input label="Responsável" value={form.responsible}
          onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))} placeholder="Nome" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Observações</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2} placeholder="Notas, contexto, próximos passos..."
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text, padding: "9px 12px", fontSize: 13, outline: "none",
            resize: "vertical", fontFamily: "DM Sans",
          }} />
      </div>
    </div>
  );
}

// ── Proposal Detail Panel ─────────────────────────────────────────────────────
function ProposalDetail({ proposal, partners, onClose, onSave, onDelete, currentUser }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...proposal });
  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState(proposal.status);
  const [confirm, setConfirm] = useState(false);
  const partner = partners.find(p => p.id === proposal.partner);
  const sc = stageColor(proposal.status);
  const overdue = proposal.dueDate && proposal.dueDate < TODAY && !["Fechado", "Perdido"].includes(proposal.status);

  const handleStatusUpdate = () => {
    if (!newStatus || newStatus === proposal.status) return;
    const entry = {
      status: newStatus, date: TODAY,
      note: newNote.trim() || `Status atualizado para "${newStatus}"`,
      user: currentUser,
    };
    const updated = { ...proposal, status: newStatus, history: [...(proposal.history || []), entry] };
    onSave(updated);
    setNewNote("");
  };

  const handleEdit = () => { onSave({ ...form, value: Number(form.value) }); setEditMode(false); };

  return (
    <div className="slide-in" style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 480,
      background: C.surface, borderLeft: `1px solid ${C.border}`,
      display: "flex", flexDirection: "column", zIndex: 150, overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
        background: C.card, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
              <Pill label={proposal.status} color={sc} />
              <Pill label={proposal.priority} color={PRIORITY_COLOR[proposal.priority]} />
              {overdue && <Pill label="Atrasado" color={C.danger} />}
            </div>
            <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{proposal.title}</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{partner?.name} · {proposal.type}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", flexShrink: 0 }}>×</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
        {/* Key info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["Valor", fmtBRL(proposal.value), C.accent2],
            ["Prazo", fmtDate(proposal.dueDate), overdue ? C.danger : C.text],
            ["Responsável", proposal.responsible || "—", C.text],
            ["Segmento", partner?.segment || "—", C.text],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: C.card, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 3 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
        </div>

        {proposal.notes && (
          <div style={{ background: C.card, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 4 }}>OBSERVAÇÕES</div>
            <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{proposal.notes}</p>
          </div>
        )}

        {/* ── Status Update ── */}
        <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.accent}33` }}>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>↑ ATUALIZAR STATUS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {STAGES.map(s => (
              <button key={s.id} onClick={() => setNewStatus(s.id)} style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: `1px solid ${newStatus === s.id ? s.color : C.border}`,
                background: newStatus === s.id ? s.color + "25" : "transparent",
                color: newStatus === s.id ? s.color : C.muted, cursor: "pointer", transition: "all .15s",
              }}>{s.icon} {s.id}</button>
            ))}
          </div>
          <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
            placeholder="Nota sobre esta atualização (opcional)..."
            rows={2} style={{
              width: "100%", background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.text, padding: "8px 10px", fontSize: 12,
              outline: "none", resize: "vertical", fontFamily: "DM Sans", marginBottom: 10,
            }} />
          <Btn
            onClick={handleStatusUpdate}
            variant={newStatus !== proposal.status ? "primary" : "muted"}
            style={{ width: "100%", padding: "9px 0" }}>
            {newStatus !== proposal.status ? `→ Mover para "${newStatus}"` : "Selecione um novo status acima"}
          </Btn>
        </div>

        {/* ── History ── */}
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 14, letterSpacing: 1 }}>HISTÓRICO</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[...(proposal.history || [])].reverse().map((h, i, arr) => {
              const sc2 = stageColor(h.status);
              return (
                <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: sc2 + "25", border: `2px solid ${sc2}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: sc2, flexShrink: 0, fontWeight: 700,
                    }}>{STAGES.find(s => s.id === h.status)?.icon ?? "•"}</div>
                    {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingTop: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sc2 }}>{h.status}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(h.date)}</span>
                    </div>
                    {h.note && <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{h.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 24px", borderTop: `1px solid ${C.border}`,
        display: "flex", gap: 8, background: C.card, position: "sticky", bottom: 0,
      }}>
        <Btn variant="ghost" onClick={() => { setForm({ ...proposal }); setEditMode(true); }} style={{ flex: 1 }}>✏ Editar</Btn>
        <Btn variant="danger" onClick={() => setConfirm(true)}>🗑</Btn>
      </div>

      <Modal open={editMode} onClose={() => setEditMode(false)} title="Editar Proposta" width={500}>
        <ProposalForm form={form} setForm={setForm} partners={partners} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Btn>
          <Btn onClick={handleEdit}>Salvar Alterações</Btn>
        </div>
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Excluir Proposta?" width={360}>
        <p style={{ fontSize: 13, color: C.muted }}>
          Deseja excluir <strong style={{ color: C.text }}>{proposal.title}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Btn>
          <Btn variant="danger" onClick={() => { onDelete(proposal.id); onClose(); }}>Excluir</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── Proposals View ────────────────────────────────────────────────────────────
// ── Import Modal ──────────────────────────────────────────────────────────────
// Uses SheetJS (loaded via CDN script tag injected once)
function useSheetJS() {
  const [ready, setReady] = useState(!!window.XLSX);
  useEffect(() => {
    if (window.XLSX) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

const IMPORT_FIELDS = [
  { key: "date",          label: "DATA",             required: true  },
  { key: "partner",       label: "AGENTE",           required: true  },
  { key: "banco",         label: "BANCO",            required: false },
  { key: "operacao",      label: "OPERAÇÃO",         required: false },
  { key: "convenio",      label: "CONVÊNIO",         required: false },
  { key: "usuario",       label: "USUÁRIO",          required: false },
  { key: "cpf",           label: "CPF",              required: false },
  { key: "cliente",       label: "CLIENTE",          required: false },
  { key: "proposta",      label: "PROPOSTA",         required: false },
  { key: "contrato",      label: "Nº CONTRATO",      required: false },
  { key: "prazo",         label: "PRAZO",            required: false },
  { key: "value",         label: "VR. BRUTO",        required: false },
  { key: "vrParcela",     label: "VR. PARCELA",      required: false },
  { key: "vrLiquido",     label: "VR. LÍQUIDO",      required: false },
  { key: "vrRepasse",     label: "VR. REPASSE",      required: false },
  { key: "taxa",          label: "TAXA",             required: false },
  { key: "produto",       label: "PRODUTO",          required: false },
  { key: "situacao",      label: "SITUAÇÃO",         required: false },
  { key: "situacaoBanco", label: "SITUAÇÃO BANCO",   required: false },
  { key: "notes",         label: "OBS. SITUAÇÃO BANCO", required: false },
];

const VALID_STAGES   = STAGES.map(s => s.id);
const VALID_TYPES    = ["Venda","Contrato","Renovação","Parceria","Outro"];
const VALID_PRIORITY = ["Alta","Média","Baixa"];

function normalizeStatus(v) {
  if (!v) return "Prospecção";
  const map = { "prospecção":"Prospecção","prospeccao":"Prospecção","prospection":"Prospecção",
    "proposta enviada":"Proposta Enviada","enviada":"Proposta Enviada","sent":"Proposta Enviada",
    "negociação":"Negociação","negociacao":"Negociação","negotiation":"Negociação",
    "aprovação interna":"Aprovação Interna","aprovacao interna":"Aprovação Interna","approval":"Aprovação Interna",
    "fechado":"Fechado","won":"Fechado","closed":"Fechado",
    "perdido":"Perdido","lost":"Perdido","cancelled":"Perdido" };
  return map[String(v).toLowerCase().trim()] ?? (VALID_STAGES.includes(v) ? v : "Prospecção");
}
function normalizePriority(v) {
  if (!v) return "Média";
  const map = { "alta":"Alta","high":"Alta","média":"Média","media":"Média","medium":"Média","baixa":"Baixa","low":"Baixa" };
  return map[String(v).toLowerCase().trim()] ?? (VALID_PRIORITY.includes(v) ? v : "Média");
}
function normalizeType(v) {
  if (!v) return "Venda";
  const found = VALID_TYPES.find(t => t.toLowerCase() === String(v).toLowerCase().trim());
  return found ?? "Outro";
}
function normalizeDate(v) {
  if (!v) return "";
  // Excel serial number
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().split("T")[0];
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? "20"+m[3] : m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

function ImportModal({ open, onClose, partners, onImport, currentUser }) {
  const xlsxReady = useSheetJS();
  const fileRef = useRef();
  const [step, setStep] = useState(1); // 1=upload  2=map  3=preview
  const [rawRows, setRawRows] = useState([]);    // array of objects from sheet
  const [headers, setHeaders] = useState([]);    // column names from file
  const [mapping, setMapping] = useState({});    // fieldKey -> colName
  const [preview, setPreview] = useState([]);    // parsed proposals ready to import
  const [errors, setErrors] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => { setStep(1); setRawRows([]); setHeaders([]); setMapping({}); setPreview([]); setErrors([]); setFileName(""); };

  const parseFile = (file) => {
    if (!xlsxReady || !window.XLSX) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) { setErrors(["Planilha vazia ou sem cabeçalho"]); return; }
        setRawRows(rows);
        const cols = Object.keys(rows[0]);
        setHeaders(cols);
        // Auto-detect mapping by matching real spreadsheet column names
        const autoMap = {};
        IMPORT_FIELDS.forEach(f => {
          const found = cols.find(c => {
            const cl = c.toLowerCase().trim().replace(/[º°]/g,"");
            const fl = f.label.toLowerCase().replace(/[º°]/g,"");
            const fk = f.key.toLowerCase();
            return cl === fl || cl === fk ||
              (f.key==="date"         && (cl==="data"||cl==="dat.inclusão"||cl==="dat inclusao")) ||
              (f.key==="partner"      && (cl==="agente"||cl==="parceiro"||cl==="corretor")) ||
              (f.key==="banco"        && cl==="banco") ||
              (f.key==="operacao"     && (cl==="operação"||cl==="operacao"||cl==="tp. operação banco")) ||
              (f.key==="convenio"     && (cl==="convênio"||cl==="convenio")) ||
              (f.key==="usuario"      && (cl==="usuário"||cl==="usuario"||cl==="digitador")) ||
              (f.key==="cpf"          && cl==="cpf") ||
              (f.key==="cliente"      && cl==="cliente") ||
              (f.key==="proposta"     && cl==="proposta") ||
              (f.key==="contrato"     && (cl==="n contrato"||cl==="contrato"||cl==="n° contrato")) ||
              (f.key==="prazo"        && cl==="prazo") ||
              (f.key==="value"        && (cl==="vr. bruto"||cl==="valor bruto"||cl==="vr bruto")) ||
              (f.key==="vrParcela"    && (cl==="vr. parcela"||cl==="parcela")) ||
              (f.key==="vrLiquido"    && (cl==="vr. líquido"||cl==="vr liquido"||cl==="vlr líquido")) ||
              (f.key==="vrRepasse"    && (cl==="vr. repasse"||cl==="repasse")) ||
              (f.key==="taxa"         && cl==="taxa") ||
              (f.key==="produto"      && (cl==="produto"||cl==="prod. banco")) ||
              (f.key==="situacao"     && (cl==="situação"||cl==="situacao")) ||
              (f.key==="situacaoBanco"&& (cl==="situação banco"||cl==="situacao banco")) ||
              (f.key==="notes"        && (cl==="obs. situação banco"||cl==="observações"||cl==="obs"));
          });
          if (found) autoMap[f.key] = found;
        });
        setMapping(autoMap);
        setStep(2);
      } catch (err) {
        setErrors(["Erro ao ler arquivo: " + err.message]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFile = (e) => { const f = e.target.files[0]; if (f) parseFile(f); };
  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  };

  const buildPreview = () => {
    const errs = [];
    const built = rawRows.map((row, i) => {
      const dateCol    = mapping.date;
      const partnerCol = mapping.partner;
      const dateRaw    = dateCol ? row[dateCol] : "";
      const partnerRaw = partnerCol ? String(row[partnerCol] || "").trim() : "";
      const dateStr    = normalizeDate(dateRaw);

      if (!dateStr) errs.push(`Linha ${i + 2}: "DATA" inválida ou vazia`);

      const matchedPartner = partners.find(p =>
        p.name.toLowerCase().trim() === partnerRaw.toLowerCase() ||
        p.name.toLowerCase().includes(partnerRaw.toLowerCase()) ||
        partnerRaw.toLowerCase().includes(p.name.toLowerCase().split(" ")[0].toLowerCase())
      );

      const getVal = (key) => mapping[key] ? row[mapping[key]] : "";
      const numVal = (key) => parseFloat(String(getVal(key)).replace(/[R$\s.]/g,"").replace(",",".")) || 0;

      return {
        _row: i + 2,
        _partnerRaw: partnerRaw,
        _partnerMatched: matchedPartner ?? null,
        id:           uid(),
        date:         dateStr,
        partner:      matchedPartner?.id ?? "",
        banco:        String(getVal("banco")||"").trim(),
        operacao:     String(getVal("operacao")||"").trim(),
        convenio:     String(getVal("convenio")||"").trim(),
        usuario:      String(getVal("usuario")||"").trim(),
        cpf:          String(getVal("cpf")||"").trim(),
        cliente:      String(getVal("cliente")||"").trim(),
        proposta:     String(getVal("proposta")||"").trim(),
        contrato:     String(getVal("contrato")||"").trim(),
        prazo:        numVal("prazo"),
        value:        numVal("value"),
        vrParcela:    numVal("vrParcela"),
        vrLiquido:    numVal("vrLiquido"),
        vrRepasse:    numVal("vrRepasse"),
        taxa:         numVal("taxa"),
        produto:      String(getVal("produto")||"").trim(),
        situacao:     String(getVal("situacao")||"PROPOSTA CADASTRADA").trim(),
        situacaoBanco:String(getVal("situacaoBanco")||"EM ANALISE").trim(),
        notes:        String(getVal("notes")||"").trim(),
      };
    });
    setErrors(errs);
    setPreview(built);
    setStep(3);
  };

  const handleImport = () => {
    const valid = preview.filter(p => p.date && p.partner);
    onImport(valid);
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    if (!xlsxReady || !window.XLSX) return;
    const ws = window.XLSX.utils.aoa_to_sheet([
      ["DATA","AGENTE","BANCO","OPERAÇÃO","CONVÊNIO","USUÁRIO","CPF","CLIENTE","PROPOSTA","Nº CONTRATO","PRAZO","VR. BRUTO","VR. PARCELA","VR. LÍQUIDO","VR. REPASSE","TAXA","PRODUTO","SITUAÇÃO","SITUAÇÃO BANCO","OBS. SITUAÇÃO BANCO"],
      ["2025-01-31","NEWS NEGOCIOS ADMINISTRATIVOS","QUALIBANKING","NOVO","INSS","Bruno Bortoli","015.566.609-60","ELIZABETH RODRIGUES","QUA0000556121","QUA0000556121",84,9205.32,217.79,7978.97,7978.97,1.80,"TOP PLUS - TX 1,80%","ESTORNADO","FINALIZADO",""],
      ["2025-02-10","CENTRAL BANCARIA","PAN","REFINANCIAMENTO","INSS","Ana Lima","260.535.018-59","ANDREA CARDOSO","PAN0001234","PAN0001234",72,15000.00,280.50,13200.00,13200.00,1.75,"INSS REFIN","CONCRETIZADO","PAGO",""],
    ]);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Digitações");
    window.XLSX.writeFile(wb, "modelo_digitacoes.xlsx");
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000CC", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="fade-in" onClick={e => e.stopPropagation()} style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
        width: 700, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16 }}>Importar Propostas em Lote</h3>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {["Upload", "Mapear Colunas", "Revisar e Importar"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step > i + 1 ? C.accent2 : step === i + 1 ? C.accent : C.border,
                    color: step >= i + 1 ? C.bg : C.muted,
                  }}>{step > i + 1 ? "✓" : i + 1}</div>
                  <span style={{ fontSize: 12, color: step === i + 1 ? C.text : C.muted, fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
                  {i < 2 && <span style={{ color: C.border, fontSize: 12 }}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: "20px 24px", flex: 1 }}>
          {/* STEP 1 — Upload */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragActive ? C.accent : C.border}`,
                  borderRadius: 14, padding: "40px 24px", textAlign: "center",
                  background: dragActive ? C.accent + "08" : C.surface,
                  cursor: "pointer", transition: "all .2s",
                }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {xlsxReady ? "Arraste ou clique para selecionar" : "Carregando leitor de planilhas..."}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>Suporta .xlsx, .xls e .csv</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: "none" }} />
              </div>
              {errors.length > 0 && errors.map((e, i) => (
                <div key={i} style={{ background: C.danger + "18", border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.danger }}>{e}</div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>📥 Baixar modelo de planilha</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Use o modelo para garantir a importação correta</div>
                </div>
                <Btn variant="ghost" onClick={downloadTemplate} style={{ fontSize: 12 }}>Baixar .xlsx</Btn>
              </div>
              <div style={{ background: C.surface, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.border}`, fontSize: 12, color: C.muted }}>
                <strong style={{ color: C.text }}>Colunas reconhecidas automaticamente:</strong>
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {IMPORT_FIELDS.map(f => (
                    <span key={f.key} style={{ background: C.border + "88", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>
                      {f.label}{f.required ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Map columns */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}`, fontSize: 12, color: C.muted }}>
                Arquivo: <strong style={{ color: C.text }}>{fileName}</strong> · {rawRows.length} linha(s) encontrada(s)
              </div>
              <p style={{ fontSize: 13, color: C.muted }}>Mapeie as colunas da sua planilha para os campos do sistema. Campos detectados automaticamente estão pré-preenchidos.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {IMPORT_FIELDS.map(f => (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, color: f.required ? C.accent : C.muted, fontWeight: 600 }}>
                      {f.label}{f.required ? " *" : ""}
                    </label>
                    <select value={mapping[f.key] ?? ""} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                      style={{ background: C.surface, border: `1px solid ${mapping[f.key] ? C.accent + "66" : C.border}`, borderRadius: 8, color: mapping[f.key] ? C.text : C.muted, padding: "8px 10px", fontSize: 12, outline: "none", cursor: "pointer" }}>
                      <option value="">— Ignorar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ background: C.surface, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>PRÉ-VISUALIZAÇÃO (2 primeiras linhas)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr>{Object.keys(rawRows[0] || {}).map(h => (
                      <th key={h} style={{ padding: "4px 8px", textAlign: "left", color: C.muted, whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}</tr></thead>
                    <tbody>{rawRows.slice(0, 2).map((r, i) => (
                      <tr key={i}>{Object.values(r).map((v, j) => (
                        <td key={j} style={{ padding: "4px 8px", color: C.text, whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` }}>{String(v)}</td>
                      ))}</tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Preview */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {errors.length > 0 && (
                <div style={{ background: C.warn + "18", border: `1px solid ${C.warn}44`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.warn, marginBottom: 4 }}>⚠ {errors.length} aviso(s)</div>
                  {errors.slice(0, 4).map((e, i) => <div key={i} style={{ fontSize: 11, color: C.warn }}>{e}</div>)}
                </div>
              )}
              <div style={{ fontSize: 13, color: C.muted }}>
                <strong style={{ color: C.accent2 }}>{preview.filter(p => p.date && p.partner).length}</strong> registro(s) prontos para importar
                {preview.filter(p => !p.date || !p.partner).length > 0 && (
                  <span style={{ color: C.danger }}> · {preview.filter(p => !p.date || !p.partner).length} serão ignorados (sem data ou agente)</span>
                )}
              </div>
              <div style={{ overflowX: "auto", maxHeight: 320 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: C.surface }}>
                      {["", "Data", "Agente", "Banco", "Operação", "Cliente", "VR. Bruto", "Situação", "Sit. Banco"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => {
                      const ok = p.date && p.partner;
                      return (
                        <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: ok ? "transparent" : C.danger + "08" }}>
                          <td style={{ padding: "8px 12px" }}>
                            {ok ? <span style={{ color: C.accent2, fontSize: 14 }}>✓</span> : <span style={{ color: C.danger, fontSize: 14 }}>✕</span>}
                          </td>
                          <td style={{ padding: "8px 12px", color: C.muted }}>{p.date||"—"}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 500, color: ok ? C.text : C.danger }}>
                            {p._partnerMatched ? p._partnerMatched.name : <span style={{ color: C.danger }}>"{p._partnerRaw}" não encontrado</span>}
                          </td>
                          <td style={{ padding: "8px 12px", color: C.muted }}>{p.banco||"—"}</td>
                          <td style={{ padding: "8px 12px", color: C.muted }}>{p.operacao||"—"}</td>
                          <td style={{ padding: "8px 12px" }}>{p.cliente||"—"}</td>
                          <td style={{ padding: "8px 12px", color: C.accent2, fontWeight: 600 }}>{fmtBRL(p.value)}</td>
                          <td style={{ padding: "8px 12px" }}><Pill label={p.situacao||"—"} color={SITUACAO_COLOR[p.situacao]??C.muted} /></td>
                          <td style={{ padding: "8px 12px" }}><Pill label={p.situacaoBanco||"—"} color={SIT_BANCO_COLOR[p.situacaoBanco]??C.muted} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            {step > 1 && <Btn variant="muted" onClick={() => setStep(s => s - 1)}>← Voltar</Btn>}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Btn>
            {step === 1 && <Btn variant="muted" onClick={() => fileRef.current?.click()}>Selecionar arquivo</Btn>}
            {step === 2 && <Btn onClick={buildPreview} variant={mapping.title && mapping.partner ? "primary" : "muted"}>Revisar →</Btn>}
            {step === 3 && (
              <Btn onClick={handleImport} variant="success" style={{ padding: "8px 24px" }}>
                ✓ Importar {preview.filter(p => p.date && p.partner).length} registro(s)
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const BLANK_PROPOSAL = {
  id: "", title: "", partner: "", value: "", type: "Venda",
  priority: "Média", dueDate: "", responsible: "", notes: "",
  status: "Prospecção", history: [],
};

function Proposals({ proposals, setProposals, partners, currentUser }) {
  const [viewMode, setViewMode] = useState("kanban");
  const [selected, setSelected] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState(BLANK_PROPOSAL);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("Todas");
  const [dragOver, setDragOver] = useState(null);
  const [importModal, setImportModal] = useState(false);
  const dragId = useRef(null);

  const filtered = proposals.filter(p => {
    const partner = partners.find(x => x.id === p.partner);
    const q = search.toLowerCase();
    return (!q || p.title.toLowerCase().includes(q) || partner?.name.toLowerCase().includes(q))
      && (filterPriority === "Todas" || p.priority === filterPriority);
  });

  const handleNew = () => {
    if (!form.title || !form.partner) return;
    const entry = { status: form.status, date: TODAY, note: "Proposta criada", user: currentUser };
    const np = { ...form, id: uid(), value: Number(form.value) || 0, history: [entry] };
    setProposals(prev => [...prev, np]);
    setForm(BLANK_PROPOSAL);
    setNewModal(false);
  };

  const handleSave = (updated) => {
    setProposals(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelected(updated);
  };

  const handleDelete = (id) => { setProposals(prev => prev.filter(p => p.id !== id)); };

  const handleImportBatch = (newProps) => {
    setProposals(prev => [...prev, ...newProps]);
  };

  const onDrop = (stageId) => {
    if (!dragId.current) return;
    const prop = proposals.find(p => p.id === dragId.current);
    if (!prop || prop.status === stageId) { dragId.current = null; setDragOver(null); return; }
    const entry = { status: stageId, date: TODAY, note: `Movido para "${stageId}"`, user: currentUser };
    const updated = { ...prop, status: stageId, history: [...(prop.history || []), entry] };
    setProposals(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selected?.id === updated.id) setSelected(updated);
    setDragOver(null); dragId.current = null;
  };

  const openPipeline = proposals.filter(p => !["Fechado", "Perdido"].includes(p.status)).reduce((a, p) => a + (p.value || 0), 0);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700 }}>Propostas</h2>
          <p style={{ color: C.muted, fontSize: 13 }}>
            {proposals.length} proposta(s) · Pipeline aberto: <strong style={{ color: C.accent2 }}>{fmtBRL(openPipeline)}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {[["kanban", "⬡ Kanban"], ["list", "☰ Lista"]].map(([m, lbl]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{
                padding: "7px 14px", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: viewMode === m ? C.accent + "22" : "transparent",
                color: viewMode === m ? C.accent : C.muted, transition: "all .15s",
              }}>{lbl}</button>
            ))}
          </div>
          <Btn variant="ghost" onClick={() => setImportModal(true)}>⬆ Importar Planilha</Btn>
          <Btn onClick={() => { setForm(BLANK_PROPOSAL); setNewModal(true); }}>+ Nova Proposta</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar proposta ou parceiro..."
          style={{ flex: 1, minWidth: 200, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none" }} />
        {["Todas", "Alta", "Média", "Baixa"].map(p => (
          <button key={p} onClick={() => setFilterPriority(p)} style={{
            padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${filterPriority === p ? (PRIORITY_COLOR[p] ?? C.accent) : C.border}`,
            background: filterPriority === p ? (PRIORITY_COLOR[p] ?? C.accent) + "22" : "transparent",
            color: filterPriority === p ? (PRIORITY_COLOR[p] ?? C.accent) : C.muted,
          }}>{p}</button>
        ))}
      </div>

      {/* KANBAN */}
      {viewMode === "kanban" && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, minHeight: 440 }}>
          {STAGES.map(stage => {
            const cols = filtered.filter(p => p.status === stage.id);
            const colVal = cols.reduce((a, p) => a + (p.value || 0), 0);
            const isOver = dragOver === stage.id;
            return (
              <div key={stage.id}
                onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(stage.id)}
                style={{
                  minWidth: 218, maxWidth: 232, flexShrink: 0,
                  background: isOver ? stage.color + "12" : C.surface,
                  border: `1px solid ${isOver ? stage.color + "66" : C.border}`,
                  borderRadius: 14, display: "flex", flexDirection: "column",
                  transition: "all .15s",
                }}>
                <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: stage.color }}>{stage.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.id}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{cols.length}</span>
                </div>
                {colVal > 0 && (
                  <div style={{ padding: "4px 14px", background: stage.color + "10", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: stage.color, fontWeight: 600 }}>{fmtBRL(colVal)}</span>
                  </div>
                )}
                <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  {cols.map(p => {
                    const partner = partners.find(x => x.id === p.partner);
                    const overdue = p.dueDate && p.dueDate < TODAY && !["Fechado", "Perdido"].includes(p.status);
                    return (
                      <div key={p.id}
                        draggable
                        onDragStart={() => { dragId.current = p.id; }}
                        onClick={() => setSelected(p)}
                        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", cursor: "grab", userSelect: "none", transition: "border .15s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = stage.color + "66"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{p.title}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 7 }}>{partner?.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: C.accent2, fontWeight: 700 }}>{fmtBRL(p.value)}</span>
                          <Pill label={p.priority} color={PRIORITY_COLOR[p.priority]} />
                        </div>
                        {p.dueDate && (
                          <div style={{ fontSize: 10, color: overdue ? C.danger : C.muted, marginTop: 5 }}>
                            {overdue ? "⚠ " : ""}Prazo: {fmtDate(p.dueDate)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cols.length === 0 && (
                    <div style={{ flex: 1, minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center", color: C.border, fontSize: 11, border: `1px dashed ${C.border}`, borderRadius: 8, margin: 4 }}>
                      Arraste aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST */}
      {viewMode === "list" && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surface }}>
                {["Proposta", "Parceiro", "Valor", "Status", "Prioridade", "Prazo", "Responsável"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "11px 16px", fontSize: 11, color: C.muted, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.muted }}>Nenhuma proposta encontrada</td></tr>}
              {filtered.map(p => {
                const partner = partners.find(x => x.id === p.partner);
                const overdue = p.dueDate && p.dueDate < TODAY && !["Fechado", "Perdido"].includes(p.status);
                return (
                  <tr key={p.id} onClick={() => setSelected(p)}
                    style={{ borderTop: `1px solid ${C.border}`, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surface}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "11px 16px", fontWeight: 600 }}>{p.title}</td>
                    <td style={{ color: C.muted }}>{partner?.name ?? "—"}</td>
                    <td style={{ color: C.accent2, fontWeight: 700 }}>{fmtBRL(p.value)}</td>
                    <td><Pill label={p.status} color={stageColor(p.status)} /></td>
                    <td><Pill label={p.priority} color={PRIORITY_COLOR[p.priority]} /></td>
                    <td style={{ color: overdue ? C.danger : C.muted, fontSize: 12 }}>{overdue ? "⚠ " : ""}{fmtDate(p.dueDate)}</td>
                    <td style={{ color: C.muted }}>{p.responsible || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* New modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title="Nova Proposta">
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Estágio Inicial</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STAGES.slice(0, 4).map(s => (
              <button key={s.id} onClick={() => setForm(f => ({ ...f, status: s.id }))} style={{
                padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${form.status === s.id ? s.color : C.border}`,
                background: form.status === s.id ? s.color + "25" : "transparent",
                color: form.status === s.id ? s.color : C.muted,
              }}>{s.icon} {s.id}</button>
            ))}
          </div>
        </div>
        <ProposalForm form={form} setForm={setForm} partners={partners} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setNewModal(false)}>Cancelar</Btn>
          <Btn onClick={handleNew}>Criar Proposta</Btn>
        </div>
      </Modal>

      {/* Import modal */}
      <ImportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        partners={partners}
        onImport={handleImportBatch}
        currentUser={currentUser}
      />

      {/* Detail panel */}
      {selected && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "#00000050", zIndex: 140 }} onClick={() => setSelected(null)} />
          <ProposalDetail
            proposal={selected} partners={partners}
            onClose={() => setSelected(null)} onSave={handleSave}
            onDelete={(id) => { handleDelete(id); setSelected(null); }}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ ops, partners, proposals }) {
  const concluded = ops.filter(o => o.status === "Concluída");
  const totalRev = concluded.reduce((a, o) => a + o.value, 0);
  const pipeline = proposals.filter(p => !["Fechado", "Perdido"].includes(p.status)).reduce((a, p) => a + (p.value || 0), 0);
  const activePartners = partners.filter(p => p.status === "Ativo").length;
  const convRate = ops.length > 0 ? ((concluded.length / ops.length) * 100).toFixed(1) : 0;

  const nowDate = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    return { month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleString("pt-BR", { month: "short" }) };
  });
  const monthlyData = months.map(m => ({
    label: m.label,
    value: concluded.filter(o => { const d = new Date(o.date); return d.getMonth() === m.month && d.getFullYear() === m.year; })
      .reduce((a, o) => a + o.value, 0),
  }));

  const partnerRev = partners.map(p => ({
    ...p,
    revenue: concluded.filter(o => o.partner === p.id).reduce((a, o) => a + o.value, 0),
    ops: ops.filter(o => o.partner === p.id).length,
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const recentOps = [...ops].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700 }}>Dashboard</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Visão geral de operações e performance</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <StatCard label="Receita Total" value={fmtBRL(totalRev)} sub="Operações concluídas" color={C.accent2} icon="💰" />
        <StatCard label="Pipeline" value={fmtBRL(pipeline)} sub="Propostas em aberto" color={C.accent} icon="📊" />
        <StatCard label="Parceiros Ativos" value={activePartners} sub={`de ${partners.length} total`} icon="🤝" />
        <StatCard label="Taxa de Conversão" value={`${convRate}%`} sub="das operações" color={C.warn} icon="📈" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Receita Mensal</h3>
          <BarChart data={monthlyData} />
        </Card>
        <Card>
          <h3 style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Top Parceiros</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {partnerRev.map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.muted, width: 14 }}>#{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.ops} ops</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: C.accent2, fontWeight: 600 }}>{fmtBRL(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <h3 style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Operações Recentes</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ color: C.muted, fontSize: 11 }}>
            {["Data", "Parceiro", "Tipo", "Valor", "Status"].map(h => (
              <th key={h} style={{ textAlign: "left", paddingBottom: 8, fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {recentOps.map(o => {
              const p = partners.find(x => x.id === o.partner);
              return (
                <tr key={o.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "8px 0" }}>{fmtDate(o.date)}</td>
                  <td>{p?.name ?? "—"}</td>
                  <td>{o.type}</td>
                  <td style={{ color: C.accent2, fontWeight: 600 }}>{fmtBRL(o.value)}</td>
                  <td><Pill label={o.status} color={STATUS_COLOR[o.status] ?? C.muted} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Export Modal ──────────────────────────────────────────────────────────────
function ExportModal({ open, onClose, ops, partners }) {
  const [filters, setFilters] = useState({ banco:"", operacao:"", convenio:"", agente:"", situacaoBanco:"", parceiro:"", dateFrom:"", dateTo:"" });
  const setF = (k,v) => setFilters(f=>({...f,[k]:v}));

  useEffect(() => {
    if (open && !window.XLSX) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.head.appendChild(s);
    }
  }, [open]);

  const allBancos    = [...new Set(ops.map(o=>o.banco).filter(Boolean))].sort();
  const allOps       = [...new Set(ops.map(o=>o.type).filter(Boolean))].sort();
  const allConvenios = [...new Set(ops.map(o=>o.convenio).filter(Boolean))].sort();
  const allAgentes   = [...new Set(ops.map(o=>o.agente).filter(Boolean))].sort();
  const allSituacoes = [...new Set(ops.map(o=>o.situacaoBanco).filter(Boolean))].sort();

  const filtered = ops.filter(o =>
    (!filters.banco        || o.banco===filters.banco) &&
    (!filters.operacao     || o.operacao===filters.operacao) &&
    (!filters.convenio     || o.convenio===filters.convenio) &&
    (!filters.situacao     || o.situacao===filters.situacao) &&
    (!filters.situacaoBanco|| o.situacaoBanco===filters.situacaoBanco) &&
    (!filters.parceiro     || o.partner===filters.parceiro) &&
    (!filters.dateFrom     || o.date>=filters.dateFrom) &&
    (!filters.dateTo       || o.date<=filters.dateTo)
  );

  const doExport = () => {
    if (!window.XLSX) { alert("Aguarde, carregando exportador..."); return; }
    const rows = filtered.map(o => {
      const p = partners.find(x=>x.id===o.partner);
      return {
        "DATA":              o.date,
        "AGENTE":            p?.name??"",
        "BANCO":             o.banco??"",
        "OPERAÇÃO":          o.operacao??"",
        "CONVÊNIO":          o.convenio??"",
        "USUÁRIO":           o.usuario??"",
        "CPF":               o.cpf??"",
        "CLIENTE":           o.cliente??"",
        "PROPOSTA":          o.proposta??"",
        "Nº CONTRATO":       o.contrato??"",
        "PRAZO":             o.prazo??"",
        "VR. BRUTO":         o.value,
        "VR. PARCELA":       o.vrParcela??"",
        "VR. LÍQUIDO":       o.vrLiquido??"",
        "VR. REPASSE":       o.vrRepasse??"",
        "TAXA":              o.taxa??"",
        "PRODUTO":           o.produto??"",
        "SITUAÇÃO":          o.situacao??"",
        "SITUAÇÃO BANCO":    o.situacaoBanco??"",
        "OBSERVAÇÕES":       o.notes??"",
      };
    });
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Digitações");
    window.XLSX.writeFile(wb, `digitacoes_${TODAY}.xlsx`);
  };

  const clearAll = () => setFilters({ banco:"", operacao:"", convenio:"", situacao:"", situacaoBanco:"", parceiro:"", dateFrom:"", dateTo:"" });

  if (!open) return null;
  const selStyle = { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 10px", fontSize:12, outline:"none", cursor:"pointer", width:"100%" };

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000CC", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div className="fade-in" onClick={e=>e.stopPropagation()} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, width:660, maxWidth:"100%", maxHeight:"90vh", overflowY:"auto", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h3 style={{ fontFamily:"Syne", fontWeight:700, fontSize:16 }}>Exportar Digitações</h3>
            <p style={{ fontSize:12, color:C.muted, marginTop:3 }}>Filtre e exporte no mesmo formato da planilha</p>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:22, cursor:"pointer" }}>×</button>
        </div>

        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:8, letterSpacing:1 }}>PERÍODO</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Input label="De"  type="date" value={filters.dateFrom} onChange={e=>setF("dateFrom",e.target.value)} />
              <Input label="Até" type="date" value={filters.dateTo}   onChange={e=>setF("dateTo",  e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:8, letterSpacing:1 }}>FILTROS</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Agente (Parceiro)", "parceiro",      [{value:"",label:"Todos"}, ...partners.map(p=>({value:p.id,label:p.name}))]],
                ["Banco",            "banco",          ["Todos",...BANCOS_LIST]],
                ["Operação",         "operacao",       ["Todas",...OPERACOES_LIST]],
                ["Convênio",         "convenio",       ["Todos",...CONVENIOS_LIST]],
                ["Situação",         "situacao",       ["Todas",...SITUACOES_LIST]],
                ["Situação Banco",   "situacaoBanco",  ["Todas",...SIT_BANCO_LIST]],
              ].map(([lbl,key,opts])=>(
                <div key={key} style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ fontSize:11, color:C.muted, fontWeight:500 }}>{lbl}</label>
                  <select value={filters[key]} style={selStyle}
                    onChange={e=>setF(key,["Todos","Todas"].includes(e.target.value)?"":e.target.value)}>
                    {opts.map(o=>typeof o==="object"
                      ?<option key={o.value} value={o.value}>{o.label}</option>
                      :<option key={o} value={["Todos","Todas"].includes(o)?"":o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:C.surface, borderRadius:10, padding:"12px 16px", border:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <div>
              <span style={{ fontSize:13, fontWeight:600 }}>{filtered.length} registro(s)</span>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>VR. Bruto total: {fmtBRL(filtered.reduce((a,o)=>a+o.value,0))}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="ghost" onClick={clearAll}>Limpar</Btn>
              <Btn variant="success" onClick={doExport}>⬇ Exportar .xlsx</Btn>
            </div>
          </div>

          {filtered.length>0 && (
            <div style={{ overflowX:"auto", maxHeight:220, borderRadius:8, border:`1px solid ${C.border}` }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ background:C.surface, position:"sticky", top:0 }}>
                    {["DATA","AGENTE","BANCO","OPERAÇÃO","CONVÊNIO","CLIENTE","PROPOSTA","VR. BRUTO","SITUAÇÃO","SIT. BANCO"].map(h=>(
                      <th key={h} style={{ padding:"7px 10px", textAlign:"left", color:C.muted, fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,60).map(o=>{
                    const p=partners.find(x=>x.id===o.partner);
                    return (
                      <tr key={o.id} style={{ borderTop:`1px solid ${C.border}` }}>
                        <td style={{ padding:"6px 10px", whiteSpace:"nowrap" }}>{fmtDate(o.date)}</td>
                        <td style={{ padding:"6px 10px", whiteSpace:"nowrap" }}>{p?.name??"—"}</td>
                        <td style={{ padding:"6px 10px", color:C.muted }}>{o.banco}</td>
                        <td style={{ padding:"6px 10px", color:C.muted }}>{o.operacao}</td>
                        <td style={{ padding:"6px 10px", color:C.muted }}>{o.convenio}</td>
                        <td style={{ padding:"6px 10px" }}>{o.cliente??"—"}</td>
                        <td style={{ padding:"6px 10px", color:C.muted }}>{o.proposta??"—"}</td>
                        <td style={{ padding:"6px 10px", color:C.accent2, fontWeight:600 }}>{fmtBRL(o.value)}</td>
                        <td style={{ padding:"6px 10px" }}><Pill label={o.situacao||"—"} color={SITUACAO_COLOR[o.situacao]??C.muted}/></td>
                        <td style={{ padding:"6px 10px" }}><Pill label={o.situacaoBanco||"—"} color={SIT_BANCO_COLOR[o.situacaoBanco]??C.muted}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Operations ────────────────────────────────────────────────────────────────
function Operations({ ops, setOps, partners }) {
  const blank = {
    id:"", date:"", partner:"", banco:"", operacao:"NOVO", convenio:"INSS",
    usuario:"", cpf:"", cliente:"", proposta:"", contrato:"",
    prazo:"", value:"", vrParcela:"", vrLiquido:"", vrRepasse:"", taxa:"",
    produto:"", situacao:"PROPOSTA CADASTRADA", situacaoBanco:"EM ANALISE", notes:""
  };
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(blank);
  const [search, setSearch]     = useState("");
  const [filterSit, setFilterSit]   = useState("");
  const [filterBanco, setFilterBanco] = useState("");
  const [filterOp, setFilterOp]     = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [sortField, setSortField]   = useState("date");
  const [sortDir, setSortDir]       = useState(-1);

  const [importOpen, setImportOpen] = useState(false);

  const openNew  = () => { setForm({...blank, id:uid()}); setModal("new"); };
  const openEdit = (o) => { setForm({...o}); setModal(o.id); };
  const handleSort = (f) => { if(sortField===f) setSortDir(d=>-d); else{setSortField(f);setSortDir(-1);} };

  const handleSave = () => {
    if(!form.date||!form.partner||!form.value) return;
    const entry = {...form, value:Number(form.value), prazo:Number(form.prazo)||0,
      vrParcela:Number(form.vrParcela)||0, vrLiquido:Number(form.vrLiquido)||0,
      vrRepasse:Number(form.vrRepasse)||0, taxa:Number(form.taxa)||0 };
    setOps(modal==="new" ? [...ops, entry] : ops.map(o=>o.id===modal?entry:o));
    setModal(null);
  };

  let filtered = ops.filter(o=>{
    const p=partners.find(x=>x.id===o.partner);
    const q=search.toLowerCase();
    return (!q || p?.name.toLowerCase().includes(q) || (o.banco||"").toLowerCase().includes(q)
      || (o.cliente||"").toLowerCase().includes(q) || (o.proposta||"").toLowerCase().includes(q)
      || (o.cpf||"").includes(q) || (o.usuario||"").toLowerCase().includes(q))
      && (!filterSit   || o.situacao===filterSit)
      && (!filterBanco || o.banco===filterBanco)
      && (!filterOp    || o.operacao===filterOp);
  });
  filtered=[...filtered].sort((a,b)=>sortField==="value"?sortDir*(a.value-b.value):sortDir*a.date.localeCompare(b.date));

  const allBancosUsed = [...new Set(ops.map(o=>o.banco).filter(Boolean))].sort();

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ fontFamily:"Syne", fontSize:20, fontWeight:700 }}>Digitações</h2>
          <p style={{ color:C.muted, fontSize:13 }}>{ops.length} registros · VR. Bruto: <strong style={{color:C.accent2}}>{fmtBRL(ops.reduce((a,o)=>a+o.value,0))}</strong></p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={()=>setImportOpen(true)}>⬆ Importar</Btn>
          <Btn variant="ghost" onClick={()=>setExportOpen(true)}>⬇ Exportar</Btn>
          <Btn onClick={openNew}>+ Nova Digitação</Btn>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Parceiro, cliente, CPF, proposta, usuário..."
          style={{ flex:1, minWidth:240, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 12px", fontSize:13, outline:"none" }}/>
        {[
          [allBancosUsed, filterBanco, setFilterBanco, "Banco"],
          [OPERACOES_LIST, filterOp, setFilterOp, "Operação"],
        ].map(([opts, val, setter, placeholder])=>(
          <select key={placeholder} value={val} onChange={e=>setter(e.target.value)}
            style={{ background:C.surface, border:`1px solid ${val?C.accent:C.border}`, borderRadius:8, color:val?C.text:C.muted, padding:"8px 12px", fontSize:12, outline:"none", cursor:"pointer" }}>
            <option value="">{placeholder}: Todos</option>
            {opts.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <select value={filterSit} onChange={e=>setFilterSit(e.target.value)}
          style={{ background:C.surface, border:`1px solid ${filterSit?C.accent:C.border}`, borderRadius:8, color:filterSit?C.text:C.muted, padding:"8px 12px", fontSize:12, outline:"none", cursor:"pointer" }}>
          <option value="">Situação: Todas</option>
          {SITUACOES_LIST.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {(filterBanco||filterOp||filterSit||search) &&
          <Btn variant="ghost" onClick={()=>{setSearch("");setFilterBanco("");setFilterOp("");setFilterSit("");}}>✕ Limpar</Btn>}
      </div>

      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:1000 }}>
            <thead>
              <tr style={{ background:C.surface }}>
                {[["date","DATA"],["","AGENTE"],["","BANCO"],["","OPERAÇÃO"],["","CONVÊNIO"],["","CLIENTE"],["","PROPOSTA"],["value","VR. BRUTO"],["","PRAZO"],["","SITUAÇÃO"],["","SIT. BANCO"],["",""]].map(([f,h])=>(
                  <th key={h} onClick={()=>f&&handleSort(f)} style={{ textAlign:"left", padding:"11px 12px", fontSize:11, color:C.muted, fontWeight:600, cursor:f?"pointer":"default", whiteSpace:"nowrap" }}>
                    {h}{f&&sortField===f?(sortDir===-1?" ↓":" ↑"):""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={12} style={{ padding:32, textAlign:"center", color:C.muted }}>Nenhuma digitação encontrada</td></tr>}
              {filtered.map(o=>{
                const p=partners.find(x=>x.id===o.partner);
                return (
                  <tr key={o.id} style={{ borderTop:`1px solid ${C.border}`, cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    onClick={()=>openEdit(o)}>
                    <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>{fmtDate(o.date)}</td>
                    <td style={{ padding:"0 12px" }}><div style={{ fontWeight:500 }}>{p?.name??"—"}</div><div style={{ fontSize:10, color:C.muted }}>{o.usuario}</div></td>
                    <td style={{ padding:"0 12px", color:C.muted, whiteSpace:"nowrap" }}>{o.banco||"—"}</td>
                    <td style={{ padding:"0 12px", color:C.muted, whiteSpace:"nowrap" }}>{o.operacao||"—"}</td>
                    <td style={{ padding:"0 12px", color:C.muted }}>{o.convenio||"—"}</td>
                    <td style={{ padding:"0 12px" }}><div style={{ fontSize:12 }}>{o.cliente||"—"}</div><div style={{ fontSize:10, color:C.muted }}>{o.cpf}</div></td>
                    <td style={{ padding:"0 12px", color:C.muted, whiteSpace:"nowrap" }}>{o.proposta||"—"}</td>
                    <td style={{ padding:"0 12px", color:C.accent2, fontWeight:600, whiteSpace:"nowrap" }}>{fmtBRL(o.value)}</td>
                    <td style={{ padding:"0 12px", color:C.muted }}>{o.prazo?`${o.prazo}x`:"—"}</td>
                    <td style={{ padding:"0 12px", whiteSpace:"nowrap" }}><Pill label={o.situacao||"—"} color={SITUACAO_COLOR[o.situacao]??C.muted}/></td>
                    <td style={{ padding:"0 12px", whiteSpace:"nowrap" }}><Pill label={o.situacaoBanco||"—"} color={SIT_BANCO_COLOR[o.situacaoBanco]??C.muted}/></td>
                    <td style={{ padding:"0 12px", color:C.muted, fontSize:16 }}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form Modal */}
      <Modal open={!!modal} onClose={()=>setModal(null)} title={modal==="new"?"Nova Digitação":"Editar Digitação"} width={620}>
        <div style={{ fontSize:11, color:C.accent, fontWeight:700, letterSpacing:1, marginBottom:8 }}>IDENTIFICAÇÃO</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
          <Input label="Data *"    type="date"   value={form.date}      onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          <Sel   label="Agente (Parceiro) *"     value={form.partner}   onChange={e=>setForm(f=>({...f,partner:e.target.value}))}
            options={[{value:"",label:"Selecione..."},...partners.map(p=>({value:p.id,label:p.name}))]} />
          <Input label="Usuário"                 value={form.usuario||""} onChange={e=>setForm(f=>({...f,usuario:e.target.value}))} placeholder="Digitador" />
        </div>
        <div style={{ fontSize:11, color:C.accent, fontWeight:700, letterSpacing:1, marginBottom:8 }}>CLIENTE</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <Input label="CPF"      value={form.cpf||""}     onChange={e=>setForm(f=>({...f,cpf:e.target.value}))}     placeholder="000.000.000-00" />
          <Input label="Cliente"  value={form.cliente||""} onChange={e=>setForm(f=>({...f,cliente:e.target.value}))} placeholder="Nome completo" />
          <Input label="Proposta" value={form.proposta||""}onChange={e=>setForm(f=>({...f,proposta:e.target.value}))}placeholder="Nº da proposta" />
          <Input label="Nº Contrato" value={form.contrato||""}onChange={e=>setForm(f=>({...f,contrato:e.target.value}))}placeholder="Nº do contrato" />
        </div>
        <div style={{ fontSize:11, color:C.accent, fontWeight:700, letterSpacing:1, marginBottom:8 }}>PRODUTO</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
          <Sel label="Banco *"    value={form.banco||""}   onChange={e=>setForm(f=>({...f,banco:e.target.value}))}   options={["Selecione...",...BANCOS_LIST]} />
          <Sel label="Operação"   value={form.operacao||""}onChange={e=>setForm(f=>({...f,operacao:e.target.value}))}options={OPERACOES_LIST} />
          <Sel label="Convênio"   value={form.convenio||""}onChange={e=>setForm(f=>({...f,convenio:e.target.value}))}options={CONVENIOS_LIST} />
          <Input label="Produto"  value={form.produto||""} onChange={e=>setForm(f=>({...f,produto:e.target.value}))} placeholder="Descrição do produto" style={{gridColumn:"1 / -1"}} />
        </div>
        <div style={{ fontSize:11, color:C.accent, fontWeight:700, letterSpacing:1, marginBottom:8 }}>VALORES</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
          <Input label="VR. Bruto *" type="number" value={form.value}         onChange={e=>setForm(f=>({...f,value:e.target.value}))}      placeholder="0.00" />
          <Input label="VR. Parcela" type="number" value={form.vrParcela||""} onChange={e=>setForm(f=>({...f,vrParcela:e.target.value}))}  placeholder="0.00" />
          <Input label="Prazo (meses)"type="number"value={form.prazo||""}     onChange={e=>setForm(f=>({...f,prazo:e.target.value}))}      placeholder="84" />
          <Input label="VR. Líquido" type="number" value={form.vrLiquido||""} onChange={e=>setForm(f=>({...f,vrLiquido:e.target.value}))}  placeholder="0.00" />
          <Input label="VR. Repasse" type="number" value={form.vrRepasse||""} onChange={e=>setForm(f=>({...f,vrRepasse:e.target.value}))}  placeholder="0.00" />
          <Input label="Taxa (%)"    type="number" value={form.taxa||""}      onChange={e=>setForm(f=>({...f,taxa:e.target.value}))}       placeholder="1.80" />
        </div>
        <div style={{ fontSize:11, color:C.accent, fontWeight:700, letterSpacing:1, marginBottom:8 }}>SITUAÇÃO</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <Sel label="Situação"       value={form.situacao||"PROPOSTA CADASTRADA"} onChange={e=>setForm(f=>({...f,situacao:e.target.value}))}       options={SITUACOES_LIST} />
          <Sel label="Situação Banco" value={form.situacaoBanco||"EM ANALISE"}     onChange={e=>setForm(f=>({...f,situacaoBanco:e.target.value}))}   options={SIT_BANCO_LIST} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          <label style={{ fontSize:12, color:C.muted, fontWeight:500 }}>Observações</label>
          <textarea value={form.notes||""} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"9px 12px", fontSize:13, outline:"none", resize:"vertical", fontFamily:"DM Sans" }}/>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
          {modal!=="new"&&<Btn variant="danger" onClick={()=>{setOps(ops.filter(o=>o.id!==modal));setModal(null);}}>Excluir</Btn>}
          <Btn variant="ghost" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn onClick={handleSave}>Salvar</Btn>
        </div>
      </Modal>

      <ImportModal open={importOpen} onClose={()=>setImportOpen(false)} partners={partners} onImport={(rows)=>setOps(prev=>[...prev,...rows])} currentUser="admin" />
      <ExportModal open={exportOpen} onClose={()=>setExportOpen(false)} ops={ops} partners={partners}/>
    </div>
  );
}

// ── Partners ──────────────────────────────────────────────────────────────────
function Partners({ partners, setPartners, ops }) {
  const blank = { id: "", name: "", segment: "", region: "", status: "Ativo" };
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const filtered = partners.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.segment.toLowerCase().includes(search.toLowerCase()));
  const handleSave = () => {
    if (!form.name) return;
    setPartners(modal === "new" ? [...partners, form] : partners.map(p => p.id === modal ? form : p));
    setModal(null);
  };
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700 }}>Parceiros</h2>
          <p style={{ color: C.muted, fontSize: 13 }}>{partners.length} parceiros cadastrados</p>
        </div>
        <Btn onClick={() => { setForm({ ...blank, id: uid() }); setModal("new"); }}>+ Novo Parceiro</Btn>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar parceiro..."
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, outline: "none", width: 280 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 12 }}>
        {filtered.map(p => {
          const pOps = ops.filter(o => o.partner === p.id);
          const rev = pOps.filter(o => o.status === "Concluída").reduce((a, o) => a + o.value, 0);
          return (
            <Card key={p.id} hover onClick={() => { setForm({ ...p }); setModal(p.id); }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: C.accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.accent, fontFamily: "Syne", fontWeight: 700 }}>
                  {p.name.charAt(0)}
                </div>
                <Pill label={p.status} color={STATUS_COLOR[p.status] ?? C.muted} />
              </div>
              <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{p.segment} · {p.region}</div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                <div><div style={{ fontSize: 10, color: C.muted }}>OPERAÇÕES</div><div style={{ fontSize: 14, fontWeight: 600 }}>{pOps.length}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.muted }}>RECEITA</div><div style={{ fontSize: 14, fontWeight: 600, color: C.accent2 }}>{fmtBRL(rev)}</div></div>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "new" ? "Novo Parceiro" : "Editar Parceiro"} width={420}>
        <Input label="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Segmento" value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} />
          <Input label="Região" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
        </div>
        <Sel label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={["Ativo", "Inativo"]} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {modal !== "new" && <Btn variant="danger" onClick={() => { setPartners(partners.filter(p => p.id !== modal)); setModal(null); }}>Excluir</Btn>}
          <Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn>
          <Btn onClick={handleSave}>Salvar</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── Performance ───────────────────────────────────────────────────────────────
function Performance({ ops, partners }) {
  const concluded = ops.filter(o => o.status === "Concluída");
  const bySegment = {};
  partners.forEach(p => {
    const pOps = concluded.filter(o => o.partner === p.id);
    const seg = p.segment || "Outros";
    if (!bySegment[seg]) bySegment[seg] = { revenue: 0, count: 0 };
    bySegment[seg].revenue += pOps.reduce((a, o) => a + o.value, 0);
    bySegment[seg].count += pOps.length;
  });
  const segData = Object.entries(bySegment).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue);
  const totalRev = concluded.reduce((a, o) => a + o.value, 0);
  const partnerPerf = partners.map(p => {
    const pOps = ops.filter(o => o.partner === p.id);
    const pDone = pOps.filter(o => o.status === "Concluída");
    return { ...p, totalOps: pOps.length, doneOps: pDone.length, revenue: pDone.reduce((a, o) => a + o.value, 0), rate: pOps.length > 0 ? (pDone.length / pOps.length * 100).toFixed(0) : 0, lastOp: pOps.sort((a, b) => b.date.localeCompare(a.date))[0]?.date };
  }).sort((a, b) => b.revenue - a.revenue);
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700 }}>Performance</h2>
        <p style={{ color: C.muted, fontSize: 13 }}>Análise de desempenho por parceiro e segmento</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Por Segmento</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {segData.map(s => {
              const pct = totalRev > 0 ? (s.revenue / totalRev * 100) : 0;
              return (
                <div key={s.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: C.accent2, fontWeight: 600 }}>{fmtBRL(s.revenue)}</span>
                  </div>
                  <div style={{ background: C.border, borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${C.accent},${C.accent2})`, transition: "width .6s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{pct.toFixed(1)}% · {s.count} ops</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Tipos de Operação</h3>
          {["Venda", "Contrato", "Renovação", "Parceria", "Outro"].map(t => {
            const tOps = ops.filter(o => o.type === t);
            const tRev = tOps.filter(o => o.status === "Concluída").reduce((a, o) => a + o.value, 0);
            return (
              <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13 }}>{t}</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: C.accent2, fontWeight: 600 }}>{fmtBRL(tRev)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{tOps.length} ops</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14 }}>Ranking de Parceiros</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: C.surface }}>
            {["#", "Parceiro", "Segmento", "Receita", "Ops", "Taxa Conv.", "Última Op."].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {partnerPerf.map((p, i) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 16px", color: C.muted, fontWeight: 700 }}>#{i + 1}</td>
                <td><div style={{ fontWeight: 600 }}>{p.name}</div><Pill label={p.status} color={STATUS_COLOR[p.status] ?? C.muted} /></td>
                <td style={{ color: C.muted }}>{p.segment}</td>
                <td style={{ color: C.accent2, fontWeight: 700 }}>{fmtBRL(p.revenue)}</td>
                <td>{p.totalOps}</td>
                <td><span style={{ color: Number(p.rate) >= 70 ? C.accent2 : Number(p.rate) >= 40 ? C.warn : C.danger, fontWeight: 600 }}>{p.rate}%</span></td>
                <td style={{ color: C.muted }}>{p.lastOp ? fmtDate(p.lastOp) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
const USERS = [{ id: "u1", username: "admin", password: "admin123", name: "Administrador", role: "admin" }];

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const handle = () => {
    const u = USERS.find(u => u.username === form.username && u.password === form.password);
    if (u) onLogin(u); else setErr("Usuário ou senha incorretos.");
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse at 30% 40%, #0A1E3D, ${C.bg} 70%)` }}>
      <div className="fade-in" style={{ width: 380, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>◈</div>
          <h1 style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 800, letterSpacing: -1 }}><span style={{ color: C.accent }}>Ops</span>Manager</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Sistema de Acompanhamento de Parceiros</p>
        </div>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="Usuário" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Digite seu usuário" />
          <Input label="Senha" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handle()} placeholder="••••••••" />
          {err && <span style={{ color: C.danger, fontSize: 12 }}>{err}</span>}
          <Btn onClick={handle} style={{ padding: "11px 0", width: "100%" }}>Entrar</Btn>
        </Card>
        <p style={{ textAlign: "center", fontSize: 12, color: C.muted }}>Demo: <strong style={{ color: C.accent }}>admin</strong> / <strong style={{ color: C.accent }}>admin123</strong></p>
      </div>
    </div>
  );
}

// ── Análise de Digitações ─────────────────────────────────────────────────────
function Analise({ ops, partners }) {
  const now = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth();
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevYear  = curMonth === 0 ? curYear - 1 : curYear;

  const CONCRETIZADOS = ["CONCRETIZADO","PAGO","PAGO AO CLIENTE","PAGAMENTO REALIZADO","FINALIZADO","INT - FINALIZADO","INT - TED EMITIDA"];
  const partnerStats = partners.map(p => {
    const pOps    = ops.filter(o => o.partner === p.id);
    const thisMo  = pOps.filter(o => { const d=new Date(o.date); return d.getFullYear()===curYear  && d.getMonth()===curMonth; });
    const prevMo  = pOps.filter(o => { const d=new Date(o.date); return d.getFullYear()===prevYear && d.getMonth()===prevMonth; });
    const thisVal = thisMo.reduce((a,o)=>a+o.value,0);
    const prevVal = prevMo.reduce((a,o)=>a+o.value,0);
    const delta   = prevVal>0 ? ((thisVal-prevVal)/prevVal*100) : (thisVal>0?100:-100);
    const lastDate= pOps.length>0?[...pOps].sort((a,b)=>b.date.localeCompare(a.date))[0].date:null;
    const daysSinceLast = lastDate ? Math.floor((now - new Date(lastDate+"T12:00:00"))/(1000*60*60*24)) : 999;
    const concret = thisMo.filter(o=>CONCRETIZADOS.includes(o.situacaoBanco)).length;

    let alert="ok";
    if(thisMo.length===0 && prevMo.length>0)       alert="zero";
    else if(thisMo.length===0 && prevMo.length===0) alert="never";
    else if(delta<=-30)                             alert="queda";
    else if(delta<0)                                alert="baixo";

    return { ...p, thisMo, prevMo, thisVal, prevVal, delta, lastDate, daysSinceLast, alert, totalOps:pOps.length, concret };
  });

  const alerts       = partnerStats.filter(p=>["zero","never","queda"].includes(p.alert));
  const inQueda      = partnerStats.filter(p=>p.alert==="queda").length;
  const semDigitar   = partnerStats.filter(p=>p.alert==="zero"||p.alert==="never").length;
  const totalThisMo  = partnerStats.reduce((a,p)=>a+p.thisVal,0);

  // Daily breakdown — last 30 days
  const days = Array.from({length:30},(_,i)=>{
    const d = new Date(now); d.setDate(d.getDate()-(29-i));
    return d.toISOString().split("T")[0];
  });
  const dailyMap = {};
  ops.forEach(o=>{ if(days.includes(o.date)) dailyMap[o.date]=(dailyMap[o.date]||0)+o.value; });
  const dailyData = days.map(d=>({ label:d.slice(8), value:dailyMap[d]||0, full:d }));
  const maxDaily = Math.max(...dailyData.map(d=>d.value),1);

  const ALERT_CFG = {
    "zero":  { color:C.danger,  icon:"⛔", label:"Sem digitação este mês" },
    "never": { color:C.muted,   icon:"○",  label:"Nunca digitou" },
    "queda": { color:C.danger,  icon:"↓",  label:"Queda ≥30%" },
    "baixo": { color:C.warn,    icon:"↘",  label:"Queda <30%" },
    "ok":    { color:C.accent2, icon:"↗",  label:"Normal / crescimento" },
  };

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <h2 style={{ fontFamily:"Syne", fontSize:20, fontWeight:700 }}>Análise de Digitações</h2>
        <p style={{ color:C.muted, fontSize:13 }}>Acompanhamento diário por parceiro · {now.toLocaleString("pt-BR",{month:"long",year:"numeric"})}</p>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14 }}>
        <StatCard label="Digitado no Mês"   value={fmtBRL(totalThisMo)} sub={`${partnerStats.filter(p=>p.thisMo.length>0).length} parceiros ativos`} color={C.accent2} icon="📋"/>
        <StatCard label="Em Queda"          value={inQueda}     sub="≥ 30% vs mês anterior"  color={C.danger}  icon="↓"/>
        <StatCard label="Sem Digitar"        value={semDigitar}  sub="nenhuma op. este mês"   color={C.warn}    icon="⛔"/>
        <StatCard label="Total de Parceiros" value={partners.length} sub={`${partners.filter(p=>p.status==="Ativo").length} ativos`} icon="🤝"/>
      </div>

      {/* Alert banner */}
      {alerts.length>0 && (
        <div style={{ background:C.danger+"14", border:`1px solid ${C.danger}44`, borderRadius:12, padding:"14px 18px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.danger, marginBottom:10, letterSpacing:1 }}>⚠ ATENÇÃO — {alerts.length} parceiro(s) precisam de acompanhamento</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {alerts.map(p=>{
              const cfg=ALERT_CFG[p.alert];
              return (
                <div key={p.id} style={{ background:cfg.color+"18", border:`1px solid ${cfg.color}44`, borderRadius:8, padding:"6px 12px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:14 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:cfg.color }}>{p.name}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{cfg.label} · último: {p.lastDate?fmtDate(p.lastDate):"nunca"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily sparkline */}
      <Card>
        <h3 style={{ fontFamily:"Syne", fontWeight:700, fontSize:14, marginBottom:16 }}>Volume Diário — últimos 30 dias</h3>
        <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:100 }}>
          {dailyData.map((d,i)=>{
            const h=Math.max((d.value/maxDaily)*86,2);
            const isToday=d.full===TODAY;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }} title={`${d.full}: ${fmtBRL(d.value)}`}>
                <div style={{ width:"100%", height:h, borderRadius:"3px 3px 0 0", background:isToday?C.accent2:d.value>0?C.accent:C.border, opacity:d.value>0?1:.4, transition:"height .3s", minHeight:2 }}/>
                {(i%5===0||isToday)&&<span style={{ fontSize:9, color:isToday?C.accent2:C.muted, whiteSpace:"nowrap", fontWeight:isToday?700:400 }}>{d.label}</span>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Per-partner table */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 style={{ fontFamily:"Syne", fontWeight:700, fontSize:14 }}>Detalhamento por Parceiro</h3>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {Object.entries(ALERT_CFG).map(([k,v])=>(
              <div key={k} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ color:v.color, fontSize:12 }}>{v.icon}</span>
                <span style={{ fontSize:10, color:C.muted }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.surface }}>
                {["Parceiro","Digitações (mês)","VR. Bruto (mês)","Mês anterior","Variação","Concretizados","Última digitação","Tendência"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:11, color:C.muted, fontWeight:600, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...partnerStats].sort((a,b)=>b.thisVal-a.thisVal).map(p=>{
                const cfg=ALERT_CFG[p.alert];
                const dSign=p.delta>0?"+":"";
                return (
                  <tr key={p.id} style={{ borderTop:`1px solid ${C.border}`, background:p.alert==="queda"||p.alert==="zero"?C.danger+"06":"transparent" }}>
                    <td style={{ padding:"11px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:16 }}>{cfg.icon}</span>
                        <div>
                          <div style={{ fontWeight:600 }}>{p.name}</div>
                          <div style={{ fontSize:11, color:C.muted }}>{p.segment}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"0 16px" }}>
                      <span style={{ fontWeight:600, color:p.thisMo.length>0?C.text:C.muted }}>{p.thisMo.length} op{p.thisMo.length!==1?"s":""}</span>
                    </td>
                    <td style={{ padding:"0 16px", color:C.accent2, fontWeight:600 }}>{fmtBRL(p.thisVal)}</td>
                    <td style={{ padding:"0 16px", color:C.muted }}>{fmtBRL(p.prevVal)}</td>
                    <td style={{ padding:"0 16px" }}>
                      {p.prevVal>0||p.thisVal>0 ? (
                        <span style={{ fontWeight:700, color:p.delta>0?C.accent2:p.delta<-30?C.danger:C.warn }}>
                          {p.delta>0?"+":""}{p.delta.toFixed(0)}%
                        </span>
                      ) : <span style={{ color:C.muted }}>—</span>}
                    </td>
                    <td style={{ padding:"0 16px" }}>
                      <span style={{ fontWeight:600, color:p.concret>0?C.accent2:C.muted }}>
                        {p.concret} / {p.thisMo.length}
                      </span>
                    </td>
                    <td style={{ padding:"0 16px", color:p.daysSinceLast>14?C.danger:C.muted, fontSize:12 }}>
                      {p.lastDate?`${fmtDate(p.lastDate)} (${p.daysSinceLast}d atrás)`:"Nunca"}
                    </td>
                    <td style={{ padding:"0 16px" }}>
                      {/* Mini sparkline last 4 weeks */}
                      <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:24 }}>
                        {Array.from({length:4},(_,wi)=>{
                          const wStart=new Date(now); wStart.setDate(wStart.getDate()-(3-wi)*7-6);
                          const wEnd  =new Date(now); wEnd.setDate(wEnd.getDate()-(3-wi)*7);
                          const wVal=ops.filter(o=>{
                            if(o.partner!==p.id) return false;
                            const d=new Date(o.date+"T12:00:00");
                            return d>=wStart&&d<=wEnd;
                          }).reduce((a,o)=>a+o.value,0);
                          const maxW=Math.max(...Array.from({length:4},(_2,wi2)=>{
                            const ws2=new Date(now); ws2.setDate(ws2.getDate()-(3-wi2)*7-6);
                            const we2=new Date(now); we2.setDate(we2.getDate()-(3-wi2)*7);
                            return ops.filter(o=>{if(o.partner!==p.id)return false;const d=new Date(o.date+"T12:00:00");return d>=ws2&&d<=we2;}).reduce((a,o)=>a+o.value,0);
                          }),1);
                          const barH=Math.max(wVal/maxW*20,1);
                          return <div key={wi} style={{ width:8, height:barH, borderRadius:2, background:wi===3?C.accent2:C.accent+"66" }}/>;
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════════════════════
const NAV = [
  { id: "dashboard", label: "Dashboard",  icon: "⬡" },
  { id: "analise",   label: "Análise",    icon: "◉" },
  { id: "proposals", label: "Propostas",  icon: "◇" },
  { id: "ops",       label: "Operações",  icon: "◈" },
  { id: "partners",  label: "Parceiros",  icon: "◎" },
  { id: "performance",label:"Performance",icon: "◬" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [ops, setOpsState] = useState([]);
  const [partners, setPartnersState] = useState([]);
  const [proposals, setProposalsState] = useState([]);

  useEffect(() => {
    (async () => {
      const [savedOps, savedPartners, savedProposals] = await Promise.all([
        load(KEYS.ops), load(KEYS.partners), load(KEYS.proposals),
      ]);
      setOpsState(savedOps ?? SEED_OPS);
      setPartnersState(savedPartners ?? SEED_PARTNERS);
      setProposalsState(savedProposals ?? SEED_PROPOSALS);
      setReady(true);
    })();
  }, []);

  const setOps = useCallback(async (v) => { setOpsState(v); await save(KEYS.ops, v); }, []);
  const setPartners = useCallback(async (v) => { setPartnersState(v); await save(KEYS.partners, v); }, []);

  const setProposals = useCallback(async (v) => {
    setProposalsState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      save(KEYS.proposals, next);
      return next;
    });
  }, []);

  if (!ready) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ color: C.accent, fontFamily: "Syne", fontSize: 18, animation: "pulse 1.5s infinite" }}>◈ Carregando...</div>
    </div>
  );

  if (!user) return <><style>{GLOBAL_CSS}</style><Login onLogin={setUser} /></>;

  const openProposals = proposals.filter(p => !["Fechado", "Perdido"].includes(p.status)).length;
  const alertPartners = partners.filter(p => {
    const curY=new Date().getFullYear(), curM=new Date().getMonth();
    const thisMo=ops.filter(o=>{const d=new Date(o.date);return o.partner===p.id&&d.getFullYear()===curY&&d.getMonth()===curM;});
    const prevMo=ops.filter(o=>{const d=new Date(o.date);const py=curM===0?curY-1:curY,pm=curM===0?11:curM-1;return o.partner===p.id&&d.getFullYear()===py&&d.getMonth()===pm;});
    const tv=thisMo.reduce((a,o)=>a+o.value,0), pv=prevMo.reduce((a,o)=>a+o.value,0);
    return (thisMo.length===0&&prevMo.length>0)||(pv>0&&(tv-pv)/pv<=-0.3);
  }).length;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <div style={{ width: 220, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: "24px 0" }}>
          <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 800 }}><span style={{ color: C.accent }}>Ops</span>Manager</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>v2.0 · Gestão de Parceiros</div>
          </div>
          <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map(n => {
              const active = view === n.id;
              const badge = n.id === "proposals" ? openProposals : n.id === "analise" ? alertPartners : 0;
              return (
                <button key={n.id} onClick={() => setView(n.id)} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, border: "none", background: active ? C.accent + "22" : "transparent",
                  color: active ? C.accent : C.muted, fontFamily: "DM Sans", fontSize: 13,
                  fontWeight: active ? 600 : 400, cursor: "pointer", textAlign: "left", transition: "all .15s",
                }}>
                  <span>{n.icon}</span>
                  <span style={{ flex: 1 }}>{n.label}</span>
                  {badge > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: C.warn, color: C.bg, borderRadius: 10, padding: "1px 6px" }}>{badge}</span>}
                  {active && <div style={{ width: 4, height: 4, borderRadius: 2, background: C.accent }} />}
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
        <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto", maxWidth: "calc(100vw - 220px)" }}>
          {view === "dashboard"   && <Dashboard ops={ops} partners={partners} proposals={proposals} />}
          {view === "analise"     && <Analise ops={ops} partners={partners} />}
          {view === "proposals"   && <Proposals proposals={proposals} setProposals={setProposals} partners={partners} currentUser={user.username} />}
          {view === "ops"         && <Operations ops={ops} setOps={setOps} partners={partners} />}
          {view === "partners"    && <Partners partners={partners} setPartners={setPartners} ops={ops} />}
          {view === "performance" && <Performance ops={ops} partners={partners} />}
        </div>
      </div>
    </>
  );
}
