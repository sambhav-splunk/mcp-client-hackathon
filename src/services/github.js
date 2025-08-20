import axios from 'axios';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * GitHub service using direct API calls for GitHub operations
 */
export class GitHubService {
  constructor() {
    this.apiClient = null;
  }

  /**
   * Initialize the GitHub API client
   */
  async initialize() {
    try {
      logger.info('Initializing GitHub API client...');
      
      this.apiClient = axios.create({
        baseURL: 'https://api.github.com',
        headers: {
          'Authorization': `token ${config.github.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'pr-design-review-bot/1.0.0'
        }
      });

      // Test the connection
      await this.apiClient.get('/user');
      logger.info('GitHub API client initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize GitHub API client:', error);
      throw error;
    }
  }

  /**
   * Get pull request details including changes
   * @param {number} prNumber - The pull request number
   * @returns {Object} PR details and changes
   */
  async getPullRequestDetails(prNumber) {
    try {
      logger.info(`Fetching PR details for PR #${prNumber}...`);
      
      // Get PR details
      const prResponse = await this.apiClient.get(
        `/repos/${config.github.repoOwner}/${config.github.repoName}/pulls/${prNumber}`
      );
      
      const prData = prResponse.data;
      logger.debug('PR details fetched:', { title: prData.title, state: prData.state });
      
      // Get PR diff
      const diffResponse = await this.apiClient.get(
        `/repos/${config.github.repoOwner}/${config.github.repoName}/pulls/${prNumber}`,
        {
          headers: {
            ...this.apiClient.defaults.headers,
            'Accept': 'application/vnd.github.v3.diff'
          }
        }
      );

      logger.debug('PR diff fetched');

      return {
        pr: prData,
        diff: diffResponse.data,
        prNumber
      };
    } catch (error) {
      logger.error(`Failed to fetch PR details for PR #${prNumber}:`, error);
      if (error.response?.status === 404) {
        throw new Error(`PR #${prNumber} not found in ${config.github.repoOwner}/${config.github.repoName}`);
      }
      throw error;
    }
  }

  /**
   * Extract confluence design document URL from PR description
   * @param {string} prDescription - The PR description text
   * @returns {string|null} The confluence URL if found
   */
  extractConfluenceUrl(prDescription) {
    try {
      logger.info('prDescription Test', prDescription);
      logger.info('Extracting confluence URL from PR description...');
      
      // Look for confluence_design_document_url in various formats
      const patterns = [
        /confluence_design_document_url[:\s]*([^\s\n]+)/i,
        /confluence[_\s]*design[_\s]*document[_\s]*url[:\s]*([^\s\n]+)/i,
        /design[_\s]*document[_\s]*url[:\s]*([^\s\n]+)/i,
        /confluence[_\s]*url[:\s]*([^\s\n]+)/i
      ];

      for (const pattern of patterns) {
        const match = prDescription.match(pattern);
        if (match && match[1]) {
          const url = match[1].trim();
          logger.info('Found confluence URL:', url);
          return url;
        }
      }

      logger.warn('No confluence design document URL found in PR description');
      return null;
    } catch (error) {
      logger.error('Error extracting confluence URL:', error);
      return null;
    }
  }

  /**
   * Add a comment to the pull request
   * @param {number} prNumber - The pull request number
   * @param {string} comment - The comment text
   */
  async addPullRequestComment(prNumber, comment) {
    try {
      logger.info(`Adding comment to PR #${prNumber}...`);
      
      const response = await this.apiClient.post(
        `/repos/${config.github.repoOwner}/${config.github.repoName}/issues/${prNumber}/comments`,
        {
          body: comment
        }
      );

      logger.info('Comment added successfully to PR');
      return response.data;
    } catch (error) {
      logger.error(`Failed to add comment to PR #${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * Close the GitHub API client connection (cleanup)
   */
  async close() {
    try {
      // No specific cleanup needed for axios client
      logger.info('GitHub API client closed');
    } catch (error) {
      logger.error('Error closing GitHub API client:', error);
    }
  }
}
