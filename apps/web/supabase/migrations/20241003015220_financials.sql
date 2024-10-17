-- ============================================================
-- Create enums
-- ============================================================
create type marital_status_enum as enum ('Single', 'Married', 'Married with Kids', 'Other');
create type income_level_enum as enum ('Less than $25,000', '$25,000 - $50,000', '$50,000 - $75,000', '$75,000 - $100,000', 'More than $100,000');
create type savings_enum as enum ('Less than $1,000', '$1,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', 'More than $25,000');
create type debt_type_enum as enum ('Credit Cards', 'Student Loans', 'Personal Loans', 'Mortgage', 'Auto Loans', 'Other');

-- ============================================================
-- acct_fin_profile table
-- ============================================================

-- Create table
create table if not exists public.acct_fin_profile (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references public.accounts(id) not null unique,
  full_name text,
  age integer,
  marital_status marital_status_enum,
  marital_status_other text,
  dependents integer,
  income_level income_level_enum,
  current_debt debt_type_enum[],
  current_debt_other text,
  savings savings_enum,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Revoke all permissions
revoke all on public.acct_fin_profile from public, service_role;

-- Grant necessary permissions
grant select on public.acct_fin_profile to authenticated;
grant select, update on public.acct_fin_profile to service_role;

-- Enable row level security
alter table acct_fin_profile enable row level security;

-- Create policies
create policy read_acct_fin_profile
    on public.acct_fin_profile
    for select
    to authenticated
    using (account_id = (select auth.uid()));

create policy insert_acct_fin_profile
    on public.acct_fin_profile
    for insert
    to authenticated
    with check (account_id = (select auth.uid()));

create policy update_acct_fin_profile
    on public.acct_fin_profile
    for update
    to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

-- End of acct_fin_profile table

-- ============================================================
-- plaid_connection_items table
-- ============================================================

-- Create table
create table if not exists public.plaid_connection_items (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references public.accounts(id) not null,
  constraint chk_team_account check (not kit.check_team_account_by_id(account_id)),
  plaid_item_id text not null unique,
  institution_id text not null,
  institution_name text not null,
  institution_logo_storage_name text,
  access_token text not null,
  next_cursor text, -- cursor for Plaid sync
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Create a function to validate institution_logo_storage_name
create or replace function validate_institution_logo_storage_name()
returns trigger as $$
begin
  if new.institution_logo_storage_name is not null then
    if not exists (
      select 1
      from storage.objects
      where name = new.institution_logo_storage_name
      and bucket_id = 'plaid_item_institution_logos'
    ) then
      raise exception 'Invalid institution_logo_storage_name: object does not exist in the plaid_item_institution_logos bucket';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- Create a trigger to use the validation function
create trigger check_institution_logo_storage_name
before insert or update on public.plaid_connection_items
for each row execute function validate_institution_logo_storage_name();

-- Revoke all permissions
revoke all on public.plaid_connection_items from public, service_role;

-- Grant necessary permissions
grant select on public.plaid_connection_items to authenticated;
grant select, update, insert, delete on public.plaid_connection_items to service_role;

-- Enable row level security
alter table plaid_connection_items enable row level security;

-- Create policies
create policy read_plaid_connection_items
    on public.plaid_connection_items
    for select
    to authenticated
    using (account_id = (select auth.uid()));

create policy insert_plaid_connection_items
    on public.plaid_connection_items
    for insert
    to authenticated
    with check (account_id = (select auth.uid()));

create policy update_plaid_connection_items
    on public.plaid_connection_items
    for update
    to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

-- End of plaid_connection_items table

-- ============================================================
-- plaid_accounts table
-- ============================================================

-- Create table
create table if not exists public.plaid_accounts (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references public.accounts(id) not null,
  constraint chk_team_account check (not kit.check_team_account_by_id(account_id)),
  plaid_conn_item_id uuid references public.plaid_connection_items(id) not null,
  plaid_account_id text not null unique,
  plaid_persistent_account_id text unique,
  name text not null,
  official_name text,
  type text not null,
  subtype text not null,
  balance_available numeric, -- NULL for loans
  balance_current numeric not null,
  iso_currency_code text not null,
  balance_limit numeric,
  mask text,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Revoke all permissions
revoke all on public.plaid_accounts from public, service_role;

-- Grant necessary permissions
grant select on public.plaid_accounts to authenticated;
grant select, update, insert, delete on public.plaid_accounts to service_role;

-- Enable row level security
alter table plaid_accounts enable row level security;

-- Create policies
create policy read_plaid_accounts
    on public.plaid_accounts
    for select
    to authenticated
    using ((select account_id from public.plaid_connection_items where id = plaid_conn_item_id) = (select auth.uid()));

create policy insert_plaid_accounts
    on public.plaid_accounts
    for insert
    to authenticated
    with check ((select account_id from public.plaid_connection_items where id = plaid_conn_item_id) = (select auth.uid()));

create policy update_plaid_accounts
    on public.plaid_accounts
    for update
    to authenticated
    using ((select account_id from public.plaid_connection_items where id = plaid_conn_item_id) = (select auth.uid()))
    with check ((select account_id from public.plaid_connection_items where id = plaid_conn_item_id) = (select auth.uid()));


-- End of plaid_accounts table
CREATE OR REPLACE FUNCTION remove_plaid_account(p_budget_id UUID, p_plaid_account_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Remove from budget_plaid_accounts first (due to foreign key constraint)
    DELETE FROM budget_plaid_accounts
    WHERE budget_id = p_budget_id AND plaid_account_id = p_plaid_account_id;

    -- Then remove from plaid_accounts
    DELETE FROM plaid_accounts
    WHERE id = p_plaid_account_id;
EXCEPTION
    WHEN OTHERS THEN
      -- If there's any error, roll back the transaction
      ROLLBACK;
      RAISE;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION remove_plaid_account(UUID, UUID) TO service_role;


-- ============================================================
-- fin_account_transactions table
-- ============================================================

-- Create table
create table if not exists public.fin_account_transactions (
  id uuid primary key default uuid_generate_v4(),
  plaid_account_id uuid references public.plaid_accounts(id) not null,
  amount numeric not null,
  iso_currency_code text,
  category_primary text,
  category_detailed text,
  category_confidence text,
  date date not null,
  merchant_name text,
  payee text,
--   category_id text,
--   counterparties jsonb,
--   datetime timestamp with time zone,
--   authorized_date date,
--   authorized_datetime timestamp with time zone,
--   name text not null,
--   merchant_entity_id text,
--   logo_url text,
--   website text,
--   payment_channel text,
--   pending boolean default false,
--   pending_transaction_id uuid,
--   personal_finance_category jsonb,
--   transaction_id text not null,
--   transaction_code text,
--   transaction_type text,
  raw_data jsonb,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Revoke all permissions
revoke all on public.fin_account_transactions from public, service_role;

-- Grant necessary permissions
grant select on public.fin_account_transactions to authenticated;
grant select, update, insert, delete on public.fin_account_transactions to service_role;

-- Enable row level security
alter table fin_account_transactions enable row level security;

-- Create policies
create policy read_fin_account_transactions
    on public.fin_account_transactions
    for select
    to authenticated
    using ((select account_id from public.plaid_accounts where id = fin_account_transactions.plaid_account_id) = (select auth.uid()));

create policy insert_fin_account_transactions
    on public.fin_account_transactions
    for insert
    to authenticated
    with check ((select account_id from public.plaid_accounts where id = fin_account_transactions.plaid_account_id) = (select auth.uid()));

create policy update_fin_account_transactions
    on public.fin_account_transactions
    for update
    to authenticated
    using ((select account_id from public.plaid_accounts where id = fin_account_transactions.plaid_account_id) = (select auth.uid()))
    with check ((select account_id from public.plaid_accounts where id = fin_account_transactions.plaid_account_id) = (select auth.uid()));

-- ============================================================
-- budget table
-- ============================================================

-- Create enums
create type financial_goal_enum as enum (
    'Debt - Loans',
    'Debt - Credit Cards',
    'Save - Build an emergency fund',
    'Save - Save for a house',
    'Save - Save for retirement',
    'Save - Save for children''s education',
    'Save - Save for vacation or a large purchase',
    'Invest in stocks or bonds',
    'Donate to charity or tithe regularly',
    'Manage your money better'
);

create type goal_timeline_enum as enum (
    '6 months',
    '1 year',
    '3 years',
    '5 years or more'
);

create type monthly_contribution_enum as enum (
    'Less than $100',
    '$100 - $250',
    '$250 - $500',
    '$500 - $1,000',
    'More than $1,000'
);

create type budget_type as enum (
    'personal',
    'business'
);

-- Create table
create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references public.accounts(id) not null unique, -- team account id (not user id)
  constraint chk_team_account check (kit.check_team_account_by_id(account_id)),
  budget_type budget_type not null default 'personal',
  category_spending jsonb not null default '{}', -- contains data from onboarding step 3
  is_active boolean not null default true,
  start_date date not null default current_date,
  end_date date,
  current_onboarding_step onboarding_step_enum not null default 'start',
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Revoke all permissions
revoke all on public.budgets from public, service_role;

-- Grant necessary permissions
grant select on public.budgets to authenticated;
grant select, update, insert, delete on public.budgets to service_role;

-- Enable row level security
alter table budgets enable row level security;

-- Create policies
create policy read_budgets
    on public.budgets
    for select
    to authenticated
    using (
        account_id in (
            select account_id from public.accounts_memberships
            where user_id = auth.uid()
        )
    );

create policy insert_budgets
    on public.budgets
    for insert
    to authenticated
    with check (
        account_id in (
            select account_id from public.accounts_memberships
            where user_id = auth.uid()
            and account_role in ('owner', 'collaborator')
        )
    );

create policy update_budgets
    on public.budgets
    for update
    to authenticated
    using (
        account_id in (
            select account_id from public.accounts_memberships
            where user_id = auth.uid()
            and account_role in ('owner', 'collaborator')
        )
    )
    with check (
        account_id in (
            select account_id from public.accounts_memberships
            where user_id = auth.uid()
            and account_role in ('owner', 'collaborator')
        )
    );

-- End of budgets table

CREATE OR REPLACE FUNCTION get_budget_transactions(p_budget_id UUID)
RETURNS TABLE (
    id UUID,
    date DATE,
    category TEXT,
    merchant_name TEXT,
    payee TEXT,
    amount NUMERIC,
    account_name TEXT,
    account_mask TEXT
) AS $$
BEGIN
    -- Check if the user has permission to access this budget
    IF NOT EXISTS (
        SELECT 1
        FROM public.budgets b
        JOIN public.accounts_memberships am ON b.account_id = am.account_id
        WHERE b.id = p_budget_id
        AND am.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied: User does not have permission to view this budget''s transactions';
    END IF;

    -- If the check passes, return the query result
    RETURN QUERY
    SELECT 
        fat.id,
        fat.date,
        COALESCE(fat.category_detailed, 'Uncategorized') AS category,
        fat.merchant_name AS payee,
        fat.payee AS description,
        fat.amount,
        pa.name AS account,
        pa.mask AS account_mask
    FROM 
        fin_account_transactions fat
    JOIN 
        plaid_accounts pa ON fat.plaid_account_id = pa.id
    JOIN 
        budget_plaid_accounts bpa ON pa.id = bpa.plaid_account_id
    WHERE 
        bpa.budget_id = p_budget_id
    ORDER BY 
        date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION get_budget_transactions(UUID) TO authenticated;

-- ============================================================
-- budget_plaid_accounts table
-- ============================================================

-- Create table
create table if not exists public.budget_plaid_accounts (
  budget_id uuid references public.budgets(id) on delete cascade,
  plaid_account_id uuid references public.plaid_accounts(id) on delete cascade,
  primary key (budget_id, plaid_account_id)
);

-- Revoke all permissions
revoke all on public.budget_plaid_accounts from public, service_role;

-- Grant necessary permissions
grant select on public.budget_plaid_accounts to authenticated;
grant select, insert, update, delete on public.budget_plaid_accounts to service_role;

-- Enable row level security
alter table budget_plaid_accounts enable row level security;

-- Create policies
create policy read_budget_plaid_accounts
    on public.budget_plaid_accounts
    for select
    to authenticated
    using (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
            )
        )
    );

create policy insert_budget_plaid_accounts
    on public.budget_plaid_accounts
    for insert
    to authenticated
    with check (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
                and account_role in ('owner', 'collaborator')
            )
        )
    );

create policy update_budget_plaid_accounts
    on public.budget_plaid_accounts
    for update
    to authenticated
    using (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
                and account_role in ('owner', 'collaborator')
            )
        )
    )
    with check (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
                and account_role in ('owner', 'collaborator')
            )
        )
    );

-- End of budget_plaid_accounts table

CREATE OR REPLACE FUNCTION add_budget_plaid_account(
    p_budget_id UUID,
    p_plaid_conn_item_id UUID,
    p_plaid_account_id TEXT,
    p_account_id UUID,
    p_balance_available NUMERIC,
    p_balance_current NUMERIC,
    p_balance_limit NUMERIC,
    p_iso_currency_code TEXT,
    p_mask TEXT,
    p_name TEXT,
    p_official_name TEXT,
    p_plaid_persistent_account_id TEXT,
    p_type TEXT,
    p_subtype TEXT
)
RETURNS UUID AS $$
DECLARE
    v_plaid_account_id UUID;
    v_constraint_name TEXT;
    v_constraint_schema TEXT;
    v_constraint_table TEXT;
    v_existing_id UUID;
BEGIN
    RAISE NOTICE 'Starting function with budget_id: %, plaid_account_id: %', p_budget_id, p_plaid_account_id;

    -- Check if plaid_account already exists
    SELECT id INTO v_existing_id FROM plaid_accounts WHERE plaid_account_id = p_plaid_account_id;
    
    IF v_existing_id IS NOT NULL THEN
        RAISE NOTICE 'Plaid account already exists with id: %', v_existing_id;
        v_plaid_account_id := v_existing_id;
    ELSE
        -- Insert into plaid_accounts
        INSERT INTO plaid_accounts (
            plaid_conn_item_id,
            plaid_account_id,
            account_id,
            balance_available,
            balance_current,
            balance_limit,
            iso_currency_code,
            mask,
            name,
            official_name,
            plaid_persistent_account_id,
            type,
            subtype
        )
        VALUES (
            p_plaid_conn_item_id,
            p_plaid_account_id,
            p_account_id,
            p_balance_available,
            p_balance_current,
            p_balance_limit,
            p_iso_currency_code,
            p_mask,
            p_name,
            p_official_name,
            p_plaid_persistent_account_id,
            p_type,
            p_subtype
        )
        RETURNING id INTO v_plaid_account_id;
        
        RAISE NOTICE 'Inserted new plaid account with id: %', v_plaid_account_id;
    END IF;

    -- Check if budget_plaid_account already exists
    IF EXISTS (SELECT 1 FROM budget_plaid_accounts WHERE budget_id = p_budget_id AND plaid_account_id = v_plaid_account_id) THEN
        RAISE NOTICE 'Budget plaid account association already exists';
    ELSE
        -- Insert into budget_plaid_accounts
        INSERT INTO budget_plaid_accounts (budget_id, plaid_account_id)
        VALUES (p_budget_id, v_plaid_account_id);
        
        RAISE NOTICE 'Inserted new budget plaid account association';
    END IF;

    -- Return the plaid_account_id
    RETURN v_plaid_account_id;

EXCEPTION 
    WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS 
            v_constraint_name = CONSTRAINT_NAME,
            v_constraint_schema = SCHEMA_NAME,
            v_constraint_table = TABLE_NAME;
        
        RAISE EXCEPTION 'Unique violation occurred on table %.% for constraint %', 
                        v_constraint_schema, v_constraint_table, v_constraint_name;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'An error occurred: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION add_budget_plaid_account(UUID, UUID, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================
-- budget_goals table
-- ============================================================

-- Create table
create table if not exists public.budget_goals (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid references public.budgets(id) not null unique,
  primary_goal financial_goal_enum[],
  goal_timeline goal_timeline_enum,
  monthly_contribution monthly_contribution_enum,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Revoke all permissions
revoke all on public.budget_goals from public, service_role;

-- Grant necessary permissions
grant select, update, insert on public.budget_goals to authenticated;
grant select, delete on public.budget_goals to service_role;

-- Enable row level security
alter table budget_goals enable row level security;

-- Create policies
create policy read_budget_goals
    on public.budget_goals
    for select
    to authenticated
    using (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
            )
        )
    );

create policy insert_budget_goals
    on public.budget_goals
    for insert
    to authenticated
    with check (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
                and account_role in ('owner', 'collaborator')
            )
        )
    );

create policy update_budget_goals
    on public.budget_goals
    for update
    to authenticated
    using (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
                and account_role in ('owner', 'collaborator')
            )
        )
    )
    with check (
        budget_id in (
            select id from public.budgets
            where account_id in (
                select account_id from public.accounts_memberships
                where user_id = auth.uid()
                and account_role in ('owner', 'collaborator')
            )
        )
    );

-- End of budget_goals table


-- ============================================================
-- storage.buckets bucket for Plaid item institution logos
-- ============================================================
INSERT INTO storage.buckets (id, name) 
VALUES ('plaid_item_institution_logos', 'plaid_item_institution_logos')
ON CONFLICT (id) DO NOTHING;


-- Add triggers for automatic timestamp updates
CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.acct_fin_profile
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.plaid_connection_items
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.plaid_accounts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.fin_account_transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.budget_goals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();









