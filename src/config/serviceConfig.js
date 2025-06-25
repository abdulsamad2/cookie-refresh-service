// Environment validation
const requiredEnvVars = ['MONGODB_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file and ensure all required variables are set.');
}

export const CONFIG = {
  // Cookie refresh intervals
  COOKIE_REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes
  PERIODIC_REFRESH_INTERVAL: () => {
    // Random interval between 15-20 minutes
    const minMinutes = 15;
    const maxMinutes = 20;
    const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    return randomMinutes * 60 * 1000;
  },
  
  // Browser and page timeouts
  BROWSER_RESTART_TIMEOUT: 120000, // 2 minutes
  PAGE_TIMEOUT: 30000, // 30 seconds
  
  // Retry configuration
  MAX_REFRESH_RETRIES: 3,
  RETRY_DELAY: 30000, // 30 seconds
  
  // Cookie validation
  MAX_COOKIE_LENGTH: 8000,
  MAX_COOKIE_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Essential cookies that must be present
  ESSENTIAL_COOKIES: [
    'TMUO',
    'TMPS',
    'TM_TKTS',
    'SESSION',
    'audit',
    'CMPS',
    'CMID',
    'MUID',
    'au_id',
    'aud',
    'tmTrackID',
    'TapAd_DID',
    'uid'
  ],
  
  // Authentication cookies that are critical
  AUTH_COOKIES: ['TMUO', 'TMPS', 'TM_TKTS', 'SESSION', 'audit'],
  
  // Circuit breaker configuration
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RESET_TIMEOUT: 300000 // 5 minutes
  },
  
  // Scheduling configuration
  SCHEDULER: {
    CHECK_INTERVAL: 60000, // Check every minute
    MAX_CONCURRENT_REFRESHES: 3
  },
  
  // API configuration
  API: {
    TIMEOUT: 30000,
    MAX_RETRIES: 3
  },
  
  // Logging configuration
  LOGGING: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    MAX_FILES: 5,
    MAX_SIZE: '10m'
  }
};