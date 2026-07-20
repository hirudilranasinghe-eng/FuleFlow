-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees Table
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Supervisor', 'Pumper')),
    phone TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Active', 'On Shift', 'Off-duty', 'Suspended')),
    avatarColor TEXT NOT NULL
);

-- Fuel Tanks Table
CREATE TABLE fuel_tanks (
    id TEXT PRIMARY KEY,
    fuelType TEXT NOT NULL,
    name TEXT NOT NULL,
    capacity NUMERIC NOT NULL,
    currentLevel NUMERIC NOT NULL,
    pricePerLiter NUMERIC NOT NULL
);

-- Pumps Table
CREATE TABLE pumps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fuelType TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Idle', 'Maintenance'))
);

-- Shifts Table
CREATE TABLE shifts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    supervisorId TEXT REFERENCES employees(id),
    startTime TIMESTAMPTZ NOT NULL,
    endTime TIMESTAMPTZ,
    isActive BOOLEAN NOT NULL DEFAULT true,
    totalFuelSold NUMERIC DEFAULT 0,
    totalNetSold NUMERIC DEFAULT 0,
    totalNetSales NUMERIC DEFAULT 0
);

-- Pump Readings Table (Linked to Shifts)
CREATE TABLE pump_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id TEXT REFERENCES shifts(id) ON DELETE CASCADE,
    pumpId TEXT NOT NULL,
    pumpName TEXT NOT NULL,
    fuelType TEXT NOT NULL,
    assignedPumperId TEXT REFERENCES employees(id),
    startMeter NUMERIC NOT NULL,
    endMeter NUMERIC NOT NULL,
    testingQty NUMERIC DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Idle', 'Completed')),
    isLocked BOOLEAN DEFAULT false,
    unitPrice NUMERIC
);

-- Stock Deliveries Table
CREATE TABLE stock_deliveries (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL,
    fuelType TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    supplier TEXT NOT NULL,
    cost NUMERIC NOT NULL
);

-- Price Schedules Table
CREATE TABLE price_schedules (
    id TEXT PRIMARY KEY,
    fuelType TEXT NOT NULL,
    newPrice NUMERIC NOT NULL,
    effectiveDate TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Applied', 'Cancelled'))
);
