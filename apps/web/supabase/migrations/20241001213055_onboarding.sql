create table if not exists public.user_onboarding (
  user_id uuid references public.accounts(id) primary key,
  state jsonb default '{}',
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

-- Create trigger function to enforce only personal accounts
create or replace function kit.enforce_personal_account_onboarding()
returns trigger as $$
begin
  if not exists (
    select 1 
    from public.accounts 
    where id = NEW.user_id 
    and is_personal_account = true
  ) then
    raise exception 'Onboarding records can only be created for personal accounts';
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Add trigger
create trigger enforce_personal_account_onboarding
  before insert or update on public.user_onboarding
  for each row
  execute function kit.enforce_personal_account_onboarding();

revoke all on public.user_onboarding from public, service_role;
 
grant select on public.user_onboarding to authenticated;
grant select, update, insert on public.user_onboarding to service_role;
 
alter table public.user_onboarding enable row level security;
 
create policy read_onboarding
    on public.user_onboarding
    for select
    to authenticated
    using (user_id = (select auth.uid()));
 
create policy insert_onboarding
    on public.user_onboarding
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));
 
create policy update_onboarding
    on public.user_onboarding
    for update
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.user_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

-- Add this after the other enum creations
create type onboarding_step_enum as enum (
    'start',
    'plaid',
    'manual',
    'profile_goals',
    'analyze_spending',
    'analyze_spending_in_progress',
    'budget_setup',
    'end'
);

-- ============================================================
-- update_onboarding_transaction function
-- ============================================================
-- First, create a composite type for the input parameters
CREATE TYPE onboarding_transaction_input AS (
    amount NUMERIC,
    date DATE,
    svend_category_id UUID,
    manual_account_id UUID,
    id UUID,
    user_tx_id TEXT,
    merchant_name TEXT
);

-- Modified function to handle arrays
-- TODO: Get rid of this and only modify the base transaction during onboarding
CREATE OR REPLACE FUNCTION update_onboarding_transaction(
    p_transaction_input onboarding_transaction_input
) RETURNS SETOF UUID AS $$
DECLARE
    v_transaction_input onboarding_transaction_input;
BEGIN
    UPDATE public.fin_account_transactions
    SET
        date = p_transaction_input.date,
        amount = p_transaction_input.amount,
        svend_category_id = p_transaction_input.svend_category_id,
        manual_account_id = p_transaction_input.manual_account_id,
        user_tx_id = p_transaction_input.user_tx_id,
        merchant_name = p_transaction_input.merchant_name
    WHERE id = p_transaction_input.id;

    UPDATE public.budget_fin_account_transactions
    SET
        svend_category_id = p_transaction_input.svend_category_id
    WHERE fin_account_transaction_id = p_transaction_input.id;

    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- delete_manual_transactions function
-- ============================================================

CREATE OR REPLACE FUNCTION delete_transactions(
  p_transaction_ids UUID[]
) RETURNS TABLE (
  deleted_transaction_id UUID
) AS $$
BEGIN
  -- First delete from budget_fin_account_transactions since it references fin_account_transactions
  DELETE FROM public.budget_fin_account_transactions 
  WHERE fin_account_transaction_id = ANY(p_transaction_ids);

  -- Then delete from fin_account_transactions and return the deleted IDs
  RETURN QUERY
  DELETE FROM public.fin_account_transactions 
  WHERE id = ANY(p_transaction_ids)
  RETURNING id AS deleted_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- delete_manual_accounts_and_transactions function
-- ============================================================

CREATE OR REPLACE FUNCTION delete_manual_accounts_and_transactions(
  p_manual_account_ids UUID[]
) RETURNS void AS $$
DECLARE
  v_parsed_manual_account_ids UUID[];
  v_transaction_ids UUID[];
BEGIN
  -- Parse the manual account IDs
  SELECT array_agg(id) INTO v_parsed_manual_account_ids FROM unnest(p_manual_account_ids) AS id;

  -- Get all related transaction IDs
  SELECT array_agg(id) INTO v_transaction_ids
  FROM public.fin_account_transactions
  WHERE manual_account_id = ANY(v_parsed_manual_account_ids);

  -- Delete related transactions first
  PERFORM delete_transactions(v_transaction_ids);

  -- Delete the accounts
  DELETE FROM public.budget_fin_accounts WHERE manual_account_id = ANY(v_parsed_manual_account_ids);
  DELETE FROM public.manual_fin_accounts WHERE id = ANY(v_parsed_manual_account_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- delete_manual_institutions_accounts_and_transactions function
-- ============================================================

CREATE OR REPLACE FUNCTION delete_manual_institutions_accounts_and_transactions(
  p_manual_institution_ids UUID[]
) RETURNS void AS $$
DECLARE
  v_manual_account_ids UUID[];
  v_parsed_manual_institution_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_parsed_manual_institution_ids FROM unnest(p_manual_institution_ids) AS id;

  -- Get all related account IDs
  SELECT array_agg(id) INTO v_manual_account_ids
  FROM public.manual_fin_accounts
  WHERE institution_id = ANY(v_parsed_manual_institution_ids);

  -- Delete all related accounts and their transactions
  PERFORM delete_manual_accounts_and_transactions(v_manual_account_ids);

  -- Delete the institutions
  DELETE FROM public.manual_fin_institutions WHERE id = ANY(v_parsed_manual_institution_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- Storage buckets and policies for onboarding attatchments
-- ========================================================

insert into storage.buckets (id, name)
values ('onboarding_attachments', 'onboarding_attachments')
ON CONFLICT (id) DO NOTHING;

 -- Validate path format (user/{userId}/{userFileName})

CREATE POLICY download_onboarding_attachments
ON storage.objects FOR SELECT
USING (
    bucket_id = 'onboarding_attachments'
    AND (
        array_length(storage.foldername(name), 1) = 2
        AND (storage.foldername(name))[1] = 'user'
        AND (storage.foldername(name))[2] = auth.uid()::text
    )
);

CREATE POLICY upload_onboarding_attachments
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'onboarding_attachments'
    AND (
        array_length(storage.foldername(name), 1) = 2
        AND (storage.foldername(name))[1] = 'user'
        AND (storage.foldername(name))[2] = auth.uid()::text
    )
);

CREATE POLICY delete_onboarding_attachments
ON storage.objects FOR DELETE
USING (
    bucket_id = 'onboarding_attachments'
    AND (
        array_length(storage.foldername(name), 1) = 2
        AND (storage.foldername(name))[1] = 'user'
        AND (storage.foldername(name))[2] = auth.uid()::text
    )
);