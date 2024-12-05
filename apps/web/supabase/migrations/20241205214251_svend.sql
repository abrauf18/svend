-- Create new schema
CREATE SCHEMA IF NOT EXISTS svend;

-- Create admin function to reset account onboarding analysis
CREATE OR REPLACE FUNCTION svend.admin_account_onboarding_analysis_reset(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Update onboarding state
    UPDATE public.user_onboarding
    SET state = jsonb_set(
        state,
        '{account,contextKey}',
        '"analyze_spending"'
    )
    WHERE user_id = p_user_id;

    -- Reset budget analysis data
    UPDATE public.budgets
    SET 
        spending_recommendations = '{}',
        spending_tracking = '{}'
    WHERE id = (
        SELECT (state->'account'->>'budgetId')::uuid
        FROM public.user_onboarding
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
