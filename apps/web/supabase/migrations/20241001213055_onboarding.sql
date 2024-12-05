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
    'profile_goals',
    'analyze_spending',
    'analyze_spending_in_progress',
    'budget_setup',
    'end'
);
