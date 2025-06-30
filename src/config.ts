import { promises as fs } from 'fs';
import path from 'path';

export interface DexConfig {
    router: string;
    positionManager?: string;
}

export interface RunConfig {
    network: string;
    dex: string;
    wallets: { selection: 'round-robin' | 'random' };
    transactions: {
        count: number;
        delaySeconds: { min: number; max: number };
        types: ('swap' | 'liquidity' | 'send' | 'wrap' | 'unwrap')[];
        retryCount: number;
    };
    swap: {
        validPairs: string[][];
        amountInPercent: { min: number; max: number };
    };
    addLiquidity: {
        tokenA: string;
        tokenB: string;
        amountAPercent: { min: number; max: number };
        amountBPercent: { min: number; max: number };
    };
    send: {
        token: string;
        amountPercent: { min: number; max: number };
    };
    wrap: {
        amountPercent: { min: number; max: number };
    };
    dashboard?: {
        displayBalances: string[];
    }
}

export interface Config {
    rpcUrls: { [key: string]: string };
    dexes: { [key: string]: DexConfig };
    tokens: { [key: string]: { [key: string]: string } };
    runConfig: RunConfig;
    notifications: {
        telegram: { enabled: boolean; botToken: string; chatId: string; }
    }
}

export async function loadConfig(): Promise<Config> {
    const configPath = path.resolve(process.cwd(), 'config.json');
    const fileContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(fileContent);
}
