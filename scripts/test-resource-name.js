#!/usr/bin/env node

/**
 * Test different resource name combinations to find the correct one
 */

import axios from 'axios';
import { config } from '../src/config/index.js';

async function testResourceNames() {
  console.log('🔍 Testing Resource Name Variations\n');
  
  const originalUrl = config.llm.baseUrl;
  console.log(`📋 Original URL: ${originalUrl}\n`);
  
  // Extract potential resource names from the original URL
  const possibleNames = [
    'samba-mejzplu3-eastus2',  // Current
    'samba-mejzplu3',          // Without region
    'samba',                   // Short version
    'mejzplu3-eastus2',        // Without samba prefix
    'mejzplu3',                // Just the middle part
  ];
  
  // Test each possible resource name
  for (const resourceName of possibleNames) {
    console.log(`🧪 Testing resource name: ${resourceName}`);
    
    const testUrl = `https://${resourceName}.openai.azure.com`;
    console.log(`   📡 URL: ${testUrl}/openai/deployments?api-version=2024-02-15-preview`);
    
    try {
      const response = await axios.get(`${testUrl}/openai/deployments?api-version=2024-02-15-preview`, {
        headers: {
          'api-key': config.llm.openaiApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`   ✅ SUCCESS! This resource exists!`);
      const deployments = response.data.data || response.data;
      console.log(`   📦 Found ${deployments.length} deployment(s):`);
      
      if (deployments.length > 0) {
        deployments.forEach((deployment, index) => {
          const name = deployment.id || deployment.deployment_name || deployment.name;
          const model = deployment.model || deployment.model_name || deployment.model_id;
          console.log(`      ${index + 1}. ${name} (${model})`);
        });
        
        console.log(`\n🎉 FOUND THE CORRECT CONFIGURATION!`);
        console.log(`\n📋 Update your .env file with:`);
        console.log(`OPENAI_BASE_URL=${testUrl}`);
        console.log(`AZURE_OPENAI_API_VERSION=2024-02-15-preview`);
        
        if (deployments.length > 0) {
          const firstDeployment = deployments[0];
          const deploymentName = firstDeployment.id || firstDeployment.deployment_name || firstDeployment.name;
          const modelName = firstDeployment.model || firstDeployment.model_name || firstDeployment.model_id;
          
          console.log(`AZURE_OPENAI_DEPLOYMENT_NAME=${deploymentName}`);
          console.log(`LLM_MODEL=${modelName}`);
        }
        
        return { resourceName, testUrl, deployments };
      }
      
    } catch (error) {
      const status = error.response?.status || 'timeout/network';
      const message = error.response?.data?.error?.message || error.message;
      console.log(`   ❌ Failed: ${status} - ${message}`);
    }
  }
  
  console.log(`\n❌ None of the resource names worked.`);
  console.log(`\n🔍 Please check:`);
  console.log(`1. Go to Azure Portal (https://portal.azure.com)`);
  console.log(`2. Find your Azure OpenAI resource`);
  console.log(`3. Copy the exact resource name`);
  console.log(`4. Check that your API key has 'Cognitive Services OpenAI User' role`);
  
  return null;
}

testResourceNames().catch(console.error);
