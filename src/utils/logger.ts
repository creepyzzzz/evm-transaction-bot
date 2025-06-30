import winston from 'winston';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';

/**
 * @file Handles all logging for the application using Winston.
 */

interface TxLog {
    timestamp: string;
    wallet: string;
    type: string;
    status: 'success' | 'failure' | 'pending';
    txHash?: string;
    details: string;
    gasUsed?: string;
    error?: string;
}

const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// --- CORRECTED: Re-added a simple console logger that won't flicker ---
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => `[${new Date().toLocaleTimeString()}] ${info.level}: ${info.message}`)
    )
});

const fileAllTransport = new winston.transports.File({
    filename: path.join(logDir, 'all.log'),
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});
const fileErrorTransport = new winston.transports.File({
    filename: path.join(logDir, 'errors.log'),
    level: 'error',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

// Configure the main logger
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        consoleTransport, // Re-enabled for simple status updates
        fileAllTransport,
        fileErrorTransport
    ],
});

const csvPath = path.join(logDir, 'transactions.csv');
const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'wallet', title: 'Wallet' },
        { id: 'type', title: 'Type' },
        { id: 'status', title: 'Status' },
        { id: 'txHash', title: 'TxHash' },
        { id: 'details', title: 'Details' },
        { id: 'gasUsed', title: 'GasUsed' },
        { id: 'error', title: 'Error' }
    ],
    append: fs.existsSync(csvPath),
});

export async function logTransaction(logData: TxLog) {
    try {
        await csvWriter.writeRecords([logData]);
    } catch (error) {
        logger.error('Failed to write to transactions.csv', { error });
    }
}
