import { ethers, Wallet, Contract, JsonRpcProvider, AbiCoder } from 'ethers';
import { Config } from '../config';
import { logger, logTransaction } from './logger';

// --- ABIs ---
const V3_ROUTER_ABI = ["function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory)"];
const V3_POSITION_MANAGER_ABI = [{"inputs": [{"components": [{"internalType": "address", "name": "token0", "type": "address"}, {"internalType": "address", "name": "token1", "type": "address"}, {"internalType": "uint24", "name": "fee", "type": "uint24"}, {"internalType": "int24", "name": "tickLower", "type": "int24"}, {"internalType": "int24", "name": "tickUpper", "type": "int24"}, {"internalType": "uint256", "name": "amount0Desired", "type": "uint256"}, {"internalType": "uint256", "name": "amount1Desired", "type": "uint256"}, {"internalType": "uint256", "name": "amount0Min", "type": "uint256"}, {"internalType": "uint256", "name": "amount1Min", "type": "uint256"}, {"internalType": "address", "name": "recipient", "type": "address"}, {"internalType": "uint256", "name": "deadline", "type": "uint256"}], "internalType": "struct INonfungiblePositionManager.MintParams", "name": "params", "type": "tuple"}], "name": "mint", "outputs": [], "stateMutability": "payable", "type": "function"}];
const ERC20_ABI = ["function allowance(address,address) view returns(uint256)", "function approve(address,uint256) returns(bool)", "function transfer(address,uint256) returns(bool)", "function balanceOf(address) view returns(uint256)", "function decimals() view returns(uint8)", "function deposit() payable", "function withdraw(uint256)"];

// --- Helper Functions ---
const getRandomValue = (min: number, max: number): number => Math.random() * (max - min) + min;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function approveToken(wallet: Wallet, tokenAddress: string, spenderAddress: string, amount: bigint) {
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance = await tokenContract.allowance(wallet.address, spenderAddress);
    if (allowance < amount) {
        const tx = await tokenContract.approve(spenderAddress, ethers.MaxUint256);
        await tx.wait();
        await sleep(5000);
    }
}

export async function executeWrap(wallet: Wallet, config: Config, provider: JsonRpcProvider) {
    const { runConfig, tokens } = config;
    const wphrsAddress = tokens[runConfig.network]['WPHRS'];
    const wphrsContract = new Contract(wphrsAddress, ERC20_ABI, wallet);
    
    const balance = await provider.getBalance(wallet.address);
    const amountToWrap = (balance * BigInt(Math.floor(getRandomValue(runConfig.wrap.amountPercent.min, runConfig.wrap.amountPercent.max) * 100))) / 10000n;

    if (amountToWrap === 0n) throw new Error("Calculated wrap amount is 0");

    const details = `Wrap ${ethers.formatEther(amountToWrap)} PHRS to WPHRS`;
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Wrap', status: 'pending', details });
    
    const tx = await wphrsContract.deposit({ value: amountToWrap });
    const receipt = await tx.wait();
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Wrap', status: 'success', txHash: receipt.hash, details, gasUsed: receipt.gasUsed.toString() });
}

export async function executeUnwrap(wallet: Wallet, config: Config, provider: JsonRpcProvider) {
    const { runConfig, tokens } = config;
    const wphrsAddress = tokens[runConfig.network]['WPHRS'];
    const wphrsContract = new Contract(wphrsAddress, ERC20_ABI, wallet);

    const balance = await wphrsContract.balanceOf(wallet.address);
    const amountToUnwrap = (balance * BigInt(Math.floor(getRandomValue(runConfig.wrap.amountPercent.min, runConfig.wrap.amountPercent.max) * 100))) / 10000n;

    if (amountToUnwrap === 0n) throw new Error("Calculated unwrap amount is 0");

    const details = `Unwrap ${ethers.formatUnits(amountToUnwrap, 18)} WPHRS to PHRS`;
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Unwrap', status: 'pending', details });

    const tx = await wphrsContract.withdraw(amountToUnwrap);
    const receipt = await tx.wait();
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Unwrap', status: 'success', txHash: receipt.hash, details, gasUsed: receipt.gasUsed.toString() });
}

export async function executeSwap(wallet: Wallet, config: Config, provider: JsonRpcProvider) {
    const { runConfig, dexes, tokens } = config;
    const dexConfig = dexes[runConfig.dex];
    if (!dexConfig) throw new Error(`DEX '${runConfig.dex}' not found`);

    const validPairs = runConfig.swap.validPairs;
    const pairToSwap = validPairs[Math.floor(Math.random() * validPairs.length)];
    const [tokenInSymbol, tokenOutSymbol] = pairToSwap;

    const tokenInAddress = tokens[runConfig.network][tokenInSymbol];
    const tokenOutAddress = tokens[runConfig.network][tokenOutSymbol];

    const tokenInContract = new Contract(tokenInAddress, ERC20_ABI, wallet);
    const balance = await tokenInContract.balanceOf(wallet.address);
    const amountIn = (balance * BigInt(Math.floor(getRandomValue(runConfig.swap.amountInPercent.min, runConfig.swap.amountInPercent.max) * 100))) / 10000n;

    if (amountIn === 0n) throw new Error(`Calculated swap amount for ${tokenInSymbol} is 0`);

    const details = `Swap ${ethers.formatUnits(amountIn, await tokenInContract.decimals())} ${tokenInSymbol} for ${tokenOutSymbol}`;
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Swap', status: 'pending', details });

    await approveToken(wallet, tokenInAddress, dexConfig.router, amountIn);

    const routerContract = new Contract(dexConfig.router, V3_ROUTER_ABI, wallet);
    const coder = AbiCoder.defaultAbiCoder();
    const encodedData = coder.encode(["address", "address", "uint24", "address", "uint256", "uint256", "uint256"], [tokenInAddress, tokenOutAddress, 500, wallet.address, amountIn, 0, 0]);
    const multicallData = ['0x04e45aaf' + encodedData.slice(2)];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const feeData = await provider.getFeeData();
    const tx = await routerContract.multicall(deadline, multicallData, { gasLimit: 1000000, maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas });
    const receipt = await tx.wait();
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Swap', status: 'success', txHash: receipt.hash, details, gasUsed: receipt.gasUsed.toString() });
}

export async function executeAddLiquidity(wallet: Wallet, config: Config, provider: JsonRpcProvider) {
    const { runConfig, dexes, tokens } = config;
    const dexConfig = dexes[runConfig.dex];
    if (!dexConfig || !dexConfig.positionManager) throw new Error("Position Manager not configured");

    let [tokenAAddress, tokenBAddress] = [tokens[runConfig.network][runConfig.addLiquidity.tokenA], tokens[runConfig.network][runConfig.addLiquidity.tokenB]];
    if (tokenAAddress.toLowerCase() > tokenBAddress.toLowerCase()) [tokenAAddress, tokenBAddress] = [tokenBAddress, tokenAAddress];
    
    const tokenAContract = new Contract(tokenAAddress, ERC20_ABI, wallet);
    const tokenBContract = new Contract(tokenBAddress, ERC20_ABI, wallet);
    const balanceA = await tokenAContract.balanceOf(wallet.address);
    const balanceB = await tokenBContract.balanceOf(wallet.address);
    const amountADesired = (balanceA * BigInt(Math.floor(getRandomValue(runConfig.addLiquidity.amountAPercent.min, runConfig.addLiquidity.amountAPercent.max) * 100))) / 10000n;
    const amountBDesired = (balanceB * BigInt(Math.floor(getRandomValue(runConfig.addLiquidity.amountBPercent.min, runConfig.addLiquidity.amountBPercent.max) * 100))) / 10000n;

    if (amountADesired === 0n || amountBDesired === 0n) throw new Error("Calculated liquidity amount is 0");

    const details = `Add V3 Liquidity for ${runConfig.addLiquidity.tokenA}/${runConfig.addLiquidity.tokenB}`;
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'AddLiquidity', status: 'pending', details });

    await approveToken(wallet, tokenAAddress, dexConfig.positionManager, amountADesired);
    await approveToken(wallet, tokenBAddress, dexConfig.positionManager, amountBDesired);

    const positionManagerContract = new Contract(dexConfig.positionManager, V3_POSITION_MANAGER_ABI, wallet);
    // --- CORRECTED: Fixed the typo from amount0/1Desired to amountA/BDesired ---
    const mintParams = { token0: tokenAAddress, token1: tokenBAddress, fee: 500, tickLower: -887270, tickUpper: 887270, amount0Desired: amountADesired, amount1Desired: amountBDesired, amount0Min: 0, amount1Min: 0, recipient: wallet.address, deadline: Math.floor(Date.now() / 1000) + 60 * 20 };
    
    const feeData = await provider.getFeeData();
    const tx = await positionManagerContract.mint(mintParams, { gasLimit: 1000000, maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas });
    const receipt = await tx.wait();
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'AddLiquidity', status: 'success', txHash: receipt.hash, details, gasUsed: receipt.gasUsed.toString() });
}

export async function executeSend(wallet: Wallet, config: Config, provider: JsonRpcProvider) {
    const { runConfig, tokens } = config;
    const tokenAddress = tokens[runConfig.network][runConfig.send.token];
    
    let recipient: string | null = null;
    let attempts = 0;
    while (!recipient && attempts < 10) {
        attempts++;
        try {
            const block = await provider.getBlock(await provider.getBlockNumber() - (attempts + 4), true);
            if(block && block.prefetchedTransactions.length > 0) {
                const randomTx = block.prefetchedTransactions[Math.floor(Math.random() * block.prefetchedTransactions.length)];
                if (randomTx?.from && await provider.getCode(randomTx.from) === '0x') recipient = randomTx.from;
            }
        } catch {}
    }
    
    if (!recipient) throw new Error("Failed to find a valid recipient");

    const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    const amount = (balance * BigInt(Math.floor(getRandomValue(runConfig.send.amountPercent.min, runConfig.send.amountPercent.max) * 100))) / 10000n;
    if (amount === 0n) throw new Error("Calculated send amount is 0");

    const details = `Send ${ethers.formatUnits(amount, await tokenContract.decimals())} ${runConfig.send.token} to ${recipient}`;
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Send', status: 'pending', details });

    const feeData = await provider.getFeeData();
    const tx = await tokenContract.transfer(recipient, amount, {maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas});
    const receipt = await tx.wait();
    await logTransaction({ timestamp: new Date().toISOString(), wallet: wallet.address, type: 'Send', status: 'success', txHash: receipt.hash, details, gasUsed: receipt.gasUsed.toString() });
}
