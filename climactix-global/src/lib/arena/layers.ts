/**
 * Layer catalogue for the Climate Arena.
 *
 * Raster layers are NASA GIBS WMTS products (identifiers, matrix sets, colormaps
 * and legends verified against the GIBS GetCapabilities document, Nov 2026).
 * Time "default" requests the latest available date; GIBS snaps any requested
 * date to the product period and reports the date actually served in the
 * `layer-time-actual` header, which the UI displays.
 */
import type { ObsCategory } from "./constellation";

export type { ObsCategory };
export type LayerGroup = "carbon" | "temperature" | "air" | "water" | "infrastructure" | "context";
export type Cadence = "daily" | "2-day" | "8-day" | "monthly" | "static";
/** How fresh a product can be — drives the "data freshness" wording; nothing here is called live. */
export type Latency = "nrt" | "standard" | "reanalysis" | "climatology";

export interface GibsLayer {
  kind: "gibs";
  id: string;
  group: LayerGroup;
  obs?: ObsCategory;
  label: string;
  gibsId: string;
  matrixSet: string;
  maxLevel: number;
  format: "png" | "jpg";
  time: string;
  legend?: string;
  colormap?: string;
  alpha: number;
  measures: string;
  dataset: string;
  source: string;
  resolution: string;
  units: string;
  cadence: Cadence;
  latency: Latency;
  processing: string;
  quality: string;
  caveat: string;
}

export interface VectorLayer {
  kind: "vector";
  id: string;
  group: LayerGroup;
  label: string;
  measures: string;
  source: string;
  caveat: string;
}

export type ArenaLayer = GibsLayer | VectorLayer;

const G = "https://gibs.earthdata.nasa.gov";
const L = (f: string) => `${G}/legends/${f}`;
const CM = (f: string) => `${G}/colormaps/v1.3/${f}.xml`;

type GibsSpec = Omit<GibsLayer, "kind" | "time" | "format"> & { format?: "png" | "jpg"; time?: string };
const g = (s: GibsSpec): GibsLayer => ({ kind: "gibs", format: "png", time: "default", ...s });

export const LAYERS: ArenaLayer[] = [
  // ── Carbon: concentration · inventory · point sources ─────────────────────
  g({ id: "xco2", group: "carbon", obs: "carbon", label: "CO₂ column concentration (OCO-2, daily)",
    gibsId: "OCO-2_Carbon_Dioxide_Total_Column_Average", matrixSet: "GoogleMapsCompatible_Level8", maxLevel: 8,
    legend: L("OCO_Carbon_Dioxide_Total_Column_Average_H.svg"), colormap: CM("OCO_Carbon_Dioxide_Total_Column_Average"), alpha: 0.95,
    measures: "Column-averaged dry-air CO₂ mole fraction (XCO₂)", dataset: "OCO-2 Level 2 Lite XCO₂", source: "NASA OCO-2 via NASA GIBS",
    resolution: "1.3 × 2.25 km footprints, ~10 km swath", units: "ppm", cadence: "daily", latency: "standard",
    processing: "Full-physics retrieval of O₂ A-band and two CO₂ bands; bias-corrected Lite product",
    quality: "Only good-quality soundings shown; clouds and aerosols remove many soundings",
    caveat: "Concentration, not emissions. CO₂ is well mixed (≈420 ppm), so city plumes add only 1–3 ppm. Narrow daily swaths leave most of the globe empty on a given date." }),
  g({ id: "ch4", group: "carbon", obs: "carbon", label: "Methane at 400 hPa (AIRS, monthly)",
    gibsId: "AIRS_L3_Methane_400hPa_Volume_Mixing_Ratio_Monthly_Day", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("AIRS_Methane_Volume_Mixing_Ratio_H.svg"), colormap: CM("AIRS_Methane_Volume_Mixing_Ratio"), alpha: 0.85,
    measures: "Methane volume mixing ratio in the mid-troposphere", dataset: "AIRS/Aqua L3 monthly, daytime", source: "NASA AIRS (Aqua) via NASA GIBS",
    resolution: "1° grid", units: "ppbv", cadence: "monthly", latency: "standard",
    processing: "Thermal-infrared retrieval, gridded monthly mean of ascending (daytime) overpasses",
    quality: "Most sensitive near 400 hPa; weak sensitivity to surface sources",
    caveat: "Free-tropospheric methane, not surface emissions. Point sources (landfills, oil and gas) are not resolved at 1°." }),
  g({ id: "co-airs", group: "carbon", obs: "carbon", label: "Carbon monoxide at 500 hPa (AIRS, monthly)",
    gibsId: "AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Monthly_Day", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6, // pragma: allowlist secret (public NASA GIBS layer id)
    legend: L("AIRS_Carbon_Monoxide_Volume_Mixing_Ratio_H.svg"), colormap: CM("AIRS_Carbon_Monoxide_Volume_Mixing_Ratio"), alpha: 0.85,
    measures: "Carbon monoxide volume mixing ratio, combustion tracer", dataset: "AIRS/Aqua L3 monthly, daytime", source: "NASA AIRS (Aqua) via NASA GIBS",
    resolution: "1° grid", units: "ppbv", cadence: "monthly", latency: "standard",
    processing: "Thermal-infrared retrieval, gridded monthly mean", quality: "Mid-tropospheric sensitivity",
    caveat: "CO traces incomplete combustion (fires, traffic, industry). It is not CO₂." }),
  g({ id: "co-emis", group: "carbon", label: "Carbon monoxide emission flux (MERRA-2, monthly)",
    gibsId: "MERRA2_Carbon_Monoxide_Emission_Monthly", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("MERRA2_Carbon_Monoxide_Emission_Monthly_H.svg"), alpha: 0.75,
    measures: "Monthly CO emission flux used by the reanalysis", dataset: "MERRA-2 aerosol/chemistry emissions", source: "NASA GMAO MERRA-2 via NASA GIBS",
    resolution: "0.5° × 0.625°", units: "kg m⁻² s⁻¹", cadence: "monthly", latency: "reanalysis",
    processing: "Inventory and fire emissions prescribed in the reanalysis", quality: "Model input, not a satellite measurement",
    caveat: "An emissions inventory field (model input), not an observation." }),
  { kind: "vector", id: "co2-countries", group: "carbon", label: "Emissions inventory by country",
    measures: "Annual national emissions: fossil CO₂ (Global Carbon Project) or sector GHG (Climate Watch), selectable",
    source: "Global Carbon Project via Our World in Data; Climate Watch (WRI) — CC BY 4.0",
    caveat: "Territorial inventory estimates. Extrusion height and colour encode annual tonnes, not a plume." },
  { kind: "vector", id: "co2-plants", group: "carbon", label: "Power-sector emissions inventory (estimated)",
    measures: "Estimated annual CO₂ per fossil plant ≥100 MW = reported generation × fuel emission factor",
    source: "WRI Global Power Plant Database v1.3 (CC BY 4.0); CO₂ is a Climactix estimate",
    caveat: "Inventory-based estimates, not measured stack emissions. Bar height encodes MtCO₂/yr." },

  // ── Thermal ───────────────────────────────────────────────────────────────
  g({ id: "lst-monthly", group: "temperature", obs: "thermal", label: "Land surface temperature, day (MODIS, monthly)",
    gibsId: "MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("MODIS_Land_Surface_Temp_H.svg"), colormap: CM("MODIS_Land_Surface_Temp"), alpha: 0.85,
    measures: "Daytime land surface (skin) temperature, monthly mean", dataset: "MOD11C3 / MODIS Terra L3 monthly", source: "NASA MODIS Terra via NASA GIBS",
    resolution: "0.05° (~5.6 km)", units: "K (shown also in °C)", cadence: "monthly", latency: "standard",
    processing: "Generalised split-window algorithm, clear-sky days averaged per month", quality: "Clear-sky only; emissivity-dependent uncertainty ~1–2 K",
    caveat: "Land surface (skin) temperature is not air temperature; sunlit roofs and roads read far hotter than the air." }),
  g({ id: "lst-8day", group: "temperature", obs: "thermal", label: "Land surface temperature, day (MODIS, 8-day)",
    gibsId: "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7,
    legend: L("MODIS_Land_Surface_Temp_H.svg"), colormap: CM("MODIS_Land_Surface_Temp"), alpha: 0.85,
    measures: "Daytime land surface temperature, 8-day composite", dataset: "MOD11A2 / MODIS Terra L3 8-day", source: "NASA MODIS Terra via NASA GIBS",
    resolution: "1 km", units: "K (shown also in °C)", cadence: "8-day", latency: "standard",
    processing: "Split-window retrieval composited over 8 days", quality: "Gaps where every day was cloudy",
    caveat: "Surface skin temperature, not air temperature." }),
  g({ id: "lst-day", group: "temperature", obs: "thermal", label: "Land surface temperature, day (MODIS, daily)",
    gibsId: "MODIS_Terra_Land_Surface_Temp_Day", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7,
    legend: L("MODIS_Land_Surface_Temp_H.svg"), colormap: CM("MODIS_Land_Surface_Temp"), alpha: 0.85,
    measures: "Daytime land surface temperature, single overpass", dataset: "MOD11 L2/L3 daily (near real time)", source: "NASA MODIS Terra via NASA GIBS (LANCE)",
    resolution: "1 km", units: "K (shown also in °C)", cadence: "daily", latency: "nrt",
    processing: "Split-window retrieval, ~10:30 local overpass", quality: "Cloud-covered pixels are empty",
    caveat: "Surface skin temperature, not air temperature." }),
  g({ id: "uhi-day", group: "temperature", obs: "thermal", label: "Urban heat island, summer day (2013)",
    gibsId: "UHI_Avg_Summer_Day_Max_Land_Surface_Temp_2013", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7,
    legend: L("UHI_Avg_Summer_Day_Max_Land_Surface_Temp_2013_H.svg"), colormap: CM("UHI_Avg_Summer_Day_Max_Land_Surface_Temp_2013"), alpha: 0.85,
    measures: "Average summer daytime maximum LST within urban extents", dataset: "Global Urban Heat Island (UHI) Data Set, 2013", source: "NASA SEDAC via NASA GIBS",
    resolution: "1 km", units: "°C", cadence: "static", latency: "climatology",
    processing: "MODIS LST averaged over summer 2013 within GRUMP urban extents", quality: "Single-year climatology",
    caveat: "A 2013 snapshot for urban areas only." }),
  g({ id: "airtemp", group: "temperature", obs: "thermal", label: "Air temperature at 2 m (MERRA-2, monthly)",
    gibsId: "MERRA2_2m_Air_Temperature_Monthly", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("MERRA2_2m_Air_Temperature_Monthly_H.svg"), colormap: CM("MERRA2_2m_Air_Temperature_Monthly"), alpha: 0.8,
    measures: "Near-surface air temperature, monthly mean", dataset: "MERRA-2 M2TMNXSLV", source: "NASA GMAO MERRA-2 via NASA GIBS",
    resolution: "0.5° × 0.625°", units: "K (shown also in °C)", cadence: "monthly", latency: "reanalysis",
    processing: "Atmospheric reanalysis assimilating satellite and in-situ observations", quality: "Reanalysis — model-constrained, not a direct measurement",
    caveat: "This is air temperature (what people feel), shown for contrast with land surface temperature." }),
  g({ id: "sst-anom", group: "temperature", obs: "thermal", label: "Sea surface temperature anomaly (daily)",
    gibsId: "GHRSST_L4_MUR25_Sea_Surface_Temperature_Anomalies", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("GHRSST_Sea_Surface_Temperature_Anomalies_H.svg"), colormap: CM("GHRSST_Sea_Surface_Temperature_Anomalies"), alpha: 0.8,
    measures: "Daily SST anomaly against the product climatology", dataset: "GHRSST MUR25 L4", source: "JPL GHRSST via NASA GIBS",
    resolution: "0.25°", units: "°C", cadence: "daily", latency: "nrt",
    processing: "Multi-sensor optimally interpolated SST minus 2003–2014 climatology", quality: "Gap-free L4 analysis",
    caveat: "Ocean only. A land temperature anomaly product is not available in GIBS." }),

  // ── Air quality (satellite columns and aerosol) ───────────────────────────
  g({ id: "no2", group: "air", obs: "air", label: "Tropospheric NO₂ (Sentinel-5P TROPOMI)",
    gibsId: "TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6, // pragma: allowlist secret (public NASA GIBS layer id)
    legend: L("OMI_Nitrogen_Dioxide_Tropo_Column_H.svg"), colormap: CM("OMI_Nitrogen_Dioxide_Tropo_Column"), alpha: 0.85,
    measures: "Tropospheric NO₂ vertical column", dataset: "S5P TROPOMI L2 NO₂", source: "Copernicus Sentinel-5P (ESA/KNMI) via NASA GIBS",
    resolution: "5.5 × 3.5 km", units: "molecules cm⁻²", cadence: "daily", latency: "nrt",
    processing: "DOAS retrieval with air-mass factor; quality-filtered L2 swaths", quality: "qa_value filtering; clouds cause gaps",
    caveat: "A column amount over the whole troposphere, not a ground concentration and not an AQI." }),
  g({ id: "so2", group: "air", obs: "air", label: "SO₂ total column (Sentinel-5P TROPOMI)",
    gibsId: "TROPOMI_L2_Sulfur_Dioxide_Total_Vertical_Column", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("OMI_SO2_Lower_Troposphere_H.svg"), colormap: CM("OMI_SO2_Lower_Troposphere"), alpha: 0.85,
    measures: "SO₂ total vertical column", dataset: "S5P TROPOMI L2 SO₂", source: "Copernicus Sentinel-5P (ESA/BIRA) via NASA GIBS",
    resolution: "5.5 × 3.5 km", units: "Dobson units", cadence: "daily", latency: "nrt",
    processing: "DOAS retrieval, 1 km plume-height assumption", quality: "Noisy for small anthropogenic sources; best for large emitters and volcanoes",
    caveat: "Column amount, not surface concentration." }),
  g({ id: "o3", group: "air", obs: "air", label: "Total ozone column (OMPS)",
    gibsId: "OMPS_Ozone_Total_Column", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("OMPS_Ozone_Total_Column_H.svg"), colormap: CM("OMPS_Ozone_Total_Column"), alpha: 0.8,
    measures: "Total-column ozone", dataset: "OMPS Nadir Mapper total ozone", source: "NASA/NOAA OMPS (Suomi NPP) via NASA GIBS",
    resolution: "50 km", units: "Dobson units", cadence: "daily", latency: "nrt",
    processing: "UV backscatter retrieval", quality: "Dominated by stratospheric ozone",
    caveat: "Mostly stratospheric (the ozone layer). Ground-level ozone for air quality comes from ground monitors or CAMS." }),
  g({ id: "aod", group: "air", obs: "air", label: "Aerosol optical depth (MODIS, daily)",
    gibsId: "MODIS_Terra_Aerosol_Optical_Depth_3km", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("MODIS_VIIRS_AOD_H.svg"), colormap: CM("MODIS_VIIRS_AOD"), alpha: 0.8,
    measures: "Column aerosol optical depth at 550 nm (particulate proxy)", dataset: "MOD04_3K", source: "NASA MODIS Terra via NASA GIBS",
    resolution: "3 km", units: "unitless", cadence: "daily", latency: "nrt",
    processing: "Dark-target retrieval", quality: "Unreliable over bright urban surfaces and clouds",
    caveat: "AOD is a column optical property, not PM2.5. Converting to PM2.5 needs a model of vertical profile and humidity." }),
  g({ id: "pm25-dust", group: "air", obs: "air", label: "Dust PM2.5 surface concentration (MERRA-2, monthly)",
    gibsId: "MERRA2_Dust_Surface_Mass_Concentration_PM25_Monthly", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("MERRA2_Dust_Surface_Mass_Concentration_PM25_Monthly_H.svg"), colormap: CM("MERRA2_Dust_Surface_Mass_Concentration_PM25_Monthly"), alpha: 0.8,
    measures: "Surface mass concentration of dust particles < 2.5 µm", dataset: "MERRA-2 M2TMNXAER", source: "NASA GMAO MERRA-2 via NASA GIBS",
    resolution: "0.5° × 0.625°", units: "kg m⁻³", cadence: "monthly", latency: "reanalysis",
    processing: "Aerosol reanalysis assimilating AOD", quality: "Dust component only",
    caveat: "Dust fraction only — excludes combustion PM2.5 (traffic, industry, burning)." }),

  // ── Vegetation ────────────────────────────────────────────────────────────
  g({ id: "ndvi-monthly", group: "context", obs: "vegetation", label: "Vegetation index (MODIS NDVI, monthly)",
    gibsId: "MODIS_Terra_L3_NDVI_Monthly", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7,
    legend: L("MODIS_L3_NDVI_H.svg"), colormap: CM("MODIS_L3_NDVI"), alpha: 0.85,
    measures: "Normalised difference vegetation index", dataset: "MOD13A3 / MODIS Terra L3 monthly", source: "NASA MODIS Terra via NASA GIBS",
    resolution: "1 km", units: "NDVI (−1 to 1)", cadence: "monthly", latency: "standard",
    processing: "Best-pixel compositing of surface reflectance", quality: "Cloud-contaminated pixels flagged",
    caveat: "Greenness, not health per se. Stress needs comparison with the same month in earlier years — use Compare." }),
  g({ id: "ndvi", group: "context", obs: "vegetation", label: "Vegetation index (MODIS NDVI, rolling 8-day)",
    gibsId: "MODIS_Terra_NDVI_8Day", matrixSet: "GoogleMapsCompatible_Level9", maxLevel: 9,
    legend: L("MODIS_NDVI_H.svg"), alpha: 0.8,
    measures: "NDVI, rolling 8-day", dataset: "MODIS Terra NDVI (LANCE)", source: "NASA MODIS Terra via NASA GIBS",
    resolution: "250 m", units: "NDVI", cadence: "8-day", latency: "nrt",
    processing: "Rolling 8-day composite", quality: "Near-real-time; later versions may differ", caveat: "Observed greenness only." }),

  // ── Water stress & flood ─────────────────────────────────────────────────
  g({ id: "soil-moisture", group: "water", obs: "water", label: "Root-zone soil moisture (SMAP L4)",
    gibsId: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("SMAP_Analyzed_Soil_Moisture_H.svg"), colormap: CM("SMAP_Analyzed_Soil_Moisture"), alpha: 0.8,
    measures: "Root-zone (0–100 cm) volumetric soil moisture", dataset: "SMAP L4 SM analysis", source: "NASA SMAP via NASA GIBS",
    resolution: "9 km", units: "m³ m⁻³", cadence: "daily", latency: "nrt",
    processing: "L-band brightness temperatures assimilated into a land surface model", quality: "Model value-added; uncertainty ~0.04 m³ m⁻³",
    caveat: "A water-availability indicator. Water stress also depends on withdrawals, which are not observed from orbit." }),
  g({ id: "drought-hazard", group: "water", obs: "water", label: "Drought hazard frequency (1980–2000)",
    gibsId: "NDH_Drought_Hazard_Frequency_Distribution_1980-2000", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7, // pragma: allowlist secret (public NASA GIBS layer id)
    legend: L("NDH_Drought_Hazard_Frequency_Distribution_1980-2000_H.svg"), colormap: CM("NDH_Drought_Hazard_Frequency_Distribution_1980-2000"), alpha: 0.75,
    measures: "Historical drought frequency (decile class)", dataset: "Global Drought Hazard Frequency and Distribution", source: "Columbia CIESIN / SEDAC via NASA GIBS",
    resolution: "2.5′ (~4.6 km)", units: "decile class", cadence: "static", latency: "climatology",
    processing: "Weighted anomaly of standardised precipitation, 1980–2000", quality: "Historical, coarse", caveat: "Past hazard, not projected stress." }),
  g({ id: "precip", group: "water", label: "Precipitation rate (IMERG)",
    gibsId: "IMERG_Precipitation_Rate", matrixSet: "GoogleMapsCompatible_Level6", maxLevel: 6,
    legend: L("GPM_Precipitation_Rate_H.svg"), alpha: 0.8,
    measures: "Satellite-merged precipitation rate", dataset: "GPM IMERG Early/Late", source: "NASA GPM IMERG via NASA GIBS",
    resolution: "0.1°", units: "mm/h", cadence: "daily", latency: "nrt", processing: "Multi-satellite merged microwave/IR estimate",
    quality: "Near-real-time; research run differs", caveat: "Satellite estimate; gauge-corrected versions come later." }),
  g({ id: "flood-now", group: "water", obs: "flood", label: "Observed flood water (MODIS, 2-day)",
    gibsId: "MODIS_Combined_Flood_2-Day", matrixSet: "GoogleMapsCompatible_Level9", maxLevel: 9,
    legend: L("MODIS_Flood_H.svg"), colormap: CM("MODIS_Flood"), alpha: 0.9,
    measures: "Surface water beyond the reference water extent", dataset: "MCDWD L3 NRT Global Flood Product", source: "NASA LANCE MODIS via NASA GIBS",
    resolution: "250 m", units: "class", cadence: "2-day", latency: "nrt",
    processing: "Water detected in ≥ 2 of 2 days' Terra+Aqua observations, minus reference water", quality: "Cloud shadow and terrain shadow can give false positives",
    caveat: "Clouds hide floods; no signal is not proof of no flooding." }),
  g({ id: "flood-hazard", group: "water", obs: "flood", label: "Flood hazard frequency (1985–2003)",
    gibsId: "NDH_Flood_Hazard_Frequency_Distribution_1985-2003", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7, // pragma: allowlist secret (public NASA GIBS layer id)
    legend: L("NDH_Flood_Hazard_Frequency_Distribution_1985-2003_H.svg"), colormap: CM("NDH_Flood_Hazard_Frequency_Distribution_1985-2003"), alpha: 0.75,
    measures: "Historical frequency of large floods (decile class)", dataset: "Global Flood Hazard Frequency and Distribution", source: "Columbia CIESIN / SEDAC via NASA GIBS",
    resolution: "2.5′ (~4.6 km)", units: "decile class", cadence: "static", latency: "climatology",
    processing: "Dartmouth Flood Observatory event extents, 1985–2003", quality: "Historical, coarse", caveat: "Not a forward-looking flood model." }),
  g({ id: "cyclone-hazard", group: "water", label: "Cyclone hazard frequency (1980–2000)",
    gibsId: "NDH_Cyclone_Hazard_Frequency_Distribution_1980-2000", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7, // pragma: allowlist secret (public NASA GIBS layer id)
    legend: L("NDH_Cyclone_Hazard_Frequency_Distribution_1980-2000_H.svg"), alpha: 0.75,
    measures: "Historical tropical cyclone frequency", dataset: "Global Cyclone Hazard Frequency and Distribution", source: "Columbia CIESIN / SEDAC via NASA GIBS",
    resolution: "2.5′", units: "decile class", cadence: "static", latency: "climatology", processing: "Storm tracks 1980–2000",
    quality: "Historical", caveat: "Historical hazard climatology." }),

  // ── Infrastructure ───────────────────────────────────────────────────────
  { kind: "vector", id: "ceon", group: "infrastructure", label: "CEON constellation (virtual missions)",
    measures: "Four Climactix mission concepts on simulated sun-synchronous orbits, with swath footprints from sensor geometry",
    source: "Climactix mission concepts — positions simulated, not telemetry",
    caveat: "Climactix does not operate satellites. Data on the globe comes from the real missions named on each layer." },
  { kind: "vector", id: "plants-all", group: "infrastructure", label: "Power plants (all fuels)",
    measures: "Power plants by primary fuel: fossil ≥100 MW, renewable and nuclear ≥150 MW",
    source: "WRI Global Power Plant Database v1.3 (CC BY 4.0)", caveat: "Database last updated 2021; recent capacity is missing." },
  { kind: "vector", id: "city-facilities", group: "infrastructure", label: "Mumbai industrial facilities",
    measures: "Facility footprints (power, refining, chemicals, ports, airports, shipyards, logistics, rail)",
    source: "Overture Maps Foundation base theme (ODbL)", caveat: "Footprints from open map data; operator attribution only where verified." },
  { kind: "vector", id: "city-water", group: "infrastructure", label: "Mumbai rivers, creeks & water bodies",
    measures: "Mapped water polygons (Mithi River, Thane Creek, lakes, mangrove creeks)",
    source: "Overture Maps Foundation base theme — water (ODbL)", caveat: "Mapped water extent, not a flood model." },
  { kind: "vector", id: "city-traffic", group: "infrastructure", label: "Mumbai traffic & rail (illustrative)",
    measures: "Animated vehicles and trains on real Overture road and rail geometry",
    source: "Overture Maps Foundation transportation (ODbL)", caveat: "Illustrative animation — not live traffic. Off by default." },
  { kind: "vector", id: "ports", group: "infrastructure", label: "Ports",
    measures: "Port locations", source: "Natural Earth 1:10m Ports (public domain)", caveat: "No throughput data." },
  { kind: "vector", id: "airports", group: "infrastructure", label: "Large airports",
    measures: "Large airport locations", source: "OurAirports (public domain)", caveat: "No traffic or emissions data." },

  // ── Context ──────────────────────────────────────────────────────────────
  g({ id: "truecolor", group: "context", obs: "thermal", label: "Natural colour, today’s pass (VIIRS)",
    gibsId: "VIIRS_SNPP_CorrectedReflectance_TrueColor", matrixSet: "GoogleMapsCompatible_Level9", maxLevel: 9,
    format: "jpg", alpha: 1,
    measures: "Corrected reflectance, true colour", dataset: "VIIRS SNPP Corrected Reflectance", source: "NASA VIIRS (Suomi NPP) via NASA GIBS",
    resolution: "250 m", units: "reflectance (RGB)", cadence: "daily", latency: "nrt", processing: "Rayleigh-corrected RGB composite",
    quality: "Visual product", caveat: "Daily mosaic of overpasses; orbit seams are normal." }),
  g({ id: "population", group: "context", label: "Population density (GPW 2020)",
    gibsId: "GPW_Population_Density_2020", matrixSet: "GoogleMapsCompatible_Level7", maxLevel: 7,
    legend: L("GPW_Population_Density_2020_H.svg"), alpha: 0.75,
    measures: "Persons per km²", dataset: "GPWv4.11", source: "NASA SEDAC via NASA GIBS", resolution: "30″ (~1 km)", units: "persons km⁻²",
    cadence: "static", latency: "climatology", processing: "Census counts disaggregated to grid", quality: "Model estimate for 2020",
    caveat: "Census-based model estimate." }),
];

export const GROUP_LABEL: Record<LayerGroup, string> = {
  carbon: "A · Carbon: concentration & inventory",
  temperature: "B · Thermal",
  air: "C · Atmospheric (air quality)",
  water: "D · Water & flood",
  infrastructure: "E · Infrastructure & constellation",
  context: "Context & vegetation",
};

export const OBS_LABEL: Record<ObsCategory, string> = {
  carbon: "Carbon observation", thermal: "Thermal observation", air: "Air quality observation",
  vegetation: "Vegetation observation", water: "Water stress", flood: "Flood exposure",
};

export const LATENCY_LABEL: Record<Latency, string> = {
  nrt: "Near-real-time satellite (≈3–48 h latency)",
  standard: "Standard satellite product (days–weeks latency)",
  reanalysis: "Reanalysis (model-constrained, monthly)",
  climatology: "Historical climatology (static)",
};

export function gibsLayer(id: string): GibsLayer | undefined {
  const l = LAYERS.find((x) => x.id === id);
  return l && l.kind === "gibs" ? l : undefined;
}

export function gibsUrl(l: GibsLayer, time = l.time): string {
  return `${G}/wmts/epsg3857/best/${l.gibsId}/default/${time}/${l.matrixSet}/{z}/{y}/{x}.${l.format}`;
}

/** Reads the acquisition date GIBS actually served for a layer and requested time (exposed via CORS). */
export async function gibsActualTime(l: GibsLayer, time = l.time): Promise<string | null> {
  try {
    const url = gibsUrl(l, time).replace("{z}", "0").replace("{y}", "0").replace("{x}", "0");
    const r = await fetch(url, { method: "GET", cache: "force-cache" });
    const t = r.headers.get("layer-time-actual");
    return t ? t.slice(0, 10) : l.cadence === "static" ? "static" : null;
  } catch {
    return null;
  }
}

/** Age in days of an observation date relative to now. */
export function ageDays(isoDate: string | undefined | null): number | null {
  if (!isoDate || isoDate === "static") return null;
  const t = Date.parse(isoDate);
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 86_400_000)) : null;
}

export const FUEL_COLOR: Record<string, string> = {
  Coal: "#4B4B4B", Oil: "#7A4A1E", Gas: "#C2702A", Petcoke: "#3A2A1A",
  Solar: "#E2B93B", Wind: "#7FB3D5", Hydro: "#2F6FB0", Nuclear: "#8E6CC0", Geothermal: "#B5563A",
};
