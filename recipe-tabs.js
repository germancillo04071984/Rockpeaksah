"use strict";
(function(){
 const panel=document.getElementById("panel-recipes");
 if(!panel)return;
 const nodes=[...panel.children].filter(node=>node.tagName==="SECTION"&&node.classList.contains("card"));
 // Three already initialized independent sections: client recipe catalog, market scanner, locale manager.
 if(nodes.length!==3)return;
 const sections=[
  {id:"opportunities",label:"📊 Oportunidades",node:nodes[1]},
  {id:"catalogue",label:"📚 Catálogo",node:nodes[0]},
  {id:"translations",label:"🌍 Idioma y copias",node:nodes[2]}
 ];
 const nav=document.createElement("nav");
 nav.className="recipe-tabs";
 nav.setAttribute("role","tablist");
 nav.setAttribute("aria-label","Herramientas de recetas");
 function select(id,focus=false){
  if(!sections.some(s=>s.id===id))id="opportunities";
  for(const section of sections){
   const active=section.id===id;
   section.node.hidden=!active;
   const btn=nav.querySelector('[data-recipe-tab="'+section.id+'"]');
   btn.setAttribute("aria-selected",String(active));
   btn.tabIndex=active?0:-1;
   if(active&&focus)btn.focus();
  }
 }
 sections.forEach((s,i)=>{
  s.node.id="recipe-tool-"+s.id;
  s.node.setAttribute("role","tabpanel");
  s.node.setAttribute("aria-label",s.label.replace(/^\S+\s/,""));
  const btn=document.createElement("button");
  btn.type="button";btn.dataset.recipeTab=s.id;btn.textContent=s.label;
  btn.setAttribute("role","tab");
  btn.setAttribute("aria-controls",s.node.id);
  btn.id="recipe-tab-"+s.id;
  btn.onclick=()=>select(s.id);
  btn.addEventListener("keydown",event=>{
   if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
   event.preventDefault();
   const next=event.key==="Home"?0:event.key==="End"?sections.length-1:
    (i+(event.key==="ArrowLeft"?sections.length-1:1))%sections.length;
   select(sections[next].id,true);
  });
  nav.append(btn);
  s.node.setAttribute("aria-labelledby",btn.id);
 });
 panel.insertBefore(nav,nodes[0]);
 const hint=document.createElement("p");
 hint.className="muted recipe-tabs-hint";
 hint.textContent="Primero las oportunidades. El catálogo completo y las traducciones están en sus propias pestañas.";
 panel.insertBefore(hint,nodes[0]);
 select("opportunities");
})();
