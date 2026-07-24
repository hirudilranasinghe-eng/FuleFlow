export const SUPABASE_SQL = `-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees Table
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Supervisor', 'Pumper')),
    phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Active', 'On Shift', 'Off-duty', 'Suspended')),
    avatarcolor TEXT NOT NULL
);

-- Fuel Tanks Table
CREATE TABLE fuel_tanks (
    id TEXT PRIMARY KEY,
    fueltype TEXT NOT NULL,
    name TEXT NOT NULL,
    capacity NUMERIC NOT NULL,
    currentlevel NUMERIC NOT NULL,
    priceperliter NUMERIC NOT NULL
);

-- Pumps Table
CREATE TABLE pumps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fueltype TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Idle', 'Maintenance'))
);

-- Shifts Table
CREATE TABLE shifts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    supervisorid TEXT REFERENCES employees(id),
    starttime TIMESTAMPTZ NOT NULL,
    endtime TIMESTAMPTZ,
    isactive BOOLEAN NOT NULL DEFAULT true,
    totalfuelsold NUMERIC DEFAULT 0,
    totalnetsold NUMERIC DEFAULT 0,
    totalnetsales NUMERIC DEFAULT 0
);

-- Pump Readings Table (Linked to Shifts)
CREATE TABLE pump_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id TEXT REFERENCES shifts(id) ON DELETE CASCADE,
    pumpid TEXT NOT NULL,
    pumpname TEXT NOT NULL,
    fueltype TEXT NOT NULL,
    assignedpumperid TEXT REFERENCES employees(id),
    startmeter NUMERIC NOT NULL,
    endmeter NUMERIC NOT NULL,
    testingqty NUMERIC DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Idle', 'Completed')),
    islocked BOOLEAN DEFAULT false,
    unitprice NUMERIC
);

-- Stock Deliveries Table
CREATE TABLE stock_deliveries (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    fueltype TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    supplier TEXT NOT NULL,
    cost NUMERIC NOT NULL
);

-- Price Schedules Table
CREATE TABLE price_schedules (
    id TEXT PRIMARY KEY,
    fueltype TEXT NOT NULL,
    newprice NUMERIC NOT NULL,
    effectivedate TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Applied', 'Cancelled'))
);

-- Disable Row Level Security (RLS) for all tables to allow simple public access
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_tanks DISABLE ROW LEVEL SECURITY;
ALTER TABLE pumps DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE pump_readings DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_deliveries DISABLE ROW LEVEL SECURITY;
ALTER TABLE price_schedules DISABLE ROW LEVEL SECURITY;

-- Disable RLS for fuel_tank if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_tank') THEN
        ALTER TABLE fuel_tank DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- If Row Level Security is enabled/re-enabled, create permissive policies allowing full access
DROP POLICY IF EXISTS "Enable all access for employees" ON employees;
CREATE POLICY "Enable all access for employees" ON employees FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for fuel_tanks" ON fuel_tanks;
CREATE POLICY "Enable all access for fuel_tanks" ON fuel_tanks FOR ALL TO public USING (true) WITH CHECK (true);

-- Permissive policy for fuel_tank if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_tank') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Enable all access for fuel_tank" ON fuel_tank';
        EXECUTE 'CREATE POLICY "Enable all access for fuel_tank" ON fuel_tank FOR ALL TO public USING (true) WITH CHECK (true)';
    END IF;
END $$;

DROP POLICY IF EXISTS "Enable all access for pumps" ON pumps;
CREATE POLICY "Enable all access for pumps" ON pumps FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for shifts" ON shifts;
CREATE POLICY "Enable all access for shifts" ON shifts FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for pump_readings" ON pump_readings;
CREATE POLICY "Enable all access for pump_readings" ON pump_readings FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for stock_deliveries" ON stock_deliveries;
CREATE POLICY "Enable all access for stock_deliveries" ON stock_deliveries FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for price_schedules" ON price_schedules;
CREATE POLICY "Enable all access for price_schedules" ON price_schedules FOR ALL TO public USING (true) WITH CHECK (true);`;
