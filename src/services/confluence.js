import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Confluence service using direct API calls for Atlassian/Confluence operations
 */
export class ConfluenceService {
  constructor() {
    this.apiClient = null;
  }

  /**
   * Initialize the Confluence API client
   */
  async initialize() {
    try {
      logger.info('Initializing Confluence API client...');
      
      // Create basic auth header
      const auth = Buffer.from(`${config.confluence.email}:${config.confluence.apiToken}`).toString('base64');
      
      this.apiClient = axios.create({
        baseURL: `https://${config.confluence.domain}/wiki/api/v2`,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Test the connection
      await this.apiClient.get('/spaces?limit=1');
      logger.info('Confluence API client initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize Confluence API client:', error);
      throw error;
    }
  }

  /**
   * Extract page ID from Confluence URL
   * @param {string} confluenceUrl - The full Confluence URL
   * @returns {string|null} The page ID if found
   */
  extractPageId(confluenceUrl) {
    try {
      // Common Confluence URL patterns:
      // https://domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title
      // https://domain.atlassian.net/wiki/display/SPACE/Page+Title?pageId=123456
      
      const patterns = [
        /\/pages\/(\d+)\//,
        /pageId=(\d+)/,
        /\/(\d+)\/[^\/]*$/
      ];

      for (const pattern of patterns) {
        const match = confluenceUrl.match(pattern);
        if (match && match[1]) {
          logger.debug('Extracted page ID:', match[1]);
          return match[1];
        }
      }

      logger.warn('Could not extract page ID from URL:', confluenceUrl);
      return null;
    } catch (error) {
      logger.error('Error extracting page ID:', error);
      return null;
    }
  }

  /**
   * Get Confluence page content
   * @param {string} confluenceUrl - The Confluence page URL
   * @returns {Object} Page content and metadata
   */
  async getPageContent(confluenceUrl) {
    try {
      logger.info('Fetching Confluence page content...');
      
      const pageId = this.extractPageId(confluenceUrl);
      if (!pageId) {
        throw new Error('Could not extract page ID from Confluence URL');
      }

      // Get page content using Confluence API v2
      const response = await this.apiClient.get(`/pages/${pageId}?body-format=storage`);
      
      const pageData = response.data;
      
      logger.info('Successfully fetched Confluence page content');
      logger.debug('Page content preview:', pageData.title || 'No title available');

      return {
        content: pageData,
        url: confluenceUrl,
        pageId
      };
    } catch (error) {
      logger.error('Failed to fetch Confluence page content:', error);
      if (error.response?.status === 404) {
        throw new Error(`Confluence page with ID ${this.extractPageId(confluenceUrl)} not found`);
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Unauthorized to access Confluence page. Check your API token and permissions.');
      }
      throw error;
    }
  }

  /**
   * Extract and clean text content from Confluence storage format
   * @param {Object} pageData - The page data from Confluence API
   * @returns {string} Clean text content
   */
  extractTextContent(pageData) {
    try {
      let content = '';
      
      // Confluence API v2 response structure
      if (pageData.content?.body?.storage?.value) {
        content = pageData.content.body.storage.value;
      } else if (pageData.content?.body?.view?.value) {
        content = pageData.content.body.view.value;
      } else if (pageData.body?.storage?.value) {
        // Direct body access
        content = pageData.body.storage.value;
      } else if (pageData.body?.view?.value) {
        content = pageData.body.view.value;
      }

      if (content) {
        // Remove HTML tags and extract plain text
        content = content
          .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
          .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
          .replace(/&[a-zA-Z0-9#]+;/g, ' ')  // Remove HTML entities
          .replace(/\s+/g, ' ')      // Normalize whitespace
          .trim();
      }

      logger.debug('Extracted text content length:', content.length);
      return content;
    } catch (error) {
      logger.error('Error extracting text content:', error);
      return '';
    }
  }

  /**
   * Update Confluence page content
   * @param {string} pageId - The page ID to update
   * @param {string} newContent - The new content in storage format
   * @param {string} title - The page title
   * @param {number} currentVersion - The current version number of the page
   * @param {string} status - The page status (default: 'current')
   * @returns {Object} Updated page data
   */
  async updatePageContent(pageId, newContent, title, currentVersion, status = 'current') {
    try {
      logger.info(`Updating Confluence page ${pageId}...`);
      
      const updateData = {
        id: pageId,
        type: 'page',
        status: status,
        title: title,
        body: {
          storage: {
            value: newContent,
            representation: 'storage'
          }
        },
        version: {
          number: currentVersion + 1,
          message: 'Updated from meeting summary tool'
        }
      };

      // Log the update data for debugging
      logger.debug('Update data being sent to Confluence:', JSON.stringify(updateData, null, 2));
      logger.debug('Content length:', newContent.length);

      const response = await this.apiClient.put(`/pages/${pageId}`, updateData);
      
      logger.info('Successfully updated Confluence page');
      logger.debug('Updated page data:', response.data?.title || 'No title available');

      return {
        success: true,
        pageData: response.data,
        pageId
      };
    } catch (error) {
      logger.error('Failed to update Confluence page:', error.message);
      
      // Log detailed error information for debugging
      if (error.response) {
        logger.error('Response status:', error.response.status);
        logger.error('Response headers:', error.response.headers);
        logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (error.response?.status === 404) {
        throw new Error(`Confluence page with ID ${pageId} not found`);
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Unauthorized to update Confluence page. Check your API token and permissions.');
      }
      if (error.response?.status === 409) {
        throw new Error('Confluence page has been modified by someone else. Please refresh and try again.');
      }
      if (error.response?.status === 400) {
        const errorDetails = error.response.data?.errors || error.response.data || 'Unknown validation error';
        throw new Error(`Bad request when updating Confluence page: ${JSON.stringify(errorDetails)}`);
      }
      
      throw error;
    }
  }

  /**
   * Get current page version for safe updates
   * @param {string} pageId - The page ID
   * @returns {Object} Page version information
   */
  async getPageVersion(pageId) {
    try {
      const response = await this.apiClient.get(`/pages/${pageId}?body-format=storage`);
      const pageData = response.data;
      
      return {
        version: pageData.version?.number || 1,
        title: pageData.title,
        status: pageData.status || 'current',
        content: pageData.body?.storage?.value || '',
        pageId
      };
    } catch (error) {
      logger.error('Failed to get page version:', error);
      throw error;
    }
  }

  /**
   * Safely update page content with version checking
   * @param {string} confluenceUrl - The Confluence page URL
   * @param {string} newContent - The new content
   * @returns {Object} Update result
   */
  async safeUpdatePageContent(confluenceUrl, newContent) {
    try {
      const pageId = this.extractPageId(confluenceUrl);
      if (!pageId) {
        throw new Error('Could not extract page ID from Confluence URL');
      }

      // Get current page version and content
      const pageInfo = await this.getPageVersion(pageId);
      
      // Update the page
      const result = await this.updatePageContent(
        pageId, 
        newContent, 
        pageInfo.title, 
        pageInfo.version,
        pageInfo.status
      );

      return {
        success: true,
        pageId,
        previousVersion: pageInfo.version,
        newVersion: pageInfo.version + 1,
        url: confluenceUrl
      };
    } catch (error) {
      logger.error('Failed to safely update page content:', error);
      throw error;
    }
  }

  /**
   * Append content to existing page (useful for meeting notes)
   * @param {string} confluenceUrl - The Confluence page URL
   * @param {string} additionalContent - Content to append
   * @param {string} sectionTitle - Optional section title for the new content
   * @returns {Object} Update result
   */
  async appendToPage(confluenceUrl, additionalContent, sectionTitle = 'Meeting Update') {
    try {
      const pageId = this.extractPageId(confluenceUrl);
      if (!pageId) {
        throw new Error('Could not extract page ID from Confluence URL');
      }

      // Get current page content
      const pageInfo = await this.getPageVersion(pageId);
      
      // Create new content by appending
      const timestamp = new Date().toLocaleDateString();
      
      // Clean and validate the additional content
      const cleanContent = this.sanitizeContentForConfluence(additionalContent);
      
      const newSection = `
<h2>${sectionTitle} - ${timestamp}</h2>
${cleanContent}
<hr />
`;
      
      const updatedContent = pageInfo.content + newSection;
      
      // Update the page
      const result = await this.updatePageContent(
        pageId, 
        updatedContent, 
        pageInfo.title, 
        pageInfo.version,
        pageInfo.status
      );

      return {
        success: true,
        pageId,
        previousVersion: pageInfo.version,
        newVersion: pageInfo.version + 1,
        url: confluenceUrl,
        appendedContent: newSection
      };
    } catch (error) {
      logger.error('Failed to append to page:', error);
      throw error;
    }
  }

  /**
   * Sanitize content for Confluence storage format
   * @param {string} content - Raw content to sanitize
   * @returns {string} Sanitized content
   */
  sanitizeContentForConfluence(content) {
    try {
      if (!content || typeof content !== 'string') {
        return '<p>No content provided</p>';
      }

      // Basic HTML validation and cleaning
      let cleanContent = content;

      // Ensure content is properly escaped
      cleanContent = cleanContent
        .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;')  // Escape unescaped ampersands
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')  // Escape < and >
        .replace(/&lt;(\/?(h[1-6]|p|ul|ol|li|strong|em|br|hr|div|span)(\s[^&]*?)?)&gt;/gi, '<$1>'); // Allow safe HTML tags

      // Ensure content is wrapped in proper tags if it's just text
      if (!cleanContent.includes('<') || !cleanContent.includes('>')) {
        cleanContent = `<p>${cleanContent}</p>`;
      }

      // Validate that we have balanced tags for basic HTML elements
      const tagPattern = /<(\w+)(?:\s[^>]*)?>/g;
      const closeTagPattern = /<\/(\w+)>/g;
      
      const openTags = [...cleanContent.matchAll(tagPattern)].map(match => match[1].toLowerCase());
      const closeTags = [...cleanContent.matchAll(closeTagPattern)].map(match => match[1].toLowerCase());
      
      // For self-closing tags, remove them from validation
      const selfClosingTags = ['br', 'hr', 'img'];
      const openTagsFiltered = openTags.filter(tag => !selfClosingTags.includes(tag));
      
      // Basic validation - warn if tags don't balance
      if (openTagsFiltered.length !== closeTags.length) {
        logger.warn('HTML tags may not be balanced, attempting to fix...');
        // Wrap in a div to ensure balanced structure
        cleanContent = `<div>${cleanContent}</div>`;
      }

      logger.debug('Sanitized content length:', cleanContent.length);
      return cleanContent;
    } catch (error) {
      logger.error('Error sanitizing content for Confluence:', error);
      return `<p>Error processing content: ${error.message}</p>`;
    }
  }

  /**
   * Close the Confluence API client connection (cleanup)
   */
  async close() {
    try {
      // No specific cleanup needed for axios client
      logger.info('Confluence API client closed');
    } catch (error) {
      logger.error('Error closing Confluence API client:', error);
    }
  }
}
