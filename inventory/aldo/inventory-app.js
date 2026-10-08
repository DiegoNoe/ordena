(function() {
    'use strict';
    const C=InventoryCore, admin=document.body.dataset.view==='admin';
    const demo=new URLSearchParams(location.search).get('demo')==='1';
    const $=id=>document.getElementById(id);
    const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const money=value=>C.number(value)===null?'Sin monto':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value));
    const qty=value=>value===null?'—':new Intl.NumberFormat('es-MX',{maximumFractionDigits:6}).format(value);
    const date=value=>typeof value==='number'?new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Sin fecha';
    const branchLabel=b=>C.branches[b] || (b==='supplier'?'Proveedor externo':b==='customer'?'Cliente':b || 'Sin especificar');
    const keyFor=code=>'p_'+Array.from(code).map(c=>c.codePointAt(0).toString(16)).join('_');
    const state={catalog:{},movements:{},counts:{},payments:{},ready:false,connected:demo,tab:'inventory',page:0,products:[],records:[]};
    let db,selectedProduct=null,selectedMovement=null,expectedRevision=null;
    const demoKey='aldo-inventario-demo-v1';
    const badge=m=>m.isDemo?' <span class="pill warn">DEMO</span>':'';
    const branchOptions=Object.entries(C.branches).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    $('app').innerHTML=`<header><div><p>IMPERIAL · CONTROL DE MERCANCÍA</p><h1>${admin?'Inventario de Aldo':'Conteo de existencias'}</h1></div><a class="button" href="${admin?'conteo':'inventario'}.html${demo?'?demo=1':''}">${admin?'Abrir conteo':'Ver inventario'}</a></header>
    <main><div id="connection" class="status">Conectando…</div>
    ${demo?'<div class="notice demo"><strong>Demostración local.</strong> Las capturas y los pagos de esta vista se guardan solo en este navegador. No se envían a Firebase.</div>':''}
    <div class="notice"><strong>Seguimiento desde el 1 de octubre de 2026.</strong> Los saldos son provisionales: incluyen únicamente movimientos recibidos de terminales actualizadas. Imperial 1 registra cantidades del pedido; los pedidos para mañana no se descuentan. Cajas, piezas y kilos se mantienen separados.</div>
    <div class="toolbar"><label>Sucursal<select id="branch">${admin?'<option value="">Ambas sucursales</option>':''}${branchOptions}</select></label><label class="grow">Buscar producto, clave o nota<input id="search" type="search" placeholder="Escribe una clave o descripción" autocomplete="off"></label><label class="check"><input id="include-demo" type="checkbox" ${demo?'checked':''}>Incluir registros demo</label></div>
    ${admin?'<nav aria-label="Secciones"><button data-tab="inventory" class="selected">Inventario</button><button data-tab="movements">Movimientos</button><button data-tab="payments">Pagos pendientes</button></nav>':''}
    <div id="filters" class="filters" hidden><label>Desde<input id="from" type="date" min="2026-10-01"></label><label>Hasta<input id="to" type="date" min="2026-10-01"></label><label>Tipo<select id="type"><option value="">Todos</option>${Object.entries(C.types).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Monto mínimo<input id="min" type="number" min="0" step="0.01" placeholder="0"></label><label>Monto máximo<input id="max" type="number" min="0" step="0.01" placeholder="Sin límite"></label><label id="payment-filter" hidden>Vencimiento<select id="bucket"><option value="">Todos</option><option value="today">Vence hoy</option><option value="overdue">Vencido</option><option value="future">Por vencer</option><option value="undated">Sin fecha</option><option value="paid">Pagado</option></select></label><button id="clear-filters">Limpiar filtros</button></div>
    <div id="feedback" role="status" class="feedback"></div><div id="content"><p class="empty">Cargando catálogo y movimientos…</p></div><footer>El último conteo se registra por producto y sucursal. Cada traslado registrado afecta el origen y el destino una sola vez. No captures envío y recepción para la misma mercancía.</footer></main>
    <dialog id="detail"><button class="close" id="close-detail" aria-label="Cerrar">×</button><div id="detail-body"></div></dialog>
    <dialog id="count-dialog"><button class="close" id="close-count" aria-label="Cerrar">×</button><h2 id="count-title">Contar producto</h2><div id="count-info"></div><form id="count-form"><label>Existencia contada<input id="count-value" type="number" min="0" step="any" required inputmode="decimal"></label><label>Responsable<input id="count-actor" required maxlength="80" autocomplete="name"></label><label>Motivo<select id="count-reason"><option>Conteo físico</option><option>Corrección de conteo</option></select></label><p id="count-preview" class="summary"></p><p id="count-error" class="error" role="alert"></p><div class="actions"><button type="submit" class="primary" id="save-count">Confirmar conteo</button></div></form></dialog>`;
    // Se usa un solo diálogo por edición; las actualizaciones en tiempo real no borran lo que se escribe.
    function feedback(message,error=false){$('feedback').textContent=message;$('feedback').className=error?'feedback error':'feedback';}
    function connection(){ $('connection').textContent=demo?'Modo demo · guardado local':state.connected?'Conectado a ORDENA':'Sin conexión · no se pueden confirmar cambios'; }
    function refresh(){
        if(!state.ready)return;
        state.records=C.movements(state.movements,$('include-demo').checked);
        state.products=C.products(state.catalog,state.records,state.counts);
        render();
    }
    function matchingProducts(){const query=C.normalize($('search').value.trim());return state.products.filter(p=>C.normalize(p.code+' '+p.description).includes(query));}
    function cell(p,branch){const b=C.balance(p,branch,state.counts,state.records);return `<strong class="${b.quantity<0?'negative':''}">${b.quantity===null?esc(b.reason):qty(b.quantity)}</strong><small>${b.count?'Conteo: '+date(b.count.recordedAt):'Pendiente de contar'}</small>`;}
    function render(){
        const tab=state.tab,branch=$('branch').value;
        $('filters').hidden=!admin || tab==='inventory';
        $('payment-filter').hidden=tab!=='payments';
        if(!admin || tab==='inventory'){
            const all=matchingProducts(),pages=Math.max(1,Math.ceil(all.length/60));state.page=Math.min(state.page,pages-1);
            const list=all.slice(state.page*60,state.page*60+60);
            if(!admin){$('content').innerHTML=`<p class="muted">${all.length} productos · ${esc(branchLabel(branch))}. Elige el producto que acabas de contar.</p><div class="count-list">${list.map(p=>`<button class="count-product" data-count="${esc(p.code)}"><strong>${esc(p.description)}</strong><span>${esc(p.code)} · ${esc(p.unit || 'Sin unidad')}</span><small>${cell(p,branch)}</small><span class="pill">Registrar conteo</span></button>`).join('')}</div>`;}
            else {
                const bs=branch?[branch]:Object.keys(C.branches);
                const counted=all.filter(p=>bs.every(b=>C.balance(p,b,state.counts,state.records).count)).length;
                $('content').innerHTML=`<div class="cards"><div class="card"><span>Productos encontrados</span><strong>${all.length}</strong></div><div class="card"><span>Con conteo en ${branch?'esta sucursal':'ambas sucursales'}</span><strong>${counted}</strong></div><div class="card"><span>Pendientes de conteo</span><strong>${all.length-counted}</strong></div><div class="card"><span>Salidas por ventas</span><strong style="font-size:18px">Solo registradas</strong></div></div><div class="panel"><table><thead><tr><th>Producto / unidad</th>${bs.map(b=>`<th class="num">${esc(branchLabel(b))}<br>Saldo provisional</th>`).join('')}${!branch?'<th class="num">Total provisional</th>':''}</tr></thead><tbody>${list.map(p=>{
                    const totals=bs.map(b=>C.balance(p,b,state.counts,state.records).quantity);const total=totals.some(v=>v===null)?null:totals.reduce((a,b)=>a+b,0);
                    return `<tr><td><button class="link" data-product="${esc(p.code)}">${esc(p.description)}</button><small>${esc(p.code)} · ${esc(p.unit || 'Sin unidad')}</small></td>${bs.map(b=>`<td class="num">${cell(p,b)}</td>`).join('')}${!branch?`<td class="num">${total===null?'Incompleto':qty(total)}</td>`:''}</tr>`;
                }).join('')}</tbody></table>${!list.length?'<div class="empty">No hay productos con esa búsqueda.</div>':''}</div>`;
            }
            $('content').insertAdjacentHTML('beforeend',`<div class="pagination"><button id="prev" ${state.page===0?'disabled':''}>Anterior</button><span>${state.page+1} / ${pages}</span><button id="next" ${state.page+1>=pages?'disabled':''}>Siguiente</button></div>`);
            $('prev').onclick=()=>{state.page--;render()};$('next').onclick=()=>{state.page++;render()};return;
        }
        const options={branch,query:$('search').value.trim(),from:$('from').value,to:$('to').value,type:$('type').value,min:$('min').value,max:$('max').value};
        if(options.from && options.to && options.from>options.to || options.min!=='' && options.max!=='' && Number(options.min)>Number(options.max)){$('content').innerHTML='<div class="empty">Revisa el intervalo: el inicio no puede ser mayor que el final.</div>';return;}
        const records=C.filter(state.records,options);
        if(tab==='movements'){
            const ins=records.filter(m=>branch?C.effect(m,branch)>0:m.type==='purchase' || m.type==='transfer_receipt');
            const outs=records.filter(m=>branch?(C.effect(m,branch)<0 || m.type==='sale_pending' && m.origin===branch):m.type==='transfer_dispatch' || m.type==='sale' || m.type==='sale_pending');
            const movementList=items=>items.map(m=>`<button class="movement" data-movement="${esc(m.branch+'/'+m.id)}"><strong>${money(m.pdfTotal)}</strong>${esc(m.name)}${badge(m)}<small>${esc(C.types[m.type] || m.type)} · ${date(C.time(m))}</small><small>${esc(branchLabel(m.origin))} → ${esc(branchLabel(m.destination))}</small></button>`).join('') || '<p class="empty">Sin movimientos en este filtro.</p>';
            $('content').innerHTML=`<p class="muted">${records.length} registros. ${branch?'Separados por su efecto en esta sucursal.':'Separados por el botón usado para registrarlos; cada traslado afecta a ambas sucursales.'}</p><div class="columns"><section><h2>Entradas · ${ins.length}</h2><div class="panel">${movementList(ins)}</div></section><section><h2>Salidas · ${outs.length}</h2><div class="panel">${movementList(outs)}</div></section></div>`;
        }else renderPayments(records);
    }
    function renderPayments(records){
        const today=C.day(Date.now()), purchases=records.filter(m=>m.type==='purchase');
        const withStatus=purchases.map(m=>({m,p:C.paymentState(m,state.payments,today)}));
        const sum=bucket=>withStatus.filter(x=>bucket==='pending'?x.p.status==='pending':x.p.bucket===bucket).reduce((a,x)=>a+(C.number(x.m.pdfTotal)||0),0);
        const labels={today:'Vence hoy',overdue:'Vencida',future:'Por vencer',undated:'Sin fecha',paid:'Pagada'};
        const list=withStatus.filter(x=>!$('bucket').value || x.p.bucket===$('bucket').value);
        $('content').innerHTML=`<p class="muted">Solo compras externas. Los importes siguientes respetan sucursal, fechas y búsqueda; “sin fecha” no se considera vencido.</p><div class="cards">${[['Pendiente total','pending'],['Vence hoy','today'],['Vencido','overdue'],['Pendiente sin fecha','undated']].map(([label,bucket])=>`<div class="card"><span>${label}</span><strong>${money(sum(bucket))}</strong></div>`).join('')}</div><div class="panel"><table><thead><tr><th>Nota / proveedor</th><th>Sucursal</th><th>Fecha de entrada</th><th>Vencimiento</th><th class="num">Monto</th><th>Estado</th></tr></thead><tbody>${list.map(({m,p})=>`<tr><td><button class="link" data-movement="${esc(m.branch+'/'+m.id)}">${esc(m.name)}</button>${badge(m)}<small>${esc(m.documentReference)}</small></td><td>${esc(branchLabel(m.destination))}</td><td>${date(C.time(m))}</td><td>${esc(p.dueDate || 'Sin fecha')}</td><td class="num">${money(m.pdfTotal)}</td><td><span class="pill ${p.bucket==='overdue'?'warn':''}">${labels[p.bucket]}</span></td></tr>`).join('')}</tbody></table>${!list.length?'<div class="empty">No hay compras con estos filtros.</div>':''}</div>`;
    }
    function showProduct(code){
        const p=state.products.find(p=>p.code===code);if(!p)return;
        const branch=$('branch').value,bs=branch?[branch]:Object.keys(C.branches);
        const history=bs.flatMap(b=>{const saved=C.countFor(state.counts,b,code);return Object.values(saved && saved.history || {}).map(c=>({...c,branch:b}));}).sort((a,b)=>b.recordedAt-a.recordedAt);
        const relevant=state.records.filter(m=>(!branch || C.effect(m,branch) || m.type==='sale_pending' && m.origin===branch) && Object.values(m.products||{}).some(item=>String(item.code)===code));
        $('detail-body').innerHTML=`<h2>${esc(p.description)}</h2><p>${esc(p.code)} · ${esc(p.unit)}</p><div class="columns">${bs.map(b=>`<div class="summary"><b>${esc(branchLabel(b))}</b><p>${cell(p,b)}</p></div>`).join('')}</div><p class="muted">Saldo provisional: último conteo + entradas − salidas posteriores. Solo incluye ventas recibidas; los pesos de pedidos pueden ser aproximados.</p><h3>Conteos físicos</h3><ul class="details-list">${history.map(c=>`<li>${date(c.recordedAt)} · ${esc(branchLabel(c.branch))}: <b>${qty(c.quantity)} ${esc(c.unit)}</b><br>${esc(c.actor)} · ${esc(c.reason)}</li>`).join('') || '<li>Sin conteos registrados.</li>'}</ul><h3>Movimientos registrados</h3>${relevant.map(m=>`<button class="movement" data-movement="${esc(m.branch+'/'+m.id)}">${esc(C.types[m.type])}${badge(m)}<small>${date(C.time(m))} · ${esc(branchLabel(m.origin))} → ${esc(branchLabel(m.destination))}</small>${Object.values(m.products).filter(item=>String(item.code)===code).map(item=>`${qty(Number(item.quantity))} ${esc(item.unit)} · ${item.unitPrice!==undefined?'precio':'costo'} ${money(item.unitPrice ?? item.unitCost)}`).join('<br>')}</button>`).join('') || '<p>Sin movimientos desde el inicio del seguimiento.</p>'}`;
        $('detail').showModal();
    }
    function showMovement(path){
        const m=state.records.find(m=>m.branch+'/'+m.id===path);if(!m)return;selectedMovement=m;
        const payment=C.paymentState(m,state.payments,C.day(Date.now()));expectedRevision=payment.current && payment.current.revision || null;
        $('detail-body').innerHTML=`<h2>${esc(C.types[m.type] || m.type)} ${badge(m)}</h2><p><strong>${esc(m.name)}</strong><br>${esc(branchLabel(m.origin))} → ${esc(branchLabel(m.destination))}<br>${date(C.time(m))}</p><p class="muted">Referencia: ${esc(m.documentReference)}<br>Capturado en: ${esc(branchLabel(m.branch))}</p><div class="panel"><table><thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">${m.type==='sale' || m.type==='sale_pending'?'Precio de venta':'Costo unitario'}</th><th class="num">Importe</th></tr></thead><tbody>${Object.values(m.products || {}).map(p=>`<tr><td>${esc(p.description)}<small>${esc(p.code)} · ${esc(p.notes)}</small></td><td class="num">${qty(C.number(p.quantity))} ${esc(p.unit)}</td><td class="num">${money(p.unitPrice ?? p.unitCost)}</td><td class="num">${money(C.number(p.quantity)===null || C.number(p.unitPrice ?? p.unitCost)===null?null:Number(p.quantity)*Number(p.unitPrice ?? p.unitCost))}</td></tr>`).join('')}</tbody></table></div><h3>Total del PDF: ${money(m.pdfTotal)}</h3><p class="muted">Se conserva el total del PDF, incluido su redondeo.${m.discount?' Descuento aplicado: '+esc(m.discount)+'% (incluido en el total).':''}</p>${m.type==='purchase' && admin?`<form id="payment-form"><h3>Revisión del pago</h3><label>Estado<select id="payment-status"><option value="pending" ${payment.status==='pending'?'selected':''}>Pendiente</option><option value="paid" ${payment.status==='paid'?'selected':''}>Pagada</option></select></label><label>Fecha de vencimiento (opcional)<input type="date" id="due-date" value="${esc(payment.dueDate)}"></label><label>Responsable de la revisión<input id="payment-actor" required maxlength="80"></label><p class="muted">Esto registra el estado; no realiza un pago ni envía nada a Odoo.</p><p id="payment-error" class="error" role="alert"></p><button id="save-payment" class="primary">Guardar revisión</button></form>`:m.type==='sale' || m.type==='sale_pending'?'<p class="notice">'+(m.type==='sale_pending'?'Pedido para mañana: no descuenta existencias.':m.source==='pos_order'?'Cantidades del pedido de Imperial 1; pueden cambiar al surtir.':'Salida registrada al generar el ticket de caja.')+'</p>':'<p class="notice">Este traslado resta del origen y suma al destino. No registres también la operación opuesta para la misma mercancía.</p>'}`;
        if(!$('detail').open)$('detail').showModal();
        if($('payment-form'))$('payment-form').onsubmit=savePayment;
    }
    function openCount(code){
        const p=state.products.find(p=>p.code===code);if(!p)return;
        if(!p.unit){feedback('Este producto no tiene unidad. Debe definirse antes de contarlo.',true);return;}
        selectedProduct={...p,branch:$('branch').value};
        const saved=C.countFor(state.counts,selectedProduct.branch,code);expectedRevision=saved && saved.current && saved.current.id || null;
        $('count-title').textContent=p.description;
        $('count-info').innerHTML=`<p>${esc(branchLabel(selectedProduct.branch))} · ${esc(p.code)} · <b>${esc(p.unit)}</b></p><p>${cell(p,selectedProduct.branch)}</p><p class="muted">Captura en ${esc(p.unit)}. No conviertas cajas a piezas: sus equivalencias se revisarán después.</p>`;
        $('count-value').value='';$('count-error').textContent='';$('count-preview').textContent='Escribe la cantidad que contaste físicamente.';
        $('count-dialog').showModal();$('count-value').focus();
    }
    $('count-value').oninput=()=>{
        const value=C.number($('count-value').value),p=selectedProduct;
        if(value===null || value<0){$('count-preview').textContent='Escribe una cantidad válida, cero o mayor.';return;}
        const b=C.balance(p,p.branch,state.counts,state.records);
        $('count-preview').textContent=`Nuevo conteo: ${qty(value)} ${p.unit}. `+(b.quantity===null?'Será el punto de partida de este producto.':`Diferencia respecto al saldo provisional: ${qty(value-b.quantity)} ${p.unit}.`);
    };
    function validActor(id){const actor=$(id).value.trim();if(!actor)throw Error('Escribe el nombre del responsable.');return actor;}
    function ensureConnected(){if(!state.ready || !state.connected)throw Error('No hay conexión confirmada. Conserva la captura y vuelve a intentar cuando regrese.');}
    function timestamp(){return demo?Date.now():firebase.database.ServerValue.TIMESTAMP;}
    function newId(){return demo?'demo_'+Date.now()+'_'+Math.random().toString(16).slice(2):db.ref('inventoryCounts').push().key;}
    async function transaction(path,expected,field,entry){
        if(demo){
            const [root,branch,key]=path.split('/'),group=root==='inventoryCounts'?'counts':'payments';
            const before=state[group][branch] && state[group][branch][key] || null;
            if((before && before.current && before.current[field] || null)!==expected)throw Error('Otra persona actualizó este registro. Ciérralo y vuelve a abrirlo antes de guardar.');
            const next={...before,current:entry,history:{...before && before.history,[entry.id || entry.revision]:entry}};
            const nextState={...state,[group]:{...state[group],[branch]:{...state[group][branch],[key]:next}}};
            localStorage.setItem(demoKey,JSON.stringify({catalog:nextState.catalog,movements:nextState.movements,counts:nextState.counts,payments:nextState.payments}));
            state[group]=nextState[group];refresh();return;
        }
        await new Promise((resolve,reject)=>db.ref(path).transaction(current=>{
            if((current && current.current && current.current[field] || null)!==expected)return;
            return {...current,current:entry,history:{...current && current.history,[entry.id || entry.revision]:entry}};
        },(error,committed)=>error?reject(error):!committed?reject(Error('El registro cambió mientras lo revisabas. Ciérralo y vuelve a abrirlo.')):resolve(),false));
    }
    async function saveCount(event){
        event.preventDefault();const button=$('save-count');if(button.disabled)return;
        try{
            ensureConnected();const p=selectedProduct,value=C.number($('count-value').value),actor=validActor('count-actor');
            if(value===null || value<0 || value>1e12)throw Error('La cantidad debe ser un número entre 0 y 1,000,000,000,000.');
            const b=C.balance(p,p.branch,state.counts,state.records);
            const entry={id:newId(),code:p.code,description:p.description,unit:p.unit,branch:p.branch,quantity:value,actor,reason:$('count-reason').value,recordedAt:timestamp(),previousCountId:expectedRevision,previousProvisionalBalance:b.quantity,difference:b.quantity===null?null:Math.round((value-b.quantity)*1e6)/1e6,salesIntegrated:false};
            button.disabled=true;$('count-error').textContent='Guardando y esperando confirmación…';
            await transaction('inventoryCounts/'+p.branch+'/'+keyFor(p.code),expectedRevision,'id',entry);
            $('count-dialog').close();feedback('Conteo confirmado: '+p.description+' · '+qty(value)+' '+p.unit+'.');
        }catch(error){$('count-error').textContent=error.message;}finally{button.disabled=false;}
    }
    async function savePayment(event){
        event.preventDefault();const button=$('save-payment');if(button.disabled)return;
        try{
            ensureConnected();const actor=validActor('payment-actor'),m=selectedMovement,status=$('payment-status').value;
            const previous=C.paymentState(m,state.payments,C.day(Date.now())).current;
            const entry={revision:newId(),status,dueDate:$('due-date').value,actor,updatedAt:timestamp(),paidAt:status==='paid'?(previous && previous.status==='paid' && previous.paidAt || timestamp()):null};
            button.disabled=true;$('payment-error').textContent='Guardando y esperando confirmación…';
            await transaction('inventoryPayments/'+m.branch+'/'+m.id,expectedRevision,'revision',entry);
            $('detail').close();feedback('Estado de pago confirmado.');
        }catch(error){$('payment-error').textContent=error.message;}finally{button.disabled=false;}
    }
    $('count-form').onsubmit=saveCount;
    $('close-detail').onclick=()=>{if(!$('save-payment') || !$('save-payment').disabled)$('detail').close()};
    $('close-count').onclick=()=>{if(!$('save-count').disabled)$('count-dialog').close()};
    ['detail','count-dialog'].forEach(id=>$(id).addEventListener('cancel',event=>{if(id==='detail' && $('save-payment')?.disabled || id==='count-dialog' && $('save-count').disabled)event.preventDefault();}));
    document.addEventListener('click',event=>{
        const tab=event.target.closest('[data-tab]'),product=event.target.closest('[data-product]'),movement=event.target.closest('[data-movement]'),count=event.target.closest('[data-count]');
        if(tab){state.tab=tab.dataset.tab;if(state.tab==='payments')$('type').value='';$('type').disabled=state.tab==='payments';state.page=0;document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b===tab));render();}
        if(product)showProduct(product.dataset.product);if(movement)showMovement(movement.dataset.movement);if(count)openCount(count.dataset.count);
    });
    ['branch','search','include-demo','from','to','type','min','max','bucket'].forEach(id=>$(id).addEventListener('input',()=>{state.page=0;refresh()}));
    $('clear-filters').onclick=()=>{['from','to','type','min','max','bucket'].forEach(id=>$(id).value='');refresh()};
    function seedDemo(){
        const now=Date.now(),before=now-3600000,initial=before-3600000;
        const catalog={DEMO1:{clave:'DEMO1',descripcion:'Queso de prueba',unidad:'KILO'},DEMO2:{clave:'DEMO2',descripcion:'Crema de prueba',unidad:'PIEZA'},DEMO3:{clave:'DEMO3',descripcion:'Caja de prueba',unidad:'CAJA'}};
        const make=(id,branch,type,origin,destination,quantity,cost)=>({id,branch,type,origin,destination,isDemo:true,name:'Proveedor de ejemplo',documentReference:'DEMO-'+id,recordedAt:before,capturedAt:before,pdfTotal:quantity*cost,products:[{code:'DEMO1',description:'Queso de prueba',quantity,unit:'KILO',unitCost:cost,notes:'Datos ficticios'}]});
        const movements={imperial1:{compra1:make('compra1','imperial1','purchase','supplier','imperial1',10,100),envio1:make('envio1','imperial1','transfer_dispatch','imperial1','imperial2',2.5,100)},imperial2:{compra2:make('compra2','imperial2','purchase','supplier','imperial2',8,105),recepcion2:make('recepcion2','imperial2','transfer_receipt','imperial1','imperial2',1,100)}};
        const counts={};Object.keys(C.branches).forEach(branch=>{const current={id:'initial',code:'DEMO1',description:'Queso de prueba',unit:'KILO',branch,quantity:20,actor:'Ejemplo',reason:'Conteo físico',recordedAt:initial};counts[branch]={[keyFor('DEMO1')]:{current,history:{initial:current}}};});
        const payment={revision:'initial',status:'pending',dueDate:C.day(now),actor:'Ejemplo',updatedAt:initial};
        return {catalog,movements,counts,payments:{imperial1:{compra1:{current:payment,history:{initial:payment}}}}};
    }
    async function start(){
        if(demo){let saved;try{saved=JSON.parse(localStorage.getItem(demoKey));}catch(_){}Object.assign(state,saved || seedDemo());state.ready=true;connection();refresh();return;}
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='../js/firebase.js';script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar Firebase.'));document.head.appendChild(script);});
        const main=firebase.initializeApp({apiKey:'AIzaSyBhhniDRtbUoE1SGVCTZzVUPTbd5k-mfnI',authDomain:'cremeria-ordena.firebaseapp.com',databaseURL:'https://cremeria-ordena-default-rtdb.firebaseio.com',projectId:'cremeria-ordena'},'aldo-inventory');
        const catalog=firebase.initializeApp({apiKey:'AIzaSyDrVZ3499rhvfFpxfRbU-wqJ-ZUN0-_ez0',authDomain:'cremeria-imperial.firebaseapp.com',databaseURL:'https://cremeria-imperial.firebaseio.com',projectId:'cremeria-imperial'},'aldo-catalog');
        db=main.database();db.ref('.info/connected').on('value',s=>{state.connected=s.val()===true;connection()});
        const loaded=new Set();
        [[catalog.database().ref('productos'),'catalog'],[db.ref('inventoryMovements'),'movements'],[db.ref('inventoryCounts'),'counts'],[db.ref('inventoryPayments'),'payments']].forEach(([ref,key])=>ref.on('value',snapshot=>{
            state[key]=snapshot.val() || {};loaded.add(key);state.ready=loaded.size===4;refresh();
        },error=>{state.ready=false;feedback('No se pudo leer '+key+': '+error.message,true);$('content').innerHTML='<p class="empty">No se puede calcular el inventario mientras falten datos.</p>';}));
    }
    start().catch(error=>feedback(error.message,true));
})();
