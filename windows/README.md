# Industrias Rockpeaks - Puente de Windows (prueba)

Esta herramienta complementa al addon de WoW Forever. Evita copiar manualmente el archivo de datos desde "Archivos de programa" al Escritorio cada vez que juegas.

## Instalacion (Windows 10 u 11)

1. Descarga el repositorio de GitHub con **Code > Download ZIP** y descomprimelo.
2. En la carpeta **windows**, haz doble clic en **IniciarRockpeaksBridge.cmd**.
3. La primera vez, selecciona el archivo **RockpeaksBridge.lua** ORIGINAL dentro de \`World of Warcraft\_forever_\WTF\Account\<tu cuenta>\SavedVariables\`.
4. El puente dejara una copia en el Escritorio: \`RockpeaksBridge.lua\`. Manten abierta la ventana del puente mientras quieras sincronizar.
5. En Chrome o Edge, abre [Industrias Rockpeaks](https://germancillo04071984.github.io/Rockpeaksah/) y ve a **Negocio > Mi personaje > Sincronizacion automatica con el PC**. Pulsa **Vincular archivo del juego** (o **Cambiar archivo vinculado**) y selecciona **RockpeaksBridge.lua** del Escritorio; acepta la lectura.
6. En WoW, abre tus profesiones, usa \`/rpbridge export\` y despues \`/reload\` (o cierra sesion). El juego guardara SavedVariables; el puente detectara el cambio y actualizara la copia del Escritorio en unos segundos. Con la web abierta, esta revisara el archivo periodicamente.

### Importante

- El puente **no** lee datos en vivo directamente de WoW. El addon solo escribe el archivo al cerrar sesion o usar \`/reload\`; no basta con ejecutar \`/rpbridge export\` sin guardar la interfaz.
- No accede a Internet, no pide claves API, no mueve el juego y no requiere permisos de administrador.
- Solo lee el archivo local que selecciones y sobrescribe la copia **RockpeaksBridge.lua** del Escritorio. Si ya tienes ese archivo ahi, se actualizara.
- Para detenerlo, cierra la ventana del puente. Si cambias la ubicacion del juego, borra \`%LOCALAPPDATA%\IndustriasRockpeaks\RockpeaksBridge-origen.txt\` y vuelve a iniciar el puente para seleccionar otro origen.
- El navegador puede pedir renovar permisos de lectura. La sincronizacion depende de que la pestaña este abierta y de sus restricciones de seguridad.
- **Version de prueba**: verificado el flujo por inspeccion de codigo, pero aun no probado en este Windows. No desactives Windows Defender ni otras protecciones para ejecutarlo.
