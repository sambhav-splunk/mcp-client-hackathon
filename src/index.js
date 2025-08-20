#!/usr/bin/env node

import { PRReviewer } from './pr-reviewer.js';
import { validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';

/**
 * Main application entry point
 */
async function main() {
  let reviewer = null;
  
  try {
    // Validate configuration
    logger.info('Starting PR Design Review Bot...');
    validateConfig();
    logger.info('Configuration validated successfully');

    // Get PR number from command line arguments
    const prNumber = process.argv[2];
    
    if (!prNumber) {
      logger.error('Usage: npm start <PR_NUMBER>');
      logger.error('Example: npm start 123');
      process.exit(1);
    }

    const prNum = parseInt(prNumber, 10);
    if (isNaN(prNum) || prNum <= 0) {
      logger.error('Invalid PR number. Please provide a valid positive integer.');
      process.exit(1);
    }

    // Initialize and run the reviewer
    reviewer = new PRReviewer();
    await reviewer.initialize();

    logger.info(`Starting review for PR #${prNum}...`);
    const result = await reviewer.reviewPR(prNum);

    if (result.success) {
      logger.info('✅ Review completed successfully!');
      logger.info(`Review posted to PR #${result.prNumber}`);
      logger.info(`Design document: ${result.designDocUrl}`);
    } else {
      logger.warn('⚠️ Review completed with warnings:', result.message);
    }

  } catch (error) {
    logger.error('❌ Application failed:', error.message);
    logger.debug('Full error:', error);
    process.exit(1);
  } finally {
    // Clean up
    if (reviewer) {
      await reviewer.close();
    }
    logger.info('Application finished');
  }
}

/**
 * Handle multiple PR reviews
 */
async function reviewMultiple() {
  let reviewer = null;
  
  try {
    validateConfig();
    
    const prNumbers = process.argv.slice(3).map(num => parseInt(num, 10));
    
    if (prNumbers.length === 0 || prNumbers.some(num => isNaN(num) || num <= 0)) {
      logger.error('Usage: npm start multiple <PR_NUMBER1> <PR_NUMBER2> ...');
      logger.error('Example: npm start multiple 123 124 125');
      process.exit(1);
    }

    reviewer = new PRReviewer();
    await reviewer.initialize();

    logger.info(`Starting review for ${prNumbers.length} PRs: ${prNumbers.join(', ')}`);
    const results = await reviewer.reviewMultiplePRs(prNumbers);

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`\n📊 Review Summary:`);
    logger.info(`Total PRs: ${results.length}`);
    logger.info(`Successful: ${successful}`);
    logger.info(`Failed: ${failed}`);

    if (failed > 0) {
      logger.warn('\n❌ Failed reviews:');
      results.filter(r => !r.success).forEach(r => {
        logger.warn(`  PR #${r.prNumber}: ${r.error || r.message}`);
      });
    }

  } catch (error) {
    logger.error('❌ Batch review failed:', error.message);
    process.exit(1);
  } finally {
    if (reviewer) {
      await reviewer.close();
    }
  }
}

// Handle different command modes
const command = process.argv[2];

if (command === 'multiple') {
  reviewMultiple();
} else if (command === '--help' || command === '-h') {
  console.log(`
PR Design Review Bot

Usage:
  npm start <PR_NUMBER>                    Review a single PR
  npm start multiple <PR1> <PR2> ...       Review multiple PRs
  npm start --help                         Show this help

Examples:
  npm start 123                            Review PR #123
  npm start multiple 123 124 125           Review PRs #123, #124, and #125

Environment Variables Required:
  GITHUB_TOKEN              GitHub personal access token
  GITHUB_REPO_OWNER          Repository owner
  GITHUB_REPO_NAME           Repository name
  ATLASSIAN_API_TOKEN        Atlassian API token
  ATLASSIAN_DOMAIN           Your Atlassian domain (e.g., company.atlassian.net)
  ATLASSIAN_EMAIL            Your Atlassian email
  OPENAI_API_KEY             OpenAI API key for LLM analysis
  
Optional:
  LLM_MODEL                  LLM model to use (default: gpt-4)
  LOG_LEVEL                  Log level (default: info)
`);
} else {
  main();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});
