# Supabase Schema: Enums and Tables Overview

This document provides a detailed overview of the enums and tables within the Supabase schema, highlighting their interactions and dependencies.

## Enums

Enums are used to ensure data consistency by providing a set of predefined values for specific fields. Below are the enums defined in the schema:

- **marital_status_enum**: 
  - Values: 'Single', 'Married', 'Married with Kids', 'Other'
  - Used in: `acct_fin_profile` table

- **income_level_enum**: 
  - Values: 'Less than $25,000', '$25,000 - $50,000', '$50,000 - $75,000', '$75,000 - $100,000', 'More than $100,000'
  - Used in: `acct_fin_profile` table

- **savings_enum**: 
  - Values: 'Less than $1,000', '$1,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', 'More than $25,000'
  - Used in: `acct_fin_profile` table

- **debt_type_enum**: 
  - Values: 'Credit Cards', 'Student Loans', 'Personal Loans', 'Mortgage', 'Auto Loans', 'Other'
  - Used in: `acct_fin_profile` table

- **financial_goal_enum**: 
  - Values: 'Debt - Loans', 'Debt - Credit Cards', 'Save - Build an emergency fund', etc.
  - Used in: `budget_goals` table

- **goal_timeline_enum**: 
  - Values: '6 months', '1 year', '3 years', '5 years or more'
  - Used in: `budget_goals` table

- **monthly_contribution_enum**: 
  - Values: 'Less than $100', '$100 - $250', '$250 - $500', '$500 - $1,000', 'More than $1,000'
  - Used in: `budget_goals` table

- **budget_type**: 
  - Values: 'personal', 'business'
  - Used in: `budgets` table

## Tables

### acct_fin_profile

- **Purpose**: Stores financial profiles of accounts.
- **Key Fields**:
  - `marital_status`: Uses `marital_status_enum`
  - `income_level`: Uses `income_level_enum`
  - `current_debt`: Array of `debt_type_enum`
  - `savings`: Uses `savings_enum`

### plaid_connection_items

- **Purpose**: Stores connection items for Plaid integration, representing a link between a user's account and a financial institution.
- **Key Fields**:
  - `id`: UUID, primary key
  - `account_id`: UUID, references `public.accounts(id)`, not null, unique
  - `plaid_item_id`: Text, not null, unique (Plaid's identifier for the item)
  - `institution_id`: Text, not null (Plaid's identifier for the financial institution)
  - `institution_name`: Text, not null
  - `institution_logo_obj_id`: UUID, references `storage.objects(id)` (for storing institution logos)
  - `access_token`: Text, not null (Plaid access token for the item)
  - `next_cursor`: Text (cursor for Plaid sync operations)
  - `created_at`: Timestamp with time zone
  - `updated_at`: Timestamp with time zone

- **Notes**:
  - This table is crucial for managing Plaid connections for each user's account.
  - The `access_token` field stores sensitive information and should be handled securely.
  - The `next_cursor` field is used for pagination in Plaid's sync operations.
  - The table has a unique constraint on `account_id`, ensuring one Plaid connection per

### plaid_accounts

- **Purpose**: Stores detailed information about financial accounts linked through Plaid.

- **Key Fields**:
  - `id`: UUID, primary key
  - `account_id`: UUID, references `public.accounts(id)`, not null
  - `plaid_conn_item_id`: UUID, references `public.plaid_connection_items(id)`, not null
  - `plaid_account_id`: Text, not null, unique (Plaid's identifier for the account)
  - `plaid_persistent_account_id`: Text, unique (Plaid's persistent identifier for the account)
  - `name`: Text, not null (Account name provided by the financial institution)
  - `official_name`: Text (Official account name, if available)
  - `type`: Text, not null (e.g., checking, savings, credit, loan)
  - `subtype`: Text, not null (More specific account type)
  - `balance_available`: Numeric (Available balance, can be NULL for loans)
  - `balance_current`: Numeric, not null (Current balance)
  - `iso_currency_code`: Text, not null (Currency code for the account)
  - `balance_limit`: Numeric (Credit limit for credit accounts)
  - `mask`: Text (Last 4 digits of the account number)
  - `created_at`: Timestamp with time zone
  - `updated_at`: Timestamp with time zone

- **Relationships**:
  - Links to `public.accounts` through `account_id`
  - Links to `public.plaid_connection_items` through `plaid_conn_item_id`

- **Notes**:
  - This table stores detailed information about each financial account connected through Plaid.
  - The `plaid_account_id` is unique and used for identifying the account within the Plaid system.
  - The `plaid_persistent_account_id` is a stable identifier that remains consistent even if the account is moved to a different Item.  However, the field is often NULL.
  - Balance fields (`balance_available`, `balance_current`, `balance_limit`) store the most recent balance information.
  - The `type` and `subtype` fields provide categorization of the account, useful for filtering and display purposes.
  - The `mask` field can be used to display a partially obscured account number for user verification.

### fin_account_transactions

- **Purpose**: Stores financial transactions associated with Plaid accounts.
- **Key Fields**:
  - `plaid_account_id`: References `plaid_accounts` table

### budgets

- **Purpose**: Manages budget information.
- **Key Fields**:
  - `account_id`: References `accounts` table
  - `budget_type`: Uses `budget_type` enum
  - `category_spending`: JSONB field for storing category spending data
  - `is_active`: Boolean field
  - `start_date`: Date field
  - `end_date`: Date field (optional)

### budget_fin_accounts

- **Purpose**: Links budgets with Plaid accounts.
- **Key Fields**:
  - `budget_id`: References `budgets` table
  - `plaid_account_id`: References `plaid_accounts` table

### budget_goals

- **Purpose**: Stores financial goals associated with budgets.
- **Key Fields**:
  - `budget_id`: References `budgets` table
  - `primary_goal`: Array of `financial_goal_enum`
  - `goal_timeline`: Uses `goal_timeline_enum`
  - `monthly_contribution`: Uses `monthly_contribution_enum`

## Additional Notes

- Row-level security (RLS) policies have been implemented for all tables to ensure data privacy and access control.
- Triggers have been added to enforce constraints on account types (personal vs. team) for certain tables.
