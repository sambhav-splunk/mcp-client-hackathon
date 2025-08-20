#!/usr/bin/env node

/**
 * Simple script to list Azure OpenAI deployments using different API versions
 */

import axios from 'axios';
import { config } from '../src/config/index.js';

async function listDeployments() {
  console.log('🔍 Listing Azure OpenAI Deployments\n');
  
  // Fix the base URL format
  let baseUrl = config.llm.baseUrl;
  if (baseUrl.includes('cognitiveservices.azure.com')) {
    const resourceName = baseUrl.match(/https:\/\/([^.]+)/)?.[1];
    if (resourceName) {
      baseUrl = `https://${resourceName}.openai.azure.com`;
    }
  }
  baseUrl = baseUrl.replace(/\/$/, '');

  console.log(`📡 Resource: ${baseUrl}`);
  console.log(`🔑 API Key: ${'*'.repeat(30)}${config.llm.openaiApiKey?.slice(-10)}\n`);

  // Try different API versions
  const apiVersions = [
    '2023-05-15',
    '2023-06-01-preview', 
    '2023-07-01-preview',
    '2023-08-01-preview',
    '2023-09-01-preview',
    '2023-10-01-preview',
    '2024-02-01',
    '2024-02-15-preview',
    '2024-03-01-preview',
    '2024-04-01-preview',
    '2024-05-01-preview',
    '2024-06-01',
    '2024-08-01-preview'
  ];

  for (const apiVersion of apiVersions) {
    console.log(`\n🧪 Testing API Version: ${apiVersion}`);
    try {
      const url = `${baseUrl}/openai/deployments?api-version=${apiVersion}`;
      console.log(`   📡 URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'api-key': config.llm.openaiApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const deployments = response.data.data || response.data;
      console.log(`   ✅ SUCCESS! Found ${deployments.length} deployment(s):`);
      
      if (deployments.length === 0) {
        console.log(`   ⚠️  No deployments found`);
      } else {
        deployments.forEach((deployment, index) => {
          const name = deployment.id || deployment.deployment_name || deployment.name;
          const model = deployment.model || deployment.model_name || deployment.model_id;
          const status = deployment.status || 'unknown';
          
          console.log(`   ${index + 1}. 📦 ${name}`);
          console.log(`      🤖 Model: ${model}`);
          console.log(`      📊 Status: ${status}`);
        });
        
        // Return the working API version and deployments
        return { apiVersion, deployments, baseUrl };
      }
      
    } catch (error) {
      const status = error.response?.status || 'timeout/network';
      const message = error.response?.data?.error?.message || error.message;
      console.log(`   ❌ Failed: ${status} - ${message}`);
    }
  }

  console.log(`\n❌ No working API version found. This could mean:`);
  console.log(`   1. Your API key doesn't have the right permissions`);
  console.log(`   2. The resource name is incorrect`);
  console.log(`   3. The resource doesn't exist or is in a different region`);
  
  return null;
}

// Run the function
listDeployments()
  .then(result => {
    if (result) {
      console.log(`\n🎉 SOLUTION FOUND!`);
      console.log(`\n📋 Update your .env file with:`);
      console.log(`OPENAI_BASE_URL=${result.baseUrl}`);
      console.log(`AZURE_OPENAI_API_VERSION=${result.apiVersion}`);
      
      if (result.deployments.length > 0) {
        const firstDeployment = result.deployments[0];
        const deploymentName = firstDeployment.id || firstDeployment.deployment_name || firstDeployment.name;
        const modelName = firstDeployment.model || firstDeployment.model_name || firstDeployment.model_id;
        
        console.log(`AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}`);
        console.log(`LLM_MODEL=${modelName}`);
      }
      
      console.log(`\n💡 Then run: npm run test-setup`);
    }
  })
  .catch(console.error);
