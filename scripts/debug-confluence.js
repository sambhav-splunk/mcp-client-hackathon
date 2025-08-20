#!/usr/bin/env node

import { ConfluenceService } from '../src/services/confluence.js';
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

/**
 * Debug script to test Confluence API connectivity and permissions
 */
async function debugConfluence() {
  const confluenceService = new ConfluenceService();
  
  try {
    console.log('🔍 Debugging Confluence API...\n');
    
    // Test 1: Initialize service
    console.log('Test 1: Initializing Confluence service...');
    await confluenceService.initialize();
    console.log('✅ Confluence service initialized successfully\n');
    
    // Test 2: Check configuration
    console.log('Test 2: Configuration check...');
    console.log(`Domain: ${config.confluence.domain}`);
    console.log(`Email: ${config.confluence.email}`);
    console.log(`API Token: ${config.confluence.apiToken ? 'Set' : 'Missing'}\n`);
    
    // Test 3: Test page ID extraction
    const testUrl = process.argv[2];
    if (testUrl) {
      console.log('Test 3: Page ID extraction...');
      console.log(`Test URL: ${testUrl}`);
      const pageId = confluenceService.extractPageId(testUrl);
      console.log(`Extracted Page ID: ${pageId || 'Failed to extract'}\n`);
      
      if (pageId) {
        // Test 4: Try to fetch page content
        console.log('Test 4: Fetching page content...');
        try {
          const pageContent = await confluenceService.getPageContent(testUrl);
          console.log(`✅ Page fetched: ${pageContent.content?.title || 'No title'}`);
          console.log(`Page version: ${pageContent.content?.version?.number || 'Unknown'}`);
          console.log(`Content length: ${pageContent.content?.body?.storage?.value?.length || 0} characters\n`);
          
          // Test 5: Check page permissions (try getting version info)
          console.log('Test 5: Checking page permissions...');
          const versionInfo = await confluenceService.getPageVersion(pageId);
          console.log(`✅ Can read page version: ${versionInfo.version}`);
          console.log(`Page title: ${versionInfo.title}\n`);
          
          // Test 6: Test content sanitization
          console.log('Test 6: Testing content sanitization...');
          const testContent = '<h3>Test Update</h3><p>This is a test content with <strong>bold</strong> text.</p>';
          const sanitized = confluenceService.sanitizeContentForConfluence(testContent);
          console.log('Original content:', testContent);
          console.log('Sanitized content:', sanitized);
          console.log('✅ Content sanitization working\n');
          
        } catch (error) {
          console.error('❌ Error in content tests:', error.message);
          
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
          }
        }
      }
    } else {
      console.log('ℹ️  To test a specific page, provide the Confluence URL as an argument:');
      console.log('   node scripts/debug-confluence.js "https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title"\n');
    }
    
    console.log('🎉 Confluence debugging completed!');
    
  } catch (error) {
    console.error('❌ Confluence debugging failed:', error.message);
    
    if (error.response) {
      console.error('\nDetailed error information:');
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Common error solutions
    console.error('\n🔧 Common solutions for Confluence API errors:');
    console.error('1. Check that ATLASSIAN_API_TOKEN is correct and not expired');
    console.error('2. Verify ATLASSIAN_DOMAIN is correct (e.g., yourcompany.atlassian.net)');
    console.error('3. Ensure ATLASSIAN_EMAIL matches the API token owner');
    console.error('4. Check that you have read/write permissions to the Confluence space');
    console.error('5. Verify the page URL format and that the page exists');
    
  } finally {
    await confluenceService.close();
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  debugConfluence();
}
