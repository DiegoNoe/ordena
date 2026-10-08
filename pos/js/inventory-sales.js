/* Registro auxiliar de salidas. Nunca cambia filas, cobros, PDFs ni stock antiguo. */
(function(root) {
    'use strict';
    var prefix='imperial-inventory-sale-v1:', drafts={}, memory={}, active={}, ledger=null, offset=0;
    function notice(text,error) {
        try {
            if(!document.body) {document.addEventListener('DOMContentLoaded',function(){notice(text,error);},{once:true});return;}
            var el=document.getElementById('inventory-sales-status');
            if(!el){el=document.createElement('div');el.id='inventory-sales-status';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:4px;left:4px;z-index:9999;max-width:80vw;padding:5px 9px;font:13px sans-serif;border-radius:4px;';document.body.appendChild(el);}
            el.style.background=error?'#7b2525':'#214d3a';el.style.color='white';el.textContent=text;
        }catch(_){}
    }
    function warn(error){notice('Inventario: registro pendiente. No repitas el cobro; conserva el ticket. '+(error && error.message || ''),true);}
    function db(){
        if(!ledger){
            var app;
            try{app=root.firebase.app('inventory-sales');}catch(_){app=root.firebase.initializeApp({apiKey:'AIzaSyBhhniDRtbUoE1SGVCTZzVUPTbd5k-mfnI',databaseURL:'https://cremeria-ordena-default-rtdb.firebaseio.com',projectId:'cremeria-ordena'},'inventory-sales');}
            ledger=app.database();
            ledger.ref('.info/serverTimeOffset').on('value',function(s){offset=Number(s.val())||0;});
        }
        return ledger;
    }
    function uid(){return Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+Math.random().toString(36).slice(2);}
    function encode(value){return Array.from(String(value)).map(function(c){return c.codePointAt(0).toString(16);}).join('_');}
    function finite(value,label){if(value===null || value===undefined || value==='' || !Number.isFinite(Number(value)))throw Error('Dato inválido: '+label);return Number(value);}
    function make(input,id) {
        if(!['imperial1','imperial2'].includes(input.branch) || !input.rows || !input.rows.length)throw Error('Venta sin productos o sucursal.');
        var now=Date.now()+offset;
        return {schemaVersion:1,id:id,branch:input.branch,terminal:input.terminal,source:input.source,
            type:input.tomorrow?'sale_pending':'sale',origin:input.branch,destination:'customer',
            name:input.name || '',documentReference:input.documentReference || '',orderReference:input.orderReference || '',
            capturedAt:now,effectiveAt:now,recordedAt:root.firebase.database.ServerValue.TIMESTAMP,
            pdfTotal:finite(String(input.pdfTotal).replace(/,/g,''),'total PDF'),paymentMethod:input.paymentMethod || '',
            discount:Number(input.discount)||0,quantityBasis:input.source==='caja_ticket'?'ticket':'pedido',
            products:input.rows.map(function(row){
                var catalog=input.findProduct(row[0]);if(!catalog)throw Error('Producto no encontrado: '+row[0]);
                var captured=finite(row[1],'cantidad'),weighted=input.source==='caja_ticket' && !!row[10];
                var quantity=weighted?finite(row[10],'peso'):captured;
                // Los negativos del POS se cobran como magnitud; no son devoluciones.
                return {code:String(row[0]),description:String(row[3]),unit:weighted?'KILO':String(row[2]).trim(),
                    quantity:Math.abs(quantity),capturedQuantity:captured,capturedUnit:String(row[2]).trim(),
                    unitPrice:finite(weighted?catalog.pkilo:catalog.costo,'precio'),notes:String(row[4]||''),
                    quantityBasis:weighted?'peso_caja':'cantidad_capturada'};
            })};
    }
    function send(key,entry){
        if(active[key])return;
        active[key]=true;
        try{
            db().ref('inventoryMovements/'+entry.branch+'/'+entry.id).transaction(function(current){
                // Una misma referencia de caja, incluso desde otra terminal, no se descuenta dos veces.
                if(current!==null)return;
                return entry;
            },function(error,committed,snapshot){
                delete active[key];
                if(error){warn(error);return;}
                if(!committed && (!snapshot || !snapshot.val())){warn(Error('No se confirmó el movimiento.'));return;}
                delete memory[key];
                try{localStorage.removeItem(key);}catch(_){}
                notice('Inventario: salida registrada.',false);
            },false);
        }catch(error){delete active[key];warn(error);}
    }
    function record(input){
        try{
            var slot=input.branch+':'+input.terminal,stored;
            try{stored=sessionStorage.getItem(prefix+'draft:'+slot);}catch(_){}
            var token=drafts[slot] || stored || uid();drafts[slot]=token;
            try{sessionStorage.setItem(prefix+'draft:'+slot,token);}catch(_){}
            var id=input.orderReference?'sale_order_'+encode(input.orderReference):'sale_'+token;
            var key=prefix+input.branch+':'+id;
            var entry=make(input,id);
            // Una reimpresión mantiene el primer evento pendiente con su fecha original.
            try{var pending=localStorage.getItem(key);if(pending)entry=JSON.parse(pending);}catch(_){}
            if(memory[key])entry=memory[key];memory[key]=entry;
            try{localStorage.setItem(key,JSON.stringify(entry));}catch(error){warn(Error('No se pudo conservar copia local; no cierres esta página hasta sincronizar.'));}
            notice('Inventario: sincronizando salida…',false);send(key,entry);
        }catch(error){warn(error);}
    }
    function retry(){
        try{
            for(var i=0;i<localStorage.length;i++){
                var key=localStorage.key(i);
                if(key && key.indexOf(prefix)===0){
                    try{var entry=JSON.parse(localStorage.getItem(key));if(entry && entry.schemaVersion===1 && entry.id && ['imperial1','imperial2'].includes(entry.branch))memory[key]=entry;}catch(_){}
                }
            }
        }catch(_){}
        Object.keys(memory).forEach(function(key){send(key,memory[key]);});
    }
    function resetDraft(){
        try{
            var terminal=root.globalComputer;
            Object.keys(drafts).forEach(function(slot){if(slot.split(':')[1]===terminal){delete drafts[slot];try{sessionStorage.removeItem(prefix+'draft:'+slot);}catch(_){}}});
            ['imperial1','imperial2'].forEach(function(branch){try{sessionStorage.removeItem(prefix+'draft:'+branch+':'+terminal);}catch(_){}});
        }catch(_){}
    }
    root.InventorySales={record:record,resetDraft:resetDraft,retry:retry};
    root.addEventListener('online',retry);
    root.addEventListener('load',retry);
    root.setInterval(retry,30000);
})(window);
