# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Meeting Summarization and PR Review Bot.

## Confluence API 400 Error - Bad Request

### What This Error Means
A 400 (Bad Request) error from the Confluence API indicates that the request data is malformed or violates Confluence's validation rules.

### Common Causes and Solutions

#### 1. Invalid HTML Content
**Symptoms**: 400 error when updating pages, especially with complex content
**Solution**: 
- Check the HTML content being sent to Confluence
- Ensure all HTML tags are properly closed
- Use only Confluence-supported HTML elements

```bash
# Run debug script to test content sanitization
node scripts/debug-confluence.js "YOUR_CONFLUENCE_URL"
```

#### 2. Version Conflicts
**Symptoms**: 409 or 400 errors when updating pages
**Solution**: 
- Another user modified the page simultaneously
- The version number in your request is outdated
- Refresh and try again

#### 3. Invalid Page Structure
**Symptoms**: 400 error with validation messages about page structure
**Common Issues**:
- Missing required fields in the update request
- Invalid `id`, `type`, or `version` fields
- Malformed `body.storage.value` content

#### 4. Content Too Large
**Symptoms**: 400 error when content is very large
**Solution**: 
- Check if content exceeds Confluence limits
- Break content into smaller sections
- Remove unnecessary formatting

#### 5. Permission Issues
**Symptoms**: 401/403 errors or 400 errors related to permissions
**Solution**: 
- Verify API token has write permissions to the space
- Check that the user can edit the specific page
- Ensure API token hasn't expired

### Debug Steps

#### Step 1: Check Basic Connectivity
```bash
# Test Confluence connectivity
node scripts/debug-confluence.js
```

#### Step 2: Test Specific Page
```bash
# Test with your specific page URL
node scripts/debug-confluence.js "https://yourcompany.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title"
```

#### Step 3: Enable Debug Logging
Set environment variable:
```bash
export LOG_LEVEL=debug
npm run web
```

#### Step 4: Check Request Data
Look for these log entries:
- `Update data being sent to Confluence:` - Shows the full request body
- `Response data:` - Shows detailed error information from Confluence
- `Sanitized content length:` - Shows processed content size

### Example Error Analysis

If you see an error like:
```json
{
  "errors": [
    {
      "message": "Body cannot be null",
      "field": "body"
    }
  ]
}
```

This indicates:
- The `body` field in the update request is missing or null
- Check that the LLM generated valid content
- Verify content sanitization is working

### Content Validation

The application now includes content sanitization for Confluence:

1. **HTML Validation**: Ensures balanced tags and valid structure
2. **Content Escaping**: Properly escapes special characters
3. **Safe Tags Only**: Allows only Confluence-supported HTML elements
4. **Error Recovery**: Wraps problematic content in safe containers

### Common Confluence HTML Elements

**Supported**:
- `<h1>` to `<h6>` - Headings
- `<p>` - Paragraphs
- `<ul>`, `<ol>`, `<li>` - Lists
- `<strong>`, `<em>` - Text formatting
- `<br>`, `<hr>` - Line breaks and rules
- `<div>`, `<span>` - Containers

**Not Supported**:
- `<script>` - JavaScript
- `<style>` - CSS styles
- `<iframe>` - Embedded content
- Custom tags or attributes

### API Token Issues

#### Creating a New API Token
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a descriptive name
4. Copy the token immediately (it won't be shown again)
5. Update your `.env` file with the new token

#### Testing API Token
```bash
# Test if token works with basic API call
curl -u "your-email@company.com:YOUR_API_TOKEN" \
  "https://yourcompany.atlassian.net/wiki/api/v2/spaces?limit=1"
```

## LLM Service Issues

### OpenAI API Errors
- Check `OPENAI_API_KEY` is valid
- Verify API quota and billing
- Check model availability

### Azure OpenAI Errors
- Verify `OPENAI_BASE_URL` format
- Check `AZURE_OPENAI_API_VERSION`
- Confirm deployment name

### Content Generation Issues
- LLM returns invalid JSON
- Generated HTML is malformed
- Content is too long or too short

## General Debugging

### Enable Debug Mode
```bash
export LOG_LEVEL=debug
npm run web
```

### Check All Environment Variables
```bash
# Verify configuration
node scripts/test-setup.js
```

### Test Individual Components
```bash
# Test Confluence only
node scripts/debug-confluence.js

# Test LLM service
node scripts/azure-openai-debug.js
```

### Common Log Messages

**Success Messages**:
- `Configuration validated successfully`
- `Confluence API client initialized successfully`
- `Successfully updated Confluence page`

**Warning Messages**:
- `HTML tags may not be balanced` - Content sanitization fixing issues
- `Failed to parse JSON response` - LLM returned non-JSON

**Error Messages**:
- `Missing required environment variables` - Configuration issue
- `Unauthorized to update Confluence page` - Permission issue
- `Bad request when updating Confluence page` - Content validation issue

## Getting Help

If you're still experiencing issues:

1. **Check the logs** with debug mode enabled
2. **Run the debug script** with your specific page URL
3. **Verify permissions** in Confluence
4. **Test with a simple page** first
5. **Check API token expiration**

## Error Reference

| Error Code | Description | Common Cause | Solution |
|------------|-------------|--------------|----------|
| 400 | Bad Request | Invalid request data | Check content format and required fields |
| 401 | Unauthorized | Invalid credentials | Verify API token and email |
| 403 | Forbidden | Insufficient permissions | Check page/space permissions |
| 404 | Not Found | Page doesn't exist | Verify page URL and ID |
| 409 | Conflict | Version conflict | Refresh page and retry |
| 500 | Server Error | Confluence internal error | Wait and retry, contact support |
