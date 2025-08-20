# PR Design Review Bot

An intelligent bot that automatically reviews Pull Requests against Confluence design documents using GitHub and Confluence REST APIs, powered by AI analysis.

## Features

- 🔍 **Automated PR Analysis**: Fetches PR details and code changes from GitHub
- 📖 **Design Document Integration**: Extracts and reads Confluence design documents  
- 🤖 **AI-Powered Review**: Uses LLM to analyze code against design specifications
- 💬 **Automated Comments**: Posts detailed review comments directly to GitHub PRs
- 🔧 **Multiple PR Support**: Can review single or multiple PRs in batch
- 📝 **Comprehensive Logging**: Detailed logging for debugging and monitoring
- 🎤 **Meeting Summarization**: NEW - Web UI to process meeting summaries and update design documents
- 📋 **Action Item Tracking**: Extracts and tracks action items from meeting discussions
- 🔄 **Document Updates**: Automatically updates Confluence design documents with meeting insights

## Architecture

The application consists of several key components:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub API    │    │  Confluence API  │    │   LLM Service   │
│    Service      │    │     Service      │    │    (OpenAI)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────────┐
                    │     PR Reviewer         │
                    │   (Main Orchestrator)   │
                    └─────────────────────────┘
```

## Prerequisites

1. **Node.js** (v18 or higher)
2. **API Access**:
   - GitHub Personal Access Token (with repo and PR permissions)
   - Atlassian API Token (for Confluence access)
   - OpenAI API Key (for LLM analysis)

## Installation

1. **Clone and setup the project:**
```bash
git clone <repository-url>
cd MCP-CLIENTS
npm install
```

2. **Configure environment variables:**
```bash
cp env.example .env
```

Edit `.env` file with your credentials:

```bash
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token_here
GITHUB_REPO_OWNER=your_username_or_org
GITHUB_REPO_NAME=your_repository_name

# Confluence Configuration
ATLASSIAN_API_TOKEN=your_atlassian_api_token_here
ATLASSIAN_DOMAIN=yourcompany.atlassian.net
ATLASSIAN_EMAIL=your.email@company.com

# LLM API Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4

# Application Configuration
LOG_LEVEL=info
```

## Usage

### Review a Single PR

```bash
npm start <PR_NUMBER>
```

Example:
```bash
npm start 123
```

### Review Multiple PRs

```bash
npm start multiple <PR1> <PR2> <PR3>
```

Example:
```bash
npm start multiple 123 124 125
```

### Meeting Summarization (NEW)

Start the web interface for meeting summarization:

```bash
npm run web
```

This will start a web server on `http://localhost:3000` where you can:
- Enter meeting summaries and transcripts
- Specify which Confluence design document to update
- Automatically process the meeting content with AI
- Update the design document with relevant changes and action items

**For development with auto-reload:**
```bash
npm run dev-web
```

### Help

```bash
npm start --help
```

## How It Works

### PR Review Flow
1. **PR Analysis**: The bot fetches the specified PR details and code changes from GitHub
2. **Design Document Discovery**: Searches the PR description for `confluence_design_document_url`
3. **Document Retrieval**: Fetches the design document content from Confluence
4. **AI Analysis**: Sends PR changes and design document to LLM for analysis
5. **Review Generation**: LLM generates detailed review comments
6. **Comment Posting**: Posts the review as a comment on the GitHub PR

### Meeting Summarization Flow (NEW)
1. **Meeting Input**: User provides meeting summary, transcript, and Confluence design document URL via web interface
2. **Document Retrieval**: Fetches the current design document content from Confluence
3. **AI Analysis**: LLM analyzes meeting content against the existing design document
4. **Change Detection**: Identifies specific changes, decisions, and action items from the meeting
5. **Document Update**: Automatically appends relevant updates to the Confluence design document
6. **Action Item Extraction**: Extracts and formats action items for tracking

## PR Description Format

For the bot to work, your PR description should include a link to the design document:

```markdown
## Description
This PR implements the new user authentication feature.

## Design Document
confluence_design_document_url: https://yourcompany.atlassian.net/wiki/spaces/TECH/pages/123456/Authentication+Design

## Changes
- Added login endpoint
- Implemented JWT token validation
- Updated user model
```

The bot looks for these patterns in the PR description:
- `confluence_design_document_url: <URL>`
- `confluence_design_document_url <URL>`
- `design_document_url: <URL>`
- `confluence_url: <URL>`

## Configuration Details

### GitHub Token Permissions

Your GitHub token needs the following permissions:
- `repo` (full repository access)
- `pull_requests` (read and write)

### Atlassian API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create a new API token
3. Use your email and the token for authentication

### OpenAI API Key

1. Get your API key from https://platform.openai.com/api-keys
2. Ensure you have sufficient credits for API calls

**Custom OpenAI-Compatible APIs:**
If you're using a custom OpenAI-compatible API endpoint (like a local model or alternative provider), set the `OPENAI_BASE_URL` environment variable:
```bash
OPENAI_BASE_URL=http://localhost:1234/v1  # For local models
# or
OPENAI_BASE_URL=https://your-custom-api.com/v1  # For alternative providers
```

## Project Structure

```
src/
├── config/
│   └── index.js          # Configuration management
├── services/
│   ├── github.js         # GitHub MCP client integration
│   ├── confluence.js     # Confluence MCP client integration
│   └── llm.js           # LLM service for analysis
├── utils/
│   └── logger.js        # Logging utility
├── pr-reviewer.js       # Main orchestrator
└── index.js             # Application entry point
```

## Error Handling

The application includes comprehensive error handling:

- **Configuration Validation**: Checks all required environment variables
- **API Error Handling**: Graceful handling of GitHub, Confluence, and OpenAI API errors
- **Retry Logic**: Automatic retries for transient failures
- **Error Comments**: Posts error messages to PRs when review fails

## Logging

Logs include:
- Application startup and configuration validation
- Service initialization status
- PR processing progress
- API call details (in debug mode)
- Error information with stack traces

Set `LOG_LEVEL=debug` for verbose logging.

## Example Output

When the bot reviews a PR, it posts a comment like:

```markdown
## 🔍 Design Document Review

**Reviewed against:** [Design Document](https://company.atlassian.net/wiki/spaces/TECH/pages/123456/Auth+Design)  
**Review Date:** 2024-01-15T10:30:00.000Z  
**Reviewer:** AI Code Review Bot

---

### ✅ Alignment with Design
The implementation correctly follows the authentication flow described in the design document...

### ⚠️ Missing Implementation  
The following requirements from the design document are not implemented:
- Password complexity validation
- Session timeout handling

### 🔍 Recommendations
1. Add input validation for email format
2. Implement rate limiting as specified in the design
3. Add error handling for database connection failures

---

> This review was automatically generated by comparing the PR changes against the linked design document. Please address any identified issues and feel free to ask for clarification on any points.
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Check that all variables in `.env` are set
   - Verify variable names match exactly

2. **"Could not extract page ID from Confluence URL"**
   - Ensure the Confluence URL is in the correct format
   - Check that the page ID is visible in the URL

3. **"Failed to initialize GitHub MCP client"**
   - Verify `mcp-server-github` is installed and accessible
   - Check GitHub token permissions

4. **"Failed to initialize Confluence MCP client"**
   - Verify `mcp-server-atlassian` is installed
   - Check Atlassian API token and domain

### Debug Mode

Run with debug logging:
```bash
LOG_LEVEL=debug npm start 123
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs with debug mode enabled
3. Open an issue with detailed error information
