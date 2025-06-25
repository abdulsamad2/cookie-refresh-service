import express from 'express';
import mongoose from 'mongoose';
import { logger } from '../helpers/logger.js';

const router = express.Router();

/**
 * Basic health check endpoint
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Cookie Refresh Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Detailed health check with dependencies
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'Cookie Refresh Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'unknown',
      memory: 'unknown',
      disk: 'unknown'
    }
  };

  let overallStatus = 'healthy';

  try {
    // Check database connection
    if (mongoose.connection.readyState === 1) {
      health.checks.database = 'healthy';
    } else {
      health.checks.database = 'unhealthy';
      overallStatus = 'unhealthy';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    health.checks.memory = {
      status: memUsageMB.heapUsed < 500 ? 'healthy' : 'warning', // Warning if using more than 500MB
      usage: memUsageMB
    };

    if (memUsageMB.heapUsed > 1000) { // Critical if using more than 1GB
      health.checks.memory.status = 'critical';
      overallStatus = 'unhealthy';
    }

    // Check disk space (simplified)
    health.checks.disk = 'healthy'; // Placeholder - would need actual disk check

    health.status = overallStatus;

  } catch (error) {
    logger.error('Health check error:', error);
    health.status = 'unhealthy';
    health.error = error.message;
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Readiness probe - checks if service is ready to accept requests
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'Database not connected',
        timestamp: new Date().toISOString()
      });
    }

    // Add other readiness checks here
    // e.g., check if required services are available

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(503).json({
      status: 'not ready',
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liveness probe - checks if service is alive
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;