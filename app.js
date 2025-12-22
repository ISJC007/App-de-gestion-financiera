// 1. REGISTRO DEL SERVICE WORKER
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('✅ Service Worker activo'))
            .catch(err => console.warn('❌ Error al registrar SW', err));
    });
}

// 2. VARIABLES DE ESTADO
let saldoTotal = parseFloat(localStorage.getItem('saldoGuardado')) || 0;
let inventario = JSON.parse(localStorage.getItem('inventarioCalzado')) || [
    { tipo: 'Zapatos', cantidad: 0 },
    { tipo: 'Cholas', cantidad: 0 },
    { tipo: 'Sandalias', cantidad: 0 }
];
let historial = JSON.parse(localStorage.getItem('historialVentas')) || [];

// 3. ACTUALIZACIÓN DE INTERFAZ
function actualizarInterfaz() {
    const displaySaldo = document.getElementById('total-amount');
    if(displaySaldo) displaySaldo.innerText = `$ ${saldoTotal.toFixed(2)}`;
    
    const contInv = document.getElementById('lista-inventario');
    if(contInv) {
        contInv.innerHTML = '';
        inventario.forEach((item, index) => {
            contInv.innerHTML += `
                <div class="item-inventario">
                    <span><strong>${item.tipo}</strong></span>
                    <div>
                        <span style="margin-right:15px">${item.cantidad} prs</span>
                        <button class="btn-qty" onclick="ajustarStock(${index}, 1)">+</button>
                        <button class="btn-qty" onclick="ajustarStock(${index}, -1)">-</button>
                    </div>
                </div>`;
        });
    }

    const contHist = document.getElementById('lista-historial');
    if(contHist) {
        contHist.innerHTML = '';
        historial.slice(-5).reverse().forEach(v => {
            contHist.innerHTML += `
                <div style="padding: 10px 0; border-bottom: 1px solid #eee; font-size: 0.85rem;">
                    <span style="color:#7f8c8d">${v.fecha}</span> | <strong>${v.tipo} (T${v.talla})</strong> 
                    <span style="float:right; color:var(--primary); font-weight:bold">+$${v.monto}</span>
                </div>`;
        });
    }

    localStorage.setItem('saldoGuardado', saldoTotal);
    localStorage.setItem('inventarioCalzado', JSON.stringify(inventario));
    localStorage.setItem('historialVentas', JSON.stringify(historial));
}

// 4. LÓGICA DEL ESCÁNER QR
let html5QrCode;

document.getElementById('btn-abrir-lector').onclick = () => {
    document.getElementById('seccion-lector').style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        try {
            // AQUÍ USAMOS JSON.PARSE COMO INVESTIGASTE
            const datos = JSON.parse(decodedText);
            
            // Rellenamos el formulario automáticamente
            document.getElementById('producto-tipo').value = datos.tipo; // 0, 1 o 2
            document.getElementById('talla').value = datos.talla;
            document.getElementById('monto').value = datos.precio;
            
            detenerCamara();
            alert("✅ Producto cargado desde QR");
        } catch (e) {
            alert("❌ Error: El QR no tiene un formato JSON válido");
            console.error(e);
        }
    });
};

function detenerCamara() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('seccion-lector').style.display = 'none';
        });
    }
}

document.getElementById('btn-cerrar-lector').onclick = detenerCamara;

// 5. LÓGICA DE VENTAS
const ventaForm = document.getElementById('venta-form');
if(ventaForm) {
    ventaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const tipoIndex = document.getElementById('producto-tipo').value;
        const talla = document.getElementById('talla').value;
        const monto = parseFloat(document.getElementById('monto').value);
        const metodo = document.getElementById('metodo').value;

        if (inventario[tipoIndex].cantidad <= 0) {
            alert("⚠️ No hay stock disponible");
            return;
        }

        inventario[tipoIndex].cantidad -= 1;
        saldoTotal += monto;
        
        const ahora = new Date();
        const horaString = ahora.getHours() + ":" + ahora.getMinutes().toString().padStart(2, '0');
        
        historial.push({
            tipo: inventario[tipoIndex].tipo,
            talla: talla,
            monto: monto.toFixed(2),
            metodo: metodo,
            fecha: horaString
        });

        actualizarInterfaz();
        ventaForm.reset();
    });
}

// 6. CIERRE DE CAJA
document.getElementById('btn-cierre').onclick = () => {
    if (historial.length === 0) {
        alert("No hay ventas registradas.");
        return;
    }
    let efectivo = 0, pagomovil = 0, punto = 0;
    let cantZapatos = 0, cantCholas = 0, cantSandalias = 0;

    historial.forEach(v => {
        if (v.metodo === "Efectivo") efectivo += parseFloat(v.monto);
        if (v.metodo === "Pago Móvil") pagomovil += parseFloat(v.monto);
        if (v.metodo === "Punto") punto += parseFloat(v.monto);
        if (v.tipo === "Zapatos") cantZapatos++;
        if (v.tipo === "Cholas") cantCholas++;
        if (v.tipo === "Sandalias") cantSandalias++;
    });

    const mensajeCierre = `📊 RESUMEN:\n💵 Efectivo: $${efectivo.toFixed(2)}\n📲 Pago Móvil: $${pagomovil.toFixed(2)}\n💳 Punto: $${punto.toFixed(2)}\n-----------------------\n👟 Zapatos: ${cantZapatos}\n🩴 Cholas: ${cantCholas}\n👡 Sandalias: ${cantSandalias}\n-----------------------\n💰 TOTAL: $${(efectivo + pagomovil + punto).toFixed(2)}`;

    if (confirm(mensajeCierre)) {
        historial = [];
        actualizarInterfaz();
    }
};

window.ajustarStock = function(index, cambio) {
    if (inventario[index].cantidad + cambio >= 0) {
        inventario[index].cantidad += cambio;
        actualizarInterfaz();
    }
};

const btnVentaNav = document.getElementById('btn-venta-nav');
if(btnVentaNav) btnVentaNav.onclick = () => document.getElementById('form-venta').scrollIntoView({behavior:'smooth'});

const btnStockNav = document.getElementById('btn-stock-nav');
if(btnStockNav) btnStockNav.onclick = () => document.getElementById('seccion-inventario').scrollIntoView({behavior:'smooth'});

actualizarInterfaz();