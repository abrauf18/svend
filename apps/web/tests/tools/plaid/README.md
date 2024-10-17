# CLI Tool Design Documentation: Plaid Sandbox Data Generator

## Overview

This document outlines the design for a CLI tool that generates Plaid sandbox data in JSON format. The tool is intended to facilitate testing and development by providing realistic financial data without the need for live data access.

## Features

1. **Generate Plaid Sandbox Data**: The primary function of the tool is to generate Plaid sandbox data in JSON format.
2. **Customizable Data Generation**: Users can specify the type and amount of data to be generated.
3. **Output to File or Console**: The generated data can be output to a file or printed to the console.
4. **Configurable via Command Line Arguments**: The tool can be configured using various command line arguments to customize the data generation process.

## Input Configuration

The CLI tool takes up to 2 arguments:

- `--config`: (Required) Relative path to the JSON configuration file.
- `--output`: (Optional) Output file path. If not provided, the data will be printed to the console.

## Example Configuration File

```json
{
    "transactions": 100,
    "output": "plaid_data.json",
    "accounts": [
      {
        "type": "depository",
        "subtype": "checking",
        "starting_balance": 2682.09,
        "name": "Plaid Checking",
        "official_name": "Plaid Instant Daily Checking Account"
      },
      {
        "type": "depository",
        "subtype": "savings",
        "starting_balance": 2000.09,
        "name": "Plaid Savings",
        "official_name": "Plaid Instant Savings Account"
      },
      {
        "type": "credit",
        "subtype": "credit_card",
        "starting_balance": 10000
      }
    ]
  }
```

## Example Usage

```bash
pnpm plaid-sandbox-data --config ./config.json
```

## Assumptions

- Take the number of accounts from the config file and construct the json for accounts following the second example from "Example Ouptut files" section. Randomize the fields that are not specified in config file.
- Savings only has deposits, one per direct deposit to the checking account
- Credit Card only has 1 payment per month, from the checking account
- Transactions are randomly selected dates over the last 3 months
- All expenses are paid from the credit card
  - Make sure expenses never exceed the credit card limit
  - User will pay off full credit card balance every month
- Basic support for one-off expenses that don't necessarily occur every month
  - Try to randomize amounts of one-off expenses within a reasonable range
- Monthly expenses occur exactly once per month and are paid from the credit card
  - Try to randomize amounts of one-off expenses within a reasonable range
  - Recurring transaction amounts won't change but should show be added as recurring transactions.
  - Description of transactions should follow real world transaction descriptions from "Description of transactions" section.

- Description of transactions
  - Recurring Monthly Transactions (Paid from Credit Card)
    - Housing
      - Description: Rent, Mortgage Payment
    - Utilities
      - Description: Electricity, Water, Gas, Internet
    - Subscriptions
      - Description: Streaming Services (Netflix, Hulu, Spotify, Disney+)
    - Insurance
      - Description: Auto Insurance, Health Insurance
    - Transportation
      - Description: Gasoline, Public Transit, Ride Sharing (Uber, Lyft)
    - Groceries
      - Description: Supermarket, Convenience Store
    - Dining Out
      - Description: Restaurants, Fast Food, Coffee Shops
    - Childcare
      - Description: Daycare, Babysitting
    - Education
      - Description: Tuition Fees, School Supplies
    - Fitness
      - Description: Gym Membership, Fitness Classes
    - Debt Payments
      - Description: Student Loan Payment, Credit Card Payment, Auto Loan Payment
    - Pets
      - Description: Pet Food, Pet Insurance, Veterinary Services
    - Entertainment
      - Description: Movie Theater, Concerts, Video Games
    - Healthcare
      - Description: Doctor Visit, Pharmacy (Prescriptions)
    - Personal Care
      - Description: Haircuts, Salons, Skincare Products
    - Home Improvement
      - Description: Furniture, Appliances, Repairs
    - Travel
      - Description: Airfare, Hotel, Car Rental
    - Gifts
      - Description: Birthday Gifts, Holiday Gifts
    - Hobbies
      - Description: Sports Equipment, Art Supplies, Photography Gear
    - Outdoor Activities
      - Description: Camping Equipment, Park Fees, Fishing Gear
    - Electronics
      - Description: Laptop, Smartphone, Accessories
    - Clothing
      - Description: Retail Stores, Online Shopping
    - Household Supplies
      - Description: Cleaning Products, Toiletries
    - Charity Donations
      - Description: Religious Donations, Non-Profit Contributions
    - Event Tickets
      - Description: Concert Tickets, Sports Events
    - Deposits (Savings Account)
      - Description: Direct Deposit
    - Interest Income
      - Description: Savings Interest
    - Tax Refund
      - Description: Federal or State Tax Refund
    - Cashback
      - Description: Credit Card Cashback, Rewards Program Deposit



#Example Ouptut files:

1- Plaid Sandbox Data with transactions
```json
{
  "override_accounts": [
    {
      "type": "depository",
      "subtype": "checking",
      "transactions": [
        {
          "date_transacted": "2024-10-13",
          "date_posted": "2024-10-14",
          "amount": 398.34,
          "description": "DEBIT CRD AUTOPAY 98712 000000000098712 WRSGTKIUYPKF KJHAUXYOTLL A",
          "currency": "USD"
        }
      ],
      "identity": {
        "names": [
          "John Smith"
        ],
        "addresses": [
          {
            "primary": true,
            "data": {
              "country": "US",
              "city": "New York",
              "street": "10003 Broadway Road",
              "postal_code": "10003",
              "region": "NY"
            }
          }
        ]
      }
    },
    {
      "type": "depository",
      "subtype": "savings",
      "transactions": [
        {
          "date_transacted": "2024-10-13",
          "date_posted": "2024-10-14",
          "amount": 896.65,
          "description": "DEBIT CRD AUTOPAY 98712 000000000028791 KIUYPWRSGTKF UXYOTLLKJHA C",
          "currency": "USD"
        }
      ],
      "identity": {
        "names": [
          "John Smith"
        ],
        "addresses": [
          {
            "primary": true,
            "data": {
              "country": "US",
              "city": "New York",
              "street": "10003 Broadway Road",
              "postal_code": "10003",
              "region": "NY"
            }
          }
        ]
      }
    },
    {
      "type": "credit",
      "subtype": "credit card",
      "starting_balance": 10000,
      "transactions": [
        {
          "date_transacted": "2024-10-13",
          "date_posted": "2024-10-14",
          "amount": 398.34,
          "description": "DEBIT CRD AUTOPAY 98712 000000000098712 WRSGTKIUYPKF KJHAUXYOTLL A",
          "currency": "USD"
        }
      ]
    }
  ]
}
```
