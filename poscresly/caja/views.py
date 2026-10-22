"""Caja de Almuerzos con el mismo diseño y funciones que la de Pizzería
(pizzeria/handoff_caja): turno, órdenes del turno, movimientos del cajón,
retiro a bóveda, arqueo al cerrar y cortes anteriores.

Las plantillas son las de templates/pizzeria/caja/; lo que cambia entre
módulos va en `cj` (direcciones, barra inferior y palabras). Los ayudantes
de formato, conteo y validación se reutilizan de pizzeria.views_caja; el
cálculo del turno es propio de Almuerzos (caja/turno.py)."""
from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from inicio.permisos import rol_de, solo_admin
from pedidos.models import Pedido
from pedidos.views import obtener_productos_pedido
from pizzeria.views_caja import (
    ATAJOS_FONDO,
    CENTAVO,
    FILTROS_MOVIMIENTOS,
    MOTIVOS_ANULACION,
    NOMBRE_TIPO,
    UMBRAL_RETIRO,
    _aviso_pendientes,
    _contexto_cortes,
    _denominaciones,
    _desglose_cajon,
    _dia_relativo,
    _dinero,
    _encabezado_dia,
    _error,
    _esperado_si_se_anula,
    _fecha_corta,
    _fila_movimiento,
    _hace,
    _hora,
    _leer_conteo,
    _leer_json,
    _mensaje_faltantes,
    _motivo_cierre,
    _nombre_completo,
    _nombre_corto,
    _parse_monto,
    _plural,
    _subheader,
    _subheader_historico,
    _texto_diferencia,
    campos_faltantes,
)
from pizzeria.views import LOGIN_URL

from . import turno as T
from .models import CajaDiaria, CajaEfectivo, CajaTransferencia, MovimientoCaja



def _cj(caja=None):
    historico = caja is not None and caja.estado == 'cerrada'
    return {
        'modulo': 'almuerzos',
        'historico': historico,
        'nav': 'components/almuerzos_tab_bar.html',
        'orden': 'pedido',
        'ordenes': 'pedidos',
        'pagadas': 'pedidos pagados',
        'mixtas': 'pedidos mixtos',
        'ordenes_titulo': 'Pedidos del turno',
        'metodos_texto': 'Efectivo y transferencia',
        'correccion': False,  # en Almuerzos el método se elige al tomar el pedido
        'urls': {
            'estado': reverse('caja_historico', args=[caja.id]) if historico else reverse('dashboard_caja'),
            'ordenes': (
                reverse('caja_historico_pedidos', args=[caja.id]) if historico else reverse('caja_pedidos_turno')
            ),
            'movimientos': (
                reverse('caja_historico_movimientos', args=[caja.id]) if historico else reverse('caja_movimientos')
            ),
            'cortes': reverse('caja_cortes'),
            'cerrar': reverse('cerrar_caja'),
            'cerrar_confirmar': reverse('caja_cerrar_confirmar'),
            'retiro': reverse('caja_retiro'),
            'movimiento': reverse('caja_movimiento'),
            'anular': reverse('caja_anular_movimiento', args=[0]),
            'corregir': '',
        },
    }


def _corte(caja):
    """Resultado de un turno cerrado: diferencia = contado al cerrar − esperado."""
    resumen = T.resumen_turno(caja)
    efectivo = T.efectivo_de(caja)
    contado = efectivo.monto_final if efectivo else None
    if contado is None:
        resultado, diferencia = 'sin_conteo', None
    else:
        diferencia = (contado - resumen['esperado_en_caja']).quantize(CENTAVO)
        resultado = 'cuadro' if diferencia == 0 else ('faltante' if diferencia < 0 else 'sobrante')
    return {'caja': caja, 'resumen': resumen, 'diferencia': diferencia, 'resultado': resultado}


def _turno_pedido(turno_id):
    """El turno que pide la URL: sin id, el abierto; con id, ese turno.
    Devuelve (caja, redirección). Un id del turno abierto va a la pantalla normal."""
    if turno_id is None:
        caja = T.caja_abierta()
        return caja, (None if caja else redirect('abrir_caja'))
    caja = get_object_or_404(CajaDiaria.objects.select_related('abierta_por', 'cerrada_por'), pk=turno_id)
    if caja.estado == 'abierta':
        return caja, redirect('dashboard_caja')
    return caja, None


def _cierre(corte):
    """Tarjeta principal de un turno cerrado: lo contado contra lo esperado."""
    efectivo = T.efectivo_de(corte['caja'])
    return {
        'contado': efectivo.monto_final if efectivo else None,
        'resultado': corte['resultado'],
        'diferencia': _texto_diferencia(corte),
        'motivo': _motivo_cierre(corte['caja']),
    }


def _caja_para_movimiento(turno_id):
    """Bloquea la caja del POST; un movimiento nunca va contra un turno cerrado."""
    try:
        turno_id = int(turno_id)
    except (TypeError, ValueError):
        return None
    caja = CajaDiaria.objects.select_for_update().filter(pk=turno_id).first()
    if caja is None or caja.estado != 'abierta':
        return None
    return caja


# ===== Pedidos del turno =====

GRUPOS_METODO = [('Efectivo', 'EFECTIVO'), ('Transferencia', 'TRANSFERENCIA'), ('Mixto', 'MIXTO')]
FILTROS_PEDIDOS_TURNO = [('todas', 'Todos'), ('mixtas', 'Mixtos')]


def _items_pedido(pedido):
    items = []
    for item in obtener_productos_pedido(pedido):
        componentes = item.get('componentes') or []
        nombre = item.get('nombre') or ' · '.join(componentes)
        if item.get('tipo') and item['tipo'] != 'Extra':
            nombre = f"{item['tipo']} · {nombre}" if nombre else item['tipo']
        items.append({
            'cantidad': item['cantidad'],
            'nombre': nombre,
            'precio': _dinero(Decimal(str(item['precio_unitario'])) * item['cantidad']),
        })
    return items


def _fila_pedido_turno(pedido):
    efectivo, transferencia = pedido.montos_por_medio()
    metodo = pedido.forma_pago if pedido.forma_pago in ('Efectivo', 'Transferencia') else 'Mixto'
    titulo = f'{pedido.tipo} · #{pedido.numero_dia:03d}'
    if pedido.tipo == 'Servirse' and pedido.numero_mesa:
        titulo = f'Mesa {pedido.numero_mesa} · #{pedido.numero_dia:03d}'
    sub = [_hora(pedido.cobrado_en)] + ([pedido.contacto] if pedido.contacto else [])
    return {
        'id': pedido.id,
        'titulo': titulo,
        'sub': ' · '.join(sub),
        'pagada_en': pedido.cobrado_en,
        'total': pedido.total,
        'metodo': metodo,
        'editada': False,
        'items': _items_pedido(pedido),
        'recibido': None,
        'cambio': None,
        'desglose': (
            [{'metodo': 'Efectivo', 'monto': efectivo}, {'metodo': 'Transferencia', 'monto': transferencia}]
            if metodo == 'Mixto' else []
        ),
        'efectivo_en_mixta': efectivo if metodo == 'Mixto' else Decimal('0.00'),
    }


def _pedidos_turno(caja):
    pedidos = T.pedidos_del_turno(caja).prefetch_related(
        'almuerzos__sopa__sopa', 'almuerzos__segundo__segundo', 'almuerzos__jugo__jugo',
        'sopas__sopa__sopa', 'sopas__jugo__jugo', 'segundos__segundo__segundo', 'segundos__jugo__jugo', 'extras',
    ).order_by('cobrado_en')
    return [_fila_pedido_turno(p) for p in pedidos]


def _resumen_pedidos_turno(caja):
    filas = _pedidos_turno(caja)
    total = sum((f['total'] for f in filas), Decimal('0.00'))
    return f"{len(filas)} {_plural(len(filas), 'pagado', 'pagados')} · {_dinero(total)}"


# ===== Pantallas =====

@login_required(login_url=LOGIN_URL)
def dashboard_caja(request, turno_id=None):
    caja, salida = _turno_pedido(turno_id)
    if salida:
        return salida
    historico = caja.estado == 'cerrada'

    turno = T.resumen_turno(caja)
    vendido = turno['total_vendido']
    formas_pago = [
        {
            'nombre': nombre, 'monto': turno[clave], 'color': color,
            'pct': round(turno[clave] / vendido * 100) if vendido else 0,
        }
        for nombre, clave, color in [
            ('Efectivo', 'ventas_efectivo', '#14181d'),
            ('Transferencia', 'ventas_transferencia', '#a8afb8'),
        ]
    ]

    movimientos = caja.movimientos.filter(anulado=False)
    ultimo_mov = movimientos.order_by('-creado_en').first()
    ultimo_en = ultimo_mov.creado_en if ultimo_mov else caja.fecha_apertura
    n_registros = movimientos.count() + 1  # + la apertura

    anterior = None if historico else T.ultima_cerrada()
    corte_fila = None
    if anterior:
        corte = _corte(anterior)
        corte_fila = {
            'dia': _dia_relativo(anterior.fecha_cierre),
            'diferencia': _texto_diferencia(corte),
            'resultado': corte['resultado'],
        }

    cajero = _nombre_corto(caja.abierta_por)
    if historico:
        subheader = _subheader_historico(caja, 'Turno cerrado', reverse('caja_cortes'))
    else:
        subheader = _subheader(
            'Caja', sub_pre='Turno abierto ', sub_hi=_hace(caja.fecha_apertura), tono='ambar',
            sub_post=f' · {cajero}' if cajero else '',
        )
    return render(request, 'pizzeria/caja/estado.html', {
        'cj': _cj(caja),
        'cierre': _cierre(_corte(caja)) if historico else None,
        'turno': turno,
        'caja': caja,
        'formas_pago': formas_pago,
        'esperado_centavos': int(turno['esperado_en_caja'] * 100),
        'supera_umbral': turno['esperado_en_caja'] > UMBRAL_RETIRO,
        'umbral_retiro': UMBRAL_RETIRO,
        'movimientos_sub': f"{n_registros} registro{'s' if n_registros != 1 else ''} · último {_hora(ultimo_en)}",
        'ordenes_turno_sub': _resumen_pedidos_turno(caja),
        'corte_fila': corte_fila,
        'denominaciones': _denominaciones(),
        'categorias': MovimientoCaja.CATEGORIAS,
        'subheader': subheader,
    })


@login_required(login_url=LOGIN_URL)
@require_http_methods(['GET', 'POST'])
def abrir_caja(request):
    if T.caja_abierta() is not None:
        return redirect('dashboard_caja')

    propuesto = T.fondo_propuesto()
    error = ''
    valor_campo = f'{propuesto:.2f}' if propuesto is not None else ''
    if request.method == 'POST':
        valor_campo = (request.POST.get('fondo_inicial') or '').strip()
        fondo = _parse_monto(valor_campo, permitir_cero=True)
        error = _mensaje_faltantes(campos_faltantes(fondo, etiqueta_monto='el fondo inicial'))
        if not error:
            with transaction.atomic():
                if CajaDiaria.objects.select_for_update().filter(estado='abierta').exists():
                    return redirect('dashboard_caja')
                observaciones = ''
                if propuesto is not None and fondo != propuesto:
                    observaciones = (
                        f'Fondo propuesto {_dinero(propuesto)}, abrió con {_dinero(fondo)} '
                        f'(diferencia {"+" if fondo > propuesto else "−"}{_dinero(abs(fondo - propuesto))})'
                    )
                T.abrir(fondo, request.user, observaciones)
            return redirect('dashboard_caja')

    anterior = T.ultima_cerrada()
    contexto_anterior = None
    if anterior:
        corte = _corte(anterior)
        contexto_anterior = {
            'fecha': _fecha_corta(anterior.fecha_cierre),
            'cajero': _nombre_corto(anterior.cerrada_por),
            'hora': _hora(anterior.fecha_cierre),
            'diferencia': _texto_diferencia(corte),
            'resultado': corte['resultado'],
        }

    ahora = timezone.now()
    return render(request, 'pizzeria/caja/abrir.html', {
        'cj': _cj(),
        'valor_campo': valor_campo,
        'propuesto': propuesto,
        'atajos': [f'{a:.2f}' for a in ATAJOS_FONDO],
        'error': error,
        'anterior': contexto_anterior,
        'cajero_nombre': _nombre_completo(request.user),
        'cajero_rol': rol_de(request.user),
        'turno_texto': f'{_fecha_corta(ahora)} · {_hora(ahora)}',
        'subheader': _subheader(
            'Abrir caja', sub_hi='Falta el fondo inicial', tono='rojo', sub_post=' para empezar a cobrar',
            back=reverse('inicio'),
        ),
    })


@login_required(login_url=LOGIN_URL)
def movimientos_caja(request, turno_id=None):
    caja, salida = _turno_pedido(turno_id)
    if salida:
        return salida
    historico = caja.estado == 'cerrada'

    filtro = request.GET.get('tipo', 'todos')
    if filtro not in dict(FILTROS_MOVIMIENTOS):
        filtro = 'todos'

    esperado = T.resumen_turno(caja)['esperado_en_caja']
    # Los anulados se siguen viendo (tachados): son la pista de cualquier descuadre.
    movimientos = caja.movimientos.select_related('autor', 'anulado_por')
    total = movimientos.count() + caja.gastos.count() + 1
    if filtro != 'todos':
        movimientos = movimientos.filter(tipo=filtro)
    filas = []
    for mov in movimientos:
        fila = _fila_movimiento(mov, esperado)
        fila['orden'] = mov.creado_en
        filas.append(fila)

    if filtro in ('todos', 'gasto'):
        # Gastos del modelo anterior (cargados desde /admin/): solo lectura.
        for gasto in caja.gastos.all():
            filas.append({
                'tipo': 'gasto',
                'titulo': f'Gasto · {gasto.descripcion or gasto.get_categoria_display()}',
                'sub': f'{_hora(gasto.fecha)} · cargado desde admin',
                'monto': f'− {_dinero(gasto.monto)}',
                'saldo': '',
                'fecha': timezone.localtime(gasto.fecha).date(),
                'orden': gasto.fecha,
            })
        filas.sort(key=lambda f: f['orden'], reverse=True)

    if filtro == 'todos':
        filas.append({
            'tipo': 'apertura',
            'titulo': 'Apertura de caja',
            'sub': ' · '.join([_hora(caja.fecha_apertura)] + ([_nombre_corto(caja.abierta_por)] if caja.abierta_por else [])),
            'monto': _dinero(T.fondo_inicial(caja)),
            'saldo': 'fondo',
            'fecha': timezone.localtime(caja.fecha_apertura).date(),
        })

    grupos = []
    for fila in filas:
        if not grupos or grupos[-1]['fecha'] != fila['fecha']:
            grupos.append({'fecha': fila['fecha'], 'titulo': _encabezado_dia(fila['fecha']), 'filas': []})
        grupos[-1]['filas'].append(fila)

    base = _cj(caja)['urls']['movimientos']
    chips = [
        {
            'label': etiqueta, 'value': clave, 'active': clave == filtro,
            'url': base if clave == 'todos' else f'{base}?tipo={clave}',
            'count': total if clave == 'todos' else None,
        }
        for clave, etiqueta in FILTROS_MOVIMIENTOS
    ]
    if historico:
        subheader = _subheader_historico(caja, 'Movimientos', _cj(caja)['urls']['estado'])
        subheader['segunda'] = {'tipo': 'chips', 'chips': chips}
    else:
        subheader = _subheader(
            'Movimientos', sub_pre='Turno de hoy · saldo ', sub_hi=_dinero(esperado),
            back=reverse('dashboard_caja'), chips=chips,
        )
    return render(request, 'pizzeria/caja/movimientos.html', {
        'cj': _cj(caja),
        'grupos': grupos,
        'filtro': filtro,
        'caja': caja,
        'motivos_anulacion': MOTIVOS_ANULACION,
        'subheader': subheader,
    })


@login_required(login_url=LOGIN_URL)
@solo_admin
def cerrar_caja(request):
    caja = T.caja_abierta()
    if caja is None:
        return redirect('abrir_caja')

    turno = T.resumen_turno(caja)
    pendientes = Pedido.objects.filter(estado='pendiente').count()
    cajero = _nombre_corto(caja.abierta_por)
    return render(request, 'pizzeria/caja/cerrar.html', {
        'cj': _cj(),
        'caja': caja,
        'turno': turno,
        'desglose': _desglose_cajon(turno),
        'esperado_centavos': int(turno['esperado_en_caja'] * 100),
        'denominaciones': _denominaciones(),
        'aviso_pendientes': _aviso_pendientes(
            pendientes, 'pedido sin entregar', 'pedidos sin entregar', ('entrega', 'entregan'),
        ),
        'cerrador_nombre': _nombre_completo(request.user),
        'turno_texto': f"Abierto {_hora(caja.fecha_apertura)}" + (f' por {cajero}' if cajero else ''),
        'subheader': _subheader(
            'Cerrar caja', sub_pre='Cuenta el cajón · debe haber ', sub_hi=_dinero(turno['esperado_en_caja']),
            back=reverse('dashboard_caja'),
        ),
    })


@login_required(login_url=LOGIN_URL)
def cortes_caja(request):
    volver = reverse('dashboard_caja') if T.caja_abierta() else reverse('abrir_caja')
    contexto = _contexto_cortes(
        request, CajaDiaria, _corte, reverse('caja_cortes'),
        lambda turno_id: reverse('caja_historico', args=[turno_id]), reverse('dashboard_caja'), volver,
    )
    return render(request, 'pizzeria/caja/cortes.html', {'cj': _cj(), **contexto})


@login_required(login_url=LOGIN_URL)
def pedidos_turno(request, turno_id=None):
    caja, salida = _turno_pedido(turno_id)
    if salida:
        return salida
    historico = caja.estado == 'cerrada'

    filtro = request.GET.get('filtro', 'todas')
    if filtro not in dict(FILTROS_PEDIDOS_TURNO):
        filtro = 'todas'

    todas = _pedidos_turno(caja)
    conteos = {'todas': len(todas), 'mixtas': sum(1 for f in todas if f['metodo'] == 'Mixto')}
    filas = [f for f in todas if f['metodo'] == 'Mixto'] if filtro == 'mixtas' else todas

    subtotales = {}
    grupos = []
    for clave, etiqueta in GRUPOS_METODO:
        del_grupo = [f for f in filas if f['metodo'] == clave]
        subtotales[clave] = sum((f['total'] for f in del_grupo), Decimal('0.00'))
        if del_grupo:
            n = len(del_grupo)
            grupos.append({
                'clave': clave.lower(), 'etiqueta': etiqueta, 'filas': del_grupo,
                'subtotal': subtotales[clave], 'conteo': f"{n} {_plural(n, 'pedido', 'pedidos')}",
            })

    base = _cj(caja)['urls']['ordenes']
    chips = [
        {
            'label': etiqueta, 'active': clave == filtro, 'count': conteos[clave],
            'url': base if clave == 'todas' else f'{base}?filtro={clave}',
        }
        for clave, etiqueta in FILTROS_PEDIDOS_TURNO
        if clave == 'todas' or conteos[clave] or clave == filtro
    ]

    return render(request, 'pizzeria/caja/ordenes_turno.html', {
        'cj': _cj(caja),
        'caja': caja,
        'grupos': grupos,
        'filtro': filtro,
        'efectivo_en_mixtas': sum((f['efectivo_en_mixta'] for f in filas), Decimal('0.00')),
        'totales': [
            {'etiqueta': etiqueta.capitalize(), 'monto': subtotales[clave]} for clave, etiqueta in GRUPOS_METODO
        ],
        'total_turno': sum(subtotales.values(), Decimal('0.00')),
        'subtotales_centavos': '{}',
        'metodos_corregibles': [],
        'subheader': _subheader(
            'Pedidos del turno',
            sub_pre=f"{conteos['todas']} {_plural(conteos['todas'], 'pagado', 'pagados')} · ",
            sub_hi=_dinero(sum((f['total'] for f in todas), Decimal('0.00'))),
            sub_post=f' · {_fecha_corta(caja.fecha_apertura)}' if historico else '',
            back=_cj(caja)['urls']['estado'],
            chips=chips if len(chips) > 1 else None,
        ),
    })


# ===== Acciones (POST JSON) =====

@login_required(login_url=LOGIN_URL)
@require_http_methods(['POST'])
def registrar_retiro(request):
    data = _leer_json(request)
    if data is None:
        return _error('Datos inválidos')

    conteo_limpio, total, error = _leer_conteo(data)
    if error:
        return _error(error)
    if total <= 0:
        return _error('Cuenta lo que vas a retirar')

    with transaction.atomic():
        caja = _caja_para_movimiento(data.get('turno_id'))
        if caja is None:
            return _error('Este turno ya está cerrado. Recarga la pantalla.', status=409)
        esperado = T.resumen_turno(caja)['esperado_en_caja']
        if total > esperado:
            return _error('Estás retirando más de lo que hay en el cajón')
        MovimientoCaja.objects.create(
            caja=caja, tipo='retiro', monto=total, conteo=conteo_limpio,
            detalle=(data.get('motivo') or '').strip()[:200], autor=request.user,
            saldo_posterior=esperado - total,
        )
    return JsonResponse({'status': 'ok', 'message': f'Retiraste {_dinero(total)} a bóveda'})


@login_required(login_url=LOGIN_URL)
@require_http_methods(['POST'])
def registrar_movimiento(request):
    data = _leer_json(request)
    if data is None:
        return _error('Datos inválidos')

    tipo = data.get('tipo')
    if tipo not in ('ingreso', 'gasto'):
        return _error('Tipo de movimiento inválido')
    categoria = data.get('categoria') or ''
    if categoria and categoria not in dict(MovimientoCaja.CATEGORIAS):
        return _error('Categoría inválida')
    monto = _parse_monto(data.get('monto'))
    faltan = campos_faltantes(monto, categoria, pide_categoria=True)
    if faltan:
        return _error(_mensaje_faltantes(faltan))

    with transaction.atomic():
        caja = _caja_para_movimiento(data.get('turno_id'))
        if caja is None:
            return _error('Este turno ya está cerrado. Recarga la pantalla.', status=409)
        esperado = T.resumen_turno(caja)['esperado_en_caja']
        saldo = esperado + monto if tipo == 'ingreso' else esperado - monto
        if saldo < 0:
            return _error('El gasto deja el cajón en negativo')
        MovimientoCaja.objects.create(
            caja=caja, tipo=tipo, monto=monto, categoria=categoria,
            detalle=(data.get('detalle') or '').strip()[:200], autor=request.user, saldo_posterior=saldo,
        )
    etiqueta = 'Gasto' if tipo == 'gasto' else 'Ingreso'
    return JsonResponse({'status': 'ok', 'message': f'{etiqueta} de {_dinero(monto)} registrado'})


@login_required(login_url=LOGIN_URL)
@solo_admin
@require_http_methods(['POST'])
def registrar_cierre(request):
    """Arqueo final. Diferencia = contado − esperado; si no cuadra, se exige motivo."""
    data = _leer_json(request)
    if data is None:
        return _error('Datos inválidos')

    conteo_limpio, contado, error = _leer_conteo(data)
    if error:
        return _error(error)
    motivo = (data.get('motivo') or '').strip()[:200]

    with transaction.atomic():
        caja = _caja_para_movimiento(data.get('turno_id'))
        if caja is None:
            return _error('Este turno ya está cerrado. Recarga la pantalla.', status=409)
        turno = T.resumen_turno(caja)
        esperado = turno['esperado_en_caja']
        # El cajero contó contra la cifra que veía; si entró un cobro o un movimiento
        # mientras contaba, la comparación ya no vale.
        if data.get('esperado_centavos') != int(esperado * 100):
            return _error('Cambió lo que debe haber en el cajón mientras contabas. Recarga y revisa.', status=409)
        diferencia = contado - esperado
        if diferencia != 0 and not motivo:
            return _error('Falta el motivo de la diferencia')

        efectivo = T.efectivo_de(caja) or CajaEfectivo(caja_diaria=caja, monto_inicial=Decimal('0.00'))
        efectivo.monto_final = contado
        efectivo.save()
        transferencia = CajaTransferencia.objects.filter(caja_diaria=caja).first()
        if transferencia:
            transferencia.monto_final = turno['ventas_transferencia']
            transferencia.save()

        caja.estado = 'cerrada'
        caja.fecha_cierre = timezone.now()
        caja.cerrada_por = request.user
        caja.conteo_cierre = conteo_limpio
        if motivo:
            # _motivo_cierre lee el texto que sigue a "Cierre:".
            caja.observaciones = f'{caja.observaciones}\nCierre: {motivo}'.strip()
        caja.save()

    if diferencia == 0:
        mensaje = 'Caja cerrada · cuadró'
    else:
        tipo = 'faltante' if diferencia < 0 else 'sobrante'
        mensaje = f'Caja cerrada con {tipo} de {_dinero(abs(diferencia))}'
    return JsonResponse({'status': 'ok', 'message': mensaje, 'redirect': reverse('abrir_caja')})


@login_required(login_url=LOGIN_URL)
@solo_admin
@require_http_methods(['POST'])
def anular_movimiento(request, movimiento_id):
    data = _leer_json(request)
    if data is None:
        return _error('Datos inválidos')
    motivo = (data.get('motivo') or '').strip()[:200]
    if not motivo:
        return _error('Falta el motivo')

    with transaction.atomic():
        caja = _caja_para_movimiento(data.get('turno_id'))
        if caja is None:
            return _error('Este turno ya está cerrado. Recarga la pantalla.', status=409)
        mov = caja.movimientos.select_for_update().filter(pk=movimiento_id).first()
        if mov is None:
            return _error('Movimiento no encontrado', status=404)
        if mov.anulado:
            return _error('Este movimiento ya estaba anulado', status=409)
        esperado = T.resumen_turno(caja)['esperado_en_caja']
        if _esperado_si_se_anula(mov, esperado) < 0:
            return _error('Anularlo deja el cajón en negativo')
        mov.anulado = True
        mov.anulado_motivo = motivo
        mov.anulado_por = request.user
        mov.anulado_en = timezone.now()
        mov.save(update_fields=['anulado', 'anulado_motivo', 'anulado_por', 'anulado_en'])

    return JsonResponse({'status': 'ok', 'message': f'{NOMBRE_TIPO[mov.tipo].capitalize()} de {_dinero(mov.monto)} anulado'})
