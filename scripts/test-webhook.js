#!/usr/bin/env node

/**
 * Test webhook functionality
 */

import axios from 'axios';
import crypto from 'crypto';
import { config } from '../src/config/index.js';

/**
 * Generate GitHub webhook signature for testing
 * @param {Object} payload - The payload to sign
 * @param {string} secret - The webhook secret
 * @returns {string} The signature
 */
function generateWebhookSignature(payload, secret) {
  if (!secret) return null;
  
  const payloadString = JSON.stringify(payload);
  const signature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payloadString, 'utf8')
    .digest('hex');
  
  return signature;
}

async function testWebhook() {
  console.log('🧪 Testing Webhook Functionality\n');

  const baseUrl = `http://localhost:${config.webhook.port}`;
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('   ✅ Health check passed:', healthResponse.data);

    // Test 2: Ping event with proper signature
    console.log('\n2. Testing ping webhook...');
    const pingPayload = { zen: "Design for failure." };
    const pingSignature = generateWebhookSignature(pingPayload, config.webhook.secret);
    
    const pingHeaders = {
      'X-GitHub-Event': 'ping',
      'Content-Type': 'application/json'
    };
    
    if (pingSignature) {
      pingHeaders['X-Hub-Signature-256'] = pingSignature;
    }
    
    const pingResponse = await axios.post(`${baseUrl}${config.webhook.path}`, pingPayload, {
      headers: pingHeaders
    });
    console.log('   ✅ Ping webhook passed:', pingResponse.data);

    // Test 3: Mock PR event (will be skipped - no design doc)
    console.log('\n3. Testing PR webhook (no design doc)...');
    const prPayload = {
      action: 'opened',
      pull_request: {
        number: 999,
        body: 'This is a test PR without design document URL'
      },
      repository: {
        full_name: 'test/repo'
      }
    };

    const prSignature = generateWebhookSignature(prPayload, config.webhook.secret);
    const prHeaders = {
      'X-GitHub-Event': 'pull_request',
      'Content-Type': 'application/json'
    };
    
    if (prSignature) {
      prHeaders['X-Hub-Signature-256'] = prSignature;
    }

    const prResponse = await axios.post(`${baseUrl}${config.webhook.path}`, prPayload, {
      headers: prHeaders
    });
    console.log('   ✅ PR webhook (no design doc) passed:', prResponse.data);

    console.log('\n🎉 All webhook tests passed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start webhook server: npm run webhook');
    console.log('   2. Setup GitHub webhook using WEBHOOK_SETUP.md');
    console.log('   3. Test with real PR containing design document URL');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - webhook server is not running');
      console.log('\n💡 Start the webhook server first:');
      console.log('   npm run webhook');
    } else {
      console.error('❌ Test failed:', error.message);
      if (error.response?.data) {
        console.error('   Response:', error.response.data);
      }
    }
  }
}

testWebhook();
