#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { MeetingSummarizer } from './services/meeting-summarizer.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Web server for meeting summarization UI
 */
class WebServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.meetingSummarizer = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '..', 'public')));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Serve the main UI page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'meeting-summarizer'
      });
    });

    // Main API endpoint for processing meetings
    this.app.post('/api/process-meeting', this.handleProcessMeeting.bind(this));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    this.app.use((error, req, res, next) => {
      logger.error('Express error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    });
  }

  /**
   * Handle meeting processing API endpoint
   */
  async handleProcessMeeting(req, res) {
    try {
      logger.info('Processing meeting request...');
      
      const { 
        confluence_design_document_url, 
        meeting_summary, 
        meeting_transcript 
      } = req.body;

      // Validate required fields
      if (!confluence_design_document_url || !meeting_summary) {
        return res.status(400).json({
          error: 'Missing required fields: confluence_design_document_url and meeting_summary are required'
        });
      }

      // Validate URL format
      try {
        new URL(confluence_design_document_url);
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid Confluence URL format'
        });
      }

      // Initialize meeting summarizer if not already done
      if (!this.meetingSummarizer) {
        this.meetingSummarizer = new MeetingSummarizer();
        await this.meetingSummarizer.initialize();
      }

      // Process the meeting
      const result = await this.meetingSummarizer.processMeeting({
        confluenceUrl: confluence_design_document_url,
        meetingSummary: meeting_summary,
        meetingTranscript: meeting_transcript || ''
      });

      // Return success response
      res.json({
        success: true,
        message: 'Meeting processed and design document updated successfully',
        updatedDocumentUrl: confluence_design_document_url,
        summary: result.summary,
        updatedContent: result.updatedContent ? 'Design document has been updated' : 'No updates were needed'
      });

    } catch (error) {
      logger.error('Error processing meeting:', error);
      
      res.status(500).json({
        error: error.message || 'Failed to process meeting'
      });
    }
  }

  /**
   * Initialize the web server
   */
  async initialize() {
    try {
      logger.info('Initializing web server...');
      
      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Start the server
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(this.port, (error) => {
          if (error) {
            reject(error);
          } else {
            logger.info(`🚀 Web server started successfully`);
            logger.info(`📱 Access the application at: http://localhost:${this.port}`);
            logger.info(`🔍 Health check available at: http://localhost:${this.port}/health`);
            resolve();
          }
        });
      });

    } catch (error) {
      logger.error('Failed to initialize web server:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown() {
    try {
      logger.info('Shutting down web server...');
      
      // Close meeting summarizer if initialized
      if (this.meetingSummarizer) {
        await this.meetingSummarizer.close();
      }

      // Close the HTTP server
      if (this.server) {
        return new Promise((resolve) => {
          this.server.close(() => {
            logger.info('Web server shut down successfully');
            resolve();
          });
        });
      }
    } catch (error) {
      logger.error('Error during server shutdown:', error);
    }
  }
}

/**
 * Main function to start the web server
 */
async function main() {
  let webServer = null;

  try {
    // Create and initialize web server
    webServer = new WebServer();
    await webServer.initialize();

    // Handle graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      if (webServer) {
        await webServer.shutdown();
      }
      
      process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (error) {
    logger.error('❌ Web server failed to start:', error.message);
    logger.debug('Full error:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { WebServer };
