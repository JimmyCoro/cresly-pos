"""Cálculo del turno de caja de Almuerzos. Misma regla que la caja de
Pizzería (pizzeria/views_caja.py): lo que manda es lo que debe haber en el
cajón = fondo + efectivo cobrado + ingresos − retiros − gastos.

Almuerzos no guarda pagos aparte: cada pedido completado trae su forma de
pago (Efectivo, Transferencia o Mixto) y Pedido.montos_por_medio() reparte
el total. Un pedido cuenta en el turno en que se completó (completado_en);
los pedidos de antes de ese campo usan la hora en que se tomaron."""
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from pedidos.models import Pedido

from .models import CajaDiaria, CajaEfectivo, CajaTransferencia

CERO = Decimal('0.00')


def caja_abierta():
    return (
        CajaDiaria.objects.filter(estado='abierta')
        .select_related('abierta_por').order_by('-fecha_apertura').first()
    )


def ultima_cerrada():
    return (
        CajaDiaria.objects.filter(estado='cerrada', fecha_cierre__isnull=False)
        .select_related('cerrada_por').order_by('-fecha_cierre').first()
    )


def efectivo_de(caja):
    return CajaEfectivo.objects.filter(caja_diaria=caja).first()


def fondo_inicial(caja):
    efectivo = efectivo_de(caja)
    return efectivo.monto_inicial if efectivo else CERO


def fondo_propuesto():
    """Lo contado al cerrar el turno anterior es el fondo del siguiente."""
    anterior = ultima_cerrada()
    efectivo = efectivo_de(anterior) if anterior else None
    if efectivo is None:
        return None
    return efectivo.monto_final if efectivo.monto_final is not None else efectivo.monto_inicial


def abrir(fondo, usuario=None, observaciones=''):
    caja = CajaDiaria.objects.create(
        fecha=timezone.localdate(), estado='abierta', abierta_por=usuario, observaciones=observaciones,
    )
    CajaEfectivo.objects.create(caja_diaria=caja, monto_inicial=fondo)
    CajaTransferencia.objects.create(caja_diaria=caja, monto_inicial=0)
    return caja


def abrir_automatica():
    """Al tomar un pedido sin caja abierta, Almuerzos abre una sola (para no
    frenar la venta) con el fondo que dejó el cierre anterior."""
    propuesto = fondo_propuesto()
    return abrir(
        propuesto if propuesto is not None else CERO,
        observaciones='Abierta automáticamente al tomar un pedido',
    )


def pedidos_del_turno(caja):
    pedidos = (
        Pedido.objects.filter(estado='completado')
        .annotate(cobrado_en=Coalesce('completado_en', 'fecha_creacion'))
        .filter(cobrado_en__gte=caja.fecha_apertura)
    )
    if caja.fecha_cierre:
        pedidos = pedidos.filter(cobrado_en__lte=caja.fecha_cierre)
    return pedidos


def resumen_turno(caja):
    efectivo = transferencia = CERO
    n = 0
    for pedido in pedidos_del_turno(caja).only('total', 'forma_pago', 'monto_efectivo'):
        parte_efectivo, parte_transferencia = pedido.montos_por_medio()
        efectivo += parte_efectivo
        transferencia += parte_transferencia
        n += 1

    por_tipo = {
        row['tipo']: row['total']
        for row in caja.movimientos.filter(anulado=False).values('tipo').annotate(total=Sum('monto'))
    }
    # Gastos del modelo anterior (cargados desde /admin/): siguen saliendo del cajón.
    gastos_anteriores = caja.gastos.aggregate(total=Sum('monto'))['total'] or CERO

    fondo = fondo_inicial(caja)
    ingresos = por_tipo.get('ingreso') or CERO
    retiros = por_tipo.get('retiro') or CERO
    gastos = (por_tipo.get('gasto') or CERO) + gastos_anteriores
    return {
        'fondo_inicial': fondo,
        'ventas_efectivo': efectivo,
        'ventas_tarjeta': CERO,
        'ventas_transferencia': transferencia,
        'total_vendido': efectivo + transferencia,
        'ordenes_cobradas': n,
        'total_ingresos': ingresos,
        'total_retirado': retiros,
        'total_gastos': gastos,
        'esperado_en_caja': fondo + efectivo + ingresos - retiros - gastos,
    }
