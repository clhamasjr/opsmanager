// Confere o src/wbCrefBanco.js contra os arquivos do Carlos (28/10/2026): as planilhas do banco Crefisa ("Como vem do banco"
// = acesso PRISCILA, e "Como tem que ficar" = acesso EMILLY, que só veio já arrumada) → arquivo do WorkBank igual ao
// "workbank inclusao.xlsx", célula por célula (61 colunas), inclusive o TIPO da célula (texto × número × data).
// Também: a planilha já arrumada "(2)" dá o mesmo que a crua, e o arquivo gerado de verdade (XLSX) relido bate.
import fs from 'node:fs'
import * as XLSX from 'xlsx'
import { cbLerPlanilha, cbMontar, cbDataTxt, cbTipo } from './src/wbCrefBanco.js'
const D='C:/Users/PC-OK/Downloads/'
const app=fs.readFileSync('./src/App.jsx','utf8').split('\r\n').join('\n')
const i0=app.indexOf('const WB_HDR='),WB_HDR=JSON.parse(app.slice(i0+'const WB_HDR='.length,app.indexOf('\n',i0)))
let falhas=0;const ok=(c,t)=>{console.log((c?'  ✓ ':'  ✗ ')+t);if(!c)falhas++}
const ler=f=>cbLerPlanilha(XLSX,new Uint8Array(fs.readFileSync(D+f)))
const cru=ler('Como vem do banco.xlsx'),emilly=ler('Como tem que ficar.xlsx'),aj2=ler('Como tem que ficar (2).xlsx')
console.log('planilhas: cru',cru.rows.length,'(aba '+cru.aba+') · emilly',emilly.rows.length,'· ajustada (2)',aj2.rows.length)
const hoje=new Date(2026,9,28,12,0,0)
const R=cbMontar([{nome:'emilly',...emilly},{nome:'cru',...cru}],WB_HDR,hoje)
// o arquivo do Carlos, lido célula a célula (tipo + valor)
const ws=XLSX.read(fs.readFileSync(D+'workbank inclusao.xlsx'),{cellDates:false}).Sheets.Planilha1
const rng=XLSX.utils.decode_range(ws['!ref']),cel=(r,c)=>ws[XLSX.utils.encode_cell({r,c})]
ok(rng.e.c+1===61&&WB_HDR.every((h,c)=>(cel(0,c)||{}).v===h),'cabeçalho do arquivo dele = WB_HDR (61 colunas)')
ok(R.linhas.length===rng.e.r,'linhas: '+R.linhas.length+' × '+rng.e.r+' no arquivo dele')
const serial=d=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/86400000)   // data → nº de série (dia)
const difs={};let iguais=0
R.linhas.forEach((o,i)=>{let igual=true
  WB_HDR.forEach((h,c)=>{const x=cel(i+1,c),v=o[h]
    let bate
    if(!x||x.v===''||x.v==null)bate=v==null||v===''
    else if(x.t==='n'&&(h==='DAT_CTR_INCLUSAO'||h==='DAT_NASCIMENTO'))bate=v instanceof Date&&serial(v)===Math.floor(x.v)
    else if(x.t==='n')bate=typeof v==='number'&&v===x.v
    else bate=typeof v==='string'&&v===x.v
    if(!bate){igual=false;(difs[h]=difs[h]||[]).push((i+2)+': meu='+JSON.stringify(v)+' dele='+JSON.stringify(x&&x.v)+'('+(x&&x.t)+')')}})
  if(igual)iguais++})
ok(iguais===R.linhas.length,'linhas idênticas (valor e tipo da célula): '+iguais+' de '+R.linhas.length)
for(const[h,v]of Object.entries(difs))console.log('    ≠ '+h+' ('+v.length+'): '+v.slice(0,3).join(' | '))
// a ajustada (2) dá o mesmo que a crua
const Rc=cbMontar([cru],WB_HDR,hoje),Ra=cbMontar([aj2],WB_HDR,hoje)
ok(JSON.stringify(Rc.linhas)===JSON.stringify(Ra.linhas),'planilha já arrumada à mão "(2)" = planilha crua do banco ('+Ra.linhas.length+')')
// resumo
console.log('  acessos:',JSON.stringify(R.porAcesso),'· situação:',JSON.stringify(R.porSit),'· de',R.de,'a',R.ate,'· total R$',R.total.toFixed(2))
ok(!R.semUsuario&&!R.semData&&!R.estragadas&&!Object.keys(R.tiposNovos).length&&!R.repetidas&&!R.semProposta&&!Object.keys(R.outros).length,'nada sem usuário/data, nada repetido, nenhum tipo novo, nenhum outro banco')
// a mesma planilha escolhida 2 vezes não duplica
ok(cbMontar([cru,cru],WB_HDR,hoje).linhas.length===136&&cbMontar([cru,cru],WB_HDR,hoje).repetidas===136,'a mesma planilha 2 vezes: não duplica (136 repetidas ignoradas)')
// exportação NOVA do mesmo acesso escolhida junto com a antiga (outro nome): vale a baixada por último, em qualquer ordem
{const pagas=cru.rows.filter(r=>r.STATUS_PROPOSTA==='PAGO').slice(0,5).map(r=>r.NUMERO_CONTRATO||r.NUMERO_ADE)
 const antiga={nome:'antiga.xlsx',quando:Date.parse('2026-10-26T10:00:00'),rows:cru.rows.map(r=>pagas.includes(r.NUMERO_CONTRATO||r.NUMERO_ADE)?{...r,STATUS_PROPOSTA:'ANDAMENTO',DATA_ULTIMO_SUB_STATUS_BANCO:null}:r)}
 const nova={nome:'nova.xlsx',quando:Date.parse('2026-10-28T10:00:00'),rows:cru.rows}
 for(const [rot,ord] of [['antiga, nova',[antiga,nova]],['nova, antiga',[nova,antiga]]]){const X=cbMontar(ord,WB_HDR,hoje)
  ok(X.linhas.length===136&&X.porSit.PAGO===39&&X.linhas.filter(o=>pagas.includes(o.NUM_PROPOSTA)).every(o=>o.DSC_SITUACAO_EMPRESTIMO==='PAGO'&&o.DAT_CREDITO)&&X.acessoEmVarias.length===1,
   'antiga + nova do mesmo acesso ('+rot+'): vale a nova — PAGO '+X.porSit.PAGO+', aviso de acesso em 2 planilhas: '+X.acessoEmVarias.length)}}
ok(R.acessoEmVarias.length===0,'PRISCILA + EMILLY: nenhum acesso repetido (sem aviso)')
{const r0={...cru.rows.find(r=>r.STATUS_PROPOSTA==='PAGO'),DATA_ULTIMO_SUB_STATUS_BANCO:null},X=cbMontar([{nome:'x',rows:[r0,{...cru.rows[1],DATA_DIGITACAO_BANCO:'28-10-26'}]}],WB_HDR,hoje)
 ok(X.pagoSemCredito===1&&X.semData===1,'PAGO sem data de pagamento e data ilegível são contados (a tela avisa)')}
try{cbLerPlanilha(XLSX,new Uint8Array(Buffer.from('<html><table><tr><td>NUMERO_ADE</td></tr></table></html>')));ok(false,'HTML disfarçado deveria ser recusado')}catch(e){ok(/não é uma planilha do Excel/.test(e.message),'.xls que é HTML / .csv é recusado: '+e.message.slice(0,60)+'…')}
// borda
ok(cbDataTxt(46302)==='07/10/2026'&&cbDataTxt('7/10/2026')==='07/10/2026'&&cbDataTxt('2026-10-07')==='07/10/2026'&&cbDataTxt(null)===null,'data que passou pelo Excel (nº de série / sem zero / ISO) vira dd/mm/aaaa')
ok(cbTipo('001 - NOVO CONTRATO')==='NOVO'&&cbTipo('027 - REFINANCIAMENTO')==='REFINANCIAMENTO'&&cbTipo('NOVO')==='NOVO'&&cbTipo('099 - PORTABILIDADE')==='PORTABILIDADE','tipo: código tirado; desconhecido vai como vem (e a tela avisa)')
try{cbLerPlanilha(XLSX,new Uint8Array(fs.readFileSync(D+'workbank inclusao.xlsx')));ok(false,'arquivo errado deveria ser recusado')}catch(e){ok(/faltam as colunas/.test(e.message),'arquivo errado é recusado: '+e.message.slice(0,80)+'…')}
// o arquivo de verdade: gera como a tela gera e relê
const aoa=R.linhas.map(o=>WB_HDR.map(h=>o[h]))
const out=XLSX.write((()=>{const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([WB_HDR,...aoa],{cellDates:true}),'Planilha1');return b})(),{type:'buffer',bookType:'xlsx',cellDates:true})
const ws2=XLSX.read(out,{cellDates:false}).Sheets.Planilha1,c2=(r,c)=>ws2[XLSX.utils.encode_cell({r,c})]
let tipos=0;for(let r=1;r<=R.linhas.length;r++)for(let c=0;c<61;c++){const a=cel(r,c),b=c2(r,c);const ta=a&&a.v!==''&&a.v!=null?a.t:'-',tb=b&&b.v!==''&&b.v!=null?(b.t==='d'?'n':b.t):'-';if(ta!==tb)tipos++}
ok(tipos===0,'arquivo gerado: tipo de célula igual ao dele em todas as células ('+tipos+' diferentes)')
if(process.argv.includes('--xlsx'))fs.writeFileSync('C:/konsig-sync/Arquivo Padrao WORKBANK - CREFISACP banco (teste 28-10).xlsx',out)
console.log(falhas?'❌ '+falhas+' falha(s)':'✅ tudo certo')
process.exit(falhas?1:0)
