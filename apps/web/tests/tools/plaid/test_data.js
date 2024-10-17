import fs from 'fs';
import path from 'path';

// Function to validate the configuration
function validateConfig(config) {
    if (typeof config.transactions !== 'number' || config.transactions <= 0) {
        throw new Error("Invalid 'transactions' value. It should be a positive number.");
    }
    if (!Array.isArray(config.accounts) || config.accounts.length === 0) {
        throw new Error("Invalid 'accounts' value. It should be a non-empty array.");
    }
    for (const account of config.accounts) {
        if (!account.type || !account.subtype) {
            throw new Error("Each account must have 'type' and 'subtype' specified.");
        }
        if (account.type !== "credit" || account.subtype !== "credit card") {
            if (typeof account.starting_balance !== 'number') {
                throw new Error("Each non-credit card account must have a 'starting_balance' that is a number.");
            }
        }
    }
}

// Function to generate Plaid sandbox data
function generatePlaidData(config) {
    const accounts = config.accounts.map(account => generateAccountData(account, config.transactions));
    return {
        override_accounts: accounts
    };
}

// Function to generate individual account data
function generateAccountData(accountConfig, transactionCount) {
    const { type, subtype, starting_balance } = accountConfig;

    // Generate transactions based on the account type
    const transactions = generateTransactions(type, subtype, transactionCount);

    const accountData = {
        type,
        subtype,
        transactions
    };

    // Add starting_balance for all accounts, including credit card accounts
    accountData.starting_balance = starting_balance || 0;

    // Add identity only for non-credit card accounts
    if (!(type === "credit" && subtype === "credit card")) {
        accountData.identity = generateIdentity();
    }

    return accountData;
}

// Function to generate identity data
function generateIdentity() {
    return {
        names: ["John Smith"],
        addresses: [
            {
                primary: true,
                data: {
                    country: "US",
                    city: "New York",
                    street: "10003 Broadway Road",
                    postal_code: "10003",
                    region: "NY"
                }
            }
        ]
    };
}

// Function to generate transactions based on account type and assumptions
function generateTransactions(accountType, accountSubtype, transactionCount) {
    const transactions = [];
    const monthlyExpenses = {};
    let totalCreditCardSpending = 0;
    const creditCardLimit = 5000; // Example credit card limit
    let currentMonth = null;

    // Realistic recurring and one-off payment scenarios
    const recurringTransactions = [
        { description: "Rent Payment", amount: 1500 },
        { description: "Electricity Bill", amount: 100 },
        { description: "Streaming Service", amount: 15 },
        { description: "Auto Insurance", amount: 200 },
        { description: "Gym Membership Fee", amount: 50 },
        { description: "Internet Service", amount: 60 }
    ];

    const oneOffExpenses = [
        { description: "Concert Tickets", min: 50, max: 150 },
        { description: "Electronics Purchase", min: 100, max: 1000 },
        { description: "Clothing Store", min: 20, max: 200 },
        { description: "Dining at Restaurant", min: 15, max: 100 },
        { description: "Supermarket Grocery", min: 30, max: 300 },
        { description: "Pharmacy Purchase", min: 5, max: 100 },
        { description: "Airfare Ticket", min: 100, max: 1000 },
        { description: "Hotel Stay", min: 80, max: 500 },
        { description: "Taxi Ride", min: 10, max: 50 },
        { description: "School Supplies", min: 10, max: 200 },
        { description: "Doctor Appointment", min: 50, max: 200 }
    ];

    // Generate transactions for the last 3 months
    for (let i = 0; i < transactionCount; i++) {
        const date = getRandomDateWithinLast3Months();
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        let description, amount;

        // Ensure monthly recurring transactions happen once per month
        if (accountType === "credit" && accountSubtype === "credit card" && currentMonth !== monthKey) {
            currentMonth = monthKey;
            recurringTransactions.forEach(({ description: desc, amount: amt }) => {
                if (totalCreditCardSpending + amt <= creditCardLimit) {
                    transactions.push(createTransaction(date, -amt, desc));
                    totalCreditCardSpending += amt;
                    monthlyExpenses[monthKey] = totalCreditCardSpending;
                }
            });
        }

        if (accountType === "depository" && accountSubtype === "savings") {
            // Link savings deposits to checking deposits
            if (monthlyExpenses[monthKey]) {
                description = "Savings Deposit";
                amount = monthlyExpenses[monthKey];
                transactions.push(createTransaction(date, amount, description));
            }
            // Add interest income
            if (Math.random() > 0.8) {
                description = "Interest Income";
                amount = getRandomAmount(5, 50);
                transactions.push(createTransaction(date, amount, description));
            }
        } else if (accountType === "depository" && accountSubtype === "checking") {
            // Checking accounts: Direct deposits and monthly credit card payments
            if (i % 5 === 0 && totalCreditCardSpending > 0) {
                description = "Credit Card Payment";
                amount = totalCreditCardSpending;
                transactions.push(createTransaction(date, -amount, description));
                totalCreditCardSpending = 0;
            } else {
                description = "Salary Deposit";
                amount = getRandomAmount(1000, 5000);
                transactions.push(createTransaction(date, amount, description));
                if (!monthlyExpenses[monthKey]) {
                    monthlyExpenses[monthKey] = amount;
                }
            }
        } else if (accountType === "credit" && accountSubtype === "credit card") {
            // Handle one-off expenses for credit cards
            const { description: desc, min, max } = oneOffExpenses[Math.floor(Math.random() * oneOffExpenses.length)];
            description = desc;
            amount = getRandomAmount(min, max);

            if (totalCreditCardSpending + amount <= creditCardLimit) {
                transactions.push(createTransaction(date, -amount, description));
                totalCreditCardSpending += amount;
            }
        }
    }

    return transactions;
}

// Helper function to create a transaction
function createTransaction(date, amount, description) {
    return {
        date_transacted: date.toISOString().split('T')[0],
        date_posted: new Date(date.setDate(date.getDate() + 1)).toISOString().split('T')[0],
        amount: amount,
        description: description,
        currency: "USD"
    };
}

// Utility function to generate a random date within the last 3 months
function getRandomDateWithinLast3Months() {
    const now = new Date();
    const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
    return new Date(threeMonthsAgo.getTime() + Math.random() * (Date.now() - threeMonthsAgo.getTime()));
}

// Utility function to generate a random amount between min and max
function getRandomAmount(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

// Main function to execute the script
async function main() {
    const args = process.argv.slice(2);
    const configFilePath = args.find(arg => arg.startsWith('--config='))?.split('=')[1];
    const outputFilePath = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

    if (!configFilePath) {
        console.error("Please provide a configuration file path using --config.");
        process.exit(1);
    }

    const configFile = path.resolve(configFilePath);
    if (!fs.existsSync(configFile)) {
        console.error(`Configuration file not found: ${configFile}`);
        process.exit(1);
    }

    try {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        validateConfig(config);
        const plaidData = generatePlaidData(config);

        if (outputFilePath) {
            fs.writeFileSync(path.resolve(outputFilePath), JSON.stringify(plaidData, null, 2));
            console.log(`Plaid data generated and saved to ${outputFilePath}`);
        } else {
            console.log(JSON.stringify(plaidData, null, 2));
        }
    } catch (error) {
        console.error("Error processing configuration file:", error.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error("An unexpected error occurred:", err);
    process.exit(1);
});
