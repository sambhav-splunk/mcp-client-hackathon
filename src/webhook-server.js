import express from 'express';
import crypto from 'crypto';
import { PRReviewer } from './pr-reviewer.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

/**
 * GitHub Webhook Server for automated PR reviews
 */
export class WebhookServer {
  constructor() {
    this.app = express();
    this.prReviewer = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS headers for webhook endpoint
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-GitHub-Event, X-Hub-Signature-256');
      next();
    });

    // Regular JSON parsing for non-webhook routes
    this.app.use((req, res, next) => {
      if (req.path === config.webhook.path) {
        // Skip JSON parsing for webhook routes
        next();
      } else {
        express.json()(req, res, next);
      }
    });

    // Custom parsing for webhook routes only
    this.app.use(config.webhook.path, (req, res, next) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          // Store raw body for signature verification
          req.rawBody = Buffer.from(body);
          
          // Parse payload - GitHub can send as JSON or URL-encoded
          if (body.trim()) {
            let jsonPayload;
            
            // Check if it's URL-encoded (starts with "payload=")
            if (body.startsWith('payload=')) {
              logger.debug('Detected URL-encoded GitHub webhook payload');
              const encodedPayload = body.substring(8); // Remove "payload=" prefix
              const decodedPayload = decodeURIComponent(encodedPayload);
              logger.debug('Decoded payload preview:', decodedPayload.substring(0, 200));
              jsonPayload = JSON.parse(decodedPayload);
            } else {
              // Assume it's direct JSON
              logger.debug('Detected direct JSON webhook payload');
              jsonPayload = JSON.parse(body);
            }
            
            req.body = jsonPayload;
            logger.debug('Successfully parsed webhook payload with keys:', Object.keys(req.body || {}));
          } else {
            logger.warn('Empty webhook payload received');
            req.body = {};
          }
        } catch (e) {
          logger.error('Failed to parse webhook payload:', e.message);
          logger.error('Raw body preview:', body.substring(0, 200));
          req.body = {};
        }
        next();
      });
    });
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'PR Design Review Bot'
      });
    });

    // Main webhook endpoint
    this.app.post(config.webhook.path, async (req, res) => {
      try {
        await this.handleWebhook(req, res);
      } catch (error) {
        logger.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Catch-all route
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Verify GitHub webhook signature
   * @param {Buffer|string} payload - Raw request body
   * @param {string} signature - GitHub signature header
   * @returns {boolean} Whether signature is valid
   */
  verifyGitHubSignature(payload, signature) {
    if (config.webhook.skipSignatureValidation) {
      logger.warn('🚨 Webhook signature validation is DISABLED for development');
      return true;
    }

    if (!config.webhook.secret) {
      logger.warn('No webhook secret configured - skipping signature verification');
      return true;
    }

    if (!signature) {
      logger.error('No signature provided in webhook request');
      return false;
    }

    if (!payload) {
      logger.error('No payload provided for signature verification');
      return false;
    }

    try {
      logger.debug('Signature verification input:', {
        payloadType: typeof payload,
        payloadLength: payload?.length,
        isBuffer: Buffer.isBuffer(payload),
        signaturePresent: !!signature
      });

      // Ensure payload is a string or buffer for HMAC
      let payloadForHmac = payload;
      if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        payloadForHmac = JSON.stringify(payload);
        logger.debug('Converted object payload to JSON string for HMAC');
      } else if (Buffer.isBuffer(payload)) {
        payloadForHmac = payload;
        logger.debug('Using Buffer payload for HMAC');
      } else if (typeof payload === 'string') {
        payloadForHmac = payload;
        logger.debug('Using string payload for HMAC');
      } else {
        logger.error('Invalid payload type for signature verification:', typeof payload);
        return false;
      }

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', config.webhook.secret)
        .update(payloadForHmac, 'utf8')
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      logger.debug('Signature verification result:', {
        provided: signature,
        expected: expectedSignature,
        valid: isValid
      });

      return isValid;
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle incoming webhook requests
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleWebhook(req, res) {
    const eventType = req.headers['x-github-event'];
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.body;

    logger.info(`Received GitHub webhook: ${eventType}`);
    logger.debug('Webhook payload details:', {
      payloadType: typeof payload,
      payloadKeys: payload ? Object.keys(payload) : [],
      hasAction: !!payload?.action,
      hasNumber: !!payload?.number,
      hasRepository: !!payload?.repository
    });
    logger.debug('Webhook headers:', {
      event: eventType,
      hasSignature: !!signature,
      hasRawBody: !!req.rawBody,
      rawBodyType: typeof req.rawBody
    });

    // Verify signature
    if (!this.verifyGitHubSignature(req.rawBody, signature)) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle different event types
    switch (eventType) {
      case 'pull_request':
        await this.handlePullRequestEvent(payload, res);
        break;
      
      case 'pull_request_review':
        await this.handlePullRequestReviewEvent(payload, res);
        break;

      case 'ping':
        logger.info('Webhook ping received');
        res.json({ message: 'pong', timestamp: new Date().toISOString() });
        break;

      default:
        logger.info(`Ignoring webhook event: ${eventType}`);
        res.json({ message: `Event ${eventType} not handled` });
    }
  }

  /**
   * Handle pull request events (opened, updated, etc.)
   * @param {Object} payload - GitHub webhook payload
   * @param {Object} res - Express response object
   */
  async handlePullRequestEvent(payload, res) {
    // Payload is correctly parsed as object - see debug logs above
    const action = payload.action;
    const prNumber = payload.number; // GitHub webhook puts PR number at top level
    const repoName = payload.repository?.full_name;

    logger.info(`PR ${action}: #${prNumber} in ${repoName}`);

    // Only process certain actions
    const reviewableActions = ['opened', 'synchronize', 'edited'];
    
    if (!reviewableActions.includes(action)) {
      logger.info(`Ignoring PR action: ${action}`);
      return res.json({ message: `PR action ${action} ignored` });
    }

    // Check if PR description contains design document URL
    const prBody = payload.pull_request?.body || '';
    const hasDesignDoc = this.checkForDesignDocumentUrl(prBody);

    if (!hasDesignDoc) {
      logger.info(`PR #${prNumber} has no design document URL - skipping review`);
      return res.json({ 
        message: `PR #${prNumber} skipped - no design document URL found`,
        hint: 'Add confluence_design_document_url to PR description to trigger review'
      });
    }

    // Trigger PR review
    try {
      await this.initializePRReviewer();
      
      logger.info(`Starting automated review for PR #${prNumber}...`);
      const result = await this.prReviewer.reviewPR(prNumber);

      if (result.success) {
        logger.info(`✅ Successfully reviewed PR #${prNumber}`);
        res.json({
          message: `PR #${prNumber} reviewed successfully`,
          designDocUrl: result.designDocUrl,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn(`⚠️ PR #${prNumber} review completed with warnings: ${result.message}`);
        res.json({
          message: `PR #${prNumber} review completed with warnings`,
          warning: result.message,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error(`❌ Failed to review PR #${prNumber}:`, error);
      res.status(500).json({
        error: `Failed to review PR #${prNumber}`,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle pull request review events (for potential future use)
   * @param {Object} payload - GitHub webhook payload
   * @param {Object} res - Express response object
   */
  async handlePullRequestReviewEvent(payload, res) {
    logger.info('PR review event received - currently not processed');
    res.json({ message: 'PR review events not currently processed' });
  }

  /**
   * Check if PR body contains design document URL
   * @param {string} prBody - PR description
   * @returns {boolean} Whether design doc URL is found
   */
  checkForDesignDocumentUrl(prBody) {
    const patterns = [
      /confluence_design_document_url[:\s]*([^\s\n]+)/i,
      /confluence[_\s]*design[_\s]*document[_\s]*url[:\s]*([^\s\n]+)/i,
      /design[_\s]*document[_\s]*url[:\s]*([^\s\n]+)/i,
      /confluence[_\s]*url[:\s]*([^\s\n]+)/i
    ];

    return patterns.some(pattern => pattern.test(prBody));
  }

  /**
   * Initialize PR reviewer if not already done
   */
  async initializePRReviewer() {
    if (!this.prReviewer) {
      logger.info('Initializing PR Reviewer...');
      this.prReviewer = new PRReviewer();
      await this.prReviewer.initialize();
    }
  }

  /**
   * Start the webhook server
   * @returns {Promise} Server instance
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(config.webhook.port, () => {
          logger.info(`🚀 Webhook server started on port ${config.webhook.port}`);
          logger.info(`📡 Webhook endpoint: http://localhost:${config.webhook.port}${config.webhook.path}`);
          logger.info(`💚 Health check: http://localhost:${config.webhook.port}/health`);
          
          if (config.webhook.skipSignatureValidation) {
            logger.warn('🚨 Webhook signature verification is DISABLED (development mode)');
          } else if (config.webhook.secret) {
            logger.info('🔒 Webhook signature verification enabled');
          } else {
            logger.warn('⚠️  Webhook signature verification disabled (no secret configured)');
          }
          
          logger.info('✅ Webhook server is ready to receive GitHub webhooks!');

          resolve(server);
        });

        server.on('error', (error) => {
          logger.error('Server error:', error);
          reject(error);
        });

      } catch (error) {
        logger.error('Failed to start webhook server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the webhook server
   */
  async stop() {
    if (this.prReviewer) {
      await this.prReviewer.close();
    }
    logger.info('Webhook server stopped');
  }
}
