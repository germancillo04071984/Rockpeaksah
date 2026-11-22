"use strict";
(function(){
 const core=window.RockpeaksCharacterCore,bridge=window.RockpeaksCharacterBridge;
 const host=document.getElementById("bridge-import")?.closest("p");
 if(!core||!bridge||!host)return;
 const box=document.createElement("div");box.className="bridge-auto";
 box.innerHTML='<h3>Sincronización automática con el PC</h3>'+
  '<p class="muted">Una vez autorizado el archivo RockpeaksBridge.lua en Chrome o Edge, se comprueban los cambios mientras la aplicación está abierta. No hay que volver a importar cada vez.</p>'+
  '<p><button type="button" id="bridge-link">Vincular archivo del juego</button> <button type="button" id="bridge-authorize" hidden>Renovar permiso</button> <button type="button" id="bridge-disconnect" hidden>Desconectar</button></p>'+
  '<p id="bridge-auto-status" role="status" aria-live="polite">Comprobando la conexión local…</p>'+
  '<small>Solo lectura. El navegador puede solicitar permiso de nuevo tras cerrarse. Para actualizar, WoW debe haber guardado el archivo al salir o al recargar interfaz. No se transmite a servidores.</small>';
 host.before(box);
 const $=id=>document.getElementById(id);
 const status=$("bridge-auto-status");
 const connect=$("bridge-link"),authorize=$("bridge-authorize"),disconnect=$("bridge-disconnect");
 const supported=typeof window.showOpenFilePicker==="function"&&typeof window.indexedDB!=="undefined";
 const DB_NAME="rockpeaks-local-file-handles-v1",STORE="files",KEY="character";
 let handle=null,signature=null,checking=false;
 const label=t=>{status.textContent=t};
 function refreshButtons(permission){
  connect.textContent=handle?"Cambiar archivo vinculado":"Vincular archivo del juego";
  disconnect.hidden=!handle;
  authorize.hidden=!handle||permission!=="prompt";
 }
 function openDB(){
  return new Promise((resolve,reject)=>{
   const request=indexedDB.open(DB_NAME,1);
   request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
   request.onerror=()=>reject(request.error||Error("No se pudo abrir el almacén de permisos."));
   request.onsuccess=()=>resolve(request.result);
  });
 }
 async function readStored(){
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,"readonly"),q=tx.objectStore(STORE).get(KEY);
   q.onsuccess=()=>resolve(q.result||null);
   q.onerror=()=>reject(q.error||Error("No se pudo recuperar el archivo."));
  })}finally{db.close()}
 }
 async function store(value){
  const db=await openDB();
  try{
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||Error("No se pudo guardar la vinculación."));
    if(value)tx.objectStore(STORE).put(value,KEY);
    else tx.objectStore(STORE).delete(KEY);
   })
  }finally{db.close()}
 }
 async function permission(){
  if(!handle)return "denied";
  try{return typeof handle.queryPermission==="function"?
   await handle.queryPermission({mode:"read"}):"prompt"}catch{return "prompt"}
 }
 async function check(force=false){
  if(!handle||checking)return;
  checking=true;
  try{
   const p=await permission();
   refreshButtons(p);
   if(p!=="granted"){label("Archivo recordado, pero falta autorización. Pulsa «Renovar permiso» para continuar.");return}
   const file=await handle.getFile();
   if(file.size>1000000)throw Error("El archivo supera 1 MB. No se ha leído.");
   const latest=file.lastModified+":"+file.size;
   if(!force&&latest===signature)return;
   const snapshot=core.parse(await file.text());
   if(snapshot.character.name.toLocaleLowerCase()!=="rockpeaks"){
    label("La última captura corresponde a "+snapshot.character.name+", no a Rockpeaks. No se han sustituido sus datos.");
    signature=latest;return;
   }
   if(!bridge.importSnapshot(snapshot)){
    label("La captura del archivo es anterior a la que ya tienes guardada. No se ha sobrescrito.");
   }else{
    label("Sincronización activa · "+snapshot.character.name+
     " · última captura del juego: "+new Date(snapshot.capturedAt*1000).toLocaleString("es-ES")+
     ". Los datos locales se han actualizado.");
   }
   signature=latest;
  }catch(err){
   label("No se pudo leer la captura: "+err.message+". Conservamos la última importación. Revisa el archivo o vuelve a vincularlo.");
  }finally{checking=false}
 }
 async function connectFile(){
  if(!supported)return;
  try{
   // The picker must run inside the real button click's user gesture.
   const chosen=await window.showOpenFilePicker({multiple:false,types:[
    {description:"Captura de Rockpeaks Bridge",accept:{"text/plain":[".lua"],"application/json":[".json"]}}
   ]});
   const next=chosen?.[0];
   if(!next)return;
   if(!/^RockpeaksBridge\.(lua|json)$/i.test(next.name)){
    label("Selecciona RockpeaksBridge.lua dentro de la carpeta SavedVariables del juego.");return;
   }
   handle=next;signature=null;refreshButtons(await permission());
   // A saved handle is stored in IndexedDB. If that fails, the active session still works.
   try{await store(handle)}
   catch(err){label("Conectado temporalmente, pero el navegador no puede recordar el permiso: "+err.message)}
   await check(true);
  }catch(err){
   if(err?.name!=="AbortError")label("No se pudo vincular el archivo: "+err.message);
  }
 }
 connect.onclick=connectFile;
 authorize.onclick=async()=>{
  if(!handle)return;
  try{
   // Request must originate from this click; do not invoke on a timer.
   const p=typeof handle.requestPermission==="function"?
    await handle.requestPermission({mode:"read"}):"denied";
   refreshButtons(p);
   if(p==="granted")await check(true);
   else label("El permiso sigue sin concederse. Puedes volver a vincular el archivo.");
  }catch(err){label("No se pudo renovar el permiso: "+err.message)}
 };
 disconnect.onclick=async()=>{
  handle=null;signature=null;refreshButtons("denied");
  try{await store(null);label("Conexión local desconectada. La última captura y tu contabilidad siguen guardadas.")}
  catch(err){label("Desconectado por ahora; no se pudo borrar el permiso recordado: "+err.message)}
 };
 if(!supported){
  connect.disabled=true;
  label("Lectura automática no disponible en este navegador. En PC utiliza Chrome o Edge; también puedes importar manualmente.");
  return;
 }
 (async()=>{
  try{
   handle=await readStored();
   if(!handle){label("Sin archivo vinculado. Hazlo una vez para activar la sincronización.");return}
   if(!/^RockpeaksBridge\.(lua|json)$/i.test(handle.name)){
    handle=null;label("El archivo recordado no es RockpeaksBridge.lua. Vincula el correcto.");return;
   }
   const p=await permission();
   refreshButtons(p);
   if(p==="granted")await check(true);
   else label("Archivo recordado ("+handle.name+"). Pulsa «Renovar permiso» si el navegador lo solicita.");
  }catch(err){label("No se pudo recuperar la vinculación anterior: "+err.message+". Puedes vincular el archivo de nuevo.")}
 })();
 // Browsers throttle background timers; focus triggers an immediate check after playing.
 setInterval(()=>{if(document.visibilityState!=="hidden")check()},15000);
 window.addEventListener("focus",()=>check());
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check()});
})();
