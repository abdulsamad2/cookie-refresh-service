import mongoose from 'mongoose';

const cookieRefreshSchema = new mongoose.Schema(
  {
    // Unique identifier for the refresh operation
    refreshId: {
      type: String,
      required: true,
      unique: true,
    },
    // Status of the refresh operation
    status: {
      type: String,
      enum: ['success', 'failed', 'in_progress'],
      required: true,
    },
    // Event ID used for the refresh, if any
    eventId: {
      type: String,
      required: false,
    },
    // Timestamp when the refresh operation started
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Timestamp when the refresh operation completed
    completionTime: {
      type: Date,
      required: false,
    },
    // Timestamp when the next refresh is scheduled
    nextScheduledRefresh: {
      type: Date,
      required: false,
    },
    // Number of cookies retrieved in this refresh
    cookieCount: {
      type: Number,
      required: false,
      default: 0,
    },
    // Number of retries performed for this refresh
    retryCount: {
      type: Number,
      required: true,
      default: 0,
    },
    // Error message if the refresh failed
    errorMessage: {
      type: String,
      required: false,
    },
    // Duration of the refresh operation in milliseconds
    duration: {
      type: Number,
      required: false,
    },
    // Proxy used for this refresh
    proxy: {
      type: String,
      required: false,
    },
    // Additional metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    // Service instance that performed the refresh
    serviceInstance: {
      type: String,
      required: false,
    },
    // Browser fingerprint used
    fingerprint: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    // Cookies data (encrypted or hashed for security)
    cookiesHash: {
      type: String,
      required: false,
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Create indexes for common queries
cookieRefreshSchema.index({ status: 1 });
cookieRefreshSchema.index({ startTime: -1 });
cookieRefreshSchema.index({ nextScheduledRefresh: 1 });
cookieRefreshSchema.index({ eventId: 1 });
cookieRefreshSchema.index({ serviceInstance: 1 });

// Virtual for calculating success rate
cookieRefreshSchema.virtual('isSuccessful').get(function() {
  return this.status === 'success';
});

// Static method to get recent statistics
cookieRefreshSchema.statics.getRecentStats = async function(limit = 100) {
  const recentRefreshes = await this.find()
    .sort({ startTime: -1 })
    .limit(limit);
    
  const successCount = recentRefreshes.filter(r => r.status === 'success').length;
  const failedCount = recentRefreshes.filter(r => r.status === 'failed').length;
  const inProgressCount = recentRefreshes.filter(r => r.status === 'in_progress').length;
  
  return {
    total: recentRefreshes.length,
    successCount,
    failedCount,
    inProgressCount,
    successRate: recentRefreshes.length > 0 
      ? ((successCount / recentRefreshes.length) * 100).toFixed(1) + '%' 
      : 'N/A'
  };
};

// Static method to check if refresh is due
cookieRefreshSchema.statics.isRefreshDue = async function() {
  const now = new Date();
  const lastSuccessful = await this.findOne({ status: 'success' })
    .sort({ completionTime: -1 });
    
  if (!lastSuccessful) {
    return true; // No successful refresh yet, should refresh
  }
  
  return lastSuccessful.nextScheduledRefresh <= now;
};

export const CookieRefresh = mongoose.model('CookieRefresh', cookieRefreshSchema);