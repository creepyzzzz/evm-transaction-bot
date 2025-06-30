import { ethers, Wallet, HDNodeWallet, JsonRpcProvider } from 'ethers';
import { RunConfig } from '../config';
import { logger } from './logger';
import dotenv from 'dotenv';

dotenv.config();

/**
 * @file Manages wallet creation, selection, and provider connection.
 */

let wallets: Wallet[] = [];
let currentWalletIndex = 0;

/**
 * Loads wallets from environment variables (PRIVATE_KEY_... or MNEMONIC).
 * @param {JsonRpcProvider} provider - The Ethers JSON RPC provider.
 * @returns {Wallet[]} An array of initialized Ethers Wallets.
 */
export function loadWallets(provider: JsonRpcProvider): Wallet[] {
    const loadedWallets: Wallet[] = [];
    
    // Load from individual private keys
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('PRIVATE_KEY_')) {
            const privateKey = process.env[key];
            if (privateKey) {
                try {
                    loadedWallets.push(new Wallet(privateKey, provider));
                } catch (error) {
                    logger.error(`Invalid private key for ${key}. Skipping.`);
                }
            }
        }
    });

    // Load from mnemonic
    if (process.env.MNEMONIC) {
        try {
            // Assuming you want to use the first 5 accounts from the mnemonic
            for (let i = 0; i < 5; i++) {
                const walletNode = HDNodeWallet.fromPhrase(process.env.MNEMONIC, `m/44'/60'/0'/0/${i}`);
                loadedWallets.push(new Wallet(walletNode.privateKey, provider));
            }
        } catch(e) {
            logger.error(`Invalid Mnemonic. Skipping.`);
        }
    }
    
    if (loadedWallets.length === 0) {
        logger.error("No wallets loaded. Please check your .env file for valid PRIVATE_KEY_... or MNEMONIC entries.");
        process.exit(1);
    }

    logger.info(`Successfully loaded ${loadedWallets.length} wallets.`);
    wallets = loadedWallets;
    return wallets;
}

/**
 * Selects the next wallet based on the configured selection strategy.
 * @param {RunConfig} config - The run configuration.
 * @returns {Wallet} The selected Ethers Wallet.
 */
export function getNextWallet(config: RunConfig): Wallet {
    if (wallets.length === 0) {
        throw new Error("No wallets are available.");
    }

    const selection = config.wallets.selection;

    if (selection === 'random') {
        const randomIndex = Math.floor(Math.random() * wallets.length);
        return wallets[randomIndex];
    }
    
    // Default to 'round-robin'
    const wallet = wallets[currentWalletIndex];
    currentWalletIndex = (currentWalletIndex + 1) % wallets.length;
    return wallet;
}
