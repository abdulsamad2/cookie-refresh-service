
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import CookieRefreshTracker from '../helpers/CookieRefreshTracker.js';
import CircuitBreaker from '../helpers/CircuitBreaker.js';
import { logger } from '../helpers/logger.js';
import { CONFIG } from '../config/serviceConfig.js';
import { Event } from '../models/eventModel.js';
import proxyData from '../proxy.js';
import crypto from 'crypto';
import { refreshCookies, loadCookiesFromFile, captureCookies } from './browser-cookies.js';
import { BrowserFingerprint } from './browserFingerprint.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main service class for handling cookie refresh operations
 */
export class CookieRefreshService {
  constructor() {
    this.isInitialized = false;
    this.isRefreshing = false;
    this.refreshQueue = [];
    this.circuitBreaker = new CircuitBreaker();
    // Fingerprint generation now handled by BrowserFingerprint service
    this.serviceInstanceId = crypto.randomUUID();
    this.schedulerInterval = null;
    this.cookiesPath = path.join(__dirname, '../../data/cookies.json');
    this.sessionsPath = path.join(__dirname, '../../data/sessions.json');
    
    // Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      logger.info('Initializing Cookie Refresh Service...');
      
      // Start the scheduler
      this.startScheduler();
      
      this.isInitialized = true;
      logger.info(`Cookie Refresh Service initialized with instance ID: ${this.serviceInstanceId}`);
    } catch (error) {
      logger.error('Failed to initialize Cookie Refresh Service:', error);
      throw error;
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    try {
      await fs.access(dataDir);
      logger.debug('Data directory exists');
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
      logger.info('Created data directory');
      
      // Create initial empty files if they don't exist
      const cookiesFile = path.join(dataDir, 'cookies.json');
      const sessionsFile = path.join(dataDir, 'sessions.json');
      
      try {
        await fs.access(cookiesFile);
      } catch {
        await fs.writeFile(cookiesFile, '[]');
        logger.info('Created initial cookies.json file');
      }
      
      try {
        await fs.access(sessionsFile);
      } catch {
        await fs.writeFile(sessionsFile, '[]');
        logger.info('Created initial sessions.json file');
      }
    }
  }

  /**
   * Start the refresh scheduler
   */
  startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    this.schedulerInterval = setInterval(async () => {
      try {
        if (await CookieRefreshTracker.isRefreshDue() && !this.isRefreshing) {
          logger.info('Scheduled refresh is due, starting refresh...');
          this.refreshCookies().catch(error => {
            logger.error('Scheduled refresh failed:', error);
          });
        }
      } catch (error) {
        logger.error('Error in scheduler:', error);
      }
    }, CONFIG.SCHEDULER.CHECK_INTERVAL);

    logger.info('Cookie refresh scheduler started');
  }

  /**
   * Main cookie refresh method
   * @param {string} eventId - Optional event ID to use for refresh
   * @param {object} proxy - Optional proxy configuration
   * @returns {Promise<object>} Refresh result
   */
  async refreshCookies(eventId = null, proxy = null) {
    if (this.isRefreshing) {
      logger.warn('Cookie refresh already in progress, queuing request');
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject, eventId, proxy });
      });
    }

    this.isRefreshing = true;
    let refreshRecord = null;

    try {
      // Check circuit breaker
      if (!this.circuitBreaker.allowsRequests()) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }

      // Get event ID and proxy if not provided
      const selectedEventId = eventId || await this.getRandomEventId();
      const selectedProxy = proxy || this.getRandomProxy();
      
      // Start tracking
      refreshRecord = await CookieRefreshTracker.startRefresh(
        selectedEventId,
        selectedProxy,
        this.serviceInstanceId
      );
      
      logger.info(`Starting cookie refresh for event ${selectedEventId} with proxy ${selectedProxy ? selectedProxy.host + ':' + selectedProxy.port : 'none'}`);

      // Execute refresh with circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        return await this.performCookieRefresh(refreshRecord.eventId, selectedProxy);
      });

      // Mark as successful
      await CookieRefreshTracker.markSuccess(
        refreshRecord.refreshId,
        result.cookieCount,
        result.retryCount,
        {
          fingerprint: result.fingerprint,
          userAgent: result.userAgent,
          viewport: result.viewport
        }
      );

      logger.info(`Cookie refresh completed successfully: ${result.cookieCount} cookies`);
      
      // Process queued requests
      this.processQueue(null, result);
      
      return result;

    } catch (error) {
      logger.error('Cookie refresh failed:', error);
      
      if (refreshRecord) {
        await CookieRefreshTracker.markFailed(
          refreshRecord.refreshId,
          error.message,
          0,
          { error: error.stack }
        );
      }
      
      // Process queued requests with error
      this.processQueue(error, null);
      
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Perform the actual cookie refresh operation using enhanced browser-cookies service
   * @param {string} eventId - Event ID to use
   * @param {object} proxy - Proxy configuration (if null, will use random proxy)
   * @returns {Promise<object>} Refresh result
   */
  async performCookieRefresh(eventId, proxy = null) {
    try {
      logger.info(`Starting enhanced cookie refresh for event: ${eventId}`);
      
      // Use the enhanced refreshCookies function from browser-cookies service
      const result = await refreshCookies(eventId, proxy);
      
      // Check if we got valid results from refreshCookies
      if (result && result.cookies) {
        // Save cookies using existing method
        if (result.cookies.length > 0) {
          await this.saveCookies(result.cookies);
        }
        
        // Save session data with enhanced fingerprint
        const sessionData = {
          cookies: result.cookies || [],
          fingerprint: result.fingerprint,
          eventId,
          proxy: proxy,
          timestamp: Date.now(),
          userAgent: result.fingerprint?.userAgent,
          viewport: result.fingerprint?.viewport,
          lastRefresh: result.lastRefresh,
          enhanced: true
        };
        
        await this.saveSession(sessionData);
        
        logger.info(`Enhanced cookie refresh completed: ${result.cookies.length} cookies captured`);
        
        return {
           cookieCount: result.cookies.length,
           retryCount: 0, // refreshCookies handles retries internally
           fingerprint: result.fingerprint,
           userAgent: result.fingerprint?.userAgent,
           viewport: result.fingerprint?.viewport,
           proxy: proxy,
           enhanced: true,
           cookies: result.cookies,
           lastRefresh: result.lastRefresh
         };
       } else {
         throw new Error('Enhanced cookie refresh failed - no valid cookies returned');
       }
       
    } catch (error) {
      logger.error(`Enhanced cookie refresh failed for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Save cookies to file
   * @param {Array} cookies - Cookies to save
   */
  async saveCookies(cookies) {
    try {
      await fs.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
      logger.debug(`Saved ${cookies.length} cookies to ${this.cookiesPath}`);
    } catch (error) {
      logger.error('Failed to save cookies:', error);
      throw error;
    }
  }

  /**
   * Get current cookies from file using enhanced browser-cookies service
   * @returns {Promise<Array>} Current cookies
   */
  async getCurrentCookies() {
    try {
      // Use the enhanced loadCookiesFromFile function
      const cookies = await loadCookiesFromFile();
      logger.debug(`Retrieved ${cookies.length} cookies from enhanced storage`);
      return cookies;
    } catch (error) {
      logger.error('Failed to read cookies using enhanced service:', error);
      if (error.code === 'ENOENT') {
        logger.warn('Cookies file not found, returning empty array');
        return [];
      }
      throw error;
    }
  }

  /**
   * Capture cookies for a specific event using enhanced browser-cookies service
   * @param {string} eventId - Event ID to capture cookies for
   * @param {object} proxy - Optional proxy configuration
   * @returns {Promise<object>} Capture result
   */
  async captureCookiesForEvent(eventId, proxy = null) {
    try {
      logger.info(`Starting enhanced cookie capture for event: ${eventId}`);
      
      // Use the enhanced captureCookies function
      const result = await captureCookies(eventId, proxy);
      
      if (result.success) {
        logger.info(`Enhanced cookie capture completed: ${result.cookies ? result.cookies.length : 0} cookies captured`);
        return {
          success: true,
          eventId,
          cookieCount: result.cookies ? result.cookies.length : 0,
          cookies: result.cookies,
          fingerprint: result.fingerprint,
          enhanced: true
        };
      } else {
        throw new Error(result.error || 'Enhanced cookie capture failed');
      }
    } catch (error) {
      logger.error(`Enhanced cookie capture failed for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a new browser fingerprint using enhanced service
   * @returns {object} Generated fingerprint
   */
  generateFingerprint() {
    try {
      const fingerprint = BrowserFingerprint.generate();
      logger.debug('Generated enhanced browser fingerprint:', { 
        platform: fingerprint.platform, 
        browser: fingerprint.browser,
        mobile: fingerprint.mobile 
      });
      return fingerprint;
    } catch (error) {
      logger.error('Failed to generate enhanced fingerprint:', error);
      throw error;
    }
  }

  /**
   * Save session data
   * @param {object} sessionData - Session data to save
   */
  async saveSession(sessionData) {
    try {
      let sessions = [];
      try {
        const existingData = await fs.readFile(this.sessionsPath, 'utf8');
        sessions = JSON.parse(existingData);
      } catch {
        // File doesn't exist or is invalid, start with empty array
      }

      // Add new session
      sessions.unshift(sessionData);
      
      // Keep only last 10 sessions
      sessions = sessions.slice(0, 10);
      
      await fs.writeFile(this.sessionsPath, JSON.stringify(sessions, null, 2));
      logger.debug('Saved session data');
    } catch (error) {
      logger.error('Failed to save session:', error);
    }
  }

  /**
   * Get a random event ID from the database
   * @returns {Promise<string>} Random event ID
   */
  async getRandomEventId() {
    try {
      // Get a random event from database that is not skipped
      const randomEvents = await Event.aggregate([
        { $match: { Skip_Scraping: false } },
        { $sample: { size: 1 } }
      ]);
      
      if (randomEvents && randomEvents.length > 0) {
        logger.info(`Selected random event ID: ${randomEvents[0].Event_ID}`);
        return randomEvents[0].Event_ID;
      }
      
      // No events found - throw error instead of using fallback
      throw new Error('No events found in database');
    } catch (error) {
      logger.error('Error fetching random event ID from database:', error);
      throw error;
    }
  }

  /**
   * Get a random proxy from the proxy list
   * @returns {object|null} Random proxy configuration
   */
  getRandomProxy() {
    try {
      if (!proxyData.proxies || proxyData.proxies.length === 0) {
        logger.warn('No proxies available');
        return null;
      }
      
      const randomIndex = Math.floor(Math.random() * proxyData.proxies.length);
      const selectedProxy = proxyData.proxies[randomIndex];
      
      // Parse proxy string (format: "host:port")
      const [host, port] = selectedProxy.proxy.split(':');
      
      const proxyConfig = {
        host,
        port: parseInt(port),
        username: selectedProxy.username,
        password: selectedProxy.password
      };
      
      logger.info(`Selected random proxy: ${host}:${port}`);
      return proxyConfig;
    } catch (error) {
      logger.error('Error selecting random proxy:', error);
      return null;
    }
  }

  /**
   * Process queued refresh requests
   * @param {Error} error - Error if refresh failed
   * @param {object} result - Result if refresh succeeded
   */
  processQueue(error, result) {
    const queue = [...this.refreshQueue];
    this.refreshQueue = [];
    
    queue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  }

  /**
   * Get service status
   * @returns {object} Service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRefreshing: this.isRefreshing,
      queueLength: this.refreshQueue.length,
      serviceInstanceId: this.serviceInstanceId,
      circuitBreaker: this.circuitBreaker.getStatus(),
      uptime: process.uptime()
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    logger.info('Shutting down Cookie Refresh Service...');
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    
    // Wait for current refresh to complete
    while (this.isRefreshing) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.info('Cookie Refresh Service shutdown complete');
  }
}