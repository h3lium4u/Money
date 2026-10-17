-- Generated Complete Schema for Petti

CREATE TABLE IF NOT EXISTS app_security (
  id VARCHAR(50) NOT NULL DEFAULT 'master_auth'::character varying,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(100) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  default_rate NUMERIC(10, 4),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type VARCHAR(20) DEFAULT 'CUSTOMER'::character varying,
  party_type VARCHAR(20),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS distributors (
  id VARCHAR(36) NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  partner_type VARCHAR(30) NOT NULL,
  default_settlement_currency VARCHAR(5) NOT NULL DEFAULT 'AED'::character varying,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_confirmation_note text,
  group_type VARCHAR(10),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS bank_distrip_accounts (
  id VARCHAR(36) NOT NULL,
  account_code VARCHAR(30) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'::character varying,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS bank_distrip_records (
  id VARCHAR(36) NOT NULL,
  record_date date NOT NULL,
  account_id VARCHAR(36) NOT NULL,
  order_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  commission_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  paid_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  balance_inr NUMERIC(15, 2) NOT NULL,
  notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) NOT NULL,
  transaction_number VARCHAR(30) NOT NULL,
  transaction_date date NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  inr_amount NUMERIC(15, 2) NOT NULL,
  customer_rate NUMERIC(10, 4) NOT NULL,
  aed_amount NUMERIC(15, 2) NOT NULL,
  base_rate NUMERIC(10, 4) NOT NULL,
  cost_aed NUMERIC(15, 2) NOT NULL,
  gross_profit_aed NUMERIC(15, 2) NOT NULL,
  delivery_charge_pct NUMERIC(6, 4) NOT NULL DEFAULT 0.20,
  delivery_charge_aed NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  net_profit_aed NUMERIC(15, 2) NOT NULL,
  distributor_id VARCHAR(36),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'::character varying,
  notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  customer_rate_convention VARCHAR(20) DEFAULT 'AED_PER_1000'::character varying,
  base_rate_convention VARCHAR(20) DEFAULT 'INR_PER_AED'::character varying,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id VARCHAR(36) NOT NULL,
  payment_number VARCHAR(30) NOT NULL,
  payment_date date NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  transaction_id VARCHAR(36),
  amount_aed NUMERIC(15, 2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH'::character varying,
  reference_number VARCHAR(50),
  notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS distribution_splits (
  id VARCHAR(36) NOT NULL,
  transaction_id VARCHAR(36) NOT NULL,
  distributor_id VARCHAR(36) NOT NULL,
  split_date date NOT NULL,
  inr_amount NUMERIC(15, 2) NOT NULL,
  wholesale_rate NUMERIC(10, 4),
  aed_equivalent NUMERIC(15, 2),
  paid_amount_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  balance_inr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ALLOCATED'::character varying,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS wholesale_settlements (
  id VARCHAR(36) NOT NULL,
  settlement_date date NOT NULL,
  distributor_id VARCHAR(36) NOT NULL,
  inr_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  wholesale_rate NUMERIC(10, 4) NOT NULL,
  aed_equivalent NUMERIC(15, 2) NOT NULL,
  paid_amount_aed NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  balance_aed NUMERIC(15, 2) NOT NULL,
  notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) NOT NULL,
  expense_date date NOT NULL,
  category VARCHAR(50) NOT NULL,
  description text,
  amount_aed NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) NOT NULL,
  entity_name VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_values text,
  new_values text,
  user_name VARCHAR(50) DEFAULT 'Admin'::character varying,
  reason text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS scheduled_wipes (
  id text NOT NULL,
  status text NOT NULL,
  scheduled_at text NOT NULL,
  execute_at text NOT NULL,
  backup_downloaded boolean DEFAULT false,
  created_at text NOT NULL,
  scope text DEFAULT 'all'::text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS distributor_allocations (
  id VARCHAR(36) NOT NULL,
  distributor_id VARCHAR(36) NOT NULL,
  allocation_date date NOT NULL,
  inr_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  source VARCHAR(50) NOT NULL DEFAULT 'COLLECTION_AND_PROFIT'::character varying,
  notes text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Indexes
CREATE UNIQUE INDEX customers_code_key ON public.customers USING btree (code);
CREATE UNIQUE INDEX distributors_code_key ON public.distributors USING btree (code);
CREATE UNIQUE INDEX transactions_transaction_number_key ON public.transactions USING btree (transaction_number);
CREATE UNIQUE INDEX customer_payments_payment_number_key ON public.customer_payments USING btree (payment_number);
CREATE UNIQUE INDEX bank_distrip_accounts_account_code_key ON public.bank_distrip_accounts USING btree (account_code);
CREATE INDEX idx_splits_txn ON public.distribution_splits USING btree (transaction_id);
CREATE INDEX idx_splits_dist ON public.distribution_splits USING btree (distributor_id);
CREATE INDEX idx_splits_date ON public.distribution_splits USING btree (split_date);
CREATE UNIQUE INDEX distributors_name_group_type_unique ON public.distributors USING btree (name, group_type);
CREATE INDEX idx_dist_alloc_dist_date ON public.distributor_allocations USING btree (distributor_id, allocation_date);
CREATE INDEX idx_transactions_customer_id ON public.transactions USING btree (customer_id);
CREATE INDEX idx_transactions_date ON public.transactions USING btree (transaction_date);
CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);
CREATE INDEX idx_customer_payments_transaction_id ON public.customer_payments USING btree (transaction_id);
CREATE INDEX idx_customer_payments_customer_id ON public.customer_payments USING btree (customer_id);
CREATE INDEX idx_customers_entity_type ON public.customers USING btree (entity_type);
CREATE INDEX idx_transactions_cust_status ON public.transactions USING btree (customer_id, status);
CREATE INDEX idx_customer_payments_cust ON public.customer_payments USING btree (customer_id);
CREATE INDEX idx_customer_payments_date ON public.customer_payments USING btree (payment_date);
CREATE INDEX idx_distribution_splits_txn ON public.distribution_splits USING btree (transaction_id);
CREATE INDEX idx_distribution_splits_dist ON public.distribution_splits USING btree (distributor_id);
CREATE INDEX idx_bank_distrip_acc_date ON public.bank_distrip_records USING btree (account_id, record_date);
