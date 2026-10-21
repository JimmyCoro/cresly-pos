# CreslyPOS — Sistema de punto de venta para restaurante

Sistema POS web desarrollado para **Cresly Pizzería / Restaurante** (Cuenca, Ecuador) y **en uso en producción**. Gestiona pedidos en tiempo real, impresión de comandas en impresora térmica, mesas, cobros y el cierre de caja diario.

## Funcionalidades

**Almuerzos**
- Toma de pedidos por tipo (servirse, llevar, reservado) con almuerzos, sopas, segundos y extras.
- Menú del día configurable con control de cantidades disponibles.
- Numeración diaria automática de pedidos.
- Sincronización en tiempo real entre pantallas mediante WebSockets.

**Pizzería**
- Mapa de mesas editable (crear, mover y cambiar estado).
- Órdenes en curso con seguimiento del estado de preparación por ítem.
- Cálculo automático del precio de pizzas.
- Cobro completo, dividido por persona o repartido en partes iguales.
- Reimpresión de comanda e impresión de precuenta.
- Vista optimizada para móvil.

**Caja y administración**
- Dashboard diario: totales, ventas por hora y métodos de pago (incluye pago mixto).
- Apertura y cierre de turno de caja.
- Usuarios con roles **Administrador** y **Empleado**, contraseña temporal y cambio obligatorio en el primer ingreso.
- Impresión de tickets en impresora térmica de red (ESC/POS).
- Instalable como PWA con service worker.

## Stack tecnológico

| Capa | Tecnologías |
| --- | --- |
| Backend | Python 3.12 · Django 5 · Django Channels 4 (ASGI) |
| Tiempo real | WebSockets · Redis (`channels_redis`) |
| Base de datos | PostgreSQL |
| Frontend | Bootstrap 5 · JavaScript (vanilla) · PWA |
| Impresión | python-escpos (impresora térmica de red) |
| Servidor | Gunicorn + Uvicorn workers · WhiteNoise |
| Despliegue | Railway (deploy automático desde `master`) |

## Arquitectura

| App | Responsabilidad |
| --- | --- |
| `inicio` | Vista principal, autenticación, roles y usuarios |
| `pedidos` | Modelos y lógica de pedidos, WebSockets e impresión |
| `menu` | Menú del día y catálogo de platos |
| `pizzeria` | Mesas, órdenes, preparación y cobros de la pizzería |
| `caja` | Dashboard y turnos de caja |

## Instalación local

```bash
git clone https://github.com/JimmyCoro/CreslyPosAlmuerzos.git
cd CreslyPosAlmuerzos
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cd poscresly
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Sin `REDIS_URL`, el proyecto usa una capa de canales en memoria, suficiente para desarrollo.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `REDIS_URL` | Canal de WebSockets en producción |
| `DJANGO_SECRET_KEY` | Clave secreta |
| `DJANGO_DEBUG` | `0` en producción |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos, separados por coma |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Orígenes confiables para CSRF |

## Capturas

<!-- Agrega aquí capturas de la pantalla de pedidos, mapa de mesas y dashboard de caja -->

## Autor

**Jimmy Coro** — Tecnólogo en Desarrollo de Software
[github.com/JimmyCoro](https://github.com/JimmyCoro)

Desarrollado con apoyo de herramientas de IA (Claude Code).
