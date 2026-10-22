# Handoff · Barra de orden (nuevo pedido, Pizzería)

Diseño de referencia: `Nuevo pedido - checkout.dc.html` — variante **3a** (arriba del archivo). Usa las hojas de la variante **2a** (formulario de entrega A, hoja Pedido C/D).

> Los datos del prototipo (clientes, productos, montos, valores de moto) son de ejemplo.

---

## 1. Overview

Problema actual: para elegir modo y datos del cliente hay que abrir el ⋯, aceptar, volver al catálogo, abrir el carrito y confirmar. Son dos hojas distintas para cerrar una orden.

Solución:

- **＋** (tab bar) sigue abriendo el catálogo directo, sin cambios.
- Desde que se abre el catálogo aparece la **barra de orden**, también vacía. Tiene dos zonas:
  - **Izquierda · Modo y datos:** abre la hoja *Datos de la orden*.
  - **Derecha · Pedido:** abre la hoja *Pedido* (items, totales, Confirmar).
- Los datos se pueden llenar antes o después de los productos. La llamada de delivery empieza por la izquierda y el mostrador por los productos.
- El ⋯ ya no se usa para el modo. Queda para acciones secundarias y la zona de riesgo.

---

## 2. Estructura de la pantalla (catálogo)

```
Header fijo 52 px          (sin cambios)
Subheader 56 px            ‹ · "Nueva orden" · sub-línea resaltada · ⋯
Búsqueda + chips           (sin cambios)
Grid de productos          2 columnas, gap 10, padding 12
Barra de orden (flotante)  bottom: 90 px (encima del tab bar), left/right 12 px
Tab bar 78 px
```

Deja `padding-bottom` en el grid para que la última fila no quede bajo la barra (≈ 64 px + 12 px).

---

## 3. Barra de orden · medidas

| Elemento | Valor |
|---|---|
| Contenedor | bg `#14181d`, radio 16, padding 8, gap 8, sombra `0 10px 22px rgba(20,24,29,.22)` |
| Zona izquierda | flex 1, alto 48, radio 12, bg `#242b33`, padding 0 12 |
| · título | 13.5 px / 800 / `#fff`, una línea con ellipsis |
| · sub-línea | 11 px / 700 |
| · chevron › | 17 px / 700 `#a8afb8` |
| · borde pendiente | `outline: 1.5px solid #e02040` mientras falte algo obligatorio |
| Zona derecha | alto 48, padding 0 14, radio 12, columna centrada |
| · título | "N items" 14 px / 800 |
| · sub | total, 10.5 px / 700, opacidad .8 |

### Estados

| Estado | Izquierda título | Izquierda sub | Borde | Derecha |
|---|---|---|---|---|
| Vacía (recién ＋) | `Llevar · sin cliente` | `Toca para modo y datos` `#a8afb8` | rojo | bg `#2b333b`, texto `#8d97a2`, "0 items · $0.00" |
| Datos completos | `Delivery · Marco Vera` | resumen: `Olmedo 214 · moto $2.50` `#a8afb8` | ninguno | bg `#c8102e`, texto `#fff` (si hay items) |
| Faltan datos | `Delivery · Marco Vera` | `Falta: dirección y moto` `#ff8a9b` | rojo | bg `#c8102e` si hay items |

Con 0 items la zona derecha se puede tocar igual: abre la hoja Pedido vacía con "Agrega productos".

### Sub-línea del subheader (patrón `sub_pre` / `sub_hi` / `sub_hi_tono`)

- Vacía: `#006 · Llevar · ` + **`0 productos`** `#4a545f`
- Completa: `#006 · Delivery · ` + **`Marco Vera`** `#4a545f`
- Falta algo: `#006 · Delivery · ` + **`falta dirección`** `#c8102e`

---

## 4. Hoja «Datos de la orden» (variante 2a · A)

Hoja inferior estándar (radio `22px 22px 0 0`, padding `14px 16px 20px`, asa 38×4 `#dfe2e7`, overlay `rgba(20,24,29,.42)`, sin ✕).

1. Título 19 px/800 + nº de orden 11 px `#8a929c`.
2. Selector de modo segmentado: contenedor bg `#f4f5f7` radio 13 padding 4; segmentos de 38 px de alto, radio 10; activo `#14181d`/`#fff` 800.
3. Campos según el modo:
   - **Servirse:** mesa (grid 5 col, celdas de 46 px), personas (stepper de 46 px), cliente opcional.
   - **Llevar:** nombre (46 px) + chips de recientes (38 px, radio 999). Es opcional.
   - **Delivery:** teléfono (48 px, borde activo 1.5 `#14181d`) → aviso "Cliente conocido · Nombre · N pedidos · Usar" (bg `#eaf6ef`, borde `#cfeadb`, texto `#1c7a4a`) → nombre → dirección y referencia (textarea, mín. 58 px) → pago (2 botones de 40 px) → moto (fila con scroll horizontal, chips de 40 px; elegido con borde 1.5 `#14181d`; "Otro" `#8a929c`).
   - Etiquetas: 11 px / 800 / `.09em` `#8a929c`.
4. Botón primario 52 px, radio 14, `#c8102e`, sombra primaria. **Su texto depende del estado de la orden:**
   - sin items → `Volver al menú` (o `Agregar productos ›` si se entra desde Delivery)
   - con items y datos completos → `Confirmar e imprimir · $35.50`
   - faltan datos obligatorios → deshabilitado `#e9ebef`/`#a8afb8` + línea 11 px/700 `#c8102e` `Falta: …`

---

## 5. Hoja «Pedido» (variante 2a · C y D)

- Cabecera: "Pedido" 19/800 + chip `#006` + "N items".
- **Tarjeta de entrega**, arriba de los items:
  - Completa: bg `#fafbfc`, borde `#e6e8ec`, radio 14, padding 12. Muestra etiqueta del modo, nombre · teléfono (14/800), dirección (12/600, 1 línea), pago · moto. Botón `Editar` de 38 px abre la hoja Datos.
  - Incompleta: bg `#fdecef`, borde `#f4d3d9`. Muestra "DELIVERY · FALTAN DATOS" `#c8102e`, la lista de lo que falta 14/800 y "Toca para completar". Toda la tarjeta se puede tocar.
- Items: filas de 11 px de padding vertical con `1×` · nombre · precio. En la versión completa se mantienen Editar y el stepper (38 px).
- Totales: Productos, Moto (si es delivery), IVA si aplica, Total 26/800.
- Botón:
  - completo → `Confirmar e imprimir` rojo;
  - faltan datos → `Completar datos de entrega ›` en `#14181d` + `Falta: teléfono, dirección, valor de la moto` 11/700 `#c8102e`.

---

## 6. Interacciones

| Acción | Resultado |
|---|---|
| Tocar ＋ en tab bar | Crea orden borrador (modo por defecto Llevar), abre catálogo con barra vacía |
| Tocar zona izquierda | Abre hoja Datos |
| Tocar zona derecha | Abre hoja Pedido |
| Agregar producto | Actualiza "N items · $total" con una animación corta del número |
| Cambiar modo en hoja Datos | Conserva los campos comunes (nombre) y oculta los demás |
| Teléfono reconocido | Aparece "Usar": rellena nombre y última dirección |
| Cerrar hoja (deslizar / overlay) | Guarda lo escrito en la orden borrador |
| Confirmar | Crea la orden, imprime comanda y vuelve a Órdenes |

Modo por defecto según el punto de entrada: Mesas → Servirse con mesa; tab Delivery → Delivery (y abre primero la hoja Datos); ＋ → Llevar.

---

## 7. Datos que necesita la vista

```python
orden = {
  "numero": "006",
  "modo": "llevar" | "servirse" | "delivery",
  "cliente": {"nombre": str|None, "telefono": str|None},
  "mesa": int|None, "personas": int|None,
  "entrega": {"direccion": str|None, "pago": "efectivo"|"transferencia"|None, "moto": Decimal|None},
  "items": [...], "items_count": int, "subtotal": Decimal, "iva": Decimal, "total": Decimal,
}
barra = {
  "datos_titulo": "Delivery · Marco Vera",
  "datos_sub": "Olmedo 214 · moto $2.50",
  "datos_pendiente": bool,           # borde rojo + sub en rojo
  "sub_pre", "sub_hi", "sub_hi_tono", # subheader
}
campos_faltantes(orden) -> list[str]  # única fuente
puede_confirmar(orden) -> bool        # items_count > 0 and not campos_faltantes
siguiente_paso(orden) -> "agregar" | "completar" | "confirmar"   # texto del botón
valores_moto = [2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50]
```

Obligatorios por modo: **Servirse** mesa · **Llevar** ninguno (sin nombre se imprime como "Llevar #006") · **Delivery** teléfono, dirección, pago, moto (nombre recomendado).

---

## 8. Tokens

`#14181d` ink · `#242b33` / `#2b333b` superficies de la barra · `#c8102e` marca · `#e02040` borde pendiente sobre oscuro · `#ff8a9b` texto de aviso sobre oscuro · `#a8afb8` texto secundario sobre oscuro · `#fdecef`/`#f4d3d9` tinte rojo · `#eaf6ef`/`#cfeadb`/`#1c7a4a` verde · Plus Jakarta Sans con `tnum`.

---

## 9. Implementación Django + Bootstrap 5

- La orden borrador se crea al tocar ＋ (`POST /orden/nueva/`), con estado `borrador`. Guarda su id en la sesión.
- Barra: un parcial `_barra_orden.html` incluido en el catálogo. Se actualiza tras cada agregar o editar con un fragmento HTML devuelto por la vista (fetch o htmx). No calcules el estado en JS.
- Hojas: `offcanvas-bottom` de Bootstrap con radios y padding ajustados; sin `btn-close`. Activa cerrar con el overlay (`data-bs-backdrop="true"`) y con gesto de deslizar.
- Hoja Datos: un form por modo dentro de la misma hoja, alternado con el segmentado. Guarda con `PATCH` al cerrar o al pulsar el botón.
- Búsqueda por teléfono: `GET /clientes/buscar/?tel=` con debounce de 300 ms y mínimo 7 dígitos.
- Fila de moto: `d-flex overflow-auto` con `scroll-snap-type:x`; "Otro" abre un input numérico.
- Elimina la opción "Modo de la orden" del ⋯.
