import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import cookieRefreshRoutes from './routes/cookieRefreshRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { CookieRefreshService } from './services/CookieRefreshService.js';
import { setCookieRefreshService } from './controllers/cookieRefreshController.js';
import { logger } from './helpers/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/cookie-refresh', cookieRefreshRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize service
let cookieRefreshService;

async function startServer() {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to MongoDB');

    // Initialize cookie refresh service
    cookieRefreshService = new CookieRefreshService();
    await cookieRefreshService.initialize();
    
    // Inject service into controller
    setCookieRefreshService(cookieRefreshService);
    
    logger.info('Cookie refresh service initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Cookie Refresh Service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
      logger.info(`API docs: http://localhost:${PORT}/api/cookie-refresh`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (cookieRefreshService) {
    await cookieRefreshService.shutdown();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (cookieRefreshService) {
    await cookieRefreshService.shutdown();
  }
  process.exit(0);
});

// Start the server
startServer();

export default app;