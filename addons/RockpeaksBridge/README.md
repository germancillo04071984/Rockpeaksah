# Rockpeaks Bridge · prototipo 0.1.0 (WoW Forever)

Exportador **local y de solo lectura** para Industrias Rockpeaks. No automatiza la subasta, no compra, no vende y no envía datos por Internet.

## Instalación

1. Coloca la carpeta `RockpeaksBridge` (la que contiene `RockpeaksBridge.toc`) dentro de `World of Warcraft\\_forever_\\Interface\\AddOns\\`.
2. Comprueba en la selección de personaje que el addon aparece habilitado.
3. Entra con Rockpeaks y **abre cada ventana de profesión** que quieras registrar. Algunas recetas solo son visibles para addons mientras el panel de profesión está abierto.
4. Escribe `/rpbridge export` en el chat y después `/reload` para guardar la captura en disco.
5. Abre `World of Warcraft\\_forever_\\WTF\\Account\\<tu cuenta>\\SavedVariables\\RockpeaksBridge.lua`.
6. En la aplicación web, entra en **Negocio → Mi personaje** e importa ese archivo.

## Datos incluidos y límites

- Oro total del personaje, nivel, nombre y reino.
- Rangos de profesión que exponga el cliente.
- Objetos presentes en las bolsas 0-4 (sin banco).
- Identificadores y nombres de recetas que la API de profesiones exponga como aprendidas, tras abrir sus ventanas.
- No hay sincronización en tiempo real. Las SavedVariables se guardan al recargar interfaz o cerrar sesión.
- El importador **no modifica tu contabilidad ni tus recetas aprendidas confirmadas**: los identificadores de recetas del cliente no equivalen necesariamente a los IDs del catálogo de subasta.
- Si algún dato no aparece, puede ser una limitación de la API o que todavía no se haya abierto la ventana necesaria.
- Nunca compartas archivos de otras carpetas WTF: podrían contener datos ajenos o información personal.

**Estado de validación:** estructura y parser probables bajo la API WoW Forever 1.60.1, pero este prototipo todavía requiere una prueba dentro del juego real. No se debe considerar compatible con todos los clientes hasta confirmarlo.
