-- Rockpeaks Bridge 0.3.0 for WoW Forever (Interface 16001).
-- Read-only. Never sends data over the network, automates auctions or changes game data.
RockpeaksBridgeRecipes = RockpeaksBridgeRecipes or {}
RockpeaksBridgeRecipeScans = RockpeaksBridgeRecipeScans or {}

local function say(message)
 if DEFAULT_CHAT_FRAME then DEFAULT_CHAT_FRAME:AddMessage("|cffcf5757Rockpeaks Bridge:|r "..message) end
end

local escapes={['"']='\\"',['\\']='\\\\',['\n']='\\n',['\r']='\\r',['\t']='\\t'}
local function jsonString(value)
 return '"'..string.gsub(value,'[%z\1-\31\\"]',function(c)
  return escapes[c] or string.format("\\u%04x",string.byte(c))
 end)..'"'
end
local function isArray(t)
 if #t>0 then return true end
 return next(t)==nil
end
local function json(value)
 local kind=type(value)
 if kind=="string" then return jsonString(value) end
 if kind=="number" then
  if value~=value or value==math.huge or value==-math.huge then return "null" end
  return tostring(value)
 end
 if kind=="boolean" then return value and "true" or "false" end
 if kind~="table" then return "null" end
 local parts={}
 if isArray(value) then
  for i=1,#value do parts[#parts+1]=json(value[i]) end
  return "["..table.concat(parts,",").."]"
 end
 for k,v in pairs(value) do
  if type(k)=="string" then parts[#parts+1]=jsonString(k)..":"..json(v) end
 end
 return "{"..table.concat(parts,",").."}"
end

local function professions()
 local out={}
 if type(GetProfessions)~="function" or type(GetProfessionInfo)~="function" then
  return out,{state="unavailable",reason="API de profesiones ausente"} end
 local ok,indexes=pcall(function()return {GetProfessions()} end)
 if not ok then return out,{state="unavailable",reason="Error al consultar profesiones"} end
 local errors=0
 for _,index in ipairs(indexes) do
  if index then
   local good,name,icon,rank,max,n,offset,id=pcall(GetProfessionInfo,index)
   if good and type(name)=="string" and type(rank)=="number" and type(max)=="number" then
    out[#out+1]={name=name,rank=math.max(0,math.floor(rank)),max=math.max(0,math.floor(max)),
     id=type(id)=="number" and id or 0}
   else errors=errors+1 end
  end
 end
 return out,{state=errors==0 and "available" or "partial",
  reason=errors>0 and ("No se pudieron leer "..errors.." profesiones") or ""}
end

local function bags()
 local countById={}
 local container=C_Container
 if not container or type(container.GetContainerNumSlots)~="function" or
   type(container.GetContainerItemInfo)~="function" then
  return {},{state="unavailable",reason="API de bolsas ausente"} end
 local inspected,errors=0,0
 for bag=0,4 do
  local ok,slots=pcall(container.GetContainerNumSlots,bag)
  if ok and type(slots)=="number" and slots>=0 then
   inspected=inspected+1
   for slot=1,slots do
    local success,item=pcall(container.GetContainerItemInfo,bag,slot)
    if not success then errors=errors+1
    elseif type(item)=="table" then
     local id=item.itemID
     local count=item.stackCount
     if type(id)=="number" and type(count)=="number" and id>0 and count>0 then
      countById[id]=(countById[id] or 0)+count
     else errors=errors+1 end
    end
   end
  else errors=errors+1 end
 end
 local result={}
 for id,count in pairs(countById) do result[#result+1]={id=id,count=count} end
 table.sort(result,function(a,b)return a.id<b.id end)
 local state=inspected==0 and "unavailable" or
  (inspected<5 or errors>0) and "partial" or "available"
 local reason=state=="available" and "" or
  ("Bolsas consultadas "..inspected.."/5; lecturas fallidas "..errors)
 return result,{state=state,reason=reason}
end

local function characterKey()
 local name=type(UnitName)=="function" and UnitName("player") or ""
 local realm=type(GetRealmName)=="function" and GetRealmName() or ""
 if type(name)~="string" or name=="" then return nil end
 return (type(realm)=="string" and realm or "").."|"..name
end

local function recipesForCharacter()
 local key=characterKey()
 if not key then return nil end
 if type(RockpeaksBridgeRecipes[key])~="table" then RockpeaksBridgeRecipes[key]={} end
 return RockpeaksBridgeRecipes[key]
end

local function gatherKnown()
 local records=recipesForCharacter()
 if not records then return end
 local api=C_TradeSkillUI
 if not api or type(api.GetAllRecipeIDs)~="function" or type(api.GetRecipeInfo)~="function" then return end
 local ok,ids=pcall(api.GetAllRecipeIDs)
 if not ok or type(ids)~="table" then return end
 local seen=0
 for _,id in ipairs(ids) do
  if type(id)=="number" then
   local success,info=pcall(api.GetRecipeInfo,id)
   if success and type(info)=="table" then
    seen=seen+1
    if info.learned==true then
     records[id]={id=id,name=type(info.name)=="string" and info.name or ""}
    end
   end
  end
 end
 if seen>0 then
  local key=characterKey()
  if key then RockpeaksBridgeRecipeScans[key]=true end
 end
end
local function knownList()
 local result={}
 local records=recipesForCharacter() or {}
 for id,record in pairs(records) do
  if type(id)=="number" and type(record)=="table" then
   result[#result+1]={id=id,name=type(record.name)=="string" and record.name or ""}
  end
 end
 table.sort(result,function(a,b)return a.id<b.id end)
 return result
end
local function capture()
 gatherKnown()
 local name=type(UnitName)=="function" and UnitName("player") or nil
 local realm=type(GetRealmName)=="function" and GetRealmName() or ""
 local level=type(UnitLevel)=="function" and UnitLevel("player") or 1
 local money=type(GetMoney)=="function" and GetMoney() or 0
 if type(name)~="string" or not name then return nil,"personaje no disponible" end
 local professionList,professionStatus=professions()
 local bagList,bagStatus=bags()
 local recipeKey=characterKey()
 local recipeStatus=RockpeaksBridgeRecipeScans[recipeKey] and "available" or "unobserved"
 if not C_TradeSkillUI or type(C_TradeSkillUI.GetAllRecipeIDs)~="function" then recipeStatus="unavailable" end
 local snapshot={schema="rockpeaks-character-v1",version=1,capturedAt=time(),
  character={name=name,realm=type(realm)=="string" and realm or "",level=level,gold=money},
  professions=professionList,bagItems=bagList,knownRecipes=knownList(),
  diagnostics={professions=professionStatus,bags=bagStatus,
   recipes={state=recipeStatus,reason=recipeStatus=="unobserved" and
    "Abre las ventanas de profesiones para revisar las recetas" or
    recipeStatus=="unavailable" and "API de recetas no disponible" or ""}}}
 RockpeaksBridgePayload=json(snapshot)
 return snapshot
end

local frame=CreateFrame("Frame")
frame:RegisterEvent("TRADE_SKILL_SHOW")
frame:RegisterEvent("TRADE_SKILL_LIST_UPDATE")
frame:RegisterEvent("PLAYER_LOGOUT")
frame:SetScript("OnEvent",function(_,event)
 if event=="PLAYER_LOGOUT" then
  -- SavedVariables are written immediately after PLAYER_LOGOUT.
  -- The latest capture is therefore persisted without a chat command.
  pcall(capture)
 elseif event=="TRADE_SKILL_SHOW" or event=="TRADE_SKILL_LIST_UPDATE" then
  pcall(gatherKnown)
 end
end)

SLASH_ROCKPEAKSBRIDGE1="/rpbridge"
SlashCmdList.ROCKPEAKSBRIDGE=function(command)
 command=string.lower((command or ""):match("^%s*(.-)%s*$"))
 if command=="export" then
  local ok,snapshot,err=pcall(capture)
  if not ok or not snapshot then say("No se pudo crear la captura: "..tostring(err or snapshot));return end
  say("Captura preparada: "..snapshot.character.name..
   " · profesiones "..#snapshot.professions.." · objetos "..#snapshot.bagItems..
   " · recetas del cliente "..#snapshot.knownRecipes..".")
  say("La captura también se guarda automáticamente al cerrar sesión o recargar la interfaz.")
 elseif command=="status" then
  say(type(RockpeaksBridgePayload)=="string" and
   "Hay una captura preparada. Al salir del juego se actualizará automáticamente." or "La captura se generará automáticamente al salir del juego.")
 else
  say("Captura automática al salir. Abre las profesiones para recopilar recetas. Comando opcional: /rpbridge export.")
 end
end
