CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    role VARCHAR DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zyra_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_subject VARCHAR,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    raw_body TEXT,
    customer_type VARCHAR CHECK (customer_type IN ('Auto', 'Retail')),
    customer_status VARCHAR CHECK (customer_status IN ('New', 'Existing')),
    summary TEXT,
    customer_phone VARCHAR,
    ai_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zyra_calls_received_at ON zyra_calls(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_zyra_calls_customer_type ON zyra_calls(customer_type);
CREATE INDEX IF NOT EXISTS idx_zyra_calls_customer_status ON zyra_calls(customer_status);

-- Same employees as gd-inbox (password: password123)
INSERT INTO employees (name, email, username, password_hash, role) VALUES
('Dakota Hill',     'dakota@glassdoctordfw.com',   'dakota',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Trent Royse',     'trent@glassdoctordfw.com',    'trent',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Hayden Rodd',     'hayden@glassdoctordfw.com',   'hayden',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Isaiah Soriano',  'isaiah@glassdoctordfw.com',   'isaiah',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Erin Smitherman', 'erin@glassdoctordfw.com',     'erin',     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Lemar',           'lemar@glassdoctordfw.com',    'lemar',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Ahmet Ramovic',   'ahmet@glassdoctordfw.com',    'ahmet',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Isabella Pena',   'isabella@glassdoctordfw.com', 'isabella', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Adam McNeil',     'adam@glassdoctordfw.com',     'adam',     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Sam Dixon',       'sam@glassdoctordfw.com',      'sam',      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Houston Leach',   'houston@glassdoctordfw.com',  'houston',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'employee'),
('Aayush Patil',    'apatil@glassdoctordfw.com',   'aayush',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGAJ7.UZP4fYiJOwj2EuXo9GKRC', 'manager')
ON CONFLICT (username) DO NOTHING;
