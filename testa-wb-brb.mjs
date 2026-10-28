// Confere o src/wbBrb.js contra os arquivos do Carlos (28/10/2026): "output_json 1.csv" (saída do main.py do InConta) →
// arquivo do WorkBank igual ao "Arquivo Padrao WORKBANK (39).xlsx", célula por célula (61 colunas), valor e TIPO da célula.
// O .csv vira o objeto que o robô grava (mesmos campos da API que o main.py usava).
import fs from 'node:fs'
import * as XLSX from 'xlsx'
import { brbLinha, brbTipo, brbBruto, brbSit } from './src/wbBrb.js'
const D='C:/Users/PC-OK/Downloads/'
const app=fs.readFileSync('./src/App.jsx','utf8').split('\r\n').join('\n')
const i0=app.indexOf('const WB_HDR='),WB_HDR=JSON.parse(app.slice(i0+'const WB_HDR='.length,app.indexOf('\n',i0)))
let falhas=0;const ok=(c,t)=>{console.log((c?'  ✓ ':'  ✗ ')+t);if(!c)falhas++}
const l=fs.readFileSync(D+'output_json 1.csv','utf8').split(/\r?\n/).filter(x=>x.trim()),h=l[0].split(';')
const iso=s=>s?s.split('/').reverse().join('-')+'T12:00:00.000Z':null
const api=l.slice(1).map(x=>{const c=x.split(';'),r=Object.fromEntries(h.map((k,i)=>[k,c[i]]))
  return{proposta_id:Number(r.ID),agente:r.AGENTE,cpf:r.CPF,nome:r.NOME,status_atual:r.STATUS,status_data:iso(r['STATUS DATA']),created_at:iso(r['CRIACAO AF']),
    convenio:r.CONVENIO,operacao:r.PRODUTO,valor_parcelas:r['VALOR DE PARCELA'],valor_ccb:r['VALOR PRINCIPAL'],valor_principal:r['VALOR PRINCIPAL'],
    valor_liquido:r['VALOR LIQUIDO'],prazo:r.PRAZO,taxa_juros_mensal:r['TAXA MENSAL'],tabela:r.TABELA}})
const hoje=new Date(2026,9,28,12,0,0)
const linhas=api.map(x=>brbLinha(x,WB_HDR,hoje))
const ws=XLSX.read(fs.readFileSync(D+'Arquivo Padrao WORKBANK (39).xlsx'),{cellDates:false}).Sheets.Planilha1
const rng=XLSX.utils.decode_range(ws['!ref']),cel=(r,c)=>ws[XLSX.utils.encode_cell({r,c})]
ok(WB_HDR.every((h,c)=>(cel(0,c)||{}).v===h),'cabeçalho do arquivo dele = WB_HDR')
ok(linhas.length===rng.e.r,'linhas: '+linhas.length+' × '+rng.e.r)
const serial=d=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(1899,11,30))/86400000)
const difs={};let iguais=0
linhas.forEach((o,i)=>{let igual=true
  WB_HDR.forEach((h,c)=>{const x=cel(i+1,c),v=o[h];let bate
    if(!x||x.v===''||x.v==null)bate=v==null||v===''
    else if(x.t==='n'&&/^DAT_/.test(h))bate=v instanceof Date&&serial(v)===Math.floor(x.v)
    else if(x.t==='n')bate=typeof v==='number'&&v===x.v
    else bate=typeof v==='string'&&v===x.v
    if(!bate){igual=false;(difs[h]=difs[h]||[]).push((i+2)+': meu='+JSON.stringify(v)+' dele='+JSON.stringify(x&&x.v))}})
  if(igual)iguais++})
ok(iguais===linhas.length,'linhas idênticas (valor e tipo da célula): '+iguais+' de '+linhas.length)
for(const[k,v]of Object.entries(difs))console.log('    ≠ '+k+' ('+v.length+'): '+v.slice(0,3).join(' | '))
ok(brbTipo('CONTRATO NOVO','x')==='NOVO'&&brbTipo('REFINANCIAMENTO','INSS REFIN DE PORT 1,85% I 96')==='PORTAB/REFIN'&&brbTipo('REFINANCIAMENTO','SIAPE REFIN PORT 1,60%')==='REFINANCIAMENTO'&&brbTipo('PORTABILIDADE','INSS PORT')==='PORTABILIDADE','tipo: NOVO / PORTAB/REFIN (REFIN DE PORT) / REFINANCIAMENTO / PORTABILIDADE')
ok(brbBruto({valor_ccb:0,valor_principal:'100.00'})===100&&brbBruto({valor_ccb:'250.50',valor_principal:'100'})===250.5&&brbBruto({valor_ccb:null,valor_principal:'7'})===7,'bruto: valor_ccb, e o principal quando o ccb é 0 (igual ao main.py)')
ok(brbSit({status_atual:'Pago'})==='INT'&&brbSit({status_atual:'Cancelada'})==='REP'&&brbSit({status_atual:'Aguardando Saldo'})==='AND','situação resumida para os filtros da tela')
const aoa=linhas.map(o=>WB_HDR.map(h=>o[h]))
const out=XLSX.write((()=>{const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet([WB_HDR,...aoa],{cellDates:true}),'Planilha1');return b})(),{type:'buffer',bookType:'xlsx',cellDates:true})
const ws2=XLSX.read(out,{cellDates:false}).Sheets.Planilha1,c2=(r,c)=>ws2[XLSX.utils.encode_cell({r,c})]
let tipos=0;for(let r=1;r<=linhas.length;r++)for(let c=0;c<61;c++){const a=cel(r,c),b=c2(r,c);const ta=a&&a.v!==''&&a.v!=null?a.t:'-',tb=b&&b.v!==''&&b.v!=null?(b.t==='d'?'n':b.t):'-';if(ta!==tb)tipos++}
ok(tipos===0,'arquivo gerado: tipo de célula igual ao dele ('+tipos+' diferentes)')
if(process.argv.includes('--xlsx'))fs.writeFileSync('C:/konsig-sync/Arquivo Padrao WORKBANK - BRB (teste 28-10).xlsx',out)
console.log(falhas?'❌ '+falhas+' falha(s)':'✅ tudo certo')
process.exit(falhas?1:0)
