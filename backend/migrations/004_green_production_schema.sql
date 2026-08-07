-- ============================================================
-- Climactix Green Production — Migration 004
-- Sustainable Film & Media Certification Platform
-- Production registry, activity taxonomy, multi-country emission
-- factors, water/waste tracking, questionnaire bank, scoring,
-- certification, offsets, benchmarks, audit trail.
-- Idempotent: safe to run on every backend startup.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PRODUCTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS green_productions (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  owner_user_id     TEXT REFERENCES auth_users(id),
  production_name   TEXT NOT NULL,
  production_company TEXT NOT NULL,
  studio            TEXT,
  director          TEXT,
  producer          TEXT,
  executive_producer TEXT,
  production_manager TEXT,
  budget_amount     NUMERIC(18,2),
  budget_currency   TEXT DEFAULT 'INR',
  film_type         TEXT NOT NULL
                    CHECK (film_type IN ('movie','series','documentary','advertisement',
                           'music_video','web_series','animation','event','tv_show')),
  language          TEXT,
  country           TEXT NOT NULL,
  crew_size_expected  INTEGER,
  cast_size_expected  INTEGER,
  expected_audience   TEXT,
  distribution_channel TEXT NOT NULL DEFAULT 'both'
                    CHECK (distribution_channel IN ('streaming','cinema','both')),
  streaming_platform  TEXT,
  timeline_start    DATE,
  timeline_end      DATE,
  status            TEXT NOT NULL DEFAULT 'pre_production'
                    CHECK (status IN ('registered','pre_production','production',
                           'post_production','marketing','distributed','certified','archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_green_productions_owner  ON green_productions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_green_productions_status ON green_productions(status);
CREATE INDEX IF NOT EXISTS idx_green_productions_country ON green_productions(country);

CREATE TABLE IF NOT EXISTS green_production_locations (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  location_name     TEXT NOT NULL,
  country           TEXT NOT NULL,
  state             TEXT,
  city              TEXT,
  latitude          NUMERIC(9,6),
  longitude         NUMERIC(9,6),
  shoot_start_date  DATE,
  shoot_end_date    DATE,
  protected_area_flag BOOLEAN NOT NULL DEFAULT FALSE,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_locations_production ON green_production_locations(production_id);

-- ============================================================
-- ACTIVITY TAXONOMY (server-side mirror of the calculation engine)
-- ============================================================

CREATE TABLE IF NOT EXISTS green_activity_categories (
  id                 TEXT PRIMARY KEY,
  department         TEXT NOT NULL,
  label              TEXT NOT NULL,
  unit               TEXT NOT NULL,
  factor_key         TEXT NOT NULL,
  applicable_phases  TEXT[] NOT NULL,
  description        TEXT NOT NULL,
  sort_order         SMALLINT NOT NULL
);

-- ── Pre-production ──
INSERT INTO green_activity_categories VALUES ('office_energy','office_operations','Office Electricity','kWh','electricity_grid_kwh',ARRAY['pre_production','post_production'],'Pre-production and post-production office/edit-suite electricity use.',1) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('printing_paper','office_operations','Script & Document Printing','kg','paper_kg',ARRAY['pre_production'],'Paper consumed for script drafts, call sheets, and planning documents.',2) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('scouting_travel','meetings_travel','Location Scouting Travel','vehicle_km','car_diesel_km',ARRAY['pre_production'],'Vehicle travel for location scouting and pre-production meetings.',3) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('equipment_rental_transport','procurement_pre','Equipment Rental Transport','tonne_km','freight_road_tonne_km',ARRAY['pre_production','production'],'Freight transport of rented equipment to/from set.',4) ON CONFLICT (id) DO NOTHING;

-- ── Crew & cast transport ──
INSERT INTO green_activity_categories VALUES ('crew_transport_car','crew_transport','Crew Transport — Car','vehicle_km','car_diesel_km',ARRAY['pre_production','production'],'Sedan/hatchback crew transport by distance travelled.',10) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('crew_transport_suv','crew_transport','Crew Transport — SUV','vehicle_km','suv_diesel_km',ARRAY['pre_production','production'],'SUV crew transport by distance travelled.',11) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('crew_transport_bus','crew_transport','Crew Transport — Bus','vehicle_km','bus_diesel_km',ARRAY['production'],'Bus transport for crew/cast by distance travelled.',12) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('crew_transport_vanity_van','crew_transport','Vanity Van','vehicle_km','vanity_van_diesel_km',ARRAY['production'],'Vanity van transport by distance travelled.',13) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('crew_transport_mini_truck','crew_transport','Mini Truck (Equipment)','vehicle_km','mini_truck_diesel_km',ARRAY['production'],'Mini-truck equipment transport by distance travelled.',14) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('crew_transport_ev','crew_transport','Crew Transport — EV','vehicle_km','ev_car_km',ARRAY['pre_production','production'],'Electric-vehicle crew transport by distance travelled.',15) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('crew_transport_hybrid','crew_transport','Crew Transport — Hybrid','vehicle_km','hybrid_car_km',ARRAY['pre_production','production'],'Hybrid-vehicle crew transport by distance travelled.',16) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('generator_power','crew_transport','Diesel Generator (Set Power)','kWh','generator_diesel_kwh',ARRAY['production'],'On-set diesel generator power output.',17) ON CONFLICT (id) DO NOTHING;

-- ── Air / rail / metro / boat ──
INSERT INTO green_activity_categories VALUES ('air_domestic_economy','air_travel','Domestic Flight — Economy','passenger_km','domestic_flight_economy_pkm',ARRAY['pre_production','production','post_production','marketing'],'Domestic economy-class air travel.',20) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('air_domestic_business','air_travel','Domestic Flight — Business','passenger_km','domestic_flight_business_pkm',ARRAY['pre_production','production','post_production','marketing'],'Domestic business-class air travel.',21) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('air_intl_economy','air_travel','International Flight — Economy','passenger_km','international_flight_economy_pkm',ARRAY['pre_production','production','post_production','marketing'],'International economy-class air travel.',22) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('air_intl_business','air_travel','International Flight — Business','passenger_km','international_flight_business_pkm',ARRAY['pre_production','production','post_production','marketing'],'International business-class air travel.',23) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('rail_travel','rail_metro_boat','Rail Travel','passenger_km','rail_pkm',ARRAY['pre_production','production','marketing'],'Rail travel for crew, cast, or equipment couriers.',24) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('metro_travel','rail_metro_boat','Metro Travel','passenger_km','metro_pkm',ARRAY['pre_production','production'],'Metro/urban rail travel.',25) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('boat_travel','rail_metro_boat','Boat / Ferry Travel','passenger_km','boat_pkm',ARRAY['production'],'Boat or ferry travel to shoot locations.',26) ON CONFLICT (id) DO NOTHING;

-- ── Accommodation & catering ──
INSERT INTO green_activity_categories VALUES ('hotel_stay','accommodation','Hotel Room-Nights','room_nights','hotel_room_night',ARRAY['pre_production','production'],'Hotel accommodation for cast and crew, per room-night.',30) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('meals_vegetarian','accommodation','Catering — Vegetarian Meals','meals','meal_vegetarian',ARRAY['production'],'Vegetarian meals served on set.',31) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('meals_nonvegetarian','accommodation','Catering — Non-Vegetarian Meals','meals','meal_nonvegetarian',ARRAY['production'],'Non-vegetarian meals served on set.',32) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('meals_vegan','accommodation','Catering — Vegan Meals','meals','meal_vegan',ARRAY['production'],'Vegan meals served on set.',33) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('catering_food_waste','accommodation','Catering Food Waste','kg','food_waste_kg',ARRAY['production'],'Food waste generated by on-set catering.',34) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('plastic_bottles','accommodation','Single-Use Plastic Bottles','bottles','plastic_bottle_unit',ARRAY['production'],'Single-use plastic water bottles distributed on set.',35) ON CONFLICT (id) DO NOTHING;

-- ── Lighting / camera / sound / drones ──
INSERT INTO green_activity_categories VALUES ('lighting_led','lighting','LED Lighting','kWh','electricity_grid_kwh',ARRAY['production'],'LED fixture power consumption.',40) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('lighting_halogen','lighting','Halogen Lighting','kWh','electricity_grid_kwh',ARRAY['production'],'Halogen fixture power consumption.',41) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('lighting_hmi','lighting','HMI Lighting','kWh','electricity_grid_kwh',ARRAY['production'],'HMI fixture power consumption.',42) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('lighting_tungsten','lighting','Tungsten Lighting','kWh','electricity_grid_kwh',ARRAY['production'],'Tungsten fixture power consumption.',43) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('camera_equipment_power','camera_equipment','Camera Equipment Power','kWh','electricity_grid_kwh',ARRAY['production'],'Camera body, monitor, and battery-charging power draw.',44) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('sound_equipment_power','sound_equipment','Sound Equipment Power','kWh','electricity_grid_kwh',ARRAY['production'],'Sound recording and playback equipment power draw.',45) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('drone_operations','drone_operations','Drone Operations','kWh','electricity_grid_kwh',ARRAY['production'],'Drone battery charging for aerial units.',46) ON CONFLICT (id) DO NOTHING;

-- ── Set construction ──
INSERT INTO green_activity_categories VALUES ('set_construction_wood','set_construction','Set Construction — Wood','kg','timber_kg',ARRAY['pre_production','production'],'Timber used in set construction.',50) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_steel','set_construction','Set Construction — Steel (Virgin)','kg','steel_kg_virgin',ARRAY['pre_production','production'],'Virgin steel used in set construction.',51) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_steel_recycled','set_construction','Set Construction — Steel (Recycled)','kg','steel_kg_recycled',ARRAY['pre_production','production'],'Recycled steel used in set construction.',52) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_plastic','set_construction','Set Construction — Plastic (Virgin)','kg','plastic_kg_virgin',ARRAY['pre_production','production'],'Virgin plastic used in set construction.',53) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_plastic_recycled','set_construction','Set Construction — Plastic (Recycled)','kg','plastic_kg_recycled',ARRAY['pre_production','production'],'Recycled plastic used in set construction.',54) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_concrete','set_construction','Set Construction — Concrete','kg','concrete_kg',ARRAY['pre_production','production'],'Concrete used in set construction.',55) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_fabric','set_construction','Set Construction — Fabric','kg','fabric_kg',ARRAY['pre_production','production'],'Fabric/textile used in set dressing.',56) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_paint','set_construction','Set Construction — Paint','liters','paint_l',ARRAY['pre_production','production'],'Paint used in set construction.',57) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('set_construction_foam','set_construction','Set Construction — Foam','kg','foam_kg',ARRAY['pre_production','production'],'Foam used in set construction/props.',58) ON CONFLICT (id) DO NOTHING;

-- ── Costumes, props, hair & makeup, SFX ──
INSERT INTO green_activity_categories VALUES ('costumes_purchased','costumes','Costumes — Purchased','kg','costume_purchased_kg',ARRAY['pre_production','production'],'Newly purchased costume material mass.',60) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('costumes_rental','costumes','Costumes — Rental','kg','costume_rental_kg',ARRAY['pre_production','production'],'Rented costume material mass (amortized footprint).',61) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('props_purchased','props','Props — Purchased','kg','plastic_kg_virgin',ARRAY['pre_production','production'],'Newly purchased prop material mass.',62) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('props_rental','props','Props — Rental','kg','costume_rental_kg',ARRAY['pre_production','production'],'Rented prop material mass (amortized footprint).',63) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('hair_makeup_products','hair_makeup','Hair & Makeup Products','kg','cosmetics_kg',ARRAY['production'],'Cosmetic and hair product mass consumed.',64) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('sfx_pyrotechnics','special_effects','Pyrotechnics','kg','pyrotechnics_kg',ARRAY['production'],'Pyrotechnic material mass used.',65) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('sfx_artificial_smoke','special_effects','Artificial Smoke / Fog Fluid','kg','artificial_smoke_kg',ARRAY['production'],'Glycol-based fog/smoke fluid mass used.',66) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('sfx_co2_cannons','special_effects','CO₂ Cannons','kg','co2_cannon_kg',ARRAY['production'],'CO₂ mass discharged by CO₂ cannons.',67) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('sfx_compressed_gas','special_effects','Compressed Gas Effects','kg','compressed_gas_kg',ARRAY['production'],'Compressed gas mass used for practical effects.',68) ON CONFLICT (id) DO NOTHING;

-- ── Post-production ──
INSERT INTO green_activity_categories VALUES ('post_editing_rendering','post_production_computing','Editing & Rendering Workstations','kWh','electricity_grid_kwh',ARRAY['post_production'],'Edit-suite and render-farm electricity use.',70) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('post_cloud_storage','post_production_computing','Cloud Compute & Storage','kWh','cloud_compute_kwh',ARRAY['post_production'],'Cloud rendering, storage, and backup compute load.',71) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('post_data_transfer','post_production_computing','Data Transfer & Streaming','GB','data_transfer_gb',ARRAY['post_production','distribution'],'Data egress for review, delivery, and streaming.',72) ON CONFLICT (id) DO NOTHING;

-- ── Marketing & distribution ──
INSERT INTO green_activity_categories VALUES ('marketing_print','marketing_activities','Print Marketing Materials','kg','paper_kg',ARRAY['marketing'],'Print media, posters, and promotional collateral.',80) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('marketing_digital','marketing_activities','Digital Marketing Data Transfer','GB','data_transfer_gb',ARRAY['marketing'],'Digital ad-serving and content-delivery data transfer.',81) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('marketing_outdoor','marketing_activities','Outdoor / Digital Billboards','kWh','electricity_grid_kwh',ARRAY['marketing'],'Digital outdoor advertising display power.',82) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('marketing_events_travel','marketing_activities','Marketing Events Travel','vehicle_km','car_diesel_km',ARRAY['marketing'],'Travel for premieres, press tours, and promotional events.',83) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('distribution_film_prints','distribution_activities','Physical Film / DCP Prints','units','dcp_hard_drive_unit',ARRAY['distribution'],'Manufacture and shipping of physical DCP/film print media.',84) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('distribution_hard_drives','distribution_activities','Delivery Hard Drives','units','dcp_hard_drive_unit',ARRAY['distribution'],'Hard drives used for physical delivery.',85) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('distribution_digital_delivery','distribution_activities','Digital Delivery','GB','data_transfer_gb',ARRAY['distribution'],'Digital delivery to platforms/broadcasters.',86) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_activity_categories VALUES ('distribution_transport','distribution_activities','Distribution Transport','tonne_km','freight_road_tonne_km',ARRAY['distribution'],'Freight transport of physical distribution media.',87) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EMISSION FACTOR DATABASE (multi-country, extensible)
-- ============================================================

CREATE TABLE IF NOT EXISTS green_emission_factors (
  factor_key        TEXT NOT NULL,
  region            TEXT NOT NULL CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  unit              TEXT NOT NULL,
  factor_kgco2e_per_unit NUMERIC(12,5) NOT NULL,
  source            TEXT NOT NULL,
  notes             TEXT,
  valid_from        DATE NOT NULL DEFAULT '2024-01-01',
  PRIMARY KEY (factor_key, region)
);

CREATE INDEX IF NOT EXISTS idx_green_factors_key ON green_emission_factors(factor_key);

-- Region-varying factors (grid intensity drives real regional difference).
-- Sources: India — CEA Grid Emission Factor 2023; UK — DEFRA GHG Conversion
-- Factors 2024; US — EPA eGRID2022 national average; Europe — EEA 2023
-- residual mix; Australia — DCCEEW NGA Factors 2024; Global — IEA 2023 world average.
INSERT INTO green_emission_factors VALUES ('electricity_grid_kwh','India','kWh',0.727,'CEA Grid Emission Factor 2023','National grid average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('electricity_grid_kwh','UK','kWh',0.207,'DEFRA GHG Conversion Factors 2024','UK grid average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('electricity_grid_kwh','US','kWh',0.386,'EPA eGRID2022','US national average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('electricity_grid_kwh','Europe','kWh',0.230,'EEA 2023 Residual Mix','EU-27 average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('electricity_grid_kwh','Australia','kWh',0.660,'DCCEEW NGA Factors 2024','NEM average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('electricity_grid_kwh','Global','kWh',0.475,'IEA 2023 World Average','Fallback when country grid data unavailable.','2024-01-01') ON CONFLICT DO NOTHING;

INSERT INTO green_emission_factors VALUES ('cloud_compute_kwh','India','kWh',1.091,'CEA 2023 x PUE 1.5','Data-center PUE overhead applied to grid factor.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('cloud_compute_kwh','UK','kWh',0.311,'DEFRA 2024 x PUE 1.5','Data-center PUE overhead applied to grid factor.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('cloud_compute_kwh','US','kWh',0.579,'EPA eGRID2022 x PUE 1.5','Data-center PUE overhead applied to grid factor.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('cloud_compute_kwh','Europe','kWh',0.345,'EEA 2023 x PUE 1.5','Data-center PUE overhead applied to grid factor.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('cloud_compute_kwh','Australia','kWh',0.990,'DCCEEW 2024 x PUE 1.5','Data-center PUE overhead applied to grid factor.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('cloud_compute_kwh','Global','kWh',0.713,'IEA 2023 x PUE 1.5','Fallback global data-center estimate.','2024-01-01') ON CONFLICT DO NOTHING;

INSERT INTO green_emission_factors VALUES ('ev_car_km','India','vehicle_km',0.109,'CEA 2023 x 0.15 kWh/km','EV consumption x grid intensity.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('ev_car_km','UK','vehicle_km',0.031,'DEFRA 2024 x 0.15 kWh/km','EV consumption x grid intensity.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('ev_car_km','US','vehicle_km',0.058,'EPA eGRID2022 x 0.15 kWh/km','EV consumption x grid intensity.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('ev_car_km','Europe','vehicle_km',0.035,'EEA 2023 x 0.15 kWh/km','EV consumption x grid intensity.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('ev_car_km','Australia','vehicle_km',0.099,'DCCEEW 2024 x 0.15 kWh/km','EV consumption x grid intensity.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('ev_car_km','Global','vehicle_km',0.071,'IEA 2023 x 0.15 kWh/km','Fallback global EV estimate.','2024-01-01') ON CONFLICT DO NOTHING;

INSERT INTO green_emission_factors VALUES ('hotel_room_night','India','room_nights',18.0,'Cornell/Greenview Hotel Carbon Measurement Initiative','Regional hotel-sector energy/water/laundry baseline.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('hotel_room_night','UK','room_nights',10.6,'Cornell/Greenview HCMI','Regional hotel-sector energy/water/laundry baseline.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('hotel_room_night','US','room_nights',13.6,'Cornell/Greenview HCMI','Regional hotel-sector energy/water/laundry baseline.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('hotel_room_night','Europe','room_nights',11.0,'Cornell/Greenview HCMI','Regional hotel-sector energy/water/laundry baseline.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('hotel_room_night','Australia','room_nights',14.0,'Cornell/Greenview HCMI','Regional hotel-sector energy/water/laundry baseline.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('hotel_room_night','Global','room_nights',13.0,'Cornell/Greenview HCMI','Fallback global hotel baseline.','2024-01-01') ON CONFLICT DO NOTHING;

-- Global-only factors (fuel combustion chemistry and material embodied
-- carbon do not meaningfully vary by country — DEFRA/EPA/IPCC agree within
-- a few percent). Engine falls back to the 'Global' row for these keys.
INSERT INTO green_emission_factors VALUES ('diesel_l','Global','liters',2.68,'DEFRA 2024 Mobile Combustion','Diesel combustion, well-to-wheel.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('petrol_l','Global','liters',2.31,'DEFRA 2024 Mobile Combustion','Petrol/gasoline combustion, well-to-wheel.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('biofuel_l','Global','liters',1.13,'DEFRA 2024 Biofuel Factors','B100 biodiesel, well-to-wheel.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('hybrid_car_km','Global','vehicle_km',0.120,'DEFRA 2024 Hybrid Car Average','Blended combustion + electric drive.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('car_diesel_km','Global','vehicle_km',0.171,'DEFRA 2024 Average Car (Diesel)','Sedan/hatchback, average occupancy.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('suv_diesel_km','Global','vehicle_km',0.251,'DEFRA 2024 Average SUV (Diesel)','SUV/executive vehicle.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('bus_diesel_km','Global','vehicle_km',0.830,'DEFRA 2024 Local Bus (Diesel)','Per vehicle-km, not per passenger.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('vanity_van_diesel_km','Global','vehicle_km',0.280,'DEFRA 2024 Van (Diesel, Class III)','Vanity van / production trailer.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('mini_truck_diesel_km','Global','vehicle_km',0.250,'DEFRA 2024 Rigid Truck <7.5t (Diesel)','Equipment mini-truck.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('generator_diesel_kwh','Global','kWh',0.790,'IPCC 2006 Default Diesel Genset Efficiency','Typical diesel generator output factor.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('domestic_flight_economy_pkm','Global','passenger_km',0.151,'DEFRA 2024 Domestic Flight (incl. RF)','Short-haul economy, radiative forcing included.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('domestic_flight_business_pkm','Global','passenger_km',0.302,'DEFRA 2024 Domestic Flight — Business Multiplier','2x economy per DEFRA cabin-class weighting.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('international_flight_economy_pkm','Global','passenger_km',0.148,'DEFRA 2024 Long-Haul Flight (incl. RF)','Long-haul economy, radiative forcing included.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('international_flight_business_pkm','Global','passenger_km',0.429,'DEFRA 2024 Long-Haul Flight — Business Multiplier','~2.9x economy per DEFRA cabin-class weighting.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('rail_pkm','Global','passenger_km',0.035,'DEFRA 2024 National Rail','Electrified rail average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('metro_pkm','Global','passenger_km',0.028,'DEFRA 2024 Light Rail/Metro','Urban metro average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('boat_pkm','Global','passenger_km',0.115,'DEFRA 2024 Ferry (Foot Passenger)','Ferry/boat transfer.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('meal_vegetarian','Global','meals',1.5,'Poore & Nemecek 2018 (Science)','Average vegetarian plate.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('meal_nonvegetarian','Global','meals',3.8,'Poore & Nemecek 2018 (Science)','Average non-vegetarian plate.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('meal_vegan','Global','meals',1.1,'Poore & Nemecek 2018 (Science)','Average vegan plate.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('food_waste_kg','Global','kg',2.5,'WRAP/IPCC Landfill Decomposition','Includes embodied + landfill methane.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('plastic_bottle_unit','Global','bottles',0.083,'DEFRA 2024 PET Packaging','500ml single-use PET bottle.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('timber_kg','Global','kg',0.46,'ICE Database v3 (Bath University)','Sustainably sourced softwood average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('steel_kg_virgin','Global','kg',1.85,'ICE Database v3','Virgin structural steel.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('steel_kg_recycled','Global','kg',0.45,'ICE Database v3','Recycled-content steel.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('plastic_kg_virgin','Global','kg',2.53,'ICE Database v3','Virgin plastic (avg polymer mix).','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('plastic_kg_recycled','Global','kg',1.02,'ICE Database v3','Recycled plastic (avg polymer mix).','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('concrete_kg','Global','kg',0.13,'ICE Database v3','Ready-mix concrete average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('fabric_kg','Global','kg',8.0,'Ellen MacArthur Foundation Textile Data','Average synthetic/blended fabric.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('paint_l','Global','liters',2.6,'ICE Database v3','Solvent-based paint average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('foam_kg','Global','kg',3.5,'ICE Database v3','Polyurethane foam.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('landfill_waste_kg','Global','kg',0.58,'DEFRA 2024 Waste Disposal','Mixed general waste to landfill.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('recycled_waste_kg','Global','kg',0.02,'DEFRA 2024 Waste Disposal','Mixed general waste to recycling.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('costume_purchased_kg','Global','kg',22.0,'Ellen MacArthur Foundation Textile Data','New apparel manufacture, average garment.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('costume_rental_kg','Global','kg',2.0,'Ellen MacArthur Foundation Textile Data','Amortized footprint of rented/reused apparel.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('cosmetics_kg','Global','kg',4.5,'EU PEF Cosmetics Category Rules','Average personal-care product manufacture.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('pyrotechnics_kg','Global','kg',3.0,'IPCC 2006 Pyrotechnic Combustion Default','Combustion + manufacture.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('artificial_smoke_kg','Global','kg',1.9,'IPCC 2006 Glycol Combustion Default','Glycol-based fog/haze fluid.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('co2_cannon_kg','Global','kg',1.0,'Direct Release Factor','Direct CO2 mass release, 1:1.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('compressed_gas_kg','Global','kg',0.6,'IPCC 2006 Compressed Gas Default','Nitrogen/CO2 blend practical effects.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('paper_kg','Global','kg',0.94,'DEFRA 2024 Paper & Print','Uncoated paper, average mill mix.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('freight_road_tonne_km','Global','tonne_km',0.12,'DEFRA 2024 HGV Average Laden','Road freight, average laden weight.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('data_transfer_gb','Global','GB',0.0056,'IEA/Malmodin 2020 Network Transfer Estimate','Conservative network + CDN transfer average.','2024-01-01') ON CONFLICT DO NOTHING;
INSERT INTO green_emission_factors VALUES ('dcp_hard_drive_unit','Global','units',5.0,'ICE Database v3 (Electronics Estimate)','Manufacture + shipping of one DCP/hard-drive unit.','2024-01-01') ON CONFLICT DO NOTHING;

-- ============================================================
-- WATER TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS green_water_records (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  location_id       TEXT REFERENCES green_production_locations(id),
  phase             TEXT NOT NULL CHECK (phase IN ('pre_production','production','post_production','marketing','distribution')),
  source            TEXT NOT NULL CHECK (source IN ('crew','hotel','set','cleaning','catering','sanitation')),
  volume_liters     NUMERIC(14,2) NOT NULL CHECK (volume_liters >= 0),
  greywater_recycled_liters NUMERIC(14,2) NOT NULL DEFAULT 0,
  recorded_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_water_production ON green_water_records(production_id);

-- ============================================================
-- WASTE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS green_waste_records (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  location_id       TEXT REFERENCES green_production_locations(id),
  phase             TEXT NOT NULL CHECK (phase IN ('pre_production','production','post_production','marketing','distribution')),
  waste_type        TEXT NOT NULL CHECK (waste_type IN ('plastic','paper','glass','metal','wood','food',
                     'construction','hazardous','electronic','battery')),
  quantity_kg       NUMERIC(14,2) NOT NULL CHECK (quantity_kg >= 0),
  pct_recycled      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_recycled BETWEEN 0 AND 100),
  pct_reused        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_reused BETWEEN 0 AND 100),
  pct_landfill      NUMERIC(5,2) NOT NULL DEFAULT 100 CHECK (pct_landfill BETWEEN 0 AND 100),
  disposal_partner  TEXT,
  recorded_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pct_recycled + pct_reused + pct_landfill <= 100.01)
);

CREATE INDEX IF NOT EXISTS idx_green_waste_production ON green_waste_records(production_id);

-- ============================================================
-- ACTIVITY LOG (carbon calculation engine input)
-- ============================================================

CREATE TABLE IF NOT EXISTS green_activity_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  location_id       TEXT REFERENCES green_production_locations(id),
  category_id       TEXT NOT NULL REFERENCES green_activity_categories(id),
  phase             TEXT NOT NULL CHECK (phase IN ('pre_production','production','post_production','marketing','distribution')),
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  quantity          NUMERIC(16,4) NOT NULL CHECK (quantity >= 0),
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  factor_value_used NUMERIC(12,5),
  notes             TEXT,
  logged_by         TEXT REFERENCES auth_users(id),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_activity_production ON green_activity_logs(production_id);
CREATE INDEX IF NOT EXISTS idx_green_activity_phase      ON green_activity_logs(production_id, phase);
CREATE INDEX IF NOT EXISTS idx_green_activity_category   ON green_activity_logs(category_id);

-- ============================================================
-- QUESTIONNAIRE BANK (dynamic sustainability questionnaire)
-- ============================================================

CREATE TABLE IF NOT EXISTS green_questionnaire_questions (
  id                TEXT PRIMARY KEY,
  phase             TEXT NOT NULL CHECK (phase IN ('pre_production','production','post_production','marketing','distribution','general')),
  category          TEXT NOT NULL,
  question_text     TEXT NOT NULL,
  question_type     TEXT NOT NULL CHECK (question_type IN ('boolean','single_select','multi_select','numeric','text')),
  options           JSONB NOT NULL DEFAULT '[]'::jsonb,
  applies_to_film_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  applies_to_countries  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  min_budget        NUMERIC(18,2),
  scoring_dimension TEXT NOT NULL CHECK (scoring_dimension IN
                     ('carbon','energy','water','waste','procurement','transportation','biodiversity','social')),
  weight            NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS green_questionnaire_responses (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  question_id       TEXT NOT NULL REFERENCES green_questionnaire_questions(id),
  response          JSONB NOT NULL,
  answered_by       TEXT REFERENCES auth_users(id),
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_green_qresp_production ON green_questionnaire_responses(production_id);

-- ── Starter questionnaire bank (core cross-phase set; expand toward the
-- full ~250-question bank in a later authoring pass, gated by film type /
-- country / budget / crew size / location count in the application layer) ──
INSERT INTO green_questionnaire_questions VALUES ('q_renewable_electricity','general','energy','Was renewable electricity (grid-certified or on-site) used for any phase of production?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'energy',3,10) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_generator_fuel_type','production','energy','What fuel type powered the majority of on-set generators?','single_select','["Diesel","Petrol","Biofuel","Electric/Battery","Hybrid","No generators used"]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'energy',2.5,20) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_led_lighting_share','production','energy','What share of lighting fixtures were LED rather than HMI/Tungsten/Halogen?','numeric','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'energy',2,30) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_ev_hybrid_fleet_share','production','transportation','What share of the crew transport fleet was EV or hybrid?','numeric','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'transportation',3,40) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_flight_minimization','pre_production','transportation','Was a flight-minimization policy applied to scouting and crew travel?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'transportation',2,50) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_carpooling_policy','production','transportation','Was crew carpooling/shuttle consolidation actively enforced?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'transportation',1.5,60) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_single_use_plastic_ban','production','waste','Were single-use plastics (bottles, cutlery, packaging) banned on set?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',3,70) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_waste_segregation','production','waste','Was waste segregated at source into recyclable/organic/hazardous streams?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',3,80) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_set_material_reuse','production','waste','What share of set construction material was reused or salvaged from prior productions?','numeric','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',2.5,90) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_set_material_donation','post_production','waste','Were leftover set materials, costumes, or props donated rather than discarded?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',2,100) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_fsc_certified_timber','production','procurement','Was FSC-certified or reclaimed timber used in set construction?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'procurement',2,110) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_local_catering','production','procurement','Was catering sourced primarily from local (<100km) suppliers?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'procurement',1.5,120) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_certified_suppliers_share','pre_production','procurement','What share of key suppliers hold a recognized environmental certification (ISO 14001, eco-label, etc.)?','numeric','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'procurement',2,130) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_water_recycling_program','production','water','Was a greywater recycling or water-recovery program active on set?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'water',2.5,140) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_water_metering','production','water','Was on-set water consumption metered and tracked daily?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'water',1.5,150) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_protected_area_filming','production','biodiversity','Did any shooting location fall within or adjacent to a legally protected natural area?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'biodiversity',2,160) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_wildlife_disturbance_protocol','production','biodiversity','Was a wildlife/noise-disturbance mitigation protocol followed at natural locations?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'biodiversity',2,170) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_habitat_restoration','post_production','biodiversity','Was any habitat restoration or tree-plantation activity undertaken to offset location impact?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'biodiversity',2,180) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_local_hiring_share','pre_production','social','What share of crew was hired locally from shooting-location regions?','numeric','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'social',2,190) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_diversity_inclusion_policy','pre_production','social','Was a documented diversity and inclusion policy applied to crew/cast hiring?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'social',1.5,200) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_community_engagement','production','social','Was a local community engagement or benefit-sharing activity conducted at shoot locations?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'social',1.5,210) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_emissions_review_cadence','production','carbon','How frequently were emissions data reviewed against the production sustainability plan?','single_select','["Daily","Weekly","Monthly","Only at wrap","Not reviewed"]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'carbon',2,220) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_sustainability_coordinator','pre_production','carbon','Was a dedicated sustainability coordinator/green consultant appointed to the production?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'carbon',2.5,230) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_carbon_offset_purchased','post_production','carbon','Were verified carbon offsets purchased for residual, unavoidable emissions?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'carbon',2,240) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_digital_paperwork','pre_production','waste','Were call sheets, scripts, and production documents distributed digitally rather than printed?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',1,250) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_cloud_render_efficiency','post_production','energy','Was rendering scheduled to prioritize renewable-heavy grid hours or green-certified cloud regions?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'energy',1.5,260) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_costume_reuse_share','production','waste','What share of costumes were reused, rented, or donated rather than newly purchased?','numeric','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',2,270) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_sfx_environmental_review','production','biodiversity','Were pyrotechnics/SFX activities reviewed for environmental and air-quality impact before use?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'biodiversity',1.5,280) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_marketing_print_reduction','marketing','waste','Was print marketing volume actively reduced in favor of digital promotion?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'waste',1,290) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_questionnaire_questions VALUES ('q_physical_print_minimization','distribution','carbon','Was the number of physical film prints/hard drives minimized in favor of digital delivery?','boolean','[]',ARRAY[]::TEXT[],ARRAY[]::TEXT[],NULL,'carbon',1.5,300) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SCORING & CERTIFICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS green_score_snapshots (
  id                    TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id         TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_score           NUMERIC(5,2) NOT NULL,
  carbon_score          NUMERIC(5,2) NOT NULL,
  energy_score          NUMERIC(5,2) NOT NULL,
  water_score           NUMERIC(5,2) NOT NULL,
  waste_score           NUMERIC(5,2) NOT NULL,
  procurement_score     NUMERIC(5,2) NOT NULL,
  transportation_score  NUMERIC(5,2) NOT NULL,
  biodiversity_score    NUMERIC(5,2) NOT NULL,
  social_score          NUMERIC(5,2) NOT NULL,
  total_co2e_kg         NUMERIC(16,2) NOT NULL,
  co2e_per_crew_day     NUMERIC(12,3),
  certification_level_id TEXT,
  breakdown             JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_green_scores_production ON green_score_snapshots(production_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS green_certification_levels (
  id                    TEXT PRIMARY KEY CHECK (id IN ('bronze','silver','gold','platinum','diamond')),
  label                 TEXT NOT NULL,
  min_score             NUMERIC(5,2) NOT NULL,
  max_co2e_per_crew_day NUMERIC(12,3),
  mandatory_criteria    JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvement_note      TEXT,
  sort_order            SMALLINT NOT NULL
);

INSERT INTO green_certification_levels VALUES ('bronze','Bronze',40,NULL,
  '["carbon_footprint_measured","waste_segregation_practiced"]',
  'Establish baseline measurement across all five phases before targeting Silver.',1) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_certification_levels VALUES ('silver','Silver',55,180,
  '["carbon_footprint_measured","waste_segregation_practiced","water_recycling_program","local_hiring_priority"]',
  'Reduce carbon intensity below the industry median and formalize a waste diversion plan.',2) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_certification_levels VALUES ('gold','Gold',70,120,
  '["carbon_footprint_measured","waste_segregation_practiced","water_recycling_program","local_hiring_priority",
    "renewable_energy_partial","single_use_plastic_ban"]',
  'Reach 25%+ renewable energy share and 40%+ waste diversion to qualify for Platinum.',3) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_certification_levels VALUES ('platinum','Platinum',82,80,
  '["carbon_footprint_measured","waste_segregation_practiced","water_recycling_program","local_hiring_priority",
    "renewable_energy_majority","single_use_plastic_ban","biodiversity_assessment_completed"]',
  'Offset residual emissions and formalize a biodiversity/community program to qualify for Diamond.',4) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_certification_levels VALUES ('diamond','Diamond',92,40,
  '["carbon_footprint_measured","waste_segregation_practiced","water_recycling_program","local_hiring_priority",
    "renewable_energy_majority","single_use_plastic_ban","biodiversity_assessment_completed",
    "residual_emissions_offset","community_impact_program"]',
  'Maintain performance and publish a verified year-over-year improvement plan.',5) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS green_certifications (
  id                 TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id      TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  snapshot_id        TEXT REFERENCES green_score_snapshots(id),
  level_id           TEXT NOT NULL REFERENCES green_certification_levels(id),
  score              NUMERIC(5,2) NOT NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','revoked')),
  issued_by          TEXT NOT NULL DEFAULT 'Climactix Global',
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 years'),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_green_certifications_production ON green_certifications(production_id);

-- ============================================================
-- RECOMMENDATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS green_recommendations (
  id                    TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id         TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  snapshot_id           TEXT REFERENCES green_score_snapshots(id),
  title                 TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN
                         ('carbon','energy','water','waste','procurement','transportation','biodiversity','social')),
  description           TEXT NOT NULL,
  estimated_co2e_reduction_kg NUMERIC(14,2),
  estimated_co2e_reduction_pct NUMERIC(5,2),
  estimated_cost_saving_amount NUMERIC(14,2),
  estimated_water_saving_liters NUMERIC(14,2),
  certification_improvement TEXT,
  implementation_difficulty TEXT NOT NULL CHECK (implementation_difficulty IN ('low','medium','high')),
  estimated_roi_months  NUMERIC(6,1),
  status                TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','in_progress','completed','dismissed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_recs_production ON green_recommendations(production_id);

-- ============================================================
-- OFFSETS
-- ============================================================

CREATE TABLE IF NOT EXISTS green_offsets (
  id                 TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id      TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  offset_type        TEXT NOT NULL CHECK (offset_type IN
                      ('tree_plantation','renewable_energy','verified_carbon_credits','mangrove_restoration','blue_carbon')),
  co2e_offset_kg     NUMERIC(14,2) NOT NULL CHECK (co2e_offset_kg >= 0),
  provider           TEXT,
  cost_amount        NUMERIC(14,2),
  cost_currency      TEXT DEFAULT 'INR',
  verification_standard TEXT,
  certificate_ref    TEXT,
  purchased_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_green_offsets_production ON green_offsets(production_id);

-- ============================================================
-- BENCHMARKS
-- ============================================================

CREATE TABLE IF NOT EXISTS green_benchmarks (
  id                        TEXT PRIMARY KEY,
  dimension                 TEXT NOT NULL CHECK (dimension IN ('film_type','budget_category','country','genre')),
  dimension_value            TEXT NOT NULL,
  median_co2e_per_crew_day  NUMERIC(12,3) NOT NULL,
  p25_co2e_per_crew_day     NUMERIC(12,3) NOT NULL,
  p75_co2e_per_crew_day     NUMERIC(12,3) NOT NULL,
  sample_size               INTEGER NOT NULL DEFAULT 0,
  UNIQUE (dimension, dimension_value)
);

INSERT INTO green_benchmarks VALUES ('bm_movie','film_type','movie',145,95,210,180) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_benchmarks VALUES ('bm_series','film_type','series',110,70,160,240) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_benchmarks VALUES ('bm_documentary','film_type','documentary',60,35,95,90) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_benchmarks VALUES ('bm_advertisement','film_type','advertisement',75,45,115,150) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_benchmarks VALUES ('bm_web_series','film_type','web_series',95,60,140,110) ON CONFLICT (id) DO NOTHING;
INSERT INTO green_benchmarks VALUES ('bm_animation','film_type','animation',35,20,55,60) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EVIDENCE (verification workflow — future phase; schema only)
-- ============================================================

CREATE TABLE IF NOT EXISTS green_evidence (
  id                 TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id      TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  activity_log_id    TEXT REFERENCES green_activity_logs(id) ON DELETE SET NULL,
  evidence_type      TEXT NOT NULL CHECK (evidence_type IN
                      ('bill','fuel_receipt','electricity_bill','generator_log','travel_ticket',
                       'invoice','photograph','gps_record','supplier_certificate')),
  file_url           TEXT NOT NULL,
  confidence_score   NUMERIC(5,2),
  reviewer_notes     TEXT,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  uploaded_by        TEXT REFERENCES auth_users(id),
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_evidence_production ON green_evidence(production_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_audit_log (
  id             TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id  TEXT REFERENCES green_productions(id) ON DELETE CASCADE,
  actor_id       TEXT REFERENCES auth_users(id),
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT,
  before_state   JSONB,
  after_state    JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_audit_production ON green_audit_log(production_id, created_at DESC);
