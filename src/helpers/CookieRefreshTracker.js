import { CookieRefresh } from '../models/CookieRefresh.js';
import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Helper class to track cookie refresh operations in the database
 */
class CookieRefreshTracker {
  /**
   * Start tracking a new cookie refresh operation
   * @param {string} eventId - The event ID used for this refresh operation
   * @param {object} proxy - The proxy object used for this refresh
   * @param {string} serviceInstance - The service instance identifier
   * @returns {Promise<object>} The created refresh tracking record
   */
  static async startRefresh(eventId, proxy, serviceInstance = null) {
    const refreshId = crypto.randomUUID();
    const proxyString = proxy?.proxy || proxy?.host ? `${proxy.host}:${proxy.port}` : 'no_proxy';
    
    const refreshRecord = await CookieRefresh.create({
      refreshId,
      status: 'in_progress',
      eventId,
      startTime: new Date(),
      proxy: proxyString,
      serviceInstance: serviceInstance || process.env.SERVICE_INSTANCE_ID || 'unknown'
    });
    
    logger.info(`Started tracking cookie refresh operation: ${refreshId} for event ${eventId}`);
    return refreshRecord;
  }
  
  /**
   * Mark a refresh operation as successful
   * @param {string} refreshId - The ID of the refresh operation
   * @param {number} cookieCount - Number of cookies retrieved
   * @param {number} retryCount - Number of retries performed
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} The updated refresh tracking record
   */
  static async markSuccess(refreshId, cookieCount, retryCount, metadata = {}) {
    const completionTime = new Date();
    const nextScheduledRefresh = new Date(
      completionTime.getTime() + (15 * 60 * 1000) // Default 15 minutes
    );
    
    // Get the original record to calculate duration
    const originalRecord = await CookieRefresh.findOne({ refreshId });
    const duration = originalRecord ? completionTime - originalRecord.startTime : null;
    
    const refreshRecord = await CookieRefresh.findOneAndUpdate(
      { refreshId },
      {
        status: 'success',
        completionTime,
        nextScheduledRefresh,
        cookieCount,
        retryCount,
        duration,
        metadata
      },
      { new: true }
    );
    
    logger.info(`Cookie refresh completed successfully: ${refreshId} with ${cookieCount} cookies`);
    return refreshRecord;
  }
  
  /**
   * Mark a refresh operation as failed
   * @param {string} refreshId - The ID of the refresh operation
   * @param {string} errorMessage - Error message describing the failure
   * @param {number} retryCount - Number of retries performed
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} The updated refresh tracking record
   */
  static async markFailed(refreshId, errorMessage, retryCount, metadata = {}) {
    const completionTime = new Date();
    // Schedule next attempt sooner if it failed
    const nextScheduledRefresh = new Date(
      completionTime.getTime() + (5 * 60 * 1000) // 5 minutes for failures
    );
    
    // Get the original record to calculate duration
    const originalRecord = await CookieRefresh.findOne({ refreshId });
    const duration = originalRecord ? completionTime - originalRecord.startTime : null;
    
    const refreshRecord = await CookieRefresh.findOneAndUpdate(
      { refreshId },
      {
        status: 'failed',
        completionTime,
        nextScheduledRefresh,
        errorMessage,
        retryCount,
        duration,
        metadata
      },
      { new: true }
    );
    
    logger.error(`Cookie refresh failed: ${refreshId}, next attempt: ${nextScheduledRefresh.toISOString()}`);
    return refreshRecord;
  }
  
  /**
   * Get statistics about cookie refresh operations
   * @param {number} limit - Number of recent operations to analyze
   * @returns {Promise<object>} Statistics about cookie refresh operations
   */
  static async getStats(limit = 100) {
    const recentRefreshes = await CookieRefresh.find()
      .sort({ startTime: -1 })
      .limit(limit);
    
    const successCount = recentRefreshes.filter(r => r.status === 'success').length;
    const failedCount = recentRefreshes.filter(r => r.status === 'failed').length;
    const inProgressCount = recentRefreshes.filter(r => r.status === 'in_progress').length;
    
    const totalCookies = recentRefreshes.reduce((sum, r) => sum + (r.cookieCount || 0), 0);
    const averageCookies = successCount > 0 
      ? totalCookies / successCount 
      : 0;
    
    const completedRefreshes = recentRefreshes.filter(r => r.duration);
    const averageDuration = completedRefreshes.length > 0
      ? completedRefreshes.reduce((sum, r) => sum + r.duration, 0) / completedRefreshes.length
      : 0;
    
    const nextRefresh = await CookieRefresh.findOne({ status: 'success' })
      .sort({ nextScheduledRefresh: 1 });
    
    return {
      total: recentRefreshes.length,
      successCount,
      failedCount,
      inProgressCount,
      successRate: recentRefreshes.length > 0 
        ? (successCount / recentRefreshes.length * 100).toFixed(1) + '%' 
        : 'N/A',
      averageCookies: averageCookies.toFixed(1),
      averageDuration: averageDuration ? `${(averageDuration / 1000).toFixed(1)}s` : 'N/A',
      nextScheduledRefresh: nextRefresh?.nextScheduledRefresh || 'None scheduled',
      latestRefresh: recentRefreshes[0] || null
    };
  }
  
  /**
   * Check if a refresh is due
   * @returns {Promise<boolean>} Whether a refresh is due
   */
  static async isRefreshDue() {
    const now = new Date();
    const lastSuccessful = await CookieRefresh.findOne({ status: 'success' })
      .sort({ completionTime: -1 });
    
    if (!lastSuccessful) {
      return true; // No successful refresh yet, should refresh
    }
    
    return lastSuccessful.nextScheduledRefresh <= now;
  }
  
  /**
   * Get recent refresh operations with pagination
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {string} status - Filter by status
   * @returns {Promise<object>} Paginated refresh operations
   */
  static async getRecentRefreshes(page = 1, limit = 20, status = null) {
    const skip = (page - 1) * limit;
    const query = status ? { status } : {};
    
    const total = await CookieRefresh.countDocuments(query);
    const refreshes = await CookieRefresh.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);
    
    return {
      refreshes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  /**
   * Clean up old refresh records
   * @param {number} daysToKeep - Number of days to keep records
   * @returns {Promise<number>} Number of deleted records
   */
  static async cleanupOldRecords(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await CookieRefresh.deleteMany({
      startTime: { $lt: cutoffDate }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} old refresh records`);
    return result.deletedCount;
  }
}

export default CookieRefreshTracker;