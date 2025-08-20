#!/usr/bin/env node

/**
 * Test setup script to validate the application configuration
 */

import { validateConfig, config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

async function testSetup() {
  try {
    console.log('🔍 Testing PR Design Review Bot Setup...\n');

    // Test configuration
    console.log('1. Validating configuration...');
    try {
      validateConfig();
      console.log('   ✅ Configuration is valid');
    } catch (error) {
      console.log('   ❌ Configuration error:', error.message);
      console.log('   📋 Please check your .env file and ensure all required variables are set');
      return;
    }

    // Display configuration (masked)
    console.log('\n2. Configuration summary:');
    console.log(`   📂 Repository: ${config.github.repoOwner}/${config.github.repoName}`);
    console.log(`   🔑 GitHub Token: ${'*'.repeat(10)}${config.github.token?.slice(-4) || 'NOT SET'}`);
    console.log(`   🏢 Atlassian Domain: ${config.confluence.domain}`);
    console.log(`   📧 Atlassian Email: ${config.confluence.email}`);
    console.log(`   🤖 LLM Model: ${config.llm.model}`);
    console.log(`   🔗 LLM Base URL: ${config.llm.baseUrl}`);
    console.log(`   🔵 Azure Mode: ${config.llm.isAzure ? 'Yes' : 'No'}`);
    if (config.llm.isAzure) {
      console.log(`   📦 Deployment: ${config.llm.deploymentName || 'Using model name'}`);
      console.log(`   📅 API Version: ${config.llm.apiVersion}`);
    }
    console.log(`   📊 Log Level: ${config.app.logLevel}`);

    console.log('\n3. Prerequisites check:');
    console.log('   ⚠️  Ensure your GitHub token has repo and PR permissions');
    console.log('   ⚠️  Ensure your Atlassian API token is valid');
    console.log('   ⚠️  Ensure your OpenAI API key has sufficient credits');
    console.log('   ⚠️  Verify your repository and domain settings are correct');

    console.log('\n4. Usage examples:');
    console.log('   Review single PR:    npm start 123');
    console.log('   Review multiple PRs: npm start multiple 123 124 125');
    console.log('   Show help:           npm start --help');

    console.log('\n✅ Setup test completed!');
    console.log('💡 Run "npm start <PR_NUMBER>" to review a PR');

  } catch (error) {
    console.error('❌ Setup test failed:', error.message);
    process.exit(1);
  }
}

testSetup();
