// --- ESTADO INICIAL ---
let saldoTotal = parseFloat(localStorage.getItem('saldoTotal')) || 0;
let gastosTotal = parseFloat(localStorage.getItem('gastosTotal')) || 0;
let inventario = JSON.parse(localStorage.getItem('inventario')) || [];
let movimientos = JSON.parse(localStorage.getItem('movimientos')) || [];
let deudores = JSON.parse(localStorage.getItem('deudores')) || [];
// Tasa de respaldo actualizada a un valor más realista de finales de 2025
let tasaCambio = parseFloat(localStorage.getItem('tasaCambio')) || 285.50; 

window.addEventListener('load', () => {
    setTimeout(() => { document.getElementById('loader').style.display = 'none'; }, 500);
    obtenerTasaDolar();
    generarSelectorTallas();
    actualizarInterfaz();
});

// --- API TASA (Mejorada) ---
async function obtenerTasaDolar() {
    const el = document.getElementById('tasa-dolar');
    try {
        // Probamos con una ruta más directa o alternativa si la anterior falla
        const res = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');
        const data = await res.json();
        if(data.monitors && data.monitors.usd) {
            tasaCambio = data.monitors.usd.price;
            localStorage.setItem('tasaCambio', tasaCambio);
            el.innerHTML = `<i class="fa-solid fa-bolt"></i> BCV: ${tasaCambio} Bs.`;
        }
    } catch (e) {
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Tasa: ${tasaCambio} Bs. (Offline)`;
    }
    actualizarInterfaz();
}

// --- NAVEGACIÓN ---
window.showView = (id) => {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById('view-' + id).style.display = 'block';
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-' + id).classList.add('active');
};

// --- INTERFAZ DINÁMICA ---
function actualizarInterfaz() {
    const totalBs = (saldoTotal * tasaCambio).toLocaleString('es-VE', {minimumFractionDigits: 2});
    
    // Balance
    document.getElementById('total-amount').innerText = `${totalBs} Bs.`;
    document.getElementById('monto-usd-sub').innerText = `$ ${saldoTotal.toFixed(2)}`;

    // Stats
    document.getElementById('stat-ingresos').innerText = `$${saldoTotal.toFixed(2)}`;
    document.getElementById('stat-fiado').innerText = `$${deudores.reduce((s,d)=>s+d.monto,0).toFixed(2)}`;

    // Actividad Reciente (Mezcla Ventas y Comisiones)
    const elReciente = document.getElementById('lista-resumen-inicio');
    elReciente.innerHTML = movimientos.slice(-6).reverse().map(m => `
        <div class="recent-item ${m.tipo === 'venta' ? 'type-venta' : 'type-comision'}">
            <span>${m.tipo === 'venta' ? '👟' : '💳'} ${m.desc}</span>
            <b>$${parseFloat(m.monto).toFixed(2)}</b>
        </div>`).join('');

    // Inventario (CORREGIDO PARA EDITAR)
    document.getElementById('lista-inventario').innerHTML = inventario.map((item, i) => `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b>${item.tipo.toUpperCase()}</b>
                <button onclick="eliminarMod(${i})" style="color:var(--danger); border:none; background:none;"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
                ${Object.keys(item.tallas).map(t => `
                    <div class="badge-talla" onclick="editTalla(${i}, '${t}')" style="cursor:pointer; background:#f8f9fa; padding:8px; border-radius:8px; border:1px solid #ddd; min-width:60px; text-align:center;">
                        <small>T${t}</small><br><b>${item.tallas[t]}</b>
                    </div>
                `).join('')}
            </div>
        </div>`).join('');

    // Selectores de Venta
    document.getElementById('producto-tipo').innerHTML = '<option value="">¿Qué zapato vendió?</option>' + 
        inventario.map((item, i) => `<option value="${i}">${item.tipo}</option>`).join('');

    // Guardado
    localStorage.setItem('saldoTotal', saldoTotal);
    localStorage.setItem('inventario', JSON.stringify(inventario));
    localStorage.setItem('movimientos', JSON.stringify(movimientos));
    localStorage.setItem('deudores', JSON.stringify(deudores));
    actualizarGrafica();
}

// --- FUNCIONES DE ACCIÓN ---

window.editTalla = (idx, talla) => {
    const actual = inventario[idx].tallas[talla];
    const nuevo = prompt(`Modelo: ${inventario[idx].tipo}\nTalla: ${talla}\nCantidad actual: ${actual}\n\nIngrese la nueva cantidad:`, actual);
    if(nuevo !== null && nuevo !== "") {
        inventario[idx].tallas[talla] = parseInt(nuevo);
        actualizarInterfaz();
    }
};

// Venta
document.getElementById('venta-form').onsubmit = (e) => {
    e.preventDefault();
    const idx = document.getElementById('producto-tipo').value;
    const talla = document.getElementById('talla-venta').value;
    const monto = parseFloat(document.getElementById('monto-venta').value);
    
    if(!inventario[idx] || inventario[idx].tallas[talla] <= 0) return alert("No hay stock de esa talla.");

    inventario[idx].tallas[talla]--;
    saldoTotal += monto;
    movimientos.push({tipo:'venta', desc: `${inventario[idx].tipo} (T${talla})`, monto: monto, fechaComp: new Date().toLocaleDateString()});
    
    actualizarInterfaz(); e.target.reset();
    alert("¡Venta guardada!");
};

// Comisión
document.getElementById('servicio-form').onsubmit = (e) => {
    e.preventDefault();
    const monto = parseFloat(document.getElementById('monto-servicio').value);
    const pct = parseFloat(document.getElementById('porcentaje-comision').value);
    const ganancia = monto * (pct/100);
    
    const mov = {tipo: 'comisión', desc: `Punto: ${document.getElementById('cliente-nombre').value}`, monto: ganancia, fechaComp: new Date().toLocaleDateString()};
    movimientos.push(mov);
    saldoTotal += ganancia;
    
    actualizarInterfaz(); e.target.reset();
    alert(`Comisión de $${ganancia.toFixed(2)} registrada`);
};

// Importar Portapapeles
window.analizarDesdePortapapeles = async () => {
    try {
        const texto = await navigator.clipboard.readText();
        // Busca montos estilo "Bs. 1.500,00" o "Monto: 500"
        const coincidencia = texto.match(/(?:Bs\.?|Monto:)\s?([0-9.,]+)/i);
        if(coincidencia) {
            let bs = parseFloat(coincidencia[1].replace(/\./g, '').replace(',', '.'));
            let usd = bs / tasaCambio;
            if(confirm(`Detectado: ${bs} Bs. ($${usd.toFixed(2)})\n¿Registrar como venta rápida?`)) {
                saldoTotal += usd;
                movimientos.push({tipo:'venta', desc: 'Pago Móvil Rápido', monto: usd, fechaComp: new Date().toLocaleDateString()});
                actualizarInterfaz();
            }
        } else { alert("No se encontró un monto de Bolívar en el texto copiado."); }
    } catch (err) { alert("Error: Debes permitir el acceso al portapapeles en tu navegador."); }
};

// Cierre de Caja (Completo)
window.generarCierreCaja = () => {
    const hoy = new Date().toLocaleDateString();
    const mHoy = movimientos.filter(m => m.fechaComp === hoy);
    const v = mHoy.filter(m => m.tipo === 'venta').reduce((s,m)=>s+m.monto,0);
    const c = mHoy.filter(m => m.tipo === 'comisión').reduce((s,m)=>s+m.monto,0);
    const total = v + c;

    const texto = `📌 *CIERRE DE HOY: ${hoy}*\n\n` +
                  `👟 Ventas: $${v.toFixed(2)}\n` +
                  `💳 Puntos: $${c.toFixed(2)}\n` +
                  `--------------------------\n` +
                  `💰 TOTAL: $${total.toFixed(2)}\n` +
                  `🇻🇪 BS: ${(total * tasaCambio).toFixed(2)} Bs.\n\n` +
                  `Tasa usada: ${tasaCambio}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`);
};

// Gráfica y otros...
window.actualizarGrafica = () => {
    const cont = document.getElementById('grafica-semanal');
    if(!cont) return;
    const dias = ['D','L','M','M','J','V','S'];
    const hoy = new Date();
    let data = [];
    for(let i=6; i>=0; i--) {
        let d = new Date(); d.setDate(hoy.getDate()-i);
        let val = movimientos.filter(m => m.fechaComp === d.toLocaleDateString()).reduce((s,m)=>s+m.monto,0);
        data.push({n: dias[d.getDay()], v: val});
    }
    let max = Math.max(...data.map(d=>d.v)) || 1;
    cont.innerHTML = data.map(d => `<div class="graph-bar" style="height:${(d.v/max)*100}%" data-day="${d.n}"></div>`).join('');
};

window.generarSelectorTallas = () => {
    const cont = document.getElementById('tallas-selector');
    cont.innerHTML = "";
    for(let t=35; t<=45; t++) {
        cont.innerHTML += `<input type="checkbox" id="t${t}" class="talla-check" style="display:none" value="${t}">
                           <label for="t${t}" class="talla-label-box">${t}</label> `;
    }
};

window.actualizarTallasVenta = () => {
    const i = document.getElementById('producto-tipo').value;
    const sel = document.getElementById('talla-venta');
    if(i==="") return sel.innerHTML = "";
    sel.innerHTML = Object.keys(inventario[i].tallas).map(t => 
        `<option value="${t}">Talla ${t} (${inventario[i].tallas[t]} disp)</option>`
    ).join('');
};

window.eliminarMod = (i) => { if(confirm("¿Borrar este modelo?")) { inventario.splice(i,1); actualizarInterfaz(); } };
function toggleDarkMode() { document.body.classList.toggle('dark-theme'); }