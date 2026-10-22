from django.urls import path

from . import views

# Mismas pantallas que la caja de Pizzería (pizzeria/urls.py, caja/turno/).
urlpatterns = [
    path('', views.dashboard_caja, name='dashboard_caja'),
    path('abrir/', views.abrir_caja, name='abrir_caja'),
    path('pedidos/', views.pedidos_turno, name='caja_pedidos_turno'),
    path('movimientos/', views.movimientos_caja, name='caja_movimientos'),
    path('cortes/', views.cortes_caja, name='caja_cortes'),
    # Un turno anterior, de solo lectura (se entra desde Cortes anteriores).
    path('turno/<int:turno_id>/', views.dashboard_caja, name='caja_historico'),
    path('turno/<int:turno_id>/pedidos/', views.pedidos_turno, name='caja_historico_pedidos'),
    path('turno/<int:turno_id>/movimientos/', views.movimientos_caja, name='caja_historico_movimientos'),
    path('retiro/', views.registrar_retiro, name='caja_retiro'),
    path('movimiento/', views.registrar_movimiento, name='caja_movimiento'),
    path('movimiento/<int:movimiento_id>/anular/', views.anular_movimiento, name='caja_anular_movimiento'),
    path('cerrar/', views.cerrar_caja, name='cerrar_caja'),
    path('cerrar/confirmar/', views.registrar_cierre, name='caja_cerrar_confirmar'),
]
