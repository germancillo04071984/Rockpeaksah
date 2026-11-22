-- Simulated World of Warcraft Forever client for offline Lua 5.1 regression testing.
-- This test does NOT claim to validate the addon inside the real game.
local player="Rockpeaks"
local frame=nil
DEFAULT_CHAT_FRAME={AddMessage=function()end}
SlashCmdList={}
CreateFrame=function()
 frame={RegisterEvent=function()end,SetScript=function(self,name,cb)self.callback=cb end}
 return frame
end
UnitName=function()return player end
GetRealmName=function()return "EU PvP" end
UnitLevel=function()return 31 end
GetMoney=function()return 18234 end
time=function()return 1795356000 end
GetProfessions=function()return 1,2 end
GetProfessionInfo=function(index)
 if index==1 then return "Alquimia",nil,75,150,0,0,171 end
 return "Peletería",nil,150,150,0,0,165
end
C_Container={
 GetContainerNumSlots=function(bag)return bag==0 and 2 or 0 end,
 GetContainerItemInfo=function(bag,slot)
  if bag~=0 then return nil end
  if slot==1 then return {itemID=3685,stackCount=32} end
  return {itemID=3371,stackCount=12}
 end
}
C_TradeSkillUI={
 GetAllRecipeIDs=function()return {718,9999} end,
 GetRecipeInfo=function(id)return {learned=id==718,name="Aceite de bocanegra"} end
}
local function has(text,part)
 assert(type(text)=="string" and string.find(text,part,1,true),
   "Falta en la captura: "..tostring(part))
end
dofile("addons/RockpeaksBridge/RockpeaksBridge.lua")
assert(frame and type(frame.callback)=="function","Evento de WoW no configurado")
frame.callback(frame,"TRADE_SKILL_SHOW")
frame.callback(frame,"PLAYER_LOGOUT")
has(RockpeaksBridgePayload,'"schema":"rockpeaks-character-v1"')
has(RockpeaksBridgePayload,'"gold":18234')
has(RockpeaksBridgePayload,'"id":3685')
has(RockpeaksBridgePayload,'"count":32')
has(RockpeaksBridgePayload,'"Alquimia"')
has(RockpeaksBridgePayload,'"name":"Aceite de bocanegra"')
has(RockpeaksBridgePayload,'"state":"available"')
assert(RockpeaksBridgeRecipes["EU PvP|Rockpeaks"][718],"Receta no guardada")
assert(RockpeaksBridgeRecipeScans["EU PvP|Rockpeaks"],"Ventana de profesiones no registrada")

-- A failed API call must be called unavailable, never incorrectly reported as an empty bag.
C_Container=nil
GetProfessions=nil
C_TradeSkillUI=nil
frame.callback(frame,"PLAYER_LOGOUT")
has(RockpeaksBridgePayload,'"state":"unavailable"')
has(RockpeaksBridgePayload,'"reason":"API de bolsas ausente"')
has(RockpeaksBridgePayload,'"reason":"API de profesiones ausente"')

-- Other characters on the same account must not inherit Rockpeaks recipes.
player="OtroPersonaje"
frame.callback(frame,"PLAYER_LOGOUT")
assert(not string.find(RockpeaksBridgePayload,"Aceite de bocanegra",1,true),
 "Recetas de Rockpeaks filtradas a otro personaje")
assert(RockpeaksBridgeRecipes["EU PvP|Rockpeaks"][718],
 "No se han conservado las recetas del personaje original")
print("WOW_FOREVER_LUA_MOCK_PASS")
