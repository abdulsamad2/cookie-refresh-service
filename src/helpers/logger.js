import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`Created logs directory at: ${this.logDir}`);
      }
    } catch (error) {
      console.error(`Failed to create logs directory: ${error.message}`);
      // Fallback to current directory
      this.logDir = process.cwd();
      console.log(`Using fallback log directory: ${this.logDir}`);
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    
    // Handle Error objects properly
    let processedData = data;
    if (data instanceof Error) {
      processedData = {
        name: data.name,
        message: data.message,
        stack: data.stack,
        ...(data.code && { code: data.code })
      };
    } else if (data && typeof data === 'object') {
      // Handle objects that might contain Error instances
      processedData = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
            ...(value.code && { code: value.code })
          };
        }
        return value;
      }));
    }
    
    const logMessage = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(processedData && { data: processedData })
    };
    return JSON.stringify(logMessage);
  }

  writeToFile(filename, message) {
    try {
      // Ensure directory exists before writing
      this.ensureLogDirectory();
      const logFile = path.join(this.logDir, filename);
      fs.appendFileSync(logFile, message + '\n');
    } catch (error) {
      console.error(`Failed to write to log file ${filename}: ${error.message}`);
      // Don't throw the error, just log it to console so the app doesn't crash
    }
  }

  log(level, message, data = null) {
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Console output with colors
    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
      reset: '\x1b[0m'
    };
    
    const color = colors[level] || colors.reset;
    console.log(`${color}[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}${colors.reset}`);
    
    if (data) {
      // Handle Error objects in console output
      let displayData = data;
      if (data instanceof Error) {
        displayData = {
          name: data.name,
          message: data.message,
          stack: data.stack,
          ...(data.code && { code: data.code })
        };
      }
      console.log(`${color}${JSON.stringify(displayData, null, 2)}${colors.reset}`);
    }
    
    // Write to files
    this.writeToFile('service.log', formattedMessage);
    
    if (level === 'error') {
      this.writeToFile('error.log', formattedMessage);
    }
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  logWithTime(message, level = 'info', data = null) {
    this.log(level, message, data);
  }
}

export const logger = new Logger();