import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * LLM service for analyzing PR changes against design documents
 */
export class LLMService {
  constructor() {
    if (config.llm.isAzure) {
      // Azure OpenAI configuration - fix URL format
      let baseUrl = config.llm.baseUrl;
      
      // Handle different Azure OpenAI URL formats
      if (baseUrl.includes('cognitiveservices.azure.com')) {
        // Keep the original cognitiveservices format if it was working
        logger.info(`Using Cognitive Services URL format: ${baseUrl}`);
      } else if (!baseUrl.includes('openai.azure.com')) {
        // If it's neither format, try to convert to openai.azure.com
        const resourceName = baseUrl.match(/https:\/\/([^.]+)/)?.[1];
        if (resourceName) {
          baseUrl = `https://${resourceName}.openai.azure.com`;
          logger.info(`Converted URL to OpenAI format: ${baseUrl}`);
        }
      }
      
      // Remove trailing slash and ensure proper format
      baseUrl = baseUrl.replace(/\/$/, '');
      
      logger.info(`Azure OpenAI Configuration Debug:`);
      logger.info(`  Original URL: ${config.llm.baseUrl}`);
      logger.info(`  Corrected URL: ${baseUrl}`);
      logger.info(`  API Version: ${config.llm.apiVersion}`);
      logger.info(`  Deployment Name: ${config.llm.deploymentName || 'Using model name'}`);
      logger.info(`  Model: ${config.llm.model}`);
      
      // Configure based on endpoint type
      if (baseUrl.includes('cognitiveservices.azure.com')) {
        // Custom Azure responses endpoint
        this.openai = new OpenAI({
          apiKey: config.llm.openaiApiKey,
          baseURL: `${baseUrl}/openai`,
          defaultQuery: { 'api-version': config.llm.apiVersion },
          defaultHeaders: {
            'api-key': config.llm.openaiApiKey,
            'Content-Type': 'application/json'
          },
        });
      } else {
        // Standard Azure OpenAI format
        this.openai = new OpenAI({
          apiKey: config.llm.openaiApiKey,
          baseURL: baseUrl,
          defaultQuery: { 'api-version': config.llm.apiVersion },
          defaultHeaders: {
            'api-key': config.llm.openaiApiKey,
          },
        });
      }
      
      logger.info(`Azure OpenAI service initialized successfully`);
    } else {
      // Standard OpenAI configuration
      this.openai = new OpenAI({
        apiKey: config.llm.openaiApiKey,
        baseURL: config.llm.baseUrl
      });
      logger.info(`OpenAI service initialized with base URL: ${config.llm.baseUrl}`);
    }
  }

  /**
   * Analyze PR changes against the design document
   * @param {Object} prData - PR details and diff
   * @param {Object} designDoc - Design document content
   * @returns {string} Review comments from the LLM
   */
  async analyzeChanges(prData, designDoc) {
    try {
      logger.info('Analyzing PR changes against design document...');
      
      const prompt = this.buildAnalysisPrompt(prData, designDoc);
      
      const modelOrDeployment = config.llm.isAzure ? 
        (config.llm.deploymentName || config.llm.model) : 
        config.llm.model;

      logger.info(`Making LLM API call with:`);
      logger.info(`  Model/Deployment: ${modelOrDeployment}`);
      logger.info(`  Azure Mode: ${config.llm.isAzure}`);
      logger.info(`  Base URL: ${this.openai.baseURL}`);

      try {
        // Prepare request body based on endpoint type
        let requestBody;
        let isCustomResponsesEndpoint = config.llm.baseUrl.includes('cognitiveservices.azure.com');
        
        if (isCustomResponsesEndpoint) {
          // Custom Azure responses endpoint format (based on working curl)
          requestBody = {
            model: modelOrDeployment,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `${this.getSystemPrompt()}\n\nUser Query: ${prompt}`
                  }
                ]
              }
            ]
          };
        } else {
          // Standard OpenAI format
          requestBody = {
            model: modelOrDeployment,
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt()
              },
              {
                role: 'user', 
                content: prompt
              }
            ]
          };

          // Handle model-specific parameter restrictions for standard format
          if (config.llm.model === 'gpt-5-nano') {
            requestBody.temperature = 1; // Only default value supported
          } else {
            requestBody.temperature = 0.3;
          }

          // Use correct token parameter based on API version for standard format
          if (config.llm.isAzure && config.llm.apiVersion >= '2024-08-01-preview') {
            requestBody.max_completion_tokens = 2000;
          } else {
            requestBody.max_tokens = 2000;
          }
        }

        logger.info(`Request body prepared with token limit: ${requestBody.max_tokens || requestBody.max_completion_tokens}`);
        logger.info(`Full request details:`);
        logger.info(`  Base URL: ${this.openai.baseURL}`);
        logger.info(`  Model/Deployment: ${requestBody.model}`);
        logger.info(`  Temperature: ${requestBody.temperature}`);
        logger.info(`  API Version: ${config.llm.apiVersion}`);
        
        // Log the actual URL that will be called
        let expectedUrl;
        if (isCustomResponsesEndpoint) {
          expectedUrl = `${this.openai.baseURL}/responses`;
        } else if (config.llm.baseUrl.includes('openai.azure.com')) {
          expectedUrl = `${this.openai.baseURL}/openai/deployments/${requestBody.model}/chat/completions`;
        } else {
          expectedUrl = `${this.openai.baseURL}/chat/completions`;
        }
        logger.info(`  Expected URL: ${expectedUrl}`);
        logger.info(`  Request format: ${isCustomResponsesEndpoint ? 'Custom Azure Responses' : 'Standard OpenAI'}`);

        let response;
        if (isCustomResponsesEndpoint) {
          // Use axios directly for custom endpoint since OpenAI SDK doesn't support /responses
          const axios = (await import('axios')).default;
          const fullUrl = `${config.llm.baseUrl}/openai/responses?api-version=${config.llm.apiVersion}`;
          
          logger.info(`  Making direct axios call to: ${fullUrl}`);
          
          const axiosResponse = await axios.post(fullUrl, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'api-key': config.llm.openaiApiKey
            }
          });
          
          // Convert response to OpenAI-like format for compatibility
          response = {
            choices: [{
              message: {
                content: this.extractContentFromCustomResponse(axiosResponse.data)
              }
            }]
          };
        } else {
          // Use standard OpenAI SDK
          response = await this.openai.chat.completions.create(requestBody);
        }
        
        logger.info(`LLM API call successful`);
        
        const analysis = response.choices[0].message.content;
        logger.info('LLM analysis completed');
        logger.debug('Analysis preview:', analysis.substring(0, 200) + '...');
        
        return analysis;
      } catch (error) {
        logger.error(`LLM API call failed with error:`, error.message);
        logger.error(`Error details:`, {
          status: error.status,
          code: error.code,
          type: error.type,
          headers: error.headers
        });
        throw error;
      }
    } catch (error) {
      logger.error('Failed to analyze PR changes:', error);
      throw error;
    }
  }

  /**
   * Build the analysis prompt for the LLM
   * @param {Object} prData - PR details and diff
   * @param {Object} designDoc - Design document content
   * @returns {string} The constructed prompt
   */
  buildAnalysisPrompt(prData, designDoc) {
    return `
Please review the following Pull Request changes against the provided design document and provide detailed feedback.

## Design Document Content:
Title: ${designDoc.content?.title || 'N/A'}
URL: ${designDoc.url}

Content:
${designDoc.textContent || 'No content available'}

## Pull Request Details:
PR Number: #${prData.prNumber}
Title: ${prData.pr?.title || 'N/A'}
Description: ${prData.pr?.body || 'N/A'}

## Code Changes:
\`\`\`diff
${prData.diff || 'No diff available'}
\`\`\`

## Analysis Request:
Please analyze the code changes and provide a comprehensive review that includes:

1. **Alignment with Design**: Check if the implementation aligns with the design document specifications
2. **Missing Implementation**: Identify any features or requirements from the design document that are missing in the code
3. **Conflicting Changes**: Point out any code changes that conflict with the design document
4. **Architecture Compliance**: Verify if the code follows the architectural patterns described in the design
5. **Best Practices**: Note any deviations from best practices mentioned in the design document
6. **Recommendations**: Provide specific recommendations for improvements

Format your response as a structured review comment that can be posted directly to the GitHub PR.
`;
  }

  /**
   * Get the system prompt for the LLM
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `
You are an expert code reviewer specializing in analyzing pull requests against design documents. Your role is to:

1. Carefully compare code implementations with design specifications
2. Identify gaps, conflicts, and missing implementations
3. Provide constructive, actionable feedback
4. Focus on architectural alignment and requirement compliance
5. Suggest specific improvements and corrections

Your reviews should be:
- Professional and constructive
- Specific with clear examples
- Focused on the design document compliance
- Actionable with clear next steps
- Well-structured and easy to read

Always format your response as a proper GitHub PR comment with markdown formatting for clarity.
`;
  }

  /**
   * Extract content from custom Azure responses endpoint response
   * @param {Object} responseData - Raw response from custom endpoint
   * @returns {string} Extracted content
   */
  extractContentFromCustomResponse(responseData) {
    try {
      logger.debug('Raw response data:', JSON.stringify(responseData, null, 2));
      
      // Handle different possible response formats
      if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
        // Standard OpenAI-like format
        return responseData.choices[0].message.content;
      } else if (responseData.output && Array.isArray(responseData.output)) {
        // Custom Azure responses format - look for message type in output array
        const messageOutput = responseData.output.find(item => item.type === 'message');
        if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
          const textContent = messageOutput.content.find(item => item.type === 'output_text');
          if (textContent && textContent.text) {
            return textContent.text;
          }
        }
        
        // Fallback: try first output item
        if (responseData.output[0] && responseData.output[0].content) {
          if (typeof responseData.output[0].content === 'string') {
            return responseData.output[0].content;
          } else if (responseData.output[0].content[0] && responseData.output[0].content[0].text) {
            return responseData.output[0].content[0].text;
          }
        }
      } else if (responseData.response && typeof responseData.response === 'string') {
        // Simple response format
        return responseData.response;
      } else if (responseData.text && typeof responseData.text === 'string') {
        // Simple text format
        return responseData.text;
      } else if (typeof responseData === 'string') {
        // Direct string response
        return responseData;
      }
      
      logger.warn('Unknown response format, returning JSON string');
      return JSON.stringify(responseData, null, 2);
      
    } catch (error) {
      logger.error('Error extracting content from custom response:', error);
      return 'Error: Could not extract content from response';
    }
  }

  /**
   * Analyze meeting content against design document and suggest updates
   * @param {Object} meetingData - Object containing design document, meeting summary, and transcript
   * @returns {Object} Analysis result with updates and action items
   */
  async analyzeMeetingContent(meetingData) {
    try {
      logger.info('Analyzing meeting content for design document updates...');
      
      const { designDocument, meetingSummary, meetingTranscript, confluenceUrl } = meetingData;
      
      const prompt = this.buildMeetingAnalysisPrompt(designDocument, meetingSummary, meetingTranscript, confluenceUrl);
      
      const modelOrDeployment = config.llm.isAzure ? 
        (config.llm.deploymentName || config.llm.model) : 
        config.llm.model;

      logger.info(`Making LLM API call for meeting analysis with:`);
      logger.info(`  Model/Deployment: ${modelOrDeployment}`);
      
      try {
        // Prepare request body
        let requestBody;
        let isCustomResponsesEndpoint = config.llm.baseUrl.includes('cognitiveservices.azure.com');
        
        if (isCustomResponsesEndpoint) {
          // Custom Azure responses endpoint format
          requestBody = {
            model: modelOrDeployment,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `${this.getMeetingSystemPrompt()}\n\nUser Query: ${prompt}`
                  }
                ]
              }
            ]
          };
        } else {
          // Standard OpenAI format
          requestBody = {
            model: modelOrDeployment,
            messages: [
              {
                role: 'system',
                content: this.getMeetingSystemPrompt()
              },
              {
                role: 'user', 
                content: prompt
              }
            ]
          };

          // Handle model-specific parameters
          if (config.llm.model === 'gpt-5-nano') {
            requestBody.temperature = 1;
          } else {
            requestBody.temperature = 0.3;
          }

          // Token parameter based on API version
          if (config.llm.isAzure && config.llm.apiVersion >= '2024-08-01-preview') {
            requestBody.max_completion_tokens = 3000;
          } else {
            requestBody.max_tokens = 3000;
          }
        }

        let response;
        if (isCustomResponsesEndpoint) {
          const axios = (await import('axios')).default;
          const fullUrl = `${config.llm.baseUrl}/openai/responses?api-version=${config.llm.apiVersion}`;
          
          const axiosResponse = await axios.post(fullUrl, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'api-key': config.llm.openaiApiKey
            }
          });
          
          response = {
            choices: [{
              message: {
                content: this.extractContentFromCustomResponse(axiosResponse.data)
              }
            }]
          };
        } else {
          response = await this.openai.chat.completions.create(requestBody);
        }
        
        const analysis = response.choices[0].message.content;
        logger.info('Meeting analysis completed');
        logger.debug('Raw LLM response:', analysis);
        
        // Parse the analysis result
        const parsedResult = this.parseMeetingAnalysis(analysis);
        logger.debug('Parsed analysis result:', JSON.stringify(parsedResult, null, 2));
        
        return parsedResult;
        
      } catch (error) {
        logger.error(`Meeting analysis API call failed:`, error.message);
        throw error;
      }
    } catch (error) {
      logger.error('Failed to analyze meeting content:', error);
      throw error;
    }
  }

  /**
   * Build the meeting analysis prompt for the LLM
   * @param {Object} designDocument - Design document content
   * @param {string} meetingSummary - Meeting summary
   * @param {string} meetingTranscript - Meeting transcript
   * @param {string} confluenceUrl - Confluence document URL
   * @returns {string} The constructed prompt
   */
  buildMeetingAnalysisPrompt(designDocument, meetingSummary, meetingTranscript, confluenceUrl) {
    return `
Please analyze the following meeting summary and transcript to identify changes that should be made to the design document.

## Current Design Document:
Title: ${designDocument.content?.title || 'N/A'}
URL: ${confluenceUrl}

Content:
${designDocument.textContent || 'No content available'}

## Meeting Summary:
${meetingSummary}

## Meeting Transcript:
${meetingTranscript || 'No transcript provided'}

## Analysis Request:
Please analyze the meeting content and provide:

1. **Summary**: A brief summary of the key points discussed in the meeting
2. **Design Changes**: Specific changes or updates that should be made to the design document based on the meeting discussion
3. **Action Items**: Extract clear action items with assignees if mentioned
4. **Should Update**: Determine if the design document should be updated (true/false)
5. **Updated Content**: If updates are needed, provide the HTML content to append to the design document

Please format your response as JSON with the following structure:
{
  "summary": "Brief summary of key meeting points",
  "designChanges": ["List of specific changes discussed"],
  "actionItems": ["List of action items with assignees"],
  "shouldUpdate": true/false,
  "updatedContent": "HTML content to append to document if updates needed",
  "reasoning": "Explanation of why updates are or aren't needed"
}

Focus on:
- Technical decisions that affect the design
- New requirements or features discussed
- Changes to existing specifications
- Architecture or implementation changes
- Performance or security considerations
- Action items that need to be tracked

Only suggest updates if there are concrete changes to the design that were decided in the meeting.
`;
  }

  /**
   * Get the system prompt for meeting analysis
   * @returns {string} System prompt
   */
  getMeetingSystemPrompt() {
    return `
You are an expert technical writer and meeting analyst specializing in extracting actionable insights from design discussions and updating technical documentation. Your role is to:

1. Analyze meeting summaries and transcripts for technical decisions
2. Identify changes that should be reflected in design documents
3. Extract clear action items and next steps
4. Determine when design documents need updates
5. Generate appropriate HTML content for Confluence pages

Your analysis should be:
- Focused on concrete technical decisions and changes
- Clear about what specifically changed or was decided
- Conservative about suggesting updates (only when truly needed)
- Detailed in extracting action items with context
- Professional and well-structured

Always respond with valid JSON format and ensure HTML content is properly formatted for Confluence.
`;
  }

  /**
   * Parse the meeting analysis response from LLM
   * @param {string} analysisText - Raw analysis from LLM
   * @returns {Object} Parsed analysis object
   */
  parseMeetingAnalysis(analysisText) {
    try {
      // Try to parse as JSON first
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const analysis = JSON.parse(jsonMatch[0]);
          return {
            summary: analysis.summary || 'No summary provided',
            designChanges: analysis.designChanges || [],
            actionItems: analysis.actionItems || [],
            shouldUpdate: analysis.shouldUpdate || false,
            updatedContent: analysis.updatedContent || '',
            reasoning: analysis.reasoning || 'No reasoning provided'
          };
        } catch (parseError) {
          logger.warn('Failed to parse JSON response, falling back to text parsing');
        }
      }

      // Fallback to text parsing
      return {
        summary: 'Meeting was analyzed but could not extract structured summary',
        designChanges: [],
        actionItems: this.extractActionItemsFromText(analysisText),
        shouldUpdate: analysisText.toLowerCase().includes('should update') || 
                     analysisText.toLowerCase().includes('needs update'),
        updatedContent: this.extractUpdatedContentFromText(analysisText),
        reasoning: 'Text-based analysis'
      };
    } catch (error) {
      logger.error('Error parsing meeting analysis:', error);
      return {
        summary: 'Error parsing meeting analysis',
        designChanges: [],
        actionItems: [],
        shouldUpdate: false,
        updatedContent: '',
        reasoning: 'Parsing error occurred'
      };
    }
  }

  /**
   * Extract action items from unstructured text
   * @param {string} text - Analysis text
   * @returns {string[]} Array of action items
   */
  extractActionItemsFromText(text) {
    const actionItems = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes('action') || 
          line.toLowerCase().includes('todo') ||
          line.includes('[ ]') ||
          (line.trim().startsWith('-') && line.toLowerCase().includes('assign'))) {
        actionItems.push(line.trim());
      }
    }
    
    return actionItems;
  }

  /**
   * Extract updated content from unstructured text
   * @param {string} text - Analysis text
   * @returns {string} HTML content
   */
  extractUpdatedContentFromText(text) {
    // Look for HTML-like content or structured updates
    const htmlMatch = text.match(/<[^>]+>[\s\S]*<\/[^>]+>/);
    if (htmlMatch) {
      return htmlMatch[0];
    }
    
    // Look for content after "Updated Content:" or similar
    const contentMatch = text.match(/updated content[:\s]+([\s\S]*?)(?=\n\n|\n#|$)/i);
    if (contentMatch) {
      return `<p>${contentMatch[1].trim().replace(/\n/g, '<br/>')}</p>`;
    }
    
    return '';
  }

  /**
   * Format the analysis as a GitHub comment
   * @param {string} analysis - Raw analysis from LLM
   * @param {string} designDocUrl - URL of the design document
   * @returns {string} Formatted GitHub comment
   */
  formatAsGitHubComment(analysis, designDocUrl) {
    const timestamp = new Date().toISOString();
    
    return `
## 🔍 Design Document Review

**Reviewed against:** [Design Document](${designDocUrl})  
**Review Date:** ${timestamp}  
**Reviewer:** AI Code Review Bot

---

${analysis}

---

> This review was automatically generated by comparing the PR changes against the linked design document. Please address any identified issues and feel free to ask for clarification on any points.
`;
  }
}
