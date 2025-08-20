import { ConfluenceService } from './confluence.js';
import { LLMService } from './llm.js';
import { logger } from '../utils/logger.js';

/**
 * Meeting summarizer service that processes meeting summaries and updates design documents
 */
export class MeetingSummarizer {
  constructor() {
    this.confluenceService = new ConfluenceService();
    this.llmService = new LLMService();
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      logger.info('Initializing Meeting Summarizer services...');
      
      await this.confluenceService.initialize();
      
      logger.info('Meeting Summarizer services initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Meeting Summarizer services:', error);
      throw error;
    }
  }

  /**
   * Main method to process meeting summary and update design document
   * @param {Object} meetingData - Meeting data containing confluenceUrl, meetingSummary, meetingTranscript
   * @returns {Object} Processing result
   */
  async processMeeting(meetingData) {
    try {
      const { confluenceUrl, meetingSummary, meetingTranscript } = meetingData;
      
      logger.info('Starting meeting processing...');
      
      // Step 1: Get the current design document
      logger.info('Step 1: Fetching current design document...');
      const designDoc = await this.confluenceService.getPageContent(confluenceUrl);
      
      if (!designDoc.content) {
        throw new Error('Could not fetch design document content from Confluence');
      }

      // Extract text content from confluence page
      designDoc.textContent = this.confluenceService.extractTextContent(designDoc.content);

      // Step 2: Analyze meeting content with LLM
      logger.info('Step 2: Analyzing meeting content and generating updates...');
      const analysisResult = await this.llmService.analyzeMeetingContent({
        designDocument: designDoc,
        meetingSummary,
        meetingTranscript,
        confluenceUrl
      });

      // Step 3: Update the design document if needed
      logger.info('Step 3: Updating design document...');
      let updateResult = null;
      
      if (analysisResult.shouldUpdate && analysisResult.updatedContent) {
        updateResult = await this.confluenceService.appendToPage(
          confluenceUrl,
          analysisResult.updatedContent,
          'Meeting Discussion Update'
        );
        
        logger.info('Design document updated successfully');
      } else {
        logger.info('No updates needed for the design document');
      }

      // Step 4: Return results
      const result = {
        success: true,
        summary: analysisResult.summary,
        actionItems: analysisResult.actionItems,
        updatedContent: updateResult ? true : false,
        designDocumentUrl: confluenceUrl,
        updateDetails: updateResult
      };

      logger.info('Meeting processing completed successfully');
      return result;

    } catch (error) {
      logger.error('Failed to process meeting:', error);
      throw error;
    }
  }

  /**
   * Process multiple meetings in batch
   * @param {Object[]} meetingDataArray - Array of meeting data objects
   * @returns {Object[]} Array of processing results
   */
  async processMultipleMeetings(meetingDataArray) {
    const results = [];
    
    for (const meetingData of meetingDataArray) {
      try {
        const result = await this.processMeeting(meetingData);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          confluenceUrl: meetingData.confluenceUrl
        });
      }
    }
    
    return results;
  }

  /**
   * Extract action items from meeting summary
   * @param {string} meetingSummary - The meeting summary text
   * @returns {string[]} Array of action items
   */
  extractActionItems(meetingSummary) {
    try {
      const actionItems = [];
      const lines = meetingSummary.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Look for action item patterns
        if (
          trimmedLine.toLowerCase().includes('action:') ||
          trimmedLine.toLowerCase().includes('todo:') ||
          trimmedLine.toLowerCase().includes('- [ ]') ||
          (trimmedLine.startsWith('-') && trimmedLine.toLowerCase().includes('to '))
        ) {
          actionItems.push(trimmedLine);
        }
      }
      
      return actionItems;
    } catch (error) {
      logger.error('Error extracting action items:', error);
      return [];
    }
  }

  /**
   * Format action items for Confluence
   * @param {string[]} actionItems - Array of action items
   * @returns {string} Formatted HTML for Confluence
   */
  formatActionItemsForConfluence(actionItems) {
    if (!actionItems || actionItems.length === 0) {
      return '';
    }

    let html = '<h3>📋 Action Items</h3><ul>';
    
    for (const item of actionItems) {
      // Clean up the action item text
      let cleanItem = item.replace(/^[-*•]\s*/, '')
                         .replace(/^action:/i, '')
                         .replace(/^todo:/i, '')
                         .trim();
      
      html += `<li>${cleanItem}</li>`;
    }
    
    html += '</ul>';
    return html;
  }

  /**
   * Format meeting summary for Confluence
   * @param {string} summary - Meeting summary
   * @param {string} transcript - Meeting transcript (optional)
   * @returns {string} Formatted HTML for Confluence
   */
  formatMeetingSummaryForConfluence(summary, transcript = '') {
    const timestamp = new Date().toLocaleDateString();
    let html = `<h3>📝 Meeting Summary - ${timestamp}</h3>`;
    
    // Add summary
    html += '<h4>Key Points</h4>';
    html += `<p>${summary.replace(/\n/g, '<br/>')}</p>`;
    
    // Add transcript if provided
    if (transcript && transcript.trim()) {
      html += '<h4>Meeting Transcript</h4>';
      html += '<ac:structured-macro ac:name="expand">';
      html += '<ac:parameter ac:name="title">View Full Transcript</ac:parameter>';
      html += '<ac:rich-text-body>';
      html += `<p>${transcript.replace(/\n/g, '<br/>')}</p>`;
      html += '</ac:rich-text-body>';
      html += '</ac:structured-macro>';
    }
    
    return html;
  }

  /**
   * Clean up and close all service connections
   */
  async close() {
    try {
      logger.info('Closing Meeting Summarizer services...');
      
      await this.confluenceService.close();
      
      logger.info('Meeting Summarizer services closed successfully');
    } catch (error) {
      logger.error('Error closing Meeting Summarizer services:', error);
    }
  }
}
