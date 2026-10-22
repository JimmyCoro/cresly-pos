(function () {
  const catalogo = window.PZ_CATALOGO;
  const IVA_RATE = 0.15;
  const PEDIDO_ID = window.PZ_PEDIDO_ID || null;

  const carrito = [];
  let categoriaActiva = 'Todas';
  let busqueda = '';

  function productoPorcionIndividual() {
    return catalogo.productos.find(p => p.es_porcion_individual);
  }

  // ===== CATEGORÍAS =====
  // Un combo con categoría (ej. "Martes 2X1") sale en ese botón; los demás, en "Combos".
  function combosSinCategoria() {
    return catalogo.combos.filter(c => !c.categoria_display);
  }

  function construirCategorias() {
    const categorias = ['Todas', 'Pizzas'];
    if (combosSinCategoria().length) categorias.push('Combos');
    // El orden viene del admin. Una categoría cuyo único producto es la
    // porción individual no lleva botón: la porción ya sale en "Pizzas".
    (catalogo.categorias || []).forEach(cat => {
      const tieneItems = catalogo.combos.some(c => c.categoria_display === cat)
        || catalogo.productos.some(p => p.categoria_display === cat && !p.es_porcion_individual);
      if (tieneItems) categorias.push(cat);
    });
    return categorias;
  }

  function renderCategorias() {
    const categorias = construirCategorias();
    const cont = document.getElementById('vrCategorias');
    cont.innerHTML = '';
    categorias.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'vr-cat-chip' + (categoriaActiva === cat ? ' vr-cat-chip-active' : '');
      chip.textContent = cat;
      chip.addEventListener('click', () => { categoriaActiva = cat; renderCategorias(); renderGrid(); });
      cont.appendChild(chip);
    });
  }

  // ===== GRID DE PRODUCTOS =====
  function construirItems(cat, texto) {
    let items = [];

    if (cat === 'Todas' || cat === 'Pizzas') {
      catalogo.tamanos.forEach(t => items.push({ tipo: 'tamano', data: t }));
      const porcion = productoPorcionIndividual();
      if (porcion) items.push({ tipo: 'porcion', data: porcion });
    }
    if (cat === 'Todas') {
      catalogo.combos.forEach(c => items.push({ tipo: 'combo', data: c }));
    } else if (cat === 'Combos') {
      combosSinCategoria().forEach(c => items.push({ tipo: 'combo', data: c }));
    }
    if (cat === 'Todas') {
      catalogo.productos.filter(p => !p.es_porcion_individual)
        .forEach(p => items.push({ tipo: 'producto', data: p }));
    } else if (cat !== 'Pizzas' && cat !== 'Combos') {
      catalogo.combos.filter(c => c.categoria_display === cat)
        .forEach(c => items.push({ tipo: 'combo', data: c }));
      catalogo.productos.filter(p => p.categoria_display === cat && !p.es_porcion_individual)
        .forEach(p => items.push({ tipo: 'producto', data: p }));
    }

    if (texto) {
      items = items.filter(it => coincideBusqueda(it.data.nombre, texto));
    }
    return items;
  }

  function coincideBusqueda(nombre, texto) {
    return nombre.toLowerCase().includes(texto.toLowerCase());
  }

  function renderGrid() {
    const cont = document.getElementById('vrGrid');
    cont.innerHTML = '';
    const items = construirItems(categoriaActiva, busqueda);

    if (!items.length) {
      cont.innerHTML = '<p class="text-muted">No se encontraron productos</p>';
      return;
    }

    items.forEach(it => cont.appendChild(crearCardProducto(it)));
  }

  function crearCardProducto(it) {
    if (it.tipo === 'tamano') {
      const t = it.data;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vr-card';
      card.innerHTML = `
        <div class="vr-card-body">
          <div class="vr-card-cat">Pizza</div>
          <div class="vr-card-nombre">${t.nombre}</div>
          <div class="vr-card-footer">
            <span class="vr-card-precio">$${parseFloat(t.precio_base).toFixed(2)}</span>
            <span class="vr-card-icon-btn"><i class="fas fa-sliders-h"></i></span>
          </div>
        </div>`;
      card.addEventListener('click', () => abrirSelectorTamanoPizza(t));
      return card;
    }

    if (it.tipo === 'porcion') {
      const p = it.data;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vr-card';
      card.innerHTML = `
        <div class="vr-card-body">
          <div class="vr-card-cat">Pizza</div>
          <div class="vr-card-nombre">${p.nombre}</div>
          <div class="vr-card-footer">
            <span class="vr-card-precio">$${parseFloat(p.precio).toFixed(2)}</span>
            <span class="vr-card-icon-btn"><i class="fas fa-sliders-h"></i></span>
          </div>
        </div>`;
      card.addEventListener('click', () => abrirSelectorPorcion(p));
      return card;
    }

    if (it.tipo === 'combo') {
      const c = it.data;
      const tieneVariosTamanos = c.tamanos && c.tamanos.length > 1;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vr-card';
      card.innerHTML = `
        <div class="vr-card-body">
          <div class="vr-card-cat">${c.categoria_display || 'Combo'}</div>
          <div class="vr-card-nombre">${c.nombre}</div>
          ${c.descripcion ? `<div class="vr-card-desc">${c.descripcion}</div>` : ''}
          <div class="vr-card-footer">
            <span class="vr-card-precio">${tieneVariosTamanos ? 'desde ' : ''}$${parseFloat(c.precio_desde).toFixed(2)}</span>
            <span class="vr-card-icon-btn"><i class="fas fa-sliders-h"></i></span>
          </div>
        </div>`;
      card.addEventListener('click', () => abrirSelectorCombo(c));
      return card;
    }

    const p = it.data;

    if (p.alitas_cantidad > 0) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vr-card';
      card.innerHTML = `
        <div class="vr-card-body">
          <div class="vr-card-cat">${p.categoria_display}</div>
          <div class="vr-card-nombre">${p.nombre}</div>
          <div class="vr-card-footer">
            <span class="vr-card-precio">$${parseFloat(p.precio).toFixed(2)}</span>
            <span class="vr-card-icon-btn"><i class="fas fa-sliders-h"></i></span>
          </div>
        </div>`;
      card.addEventListener('click', () => abrirSelectorProductoAlitas(p));
      return card;
    }

    if (p.tipo_sabor_bebida === 'bebida' || p.tipo_sabor_bebida === 'michelada') {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vr-card';
      card.innerHTML = `
        <div class="vr-card-body">
          <div class="vr-card-cat">${p.categoria_display}</div>
          <div class="vr-card-nombre">${p.nombre}</div>
          <div class="vr-card-footer">
            <span class="vr-card-precio">$${parseFloat(p.precio).toFixed(2)}</span>
            <span class="vr-card-icon-btn"><i class="fas fa-sliders-h"></i></span>
          </div>
        </div>`;
      card.addEventListener('click', () => (
        p.tipo_sabor_bebida === 'bebida' ? abrirSelectorProductoBebida(p) : abrirSelectorProductoMichelada(p)
      ));
      return card;
    }

    // producto simple: sin modal. Empieza con "+" y al agregarlo se activa el stepper
    const cantidadInicial = obtenerCantidadCarrito(p.id);

    const card = document.createElement('div');
    card.className = 'vr-card' + (cantidadInicial > 0 ? ' vr-card-selected' : '');
    card.dataset.productoId = p.id;
    card.innerHTML = `
      <div class="vr-card-body">
        <div class="vr-card-cat">${p.categoria_display}</div>
        <div class="vr-card-nombre">${p.nombre}</div>
        <div class="vr-card-footer">
          <span class="vr-card-precio">$${parseFloat(p.precio).toFixed(2)}</span>
          <div class="vr-card-accion">${renderAccionProducto(cantidadInicial)}</div>
        </div>
      </div>`;

    vincularAccionProducto(card, p);

    return card;
  }

  function renderAccionProducto(cantidad) {
    if (cantidad > 0) {
      return `
        <div class="vr-stepper">
          <button type="button" class="vr-step-btn" data-accion="menos">-</button>
          <span class="vr-step-qty">${cantidad}</span>
          <button type="button" class="vr-step-btn vr-step-btn-plus" data-accion="mas">+</button>
        </div>`;
    }
    return `<button type="button" class="vr-card-icon-btn vr-card-icon-btn-plus" data-accion="mas"><i class="fas fa-plus"></i></button>`;
  }

  function vincularAccionProducto(card, p) {
    const accionEl = card.querySelector('.vr-card-accion');
    const masBtn = accionEl.querySelector('[data-accion="mas"]');
    const menosBtn = accionEl.querySelector('[data-accion="menos"]');

    if (masBtn) {
      masBtn.addEventListener('click', () => {
        agregarProductoSimple(p);
        actualizarAccionProducto(card, p);
      });
    }
    if (menosBtn) {
      menosBtn.addEventListener('click', () => {
        quitarUnoProductoSimple(p.id);
        actualizarAccionProducto(card, p);
      });
    }
  }

  function actualizarAccionProducto(card, p) {
    const nuevaCantidad = obtenerCantidadCarrito(p.id);
    card.classList.toggle('vr-card-selected', nuevaCantidad > 0);
    card.querySelector('.vr-card-accion').innerHTML = renderAccionProducto(nuevaCantidad);
    vincularAccionProducto(card, p);
  }

  function obtenerCantidadCarrito(productoId) {
    const item = carrito.find(it => it.kind === 'producto' && it.producto_id === productoId);
    return item ? item.cantidad : 0;
  }

  function quitarUnoProductoSimple(productoId) {
    const idx = carrito.findIndex(it => it.kind === 'producto' && it.producto_id === productoId);
    if (idx === -1) return;
    carrito[idx].cantidad -= 1;
    if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
    renderCarrito();
  }


  // Todo producto configurable se arma en la misma hoja por pasos
  // (handoff_combo): pizza, porción, alitas, bebida, michelada y combos.
  const configurador = window.pzCrearConfiguradorCombo({
    catalogo: catalogo,
    calcularPrecioUrl: window.PZ_URLS.calcularPrecio,
    csrfToken: window.CSRF_TOKEN,
    mostrarToast: mostrarToast,
    onAgregar: function (item) {
      carrito.push(item);
      mostrarToast(`Agregado: ${item._label}`);
      renderCarrito();
    },
  });

  function abrirSelectorTamanoPizza(tamano) {
    configurador.abrir({
      kind: 'pizza',
      nombre: `Pizza ${tamano.nombre}`,
      tamano: tamano,
      // La "Porción" es una sola porción: no tiene sentido partirla en dos sabores.
      permiteMitad: tamano.nombre !== 'Porción',
    });
  }

  function abrirSelectorCombo(combo) {
    configurador.abrir({ kind: 'combo', nombre: combo.nombre, combo: combo });
  }

  function abrirSelectorPorcion(producto) {
    configurador.abrir({ kind: 'porcion', nombre: producto.nombre, producto: producto });
  }

  function abrirSelectorProductoAlitas(producto) {
    configurador.abrir({ kind: 'producto_alitas', nombre: producto.nombre, producto: producto });
  }

  function abrirSelectorProductoBebida(producto) {
    configurador.abrir({ kind: 'producto_bebida', nombre: producto.nombre, producto: producto });
  }

  function abrirSelectorProductoMichelada(producto) {
    configurador.abrir({ kind: 'producto_michelada', nombre: producto.nombre, producto: producto });
  }

  function agregarProductoSimple(producto) {
    const existente = carrito.find(it => it.kind === 'producto' && it.producto_id === producto.id);
    if (existente) {
      existente.cantidad += 1;
    } else {
      carrito.push({
        kind: 'producto', cantidad: 1, observacion: '', producto_id: producto.id,
        _label: producto.nombre, _precio_unitario: parseFloat(producto.precio),
      });
    }
    mostrarToast(`Agregado: ${producto.nombre}`);
    renderCarrito();
  }

  // ===== TOAST =====
  let toastTimeout;
  function mostrarToast(texto) {
    const toast = document.getElementById('vrToast');
    document.getElementById('vrToastTexto').textContent = texto;
    toast.classList.remove('d-none');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.add('d-none'), 2500);
  }

  // ===== CARRITO =====
  // `_label` siempre llega como una sola cadena armada por el backend-side
  // equivalente en Python (ver ItemPreparacion.nombre_corto/modificadores
  // en pizzeria/models.py) — acá se parte igual, del lado del cliente,
  // porque el carrito se arma 100% en JS antes de guardar el pedido.
  function separarNombreMod(label) {
    const seps = [' - ', ': ', ' | '];
    let mejorPos = -1;
    let mejorSep = '';
    seps.forEach((sep) => {
      const pos = label.indexOf(sep);
      if (pos !== -1 && (mejorPos === -1 || pos < mejorPos)) { mejorPos = pos; mejorSep = sep; }
    });
    if (mejorPos === -1) return { nombre: label.trim(), mods: '' };
    const nombre = label.slice(0, mejorPos).trim();
    const mods = label.slice(mejorPos + mejorSep.length).trim().replace(/ \| /g, ' / ').replace(/, /g, ' / ');
    return { nombre, mods };
  }

  function totalProductos() {
    return carrito.reduce((suma, item) => suma + item._precio_unitario * item.cantidad, 0);
  }

  function cantidadItems() {
    return carrito.reduce((suma, item) => suma + item.cantidad, 0);
  }

  function renderCarrito() {
    const cont = document.getElementById('vrCartItems');

    if (!carrito.length) {
      cont.innerHTML = `
        <div class="vr-cart-empty">
          <div class="vr-cart-empty-icon"><i class="fas fa-cart-shopping"></i></div>
          <p class="vr-cart-empty-title">Agrega productos</p>
          <p class="vr-cart-empty-subtitle">Toca un platillo del menú para empezar la orden.</p>
        </div>`;
    } else {
      cont.innerHTML = carrito.map((item, idx) => {
        const subtotal = item._precio_unitario * item.cantidad;
        const { nombre, mods } = separarNombreMod(item._label);
        return `
          <div class="vr-cart-item">
            <div class="vr-cart-item-top">
              <div class="vr-cart-item-info">
                <span class="vr-cart-item-nombre">${escapeHtml(nombre)}</span>
                ${mods ? `<span class="vr-cart-item-mods">${escapeHtml(mods)}</span>` : ''}
              </div>
              <span class="vr-cart-item-precio">$${subtotal.toFixed(2)}</span>
            </div>
            ${item.observacion ? `<div class="vr-cart-item-nota"><i class="fas fa-note-sticky me-1"></i>${escapeHtml(item.observacion)}</div>` : ''}
            <div class="vr-cart-item-bottom">
              <button type="button" class="vr-cart-item-editar" onclick="vrEditarNotaCarrito(${idx})">
                <i class="fas fa-pencil"></i> Editar
              </button>
              <div class="vr-cart-item-stepper">
                <button type="button" class="vr-cart-item-step" onclick="vrCambiarCantidadCarrito(${idx}, -1)">-</button>
                <span class="vr-cart-item-qty">${item.cantidad}</span>
                <button type="button" class="vr-cart-item-step vr-cart-item-step-plus" onclick="vrCambiarCantidadCarrito(${idx}, 1)">+</button>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    actualizarOrden();
  }

  window.vrCambiarCantidadCarrito = function (idx, delta) {
    carrito[idx].cantidad += delta;
    if (carrito[idx].cantidad <= 0) {
      carrito.splice(idx, 1);
    }
    renderCarrito();
  };

  window.vrEditarNotaCarrito = function (idx) {
    const actual = carrito[idx].observacion || '';
    const nota = prompt('Nota para este producto (ej: sin cebolla, extra picante):', actual);
    if (nota === null) return;
    carrito[idx].observacion = nota.trim();
    renderCarrito();
  };

  function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  function vaciarPedido() {
    if (!carrito.length) return;
    if (!confirm('¿Vaciar el pedido?')) return;
    carrito.length = 0;
    renderCarrito();
    renderGrid(); // los steppers de las cards vuelven a "+"
  }

  document.getElementById('vrVaciar').addEventListener('click', vaciarPedido);

  // ===== ESTADO DE LA ORDEN (handoff_barra_orden §7) =====
  // Una sola regla, camposFaltantes(), decide todo lo demás: el borde rojo
  // de la barra, la sub-línea del subheader, la tarjeta de entrega y el
  // texto de los botones. No repetir validaciones en otro lado.
  const $ = (id) => document.getElementById(id);
  const TIPO_LABELS_UI = { mesa: 'Servirse', llevar: 'Llevar', delivery: 'Delivery' };
  const FALTA_CORTO = { mesa: 'mesa', telefono: 'teléfono', direccion: 'dirección', pago: 'pago', moto: 'moto' };
  const FALTA_LARGO = { mesa: 'mesa', telefono: 'teléfono', direccion: 'dirección', pago: 'forma de pago', moto: 'valor de la moto' };
  const PAGO_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
  const CAMPO_NOMBRE = { mesa: 'vrNombreMesa', llevar: 'vrNombreLlevar', delivery: 'vrNombreDelivery' };

  let tipoVenta = window.PZ_TIPO_INICIAL || 'llevar';
  // La barra se ve "pendiente" (borde rojo) hasta que se revisan los datos
  // una vez, aunque el modo no pida nada obligatorio (estado "vacía").
  let datosTocados = false;
  let pagoDelivery = null;
  let guardandoPedido = false;

  function esMovil() { return window.innerWidth <= 1023; }

  function nombreCliente() {
    const input = $(CAMPO_NOMBRE[tipoVenta]);
    return input ? input.value.trim() : '';
  }

  function telefono() { return $('vrTelefonoDelivery').value.trim(); }
  function direccion() { return $('vrNotasDelivery').value.trim().replace(/\s+/g, ' '); }

  function motoTexto() { return $('vrValorMoto').value.trim(); }

  function valorMoto() {
    if (tipoVenta !== 'delivery') return 0;
    const v = parseFloat(motoTexto());
    return isNaN(v) ? 0 : v;
  }

  function camposFaltantes() {
    if (PEDIDO_ID) return [];
    if (tipoVenta === 'mesa') return mesaSeleccionada() ? [] : ['mesa'];
    if (tipoVenta === 'delivery') {
      const faltan = [];
      if (!telefono()) faltan.push('telefono');
      if (!direccion()) faltan.push('direccion');
      if (!pagoDelivery) faltan.push('pago');
      if (motoTexto() === '' || isNaN(parseFloat(motoTexto()))) faltan.push('moto');
      return faltan;
    }
    return []; // Llevar: sin nombre se imprime como "Llevar #006".
  }

  // "agregar" | "completar" | "confirmar": qué le toca hacer al cajero.
  function siguientePaso() {
    if (!carrito.length) return 'agregar';
    if (camposFaltantes().length) return 'completar';
    return 'confirmar';
  }

  function enLista(claves, etiquetas) {
    const textos = claves.map(k => etiquetas[k]);
    if (textos.length <= 1) return textos.join('');
    return textos.slice(0, -1).join(', ') + ' y ' + textos[textos.length - 1];
  }

  function capitalizar(texto) { return texto.charAt(0).toUpperCase() + texto.slice(1); }
  function dinero(valor) { return '$' + valor.toFixed(2); }
  function plural(n, uno, varios) { return n === 1 ? uno : varios; }
  function numeroOrden() { return window.PZ_NUMERO_STR || ''; }

  function actualizarOrden() {
    renderTotales();
    renderBarra();
    renderSubheader();
    renderEntrega();
    renderBotonPedido();
    renderBotonDatos();
  }

  function renderTotales() {
    const productos = totalProductos();
    const subtotal = productos / (1 + IVA_RATE);
    const moto = valorMoto();
    $('vrSubtotal').textContent = dinero(subtotal);
    $('vrIva').textContent = dinero(productos - subtotal);
    $('vrMotoFila').hidden = !(tipoVenta === 'delivery' && moto > 0);
    $('vrMoto').textContent = dinero(moto);
    $('vrTotal').textContent = dinero(productos + moto);
    const n = cantidadItems();
    $('vrCartConteo').textContent = `${n} ${plural(n, 'item', 'items')}`;
  }

  // ===== BARRA DE ORDEN (§3) =====
  let itemsAnteriores = null;

  function renderBarra() {
    const n = cantidadItems();
    const num = $('vrBarraPedidoNum');
    num.textContent = `${n} ${plural(n, 'item', 'items')}`;
    $('vrBarraPedidoTotal').textContent = dinero(totalProductos() + valorMoto());
    $('vrBarraPedido').classList.toggle('vr-bo-pedido-activo', n > 0);
    if (itemsAnteriores !== null && itemsAnteriores !== n) {
      // Animación corta del número al agregar o quitar.
      num.classList.remove('vr-bo-pulso');
      void num.offsetWidth;
      num.classList.add('vr-bo-pulso');
    }
    itemsAnteriores = n;

    if (PEDIDO_ID) return; // al agregar a un pedido, la izquierda la pinta el servidor

    const faltan = camposFaltantes();
    const nombre = nombreCliente();
    const mesa = mesaSeleccionada();
    let titulo;
    if (tipoVenta === 'mesa') {
      titulo = mesa ? `Mesa ${mesa.nombre || mesa.numero}${nombre ? ' · ' + nombre : ''}` : 'Servirse · sin mesa';
    } else if (tipoVenta === 'delivery') {
      titulo = `Delivery · ${nombre || telefono() || 'sin cliente'}`;
    } else {
      titulo = `Llevar · ${nombre || 'sin cliente'}`;
    }

    let sub;
    if (faltan.length) {
      sub = `Falta: ${enLista(faltan, FALTA_CORTO)}`;
    } else if (!datosTocados) {
      sub = 'Toca para modo y datos';
    } else if (tipoVenta === 'mesa') {
      sub = `Servirse · ${personasSeleccionadas} ${plural(personasSeleccionadas, 'persona', 'personas')}`;
    } else if (tipoVenta === 'delivery') {
      sub = `${direccion()} · moto ${dinero(valorMoto())}`;
    } else {
      sub = nombre ? 'Toca para cambiar modo o datos' : `Se imprime como Llevar #${numeroOrden()}`;
    }

    $('vrBarraDatosTitulo').textContent = titulo;
    const subEl = $('vrBarraDatosSub');
    subEl.textContent = sub;
    subEl.classList.toggle('vr-bo-sub-aviso', faltan.length > 0);
    $('vrBarraDatos').classList.toggle('vr-bo-pendiente', faltan.length > 0 || !datosTocados);
  }

  // ===== SUBHEADER (§3: "#006 · Llevar · " + resaltado) =====
  function renderSubheader() {
    // Al agregar a un pedido ya abierto, el resumen del servidor es el correcto.
    if (PEDIDO_ID) return;
    const el = $('pzshResumen');
    if (!el) return;
    const faltan = camposFaltantes();
    const mesa = mesaSeleccionada();
    const nombre = nombreCliente();
    const n = cantidadItems();
    let hi;
    let tono = 'neutro';
    if (faltan.length) {
      hi = `falta ${FALTA_CORTO[faltan[0]]}`;
      tono = 'rojo';
    } else if (tipoVenta === 'mesa' && mesa) {
      hi = `Mesa ${mesa.nombre || mesa.numero}`;
    } else if (nombre) {
      hi = nombre;
    } else {
      hi = `${n} ${plural(n, 'producto', 'productos')}`;
    }
    el.innerHTML = `#${escapeHtml(numeroOrden())} · ${TIPO_LABELS_UI[tipoVenta]} · `
      + `<strong class="pzsh-hl-${tono}">${escapeHtml(hi)}</strong>`;
  }

  // ===== TARJETA DE ENTREGA en la hoja Pedido (§5) =====
  function renderEntrega() {
    const el = $('vrEntrega');
    if (!el) return;
    const faltan = camposFaltantes();
    const etiqueta = TIPO_LABELS_UI[tipoVenta].toUpperCase();

    if (faltan.length) {
      el.className = 'vr-entrega vr-entrega-falta';
      el.innerHTML = `
        <button type="button" class="vr-entrega-toque" data-abrir-datos>
          <span class="vr-entrega-textos">
            <span class="vr-entrega-etiqueta">${etiqueta} · FALTAN DATOS</span>
            <span class="vr-entrega-principal">${escapeHtml(capitalizar(enLista(faltan, FALTA_LARGO)))}</span>
            <span class="vr-entrega-linea">Toca para completar</span>
          </span>
          <span class="vr-entrega-chevron" aria-hidden="true">›</span>
        </button>`;
      return;
    }

    const nombre = nombreCliente();
    const lineas = [];
    let principal;
    if (tipoVenta === 'mesa') {
      const mesa = mesaSeleccionada();
      principal = `Mesa ${mesa.nombre || mesa.numero} · ${personasSeleccionadas} ${plural(personasSeleccionadas, 'persona', 'personas')}`;
      if (nombre) lineas.push({ texto: nombre });
    } else if (tipoVenta === 'delivery') {
      principal = `${nombre || 'Cliente'} · ${telefono()}`;
      lineas.push({ texto: direccion(), recorte: true });
      lineas.push({ texto: `${PAGO_LABELS[pagoDelivery]} · moto ${dinero(valorMoto())}`, fuerte: true });
    } else {
      principal = nombre || 'Sin nombre';
      if (!nombre) lineas.push({ texto: `Se imprime como Llevar #${numeroOrden()}` });
    }

    el.className = 'vr-entrega';
    el.innerHTML = `
      <div class="vr-entrega-textos">
        <span class="vr-entrega-etiqueta">${etiqueta}</span>
        <span class="vr-entrega-principal">${escapeHtml(principal)}</span>
        ${lineas.map(l => `<span class="vr-entrega-linea${l.recorte ? ' vr-entrega-linea-recorte' : ''}${l.fuerte ? ' vr-entrega-linea-fuerte' : ''}">${escapeHtml(l.texto)}</span>`).join('')}
      </div>
      <button type="button" class="vr-entrega-editar" data-abrir-datos>Editar</button>`;
  }

  if ($('vrEntrega')) {
    $('vrEntrega').addEventListener('click', function (e) {
      if (e.target.closest('[data-abrir-datos]')) abrirDatosDesdePedido();
    });
  }

  // ===== BOTONES: dicen el siguiente paso (§4 y §5) =====
  function textoCompletar() {
    if (tipoVenta === 'mesa') return 'Elegir mesa ›';
    return 'Completar datos de entrega ›';
  }

  function renderBotonPedido() {
    const btn = $('vrBtnConfirmarImprimir');
    const falta = $('vrFaltaPedido');
    const nota = $('vrNotaPedido');
    const paso = siguientePaso();
    const faltan = camposFaltantes();
    const textoConfirmar = PEDIDO_ID ? 'Agregar e imprimir' : 'Confirmar e imprimir';

    btn.classList.toggle('vr-btn-completar', paso === 'completar' && esMovil());
    falta.hidden = paso !== 'completar';
    falta.textContent = `Falta: ${enLista(faltan, FALTA_LARGO)}`;
    nota.hidden = paso !== 'confirmar';

    if (guardandoPedido) {
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    } else if (paso === 'agregar') {
      btn.disabled = true;
      btn.textContent = 'Agrega productos';
    } else if (paso === 'completar') {
      // En escritorio los datos están en este mismo panel: no hay hoja que abrir.
      btn.disabled = !esMovil();
      btn.textContent = esMovil() ? textoCompletar() : textoConfirmar;
    } else {
      btn.disabled = false;
      btn.textContent = textoConfirmar;
    }
  }

  function renderBotonDatos() {
    const btn = $('vrTipoSheetListo');
    if (!btn) return;
    const paso = siguientePaso();
    const total = dinero(totalProductos() + valorMoto());
    const falta = $('vrFaltaDatos');
    falta.hidden = paso !== 'completar';
    falta.textContent = `Falta: ${enLista(camposFaltantes(), FALTA_LARGO)}`;
    $('vrNotaDatos').hidden = paso !== 'agregar';

    if (guardandoPedido) {
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    } else if (paso === 'agregar') {
      btn.disabled = false;
      btn.textContent = tipoVenta === 'delivery' ? 'Agregar productos ›' : 'Volver al menú';
    } else {
      btn.disabled = paso === 'completar';
      btn.textContent = `Confirmar e imprimir · ${total}`;
    }
  }

  $('vrBtnConfirmarImprimir').addEventListener('click', function () {
    const paso = siguientePaso();
    if (paso === 'completar') abrirDatosDesdePedido();
    else if (paso === 'confirmar') guardarPedido();
  });

  $('vrTipoSheetListo').addEventListener('click', function () {
    if (siguientePaso() === 'confirmar') guardarPedido();
    else cerrarDatos();
  });

  // ===== TECLADO DE MESAS (modo Servirse) =====
  function renderMesaGrid() {
    const cont = $('vrMesaGrid');
    if (!cont) return;
    const mesas = catalogo.mesas || [];
    const libres = mesas.filter(m => m.libre).length;
    const libresLabel = $('vrMesasLibresCount');
    if (libresLabel) libresLabel.textContent = `${libres} libre${libres === 1 ? '' : 's'}`;

    const seleccionada = $('vrMesaSelect').value;
    cont.innerHTML = '';
    mesas.forEach(function (m) {
      const activa = String(m.id) === String(seleccionada);
      const celda = document.createElement('button');
      celda.type = 'button';
      celda.className = 'vr-mesa-celda'
        + (!m.libre && !activa ? ' vr-mesa-celda-ocupada' : '')
        + (activa ? ' vr-mesa-celda-activa' : '');
      celda.textContent = m.nombre || m.numero;
      if (m.libre || activa) {
        celda.addEventListener('click', function () { seleccionarMesa(m.id); });
      } else {
        celda.disabled = true;
      }
      cont.appendChild(celda);
    });

    const verCelda = document.createElement('button');
    verCelda.type = 'button';
    verCelda.className = 'vr-mesa-celda vr-mesa-celda-ver';
    verCelda.textContent = 'Ver';
    verCelda.addEventListener('click', function () { window.location.href = window.PZ_URLS.mapaMesas; });
    cont.appendChild(verCelda);
  }

  // ===== PERSONAS EN LA MESA =====
  // Se precarga con la capacidad de la mesa elegida (lo más común es que la
  // ocupen completa) y queda editable. Alimenta el "Dividir cuenta" del cobro.
  let personasSeleccionadas = 1;
  let personasEditadasAMano = false;

  function renderPersonas() {
    const num = $('vrPersonasNum');
    if (!num) return;
    num.textContent = String(personasSeleccionadas);
    $('vrPersonasTexto').textContent = personasSeleccionadas === 1 ? 'persona' : 'personas';
    $('vrPersonasMenos').disabled = personasSeleccionadas <= 1;

    const mesa = mesaSeleccionada();
    $('vrPersonasHint').textContent = mesa ? `Mesa ${mesa.nombre || mesa.numero} · ${mesa.capacidad} puestos` : '';
  }

  function cambiarPersonas(delta) {
    const nuevo = personasSeleccionadas + delta;
    if (nuevo < 1 || nuevo > 40) return;
    personasSeleccionadas = nuevo;
    personasEditadasAMano = true;
    renderPersonas();
    actualizarOrden();
  }

  function mesaSeleccionada() {
    const mesaId = $('vrMesaSelect').value;
    return (catalogo.mesas || []).find(m => String(m.id) === String(mesaId)) || null;
  }

  function seleccionarMesa(mesaId) {
    $('vrMesaSelect').value = String(mesaId);
    // Solo autocompletamos mientras el mesero no haya tocado el stepper: si ya
    // ajustó el número a mano, cambiar de mesa no debe pisarle el dato.
    if (!personasEditadasAMano) {
      const mesa = mesaSeleccionada();
      if (mesa && mesa.capacidad) personasSeleccionadas = mesa.capacidad;
    }
    renderMesaGrid();
    renderPersonas();
    actualizarOrden();
  }

  $('vrPersonasMenos').addEventListener('click', function () { cambiarPersonas(-1); });
  $('vrPersonasMas').addEventListener('click', function () { cambiarPersonas(1); });

  // ===== CHIPS "RECIENTES" (modo Llevar) =====
  function renderClientesRecientes() {
    const cont = $('vrClientesRecientes');
    if (!cont) return;
    cont.innerHTML = '';
    const elegir = function (nombre) {
      $('vrNombreLlevar').value = nombre;
      datosTocados = true;
      actualizarOrden();
    };
    (catalogo.clientes_recientes || []).forEach(function (nombre) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'vr-modo-chip';
      chip.textContent = nombre;
      chip.addEventListener('click', function () { elegir(nombre); });
      cont.appendChild(chip);
    });
    const sinNombre = document.createElement('button');
    sinNombre.type = 'button';
    sinNombre.className = 'vr-modo-chip vr-modo-chip-sinnombre';
    sinNombre.textContent = 'Sin nombre';
    sinNombre.addEventListener('click', function () { elegir(''); });
    cont.appendChild(sinNombre);
  }

  // ===== MODO (Servirse / Llevar / Delivery) =====
  function actualizarGrupoClienteDatos() {
    $('vrGrupoMesa').classList.toggle('d-none', tipoVenta !== 'mesa');
    $('vrGrupoLlevar').classList.toggle('d-none', tipoVenta !== 'llevar');
    $('vrGrupoDelivery').classList.toggle('d-none', tipoVenta !== 'delivery');
    document.querySelectorAll('.vr-modo-tab').forEach(t => {
      const activa = t.dataset.tipo === tipoVenta;
      t.classList.toggle('vr-modo-tab-active', activa);
      t.setAttribute('aria-selected', activa ? 'true' : 'false');
    });
  }

  function cambiarModo(tipo) {
    if (tipo === tipoVenta) return;
    // El nombre es el único dato común: pasa al modo nuevo si ahí está vacío.
    const nombre = nombreCliente();
    tipoVenta = tipo;
    const destino = $(CAMPO_NOMBRE[tipo]);
    if (nombre && destino && !destino.value.trim()) destino.value = nombre;
    datosTocados = true;
    actualizarGrupoClienteDatos();
    actualizarOrden();
  }

  document.querySelectorAll('.vr-modo-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { cambiarModo(this.dataset.tipo); });
  });

  // ===== UBICACIÓN RESPONSIVE DE #vrTipoYDatos =====
  // En desktop vive inline dentro de #vrCart (barra lateral siempre
  // visible). En mobile/tablet (≤1023px) se muda dentro de la hoja
  // "Datos de la orden", que abre la zona izquierda de la barra de orden.
  (function () {
    const wrap = $('vrTipoYDatos');
    const sheetBody = $('vrTipoSheetBody');
    if (!wrap || !sheetBody) return;
    const originalParent = wrap.parentNode;
    const originalNext = wrap.nextSibling;
    let enHoja = false;

    function actualizarUbicacion() {
      const angosto = esMovil();
      if (angosto && !enHoja) { sheetBody.appendChild(wrap); enHoja = true; }
      else if (!angosto && enHoja) { originalParent.insertBefore(wrap, originalNext); enHoja = false; }
    }

    actualizarUbicacion();
    window.addEventListener('resize', function () { actualizarUbicacion(); actualizarOrden(); });
  })();

  // ===== HOJAS: Datos, Pedido y "⋯" =====
  const hojaDatos = $('vrTipoSheet');
  const fondoDatos = $('vrTipoSheetBackdrop');
  const hojaPedido = $('vrCart');
  const fondoPedido = $('vrPedidoBackdrop');
  const hojaMas = $('vrMasSheet');
  const fondoMas = $('vrMasBackdrop');
  const masOpciones = $('pzshMasOpciones');

  if (window.pzMoverAlBodyEnMobile) {
    [hojaDatos, fondoDatos, hojaPedido, fondoPedido, hojaMas, fondoMas, $('vrBarraOrden')]
      .forEach(el => el && window.pzMoverAlBodyEnMobile(el));
  }

  function hojaAbierta(hoja) { return hoja.classList.contains('pz-cart-sheet-open'); }

  function abrirHoja(hoja, fondo) {
    hoja.classList.add('pz-cart-sheet-open');
    fondo.classList.add('active');
  }

  function cerrarHoja(hoja, fondo) {
    hoja.classList.remove('pz-cart-sheet-open');
    fondo.classList.remove('active');
  }

  function abrirDatos() {
    if (PEDIDO_ID || !esMovil()) return;
    cerrarPedido();
    cerrarMas();
    abrirHoja(hojaDatos, fondoDatos);
  }

  // Cerrar (con el botón, el overlay, Esc o deslizando) conserva lo escrito.
  function cerrarDatos() {
    if (!hojaAbierta(hojaDatos)) return;
    cerrarHoja(hojaDatos, fondoDatos);
    datosTocados = true;
    actualizarOrden();
  }

  function abrirPedido() {
    if (!esMovil()) return;
    cerrarDatos();
    cerrarMas();
    abrirHoja(hojaPedido, fondoPedido);
  }

  function cerrarPedido() { cerrarHoja(hojaPedido, fondoPedido); }

  function abrirDatosDesdePedido() {
    cerrarPedido();
    abrirDatos();
  }

  function abrirMas() {
    if (!hojaMas) return;
    cerrarDatos();
    cerrarPedido();
    abrirHoja(hojaMas, fondoMas);
    if (masOpciones) masOpciones.setAttribute('aria-expanded', 'true');
  }

  function cerrarMas() {
    if (!hojaMas) return;
    cerrarHoja(hojaMas, fondoMas);
    if (masOpciones) masOpciones.setAttribute('aria-expanded', 'false');
  }

  $('vrBarraDatos').addEventListener('click', abrirDatos);
  $('vrBarraPedido').addEventListener('click', function () {
    if (hojaAbierta(hojaPedido)) cerrarPedido(); else abrirPedido();
  });
  fondoDatos.addEventListener('click', cerrarDatos);
  fondoPedido.addEventListener('click', cerrarPedido);
  if (fondoMas) fondoMas.addEventListener('click', cerrarMas);
  if (masOpciones) masOpciones.addEventListener('click', abrirMas);
  if ($('vrMasVaciar')) {
    $('vrMasVaciar').addEventListener('click', function () { cerrarMas(); vaciarPedido(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    cerrarDatos();
    cerrarPedido();
    cerrarMas();
  });

  // Deslizar hacia abajo cierra la hoja (solo si su contenido está arriba
  // del todo, para no pelear con el scroll interno).
  function permitirDeslizar(hoja, cerrar) {
    if (!hoja) return;
    let inicioY = null;
    let dy = 0;
    hoja.addEventListener('touchstart', function (e) {
      if (!hojaAbierta(hoja) || hoja.scrollTop > 0 || e.target.closest('input, textarea, .vr-modo-envio')) {
        inicioY = null;
        return;
      }
      inicioY = e.touches[0].clientY;
      dy = 0;
    }, { passive: true });
    hoja.addEventListener('touchmove', function (e) {
      if (inicioY === null) return;
      dy = Math.max(0, e.touches[0].clientY - inicioY);
      if (dy > 0) {
        hoja.style.transition = 'none';
        hoja.style.transform = `translateY(calc(-1 * var(--pz-bottomnav-h) + ${dy}px))`;
      }
    }, { passive: true });
    hoja.addEventListener('touchend', function () {
      if (inicioY === null) return;
      hoja.style.transition = '';
      hoja.style.transform = '';
      if (dy > 90) cerrar();
      inicioY = null;
    });
  }

  permitirDeslizar(hojaDatos, cerrarDatos);
  permitirDeslizar(hojaPedido, cerrarPedido);
  permitirDeslizar(hojaMas, cerrarMas);

  // ===== CAMPOS DE TEXTO =====
  ['vrNombreMesa', 'vrNombreLlevar', 'vrNombreDelivery', 'vrNotasDelivery', 'vrTelefonoDelivery'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      datosTocados = true;
      actualizarOrden();
    });
  });

  // ===== DATOS DE ENTREGA (Delivery): forma de pago =====
  // Efectivo: el motorizado cobra el total directo al cliente. Transferencia:
  // ya se cobró (o se cobra) por transferencia, así que el motorizado no
  // cobra nada al entregar — solo le pagamos su valor de moto aparte.
  document.querySelectorAll('#vrPagoDeliveryTabs .vr-modo-pago-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      pagoDelivery = this.dataset.valor;
      document.querySelectorAll('#vrPagoDeliveryTabs .vr-modo-pago-btn').forEach(function (b) {
        b.classList.toggle('vr-modo-pago-btn-active', b === btn);
      });
      actualizarOrden();
    });
  });

  // ===== DATOS DE ENTREGA (Delivery): valor de la moto =====
  function marcarBotonMoto(valor) {
    document.querySelectorAll('#vrCostoEnvioTabs .vr-modo-envio-btn').forEach(function (btn) {
      btn.classList.toggle('vr-modo-envio-btn-active', valor !== null && btn.dataset.valor === valor);
    });
  }

  document.querySelectorAll('#vrCostoEnvioTabs .vr-modo-envio-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      marcarBotonMoto(this.dataset.valor);
      $('vrValorMoto').value = this.dataset.valor;
      $('vrValorMoto').classList.remove('vr-modo-envio-otro-activo');
      actualizarOrden();
    });
  });

  $('vrValorMoto').addEventListener('input', function () {
    marcarBotonMoto(null);
    this.classList.toggle('vr-modo-envio-otro-activo', this.value.trim() !== '');
    actualizarOrden();
  });

  // ===== CLIENTE CONOCIDO POR TELÉFONO (§4) =====
  // Debounce de 300 ms y mínimo 7 dígitos; "Usar" llena nombre y última dirección.
  let busquedaTel = null;
  let clienteConocido = null;

  function ocultarClienteConocido() {
    clienteConocido = null;
    $('vrClienteConocido').hidden = true;
  }

  $('vrTelefonoDelivery').addEventListener('input', function () {
    clearTimeout(busquedaTel);
    const digitos = this.value.replace(/\D/g, '');
    if (digitos.length < 7) { ocultarClienteConocido(); return; }
    busquedaTel = setTimeout(function () {
      fetch(`${window.PZ_URLS.buscarCliente}?tel=${encodeURIComponent(digitos)}`, { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : null))
        .then(function (data) {
          // Si el número cambió mientras llegaba la respuesta, se descarta.
          if ($('vrTelefonoDelivery').value.replace(/\D/g, '') !== digitos) return;
          if (!data || !data.encontrado) { ocultarClienteConocido(); return; }
          clienteConocido = data;
          const partes = ['Cliente conocido'];
          if (data.nombre) partes.push(data.nombre);
          partes.push(`${data.pedidos} ${plural(data.pedidos, 'pedido', 'pedidos')}`);
          $('vrClienteConocidoTexto').textContent = partes.join(' · ');
          $('vrClienteConocido').hidden = false;
        })
        .catch(function () { /* sin sugerencia: se escribe a mano */ });
    }, 300);
  });

  $('vrClienteConocidoUsar').addEventListener('click', function () {
    if (!clienteConocido) return;
    if (clienteConocido.nombre) $('vrNombreDelivery').value = clienteConocido.nombre;
    if (clienteConocido.direccion) $('vrNotasDelivery').value = clienteConocido.direccion;
    ocultarClienteConocido();
    datosTocados = true;
    actualizarOrden();
  });

  // ===== CONFIRMAR PEDIDO (el cobro se hace luego en Órdenes) =====
  function guardarPedido() {
    if (siguientePaso() !== 'confirmar' || guardandoPedido) return;
    guardandoPedido = true;
    actualizarOrden();

    const body = new FormData();
    body.append('carrito', JSON.stringify(carrito));
    body.append('imprimir', 'true');

    if (PEDIDO_ID) {
      body.append('pedido_id', PEDIDO_ID);
    } else {
      body.append('tipo', tipoVenta);
      if (tipoVenta === 'mesa') {
        body.append('mesa_id', $('vrMesaSelect').value);
        body.append('personas', String(personasSeleccionadas));
        body.append('nombre', $('vrNombreMesa').value.trim());
      } else if (tipoVenta === 'llevar') {
        body.append('nombre', $('vrNombreLlevar').value.trim());
      } else {
        body.append('telefono', telefono());
        body.append('nombre', $('vrNombreDelivery').value.trim());
        body.append('valor_moto', motoTexto());
        body.append('pago_delivery', pagoDelivery || '');
        body.append('observaciones', $('vrNotasDelivery').value.trim());
      }
    }

    fetch(window.PZ_URLS.guardarPedido, { method: 'POST', body, headers: { 'X-CSRFToken': window.CSRF_TOKEN } })
      .then(r => r.json())
      .then(data => {
        if (data.status !== 'ok') {
          alert('Error al guardar el pedido: ' + data.message);
          guardandoPedido = false;
          actualizarOrden();
          return;
        }
        // Confirmada: vuelve a Órdenes (§6). Al agregar a un pedido, a su detalle.
        window.location.href = PEDIDO_ID ? window.PZ_URLS.detalleOrden : window.PZ_URLS.ordenes;
      })
      .catch(() => {
        alert('Error inesperado al confirmar el pedido');
        guardandoPedido = false;
        actualizarOrden();
      });
  }

  // ===== BÚSQUEDA =====
  $('vrBuscador').addEventListener('input', function () {
    busqueda = this.value.trim();
    renderGrid();
  });

  // ===== INIT =====
  document.addEventListener('DOMContentLoaded', function () {
    renderCategorias();
    renderGrid();
    renderMesaGrid();
    renderPersonas();
    renderClientesRecientes();
    actualizarGrupoClienteDatos();
    if (catalogo.mesa_preseleccionada && !PEDIDO_ID) {
      // Desde Mesas: la mesa ya viene elegida, los datos están listos.
      datosTocados = true;
      seleccionarMesa(catalogo.mesa_preseleccionada);
    }
    renderCarrito();
    // Una llamada de delivery empieza por los datos.
    if (tipoVenta === 'delivery' && !PEDIDO_ID) abrirDatos();
  });
})();
