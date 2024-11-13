-- Table to store plan entitlements
CREATE TABLE public.plan_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id VARCHAR(255) NOT NULL,
  feature VARCHAR(255) NOT NULL,
  entitlement JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (variant_id, feature)
);
 
revoke all on public.plan_entitlements from public;
 
alter table public.plan_entitlements enable row level security;
 
grant select on public.plan_entitlements to authenticated;
 
create policy select_plan_entitlements
    on public.plan_entitlements
    for select
    to authenticated
    using (true);

-- Table to store feature usage
CREATE TABLE public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  feature VARCHAR(255) NOT NULL,
  usage JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_id, feature)
);
 
revoke all on public.feature_usage from public;
 
alter table public.feature_usage enable row level security;
 
create policy select_feature_usage
    on public.feature_usage
    for select
    to authenticated
    using (
        public.has_role_on_team(account_id) or (select auth.uid()) = account_id
    );
 
-- Index for faster lookups
CREATE INDEX idx_feature_usage_account_id ON public.feature_usage(account_id, feature);

CREATE OR REPLACE FUNCTION public.create_feature_usage_row()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.feature_usage (account_id, feature)
  VALUES (NEW.id, '');
 
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER create_feature_usage_row
AFTER INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.create_feature_usage_row();

-- Function to check if an account can use a feature
CREATE OR REPLACE FUNCTION public.can_use_feature(p_account_id UUID, p_feature VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
  v_variant_id TEXT;
  v_entitlement JSONB;
BEGIN
  -- Get the subscription for the account
  SELECT id, variant_id INTO v_subscription_id, v_variant_id
  FROM public.subscriptions
  WHERE account_id = p_account_id AND active = true
  LIMIT 1;
 
  IF v_subscription_id IS NULL THEN
    RETURN FALSE;
  END IF;
 
  -- Get the entitlement for the feature
  SELECT entitlement INTO v_entitlement
  FROM public.plan_entitlements
  WHERE variant_id = v_variant_id AND feature = p_feature;
 
  IF v_entitlement IS NULL THEN
    RETURN FALSE;
  END IF;
 
  -- For flat entitlements, just check if it exists
  IF v_entitlement->>'type' = 'flat' THEN
    RETURN TRUE;
  END IF;
 
  -- For quota-based entitlements, check against usage
  IF v_entitlement->>'type' = 'quota' THEN
    DECLARE
      v_usage JSONB;
      v_limit INTEGER;
    BEGIN
      SELECT usage INTO v_usage
      FROM public.feature_usage
      WHERE account_id = p_account_id AND feature = p_feature;
 
      v_limit := (v_entitlement->>'limit')::INTEGER;
 
      IF v_usage IS NULL OR (v_usage->>'count')::INTEGER < v_limit THEN
        RETURN TRUE;
      ELSE
        RETURN FALSE;
      END IF;
    END;
  END IF;
 
  -- Add more entitlement types here as needed
 
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
 
-- Function to get entitlement details
CREATE OR REPLACE FUNCTION public.get_entitlement(p_account_id UUID, p_feature VARCHAR(255))
RETURNS JSONB AS $$
DECLARE
  v_subscription_id UUID;
  v_variant_id TEXT;
  v_entitlement JSONB;
  v_usage JSONB;
BEGIN
  -- Get the subscription for the account
  SELECT id, variant_id INTO v_subscription_id, v_variant_id
  FROM public.subscriptions
  WHERE account_id = p_account_id AND active = true
  LIMIT 1;
 
  IF v_subscription_id IS NULL THEN
    RETURN NULL;
  END IF;
 
  -- Get the entitlement for the feature
  SELECT entitlement INTO v_entitlement
  FROM public.plan_entitlements
  WHERE variant_id = v_variant_id AND feature = p_feature;
 
  IF v_entitlement IS NULL THEN
    RETURN NULL;
  END IF;
 
  -- Get current usage
  SELECT usage INTO v_usage
  FROM public.feature_usage
  WHERE account_id = p_account_id AND feature = p_feature;
 
  -- Combine entitlement and usage data
  RETURN jsonb_build_object(
    'entitlement', v_entitlement,
    'usage', COALESCE(v_usage, '{}'::JSONB)
  );
END;
$$ LANGUAGE plpgsql;
 
-- Function to update feature usage
CREATE OR REPLACE FUNCTION public.update_feature_usage(p_account_id UUID, p_feature VARCHAR(255), p_usage JSONB)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.feature_usage (account_id, feature, usage)
  VALUES (p_account_id, p_feature, p_usage)
  ON CONFLICT (account_id, feature)
  DO UPDATE SET usage = feature_usage.usage || p_usage, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
 
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.can_use_feature(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_entitlement(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_feature_usage(UUID, VARCHAR, JSONB) TO authenticated;

-- Add triggers for automatic timestamp updates

-- For plan_entitlements table
CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.plan_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();

-- For feature_usage table
CREATE TRIGGER set_timestamp
BEFORE INSERT OR UPDATE ON public.feature_usage
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamps();
