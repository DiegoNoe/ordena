const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../../../pos/js/inventory-sales.js'),'utf8');
function harness(shared={}){
 const persistent=new Map(),session=new Map();let error=null,commits=0,notices=[];
 const storage=map=>({get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const db={ref:p=>({on:(e,fn)=>fn({val:()=>0}),transaction:(fn,cb)=>{if(error){cb(error,false);return;}let current=shared[p]||null;const next=fn(current);if(next!==undefined){shared[p]=JSON.parse(JSON.stringify(next).replace(/\{"\.sv":"timestamp"\}/g,String(Date.now())));commits++;}cb(null,next!==undefined,{val:()=>shared[p]||null});}})};
 const firebase={app:()=>({database:()=>db}),database:{ServerValue:{TIMESTAMP:{'.sv':'timestamp'}}}};
 const element={style:{},setAttribute(){},set textContent(v){notices.push(v)}};
 const ctx={firebase,localStorage:storage(persistent),sessionStorage:storage(session),globalComputer:'CAJA1',document:{body:{appendChild(){}},getElementById:()=>element,createElement:()=>element},addEventListener(){},setInterval(){}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 return {api:ctx.InventorySales,ctx,shared,persistent,notices,commits:()=>commits,fail:v=>error=v};
}
const rows=[['CHN','3.5','KILO','CHULETA','NOTA','porPesarCamara','X',109,1,true,'4.13'],['M',1,'CAJA','MARGARINA','','aBodega','X',649,1,false]];
const input={branch:'imperial2',terminal:'CAJA1',source:'caja_ticket',orderReference:'CLIENTE. 12/34',documentReference:'PDF',name:'CLIENTE',rows,pdfTotal:'1,099',discount:0,findProduct:code=>code==='CHN'?{costo:109,pkilo:109}:{costo:649}};
let h=harness(),before=JSON.stringify(rows);h.api.record(input);assert.equal(h.commits(),1);const sale=Object.values(h.shared)[0];assert.equal(sale.pdfTotal,1099);assert.equal(sale.products[0].quantity,4.13);assert.equal(sale.products[0].unit,'KILO');assert.equal(sale.products[0].unitPrice,109);assert.equal(sale.products[1].quantity,1);assert.equal(JSON.stringify(rows),before);
h.api.record(input);assert.equal(h.commits(),1);let second=harness(h.shared);second.api.record({...input,terminal:'CAJA2'});assert.equal(second.commits(),0,'Misma nota en la otra caja no duplica');
h=harness();h.fail(Error('PERMISSION_DENIED'));h.api.record(input);assert.equal(h.persistent.size,1);assert.equal(h.commits(),0);assert(h.notices.some(x=>x.includes('pendiente')));h.fail(null);h.api.retry();assert.equal(h.commits(),1);assert.equal(h.persistent.size,0);
h=harness();h.ctx.globalComputer='liveView1';const pos={...input,branch:'imperial1',terminal:'liveView1',source:'pos_order',orderReference:'',tomorrow:false};h.api.record(pos);h.api.record({...pos,documentReference:'NEW RANDOM QR'});assert.equal(h.commits(),1);h.api.resetDraft();h.api.record(pos);assert.equal(h.commits(),2,'Nueva captura idéntica sí se registra');
h=harness();h.api.record({...pos,tomorrow:true});assert.equal(Object.values(h.shared)[0].type,'sale_pending');
h=harness();h.api.record({...input,rows:[['P','-2','PIEZA','P','','x']],findProduct:()=>({costo:5}),pdfTotal:10});assert.equal(Object.values(h.shared)[0].products[0].quantity,2);
h=harness();h.api.record({...input,rows:[['P',1,'KILO','P','','x','',1,1,true,'0']],findProduct:()=>({costo:5,pkilo:5}),pdfTotal:0});assert.equal(Object.values(h.shared)[0].products[0].quantity,0);
h=harness();h.api.record({...input,rows:Array.from({length:150},(_,i)=>['P'+i,2.5,'KILO','PRODUCTO','','x']),findProduct:()=>({costo:123.45})});assert.equal(Object.values(h.shared)[0].products.length,150);
h=harness();h.api.record({...input,findProduct:()=>{throw Error('Catálogo no disponible')}});assert.equal(h.commits(),0);assert(h.notices.some(x=>x.includes('pendiente')));
const C=require('../inventory-core.js'),t=Date.now();const counts={imperial2:{q:{current:{code:'CHN',quantity:10,unit:'KILO',recordedAt:t-10000}}}};
const event={...sale,effectiveAt:t-5000,recordedAt:t+10000};assert.equal(C.balance({code:'CHN',unit:'KILO'},'imperial2',counts,[event]).quantity,5.87);
counts.imperial2.q.current.recordedAt=t;assert.equal(C.balance({code:'CHN',unit:'KILO'},'imperial2',counts,[event]).quantity,10,'Reintento tardío no vuelve a restar antes del conteo');
assert.equal(C.effect({...event,type:'sale_pending'},'imperial2'),0);assert.equal(C.effect(event,'imperial1'),0);
console.log('OK salidas: pesos, precios, total PDF, 150 renglones, dos cajas/una nota, reimpresión, nueva captura, mañana, errores y reintento tardío.');
