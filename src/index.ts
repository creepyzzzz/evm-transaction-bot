import { ethers, JsonRpcProvider } from 'ethers';
import { loadConfig, Config } from './config';
import { logger } from './utils/logger';
import { loadWallets, getNextWallet } from './utils/walletManager';
import { executeSwap, executeAddLiquidity, executeSend, executeWrap, executeUnwrap } from './utils/txBuilder';
import { sendTelegramAlert } from './utils/notifier';
import { program } from 'commander';
import chalk from 'chalk';

/**
 * @file Main entry point for the EVM transaction automation script.
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Displays a stylized welcome banner once.
 */
function displayBanner() {
    const banner = `
██████╗░██╗░░░██╗░█████╗░███╗░░░███╗███████╗███╗░░██╗
██╔══██╗╚██╗░██╔╝██╔══██╗████╗░████║██╔════╝████╗░██║
██████╔╝░╚████╔╝░██║░░██║██╔████╔██║█████╗░░██╔██╗██║
██╔══██╗░░╚██╔╝░░██║░░██║██║╚██╔╝██║██╔══╝░░██║╚████║
██║░░██║░░░██║░░░╚█████╔╝██║░╚═╝░██║███████╗██║░╚███║
╚═╝░░╚═╝░░░╚═╝░░░╚════╝░╚═╝░░░░░╚═╝╚══════╝╚═╝░░╚══╝
    `;
    console.log(chalk.blue.bold(banner));
    console.log(chalk.green.bold('--- EVM Transaction Automator ---'));
    console.log(chalk.yellow('       A Professional Tool for Testnet Automation\n'));
}

async function main() {
    displayBanner();
    
    const config = await loadConfig();
    
    // --- CORRECTED: Restored all command-line options ---
    program
        .option('-n, --network <name>', 'Override network from config')
        .option('-d, --dex <name>', 'Override DEX from config')
        .option('-t, --txcount <number>', 'Override number of transactions')
        .parse(process.argv);
        
    const options = program.opts();

    try {
        if (options.network) config.runConfig.network = options.network;
        if (options.txcount) config.runConfig.transactions.count = parseInt(options.txcount, 10);
        
        // --- CORRECTED: Restored logic for handling DEX selection ---
        if (options.dex) {
            if (!config.dexes[options.dex]) throw new Error(`DEX '${options.dex}' not found`);
            config.runConfig.dex = options.dex;
        }

        logger.info(`Using Network: ${chalk.yellow(config.runConfig.network)} | Using DEX: ${chalk.yellow(config.runConfig.dex)}`);

        const provider = new JsonRpcProvider(config.rpcUrls[config.runConfig.network]);
        const wallets = loadWallets(provider);
        if (wallets.length === 0) {
            logger.error("No wallets loaded. Please check your .env file.");
            return;
        }
        
        const { count, delaySeconds, types, retryCount } = config.runConfig.transactions;
        logger.info(`Starting transaction loop for ${chalk.green(count)} transactions...`);

        for (let i = 0; i < count; i++) {
            const wallet = getNextWallet(config.runConfig);
            logger.info(chalk.cyan(`\n--- Transaction #${i + 1}/${count} | Wallet: ${wallet.address} ---`));
            
            let success = false;
            let attempts = 0;
            const txType = types[Math.floor(Math.random() * types.length)];
            
            logger.info(`Attempting action: ${chalk.blue(txType)}`);

            while (attempts <= retryCount && !success) {
                try {
                    switch (txType) {
                        case 'swap': await executeSwap(wallet, config, provider); break;
                        case 'liquidity': await executeAddLiquidity(wallet, config, provider); break;
                        case 'send': await executeSend(wallet, config, provider); break;
                        case 'wrap': await executeWrap(wallet, config, provider); break;
                        case 'unwrap': await executeUnwrap(wallet, config, provider); break;
                    }
                    success = true;
                    logger.info(chalk.green(`[SUCCESS] Tx #${i + 1} (${txType}) completed.`));
                } catch (e: any) {
                    attempts++;
                    logger.error(`Attempt ${attempts} failed: ${e.message}`);
                    if (attempts > retryCount) {
                        logger.error(chalk.red(`[FAILED] Tx #${i + 1} (${txType}) after all retries.`));
                    } else {
                        logger.warn(chalk.yellow(`Retrying...`));
                        await sleep(5000);
                    }
                }
            }
            
            if (i < count - 1) {
                const delay = Math.floor(getRandomValue(delaySeconds.min, delaySeconds.max)) * 1000;
                logger.info(chalk.gray(`Waiting for ${delay / 1000} seconds...`));
                await sleep(delay);
            }
        }
        
        logger.info(chalk.green.bold('\n--- Script finished successfully! ---'));
        await sendTelegramAlert('✅ Script finished its run successfully!', config);

    } catch (error: any) {
        logger.error(`A critical error occurred: ${error.message}`);
        await sendTelegramAlert(`❌ CRITICAL ERROR: The script has crashed!\n\n*Error:* \`${error.message}\``, config);
        process.exit(1);
    }
}

const getRandomValue = (min: number, max: number): number => Math.random() * (max - min) + min;

main().catch(async (error) => {
    try {
        const config = await loadConfig();
        await sendTelegramAlert(`🔥 UNHANDLED CRASH: The script has crashed unexpectedly!\n\n*Error:* \`${error.message}\``, config);
    } catch (configError) {
        logger.error("CRITICAL: Unhandled error and could not load config to send alert.", { error: configError, originalError: error });
    }
    process.exit(1);
});
