import { CookieRefresh } from '../models/CookieRefresh.js';
import CookieRefreshTracker from '../helpers/CookieRefreshTracker.js';
import { logger } from '../helpers/logger.js';

// This will be injected by the app
let cookieRefreshService = null;

/**
 * Set the cookie refresh service instance
 * @param {CookieRefreshService} service - The service instance
 */
export const setCookieRefreshService = (service) => {
  cookieRefreshService = service;
};

/**
 * Get current cookies
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const getCurrentCookies = async (req, res) => {
  try {
    if (!cookieRefreshService) {
      return res.status(503).json({
        success: false,
        error: 'Cookie refresh service not available'
      });
    }

    const cookies = await cookieRefreshService.getCurrentCookies();
    
    res.json({
      success: true,
      data: {
        cookies,
        count: cookies.length,
        lastUpdated: cookies.length > 0 ? new Date().toISOString() : null
      }
    });
  } catch (error) {
    logger.error('Error getting current cookies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get statistics about cookie refresh operations
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const getCookieRefreshStats = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const stats = await CookieRefreshTracker.getStats(limit);
    
    // Add service status if available
    if (cookieRefreshService) {
      stats.serviceStatus = cookieRefreshService.getStatus();
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting cookie refresh stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get recent cookie refresh operations
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const getRecentRefreshes = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const status = req.query.status || null;
    
    const result = await CookieRefreshTracker.getRecentRefreshes(page, limit, status);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error getting recent refreshes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Trigger a manual cookie refresh
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const triggerRefresh = async (req, res) => {
  try {
    if (!cookieRefreshService) {
      return res.status(503).json({
        success: false,
        error: 'Cookie refresh service not available'
      });
    }

    const { eventId, proxy } = req.body;
    
    // Validate input
    if (eventId && typeof eventId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'eventId must be a string'
      });
    }

    if (proxy && (!proxy.host || !proxy.port)) {
      return res.status(400).json({
        success: false,
        error: 'proxy must have host and port properties'
      });
    }
    
    // Start the refresh process
    res.json({
      success: true,
      message: 'Cookie refresh triggered',
      timestamp: new Date().toISOString()
    });
    
    // Run the refresh process in the background
    cookieRefreshService.refreshCookies(eventId, proxy)
      .then(result => {
        logger.info('Manual cookie refresh completed successfully', { result });
      })
      .catch(error => {
        logger.error('Manual cookie refresh failed:', error);
      });
      
  } catch (error) {
    logger.error('Error triggering cookie refresh:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get a specific cookie refresh record
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const getRefreshDetails = async (req, res) => {
  try {
    const { refreshId } = req.params;
    
    if (!refreshId) {
      return res.status(400).json({
        success: false,
        error: 'refreshId parameter is required'
      });
    }
    
    const refresh = await CookieRefresh.findOne({ refreshId });
    
    if (!refresh) {
      return res.status(404).json({
        success: false,
        error: 'Cookie refresh record not found'
      });
    }
    
    res.json({
      success: true,
      data: refresh
    });
  } catch (error) {
    logger.error('Error getting refresh details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get service status
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const getServiceStatus = async (req, res) => {
  try {
    if (!cookieRefreshService) {
      return res.status(503).json({
        success: false,
        error: 'Cookie refresh service not available'
      });
    }

    const status = cookieRefreshService.getStatus();
    
    res.json({
      success: true,
      data: {
        ...status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  } catch (error) {
    logger.error('Error getting service status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Reset circuit breaker
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const resetCircuitBreaker = async (req, res) => {
  try {
    if (!cookieRefreshService) {
      return res.status(503).json({
        success: false,
        error: 'Cookie refresh service not available'
      });
    }

    cookieRefreshService.circuitBreaker.reset();
    
    res.json({
      success: true,
      message: 'Circuit breaker reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error resetting circuit breaker:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Clean up old refresh records
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const cleanupOldRecords = async (req, res) => {
  try {
    const daysToKeep = parseInt(req.query.days) || 30;
    
    if (daysToKeep < 1 || daysToKeep > 365) {
      return res.status(400).json({
        success: false,
        error: 'days parameter must be between 1 and 365'
      });
    }
    
    const deletedCount = await CookieRefreshTracker.cleanupOldRecords(daysToKeep);
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old records`,
      deletedCount,
      daysToKeep,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error cleaning up old records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};