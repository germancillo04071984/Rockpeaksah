# Rockpeaks Bridge 0.2.0 · Captura automática (WoW Forever)

Exportador **local y de solo lectura** para Industrias Rockpeaks. No automatiza subastas, compras ni ventas, y no envía datos del juego a Internet.

## Instalación: una sola vez en Windows

1. Descarga el ZIP Rockpeaks Bridge 0.2.0 desde **Negocio → Mi personaje** en la aplicación web.
2. Extrae la carpeta RockpeaksBridge y cópiala dentro de World of Warcraft\_forever_\Interface\AddOns\ (o en la carpeta Interface\AddOns de tu instalación de Forever).
3. Comprueba en la pantalla de selección de personaje que **Rockpeaks Bridge** está habilitado.
4. Entra en Rockpeaks y abre las ventanas de las profesiones que quieras registrar para que el addon pueda leer las recetas que el cliente exponga.

**A partir de aquí no hace falta escribir comandos:** al cerrar sesión, el evento PLAYER_LOGOUT prepara una captura y WoW guarda su variable en WTF\Account\<tu cuenta>\SavedVariables\RockpeaksBridge.lua. También puedes usar /rpbridge export si necesitas generar una captura manualmente antes de /reload.

## Vincular una sola vez en el navegador

1. Abre https://germancillo04071984.github.io/Rockpeaksah/ en **Chrome o Edge para Windows**, dejando la pestaña abierta en la segunda pantalla.
2. Entra en **Negocio → Mi personaje → Sincronización automática con el PC**.
3. Pulsa **Vincular archivo del juego** y selecciona RockpeaksBridge.lua dentro de la carpeta WTF\Account\<tu cuenta>\SavedVariables.
4. Autoriza al navegador a leer el archivo. La aplicación lo recordará cuando el navegador lo permita y comprobará cambios periódicamente mientras esté abierta. Al volver a la pestaña, también comprueba inmediatamente.

El navegador puede pedir **renovar permiso** tras cerrar sus ventanas; para ello hay un botón. Si el navegador no es compatible, seguirá disponible la importación manual. No hace falta instalar programas auxiliares.

## Datos y límites

- Captura: oro total del personaje, nivel, profesiones que exponga el cliente, inventario de las bolsas 0–4 (no incluye el banco) y recetas que la API del cliente informe como aprendidas.
- Se separa la información de recetas por personaje y reino, y la web **solo sincroniza Rockpeaks**; cerrar sesión en otro personaje no sustituye sus datos.
- Las recetas del cliente no se marcan automáticamente como aprendidas en el mercado, porque **los identificadores no tienen por qué coincidir**.
- Los datos de la captura **no sustituyen la contabilidad**, los movimientos de inventario, las ventas ni el capital empresarial.
- El navegador no puede leer el disco sin tu autorización, ni cuando la aplicación está completamente cerrada. La lectura automática funciona con la web abierta y permiso vigente; puede demorarse si Chrome o Edge suspenden la pestaña.
- Los datos permanecen en el PC y en el almacenamiento local del navegador; **no se suben a GitHub**.

**Estado:** interfaz de navegador, importador y pruebas automatizadas verificables; el addon todavía necesita una prueba dentro del cliente real de WoW Forever. Hay constancia de incidencias históricas de SavedVariables en algunas versiones beta, por lo que no se debe asumir compatibilidad con todas las instalaciones sin comprobarlo.
