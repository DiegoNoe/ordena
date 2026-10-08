/* Cálculos independientes de Firebase. No modifica el inventario antiguo. */
(function(root, factory) {
    var api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    else root.InventoryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const START = Date.parse('2026-10-01T00:00:00-06:00');
    const branches = {imperial1: 'Imperial 1', imperial2: 'Imperial 2 · ORDENA'};
    const types = {purchase:'Compra externa', transfer_dispatch:'Envío entre sucursales', transfer_receipt:'Recepción entre sucursales', sale:'Salida por venta / pedido', sale_pending:'Pedido para mañana (sin descontar)'};
    const number = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const unit = value => normalize(value).trim();
    const time = movement => typeof movement.effectiveAt === 'number' ? movement.effectiveAt : typeof movement.recordedAt === 'number' ? movement.recordedAt : Number(movement.capturedAt) || 0;
    const day = timestamp => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));
    function movements(tree, includeDemo) {
        return Object.entries(tree || {}).flatMap(([branch, items]) => Object.entries(items || {}).map(([id, record]) => ({...record, id, branch})))
            .filter(m => branches[m.branch] && time(m) >= START && (includeDemo || !m.isDemo)).sort((a,b)=>time(b)-time(a));
    }
    function effect(m, branch) {
        if(m.type === 'sale') return m.origin === branch ? -1 : 0;
        if(m.type === 'purchase') return m.destination === branch ? 1 : 0;
        if(m.type === 'transfer_dispatch' || m.type === 'transfer_receipt') {
            // Cualquiera de los dos botones completa el traslado. No registrar ambos para el mismo envío.
            if(m.origin === m.destination || !branches[m.origin] || !branches[m.destination]) return 0;
            return m.destination === branch ? 1 : m.origin === branch ? -1 : 0;
        }
        return 0;
    }
    function products(catalog, records, counts) {
        const all = new Map();
        Object.entries(catalog || {}).forEach(([key,p]) => {
            if(p && typeof p === 'object') {const code = String(p.clave || key); all.set(code,{code,description:p.descripcion || code,unit:p.unidad || ''});}
        });
        records.forEach(m=>Object.values(m.products || {}).forEach(p=>{
            if(p.code && !all.has(String(p.code))) all.set(String(p.code),{code:String(p.code),description:p.description || p.code,unit:p.unit || ''});
        }));
        Object.values(counts || {}).forEach(branch=>Object.values(branch || {}).forEach(item=>{
            const p = item.current;
            if(p && !all.has(p.code)) all.set(p.code,{code:p.code,description:p.description || p.code,unit:p.unit || ''});
        }));
        return [...all.values()].sort((a,b)=>a.description.localeCompare(b.description,'es',{numeric:true}));
    }
    function countFor(counts, branch, code) {
        return Object.values(counts[branch] || {}).find(c=>c.current && c.current.code===code) || null;
    }
    function balance(product, branch, counts, records) {
        const saved = countFor(counts,branch,product.code), count = saved && saved.current;
        if(!count || number(count.quantity)===null || typeof count.recordedAt!=='number') return {quantity:null,count:null,reason:'Sin conteo inicial'};
        if(unit(count.unit)!==unit(product.unit)) return {quantity:null,count,reason:'Unidad cambió; revisar conteo'};
        let quantity = Number(count.quantity), mismatch=false;
        records.forEach(m=>{
            if(time(m)<=count.recordedAt) return;
            const sign=effect(m,branch); if(!sign)return;
            Object.values(m.products || {}).filter(p=>String(p.code)===product.code).forEach(p=>{
                if(unit(p.unit)!==unit(product.unit) || number(p.quantity)===null) mismatch=true;
                else quantity+=sign*Number(p.quantity);
            });
        });
        return {quantity:mismatch?null:Math.round(quantity*1e6)/1e6,count,reason:mismatch?'Movimiento con unidad o cantidad incompatible':''};
    }
    function paymentState(m,payments,today) {
        const record=payments[m.branch] && payments[m.branch][m.id],current=record && record.current;
        const status=current && current.status==='paid'?'paid':'pending';
        const dueDate=current && current.dueDate || '';
        const bucket=status==='paid'?'paid':!dueDate?'undated':dueDate<today?'overdue':dueDate===today?'today':'future';
        return {status,dueDate,bucket,current};
    }
    function filter(records,options) {
        return records.filter(m=>{
            const d=day(time(m)),amount=number(m.pdfTotal);
            return (!options.branch || effect(m,options.branch)!==0 || m.type==='sale_pending' && m.origin===options.branch) && (!options.type || m.type===options.type)
                && (!options.from || d>=options.from) && (!options.to || d<=options.to)
                && (options.min==='' || amount!==null && amount>=Number(options.min))
                && (options.max==='' || amount!==null && amount<=Number(options.max))
                && (!options.query || normalize([m.name,m.documentReference,...Object.values(m.products||{}).map(p=>[p.code,p.description].join(' '))].join(' ')).includes(normalize(options.query)));
        });
    }
    return {START,branches,types,number,normalize,unit,time,day,movements,effect,products,countFor,balance,paymentState,filter};
});
