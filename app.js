// --- ESTADO DE LA APLICACIÓN ---
let saldoTotal = parseFloat(localStorage.getItem('saldoTotal')) || 0;
let gastosTotal = parseFloat(localStorage.getItem('gastosTotal')) || 0;
let inventario = JSON.parse(localStorage.getItem('inventario')) || [];
let movimientos = JSON.parse(localStorage.getItem('movimientos')) || [];
let deudores = JSON.parse(localStorage.getItem('deudores')) || [];
let tasaCambio = parseFloat(localStorage.getItem('tasaCambio')) || 60.00;

// --- INICIO ---
window.addEventListener('load', () => {
    setTimeout(() => { document.getElementById('loader').style.display = 'none'; }, 800);
    generarSelectorTallas();
    obtenerTasaDolar();
    actualizarInterfaz();
});

// --- API TASA ---
async function obtenerTasaDolar() {
    const el = document.getElementById('tasa-dolar');
    try {
        const res = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');
        const data = await res.json();
        tasaCambio = data.monitors.usd.price;
        localStorage.setItem('tasaCambio', tasaCambio);
        el.innerHTML = `<i class="fa-solid fa-bolt"></i> Tasa BCV: ${tasaCambio} Bs.`;
    } catch (e) {
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Tasa: ${tasaCambio} Bs.`;
    }
    actualizarInterfaz();
}

// --- NAVEGACIÓN ---
window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById('view-' + id).style.display = 'block';
    document.getElementById('view-title').innerText = id.toUpperCase();
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + id).classList.add('active');
};

// --- CORE: ACTUALIZAR TODA LA INTERFAZ ---
function actualizarInterfaz() {
    const totalDolares = saldoTotal - gastosTotal;
    const totalBs = (totalDolares * tasaCambio).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Balance (Bolívares en Grande)
    document.getElementById('total-amount').innerText = `${totalBs} Bs.`;
    document.getElementById('monto-usd-sub').innerText = `$ ${totalDolares.toFixed(2)}`;

    // Stats
    document.getElementById('stat-ingresos').innerText = `$${saldoTotal.toFixed(2)}`;
    document.getElementById('stat-gastos').innerText = `$${gastosTotal.toFixed(2)}`;
    document.getElementById('stat-fiado').innerText = `$${deudores.reduce((s,d)=>s+d.monto,0).toFixed(2)}`;

    // Actividad Reciente
    const elReciente = document.getElementById('lista-resumen-inicio');
    elReciente.innerHTML = movimientos.slice(-5).reverse().map(m => `
        <div class="recent-item ${m.tipo === 'venta' ? 'type-venta' : 'type-comision'}">
            <span>${m.desc}</span>
            <b>$${parseFloat(m.monto).toFixed(2)}</b>
        </div>`).join('');

    // Inventario
    document.getElementById('lista-inventario').innerHTML = inventario.map((item, i) => `
        <div class="card">
            <div style="display:flex; justify-content:space-between"><b>${item.tipo}</b> <button onclick="eliminarMod(${i})" style="border:none;background:none;color:var(--danger)"><i class="fa-solid fa-trash"></i></button></div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
                ${Object.keys(item.tallas).map(t => `<div class="badge-talla" onclick="editTalla(${i},'${t}')" style="background:var(--f1f2f6); padding:5px 10px; border-radius:8px; font-size:0.8rem; border:1px solid var(--border-soft)">T${t}: ${item.tallas[t]}</div>`).join('')}
            </div>
        </div>`).join('');

    // Selectores
    document.getElementById('producto-tipo').innerHTML = '<option value="">Seleccionar Zapato...</option>' + 
        inventario.map((item, i) => `<option value="${i}">${item.tipo}</option>`).join('');

    // Deudas
    document.getElementById('lista-deudas').innerHTML = deudores.map(d => `
        <div class="card" style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><b>${d.nombre}</b><br><small>${d.concepto}</small></div>
                <div style="text-align:right"><b>$${d.monto.toFixed(2)}</b><br>
                <button onclick="cobrarWA(${d.id})" style="background:#25d366; color:white; border:none; border-radius:5px; padding:5px 10px; margin-top:5px;"><i class="fa-brands fa-whatsapp"></i></button>
                <button onclick="liquidarDeuda(${d.id})" style="background:var(--primary); color:white; border:none; border-radius:5px; padding:5px 10px;"><i class="fa-solid fa-check"></i></button></div>
            </div>
        </div>`).join('');

    // Guardado
    localStorage.setItem('saldoTotal', saldoTotal);
    localStorage.setItem('inventario', JSON.stringify(inventario));
    localStorage.setItem('deudores', JSON.stringify(deudores));
    localStorage.setItem('movimientos', JSON.stringify(movimientos));
    
    actualizarGrafica();
}

// --- FORMULARIOS ---

// Venta
document.getElementById('venta-form').onsubmit = (e) => {
    e.preventDefault();
    const i = document.getElementById('producto-tipo').value;
    const t = document.getElementById('talla-venta').value;
    const p = parseFloat(document.getElementById('monto-venta').value);
    
    if(i === "" || !inventario[i].tallas[t]) return alert("Selecciona producto y talla.");
    if(inventario[i].tallas[t] <= 0) return alert("Sin stock.");

    inventario[i].tallas[t]--;
    saldoTotal += p;
    movimientos.push({tipo:'venta', desc: `${inventario[i].tipo} (T${t})`, monto: p, fechaComp: new Date().toLocaleDateString()});
    
    actualizarInterfaz(); e.target.reset();
    alert("Venta registrada con éxito.");
};

// Comisión Punto
document.getElementById('servicio-form').onsubmit = (e) => {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('monto-servicio').value);
    const pct = parseFloat(document.getElementById('porcentaje-comision').value);
    const ganancia = monto * (pct/100);
    
    const mov = {tipo: 'comisión', desc: `Punto: ${document.getElementById('cliente-nombre').value}`, monto: ganancia, fechaComp: new Date().toLocaleDateString()};
    movimientos.push(mov);
    saldoTotal += ganancia;
    
    actualizarInterfaz(); e.target.reset();
    alert("Comisión guardada.");
};

// Fiado
document.getElementById('deuda-form').onsubmit = (e) => {
    e.preventDefault();
    deudores.push({
        id: Date.now(),
        nombre: document.getElementById('deudor-nombre').value,
        telefono: document.getElementById('deudor-telefono').value,
        concepto: document.getElementById('deudor-concepto').value,
        monto: parseFloat(document.getElementById('deudor-monto').value)
    });
    actualizarInterfaz(); e.target.reset();
};

// --- FUNCIONES EXTRA ---
window.liquidarDeuda = (id) => {
    const d = deudores.find(x => x.id === id);
    saldoTotal += d.monto;
    movimientos.push({tipo:'venta', desc: `Cobro Fiado: ${d.nombre}`, monto: d.monto, fechaComp: new Date().toLocaleDateString()});
    deudores = deudores.filter(x => x.id !== id);
    actualizarInterfaz();
};

window.generarCierreCaja = () => {
    const hoy = new Date().toLocaleDateString();
    const movs = movimientos.filter(m => m.fechaComp === hoy);
    const totalUsd = movs.reduce((s, m) => s + parseFloat(m.monto), 0);
    const msg = `📊 CIERRE HOY (${hoy})\nTotal: $${totalUsd.toFixed(2)}\nTotal Bs: ${(totalUsd * tasaCambio).toFixed(2)} Bs.`;
    if(confirm(msg)) window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
};

window.calcularVuelto = () => {
    const m = parseFloat(document.getElementById('monto-venta').value) || 0;
    const p = parseFloat(document.getElementById('paga-con').value) || 0;
    const v = p - m;
    const res = document.getElementById('resultado-vuelto');
    res.innerText = v >= 0 ? `Vuelto: $${v.toFixed(2)} (${(v*tasaCambio).toFixed(2)} Bs.)` : `Faltan: $${Math.abs(v).toFixed(2)}`;
    res.style.color = v >= 0 ? "var(--primary)" : "var(--danger)";
};

// (Auxiliares de stock y dark mode igual que antes...)
function generarSelectorTallas() {
    const cont = document.getElementById('tallas-selector');
    let html = '';
    for(let t=35; t<=45; t++) html += `<input type="checkbox" id="t${t}" class="talla-check" style="display:none" value="${t}"><label for="t${t}" onclick="this.style.background='var(--primary)';this.style.color='white'" style="padding:10px; border:1px solid var(--border-soft); border-radius:8px; font-size:0.8rem; cursor:pointer">${t}</label> `;
    cont.innerHTML = html;
}
window.ejecutarNuevoLote = () => {
    const n = document.getElementById('nuevo-modelo-nombre').value;
    const checks = document.querySelectorAll('.talla-check:checked');
    let obj = {}; checks.forEach(c => obj[c.value] = 1);
    if(n) { inventario.push({tipo: n, tallas: obj}); actualizarInterfaz(); }
};
window.actualizarTallasVenta = () => {
    const i = document.getElementById('producto-tipo').value;
    const sel = document.getElementById('talla-venta');
    if(i==="") return;
    sel.innerHTML = Object.keys(inventario[i].tallas).map(t => `<option value="${t}">Talla ${t} (${inventario[i].tallas[t]} disp)</option>`).join('');
};
window.actualizarGrafica = () => {
    const cont = document.getElementById('grafica-semanal');
    const dias = ['D','L','M','X','J','V','S'];
    const hoy = new Date();
    let datos = [];
    for(let i=6; i>=0; i--) {
        let d = new Date(); d.setDate(hoy.getDate()-i);
        let v = movimientos.filter(m => m.fechaComp === d.toLocaleDateString()).reduce((s,m)=>s+parseFloat(m.monto),0);
        datos.push({n: dias[d.getDay()], v: v});
    }
    let max = Math.max(...datos.map(d=>d.v)) || 1;
    cont.innerHTML = datos.map(d => `<div class="graph-bar" style="height:${(d.v/max)*100}%" data-day="${d.n}"></div>`).join('');
};
window.eliminarMod = (i) => { if(confirm("¿Borrar?")) { inventario.splice(i,1); actualizarInterfaz(); } };
function toggleDarkMode() { document.body.classList.toggle('dark-theme'); }