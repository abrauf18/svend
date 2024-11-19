import fs from 'fs';
import path from 'path';

// Function to validate the configuration
function validateConfig(config) {
    if (typeof config.transactions !== 'number' || config.transactions <= 0) {
        throw new Error("Invalid 'transactions' value. It should be a positive number.");
    }
    if (typeof config.numChecking !== 'number' || config.numChecking < 0) {
        throw new Error("Invalid 'numChecking' value. It should be a non-negative number.");
    }
    if (typeof config.numSavings !== 'number' || config.numSavings < 0) {
        throw new Error("Invalid 'numSavings' value. It should be a non-negative number.");
    }
    if (typeof config.numCredit !== 'number' || config.numCredit < 0) {
        throw new Error("Invalid 'numCredit' value. It should be a non-negative number.");
    }
    if (typeof config.numUsers !== 'number' || config.numUsers <= 0) {
        throw new Error("Invalid 'numUsers' value. It should be a positive number.");
    }
    if (typeof config.outputDir !== 'string' || config.outputDir.trim() === "") {
        throw new Error("Invalid 'outputDir' value. It should be a non-empty string.");
    }
}

// Function to generate Plaid sandbox data for a single user
function generateUserData(config) {
    const accounts = [
        ...Array(config.numChecking).fill().map((_, index) => generateAccountData('depository', 'checking', config.transactions, index)),
        ...Array(config.numSavings).fill().map((_, index) => generateAccountData('depository', 'savings', config.transactions, index)),
        ...Array(config.numCredit).fill().map((_, index) => generateAccountData('credit', 'credit card', config.transactions, index))
    ];
    
    return {
        override_accounts: accounts
    };
}

// Function to generate individual account data
function generateAccountData(type, subtype, transactionCount, accountIndex = 0) {
    const starting_balance = type === 'credit' ? 0 : parseFloat((Math.random() * 10000).toFixed(2));
    const transactions = generateTransactions(type, subtype, transactionCount, accountIndex);

    const accountData = {
        type,
        subtype,
        transactions,
        starting_balance
    };

    // Add identity only for non-credit card accounts
    if (!(type === "credit" && subtype === "credit card")) {
        accountData.identity = generateIdentity();
    }

    return accountData;
}

// Function to generate identity data for each user
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
function generateTransactions(accountType, accountSubtype, transactionCount, accountIndex = 0) {
    const transactions = [];
    let lastSalaryDate = null;

    const depositGroups = [
        {
            name: "Freelance Deposits",
            sources: Array.from({ length: 10 }, (_, i) => `Freelance Client ${String.fromCharCode(65 + accountIndex)}${i + 1}`)
        },
        {
            name: "Gift Deposits",
            sources: Array.from({ length: 10 }, (_, i) => `Gift Source ${accountIndex + 1} - Occasion ${i + 1}`)
        },
        {
            name: "Bonus Payments",
            sources: Array.from({ length: 10 }, (_, i) => `Bonus Source ${accountIndex + 1} - Occasion ${i + 1}`)
        },
        {
            name: "Reimbursements",
            sources: Array.from({ length: 10 }, (_, i) => `Reimbursement Type ${accountIndex + 1} - Reason ${i + 1}`)
        }
    ];

    const creditCardGroups = {
        "Bill Payments": [
            { description: "Electricity Bill", min: 50, max: 150 },
            { description: "Water Bill", min: 20, max: 60 },
            { description: "Gas Bill", min: 30, max: 80 },
            { description: "Internet Service", min: 40, max: 100 }
        ],
        "Subscriptions": [
            { description: "Netflix", min: 10, max: 20 },
            { description: "SonyLiv", min: 8, max: 18 },
            { description: "Amazon Prime", min: 12, max: 15 },
            { description: "Co-Working Space", min: 100, max: 200 },
            { description: "Home Rent", min: 800, max: 1500 },
            { description: "Car Installment", min: 300, max: 600 },
            { description: "Bike Installment", min: 50, max: 150 }
        ],
        "Grocery": [
            { description: "Supermarket Grocery", min: 30, max: 300 },
            { description: "Convenience Store", min: 15, max: 100 },
            { description: "Farmers Market", min: 25, max: 150 },
            { description: "Organic Store", min: 20, max: 120 }
        ]
    };

    if (accountType === "depository" && accountSubtype === "checking") {
        for (let i = 0; i < transactionCount; i++) {
            const date = getRandomDateWithinLast3Months();
            const group = depositGroups[Math.floor(Math.random() * depositGroups.length)];
            const source = group.sources[Math.floor(Math.random() * group.sources.length)];

            let description, amount;
            if (i % 20 === 0 && (!lastSalaryDate || (lastSalaryDate && date.getMonth() !== lastSalaryDate.getMonth()))) {
                description = "Salary Deposit";
                amount = getRandomAmount(3000, 7000);
                lastSalaryDate = date;
            } else {
                description = `${group.name} - ${source}`;
                amount = getRandomAmount(100, 2000);
            }
            
            transactions.push(createTransaction(date, amount, description));
        }
    } else if (accountType === "depository" && accountSubtype === "savings") {
        for (let i = 0; i < transactionCount; i++) {
            const date = getRandomDateWithinLast3Months();
            const isInterestIncome = Math.random() < 0.2;
            const amount = isInterestIncome ? getRandomAmount(5, 50) : getRandomAmount(500, 2000);
            const description = isInterestIncome ? "Interest Income" : "Transfer from Checking";
            transactions.push(createTransaction(date, amount, description));
        }
    } else if (accountType === "credit" && accountSubtype === "credit card") {
        let totalSpending = 0;
        const creditLimit = 5000;

        for (let i = 0; i < transactionCount; i++) {
            const date = getRandomDateWithinLast3Months();
            const groupKeys = Object.keys(creditCardGroups);
            const group = creditCardGroups[groupKeys[Math.floor(Math.random() * groupKeys.length)]];
            const transaction = group[Math.floor(Math.random() * group.length)];
            
            const description = transaction.description;
            const amount = getRandomAmount(transaction.min, transaction.max);

            if (totalSpending + amount > creditLimit) break;
            totalSpending += amount;
            transactions.push(createTransaction(date, -amount, description));
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

        if (!fs.existsSync(config.outputDir)) {
            fs.mkdirSync(config.outputDir, { recursive: true });
        }

        // Generate data for each user
        for (let userIndex = 0; userIndex < config.numUsers; userIndex++) {
            const plaidData = generateUserData(config);
            const userFilePath = path.resolve(config.outputDir, `plaid_data_user_${userIndex + 1}.json`);
            fs.writeFileSync(userFilePath, JSON.stringify(plaidData, null, 2));
            console.log(`Plaid data for user ${userIndex + 1} generated and saved to ${userFilePath}`);
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
