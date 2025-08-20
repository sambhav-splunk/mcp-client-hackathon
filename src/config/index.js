import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration object containing all application settings
 */
export const config = {
  github: {
    token: process.env.GITHUB_TOKEN,
    repoOwner: process.env.GITHUB_REPO_OWNER,
    repoName: process.env.GITHUB_REPO_NAME
  },
  
  confluence: {
    apiToken: process.env.ATLASSIAN_API_TOKEN,
    domain: process.env.ATLASSIAN_DOMAIN,
    email: process.env.ATLASSIAN_EMAIL
  },
  
  llm: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.LLM_MODEL || 'gpt-4',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || null,
    isAzure: process.env.OPENAI_BASE_URL?.includes('azure.com') || false
  },
  
  app: {
    logLevel: process.env.LOG_LEVEL || 'debug'
  }
};

/**
 * Validates that all required configuration values are present
 * @throws {Error} If any required configuration is missing
 */
export function validateConfig() {
  const requiredFields = [
    { path: 'github.token', name: 'GITHUB_TOKEN' },
    { path: 'github.repoOwner', name: 'GITHUB_REPO_OWNER' },
    { path: 'github.repoName', name: 'GITHUB_REPO_NAME' },
    { path: 'confluence.apiToken', name: 'ATLASSIAN_API_TOKEN' },
    { path: 'confluence.domain', name: 'ATLASSIAN_DOMAIN' },
    { path: 'confluence.email', name: 'ATLASSIAN_EMAIL' },
    { path: 'llm.openaiApiKey', name: 'OPENAI_API_KEY' }
    // Note: OPENAI_BASE_URL is optional with a default value
  ];

  const missingFields = requiredFields.filter(field => {
    const value = getNestedValue(config, field.path);
    return !value;
  });

  if (missingFields.length > 0) {
    const missingNames = missingFields.map(f => f.name).join(', ');
    throw new Error(`Missing required environment variables: ${missingNames}`);
  }
}

/**
 * Helper function to get nested object values using dot notation
 * @param {Object} obj - The object to search in
 * @param {string} path - The dot-separated path to the value
 * @returns {*} The value at the specified path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
