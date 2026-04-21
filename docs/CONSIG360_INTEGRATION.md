# Integração Consig360 - Documentação para Robô de Importação

> Este documento contém tudo o que foi descoberto por engenharia reversa do frontend Consig360 (https://lhamascred.consig360.com.br) para construir um robô que sincroniza as propostas com o banco de dados (Supabase).

---

## 1. Sistema de Autenticação

O Consig360 usa **AWS Cognito** como backend de autenticação. O fluxo é:

1. POST com email/senha → recebe access token JWT + refresh token
2. Usar `Authorization: Bearer <accessToken>` nas chamadas seguintes
3. Token expira em ~2 horas (verificar campo `expiresIn`)
4. Renovar com refresh token antes de expirar

### Endpoint de Login

```
POST https://api-prod.consig360.com.br/auth/v1/sign-in
Content-Type: application/json
Origin: https://lhamascred.consig360.com.br
Referer: https://lhamascred.consig360.com.br/

Body:
{
  "email": "carlos@lhamascred.com.br",
  "password": "Lhamas@2024"
}
```

### Resposta

```json
{
  "accessToken": "eyJraWQiOi...",        // JWT Cognito, usar em Bearer
  "refreshToken": "eyJjdHki...",          // Para renovar
  "expiresIn": "2026-04-21T01:42:24.899Z" // ISO 8601, absoluto
}
```

### Headers Obrigatórios em Todas as Chamadas

```
Authorization: Bearer <accessToken>
Origin: https://lhamascred.consig360.com.br
Referer: https://lhamascred.consig360.com.br/
User-Agent: Mozilla/5.0 (qualquer browser recente)
Content-Type: application/json   (para POSTs)
```

**⚠️ IMPORTANTE:** Sem o header `Origin` as chamadas retornam **403 Unauthorized**, mesmo com token válido. É uma proteção CORS server-side.

---

## 2. URLs Base

| Serviço | URL |
|---|---|
| API Proposals | `https://api-prod.consig360.com.br/proposals-public/v1` |
| API Simulation | `https://api-prod.consig360.com.br/simulation/v1` |
| **API Franchise (principal)** | `https://api-prod.consig360.com.br/franchise/v1` |
| API Analytics | `https://api-prod.consig360.com.br/analytics/v1` |
| Auth | `https://api-prod.consig360.com.br/auth/v1` |

---

## 3. Endpoints Descobertos

### 3.1 Informações do Usuário / Squad

```
GET /franchise/v1/me-squad
→ {"squad": {"id": "6dfbd43d-...", "name": "Lhamascred", "variant": "orange", "status": "active"}}

GET /franchise/v1/users
GET /franchise/v1/partners-permissions
```

### 3.2 Listar Propostas (ENDPOINT PRINCIPAL)

```
GET /franchise/v1/proposals?page=1&pageSize=100
```

**⚠️ Parâmetro de paginação é `pageSize`, NÃO `limit`.**
- `limit=100` → retorna só 5 (default ignora o param)
- `pageSize=100` → retorna 100 ✅

**Resposta:**
```json
{
  "data": [ /* array de propostas */ ],
  "meta": {
    "pagination": {
      "totalItems": 5699,
      "totalPages": 57,
      "currentPage": 1,
      "pageSize": 100
    }
  }
}
```

### 3.3 Detalhes de Uma Proposta

```
GET /franchise/v1/proposals/{uuid}
```

Retorna **muito mais campos** que o list, incluindo:
- `timeline` (array com histórico completo de status)
- `contract` (dados do banco origem - febrabanCode, agência, conta, parcelas pagas)
- `benefitBank` (banco onde cliente recebe o benefício)
- `signedContract`, `buttons` (ações disponíveis)

### 3.4 Relatórios / Métricas

```
GET /franchise/v1/reports/metrics?startDate=2026-03-21&endDate=2026-04-20&mode=sales
```

**mode:** `"sales"` ou `"payments"` (obrigatório, retorna 400 sem)

### 3.5 Outros Endpoints Encontrados

```
GET /proposals-public/v1/basic-infos/{id}
GET /proposals-public/v1/events/formalization-portability/{id}
POST /proposals-public/v1/generate-formalization-at-entry
POST /franchise/v1/proposals/{id}/retry/{retryId}
```

---

## 4. Estrutura de Dados das Propostas

### 4.1 Campos do Endpoint List (`/proposals`)

```javascript
{
  id: "uuid",                          // UUID único
  value: 1708.36,                       // Valor da operação
  title: "MARIA DE NASARE...",         // Nome do cliente
  status: "waiting_approval",           // Status interno
  subStatus: null,
  partnerContractId: "DIG0000026501",  // ID do contrato no banco parceiro
  partnerStatus: {
    slug: "waiting_partner",            // Ex: WAITING_CIP_RETURN
    displayText: "Aguardando parceiro"  // Texto amigável
  },
  bank: {                               // Banco DESTINO (Consig)
    id: "uuid",
    name: "BRB - Banco de Brasília S.A.",
    slug: "brb",
    febrabanCode: 70,
    logo: { standard, light, dark }
  },
  product: "Portabilidade e Refinanciamento",
  createdAt: "2025-12-10T12:33:18.901Z",
  updatedAt: "2026-04-20T21:18:56.968Z",
  crmId: null,
  origin: "CPF",
  benefit: { number: "2104794689" },
  client: { cpf: "47727306134" },
  vinculatedProposals: ["uuid1", "uuid2"],
  user: {                               // Parceiro (agente)
    id: "uuid",
    squadId: "uuid"
  },
  isCancellable: false,
  covenantType: "inss",
  clientFormalizationUrl: null,
  batchId: null
}
```

### 4.2 Campos EXTRAS no Detalhe (`/proposals/{id}`)

Além dos acima:

```javascript
{
  portabilityNumber: "202512100000398232025",  // NÚMERO CIP (importante!)
  expectedBalanceDate: "2025-12-17T00:00:00Z", // Data esperada do saldo
  netValue: 0,
  debitBalance: 1708.36,                        // Saldo devedor real
  term: 64,                                     // Prazo
  installmentValue: 46.69,
  coefficient: 0.023,
  description: "Retorno averbação - Margem consignável excedida...",

  contract: {                                   // Banco ORIGEM (cedente)
    id: "2586456630",
    bank: { name: "ITAU BMG", febrabanCode: 29, ... },
    rate: 1.8745,
    term: 84,
    type: "portabilidade_e_refin",
    value: 1866.56,
    benefitBank: { name: "Itau Unibanco", febrabanCode: "341", agency, account },
    benefitValue: 835,
    benefitNumber: "0542722070",
    contractCode: "2586456630",
    debitBalance: 1698.73,
    installmentsPaid: 20,                       // parcelas já pagas
    installmentValue: 44.27
  },

  timeline: [                                   // HISTÓRICO COMPLETO
    {
      status: "waiting_approval",
      partnerStatus: { slug, displayText },
      description: "Retorno averbação...",
      createdAt: "2026-04-15T09:01:44.386Z"
    },
    // ... eventos anteriores em ordem desc
  ],

  typedAt: "...",
  firstDueDate: "...",
  payDate: "...",
  finishedAt: "...",

  clientId: "uuid",
  franchiseId: "uuid",
  salesTableId: "uuid",
  simulationId: "uuid",
  userId: "uuid",

  signedContract: {...},
  buttons: [...],
  resume: {...}
}
```

### 4.3 Valores de `status` (campo interno)

| Status | Descrição |
|---|---|
| `new` | Nova |
| `waiting_approval` | Aguardando aprovação |
| `pending_documentation` | Pendente de documentação |
| `integrated` | Integrada/paga |
| `benefit_blocked` | Benefício bloqueado |
| `canceled` / `rejected` | Cancelada |
| (outros) | Extrair do campo `timeline` |

### 4.4 Valores de `partnerStatus.slug` (status externo)

| Slug | DisplayText |
|---|---|
| `waiting_partner` | Aguardando parceiro |
| `waiting_documentation` | Aguardando documentação |
| `WAITING_CIP_RETURN` | Aguardando Saldo CIP |
| `benefit_blocked` | Benefício bloqueado |
| `integrated` | Integrada |
| (expandir à medida que descobrir) | |

---

## 5. Rate Limits e Gotchas

1. **pageSize máximo:** 100 (sem confirmação de limite maior, testar se aceita 500/1000)
2. **Rate limit:** não documentado mas suspeita-se; colocar **delay de 500-1000ms entre requests**
3. **Paginação é 1-based** (`page=1` é a primeira)
4. **Token Cognito expira em ~2h** - cachear e renovar
5. **Dados vêm ordenados por** `updatedAt DESC` (registros recentes primeiro)
6. **Mesmo cliente pode ter múltiplas propostas vinculadas** via `vinculatedProposals` (ex: Portabilidade + Refinanciamento geram 2 propostas)

---

## 6. Estratégia de Sincronização (Robô)

### 6.1 Fluxo de Execução Recomendado

```
┌────────────────────────────────────────┐
│ 1. LOGIN (inicial, a cada 1h50m)      │
│    POST /auth/v1/sign-in → accessToken │
└────────────────────────────────────────┘
                ↓
┌────────────────────────────────────────┐
│ 2. LISTAR TODAS (incremental)          │
│    Loop: page=1..N, pageSize=100       │
│    Para cada proposta:                 │
│      - Se updated_at > último_sync     │
│      - Marcar como "precisa detalhar"  │
│      - Upsert no BD (dados básicos)    │
└────────────────────────────────────────┘
                ↓
┌────────────────────────────────────────┐
│ 3. BUSCAR DETALHES                     │
│    Para cada proposta marcada:         │
│      GET /proposals/{id}               │
│      Upsert com campos extras          │
│      (timeline, contract, etc)         │
└────────────────────────────────────────┘
                ↓
┌────────────────────────────────────────┐
│ 4. DETECTAR MUDANÇAS DE STATUS         │
│    SQL: SELECT * FROM consig_proposals │
│    WHERE status != last_notified_status│
│    → gerar notificações WhatsApp       │
└────────────────────────────────────────┘
```

### 6.2 Modos de Execução

**Modo FULL (primeira vez ou semanal):**
- Busca TODAS as páginas
- ~57 páginas × 100 items × 500ms delay = ~30s
- Depois busca detalhes das 5.699 uma a uma = ~95 minutos

**Modo INCREMENTAL (hora em hora):**
- Busca só as páginas recentes (primeiras 5-10 páginas)
- Para no primeiro registro cujo `updatedAt` é mais antigo que último_sync
- Detalhes só das que mudaram
- ~2-5 minutos

**Modo WEBHOOK (ideal, se API suportar):**
- Consig360 não documenta webhooks, mas vale perguntar ao suporte

### 6.3 Controle de Última Sincronização

Salvar uma linha de controle:

```sql
CREATE TABLE sync_state (
  source text PRIMARY KEY,        -- 'consig360'
  last_full_sync timestamptz,
  last_incremental_sync timestamptz,
  last_max_updated_at timestamptz,
  total_records integer,
  consecutive_errors integer DEFAULT 0
);
```

### 6.4 Exemplo de Código (Edge Function Deno/TypeScript)

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'

const EMAIL = Deno.env.get('CONSIG360_EMAIL')!
const PASSWORD = Deno.env.get('CONSIG360_PASSWORD')!
const API_BASE = 'https://api-prod.consig360.com.br'
const ORIGIN = 'https://lhamascred.consig360.com.br'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Cache simples do token
let tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token
  }
  const resp = await fetch(`${API_BASE}/auth/v1/sign-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': ORIGIN,
      'Referer': ORIGIN + '/'
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  })
  if (!resp.ok) throw new Error(`Login failed: ${resp.status}`)
  const data = await resp.json()
  tokenCache = {
    token: data.accessToken,
    expiresAt: new Date(data.expiresIn).getTime()
  }
  return data.accessToken
}

async function apiGet(path: string) {
  const token = await getToken()
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Origin': ORIGIN,
      'Referer': ORIGIN + '/'
    }
  })
  if (!resp.ok) throw new Error(`API ${path}: ${resp.status}`)
  return resp.json()
}

async function syncProposals(mode: 'full' | 'incremental' = 'incremental') {
  const { data: state } = await supabase
    .from('sync_state').select('*').eq('source', 'consig360').single()
  const cutoff = mode === 'incremental' && state?.last_max_updated_at
    ? new Date(state.last_max_updated_at)
    : null

  let page = 1, totalUpserted = 0, maxUpdatedAt = cutoff
  while (true) {
    const { data, meta } = await apiGet(`/franchise/v1/proposals?page=${page}&pageSize=100`)
    if (!data || !data.length) break

    let shouldStop = false
    const toUpsert = []
    for (const p of data) {
      const updatedAt = new Date(p.updatedAt)
      if (cutoff && updatedAt <= cutoff) { shouldStop = true; break }
      if (!maxUpdatedAt || updatedAt > maxUpdatedAt) maxUpdatedAt = updatedAt
      toUpsert.push(mapProposal(p))
    }

    if (toUpsert.length) {
      await supabase.from('consig_proposals').upsert(toUpsert, { onConflict: 'consig_id' })
      totalUpserted += toUpsert.length
    }

    if (shouldStop || page >= meta.pagination.totalPages) break
    page++
    await new Promise(r => setTimeout(r, 500)) // rate limit
  }

  await supabase.from('sync_state').upsert({
    source: 'consig360',
    last_incremental_sync: new Date().toISOString(),
    last_max_updated_at: maxUpdatedAt?.toISOString(),
    total_records: totalUpserted
  })

  return { totalUpserted, maxUpdatedAt }
}

function mapProposal(p: any) {
  return {
    consig_id: p.id,
    title: p.title,
    value: p.value || 0,
    status: p.status,
    sub_status: p.subStatus,
    partner_contract_id: p.partnerContractId,
    partner_status_slug: p.partnerStatus?.slug,
    partner_status_text: p.partnerStatus?.displayText,
    bank_id: p.bank?.id,
    bank_name: p.bank?.name,
    bank_slug: p.bank?.slug,
    bank_febraban_code: String(p.bank?.febrabanCode ?? ''),
    bank_logo: p.bank?.logo?.standard,
    product: p.product,
    created_at_api: p.createdAt,
    updated_at_api: p.updatedAt,
    crm_id: p.crmId,
    origin: p.origin,
    benefit_number: p.benefit?.number,
    client_cpf: p.client?.cpf,
    vinculated_proposals: p.vinculatedProposals,
    user_id: p.user?.id,
    squad_id: p.user?.squadId,
    is_cancellable: p.isCancellable,
    covenant_type: p.covenantType,
    client_formalization_url: p.clientFormalizationUrl,
    batch_id: p.batchId,
    raw_data: p,
    updated_at_local: new Date().toISOString()
  }
}
```

### 6.5 Detalhes por Proposta (opcional, segundo estágio)

```typescript
async function enrichProposalDetails(consigId: string) {
  const detail = await apiGet(`/franchise/v1/proposals/${consigId}`)
  await supabase.from('consig_proposals').update({
    portability_number: detail.portabilityNumber,
    expected_balance_date: detail.expectedBalanceDate,
    net_value: detail.netValue,
    debit_balance: detail.debitBalance,
    term: detail.term,
    installment_value: detail.installmentValue,
    coefficient: detail.coefficient,
    description: detail.description,
    contract_bank_name: detail.contract?.bank?.name,
    contract_bank_febraban_code: String(detail.contract?.bank?.febrabanCode ?? ''),
    contract_rate: detail.contract?.rate,
    contract_value: detail.contract?.value,
    contract_installments_paid: detail.contract?.installmentsPaid,
    contract_installment_value: detail.contract?.installmentValue,
    contract_debit_balance: detail.contract?.debitBalance,
    contract_type: detail.contract?.type,
    contract_code: detail.contract?.contractCode,
    contract_benefit_value: detail.contract?.benefitValue,
    contract_benefit_number: detail.contract?.benefitNumber,
    benefit_bank_code: detail.contract?.benefitBank?.code,
    benefit_bank_name: detail.contract?.benefitBank?.name,
    benefit_bank_agency: detail.contract?.benefitBank?.agency,
    benefit_bank_account: detail.contract?.benefitBank?.account,
    benefit_bank_febraban_code: detail.contract?.benefitBank?.febrabanCode,
    typed_at: detail.typedAt,
    first_due_date: detail.firstDueDate,
    pay_date: detail.payDate,
    finished_at: detail.finishedAt,
    timeline: detail.timeline,
    signed_contract: detail.signedContract
  }).eq('consig_id', consigId)
  await new Promise(r => setTimeout(r, 300)) // rate limit
}
```

---

## 7. Schema Supabase Criado

A tabela `consig_proposals` já foi criada no projeto (id `rirsmtyuyqxsoxqbgtpu`) com todos os campos acima indexados. Campos principais:

- `consig_id` (unique) — ID na API
- Todos os campos da proposta
- `raw_data` (jsonb) — JSON completo para auditoria/campos novos
- Indexes: status, bank, product, cpf, created_at_api, updated_at_api, portability_number

---

## 8. Próximos Passos para o Robô

1. ✅ Tabela criada
2. ⏳ Configurar secrets no Supabase:
   - `CONSIG360_EMAIL` = carlos@lhamascred.com.br
   - `CONSIG360_PASSWORD` = Lhamas@2024
3. ⏳ Criar Edge Function `sync-consig360` com código acima
4. ⏳ Agendar cron:
   - Modo FULL: diário 06:00 Brasília
   - Modo INCREMENTAL: hora em hora 08-18h seg-sex
5. ⏳ Criar Edge Function `notify-consig360-whatsapp` (espelhando notify-portability-whatsapp)
6. ⏳ Criar view `consig_proposals_enriched` com JOIN em parceiros
7. ⏳ Adicionar tela Consig360 no OpsManager (similar à Portabilidade)

---

## 9. Credenciais de Teste (carlos)

```
Email: carlos@lhamascred.com.br
Senha: Lhamas@2024
Squad: Lhamascred (6dfbd43d-a47d-4e20-adef-df6c0045695c)
Total de propostas disponíveis: 5.699
```

---

## 10. Referências

- Frontend URL: https://lhamascred.consig360.com.br
- API base: https://api-prod.consig360.com.br
- Docs públicos (limitados): https://consig360.com.br
- Empresa fabricante: Teddy Soluções (frontend: teddy-consignado-frontend)
- Auth: AWS Cognito (pool us-east-1_1rHdvI859)

---

*Documento gerado em 20/04/2026 após engenharia reversa do bundle JavaScript do frontend Consig360. Pode precisar de atualização se a API mudar.*
