import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from pedidos.models import Pedido

from . import turno as T
from .models import CajaDiaria, CajaEfectivo, MovimientoCaja


# Las plantillas piden estáticos con hash; en tests no hay collectstatic.
@override_settings(STORAGES={
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
})
class CajaAlmuerzosTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin', 'admin@example.com', 'x')
        self.client.force_login(self.admin)
        self.caja = T.abrir(Decimal('30.00'), self.admin)

    def pedido(self, total, forma='Efectivo', efectivo=None, completado=True):
        return Pedido.objects.create(
            tipo='Llevar', forma_pago=forma, total=Decimal(total), monto_efectivo=efectivo,
            estado='completado' if completado else 'pendiente',
            completado_en=timezone.now() if completado else None,
        )

    def post(self, nombre, data, args=None):
        return self.client.post(reverse(nombre, args=args), data=json.dumps(data), content_type='application/json')

    def test_debe_haber_suma_solo_el_efectivo(self):
        self.pedido('5.00')
        self.pedido('4.00', 'Transferencia')
        self.pedido('10.00', 'Mixto', efectivo=Decimal('6.00'))
        self.pedido('9.00', completado=False)
        turno = T.resumen_turno(self.caja)
        self.assertEqual(turno['ventas_efectivo'], Decimal('11.00'))
        self.assertEqual(turno['ventas_transferencia'], Decimal('8.00'))
        self.assertEqual(turno['ordenes_cobradas'], 3)
        self.assertEqual(turno['esperado_en_caja'], Decimal('41.00'))

    def test_pedido_cuenta_en_el_turno_en_que_se_completo(self):
        viejo = self.pedido('5.00')
        viejo.fecha_creacion = self.caja.fecha_apertura - timedelta(days=1)
        viejo.save()
        self.assertEqual(T.resumen_turno(self.caja)['ordenes_cobradas'], 1)

    def test_gasto_retiro_y_anular_mueven_el_cajon(self):
        self.pedido('20.00')
        r = self.post('caja_movimiento', {'turno_id': self.caja.id, 'tipo': 'gasto', 'monto': '5', 'categoria': 'insumos'})
        self.assertEqual(r.status_code, 200)
        r = self.post('caja_retiro', {'turno_id': self.caja.id, 'conteo': {'10': 2}})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(T.resumen_turno(self.caja)['esperado_en_caja'], Decimal('25.00'))

        gasto = MovimientoCaja.objects.get(tipo='gasto')
        r = self.post('caja_anular_movimiento', {'turno_id': self.caja.id, 'motivo': 'No se hizo'}, args=[gasto.id])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(T.resumen_turno(self.caja)['esperado_en_caja'], Decimal('30.00'))

    def test_no_se_retira_mas_de_lo_que_hay(self):
        r = self.post('caja_retiro', {'turno_id': self.caja.id, 'conteo': {'20': 2}})
        self.assertEqual(r.status_code, 400)

    def test_cerrar_con_diferencia_exige_motivo_y_propone_el_fondo(self):
        esperado = int(T.resumen_turno(self.caja)['esperado_en_caja'] * 100)
        datos = {'turno_id': self.caja.id, 'conteo': {'20': 1, '5': 1}, 'esperado_centavos': esperado}
        self.assertEqual(self.post('caja_cerrar_confirmar', datos).status_code, 400)

        r = self.post('caja_cerrar_confirmar', {**datos, 'motivo': 'Faltó cambio'})
        self.assertEqual(r.status_code, 200)
        self.caja.refresh_from_db()
        self.assertEqual(self.caja.estado, 'cerrada')
        self.assertEqual(CajaEfectivo.objects.get(caja_diaria=self.caja).monto_final, Decimal('25.00'))
        self.assertEqual(T.fondo_propuesto(), Decimal('25.00'))

        # Sin caja abierta, la pantalla lleva a abrir; abrir crea el turno nuevo.
        self.assertRedirects(self.client.get(reverse('dashboard_caja')), reverse('abrir_caja'))
        self.client.post(reverse('abrir_caja'), {'fondo_inicial': '25.00'})
        self.assertEqual(CajaDiaria.objects.filter(estado='abierta').count(), 1)

    def test_empleado_no_puede_cerrar(self):
        empleado = User.objects.create_user('emp', password='x')
        empleado.groups.add(Group.objects.get_or_create(name='Empleado')[0])
        self.client.force_login(empleado)
        self.assertEqual(self.client.get(reverse('cerrar_caja')).status_code, 403)

    def test_pantallas_responden(self):
        self.pedido('5.00')
        for nombre in ['dashboard_caja', 'caja_pedidos_turno', 'caja_movimientos', 'caja_cortes', 'cerrar_caja']:
            self.assertEqual(self.client.get(reverse(nombre)).status_code, 200, nombre)

    def test_apertura_automatica_usa_el_fondo_del_cierre_anterior(self):
        CajaEfectivo.objects.filter(caja_diaria=self.caja).update(monto_final=Decimal('42.00'))
        CajaDiaria.objects.filter(pk=self.caja.pk).update(estado='cerrada', fecha_cierre=timezone.now())
        caja = T.abrir_automatica()
        self.assertEqual(T.fondo_inicial(caja), Decimal('42.00'))

    def test_turno_cerrado_se_ve_en_solo_lectura(self):
        self.pedido('5.00')
        MovimientoCaja.objects.create(caja=self.caja, tipo='gasto', monto=Decimal('2.00'), saldo_posterior=Decimal('33.00'))
        CajaEfectivo.objects.filter(caja_diaria=self.caja).update(monto_final=Decimal('33.00'))
        CajaDiaria.objects.filter(pk=self.caja.pk).update(estado='cerrada', fecha_cierre=timezone.now())
        T.abrir(Decimal('33.00'), self.admin)

        r = self.client.get(reverse('caja_historico', args=[self.caja.id]))
        self.assertContains(r, 'CONTADO AL CERRAR')
        self.assertNotContains(r, 'Retirar')
        self.assertContains(r, reverse('caja_historico_pedidos', args=[self.caja.id]))
        r = self.client.get(reverse('caja_historico_pedidos', args=[self.caja.id]))
        self.assertContains(r, '1 pagado')
        r = self.client.get(reverse('caja_historico_movimientos', args=[self.caja.id]))
        self.assertNotContains(r, 'data-cj-mov=')

    def test_turno_abierto_por_id_va_a_la_pantalla_normal(self):
        r = self.client.get(reverse('caja_historico', args=[self.caja.id]))
        self.assertRedirects(r, reverse('dashboard_caja'))

    def test_cortes_por_dia(self):
        CajaDiaria.objects.filter(pk=self.caja.pk).update(estado='cerrada', fecha_cierre=timezone.now())
        hoy = timezone.localdate()
        r = self.client.get(reverse('caja_cortes'), {'fecha': hoy.isoformat()})
        self.assertContains(r, reverse('caja_historico', args=[self.caja.id]))
        r = self.client.get(reverse('caja_cortes'), {'fecha': (hoy - timedelta(days=30)).isoformat()})
        self.assertContains(r, 'Ese día no hubo turnos de caja')

