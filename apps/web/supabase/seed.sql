-- WEBHOOKS SEED
-- PLEASE NOTE: These webhooks are only for development purposes. Leave them as they are or add new ones.

-- These webhooks are only for development purposes.
-- In production, you should manually create webhooks in the Supabase dashboard (or create a migration to do so).
-- We don't do it because you'll need to manually add your webhook URL and secret key.

-- this webhook will be triggered after deleting an account
create trigger "accounts_teardown" after delete
on "public"."accounts" for each row
execute function "supabase_functions"."http_request"(
  'http://host.docker.internal:3000/api/db/webhook',
  'POST',
  '{"Content-Type":"application/json", "X-Supabase-Event-Signature":"WEBHOOKSECRET"}',
  '{}',
  '5000'
);

-- this webhook will be triggered after a delete on the subscriptions table
-- which should happen when a user deletes their account (and all their subscriptions)
create trigger "subscriptions_delete" after delete
on "public"."subscriptions" for each row
execute function "supabase_functions"."http_request"(
  'http://host.docker.internal:3000/api/db/webhook',
  'POST',
  '{"Content-Type":"application/json", "X-Supabase-Event-Signature":"WEBHOOKSECRET"}',
  '{}',
  '5000'
);

-- this webhook will be triggered after every insert on the invitations table
-- which should happen when a user invites someone to their account
create trigger "invitations_insert" after insert
on "public"."invitations" for each row
execute function "supabase_functions"."http_request"(
  'http://host.docker.internal:3000/api/db/webhook',
  'POST',
  '{"Content-Type":"application/json", "X-Supabase-Event-Signature":"WEBHOOKSECRET"}',
  '{}',
  '5000'
);


-- DATA SEED
-- This is a data dump for testing purposes. It should be used to seed the database with data for testing.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
        ('00000000-0000-0000-0000-000000000000', '31a03e74-1639-45b6-bfa7-77447f1a4762', 'authenticated', 'authenticated', 'test@makerkit.dev', '$2a$10$NaMVRrI7NyfwP.AfAVWt6O/abulGnf9BBqwa6DqdMwXMvOCGpAnVO', '2024-04-20 08:20:38.165331+00', NULL, '', NULL, '', NULL, '', '', NULL, '2024-04-20 09:36:02.521776+00', '{"provider": "email", "providers": ["email"], "role": "super-admin"}', '{"sub": "31a03e74-1639-45b6-bfa7-77447f1a4762", "email": "test@makerkit.dev", "email_verified": true, "phone_verified": false}', NULL, '2024-04-20 08:20:34.459113+00', '2024-04-20 10:07:48.554125+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false), -- password: testpassword
        ('00000000-0000-0000-0000-000000000000', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', 'authenticated', 'authenticated', 'onboarding1@devops.svend.app', '$2a$10$4eek5uyhNzK.Q0W2FjAzCuHfZadD09f8I0ss6IhhukpKXyi/5uKau', '2024-04-20 08:38:00.860548+00', NULL, '', '2024-04-20 08:37:43.343769+00', '', NULL, '', '', NULL, '2024-04-20 08:38:00.93864+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "b73eb03e-fb7a-424d-84ff-18e2791ce0b4", "email": "onboarding1@devops.svend.app", "email_verified": true, "phone_verified": false}', NULL, '2024-04-20 08:37:43.3385+00', '2024-04-20 08:38:00.942809+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false), -- password: password123
        ('00000000-0000-0000-0000-000000000000', '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', 'authenticated', 'authenticated', 'onboarding2@devops.svend.app', '$2a$10$4eek5uyhNzK.Q0W2FjAzCuHfZadD09f8I0ss6IhhukpKXyi/5uKau', '2024-04-20 08:36:37.517993+00', NULL, '', '2024-04-20 08:36:27.639648+00', '', NULL, '', '', NULL, '2024-04-20 08:36:37.614337+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf", "email": "onboarding2@devops.svend.app", "email_verified": true, "phone_verified": false}', NULL, '2024-04-20 08:36:27.630379+00', '2024-04-20 08:36:37.617955+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false), -- password: password123
        ('00000000-0000-0000-0000-000000000000', '6b83d656-e4ab-48e3-a062-c0c54a427368', 'authenticated', 'authenticated', 'onboarding3@devops.svend.app', '$2a$10$4eek5uyhNzK.Q0W2FjAzCuHfZadD09f8I0ss6IhhukpKXyi/5uKau', '2024-04-20 08:41:15.376778+00', NULL, '', '2024-04-20 08:41:08.689674+00', '', NULL, '', '', NULL, '2024-04-20 08:41:15.484606+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "6b83d656-e4ab-48e3-a062-c0c54a427368", "email": "onboarding3@devops.svend.app", "email_verified": true, "phone_verified": false}', NULL, '2024-04-20 08:41:08.683395+00', '2024-04-20 08:41:15.485494+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false); -- password: password123

--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
  ('31a03e74-1639-45b6-bfa7-77447f1a4762', '31a03e74-1639-45b6-bfa7-77447f1a4762', '{"sub": "31a03e74-1639-45b6-bfa7-77447f1a4762", "email": "test@makerkit.dev", "email_verified": false, "phone_verified": false}', 'email', '2024-04-20 08:20:34.46275+00', '2024-04-20 08:20:34.462773+00', '2024-04-20 08:20:34.462773+00', '9bb58bad-24a4-41a8-9742-1b5b4e2d8abd'),
  ('b73eb03e-fb7a-424d-84ff-18e2791ce0b4', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', '{"sub": "b73eb03e-fb7a-424d-84ff-18e2791ce0b4", "email": "onboarding1@devops.svend.app", "email_verified": true, "phone_verified": false}', 'email', '2024-04-20 08:37:43.342194+00', '2024-04-20 08:37:43.342218+00', '2024-04-20 08:37:43.342218+00', '4392e228-a6d8-4295-a7d6-baed50c33e7c'),
  ('5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', '{"sub": "5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf", "email": "onboarding2@devops.svend.app", "email_verified": true, "phone_verified": false}', 'email', '2024-04-20 08:36:27.637388+00', '2024-04-20 08:36:27.637409+00', '2024-04-20 08:36:27.637409+00', '090598a1-ebba-4879-bbe3-38d517d5066f'),
  ('6b83d656-e4ab-48e3-a062-c0c54a427368', '6b83d656-e4ab-48e3-a062-c0c54a427368', '{"sub": "6b83d656-e4ab-48e3-a062-c0c54a427368", "email": "onboarding3@devops.svend.app", "email_verified": true, "phone_verified": false}', 'email', '2024-04-20 08:41:08.687948+00', '2024-04-20 08:41:08.687982+00', '2024-04-20 08:41:08.687982+00', 'd122aca5-4f29-43f0-b1b1-940b000638db');

--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: key; Type: TABLE DATA; Schema: pgsodium; Owner: supabase_admin
--


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--


--
-- Data for Name: onboarding; Type: TABLE DATA; Schema: public; Owner: postgres
--
UPDATE "public"."onboarding" 
SET "state" = jsonb_set("state", '{account,contextKey}', '"start"')
WHERE "account_id" = '31a03e74-1639-45b6-bfa7-77447f1a4762';

UPDATE "public"."onboarding" 
SET "state" = jsonb_set("state", '{account,contextKey}', '"plaid"')
WHERE "account_id" = 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4';

UPDATE "public"."onboarding" 
SET "state" = jsonb_set("state", '{account,contextKey}', '"profile_goals"')
WHERE "account_id" = '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf';

UPDATE "public"."onboarding" 
SET "state" = jsonb_set("state", '{account,contextKey}', '"budget_setup"')
WHERE "account_id" = '6b83d656-e4ab-48e3-a062-c0c54a427368';

--
-- Data for Name: plaid_connection_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."plaid_connection_items" ("id", "account_id", "plaid_item_id", "institution_id", "institution_name", "institution_logo_storage_name", "access_token", "next_cursor", "created_at", "updated_at")
VALUES
    ('2f0efdc9-5901-4103-86c7-41004ffab992', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', 'aQXyVy5v9DcNM5wkgp9XF39vwbDvEEh7XAbwW', 'ins_20', 'Citizens Bank', NULL, 'access-sandbox-8f993245-ae1c-408d-bfae-762931711a1e', NULL, current_timestamp, current_timestamp),
    ('f7bd137d-f0bb-423d-9e4b-115a918f67ca', '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', '1EnmdJbVqKFVbZqaDMvrsEQ4P6LD5pf5b6oQp', 'ins_109508', 'First Platypus Bank', NULL, 'access-sandbox-bde1b8a5-68b8-4c3d-8240-5b201560d2a3', NULL, current_timestamp, current_timestamp),
    ('6c9998d5-52e6-4c5d-b941-7065e39f7ba5', '6b83d656-e4ab-48e3-a062-c0c54a427368', 'EQyvNdqdryigMb1yld36IQdp9el8JwFXry4w9', 'ins_109512', 'Houndstooth Bank', NULL, 'access-sandbox-3fcbf572-b218-473c-9010-7da0e12f517d', 'CAESJVd4UXo4VzFXNFFmem1CVlJnbHlwY2VhRW0xeGU2ZFU2eUx5NG4iDAj+yZa4BhCA5sfXASoMCP7JlrgGEIDmx9cB', current_timestamp, current_timestamp);


--
-- Data for Name: plaid_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."plaid_accounts" ("id", "account_id", "plaid_conn_item_id", "plaid_account_id", "plaid_persistent_account_id", "name", "official_name", "type", "subtype", "balance_available", "balance_current", "iso_currency_code", "balance_limit", "mask")
VALUES
    ('ec4c629e-efb9-4562-8923-6e58924a812b', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', '2f0efdc9-5901-4103-86c7-41004ffab992', 'GJzBPB5voXI6BevwpzDmCwpvAANrxPU6K9QV6', '8cfb8beb89b774ee43b090625f0d61d0814322b43bff984eaf60386e', 'Plaid Checking', 'Plaid Gold Standard 0% Interest Checking', 'depository', 'checking', 100, 110, 'USD', NULL, '0000'),
    ('eb35c9f6-716d-47bc-947d-6e5120200fcf', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', '2f0efdc9-5901-4103-86c7-41004ffab992', 'mvDZVZkdbxsL9bp7wZPGU1PxoodW4NUgejWGA', NULL, 'Plaid Credit Card', 'Plaid Diamond 12.5% APR Interest Credit Card', 'credit', 'credit card', NULL, 410, 'USD', 2000, '3333'),
    ('faf52bc0-8bd6-4895-81d0-7fbfee7e67a2', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', '2f0efdc9-5901-4103-86c7-41004ffab992', 'vvD9V9PZAQslB7xqQyL5hNLv776WJxiqbxELw', NULL, 'Plaid 401k', NULL, 'investment', '401k', NULL, 23631.9805, 'USD', NULL, '6666'),
    ('d1484c2a-300a-4a2d-be68-906928c49911', 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4', '2f0efdc9-5901-4103-86c7-41004ffab992', '6p6NWN8jdDSJq8W4zlNmiR4mggpe3Wi8QJyEn', NULL, 'Plaid Mortgage', NULL, 'loan', 'mortgage', NULL, 56302.06, 'USD', NULL, '8888'),
    ('b61c44a6-787c-4a6e-bf7f-11f58346dc31', '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', 'f7bd137d-f0bb-423d-9e4b-115a918f67ca', 'JDo9vkMxqAiwX453ZN1dHR9NReJgm3uBxKPWm', '211a4e5d8361a3afb7a3886362198c7306e00a313b5aa944c20d34b6', 'Plaid Saving', 'Plaid Silver Standard 0.1% Interest Saving', 'depository', 'savings', 200, 210, 'USD', NULL, '1111'),
    ('17097d64-7a08-4069-bf20-4b87f9b22376', '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', 'f7bd137d-f0bb-423d-9e4b-115a918f67ca', 'qyn9PlLDGWSGkRn9dPjes71Z73MaDBtgxv3Ak', NULL, 'Plaid Money Market', 'Plaid Platinum Standard 1.85% Interest Money Market', 'depository', 'money market', 43200, 43200, 'USD', NULL, '4444'),
    ('38a435d9-f9d1-46c0-8e2a-7e1d90eb1365', '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', 'f7bd137d-f0bb-423d-9e4b-115a918f67ca', '3Amd4Pybrzh9vMRoxanwsywxypamqEhZXvxKg', NULL, 'Plaid HSA', 'Plaid Cares Health Savings Account', 'depository', 'hsa', 6009, 6009, 'USD', NULL, '9001'),
    ('fe1aaac7-6fae-4022-b04f-4e5cde838a14', '6b83d656-e4ab-48e3-a062-c0c54a427368', '6c9998d5-52e6-4c5d-b941-7065e39f7ba5', 'mKzbLjlj9zCLwNJdGmpWFJnge7qoVVtgyJ58r', '2a01484e1b5ef0b54fbcb89658b2764529bbec94a16f7b95481280a7', 'Plaid CD', 'Plaid Bronze Standard 0.2% Interest CD', 'depository', 'cd', NULL, 1000, 'USD', NULL, '2222'),
    ('b7060a5b-0ca0-4ec3-bfca-7f80efce0e91', '6b83d656-e4ab-48e3-a062-c0c54a427368', '6c9998d5-52e6-4c5d-b941-7065e39f7ba5', '6qZdmGAGBZFJzeELmVWghQJrPxMgZZU8D3RnE', NULL, 'Plaid Student Loan', NULL, 'loan', 'student', NULL, 65262, 'USD', NULL, '7777'),
    ('5083b3f3-898e-4bfa-abac-417e1943550c', '6b83d656-e4ab-48e3-a062-c0c54a427368', '6c9998d5-52e6-4c5d-b941-7065e39f7ba5', 'vNjA5oaoRjclQmMN5axWt8rBmXA7eecq6RDV7', NULL, 'Plaid IRA', NULL, 'investment', 'ira', NULL, 320.76, 'USD', NULL, '5555');


--
-- Data for Name: budget_plaid_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."budget_plaid_accounts" ("budget_id", "plaid_account_id")
VALUES
    -- For account_id 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4'
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4'), 'ec4c629e-efb9-4562-8923-6e58924a812b'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4'), 'eb35c9f6-716d-47bc-947d-6e5120200fcf'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4'), 'faf52bc0-8bd6-4895-81d0-7fbfee7e67a2'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = 'b73eb03e-fb7a-424d-84ff-18e2791ce0b4'), 'd1484c2a-300a-4a2d-be68-906928c49911'),

    -- For account_id '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf'
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf'), 'b61c44a6-787c-4a6e-bf7f-11f58346dc31'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf'), '17097d64-7a08-4069-bf20-4b87f9b22376'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf'), '38a435d9-f9d1-46c0-8e2a-7e1d90eb1365'),

    -- For account_id '6b83d656-e4ab-48e3-a062-c0c54a427368'
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '6b83d656-e4ab-48e3-a062-c0c54a427368'), 'fe1aaac7-6fae-4022-b04f-4e5cde838a14'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '6b83d656-e4ab-48e3-a062-c0c54a427368'), 'b7060a5b-0ca0-4ec3-bfca-7f80efce0e91'),
    ((SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '6b83d656-e4ab-48e3-a062-c0c54a427368'), '5083b3f3-898e-4bfa-abac-417e1943550c');


--------------------------------
-- SETUP FOR ONBOARDING 3 USER
--------------------------------

--
-- Data for Name: acct_fin_profile; Type: TABLE DATA; Schema: public; Owner: postgres
--
UPDATE "public"."acct_fin_profile" 
SET 
    "full_name" = 'Onboarding User 3',
    "age" = 30,
    "marital_status" = 'Single',
    "marital_status_other" = NULL,
    "dependents" = 0,
    "income_level" = '$25,000 - $50,000',
    "current_debt" = '{"Credit Cards"}',
    "current_debt_other" = NULL,
    "savings" = '$10,000 - $25,000'
WHERE "account_id" = (SELECT id FROM public.accounts WHERE email = 'onboarding3@devops.svend.app');


--
-- Data for Name: fin_account_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.fin_account_transactions (id, plaid_account_id, date, amount, iso_currency_code, raw_data)
VALUES
  (uuid_generate_v4(), 'fe1aaac7-6fae-4022-b04f-4e5cde838a14', '2024-09-20', 1000, 'USD', '{
    "account_id": "mKzbLjlj9zCLwNJdGmpWFJnge7qoVVtgyJ58r",
    "account_owner": null,
    "amount": 1000,
    "authorized_date": null,
    "authorized_datetime": null,
    "category": [
        "Transfer",
        "Deposit"
    ],
    "category_id": "21007000",
    "check_number": null,
    "counterparties": [],
    "date": "2024-09-20",
    "datetime": null,
    "iso_currency_code": "USD",
    "location": {
        "address": null,
        "city": null,
        "country": null,
        "lat": null,
        "lon": null,
        "postal_code": null,
        "region": null,
        "store_number": null
    },
    "logo_url": null,
    "merchant_entity_id": null,
    "merchant_name": null,
    "name": "CD DEPOSIT .INITIAL.",
    "payment_channel": "other",
    "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
    },
    "pending": false,
    "pending_transaction_id": null,
    "personal_finance_category": {
        "confidence_level": "LOW",
        "detailed": "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
        "primary": "GENERAL_MERCHANDISE"
    },
    "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
    "transaction_code": null,
    "transaction_id": "dLn8dzyzJnt69GZ1AmgBcpAZ1yMa1MfJA3M1W",
    "transaction_type": "special",
    "unofficial_currency_code": null,
    "website": null
  }'::jsonb),
  (uuid_generate_v4(), 'fe1aaac7-6fae-4022-b04f-4e5cde838a14', '2024-08-21', 1000, 'USD', '{
    "account_id": "mKzbLjlj9zCLwNJdGmpWFJnge7qoVVtgyJ58r",
    "account_owner": null,
    "amount": 1000,
    "authorized_date": null,
    "authorized_datetime": null,
    "category": [
        "Transfer",
        "Deposit"
    ],
    "category_id": "21007000",
    "check_number": null,
    "counterparties": [],
    "date": "2024-08-21",
    "datetime": null,
    "iso_currency_code": "USD",
    "location": {
        "address": null,
        "city": null,
        "country": null,
        "lat": null,
        "lon": null,
        "postal_code": null,
        "region": null,
        "store_number": null
    },
    "logo_url": null,
    "merchant_entity_id": null,
    "merchant_name": null,
    "name": "CD DEPOSIT .INITIAL.",
    "payment_channel": "other",
    "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
    },
    "pending": false,
    "pending_transaction_id": null,
    "personal_finance_category": {
        "confidence_level": "LOW",
        "detailed": "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
        "primary": "GENERAL_MERCHANDISE"
    },
    "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
    "transaction_code": null,
    "transaction_id": "ggykAxRxJyTq6B7v3lQoIQkAjmaQDbSER3R4A",
    "transaction_type": "special",
    "unofficial_currency_code": null,
    "website": null
  }'::jsonb),
  (uuid_generate_v4(), 'fe1aaac7-6fae-4022-b04f-4e5cde838a14', '2024-07-22', 1000, 'USD', '{
    "account_id": "mKzbLjlj9zCLwNJdGmpWFJnge7qoVVtgyJ58r",
    "account_owner": null,
    "amount": 1000,
    "authorized_date": null,
    "authorized_datetime": null,
    "category": [
        "Transfer",
        "Deposit"
    ],
    "category_id": "21007000",
    "check_number": null,
    "counterparties": [],
    "date": "2024-07-22",
    "datetime": null,
    "iso_currency_code": "USD",
    "location": {
        "address": null,
        "city": null,
        "country": null,
        "lat": null,
        "lon": null,
        "postal_code": null,
        "region": null,
        "store_number": null
    },
    "logo_url": null,
    "merchant_entity_id": null,
    "merchant_name": null,
    "name": "CD DEPOSIT .INITIAL.",
    "payment_channel": "other",
    "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
    },
    "pending": false,
    "pending_transaction_id": null,
    "personal_finance_category": {
        "confidence_level": "LOW",
        "detailed": "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
        "primary": "GENERAL_MERCHANDISE"
    },
    "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
    "transaction_code": null,
    "transaction_id": "8r1qwbnbR1FV5v14pjbDfNDrZv7NQeCWpdpKd",
    "transaction_type": "special",
    "unofficial_currency_code": null,
    "website": null
  }'::jsonb),
  (uuid_generate_v4(), 'fe1aaac7-6fae-4022-b04f-4e5cde838a14', '2024-06-22', 1000, 'USD', '{
    "account_id": "mKzbLjlj9zCLwNJdGmpWFJnge7qoVVtgyJ58r",
    "account_owner": null,
    "amount": 1000,
    "authorized_date": null,
    "authorized_datetime": null,
    "category": [
        "Transfer",
        "Deposit"
    ],
    "category_id": "21007000",
    "check_number": null,
    "counterparties": [],
    "date": "2024-06-22",
    "datetime": null,
    "iso_currency_code": "USD",
    "location": {
        "address": null,
        "city": null,
        "country": null,
        "lat": null,
        "lon": null,
        "postal_code": null,
        "region": null,
        "store_number": null
    },
    "logo_url": null,
    "merchant_entity_id": null,
    "merchant_name": null,
    "name": "CD DEPOSIT .INITIAL.",
    "payment_channel": "other",
    "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
    },
    "pending": false,
    "pending_transaction_id": null,
    "personal_finance_category": {
        "confidence_level": "LOW",
        "detailed": "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
        "primary": "GENERAL_MERCHANDISE"
    },
    "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
    "transaction_code": null,
    "transaction_id": "EQyvNdqdryigMb1yld36IQdJ7q3Q6wS4eDeEo",
    "transaction_type": "special",
    "unofficial_currency_code": null,
    "website": null
  }'::jsonb),
  (uuid_generate_v4(), 'fe1aaac7-6fae-4022-b04f-4e5cde838a14', '2024-05-23', 1000, 'USD', '{
    "account_id": "mKzbLjlj9zCLwNJdGmpWFJnge7qoVVtgyJ58r",
    "account_owner": null,
    "amount": 1000,
    "authorized_date": null,
    "authorized_datetime": null,
    "category": [
        "Transfer",
        "Deposit"
    ],
    "category_id": "21007000",
    "check_number": null,
    "counterparties": [],
    "date": "2024-05-23",
    "datetime": null,
    "iso_currency_code": "USD",
    "location": {
        "address": null,
        "city": null,
        "country": null,
        "lat": null,
        "lon": null,
        "postal_code": null,
        "region": null,
        "store_number": null
    },
    "logo_url": null,
    "merchant_entity_id": null,
    "merchant_name": null,
    "name": "CD DEPOSIT .INITIAL.",
    "payment_channel": "other",
    "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
    },
    "pending": false,
    "pending_transaction_id": null,
    "personal_finance_category": {
        "confidence_level": "LOW",
        "detailed": "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE",
        "primary": "GENERAL_MERCHANDISE"
    },
    "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
    "transaction_code": null,
    "transaction_id": "WxQz8W1W4QfzmBVRglypceaEm1xe6dU6yLy4n",
    "transaction_type": "special",
    "unofficial_currency_code": null,
    "website": null
  }'::jsonb);


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--

UPDATE public.budgets
SET category_spending = jsonb_build_array(
    jsonb_build_object(
        'category', jsonb_build_array('Rent'),
        'spending', jsonb_build_object(
            'average', 1200,
            'recommended', 1100,
            'target', 1000
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Loan Payments'),
        'spending', jsonb_build_object(
            'average', 600,
            'recommended', 550,
            'target', 500
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Food'),
        'spending', jsonb_build_object(
            'average', 500,
            'recommended', 450,
            'target', 400
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Travel'),
        'spending', jsonb_build_object(
            'average', 500,
            'recommended', 450,
            'target', 400
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('General Merchandise'),
        'spending', jsonb_build_object(
            'average', 400,
            'recommended', 350,
            'target', 300
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Entertainment'),
        'spending', jsonb_build_object(
            'average', 300,
            'recommended', 250,
            'target', 200
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Transportation'),
        'spending', jsonb_build_object(
            'average', 300,
            'recommended', 280,
            'target', 250
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Utilities'),
        'spending', jsonb_build_object(
            'average', 200,
            'recommended', 180,
            'target', 150
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Medical'),
        'spending', jsonb_build_object(
            'average', 150,
            'recommended', 130,
            'target', 100
        )
    ),
    jsonb_build_object(
        'category', jsonb_build_array('Personal Care'),
        'spending', jsonb_build_object(
            'average', 100,
            'recommended', 90,
            'target', 80
        )
    )
)
WHERE id = (SELECT (state->'account'->>'budgetId')::uuid FROM public.onboarding WHERE account_id = '6b83d656-e4ab-48e3-a062-c0c54a427368');


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

-- INSERT INTO "public"."roles" ("name", "hierarchy_level") VALUES
--     ('custom-role', 4);

--
-- Data for Name: accounts_memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

-- INSERT INTO "public"."accounts_memberships" ("user_id", "account_id", "account_role", "created_at", "updated_at", "created_by", "updated_by") VALUES
--     ('31a03e74-1639-45b6-bfa7-77447f1a4762', '31a03e74-1639-45b6-bfa7-77447f1a4762', 'owner', '2024-04-20 08:21:16.802867+00', '2024-04-20 08:21:16.802867+00', NULL, NULL),
--     ('5c064f1b-78ee-4e1c-ac3b-e99aa97c99bf', '31a03e74-1639-45b6-bfa7-77447f1a4762', 'owner', '2024-04-20 08:36:44.21028+00', '2024-04-20 08:36:44.21028+00', NULL, NULL),
--     ('b73eb03e-fb7a-424d-84ff-18e2791ce0b4', '31a03e74-1639-45b6-bfa7-77447f1a4762', 'reporter', '2024-04-20 08:38:02.50993+00', '2024-04-20 08:38:02.50993+00', NULL, NULL),
--     ('6b83d656-e4ab-48e3-a062-c0c54a427368', '31a03e74-1639-45b6-bfa7-77447f1a4762', 'collaborator', '2024-04-20 08:41:17.833709+00', '2024-04-20 08:41:17.833709+00', NULL, NULL);

--
-- Data for Name: billing_customers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: subscription_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--

--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 5, true);


--
-- Name: key_key_id_seq; Type: SEQUENCE SET; Schema: pgsodium; Owner: supabase_admin
--

SELECT pg_catalog.setval('"pgsodium"."key_key_id_seq"', 1, false);


--
-- Name: billing_customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."billing_customers_id_seq"', 1, false);


--
-- Name: invitations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."invitations_id_seq"', 19, true);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."role_permissions_id_seq"', 7, true);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 19, true);