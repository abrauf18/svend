-- ============================================================
-- Create enums
-- ============================================================
create type marital_status_enum as enum ('Single', 'Married', 'Married with Kids', 'Other');
create type income_level_enum as enum ('Less than $25,000', '$25,000 - $50,000', '$50,000 - $75,000', '$75,000 - $100,000', 'More than $100,000');
create type savings_enum as enum ('Less than $1,000', '$1,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', 'More than $25,000');
create type debt_type_enum as enum ('Credit Cards', 'Student Loans', 'Personal Loans', 'Mortgage', 'Auto Loans', 'Business Loans', 'Other');
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

create type fin_profile_state_enum as enum ('florida', 'california');
create type budget_goal_debt_payment_component_enum as enum ('principal', 'interest', 'principal_interest');
create type budget_goal_type_enum as enum ('debt', 'savings', 'investment');


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
  primary_financial_goals financial_goal_enum[], 
  goal_timeline goal_timeline_enum,          
  monthly_contribution monthly_contribution_enum, 
  state fin_profile_state_enum,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp,
  constraint chk_account_is_personal check (not kit.check_team_account_by_id(account_id))
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
    using (account_id = auth.uid());

-- End of acct_fin_profile table

-- ============================================================
-- plaid_connection_items table
-- ============================================================

-- Create table
create table if not exists public.plaid_connection_items (
  id uuid primary key default uuid_generate_v4(),
  owner_account_id uuid references public.accounts(id) not null,
  constraint chk_account_is_personal check (not kit.check_team_account_by_id(owner_account_id)),
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
    using (owner_account_id = auth.uid()); -- connection owner can read

-- End of plaid_connection_items table

-- ============================================================
-- plaid_accounts table
-- ============================================================

-- Create table
create table if not exists public.plaid_accounts (
  id uuid primary key default uuid_generate_v4(),
  owner_account_id uuid references public.accounts(id) not null,
  constraint chk_account_is_personal check (not kit.check_team_account_by_id(owner_account_id)),
  plaid_conn_item_id uuid references public.plaid_connection_items(id) on delete cascade not null,
  plaid_account_id text not null,
  plaid_persistent_account_id text unique,
  name text not null,
  official_name text,
  type text not null,
  subtype text,
  balance_available numeric, -- NULL for loans
  balance_current numeric,
  iso_currency_code text default 'USD',
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

-- End of plaid_accounts table


-- ============================================================
-- manual_fin_accounts table
-- ============================================================

-- Create table
create table if not exists public.manual_fin_accounts (
  id uuid primary key default uuid_generate_v4(),
  owner_account_id uuid references public.accounts(id) not null,
  constraint chk_account_is_personal check (not kit.check_team_account_by_id(owner_account_id)),
  name text not null,
  official_name text,
  type text not null,
  subtype text,
  balance_available numeric, -- NULL for loans
  balance_current numeric,
  iso_currency_code text default 'USD',
  balance_limit numeric,
  mask text,
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Revoke all permissions
revoke all on public.manual_fin_accounts from public, service_role;

-- Grant necessary permissions
grant select on public.manual_fin_accounts to authenticated;
grant select, update, insert, delete on public.manual_fin_accounts to service_role;

-- Enable row level security
alter table manual_fin_accounts enable row level security;

-- End of manual_fin_accounts table


-- ============================================================
-- budget table
-- ============================================================

-- Create enums


create type budget_type as enum (
    'personal',
    'business'
);

-- Create table
create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  team_account_id uuid references public.accounts(id) not null unique, -- team account id (not user id)
  constraint chk_team_account check (kit.check_team_account_by_id(team_account_id)),
  budget_type budget_type not null default 'personal',
  category_spending jsonb not null default '{}',
  recommended_category_spending jsonb not null default '{}',
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
    using (public.is_team_member(team_account_id, auth.uid()));

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
    account_mask TEXT,
    notes TEXT,
    attachments_storage_names text[]
) AS $$
BEGIN
    -- Check if the user has permission to access this budget
    IF NOT EXISTS (
        SELECT 1
        FROM public.budgets b
        JOIN public.team_memberships am ON b.team_account_id = am.team_account_id
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
        fat.merchant_name,
        fat.payee,
        fat.amount,
        pa.name AS account,
        pa.mask AS account_mask,
        COALESCE(fat.notes, '') AS notes,
        fat.attachments_storage_names
    FROM 
        fin_account_transactions fat
    JOIN 
        plaid_accounts pa ON fat.plaid_account_id = pa.id
    JOIN 
        budget_fin_accounts bpa ON pa.id = bpa.plaid_account_id
    WHERE 
        bpa.budget_id = p_budget_id
    ORDER BY 
        date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION get_budget_transactions(UUID) TO authenticated;

-- End of budget table


-- ============================================================
-- category_groups table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.category_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE, -- if present, group is custom (not built-in) and belongs to a budget
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable row level security for categories
ALTER TABLE public.category_groups ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
CREATE POLICY read_category_groups
    ON public.category_groups
    FOR SELECT
    TO authenticated
    USING (
        budget_id IS NULL 
        OR
        EXISTS (
            SELECT 1 FROM public.budgets 
            WHERE id = budget_id 
            AND public.is_team_member(team_account_id, auth.uid())
        )
    );

-- Grant necessary permissions for categories
GRANT SELECT ON public.category_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_groups TO service_role;

-- End of category_groups table


-- ============================================================
-- categories table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    group_id UUID NOT NULL REFERENCES public.category_groups(id) ON DELETE CASCADE, -- parent group
    budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE, -- if present, category is custom (not built-in) and belongs to a budget
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a function to enforce the constraint
CREATE OR REPLACE FUNCTION check_category_budget_matches_group()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        (SELECT budget_id FROM public.category_groups WHERE id = NEW.group_id) IS NOT NULL AND
        NEW.budget_id IS NOT NULL AND
        NEW.budget_id <> (SELECT budget_id FROM public.category_groups WHERE id = NEW.group_id)
    ) THEN
        RAISE EXCEPTION 'Budget ID does not match the group''s budget ID';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to use the function
CREATE TRIGGER check_category_budget_matches_group_trigger
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION check_category_budget_matches_group();


-- Enable row level security for categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
CREATE POLICY read_categories
    ON public.categories
    FOR SELECT
    TO authenticated
    USING (
        budget_id IS NULL 
        OR
        EXISTS (
            SELECT 1 FROM public.budgets 
            WHERE id = budget_id 
            AND public.is_team_member(team_account_id, auth.uid())
        )
    );

-- Grant necessary permissions for categories
GRANT SELECT ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO service_role;

-- End of categories table


-- ============================================================
-- built_in_categories view
-- ============================================================
CREATE OR REPLACE VIEW public.built_in_categories AS
SELECT 
    c.id AS category_id,  -- Select category ID
    c.name AS category_name,  -- Select category name
    c.description AS category_description,  -- Select category description
    c.created_at AS category_created_at,  -- Select category creation timestamp
    c.updated_at AS category_updated_at,  -- Select category update timestamp
    cg.id AS group_id,  -- Select group ID
    cg.name AS group_name,  -- Select group name
    cg.description AS group_description,  -- Select group description
    cg.is_enabled AS group_is_enabled,  -- Select group enabled status
    cg.created_at AS group_created_at,  -- Select group creation timestamp
    cg.updated_at AS group_updated_at  -- Select group update timestamp
FROM 
    public.categories c
JOIN 
    public.category_groups cg ON c.group_id = cg.id
WHERE 
    cg.budget_id IS NULL;

-- Grant select permission on the view
GRANT SELECT ON public.built_in_categories TO authenticated;


-- ============================================================
-- get_budget_categories function
-- ============================================================
CREATE OR REPLACE FUNCTION get_budget_categories(p_budget_id UUID)
RETURNS TABLE (
    category_id UUID,
    category_name VARCHAR(255),
    category_description TEXT,
    budget_id UUID,
    category_created_at TIMESTAMP,
    category_updated_at TIMESTAMP,
    group_id UUID,
    group_name VARCHAR(255),
    group_description TEXT,
    group_is_enabled BOOLEAN,
    group_budget_id UUID,
    group_created_at TIMESTAMP,
    group_updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id AS category_id,
        c.name AS category_name,
        c.description AS category_description,
        c.budget_id,
        c.created_at AS category_created_at,
        c.updated_at AS category_updated_at,
        cg.id AS group_id,
        cg.name AS group_name,
        cg.description AS group_description,
        cg.is_enabled AS group_is_enable,
        cg.budget_id AS group_budget_id,
        cg.created_at AS group_created_at,
        cg.updated_at AS group_updated_at
    FROM 
        public.categories c
    JOIN 
        public.category_groups cg ON c.group_id = cg.id
    WHERE 
        c.budget_id IS NULL OR c.budget_id = p_budget_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_budget_categories(UUID) TO authenticated, service_role;


-- ============================================================
-- budget_fin_accounts table
-- ============================================================

-- Create table
create table if not exists public.budget_fin_accounts (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid references public.budgets(id) on delete cascade,
  plaid_account_id uuid references public.plaid_accounts(id) on delete cascade,
  manual_account_id uuid references public.manual_fin_accounts(id) on delete cascade,
  unique (budget_id, plaid_account_id),
  unique (budget_id, manual_account_id)
);

-- Revoke all permissions
revoke all on public.budget_fin_accounts from public, service_role;

-- Grant necessary permissions
grant select on public.budget_fin_accounts to authenticated;
grant select, insert, update, delete on public.budget_fin_accounts to service_role;

-- Enable row level security
alter table budget_fin_accounts enable row level security;

-- Create policies
create policy read_budget_fin_accounts
    on public.budget_fin_accounts
    for select
    to authenticated
    using (
        EXISTS (
            SELECT 1 FROM public.budgets 
            WHERE id = budget_id 
            AND public.is_team_member(team_account_id, auth.uid())
        )
    );

-- Create policies from plaid_accounts table
create policy read_plaid_accounts
    on public.plaid_accounts
    for select
    to authenticated
    using (
        owner_account_id = auth.uid() -- account owner can read
        or exists (
            select 1
            from public.budget_fin_accounts bfa
            join public.budgets b on bfa.budget_id = b.id
            where bfa.plaid_account_id = plaid_accounts.id
            and public.is_team_member(b.team_account_id, auth.uid())
        ) -- budget member can read
    );

-- Create policies from manual_fin_accounts table
create policy read_manual_fin_accounts
    on public.manual_fin_accounts
    for select
    to authenticated
    using (
        owner_account_id = auth.uid() -- account owner can read
        or exists (
            select 1
            from public.budget_fin_accounts bfa
            join public.budgets b on bfa.budget_id = b.id
            where bfa.manual_account_id = manual_fin_accounts.id
            and public.is_team_member(b.team_account_id, auth.uid())
        ) -- budget member can read
    );

-- End of budget_fin_accounts table


-- ============================================================
-- fin_account_transactions table
-- ============================================================

-- Create table
create table if not exists public.fin_account_transactions (
  id uuid primary key default uuid_generate_v4(),
  plaid_account_id uuid references public.plaid_accounts(id) on delete cascade, -- will be null if account was manually added
  manual_account_id uuid references public.manual_fin_accounts(id) on delete cascade, -- will be null if account is from Plaid
  amount numeric not null,
  iso_currency_code text default 'USD',
  category_primary text,
  category_detailed text,
  category_confidence text,
  svend_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE SET NULL, -- Optional reference to categories
  date date not null,
  merchant_name text,
  payee text,
  notes text,
  attachments_storage_names text[], 
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

-- Enable row level security
alter table fin_account_transactions enable row level security;

-- Create policies
create policy read_budget_fin_account_transactions
    on public.fin_account_transactions
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.budget_fin_accounts bfa
            join public.budgets b on bfa.budget_id = b.id
            where (bfa.plaid_account_id = fin_account_transactions.plaid_account_id and bfa.plaid_account_id is not null)
                or (bfa.manual_account_id = fin_account_transactions.manual_account_id and bfa.manual_account_id is not null)
                and public.is_team_member(b.team_account_id, auth.uid())
        ) -- budget member can read
    );

create policy read_owned_fin_account_transactions
    on public.fin_account_transactions
    for select
    to authenticated
    using (
        (plaid_account_id is not null and exists (
            select 1 
            from public.plaid_accounts
            where id = fin_account_transactions.plaid_account_id
            and owner_account_id = auth.uid()
        ))
        or 
        (manual_account_id is not null and exists (
            select 1 
            from public.manual_fin_accounts
            where id = fin_account_transactions.manual_account_id
            and owner_account_id = auth.uid()
        ))
    );

CREATE OR REPLACE FUNCTION can_update_fin_account_transaction(transaction_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        -- Check if user has write access to the budget for this transaction
        SELECT 1
        FROM public.fin_account_transactions fat
        JOIN public.budget_fin_accounts bfa ON 
            (bfa.plaid_account_id = fat.plaid_account_id AND fat.plaid_account_id IS NOT NULL) OR
            (bfa.manual_account_id = fat.manual_account_id AND fat.manual_account_id IS NOT NULL)
        JOIN public.budgets b ON bfa.budget_id = b.id
        WHERE fat.id = transaction_id
        AND public.has_team_permission(user_id, b.team_account_id, 'budgets.write')
    )
    OR EXISTS (
        -- Check if user owns the account for this transaction
        SELECT 1
        FROM public.fin_account_transactions fat
        WHERE fat.id = transaction_id
        AND (
            (fat.plaid_account_id IS NOT NULL AND EXISTS (
                SELECT 1 
                FROM public.plaid_accounts
                WHERE id = fat.plaid_account_id
                AND owner_account_id = user_id
            ))
            OR 
            (fat.manual_account_id IS NOT NULL AND EXISTS (
                SELECT 1 
                FROM public.manual_fin_accounts
                WHERE id = fat.manual_account_id
                AND owner_account_id = user_id
            ))
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION can_update_fin_account_transaction TO service_role;


-- Save fin account transaction function
CREATE OR REPLACE FUNCTION save_fin_account_transaction(
    transaction_id UUID, 
    new_category TEXT, 
    p_merchant_name TEXT, 
    p_notes TEXT, 
    category_id UUID, 
    attachments TEXT[]
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE fin_account_transactions
    SET 
        category_detailed = new_category,
        svend_category_id = category_id,
        merchant_name = p_merchant_name,
        notes = p_notes,
        attachments_storage_names = attachments
    WHERE id = transaction_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- Grant necessary permissions
grant select on public.fin_account_transactions to authenticated;
grant select, update, insert on public.fin_account_transactions to service_role;


-- Storage bucket for fin account transaction attachments
insert into storage.buckets (id, name, public)
values ('fin_account_transaction_attachments', 'fin_account_transaction_attachments', true)
on conflict (id) do update 
set 
    name = excluded.name,
    public = excluded.public;

-- Storage bucket policies for fin_account_transaction_attachments
create policy download_fin_account_transaction_attachments
on storage.objects for select
using (
    bucket_id = 'fin_account_transaction_attachments'
    and (
        -- Extract transaction ID from the file path (everything before the first slash)
        exists (
            select 1
            from public.fin_account_transactions fat
            where substring(storage.objects.name from '^[^/]+') = fat.id::text
            and (
                -- Budget member can read (with budget.read permission)
                exists (
                    select 1
                    from public.budget_fin_accounts bfa
                    join public.budgets b on bfa.budget_id = b.id
                    where (bfa.plaid_account_id = fat.plaid_account_id and bfa.plaid_account_id is not null)
                        or (bfa.manual_account_id = fat.manual_account_id and bfa.manual_account_id is not null)
                    and public.is_team_member(b.team_account_id, auth.uid())
                )
                -- Account owner can read
                or (
                    (fat.plaid_account_id is not null and exists (
                        select 1 
                        from public.plaid_accounts
                        where id = fat.plaid_account_id
                        and owner_account_id = auth.uid()
                    ))
                    or 
                    (fat.manual_account_id is not null and exists (
                        select 1 
                        from public.manual_fin_accounts
                        where id = fat.manual_account_id
                        and owner_account_id = auth.uid()
                    ))
                )
            )
        )
    )
);

create policy upload_fin_account_transaction_attachments
on storage.objects for insert
with check (
    bucket_id = 'fin_account_transaction_attachments'
    and (
        -- Extract transaction ID from the file path (everything before the first slash)
        exists (
            select 1
            from public.fin_account_transactions fat
            where substring(storage.objects.name from '^[^/]+') = fat.id::text
            and exists (
                -- User must have budget.write permission
                select 1
                from public.budget_fin_accounts bfa
                join public.budgets b on bfa.budget_id = b.id
                where (bfa.plaid_account_id = fat.plaid_account_id and bfa.plaid_account_id is not null)
                    or (bfa.manual_account_id = fat.manual_account_id and bfa.manual_account_id is not null)
                and public.has_team_permission(auth.uid(), b.team_account_id, 'budgets.write')
            )
        )
    )
);

create policy delete_fin_account_transaction_attachments
on storage.objects for delete
using (
    bucket_id = 'fin_account_transaction_attachments'
    and (
        -- Extract transaction ID from the file path (everything before the first slash)
        exists (
            select 1
            from public.fin_account_transactions fat
            where substring(storage.objects.name from '^[^/]+') = fat.id::text
            and exists (
                -- User must have budget.write permission
                select 1
                from public.budget_fin_accounts bfa
                join public.budgets b on bfa.budget_id = b.id
                where (bfa.plaid_account_id = fat.plaid_account_id and bfa.plaid_account_id is not null)
                    or (bfa.manual_account_id = fat.manual_account_id and bfa.manual_account_id is not null)
                and public.has_team_permission(auth.uid(), b.team_account_id, 'budgets.write')
            )
        )
    )
);

-- End of fin_account_transactions table


CREATE TYPE budget_plaid_account_result AS (
    plaid_account_id UUID,
    budget_fin_account_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE OR REPLACE FUNCTION add_budget_plaid_account(
    p_budget_id UUID,
    p_plaid_conn_item_id UUID,
    p_plaid_account_id TEXT,
    p_account_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_balance_available NUMERIC = NULL,
    p_balance_current NUMERIC = NULL,
    p_balance_limit NUMERIC = NULL,
    p_iso_currency_code TEXT = NULL,
    p_mask TEXT = NULL,
    p_official_name TEXT = NULL,
    p_plaid_persistent_account_id TEXT = NULL,
    p_subtype TEXT = NULL
)
RETURNS budget_plaid_account_result AS $$
DECLARE
    v_plaid_account_id UUID;
    v_created_at TIMESTAMP WITH TIME ZONE;
    v_updated_at TIMESTAMP WITH TIME ZONE;
    v_budget_fin_account_id UUID;
BEGIN
    RAISE NOTICE 'Starting function with budget_id: %, plaid_account_id: %', p_budget_id, p_plaid_account_id;

    -- Insert into plaid_accounts
    INSERT INTO plaid_accounts (
        plaid_conn_item_id,
        plaid_account_id,
        owner_account_id,
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
    RETURNING id, created_at, updated_at INTO v_plaid_account_id, v_created_at, v_updated_at;
    
    RAISE NOTICE 'Inserted new plaid account with id: %', v_plaid_account_id;

    -- Insert into budget_fin_accounts for the plaid account
    INSERT INTO budget_fin_accounts (budget_id, plaid_account_id, manual_account_id)
    VALUES (p_budget_id, v_plaid_account_id, NULL)
    RETURNING id INTO v_budget_fin_account_id;
    
    RAISE NOTICE 'Inserted new budget fin account association with id: %', v_budget_fin_account_id;

    -- Return the plaid_account_id, budget_fin_account_id, and timestamps as a record
    RETURN (v_plaid_account_id, v_budget_fin_account_id, v_created_at, v_updated_at);

EXCEPTION 
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Unique violation occurred: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'An error occurred: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION add_budget_plaid_account TO service_role;

-- ============================================================
-- budget_goals table
-- ============================================================

-- Create table
create table if not exists public.budget_goals (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  type budget_goal_type_enum not null,
  tracking jsonb not null default '{}',

  name text not null,
  amount numeric not null,
  fin_account_id uuid not null references public.budget_fin_accounts(id),
  target_date date not null,
  description text,

  -- Debt goal specific fields
  debt_type debt_type_enum check (NOT (type = 'debt' AND debt_type IS NULL)),
  debt_payment_component budget_goal_debt_payment_component_enum check (NOT (type = 'debt' AND debt_payment_component IS NULL)),
  debt_interest_rate decimal(5, 2) check (NOT (type = 'debt' AND debt_interest_rate IS NULL)),

  created_at timestamp with time zone not null default current_timestamp,
  updated_at timestamp with time zone not null default current_timestamp
);
-- Revoke all permissions
revoke all on public.budget_goals from public, service_role;

-- Grant necessary permissions
grant select on public.budget_goals to authenticated;
grant select, update, insert, delete on public.budget_goals to service_role;

-- Enable row level security
alter table budget_goals enable row level security;

-- Create policies
create policy read_budget_goals
    on public.budget_goals
    for select
    to authenticated
    using (
        EXISTS (
            SELECT 1 FROM public.budgets 
            WHERE id = budget_id 
            and public.is_team_member(team_account_id, auth.uid())
        ) -- budget member can read
    );

-- End of budget_goals table


-- ============================================================
-- Populate initial data
-- ============================================================

-- Create built-in category groups
INSERT INTO public.category_groups (name, description) VALUES
    ('Income', 'Income from various sources'),
    ('Savings & Transfers', 'Savings and money transfers'),
    ('Debt Payments', 'Debt and loan payments'),
    ('Bank Fees', 'Bank and financial institution fees'),
    ('Entertainment', 'Entertainment and recreation expenses'),
    ('Food & Drink', 'Food, dining and groceries'),
    ('Retail & Goods', 'Shopping and retail purchases'),
    ('Home Improvement', 'Home maintenance and improvements'),
    ('Medical', 'Healthcare and medical expenses'),
    ('Personal Care', 'Personal care and services'),
    ('General Services', 'Various professional services'),
    ('Government & Non-Profit', 'Government and charitable expenses'),
    ('Transport & Travel', 'Transportation and travel costs'),
    ('Rent & Utilities', 'Housing rent and utility bills');

-- Create built-in 'other' category which is a catch-all for any unknown categories
INSERT INTO public.category_groups (name, description, is_enabled) VALUES
    ('Other', 'Other catch-all category', FALSE);

-- Create built-in categories
INSERT INTO public.categories (name, description, group_id) VALUES
    -- Income Categories
    ('Income', 'Income from various sources', (SELECT id FROM public.category_groups WHERE name = 'Income')),

    -- Savings & Transfers Categories
    ('Inbound Transfer', 'Loans and cash advances deposited into a bank account', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Investment Income', 'Inbound transfers to an investment or retirement account', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Account Transfer', 'General inbound transfers from another account', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Other Inbound', 'Other miscellaneous inbound transactions', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Investment Transfer', 'Transfers to an investment or retirement account, including investment apps such as Acorns, Betterment', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Outbound Transfer', 'Outbound transfers to savings accounts', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Withdrawal', 'Withdrawals from a bank account', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),
    ('Other Outbound', 'Other miscellaneous outbound transactions', (SELECT id FROM public.category_groups WHERE name = 'Savings & Transfers')),

    -- Debt Payments Categories
    ('Debt Payments', 'Payments on mortgages', (SELECT id FROM public.category_groups WHERE name = 'Debt Payments')),

    -- Bank Fees Categories
    ('Bank Fees', 'Fees incurred for out-of-network ATMs', (SELECT id FROM public.category_groups WHERE name = 'Bank Fees')),

    -- Entertainment Categories
    ('Gambling', 'Gambling, casinos, and sports betting', (SELECT id FROM public.category_groups WHERE name = 'Entertainment')),
    ('Music & Audio', 'Digital and in-person music purchases, including music streaming services', (SELECT id FROM public.category_groups WHERE name = 'Entertainment')),
    ('Events & Amusement', 'Purchases made at sporting events, music venues, concerts, museums, and amusement parks', (SELECT id FROM public.category_groups WHERE name = 'Entertainment')),
    ('TV & Movies', 'In home movie streaming services and movie theaters', (SELECT id FROM public.category_groups WHERE name = 'Entertainment')),
    ('Video Games', 'Digital and in-person video game purchases', (SELECT id FROM public.category_groups WHERE name = 'Entertainment')),
    ('Other Entertainment', 'Other miscellaneous entertainment purchases, including night life and adult entertainment', (SELECT id FROM public.category_groups WHERE name = 'Entertainment')),

    -- Food & Drink Categories
    ('Alcohol', 'Beer, Wine & Liquor Stores', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),
    ('Coffee', 'Purchases at coffee shops or cafes', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),
    ('Fast Food', 'Dining expenses for fast food chains', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),
    ('Groceries', 'Purchases for fresh produce and groceries, including farmers'' markets', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),
    ('Dining Out', 'Dining expenses for restaurants, bars, gastropubs, and diners', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),
    ('Vending Machines', 'Purchases made at vending machine operators', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),
    ('Other Food & Drink', 'Other miscellaneous food and drink, including desserts, juice bars, and delis', (SELECT id FROM public.category_groups WHERE name = 'Food & Drink')),

    -- Retail & Goods Categories
    ('Shopping', 'Retail stores with wide ranges of consumer goods, typically specializing in clothing and home goods', (SELECT id FROM public.category_groups WHERE name = 'Retail & Goods')),
    ('Online Marketplaces', 'Multi-purpose e-commerce platforms such as Etsy, Ebay and Amazon', (SELECT id FROM public.category_groups WHERE name = 'Retail & Goods')),
    ('Superstores', 'Superstores such as Target and Walmart, selling both groceries and general merchandise', (SELECT id FROM public.category_groups WHERE name = 'Retail & Goods')),

    -- Home Improvement Categories
    ('Furniture', 'Furniture, bedding, and home accessories', (SELECT id FROM public.category_groups WHERE name = 'Home Improvement')),
    ('Hardware', 'Building materials, hardware stores, paint, and wallpaper', (SELECT id FROM public.category_groups WHERE name = 'Home Improvement')),
    ('Repair & Maintenance', 'Plumbing, lighting, gardening, and roofing', (SELECT id FROM public.category_groups WHERE name = 'Home Improvement')),
    ('Security', 'Home security system purchases', (SELECT id FROM public.category_groups WHERE name = 'Home Improvement')),
    ('Other Home Improvement', 'Other miscellaneous home purchases, including pool installation and pest control', (SELECT id FROM public.category_groups WHERE name = 'Home Improvement')),

    -- Medical Categories
    ('Dental Care', 'Dentists and general dental care', (SELECT id FROM public.category_groups WHERE name = 'Medical')),
    ('Eye Care', 'Optometrists, contacts, and glasses stores', (SELECT id FROM public.category_groups WHERE name = 'Medical')),
    ('Nursing Care', 'Nursing care and facilities', (SELECT id FROM public.category_groups WHERE name = 'Medical')),
    ('Pharmacies & Supplements', 'Pharmacies and nutrition shops', (SELECT id FROM public.category_groups WHERE name = 'Medical')),
    ('Primary Care', 'Doctors and physicians', (SELECT id FROM public.category_groups WHERE name = 'Medical')),
    ('Veterinary Services', 'Prevention and care procedures for animals', (SELECT id FROM public.category_groups WHERE name = 'Medical')),
    ('Other Medical', 'Other miscellaneous medical, including blood work, hospitals, and ambulances', (SELECT id FROM public.category_groups WHERE name = 'Medical')),

    -- Personal Care Categories
    ('Gyms & Fitness', 'Gyms, fitness centers, and workout classes', (SELECT id FROM public.category_groups WHERE name = 'Personal Care')),
    ('Hair & Beauty', 'Manicures, haircuts, waxing, spa/massages, and bath and beauty products', (SELECT id FROM public.category_groups WHERE name = 'Personal Care')),
    ('Laundry & Dry Cleaning', 'Wash and fold, and dry cleaning expenses', (SELECT id FROM public.category_groups WHERE name = 'Personal Care')),
    ('Other Personal Care', 'Other miscellaneous personal care, including mental health apps and services', (SELECT id FROM public.category_groups WHERE name = 'Personal Care')),

    -- General Services Categories
    ('Financial Planning', 'Financial planning, and tax and accounting services', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Automotive', 'Oil changes, car washes, repairs, and towing', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Childcare', 'Babysitters and daycare', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Consulting & Legal', 'Consulting and legal services', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Education', 'Elementary, high school, professional schools, and college tuition', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Insurance', 'Insurance for auto, home, and healthcare', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Postage & Shipping', 'Mail, packaging, and shipping services', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Storage', 'Storage services and facilities', (SELECT id FROM public.category_groups WHERE name = 'General Services')),
    ('Other Services', 'Other miscellaneous services, including advertising and cloud storage', (SELECT id FROM public.category_groups WHERE name = 'General Services')),

    -- Government & Non-Profit Categories
    ('Donations', 'Charitable, political, and religious donations', (SELECT id FROM public.category_groups WHERE name = 'Government & Non-Profit')),
    ('Government Services', 'Government departments and agencies, such as driving licences, and passport renewal', (SELECT id FROM public.category_groups WHERE name = 'Government & Non-Profit')),
    ('Tax Payment', 'Tax payments, including income and property taxes', (SELECT id FROM public.category_groups WHERE name = 'Government & Non-Profit')),
    ('Other Government & Non-Profit', 'Other miscellaneous government and non-profit agencies', (SELECT id FROM public.category_groups WHERE name = 'Government & Non-Profit')),

    -- Transport & Travel Categories
    ('Bikes & Scooters', 'Bike and scooter rentals', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),
    ('Transportation', 'Purchases at a gas station', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),
    ('Other Transportation', 'Other miscellaneous transportation expenses', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),
    ('Flights', 'Airline expenses', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),
    ('Lodging', 'Hotels, motels, and hosted accommodation such as Airbnb', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),
    ('Rental Cars', 'Rental cars, charter buses, and trucks', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),
    ('Other Travel', 'Other miscellaneous travel expenses', (SELECT id FROM public.category_groups WHERE name = 'Transport & Travel')),

    -- Rent & Utilities Categories
    ('Gas & Electricity', 'Gas and electricity bills', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),
    ('Internet & Cable', 'Internet and cable bills', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),
    ('Rent', 'Rent payment', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),
    ('Sewage & Waste', 'Sewage and garbage disposal bills', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),
    ('Telephone', 'Cell phone bills', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),
    ('Water', 'Water bills', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),
    ('Other Utilities', 'Other miscellaneous utility bills', (SELECT id FROM public.category_groups WHERE name = 'Rent & Utilities')),

    -- Other Categories
    ('Other', 'Other catch-all category', (SELECT id FROM public.category_groups WHERE name = 'Other'));

-- End of populate initial data


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
