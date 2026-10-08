# Mapa del sistema actual — Imperial (resumen ejecutable)

Generado: 2026-09-15

Este documento agrupa terminales, pantallas y procesos automáticos detectados en el repo. "Confirmado" indica que el enlace o nodo aparece en el código; "Operador" indica que se debe confirmar en producción (host/despliegue, reglas, App Check, etc.).

---

## Inventario general

- POS (Puntos de venta): archivos canonicals detectados en `ORDENA/pos/pos/` — `pos0-wa.html`, `pos1-wa.html` ... `pos5-wa.html`. (Confirmado: código con `generatePDF`, `uploadCompleteOrder`, `uploadOrderProduct`.)
- Cajas (cobro): `ORDENA/pos/pos/caja1-wa.html`, `ORDENA/pos/pos/caja2-wa.html`, `ORDENA/pos/pos/corte.html`. (Confirmado)
- Pantallas / Tablets (preparación): archivos bajo `Pantallas/` y `Pantallas/LEFTVIEW/` — varios `leftView*`, `rightView*`, `new-rightView.html`. (Confirmado)
- Admin / Facturación: `facturacion-ORDENA/facturacion/admin.html`. (Confirmado)
- Copias/otras sucursales: `NEW GIT/GIT 2/GIT/` y `NEW GIT/GIT 2/GIT/ordena/sistema/punto-*.html` (operador: confirmar despliegue y proyecto Firebase). (Confirmado en repo)
- Funciones / procesos de fondo: carpeta `functions/` (presente), `firebase.json` (configuración de funciones). (Confirmado)

---

## Nodos Realtime Database usados (resumen)

Confirmado por código: los siguientes nodos son leídos o escritos desde clientes:

- `process/firsts`, `process/seconds`, `process/thirds`, `process/fourths`, `process/fifths`, `process/justName`, `process/whatsapp`, `process/timing`, `process/izquierda`, `process/izquierda/*`.
- `pending/*` y subnodos `pending/<orderRef>/aCremas|aJamones|aBodega|aBodegaAbajo`.
- `tablets/cremas/pendientes`, `tablets/jamones/pendientes`, `tablets/bodega/pendientes`, `tablets/arriba/pendientes`.
- `orders/code0/<id>` (persistencia de órdenes para cajas).
- `liveviews/<terminal>/*` (status, sorder, wtime, order, name, employee, done).
- `productos/` (catalogo; a menudo leído desde `secondaryApp`).
- `products/`, `inventory/<id>/stock`, `relations/<id>`, `sugerencias/`, `service/7isReady/`, `registro/<employee>`, `survey/`, `.info/connected`.

Referencias de ejemplo en el código: búsquedas y escrituras a `process/*`, `orders/code0` y `tablets/*` en `ORDENA/pos/pos/pos0-wa.html` y pantallas en `Pantallas/` y `NEW GIT/`.

---

## Agrupación de variantes (por terminal / propósito)

1) POS family

- Canonical group id: `POS0`..`POS5` (cada archivo establece `var globalComputer = "POSn"`).
- Archivos agrupados (ejemplos):
  - `ORDENA/pos/pos/pos0-wa.html` (variant: `pos0.html`) — multiple copies found; marque canonical por timestamp/size en manifiesto.
  - `ORDENA/pos/pos/pos1-wa.html` … `pos5-wa.html`.
- Observación: `pos1..pos5` parecen ser clones con único cambio `var globalComputer = "POSn"`. (Confirmado por diff.)

2) Caja family

- `CAJA1`: `ORDENA/pos/pos/caja1-wa.html`, `ORDENA/pos/pos/caja1-imp1.html`
- `CAJA2`: `ORDENA/pos/pos/caja2-wa.html`, `ORDENA/pos/pos/corte.html`

3) Pantallas / Left/Right (varias copias)

- `Pantallas/LEFTVIEW/*` (leftView3, leftView3-ordena, new-leftview etc.) — varias versiones y copias; actúan sobre `process/*` (mover entre etapas). (Confirmado)
- `Pantallas/rightView.html`, `Pantallas/new-rightView.html`, `Pantallas/rightView-out4.html` — manejo de etapas y corrections.

4) NEW GIT / Otras sucursales (variantes)

- Archivos: `NEW GIT/GIT 2/GIT/*.html`, `NEW GIT/GIT 2/GIT/ordena/sistema/punto-*.html` — contienen `globalComputer = liveView*` y escrituras a `process/firsts` y `orders/code0`. (Confirmado)

5) Admin / Facturación

- `facturacion-ORDENA/facturacion/admin.html` — lee `products/` y funciona como panel administrativo. (Confirmado)

---

## Detalle por tipo (funciones principales, lecturas/escrituras, comunicaciones, permisos)

Abajo cada tipo incluye: propósito, usuarios, funciones clave, lecturas, escrituras, comunicaciones, verificación de permisos, archivos relevantes.

### A. POS (Punto de venta)

- Propósito: Crear comandas, generar PDFs/etiquetas, enviar pedidos a producción, marcar inventario.
- Usuarios: Cajeros / anotadores.
- Funciones (confirmado por código): `generatePDF`, `uploadCompleteOrder`, `uploadOrderProduct`, `updateStock`, `substractStock`, `addNewProductDB`, `saveClientDB`, listeners `dbProducts.on('value')`, `process/timing`. (Véase `ORDENA/pos/pos/pos0-wa.html`.)
- Lee: `productos/` (secondaryApp), `relations/`, `inventory/<id>/stock`, `process/timing`, `orders/code0/` (en cajas), `.info/connected`.
- Escribe: `process/firsts/<id>`, `pending/<id>`, `orders/code0/<id>`, `liveviews/<globalComputer>/*`, `tablets/*/pendientes`, `inventory/<id>/stock`, `sugerencias/`, `registro/<employee>`.
- Comunica con: Tablets (`tablets/*`), Left/Right views (`process/*`), Cajas (`orders/code0`), otras POS (shared DB nodes), `secondaryApp` product DB.
- Permisos verificados: Ninguna validación server-side encontrada en los clientes; no se usa `firebase.auth()` en los POS confirmados. (Confirmado)
- Permisos no verificables en repo: Realtime DB rules, App Check o Auth en Firebase Console. (Operador)
- Archivos: `ORDENA/pos/pos/pos0-wa.html` (ejemplo), `ORDENA/pos/js/index.js` (configs), `ORDENA/pos/pos/pos1-wa.html`..`pos5-wa.html`.

### B. Caja / Corte

- Propósito: Cobros, revisión y cierre de órdenes. Mostrar y gestionar `orders/code0`.
- Usuarios: Encargado de caja.
- Funciones: lectura `orders/code0`, `separateObject` para paginar, marcar pagos y posiblemente eliminar órdenes procesadas. (Confirmado en `caja1-wa.html`.)
- Lee: `orders/code0/`, `process/*`, `relations`, `inventory`.
- Escribe: flags en `updates/caja1`/`updates/caja2`, posibles cambios en `orders/code0` durante corte. (Confirmado)
- Comunica con: POS (que escribe `orders/code0`), procesos de reporte. (Confirmado)
- Permisos: no verificados en repo (Operador debe confirmar reglas/Autenticación). (Confirmado)
- Archivos: `ORDENA/pos/pos/caja1-wa.html`, `ORDENA/pos/pos/caja2-wa.html`, `ORDENA/pos/pos/corte.html`.

### C. Tablets / Kitchen Screens (cremas / jamones / bodega / arriba)

- Propósito: Recibir productos pendientes y marcar su preparación/entrega; mover órdenes entre etapas `process/*`.
- Usuarios: Preparación / cocina.
- Funciones: mover entre `process/firsts`→`seconds`→`thirds`→`fourths`, escribir en `tablets/*/pendientes`. (Varios archivos en `Pantallas/` y `Pantallas/LEFTVIEW/`) (Confirmado)
- Lee: `tablets/*/pendientes`, `process/*`, `pending/*`.
- Escribe: `process/*` (set/remove), `process/whatsapp/<id>/stage`, `tablets/*` nodos. (Confirmado)
- Comunica con: POS (inputs), Left/Right Views (visualización), Cajas indirectamente por `orders/code0` y `process` estado. (Confirmado)
- Permisos: no verificados en repo. (Operador)
- Archivos: `Pantallas/new-rightView.html`, `Pantallas/rightView.html`, `Pantallas/LEFTVIEW/*`.

### D. Left/Right Big Views

- Propósito: Visualizar y manipular el flujo de pedidos por etapas para operaciones en planta.
- Usuarios: Operadores de planta, supervisores.
- Funciones: listeners a `process/firsts`, `process/seconds`, `process/thirds`, `process/fourths`; mover orders entre stages. (Confirmado)
- Lee: `process/*`, `process/namesOnLeftScreen`.
- Escribe: mueve orders entre `process/*`. (Confirmado)
- Comunica con: Tablets y POS. (Confirmado)
- Permisos: no verificados (Operador). (Confirmado)
- Archivos: `Pantallas/LEFTVIEW/*`, `Pantallas/rightView*`.

### E. Admin / Facturación

- Propósito: Gestión de catálogo, facturación (Facturama), proveedores, pruebas. (Confirmado)
- Usuarios: Administradores / contabilidad.
- Funciones: leer/escribir `products/`, `inventory/`, invocar Facturama API. (Confirmado)
- Lecturas/Escrituras: `products/`, `inventory/`, `providers/`, `registro`.
- Permisos: no verificados en repo. (Operador) 
- Archivos: `facturacion-ORDENA/facturacion/admin.html`.

### F. Otras sucursales / NEW GIT

- Propósito: variantes/clones para otras sucursales; contienen lógica similar a POS y pantallas. (Confirmado en repo)
- Archivos: `NEW GIT/GIT 2/GIT/index3-black.html`, `NEW GIT/GIT 2/GIT/ordena/sistema/punto-*.html`.
- Operador debe confirmar: si usan el mismo Firebase projects o independientes en producción.

---

## Problemas de seguridad registrados (pendientes, no implementar cambios ahora)

- No se encuentra `firebase.auth()` ni reglas Realtime DB en el repo: riesgo de escritura no autorizada si los configs están expuestos. (Confirmado)
- Acciones destructivas en clientes (ej. remover `orders/code0`, `process`, `pending`, `tablets/*`) están presentes en UI/admin — sin verificación server-side en código. (Confirmado)
- Pendiente: Operador debe revisar Realtime DB rules, Auth y App Check en Firebase Console para `cremeria-ordena` y `cremeria-imperial`.

---

## Archivos creados por este análisis

- `ORDENA/pos/pos/terminals-manifest.json` (manifiesto de terminales)
- `ORDENA/pos/pos/pos0-analysis.md` (análisis detallado de `pos0-wa.html`)
- `ORDENA/pos/pos/system-map.md` (este archivo)

---

## Siguientes pasos propuestos (elige uno)

- Generar CSV con variantes agrupadas (terminalId, canonical file, alternates, lastModified). (rápido)
- Extraer JSON machine-readable de nodos DB por función (útil para diseño 2.0). (más detallado)
- Consolidar `NEW GIT/GIT 2` en el manifiesto y marcar diferencias de proyecto Firebase. (confirmar)

Indica cuál prefieres y lo ejecuto.
