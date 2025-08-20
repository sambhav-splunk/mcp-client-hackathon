# Meeting Summarization Flow

This document explains the new meeting summarization feature that has been added to the PR Design Review Bot.

## Overview

The application now includes a web-based interface that allows you to:

1. Input meeting summaries and transcripts
2. Specify a Confluence design document to update
3. Use AI to analyze the meeting content
4. Automatically update the design document with relevant changes
5. Extract and track action items

## How to Use

### 1. Start the Web Server

```bash
npm run web
```

The web interface will be available at `http://localhost:3000`

### 2. Fill in the Form

The web interface provides three input fields:

- **Confluence Design Document URL** (Required): The URL of the Confluence page containing your design document
- **Meeting Summary** (Required): Key decisions, action items, and notes from the meeting
- **Meeting Transcript** (Optional): Full transcript for additional context

### 3. Submit and Process

Click "Process Meeting & Update Document" to:

- Fetch the current design document from Confluence
- Analyze the meeting content using AI
- Determine what changes should be made to the design document
- Update the Confluence page with relevant information
- Extract action items for tracking

## Example Meeting Summary

Here's an example of what you might enter in the meeting summary field:

```
Meeting: User Authentication Design Review
Date: January 15, 2024
Attendees: John (PM), Sarah (Engineering), Mike (Security)

Key Decisions:
- Decided to implement OAuth 2.0 instead of custom authentication
- Will use JWT tokens with 24-hour expiration
- Added requirement for multi-factor authentication for admin users

Action Items:
- Action: John to create user stories for OAuth integration by Friday
- Action: Sarah to research OAuth 2.0 libraries and create comparison document
- Action: Mike to review security implications and provide recommendations
- Action: Team to schedule follow-up meeting for next Tuesday

Technical Changes:
- Update login endpoint to support OAuth flow
- Add new database tables for OAuth tokens
- Implement token refresh mechanism
- Add MFA support for admin roles

Next Steps:
- Begin implementation after user story approval
- Set up OAuth provider configuration
- Update API documentation
```

## What Happens Next

After processing, the system will:

1. **Analyze** the meeting content against the existing design document
2. **Extract** key decisions and changes that affect the design
3. **Update** the Confluence document with a new section containing:
   - Meeting summary
   - Design changes discussed
   - Action items
   - Next steps
4. **Preserve** the original document content while appending new information

## Features

### AI-Powered Analysis
- Intelligently identifies which meeting points are relevant to the design
- Extracts technical decisions and requirements changes
- Formats content appropriately for Confluence

### Action Item Extraction
- Automatically identifies action items from meeting notes
- Preserves assignee information when provided
- Formats action items for easy tracking

### Safe Document Updates
- Uses Confluence's version control system
- Appends content rather than overwriting
- Includes timestamps and meeting context

### Error Handling
- Validates Confluence URLs
- Handles API errors gracefully
- Provides clear feedback on success or failure

## Technical Implementation

The new flow consists of several key components:

### Web Interface (`public/index.html`)
- Modern, responsive UI with input validation
- Real-time feedback and loading states
- Clean, professional design

### Web Server (`src/web-server.js`)
- Express.js server with API endpoints
- Form validation and error handling
- Integration with meeting summarization service

### Meeting Summarizer (`src/services/meeting-summarizer.js`)
- Orchestrates the entire meeting processing flow
- Integrates Confluence and LLM services
- Handles action item extraction and formatting

### Extended Confluence Service (`src/services/confluence.js`)
- Added document update capabilities
- Version-safe page updates
- Content appending functionality

### Enhanced LLM Service (`src/services/llm.js`)
- New meeting analysis prompts
- JSON-structured response parsing
- Technical decision extraction

## Configuration

The meeting summarization feature uses the same configuration as the PR review bot:

- **Confluence**: `ATLASSIAN_API_TOKEN`, `ATLASSIAN_DOMAIN`, `ATLASSIAN_EMAIL`
- **LLM**: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `LLM_MODEL`
- **Server**: `PORT` (optional, defaults to 3000)

## Benefits

1. **Consistency**: Ensures meeting decisions are properly documented in design documents
2. **Efficiency**: Automates the manual process of updating documentation after meetings
3. **Traceability**: Creates a clear audit trail of design decisions and changes
4. **Action Tracking**: Helps teams track and follow up on action items
5. **Context Preservation**: Maintains the relationship between meetings and design evolution

This enhancement significantly improves the workflow for teams that use design documents to guide their development process, ensuring that important decisions made in meetings are properly captured and documented.
