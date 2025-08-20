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
