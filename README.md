# RYOMEN's EVM Transaction Automator
## A professional-grade Node.js script for bulk automating EVM testnet transactions with advanced features, a clean interface, and Uniswap V3 compatibility.

### ⭐ Core Features
Multi-Action Engine: Automates Swaps, Add/Remove Liquidity, Wrap/Unwrap native tokens, and Token Sends.

V3 DEX Compatible: Natively handles complex interactions for modern DEXs.

Highly Configurable: Control all behavior from config.json and select DEXs/networks with command-line flags.

Dynamic & Realistic: Randomizes transaction types, amounts, and delays to simulate human behavior.

Robust & Resilient: Features dynamic gas fees, smart retries for failed transactions, and rate limiting.

Secure Multi-Wallet: Loads and uses multiple private keys from a secure .env file.

Telegram Watchdog Alerts: Get instant notifications for critical script failures or successful run completions.

Comprehensive Logging: Saves detailed transaction and error logs to files for easy review.

### 🚀 Setup
Clone Repo:

''' bash
git clone https://github.com/creepyzzzz/evm-transaction-bot

''' cd <your-repo-folder>

Install Dependencies:

npm install

⚙️ Configuration
.env file: Create this file in the main project folder and add your private keys (e.g., PRIVATE_KEY_1="0x..."). This file is git-ignored for security.

config.json file: This is the main control panel. Edit this file to set your RPC URLs, DEX/token addresses, and transaction parameters.

▶️ Usage
Run the Script
To start the bot, run the following command in your terminal:

npm run dev

Command-Line Flags
Override your config.json settings for a single run using flags.

Run on a specific DEX:

npm run dev -- --dex faroSwap

Run a specific number of transactions:

npm run dev -- --txcount 50

Combine flags:

npm run dev -- --dex zenithFinance --txcount 25

Running in the Background (on a Server)
To keep the script running after you disconnect from a server (e.g., via Termius), use a process manager like pm2.

Install PM2:

npm install pm2 -g

Start the bot with PM2:

pm2 start npm --name "ryomen-bot" -- run dev

Manage the bot:

pm2 logs ryomen-bot   # View live logs
pm2 stop ryomen-bot    # Stop the bot
pm2 restart ryomen-bot # Restart the bot

🔔 Setup Telegram Alerts
Create a Bot: Open Telegram, chat with @BotFather, and follow the instructions to get your Bot Token.

Get Your Chat ID:

Find your new bot on Telegram and send it a /start message.

Visit this URL in your browser, replacing <YOUR_BOT_TOKEN> with your token: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

Find "chat":{"id":...} in the response. That number is your chatId.

Update config.json: Add your token and ID to the notifications.telegram section and set enabled to true.
