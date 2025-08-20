#!/usr/bin/env node

/**
 * Azure OpenAI Debug Tool
 * Helps diagnose Azure OpenAI configuration issues
 */

import axios from 'axios';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

async function debugAzureOpenAI() {
  try {
    console.log('🔍 Azure OpenAI Debug Tool\n');

    // Display current configuration
    console.log('📋 Current Configuration:');
    console.log(`   🔗 Base URL: ${config.llm.baseUrl}`);
    console.log(`   🤖 Model: ${config.llm.model}`);
    console.log(`   📦 Deployment: ${config.llm.deploymentName || 'Not set'}`);
    console.log(`   📅 API Version: ${config.llm.apiVersion}`);
    console.log(`   🔵 Azure Mode: ${config.llm.isAzure}`);
    console.log(`   🔑 API Key: ${'*'.repeat(20)}${config.llm.openaiApiKey?.slice(-10) || 'NOT SET'}\n`);

    // Fix URL format if needed
    let baseUrl = config.llm.baseUrl;
    if (baseUrl.includes('cognitiveservices.azure.com')) {
      const resourceName = baseUrl.match(/https:\/\/([^.]+)/)?.[1];
      if (resourceName) {
        baseUrl = `https://${resourceName}.openai.azure.com`;
        console.log(`⚠️  URL Format Issue Detected!`);
        console.log(`   ❌ Current: ${config.llm.baseUrl}`);
        console.log(`   ✅ Should be: ${baseUrl}\n`);
      }
    }

    // Test 1: Try to list deployments
    console.log('🧪 Test 1: Listing Available Deployments...');
    try {
      const deploymentsUrl = `${baseUrl}/openai/deployments?api-version=${config.llm.apiVersion}`;
      console.log(`   📡 Calling: ${deploymentsUrl}`);
      
      const response = await axios.get(deploymentsUrl, {
        headers: {
          'api-key': config.llm.openaiApiKey,
          'Content-Type': 'application/json'
        }
      });

      const deployments = response.data.data || response.data;
      console.log(`   ✅ Found ${deployments.length} deployment(s):`);
      
      deployments.forEach((deployment, index) => {
        console.log(`   ${index + 1}. 📦 ${deployment.id || deployment.deployment_name}`);
        console.log(`      🤖 Model: ${deployment.model || deployment.model_name}`);
        console.log(`      📊 Status: ${deployment.status || 'unknown'}`);
        console.log(`      🏷️  Capabilities: ${JSON.stringify(deployment.capabilities || {})}`);
      });
      
      if (deployments.length > 0) {
        console.log(`\n💡 Suggested Configuration:`);
        const firstDeployment = deployments[0];
        const deploymentName = firstDeployment.id || firstDeployment.deployment_name;
        const modelName = firstDeployment.model || firstDeployment.model_name;
        
        console.log(`   AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}`);
        console.log(`   LLM_MODEL=${modelName}`);
        console.log(`   OPENAI_BASE_URL=${baseUrl}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Failed to list deployments:`);
      console.log(`   Status: ${error.response?.status || 'unknown'}`);
      console.log(`   Message: ${error.response?.data?.error?.message || error.message}`);
      
      if (error.response?.status === 401) {
        console.log(`   🔑 This suggests an authentication issue. Check your API key.`);
      } else if (error.response?.status === 403) {
        console.log(`   🚫 This suggests a permissions issue. Check your API key permissions.`);
      } else if (error.response?.status === 404) {
        console.log(`   🎯 This suggests the URL or API version is incorrect.`);
      }
    }

    // Test 2: Try a simple chat completion call
    console.log(`\n🧪 Test 2: Testing Chat Completion API...`);
    try {
      const testModel = config.llm.deploymentName || config.llm.model;
      const chatUrl = `${baseUrl}/openai/deployments/${testModel}/chat/completions?api-version=${config.llm.apiVersion}`;
      console.log(`   📡 Calling: ${chatUrl}`);
      
      // Prepare request body with correct token parameter
      const requestBody = {
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ]
      };

      // Handle model-specific parameter restrictions
      if (config.llm.model === 'gpt-5-nano') {
        // gpt-5-nano only supports default temperature (1)
        requestBody.temperature = 1;
      } else {
        requestBody.temperature = 0;
      }

      // Use correct token parameter based on API version
      if (config.llm.apiVersion >= '2024-08-01-preview') {
        requestBody.max_completion_tokens = 10;
      } else {
        requestBody.max_tokens = 10;
      }

      const response = await axios.post(chatUrl, requestBody, {
        headers: {
          'api-key': config.llm.openaiApiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`   ✅ Chat completion successful!`);
      console.log(`   📝 Response: ${response.data.choices[0].message.content}`);
      
    } catch (error) {
      console.log(`   ❌ Chat completion failed:`);
      console.log(`   Status: ${error.response?.status || 'unknown'}`);
      console.log(`   Message: ${error.response?.data?.error?.message || error.message}`);
      
      if (error.response?.status === 404) {
        console.log(`   🎯 The deployment '${config.llm.deploymentName || config.llm.model}' doesn't exist.`);
        console.log(`   💡 Use the deployment names listed above.`);
      }
    }

    // Common issues and solutions
    console.log(`\n🔧 Common Issues & Solutions:`);
    console.log(`1. ❌ Wrong URL format:`);
    console.log(`   Bad:  https://resource.cognitiveservices.azure.com/`);
    console.log(`   Good: https://resource.openai.azure.com`);
    console.log(`\n2. ❌ Model vs Deployment confusion:`);
    console.log(`   - LLM_MODEL should be the actual model (e.g., gpt-4, gpt-35-turbo)`);
    console.log(`   - AZURE_OPENAI_DEPLOYMENT_NAME should match your Azure deployment name`);
    console.log(`\n3. ❌ API Version mismatch:`);
    console.log(`   - Use a stable API version like: 2024-02-15-preview`);
    console.log(`   - Check Azure docs for supported versions`);

  } catch (error) {
    console.error('❌ Debug tool failed:', error.message);
  }
}

debugAzureOpenAI();
