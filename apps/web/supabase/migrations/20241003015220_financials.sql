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


-- Function "public.has_budget_permission"
-- Create a function to check if a user has a permission
create or replace function public.has_budget_permission(
    user_id uuid,
    budget_id uuid,
    permission_name public.app_permissions
) returns boolean as $$
begin
    return exists(
        select 1
        from public.team_memberships tm
            join public.role_permissions rp on tm.team_role = rp.role
            join public.budgets b on b.team_account_id = tm.team_account_id
        where tm.user_id = has_budget_permission.user_id
        and b.id = has_budget_permission.budget_id
        and rp.permission = has_budget_permission.permission_name
    );
end;
$$ language plpgsql;

grant execute on function public.has_budget_permission(uuid, uuid, public.app_permissions) to authenticated, service_role;


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
-- Update account profile function
-- ============================================================
create or replace function update_account_profile(
    p_user_id uuid,
    p_full_name text,
    p_age int,
    p_marital_status marital_status_enum,
    p_dependents int
) returns void as $$
begin
    -- Update the financial profile
    update acct_fin_profile
    set 
        full_name = p_full_name,
        age = p_age,
        marital_status = p_marital_status,
        dependents = p_dependents
    where account_id = p_user_id;

    -- Update the account name
    update accounts
    set name = p_full_name
    where primary_owner_user_id = p_user_id and is_personal_account;
end;
$$ language plpgsql;

grant execute on function update_account_profile(uuid, text, int, marital_status_enum, int) to service_role;

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

-- ============================================================
-- Validate institution logo storage name function
-- ============================================================
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

create type budget_onboarding_step_enum as enum (
    'start',
    'plaid',
    'profile_goals',
    'analyze_spending',
    'analyze_spending_in_progress',
    'budget_setup',
    'invite_members',
    'end'
);

-- Create table
create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  team_account_id uuid references public.accounts(id) not null unique, -- team account id (not user id)
  constraint chk_team_account check (kit.check_team_account_by_id(team_account_id)),
  budget_type budget_type not null default 'personal',
  spending_recommendations jsonb not null default '{}',
  spending_tracking jsonb not null default '{}',
  is_active boolean not null default true,
  start_date date not null default current_date,
  end_date date,
  current_onboarding_step budget_onboarding_step_enum not null default 'start',
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

-- ============================================================
-- Get budget by team account slug function
-- ============================================================
CREATE OR REPLACE FUNCTION get_budget_by_team_account_slug(p_team_account_slug TEXT)
RETURNS TABLE (
    id UUID,
    team_account_id UUID,
    budget_type TEXT,
    spending_tracking JSONB,
    spending_recommendations JSONB,
    is_active BOOLEAN,
    start_date DATE,
    end_date DATE,
    current_onboarding_step budget_onboarding_step_enum,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    linked_accounts JSONB,  -- JSON array of FinAccount objects
    goals JSONB  -- JSON array of BudgetGoal objects
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.team_account_id,
        b.budget_type::TEXT,
        b.spending_tracking,
        b.spending_recommendations,
        b.is_active,
        b.start_date,
        b.end_date,
        b.current_onboarding_step,
        b.created_at,
        b.updated_at,
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', COALESCE(pa.id, ma.id),
                        'source', CASE 
                            WHEN pa.id IS NOT NULL THEN 'plaid'::text 
                            ELSE 'svend'::text 
                        END,
                        'budgetFinAccountId', bfa.id,
                        'name', COALESCE(pa.name, ma.name),
                        'mask', COALESCE(pa.mask, ma.mask),
                        'officialName', COALESCE(pa.name, ma.name),
                        'balance', COALESCE(pa.balance_current, ma.balance_current)
                    )
                ),
                '[]'::jsonb
            )
            FROM budget_fin_accounts bfa
            LEFT JOIN plaid_accounts pa ON bfa.plaid_account_id = pa.id
            LEFT JOIN manual_fin_accounts ma ON bfa.manual_account_id = ma.id
            WHERE bfa.budget_id = b.id
        ) as linked_accounts,
        (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', bg.id,
                        'createdAt', bg.created_at,
                        'budgetId', bg.budget_id,
                        'type', bg.type,
                        'name', bg.name,
                        'amount', bg.amount,
                        'budgetFinAccountId', bg.fin_account_id,
                        'targetDate', bg.target_date,
                        'spendingTracking', bg.spending_tracking,
                        'spendingRecommendations', bg.spending_recommendations,
                        'debtInterestRate', bg.debt_interest_rate,
                        'debtPaymentComponent', bg.debt_payment_component,
                        'debtType', bg.debt_type,
                        'description', bg.description
                    )
                ),
                '[]'::jsonb
            )
            FROM budget_goals bg
            WHERE bg.budget_id = b.id
        ) as goals
    FROM budgets b
    JOIN public.accounts a ON b.team_account_id = a.id
    WHERE a.slug = p_team_account_slug
    AND a.is_personal_account = false;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION get_budget_by_team_account_slug(TEXT) TO authenticated;


-- ============================================================
-- Get budget transactions by team account slug function
-- ============================================================
CREATE OR REPLACE FUNCTION get_budget_transactions_by_team_account_slug(p_team_account_slug TEXT)
RETURNS TABLE (
    id UUID,
    date DATE,
    amount NUMERIC,
    iso_currency_code TEXT,
    svend_category_group_id UUID,
    svend_category_group TEXT,
    svend_category_id UUID,
    svend_category TEXT,
    merchant_name TEXT,
    payee TEXT,
    notes TEXT,
    budget_fin_account_id UUID,
    tags jsonb,
    attachments_storage_names text[]
) AS $$
DECLARE
    v_budget_id UUID;
BEGIN
    -- Get the budget ID from the team account slug
    SELECT b.id INTO v_budget_id
    FROM budgets b
    JOIN accounts a ON b.team_account_id = a.id
    WHERE a.slug = p_team_account_slug
    AND a.is_personal_account = false;

    -- Return transactions using the other function
    RETURN QUERY
    SELECT * FROM get_budget_transactions_within_range_by_budget_id(v_budget_id, NULL, NULL);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION get_budget_transactions_by_team_account_slug(TEXT) TO authenticated;


-- ============================================================
-- Get budget transactions within range by budget id function
-- ============================================================
CREATE OR REPLACE FUNCTION get_budget_transactions_within_range_by_budget_id(p_budget_id UUID, p_start_date TEXT, p_end_date TEXT)
RETURNS TABLE (
    id UUID,
    date DATE,
    amount NUMERIC,
    iso_currency_code TEXT,
    svend_category_group_id UUID,
    svend_category_group TEXT,
    svend_category_id UUID,
    svend_category TEXT,
    merchant_name TEXT,
    payee TEXT,
    notes TEXT,
    budget_fin_account_id UUID,
    tags jsonb,
    attachments_storage_names text[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fat.id,
        fat.date,
        fat.amount,
        fat.iso_currency_code::TEXT,
        cg.id AS svend_category_group_id,
        cg.name::TEXT AS svend_category_group,
        c.id AS svend_category_id,
        c.name::TEXT AS svend_category,
        bfat.merchant_name,
        bfat.payee,
        bfat.notes,
        bfa.id AS budget_fin_account_id,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', bt.id,
                        'name', bt.name
                    )
                )
                FROM budget_tags bt
                WHERE bt.id = ANY(bfat.tag_ids)
            ),
            '[]'::jsonb
        ) AS tags,
        COALESCE(
            ARRAY(
                SELECT name 
                FROM storage.objects 
                WHERE bucket_id = 'budget_transaction_attachments'
                AND (storage.foldername(name))[1] = 'budget'
                AND (storage.foldername(name))[2] = b.id::text
                AND (storage.foldername(name))[3] = 'transaction'
                AND (storage.foldername(name))[4] = fat.id::text
            ),
            ARRAY[]::text[]
        ) as attachments_storage_names
    FROM 
        fin_account_transactions fat
    JOIN 
        budget_fin_accounts bfa ON 
            (bfa.plaid_account_id = fat.plaid_account_id AND fat.plaid_account_id IS NOT NULL) OR 
            (bfa.manual_account_id = fat.manual_account_id AND fat.manual_account_id IS NOT NULL)
    JOIN 
        budgets b ON bfa.budget_id = b.id
    JOIN
        accounts a ON b.team_account_id = a.id
    LEFT JOIN
        budget_fin_account_transactions bfat ON fat.id = bfat.fin_account_transaction_id AND b.id = bfat.budget_id
    JOIN 
        categories c ON bfat.svend_category_id = c.id
    JOIN 
        category_groups cg ON c.group_id = cg.id
    WHERE 
        b.id = p_budget_id
        AND (p_start_date IS NULL OR fat.date >= p_start_date::date)
        AND (p_end_date IS NULL OR fat.date < p_end_date::date)
    GROUP BY
        b.id,
        fat.id,
        fat.date,
        fat.amount,
        fat.iso_currency_code,
        bfat.merchant_name,
        bfat.payee,
        bfat.notes,
        bfa.id,
        cg.id,
        cg.name,
        c.id,
        bfat.svend_category_id,
        c.name,
        bfat.tag_ids
    ORDER BY 
        fat.date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION get_budget_transactions_within_range_by_budget_id(UUID, TEXT, TEXT) TO authenticated;

-- End of budget table


-- ============================================================
-- category_groups table
-- ============================================================

-- Create the table without the check constraint
CREATE TABLE IF NOT EXISTS public.category_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (budget_id, name)
);

-- Create a function to check for built-in name reuse
CREATE OR REPLACE FUNCTION check_category_group_name_reuse()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.category_groups 
        WHERE name = NEW.name 
        AND budget_id IS NULL 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Cannot reuse a built-in category group name';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that uses the function
CREATE TRIGGER enforce_no_builtin_name_reuse
    BEFORE INSERT OR UPDATE ON public.category_groups
    FOR EACH ROW
    EXECUTE FUNCTION check_category_group_name_reuse();

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
    name VARCHAR(50) NOT NULL,
    description TEXT,
    group_id UUID NOT NULL REFERENCES public.category_groups(id) ON DELETE CASCADE,
    budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (budget_id, name)
);

-- Create a function to check for built-in name reuse
CREATE OR REPLACE FUNCTION check_category_name_reuse()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.categories 
        WHERE name = NEW.name 
        AND budget_id IS NULL 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Cannot reuse a built-in category name';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that uses the function
CREATE TRIGGER enforce_no_builtin_name_reuse
    BEFORE INSERT OR UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION check_category_name_reuse();


-- Create function to validate category group budget match
CREATE OR REPLACE FUNCTION validate_category_group_budget_match()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.category_groups
        WHERE id = NEW.group_id
        AND COALESCE(budget_id IS NOT NULL, false) != COALESCE(NEW.budget_id IS NOT NULL, false)
    ) THEN
        RAISE EXCEPTION 'Category budget_id must match its group''s budget_id status';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce the validation
CREATE TRIGGER enforce_category_group_budget_match
    BEFORE INSERT OR UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION validate_category_group_budget_match();


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
-- create_budget_category_group function
-- ============================================================
CREATE OR REPLACE FUNCTION create_budget_category_group(
    p_budget_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    name VARCHAR(50),
    description TEXT,
    budget_id UUID,
    is_enabled BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
DECLARE
    v_new_group category_groups;
    v_current_month TEXT;
    v_spending_tracking JSONB;
    v_empty_group_tracking JSONB;
BEGIN
    -- Check if name already exists for this budget
    IF EXISTS (
        SELECT 1 FROM category_groups cg  
        WHERE cg.budget_id = p_budget_id  
        AND LOWER(cg.name) = LOWER(p_name)
    ) THEN
        RAISE EXCEPTION '409:category group with name "%" already exists for this budget', p_name;
    END IF;

    -- Insert the new category group
    INSERT INTO category_groups (
        name,
        description,
        budget_id
    ) 
    VALUES (
        p_name,
        p_description,
        p_budget_id
    )
    RETURNING * INTO v_new_group;

    -- Get current month in 'yyyy-MM' format
    v_current_month := to_char(CURRENT_DATE, 'YYYY-MM');

    -- Create empty group tracking structure
    v_empty_group_tracking := jsonb_build_object(
        'groupName', p_name,
        'groupId', v_new_group.id,
        'targetSource', 'group',
        'spendingActual', 0,
        'spendingTarget', 0,
        'isTaxDeductible', false,
        'categories', jsonb_build_array()
    );

    -- Update the budget's spending_tracking
    UPDATE budgets b
    SET spending_tracking = CASE
        -- If the current month exists, add the new group to it
        WHEN b.spending_tracking ? v_current_month THEN
            jsonb_set(
                b.spending_tracking,
                ARRAY[v_current_month, p_name],
                v_empty_group_tracking
            )
        -- If the current month doesn't exist, create it with the new group
        ELSE
            jsonb_set(
                COALESCE(b.spending_tracking, '{}'::jsonb),
                ARRAY[v_current_month],
                jsonb_build_object(p_name, v_empty_group_tracking)
            )
    END
    WHERE b.id = p_budget_id;

    RETURN QUERY
    VALUES (
      v_new_group.id,
      v_new_group.name,
      v_new_group.description,
      v_new_group.budget_id,
      v_new_group.is_enabled,
      v_new_group.created_at,
      v_new_group.updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- get_budget_categories function
-- ============================================================
CREATE OR REPLACE FUNCTION get_budget_categories(p_budget_id UUID)
RETURNS TABLE (
    budget_id UUID,
    group_id UUID,
    group_name VARCHAR(50),
    group_description TEXT,
    group_is_enabled BOOLEAN,
    group_created_at TIMESTAMP,
    group_updated_at TIMESTAMP,
    category_id UUID,
    category_name VARCHAR(50),
    category_description TEXT,
    category_created_at TIMESTAMP,
    category_updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cg.budget_id AS budget_id,
        cg.id AS group_id,
        cg.name AS group_name,
        cg.description AS group_description,
        cg.is_enabled AS group_is_enable,
        cg.created_at AS group_created_at,
        cg.updated_at AS group_updated_at,
        c.id AS category_id,
        c.name AS category_name,
        c.description AS category_description,
        c.created_at AS category_created_at,
        c.updated_at AS category_updated_at
    FROM 
        public.category_groups cg
    LEFT JOIN 
        public.categories c ON cg.id = c.group_id
    WHERE 
        cg.budget_id IS NULL
          OR cg.budget_id = p_budget_id
          OR c.budget_id IS NULL
          OR c.budget_id = p_budget_id;
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
  date date not null,
  amount numeric not null,
  iso_currency_code text default 'USD',
  plaid_account_id uuid references public.plaid_accounts(id) on delete cascade, -- will be null if account was manually added
  manual_account_id uuid references public.manual_fin_accounts(id) on delete cascade, -- will be null if account is from Plaid
  plaid_category_detailed text,
  plaid_category_confidence text,
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


-- ============================================================
-- Can update fin account transaction function
-- ============================================================
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

-- Grant necessary permissions
grant select on public.fin_account_transactions to authenticated;
grant select, update, insert on public.fin_account_transactions to service_role;


-- ============================================================
-- Update fin account transaction function
-- ============================================================
CREATE OR REPLACE FUNCTION update_fin_account_transaction(
    p_transaction_id UUID,
    p_category_id UUID DEFAULT NULL,
    p_merchant_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE fin_account_transactions
    SET 
        svend_category_id = COALESCE(p_category_id, svend_category_id),
        merchant_name = COALESCE(p_merchant_name, merchant_name),
        notes = COALESCE(p_notes, notes)
    WHERE id = p_transaction_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

grant execute on function update_fin_account_transaction(UUID, UUID, TEXT, TEXT) to service_role;

-- End of fin_account_transactions table


-- ============================================================
-- budget_tags table
-- ============================================================

CREATE TABLE if not exists budget_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    budget_id UUID NOT NULL REFERENCES budgets(id),
    name VARCHAR(255) NOT NULL,
    UNIQUE (name, budget_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

revoke all on budget_tags from public, service_role;

alter table budget_tags enable row level security;

CREATE POLICY read_budget_tags
    ON public.budget_tags
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

-- Grant necessary permissions
grant select on public.budget_tags to authenticated;
grant select, update, insert on public.budget_tags to service_role;

-- ============================================================
-- Create budget tag function
-- ============================================================
CREATE OR REPLACE FUNCTION create_budget_tag(p_budget_id UUID, p_tag_name TEXT)
RETURNS budget_tags AS $$
DECLARE
    v_new_tag budget_tags;
BEGIN
    -- Check for case-insensitive duplicates
    IF EXISTS (
        SELECT 1 
        FROM budget_tags 
        WHERE budget_id = p_budget_id AND LOWER(name) = LOWER(p_tag_name)
    ) THEN
        RAISE EXCEPTION 'Tag with name "%" already exists for this budget.', p_tag_name;
    END IF;
    
    -- Insert the new tag if no duplicates found
    INSERT INTO budget_tags (budget_id, name) 
    VALUES (p_budget_id, p_tag_name)
    RETURNING * INTO v_new_tag;

    RETURN v_new_tag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION create_budget_tag(UUID, TEXT) TO service_role;


-- ============================================================
-- Get budget tags by team account slug function
-- ============================================================
CREATE OR REPLACE FUNCTION get_budget_tags_by_team_account_slug(p_team_account_slug TEXT)
RETURNS TABLE (
    id UUID,
    budget_id UUID,
    name VARCHAR(255),  -- Changed from TEXT to VARCHAR(255) to match table definition
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT bt.* 
    FROM budget_tags bt
        JOIN budgets b ON bt.budget_id = b.id
        JOIN accounts a ON b.team_account_id = a.id
    WHERE a.slug = p_team_account_slug
    AND a.is_personal_account = false;
END;
$$ LANGUAGE plpgsql;

grant execute on function get_budget_tags_by_team_account_slug(TEXT) to authenticated, service_role;


-- ============================================================
-- Junction table for budget-transaction relationships
-- ============================================================
CREATE TABLE if not exists budget_fin_account_transactions (
    budget_id UUID NOT NULL REFERENCES budgets(id),
    fin_account_transaction_id UUID NOT NULL REFERENCES fin_account_transactions(id),
    svend_category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE SET NULL,
    merchant_name TEXT,
    payee TEXT,
    notes TEXT,
    tag_ids UUID[] default '{}',
    PRIMARY KEY (budget_id, fin_account_transaction_id)
);

revoke all on budget_fin_account_transactions from public, service_role;

alter table budget_fin_account_transactions enable row level security;

-- Create policies
create policy read_budget_fin_account_transactions
    on public.budget_fin_account_transactions
    for select
    to authenticated
    using (
        EXISTS (
            SELECT 1 FROM public.budgets b WHERE id = budget_id AND public.is_team_member(b.team_account_id, auth.uid())
        )
    );

-- Grant necessary permissions
grant select on public.budget_fin_account_transactions to authenticated;
grant select, update, insert on public.budget_fin_account_transactions to service_role;

-- End of budget_fin_account_transactions table


-- ============================================================
-- create_budget_fin_account_transaction function
-- ============================================================
CREATE OR REPLACE FUNCTION create_budget_fin_account_transaction(
    p_budget_id UUID,
    p_budget_fin_account_id UUID,
    p_amount NUMERIC,
    p_date DATE,
    p_svend_category_id UUID,
    p_merchant_name TEXT DEFAULT NULL,
    p_payee TEXT DEFAULT NULL,
    p_iso_currency_code TEXT DEFAULT 'USD',
    p_plaid_category_detailed TEXT DEFAULT NULL,
    p_plaid_category_confidence TEXT DEFAULT NULL,
    p_raw_data JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_plaid_account_id UUID;
    v_manual_account_id UUID;
    v_transaction_id UUID;
    v_team_account_id UUID;
BEGIN
    -- Get the team_account_id from the budget
    SELECT team_account_id INTO v_team_account_id
    FROM budgets
    WHERE id = p_budget_id;

    -- Get the plaid_account_id or manual_account_id from budget_fin_accounts
    SELECT plaid_account_id, manual_account_id 
    INTO v_plaid_account_id, v_manual_account_id
    FROM budget_fin_accounts
    WHERE id = p_budget_fin_account_id;

    IF v_plaid_account_id IS NULL AND v_manual_account_id IS NULL THEN
        RAISE EXCEPTION 'Invalid budget_fin_account_id';
    END IF;

    -- Insert into fin_account_transactions
    INSERT INTO fin_account_transactions (
        plaid_account_id,
        manual_account_id,
        amount,
        date,
        merchant_name,
        payee,
        iso_currency_code,
        plaid_category_detailed,
        plaid_category_confidence,
        raw_data
    ) VALUES (
        v_plaid_account_id,
        v_manual_account_id,
        p_amount,
        p_date,
        p_merchant_name,
        p_payee,
        p_iso_currency_code,
        p_plaid_category_detailed,
        p_plaid_category_confidence,
        p_raw_data
    )
    RETURNING id INTO v_transaction_id;

    -- Insert into budget_fin_account_transactions
    INSERT INTO budget_fin_account_transactions (
        budget_id,
        fin_account_transaction_id,
        svend_category_id,
        merchant_name,
        payee
    ) VALUES (
        p_budget_id,
        v_transaction_id,
        p_svend_category_id,
        p_merchant_name,
        p_payee
    );

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION create_budget_fin_account_transaction(
    UUID, UUID, NUMERIC, DATE, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;


-- ============================================================
-- Add budget plaid account function
-- ============================================================
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
  spending_tracking jsonb not null default '{}',
  spending_recommendations jsonb not null default '{}',

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


-- ============================
-- Storage buckets and policies
-- ============================
insert into storage.buckets (id, name)
values ('budget_transaction_attachments', 'budget_transaction_attachments')
ON CONFLICT (id) DO NOTHING;


-- Storage bucket policies for budget_transaction_attachments
CREATE POLICY download_budget_transaction_attachments
ON storage.objects FOR SELECT
USING (
    bucket_id = 'budget_transaction_attachments'
    AND (
        EXISTS (
            SELECT 1 
            FROM public.budgets b
            WHERE (storage.foldername(name))[1] = 'budget'
            AND (storage.foldername(name))[2] = b.id::text
            AND public.is_team_member(b.team_account_id, auth.uid())
        )
    )
);

CREATE POLICY upload_budget_transaction_attachments
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'budget_transaction_attachments'
    AND (
        -- Validate path format (budget/{budgetId}/transaction/{transactionId}/{fileName})
        array_length(storage.foldername(name), 1) = 4
        AND (storage.foldername(name))[1] = 'budget'
        AND (storage.foldername(name))[3] = 'transaction'
        AND EXISTS (
            SELECT 1 
            FROM public.budgets b
            WHERE (storage.foldername(name))[2] = b.id::text
            AND public.has_team_permission(auth.uid(), b.team_account_id, 'budgets.write')
        )
        AND EXISTS (
            SELECT 1
            FROM public.fin_account_transactions fat
            JOIN public.budget_fin_accounts bfa ON 
                (bfa.plaid_account_id = fat.plaid_account_id AND fat.plaid_account_id IS NOT NULL)
                OR (bfa.manual_account_id = fat.manual_account_id AND fat.manual_account_id IS NOT NULL)
            WHERE (storage.foldername(name))[4] = fat.id::text
            AND bfa.budget_id::text = (storage.foldername(name))[2]
        )
    )
);

CREATE POLICY delete_budget_transaction_attachments
ON storage.objects FOR DELETE
USING (
    bucket_id = 'budget_transaction_attachments'
    AND (
        EXISTS (
            SELECT 1 
            FROM public.budgets b
            WHERE( storage.foldername(name))[1] = 'budget'
            AND (storage.foldername(name))[2] = b.id::text
            AND public.has_team_permission(auth.uid(), b.team_account_id, 'budgets.write')
        )
    )
);


-- ============================================================
-- storage.buckets bucket for Plaid item institution logos
-- ============================================================
INSERT INTO storage.buckets (id, name) 
VALUES ('plaid_item_institution_logos', 'plaid_item_institution_logos')
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions for overall storage bucket access
grant insert, select, update, delete on storage.objects to authenticated;

-- end storage bucket policies


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

