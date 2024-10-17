create table if not exists public.onboarding (
  account_id uuid references public.accounts(id) primary key,
  state jsonb default '{}',
  created_at timestamp with time zone default current_timestamp,
  updated_at timestamp with time zone default current_timestamp
);

revoke all on public.onboarding from public, service_role;
 
grant select on public.onboarding to authenticated;
grant select, update, insert on public.onboarding to service_role;
 
alter table onboarding enable row level security;
 
create policy read_onboarding
    on public.onboarding
    for select
    to authenticated
    using (account_id = (select auth.uid()));
 
create policy insert_onboarding
    on public.onboarding
    for insert
    to authenticated
    with check (account_id = (select auth.uid()));
 
create policy update_onboarding
    on public.onboarding
    for update
    to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.onboarding
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
