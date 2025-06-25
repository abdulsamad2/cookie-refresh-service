import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/database.js';
import cookieRefreshRoutes from './routes/cookieRefreshRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { CookieRefreshService } from './services/CookieRefreshService.js';
import { setCookieRefreshService } from './controllers/cookieRefreshController.js';
import { logger } from './helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Ensure required directories exist
 */
async function ensureDirectories() {
  const projectRoot = path.join(__dirname, '..');
  const logsDir = path.join(projectRoot, 'logs');
  const dataDir = path.join(projectRoot, 'data');
  
  try {
    // Create logs directory
    await fs.mkdir(logsDir, { recursive: true });
    console.log(`✓ Ensured logs directory exists: ${logsDir}`);
    
    // Create data directory
    await fs.mkdir(dataDir, { recursive: true });
    console.log(`✓ Ensured data directory exists: ${dataDir}`);
    
    // Create initial data files if they don't exist
    const cookiesFile = path.join(dataDir, 'cookies.json');
    const sessionsFile = path.join(dataDir, 'sessions.json');
    
    try {
      await fs.access(cookiesFile);
    } catch {
      await fs.writeFile(cookiesFile, '[]');
      console.log(`✓ Created initial cookies.json file`);
    }
    
    try {
      await fs.access(sessionsFile);
    } catch {
      await fs.writeFile(sessionsFile, '[]');
      console.log(`✓ Created initial sessions.json file`);
    }
    
  } catch (error) {
    console.error('Failed to create required directories:', error);
    throw error;
  }
}

async function startServer() {
  try {
    // Ensure required directories exist first
    await ensureDirectories();
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