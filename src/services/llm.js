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
