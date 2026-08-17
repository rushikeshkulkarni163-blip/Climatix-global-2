-- ============================================================
-- Climactix Green Production — Migration 006
-- Full sheet-by-sheet production sustainability data log, mirroring
-- the manual "Film Green Rating — Production Sustainability Data Log"
-- workbook: Daily Log, Fuel & Vehicles, Crew Travel, Shoot-Stay Trips,
-- Energy, Materials, Accommodation, Food & Catering, plus wider
-- Water/Waste/Evidence records.
-- Idempotent: safe to run on every backend startup.
-- ============================================================

-- ── Widen Water & Waste with the Excel sheets' extra columns ──

ALTER TABLE green_water_records
  ADD COLUMN IF NOT EXISTS location_name  TEXT,
  ADD COLUMN IF NOT EXISTS purpose        TEXT,
  ADD COLUMN IF NOT EXISTS meter_start_l  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS meter_end_l    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tanker_liters    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS bottled_liters   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS drinking_liters  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS sanitation_liters NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS cleaning_liters  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS catering_liters  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS makeup_liters    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS other_liters     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS people_served    INTEGER,
  ADD COLUMN IF NOT EXISTS evidence_ref     TEXT,
  ADD COLUMN IF NOT EXISTS data_quality     TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated'));

ALTER TABLE green_waste_records
  ADD COLUMN IF NOT EXISTS location_name     TEXT,
  ADD COLUMN IF NOT EXISTS source_activity    TEXT,
  ADD COLUMN IF NOT EXISTS quantity_units     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS unit_type          TEXT,
  ADD COLUMN IF NOT EXISTS segregated         BOOLEAN,
  ADD COLUMN IF NOT EXISTS collection_method  TEXT,
  ADD COLUMN IF NOT EXISTS destination_vendor TEXT,
  ADD COLUMN IF NOT EXISTS composted_kg       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS incinerated_kg     NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS hazardous          BOOLEAN,
  ADD COLUMN IF NOT EXISTS manifest_ref       TEXT,
  ADD COLUMN IF NOT EXISTS data_quality       TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated'));

-- ── Widen Evidence Register ──

ALTER TABLE green_evidence
  ALTER COLUMN file_url DROP NOT NULL;

ALTER TABLE green_evidence
  ADD COLUMN IF NOT EXISTS evidence_date     DATE,
  ADD COLUMN IF NOT EXISTS source_vendor     TEXT,
  ADD COLUMN IF NOT EXISTS file_folder_reference TEXT,
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS data_category     TEXT,
  ADD COLUMN IF NOT EXISTS amount_quantity   NUMERIC(16,4),
  ADD COLUMN IF NOT EXISTS unit              TEXT,
  ADD COLUMN IF NOT EXISTS verified_by       TEXT,
  ADD COLUMN IF NOT EXISTS verification_date DATE,
  ADD COLUMN IF NOT EXISTS remarks           TEXT;

ALTER TABLE green_evidence DROP CONSTRAINT IF EXISTS green_evidence_evidence_type_check;
ALTER TABLE green_evidence ADD CONSTRAINT green_evidence_evidence_type_check CHECK (evidence_type IN
  ('bill','fuel_receipt','electricity_bill','generator_log','travel_ticket',
   'invoice','photograph','gps_record','supplier_certificate','meter_reading','vendor_record','other'));

-- ============================================================
-- DAILY LOG — one-row-per-shoot-day master control sheet
-- ============================================================

CREATE TABLE IF NOT EXISTS green_daily_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  shoot_day_number  INTEGER,
  location_set      TEXT,
  shoot_unit        TEXT,
  call_time         TIME,
  wrap_time         TIME,
  crew_count        INTEGER,
  cast_count        INTEGER,
  extras_count      INTEGER,
  production_hours  NUMERIC(6,2),
  weather_conditions TEXT,
  power_source      TEXT,
  diesel_generator_l NUMERIC(12,2),
  grid_electricity_kwh NUMERIC(12,2),
  water_used_l      NUMERIC(14,2),
  waste_generated_kg NUMERIC(14,2),
  crew_travel_km    NUMERIC(12,2),
  shoot_stay_km     NUMERIC(12,2),
  accommodation_rooms_nights INTEGER,
  catering_covers   INTEGER,
  notes             TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_green_daily_logs_production ON green_daily_logs(production_id, log_date);

-- ============================================================
-- FUEL & VEHICLE LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_fuel_vehicle_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  vehicle_equipment_id TEXT,
  vehicle_type      TEXT,
  fuel_type         TEXT,
  opening_odometer_km NUMERIC(12,2),
  closing_odometer_km NUMERIC(12,2),
  distance_km       NUMERIC(12,2),
  fuel_purchased_l  NUMERIC(12,2),
  fuel_consumed_l   NUMERIC(12,2),
  fuel_receipt_ref  TEXT,
  fuel_vendor       TEXT,
  is_generator      BOOLEAN DEFAULT FALSE,
  generator_hours   NUMERIC(8,2),
  generator_fuel_l  NUMERIC(12,2),
  adblue_l          NUMERIC(10,2),
  purpose_route     TEXT,
  driver_name       TEXT,
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_fuel_vehicle_logs_production ON green_fuel_vehicle_logs(production_id, log_date);

-- ============================================================
-- CREW TRAVEL LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_crew_travel_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  person_crew_category TEXT,
  department        TEXT,
  travel_mode       TEXT,
  origin            TEXT,
  destination       TEXT,
  one_way_distance_km NUMERIC(12,2),
  num_persons       INTEGER,
  trips             INTEGER,
  passenger_km      NUMERIC(14,2),
  purpose           TEXT,
  shared_vehicle    BOOLEAN,
  public_transport  BOOLEAN,
  is_flight         BOOLEAN,
  travel_class      TEXT,
  ticket_ref        TEXT,
  cost_inr          NUMERIC(14,2),
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_crew_travel_logs_production ON green_crew_travel_logs(production_id, log_date);

-- ============================================================
-- SHOOT ↔ STAY TRIP LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_shoot_stay_trip_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  trip_label        TEXT,
  from_location      TEXT,
  to_location        TEXT,
  trip_purpose      TEXT,
  vehicle_id        TEXT,
  vehicle_type      TEXT,
  fuel_type         TEXT,
  distance_per_trip_km NUMERIC(12,2),
  number_of_trips   INTEGER,
  passengers_per_trip INTEGER,
  total_passenger_km NUMERIC(14,2),
  fuel_consumed_l   NUMERIC(12,2),
  driver_name       TEXT,
  start_time        TIME,
  end_time          TIME,
  evidence_ref      TEXT,
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_shoot_stay_trip_logs_production ON green_shoot_stay_trip_logs(production_id, log_date);

-- ============================================================
-- ENERGY & ELECTRICITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_energy_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  location_name     TEXT,
  energy_source     TEXT,
  equipment_area    TEXT,
  meter_start_kwh   NUMERIC(14,2),
  meter_end_kwh     NUMERIC(14,2),
  grid_kwh          NUMERIC(14,2),
  generator_kwh     NUMERIC(14,2),
  renewable_kwh     NUMERIC(14,2),
  battery_kwh       NUMERIC(14,2),
  generator_hours   NUMERIC(8,2),
  diesel_used_l     NUMERIC(12,2),
  renewable_source  TEXT,
  meter_invoice_ref TEXT,
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_energy_logs_production ON green_energy_logs(production_id, log_date);

-- ============================================================
-- MATERIALS, SET & PROCUREMENT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_materials_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  department        TEXT,
  material_item     TEXT,
  category          TEXT,
  quantity          NUMERIC(14,2),
  unit              TEXT,
  condition_new_reused TEXT,
  locally_sourced   BOOLEAN,
  reusable_recyclable BOOLEAN,
  supplier          TEXT,
  cost_inr          NUMERIC(14,2),
  disposal_route    TEXT,
  evidence_ref      TEXT,
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_materials_logs_production ON green_materials_logs(production_id, log_date);

-- ============================================================
-- ACCOMMODATION LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_accommodation_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  property_hotel    TEXT,
  location_name     TEXT,
  crew_cast_category TEXT,
  rooms_occupied    INTEGER,
  nights            INTEGER,
  occupancy_per_room NUMERIC(5,2),
  total_room_nights NUMERIC(10,2),
  check_in          DATE,
  check_out         DATE,
  electricity_included BOOLEAN,
  water_included    BOOLEAN,
  waste_services    BOOLEAN,
  laundry_services  BOOLEAN,
  booking_ref       TEXT,
  cost_inr          NUMERIC(14,2),
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_accommodation_logs_production ON green_accommodation_logs(production_id, log_date);

-- ============================================================
-- FOOD & CATERING LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS green_food_catering_logs (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  production_id     TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  log_date          DATE NOT NULL,
  region            TEXT NOT NULL DEFAULT 'Global' CHECK (region IN ('India','UK','US','Europe','Australia','Global')),
  location_name     TEXT,
  meal              TEXT,
  covers_servings   INTEGER,
  menu_type         TEXT,
  food_purchased_kg NUMERIC(12,2),
  food_waste_kg     NUMERIC(12,2),
  packaging_waste_kg NUMERIC(12,2),
  vegetarian_covers INTEGER,
  nonveg_covers     INTEGER,
  local_seasonal_pct NUMERIC(5,2),
  plant_based_options BOOLEAN,
  reusable_crockery BOOLEAN,
  single_use_items_qty INTEGER,
  water_used_l      NUMERIC(12,2),
  supplier          TEXT,
  evidence_ref      TEXT,
  co2e_kg           NUMERIC(16,4),
  factor_key_used   TEXT,
  data_quality      TEXT DEFAULT 'Actual' CHECK (data_quality IN ('Actual','Estimated')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_food_catering_logs_production ON green_food_catering_logs(production_id, log_date);
