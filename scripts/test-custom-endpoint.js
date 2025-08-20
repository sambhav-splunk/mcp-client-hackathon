#!/usr/bin/env node

/**
 * Test the custom Azure responses endpoint with the new implementation
 */

import { LLMService } from '../src/services/llm.js';
import { logger } from '../src/utils/logger.js';

async function testCustomEndpoint() {
  console.log('🧪 Testing Custom Azure Responses Endpoint\n');
  
  try {
    // Initialize LLM service
    const llmService = new LLMService();
    console.log('✅ LLM Service initialized\n');
    
    // Create test data
    const testPRData = {
      prNumber: 1,
      pr: {
        title: 'Test PR for endpoint validation',
        body: 'This is a test PR to validate the custom Azure endpoint.'
      },
      diff: `
diff --git a/test.js b/test.js
new file mode 100644
index 0000000..d3f5a12
--- /dev/null
+++ b/test.js
@@ -0,0 +1 @@
+
console.log('Hello world');
      `
    };
    
    const testDesignDoc = {
      content: {
        title: 'Test Design Document',
        body: {
          storage: {
            value: 'This is a test design document for validating the endpoint.'
          }
        }
      },
      textContent: 'This is a test design document for validating the endpoint.',
      url: 'https://test.atlassian.net/wiki/test',
      pageId: '12345'
    };
    
    console.log('🚀 Making test LLM API call...');
    
    // Test the analyze function
    const analysis = await llmService.analyzeChanges(testPRData, testDesignDoc);
    
    console.log('✅ LLM API call successful!');
    console.log('\n📝 Response received:');
    console.log('=' .repeat(50));
    console.log(analysis);
    console.log('=' .repeat(50));
    
    if (analysis && analysis.length > 0) {
      console.log('\n🎉 SUCCESS! Custom Azure endpoint is working correctly!');
      console.log('\n💡 You can now use the application with:');
      console.log('   npm start <PR_NUMBER>');
    } else {
      console.log('\n⚠️  Warning: Received empty response');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nError details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    if (error.response?.status === 404) {
      console.log('\n💡 This might be a deployment issue. Check Azure Portal for correct deployment name.');
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('\n💡 This might be an authentication issue. Check your API key permissions.');
    }
  }
}

testCustomEndpoint();
