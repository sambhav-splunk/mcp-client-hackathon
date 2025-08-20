import { GitHubService } from './services/github.js';
import { ConfluenceService } from './services/confluence.js';
import { LLMService } from './services/llm.js';
import { logger } from './utils/logger.js';

/**
 * Main PR reviewer orchestrator that coordinates all services
 */
export class PRReviewer {
  constructor() {
    this.githubService = new GitHubService();
    this.confluenceService = new ConfluenceService();
    this.llmService = new LLMService();
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      logger.info('Initializing PR Reviewer services...');
      
      await Promise.all([
        this.githubService.initialize(),
        this.confluenceService.initialize()
      ]);
      
      logger.info('All services initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize PR Reviewer services:', error);
      throw error;
    }
  }

  /**
   * Main method to review a PR against its design document
   * @param {number} prNumber - The pull request number to review
   * @returns {Object} Review result
   */
  async reviewPR(prNumber) {
    try {
      logger.info(`Starting PR review for PR #${prNumber}...`);
      
      // Step 1: Get PR details and changes
      logger.info('Step 1: Fetching PR details and code changes...');
      const prData = await this.githubService.getPullRequestDetails(prNumber);
      
      if (!prData.pr) {
        throw new Error(`Could not fetch PR #${prNumber}`);
      }

      // Step 2: Extract confluence design document URL
      logger.info('Step 2: Extracting design document URL from PR description...');
      const confluenceUrl = this.githubService.extractConfluenceUrl(prData.pr.body || '');
      
      if (!confluenceUrl) {
        const message = 'No confluence design document URL found in PR description. Please add confluence_design_document_url to the PR description.';
        logger.warn(message);
        
        // Still post a comment to inform the user
        await this.githubService.addPullRequestComment(prNumber, `## ⚠️ Missing Design Document\n\n${message}`);
        
        return {
          success: false,
          message: message,
          prNumber
        };
      }

      // Step 3: Get confluence page content
      logger.info('Step 3: Fetching design document content from Confluence...');
      const designDoc = await this.confluenceService.getPageContent(confluenceUrl);
      
      if (!designDoc.content) {
        throw new Error('Could not fetch design document content from Confluence');
      }

      // Extract text content from confluence page
      designDoc.textContent = this.confluenceService.extractTextContent(designDoc);

      // Step 4: Analyze with LLM
      logger.info('Step 4: Analyzing PR changes against design document...');
      const analysis = await this.llmService.analyzeChanges(prData, designDoc);

      // Step 5: Format and post review comment
      logger.info('Step 5: Posting review comment to PR...');
      const formattedComment = this.llmService.formatAsGitHubComment(analysis, confluenceUrl);
      await this.githubService.addPullRequestComment(prNumber, formattedComment);

      logger.info(`PR review completed successfully for PR #${prNumber}`);
      
      return {
        success: true,
        prNumber,
        designDocUrl: confluenceUrl,
        analysis,
        message: 'PR review completed and comment posted successfully'
      };

    } catch (error) {
      logger.error(`Failed to review PR #${prNumber}:`, error);
      
      // Try to post an error comment to the PR
      try {
        const errorComment = `## ❌ Review Failed\n\nFailed to complete the design document review due to an error:\n\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease check the configuration and try again.`;
        await this.githubService.addPullRequestComment(prNumber, errorComment);
      } catch (commentError) {
        logger.error('Failed to post error comment to PR:', commentError);
      }
      
      throw error;
    }
  }

  /**
   * Clean up and close all service connections
   */
  async close() {
    try {
      logger.info('Closing PR Reviewer services...');
      
      await Promise.all([
        this.githubService.close(),
        this.confluenceService.close()
      ]);
      
      logger.info('All services closed successfully');
    } catch (error) {
      logger.error('Error closing services:', error);
    }
  }

  /**
   * Review multiple PRs
   * @param {number[]} prNumbers - Array of PR numbers to review
   * @returns {Object[]} Array of review results
   */
  async reviewMultiplePRs(prNumbers) {
    const results = [];
    
    for (const prNumber of prNumbers) {
      try {
        const result = await this.reviewPR(prNumber);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          prNumber,
          error: error.message
        });
      }
    }
    
    return results;
  }
}
