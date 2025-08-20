import { config } from '../config/index.js';

/**
 * Simple logger utility with different log levels
 */
class Logger {
  constructor(level = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.setLevel(level);
  }

  setLevel(level) {
    this.currentLevel = this.levels[level] || this.levels.info;
  }

  error(message, ...args) {
    if (this.currentLevel >= this.levels.error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel >= this.levels.warn) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.currentLevel >= this.levels.info) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  debug(message, ...args) {
    if (this.currentLevel >= this.levels.debug) {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
}

export const logger = new Logger(config.app.logLevel);
