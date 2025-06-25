import express from 'express';
import {
  getCurrentCookies,
  getCookieRefreshStats,
  getRecentRefreshes,
  triggerRefresh,
  getRefreshDetails,
  getServiceStatus,
  resetCircuitBreaker,
  cleanupOldRecords
} from '../controllers/cookieRefreshController.js';

const router = express.Router();

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'Cookie Refresh Service',
    version: '1.0.0',
    endpoints: {
      'GET /cookies': 'Get current cookies',
      'GET /stats': 'Get cookie refresh statistics',
      'GET /history': 'Get list of recent cookie refresh operations',
      'GET /status': 'Get service status and health information',
      'GET /:refreshId': 'Get details of a specific cookie refresh',
      'POST /trigger': 'Trigger a manual cookie refresh',
      'POST /circuit-breaker/reset': 'Reset the circuit breaker',
      'DELETE /cleanup': 'Clean up old refresh records'
    },
    examples: {
      triggerRefresh: {
        url: 'POST /api/cookie-refresh/trigger',
        body: {
          eventId: 'Z7r9jZ1AdqV',
          proxy: {
            host: '127.0.0.1',
            port: 8080,
            username: 'user',
            password: 'pass'
          }
        }
      },
      getCookies: {
        url: 'GET /api/cookie-refresh/cookies'
      },
      getStats: {
        url: 'GET /api/cookie-refresh/stats?limit=50'
      },
      getHistory: {
        url: 'GET /api/cookie-refresh/history?page=1&limit=20&status=success'
      }
    }
  });
});

// Get current cookies
router.get('/cookies', getCurrentCookies);

// Get cookie refresh statistics
router.get('/stats', getCookieRefreshStats);

// Get service status
router.get('/status', getServiceStatus);

// Get list of recent cookie refresh operations
router.get('/history', getRecentRefreshes);

// Trigger a manual cookie refresh
router.post('/trigger', triggerRefresh);

// Reset circuit breaker
router.post('/circuit-breaker/reset', resetCircuitBreaker);

// Clean up old refresh records
router.delete('/cleanup', cleanupOldRecords);

// Get details of a specific cookie refresh
router.get('/:refreshId', getRefreshDetails);

export default router;