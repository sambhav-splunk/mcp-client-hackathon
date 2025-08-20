#!/usr/bin/env node

/**
 * Test the original endpoint format that the user provided
 */

import axios from 'axios';
import { config } from '../src/config/index.js';

async function testOriginalEndpoint() {
  console.log('🔍 Testing Original Endpoint Format\n');
  
  // Try the original URL format from user's config
  const originalBase = 'https://samba-mejzplu3-eastus2.cognitiveservices.azure.com';
  
  console.log(`📋 Testing endpoint: ${originalBase}\n`);
  
  // Test different endpoint variations
  const testEndpoints = [
    // Original format the user had
    {
      name: 'Original Responses Endpoint',
      url: `${originalBase}/openai/responses`,
      method: 'POST',
      apiVersion: '2025-04-01-preview'
    },
    // Standard chat completions
    {
      name: 'Chat Completions (Cognitive Services)',
      url: `${originalBase}/openai/chat/completions`,
      method: 'POST', 
      apiVersion: '2024-02-15-preview'
    },
    // Try deployments listing with cognitive services format
    {
      name: 'Deployments (Cognitive Services)', 
      url: `${originalBase}/openai/deployments`,
      method: 'GET',
      apiVersion: '2024-02-15-preview'
    },
    // Try without openai prefix
    {
      name: 'Direct Chat Completions',
      url: `${originalBase}/chat/completions`, 
      method: 'POST',
      apiVersion: '2024-02-15-preview'
    }
  ];
  
  for (const endpoint of testEndpoints) {
    console.log(`🧪 Testing: ${endpoint.name}`);
    console.log(`   📡 URL: ${endpoint.url}?api-version=${endpoint.apiVersion}`);
    
    try {
      let response;
      
      if (endpoint.method === 'GET') {
        response = await axios.get(`${endpoint.url}?api-version=${endpoint.apiVersion}`, {
          headers: {
            'api-key': config.llm.openaiApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
      } else {
        // POST request for chat completions
        response = await axios.post(`${endpoint.url}?api-version=${endpoint.apiVersion}`, {
          messages: [
            { role: 'user', content: 'Hello, this is a test.' }
          ],
          max_tokens: 10,
          temperature: 1  // Use temperature=1 for gpt-5-nano
        }, {
          headers: {
            'api-key': config.llm.openaiApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
      }
      
      console.log(`   ✅ SUCCESS!`);
      console.log(`   📝 Response status: ${response.status}`);
      
      if (endpoint.method === 'GET') {
        // Deployments response
        const deployments = response.data.data || response.data;
        console.log(`   📦 Found ${deployments?.length || 0} deployment(s)`);
        if (deployments && deployments.length > 0) {
          deployments.forEach((deployment, index) => {
            const name = deployment.id || deployment.deployment_name || deployment.name;
            const model = deployment.model || deployment.model_name || deployment.model_id;
            console.log(`      ${index + 1}. ${name} (${model})`);
          });
        }
      } else {
        // Chat completion response
        const message = response.data.choices?.[0]?.message?.content;
        console.log(`   💬 Response: ${message || 'No message content'}`);
      }
      
      console.log(`\n🎉 WORKING ENDPOINT FOUND!`);
      console.log(`\n📋 Update your .env file with:`);
      console.log(`OPENAI_BASE_URL=${originalBase}`);
      console.log(`AZURE_OPENAI_API_VERSION=${endpoint.apiVersion}`);
      console.log(`\n💡 This endpoint works with the original cognitiveservices.azure.com format!`);
      
      return { endpoint, response: response.data };
      
    } catch (error) {
      const status = error.response?.status || 'timeout/network';
      const message = error.response?.data?.error?.message || error.message;
      console.log(`   ❌ Failed: ${status} - ${message}`);
    }
  }
  
  console.log(`\n❌ None of the endpoint variations worked.`);
  console.log(`\n🔍 Next steps:`);
  console.log(`1. Check Azure Portal for the exact endpoint URL`);
  console.log(`2. Verify your API key has the correct permissions`);
  console.log(`3. Ensure the resource is in the correct subscription`);
  
  return null;
}

testOriginalEndpoint().catch(console.error);
