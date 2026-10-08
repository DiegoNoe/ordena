# Análisis: pos0-wa.html (Imperial POS)

Generado: 2026-09-15

Resumen rápido:
- `pos0-wa.html` contiene las funciones principales del POS: generación de nota (`generatePDF`), envío de ordenes (`uploadCompleteOrder`, `uploadOrderProduct`), actualización de inventario (`updateStock`, `substractStock`), manejo de clientes (`saveClientDB`) y comunicación con tablets (`tablets/*`) y `liveviews/*`.
- Muchas operaciones usan la app primaria (`firebase.database()`) y algunas lecturas de productos/servicios usan la app secundaria (`secondaryApp.database()`). Ver `ORDENA/pos/js/index.js` para los `firebaseConfig` (proyectos: `cremeria-ordena` y `cremeria-imperial`).
- No se encontraron reglas de seguridad de Firebase en el repo (solo `firebase.json` para funciones). Las validaciones de permisos en el cliente son inferencias de UI; no hay comprobaciones de servidor en el código leíble aquí.

Evidencia principal:
- Inicialización de Firebase y configs: [ORDENA/pos/js/index.js](ORDENA/pos/js/index.js#L1)
- Definición de terminal (variable): [ORDENA/pos/pos/pos0-wa.html](ORDENA/pos/pos/pos0-wa.html#L76)

Tabla de funciones y efectos (pos0-wa.html)

| Función | Acción del usuario | Datos leídos | Datos escritos | Base de datos | Permisos validados por servidor? | Efecto en otras terminales / procesos | Evidencia |
|---|---:|---|---|---|---|---|---|
| `generatePDF(orderMethod)` | Pulsar imprimir / crear nota (MOSTRADOR/TELEFONO/WHATSAPP) | Productos en pantalla, cliente, anotador | Crea `pending/`, `process/firsts/`, `orders/code0/` via `uploadCompleteOrder` | Escribe en `firebase.database()` (primaria) y usa `secondaryApp` para productos | No (cliente sólo comprueba campos UI) | Actualiza `process/firsts/` (lectores: tablets y cajas), `liveviews/<globalComputer>/wtime` | [generatePDF](ORDENA/pos/pos/pos0-wa.html#L1877), writes: [process write](ORDENA/pos/pos/pos0-wa.html#L2323), [liveviews wtime](ORDENA/pos/pos/pos0-wa.html#L2367) |
| `uploadCompleteOrder(...)` | Interno tras generar PDF | Ninguna adicional (usa params) | `orders/code0/<id>`, `registro/<employee>/pedidos`, `process/whatsapp` | `firebase.database()` | No | Persiste orden para cajas; cajas leen `orders/code0/` (corte/caja UI) | [uploadCompleteOrder](ORDENA/pos/pos/pos0-wa.html#L2653), orders write [L2666](ORDENA/pos/pos/pos0-wa.html#L2666) |
| `uploadOrderProduct(...)` | Añadir ítem en lista | Producto local (defiantProducts) | Crea/actualiza entrada temporal de orden en `liveviews/<globalComputer>/order/...` y `pending` | primaria (`firebase.database()`) | No | Tablets (`tablets/*`) y procesos de cocina reciben `pending/...` y `tablets/*/pendientes` | [uploadOrderProduct](ORDENA/pos/pos/pos0-wa.html#L2829), pending/tablets writes [L2929-L2971](ORDENA/pos/pos/pos0-wa.html#L2929) |
| `updateStock(product)` / `substractStock(id,quantity)` | Nota directa que marca stock | Lee `inventory/<id>/stock` | Actualiza `inventory/<id>/stock` | primaria | No | Afecta inventario global leído por otros POS y procesos | [updateStock](ORDENA/pos/pos/pos0-wa.html#L2373), [substractStock](ORDENA/pos/pos/pos0-wa.html#L2405) |
| `addNewProductDB(inputs)` | Admin agrega producto (modal) | N/A (lee form) | `products/<id>`, `inventory/<id>/stock` | `firebase` primaria | No | Productos disponibles a todos (defiant snapshot usado cliente-side) | [addNewProductDB](ORDENA/pos/pos/pos0-wa.html#L1585), writes [L1591-L1605](ORDENA/pos/pos/pos0-wa.html#L1591) |
| `saveClientDB(name,number,...)` | Guardar cliente desde modal | N/A | `service/7isReady/<number>` (usa `secondaryApp`) | secundaria (`secondaryApp.database()`) | No | Actualiza lista de clientes usada por POS y tablets | [saveClientDB](ORDENA/pos/pos/pos0-wa.html#L1217) |
| Listeners: `dbProducts.on('value',...)` | (inicio) carga catálogo | `productos/` (secundaria) | N/A (local snapshot) | `secondaryApp` | N/A | Mantiene `defiantProducts` para búsqueda y precios | see top init in file and [dbProducts binding](ORDENA/pos/pos/pos0-wa.html#L18) |
| `populateWaitingTimes()` listener | (inicio) | `process/timing` | Actualiza UI `globalTimePerProduct` | primaria | N/A | Influye cálculos de ETA en `generatePDF` y `liveviews` | [timing listener](ORDENA/pos/pos/pos0-wa.html#L2615) |
| Botones extra (delete/all clear) | UI admin | N/A | `orders/code0` remove, `pending` remove, `process` remove, `tablets/*` remove | primaria | No (accion de cliente) | Limpia datos globales, afecta todas las terminales y tablets | see delete block [L651-L676](ORDENA/pos/pos/pos0-wa.html#L651) |

Notas sobre DB primaria vs secundaria:
- `firebase.database().ref(...)` apunta al proyecto configurado como `firebaseConfig` en [ORDENA/pos/js/index.js](ORDENA/pos/js/index.js#L1) (project: `cremeria-ordena`, URL: `https://cremeria-ordena-default-rtdb.firebaseio.com`).
- `secondaryApp.database().ref(...)` apunta a `firebaseConfig2` (project: `cremeria-imperial`, URL: `https://cremeria-imperial.firebaseio.com`). Muchas lecturas de `productos/` y `service/7isReady/` usan `secondaryApp`.

Autenticación y roles:
- No se utiliza `firebase.auth()` en `pos0-wa.html` ni en los POS revisados. La selección de empleado es un `select` de UI (`#inputEmployeeName`) y se incrementan contadores en `registro/<employee>` cuando se sube una orden, pero esto no valida identidad frente al servidor.
- No se encontraron reglas de seguridad de Realtime Database en el repositorio. Resultado: los permisos efectivos no están verificados desde este código (hay riesgo de escritura desde cualquier cliente con el config). Archivo de funciones: [ORDENA/pos/pos/firebase.json](ORDENA/pos/pos/firebase.json#L1).

Conexiones con tablets y cajas / otros procesos:
- Tablets: escribe `tablets/cremas/pendientes`, `tablets/jamones/pendientes`, `tablets/bodega/pendientes`, `tablets/arriba/pendientes` y también `liveviews/<globalComputer>/sorder` y `liveviews/<globalComputer>/order` — tablets leen esos nodos. Evidencia: múltiples escrituras a `tablets/...` y `liveviews/...` ([ej. L2929, L2952, L2971, L2482, L2831]).
- Cajas: usan `orders/code0/` y `process/*`. `caja1-wa.html` y `caja2-wa.html` leen `orders/code0/` y `process` (ver [ORDENA/pos/pos/caja1-wa.html](ORDENA/pos/pos/caja1-wa.html#L1)).
- Otros procesos: `registro/` (contadores), `sugerencias/`, `pending/`, `inventory/` y `relations/` son nodos compartidos entre terminales.

Limitaciones y siguientes pasos recomendados:
- Falta de reglas de seguridad: publicar un conjunto mínimo de reglas que restrinjan escrituras a nodos sensibles (p.ej. `inventory`, `orders/code0`, `process`) y que validen `uid` o App Check.
- Autenticación: agregar Firebase Auth o un mecanismo de PIN/empleado + verificación servidor-side antes de permitir acciones destructivas (borrar `orders/code0`, `process`).
- Canonicalidad de archivos: se ha usado timestamp y tamaño para marcar `canonical`; en algunos casos (p.ej. `pos0-wa.html`) el contenido interno difiere (UI y operaciones de borrado). Marcar como "hipótesis" hasta que se confirme despliegue/host real.

Archivo con el que se generó este análisis: `ORDENA/pos/pos/terminals-manifest.json` y este mismo análisis `ORDENA/pos/pos/pos0-analysis.md`.

*** Fin del análisis
