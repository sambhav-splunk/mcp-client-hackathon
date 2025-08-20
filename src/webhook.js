#!/usr/bin/env node

import { WebhookServer } from './webhook-server.js';
import { validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';

/**
 * Webhook server entry point
 */
async function startWebhookServer() {
  let server = null;

  try {
    logger.info('🚀 Starting PR Design Review Webhook Server...');

    // Validate configuration
    validateConfig();
    logger.info('✅ Configuration validated successfully');

    // Create and start webhook server
    const webhookServer = new WebhookServer();
    server = await webhookServer.start();

    // Graceful shutdown handlers
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      if (server) {
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      }
      await webhookServer.stop();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    logger.info('✅ Webhook server is ready to receive GitHub webhooks!');

  } catch (error) {
    logger.error('❌ Failed to start webhook server:', error.message);
    logger.debug('Full error:', error);
    process.exit(1);
  }
}

// Start the webhook server
startWebhookServer();

export { startWebhookServer };
