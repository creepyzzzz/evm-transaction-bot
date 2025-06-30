import axios from 'axios';
import { Config } from '../config';
import { logger } from './logger';

/**
 * @file Manages sending notifications for critical script events.
 */

/**
 * Sends an alert message to a configured Telegram chat.
 * @param {string} message - The alert message to send.
 * @param {Config} config - The application's configuration object.
 */
export async function sendTelegramAlert(message: string, config: Config) {
    const telegramConfig = config.notifications?.telegram;

    // Check if Telegram notifications are enabled and configured
    if (!telegramConfig || !telegramConfig.enabled || !telegramConfig.botToken || !telegramConfig.chatId) {
        logger.warn('Telegram notification is not enabled or fully configured. Skipping alert.');
        return;
    }

    const { botToken, chatId } = telegramConfig;
    const url = `https://api.telegram.org/bot$7901658732:AAGLc1_ccqySt7aQYLBR11oxktZwP8DthXQ/sendMessage`;

    try {
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        });
        logger.info('Successfully sent Telegram alert.');
    } catch (error: any) {
        logger.error('Failed to send Telegram alert.');
        // Log detailed error if available
        if (error.response) {
            logger.error(`Telegram API responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        } else {
            logger.error(error.message);
        }
    }
}
