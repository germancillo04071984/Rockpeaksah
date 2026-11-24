# Rockpeaks AH V2 — fase 1
Rama experimental; no publicar ni sustituir addon existente. Núcleo de mercado independiente de la interfaz.

- Mercado fijo EU PvP Horda (eu-2-113 según la identificación documentada por el proveedor; contrastar con un escaneo del juego).
- Fuente https://auctionhouse.tk.gg/data/ (la versión anterior ya usa esta API). Actualización de mercado como máximo una vez por hora; histórico bajo demanda; guardar en caché en la futura aplicación.
- Separar los datos de cada fuente y su fecha. Los volúmenes externos son inferidos, no ventas personales. No mezclar históricos de mínimo y promedio.
- Tramos: el proveedor muestra hasta 60 niveles. Una cotización incompleta no es una compra viable. El stock NPC ilimitado requiere confirmación; no se deduce solo de tener precio NPC.
- Umbrales: ROI sobre coste completo, 10% NPC y 20% AH, comisión configurable. Redondeo conservador al cobre. Depósitos perdidos aún no incluidos; no presentar beneficio AH como realizado.
- TSM publica CSV: https://support.tradeskillmaster.com/tsm-public-web-api . Integración pendiente de verificar fichero exacto y esquema.
- Addon actual v0.3.0 captura personaje, no subasta. La vía inicial será SavedVariables + importador local; no usar memoria del juego ni extracción por píxeles. El escaneo manual con API C_AuctionHouse y límites de frecuencia queda pendiente de prueba en cliente real. La importación sin /reload no se ha verificado.
- Pruebas: node v2/market.test.mjs. Datos de prueba ficticios. El endpoint real no fue accesible desde el entorno de investigación.
