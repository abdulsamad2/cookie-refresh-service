import { logger } from './logger.js';
import { CONFIG } from '../config/serviceConfig.js';

/**
 * Circuit breaker pattern implementation for cookie refresh operations
 */
class CircuitBreaker {
  constructor(failureThreshold = CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD, resetTimeout = CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.successCount = 0;
  }

  /**
   * Execute an operation with circuit breaker protection
   * @param {Function} operation - The operation to execute
   * @returns {Promise} The result of the operation
   */
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker: Attempting to reset (HALF_OPEN)');
      } else {
        const timeLeft = Math.ceil((this.resetTimeout - (Date.now() - this.lastFailureTime)) / 1000);
        throw new Error(`Circuit breaker is OPEN - too many recent failures. Retry in ${timeLeft} seconds`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.failures = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info('Circuit breaker: Reset to CLOSED state after successful operation');
    }
  }

  /**
   * Handle failed operation
   */
  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker: OPENED after ${this.failures} failures`);
    }
  }

  /**
   * Get current circuit breaker status
   * @returns {object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout,
      timeUntilReset: this.state === 'OPEN' && this.lastFailureTime 
        ? Math.max(0, this.resetTimeout - (Date.now() - this.lastFailureTime))
        : 0
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info('Circuit breaker: Manually reset to CLOSED state');
  }

  /**
   * Check if the circuit breaker allows requests
   * @returns {boolean} True if requests are allowed
   */
  allowsRequests() {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      return true;
    }
    
    if (this.state === 'OPEN') {
      return Date.now() - this.lastFailureTime > this.resetTimeout;
    }
    
    return false;
  }
}

export default CircuitBreaker;