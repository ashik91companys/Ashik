/**
 * DATABASE INTEGRATION LAYER
 * MongoDB + Redis Integration for Complete Data Persistence
 * Handles: User data, campaigns, analytics, sessions, cache
 */

const mongoose = require('mongoose');
const redis = require('redis');
require('dotenv').config();

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

class DatabaseManager {
  constructor() {
    this.mongoUrl = process.env.DATABASE_URL || 'mongodb://localhost:27017/ai-platform';
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.mongoClient = null;
    this.redisClient = null;
  }

  /**
   * Connect to MongoDB
   */
  async connectMongoDB() {
    try {
      await mongoose.connect(this.mongoUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 5,
      });
      console.log('✅ MongoDB Connected');
      return true;
    } catch (error) {
      console.error('❌ MongoDB Connection Error:', error.message);
      return false;
    }
  }

  /**
   * Connect to Redis
   */
  async connectRedis() {
    try {
      this.redisClient = redis.createClient({
        url: this.redisUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
      });

      this.redisClient.on('error', (err) => console.error('Redis Error:', err));
      this.redisClient.on('connect', () => console.log('✅ Redis Connected'));

      await this.redisClient.connect();
      return true;
    } catch (error) {
      console.error('❌ Redis Connection Error:', error.message);
      return false;
    }
  }

  /**
   * Initialize all databases
   */
  async initialize() {
    console.log('\n🔧 Initializing Databases...\n');
    
    const mongoConnected = await this.connectMongoDB();
    const redisConnected = await this.connectRedis();

    if (mongoConnected && redisConnected) {
      console.log('✅ All databases initialized successfully\n');
      return true;
    }
    console.error('❌ Database initialization failed\n');
    return false;
  }
}

// ============================================================================
// MONGODB SCHEMAS
// ============================================================================

// Campaign Schema
const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['email', 'sms', 'push', 'multi-channel'], required: true },
  status: { type: String, enum: ['draft', 'scheduled', 'running', 'completed', 'paused'], default: 'draft' },
  recipients: { type: Number, default: 0 },
  sent: { type: Number, default: 0 },
  opened: { type: Number, default: 0 },
  clicked: { type: Number, default: 0 },
  converted: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  subject: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
  startDate: Date,
  endDate: Date,
  aiOptimized: { type: Boolean, default: false },
  metadata: mongoose.Schema.Types.Mixed,
});

// User Schema
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  name: String,
  company: String,
  phone: String,
  country: String,
  timezone: String,
  preferences: {
    emailFrequency: String,
    marketingConsent: Boolean,
    communicationPreference: [String],
  },
  engagementScore: { type: Number, default: 0, min: 0, max: 100 },
  lastInteraction: Date,
  totalPurchases: { type: Number, default: 0 },
  lifetimeValue: { type: Number, default: 0 },
  churnRisk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  segmentations: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Analytics Event Schema
const analyticsEventSchema = new mongoose.Schema({
  eventId: { type: String, unique: true, required: true },
  userId: String,
  campaignId: String,
  eventType: { type: String, enum: ['open', 'click', 'bounce', 'complaint', 'conversion'], required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed,
  indexed: { type: Boolean, default: false },
});

// Create Models
const Campaign = mongoose.model('Campaign', campaignSchema);
const User = mongoose.model('User', userSchema);
const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);

// ============================================================================
// DATA ACCESS OBJECTS (DAOs)
// ============================================================================

class CampaignDAO {
  static async createCampaign(campaignData) {
    try {
      const campaign = new Campaign(campaignData);
      await campaign.save();
      console.log(`✅ Campaign created: ${campaign.campaignId}`);
      return campaign;
    } catch (error) {
      console.error('❌ Error creating campaign:', error.message);
      throw error;
    }
  }

  static async getCampaign(campaignId) {
    try {
      return await Campaign.findOne({ campaignId });
    } catch (error) {
      console.error('Error fetching campaign:', error.message);
      throw error;
    }
  }

  static async updateMetrics(campaignId, metrics) {
    try {
      return await Campaign.findOneAndUpdate(
        { campaignId },
        { $set: metrics, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating campaign metrics:', error.message);
      throw error;
    }
  }

  static async getAllCampaigns(filter = {}) {
    try {
      return await Campaign.find(filter).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching campaigns:', error.message);
      throw error;
    }
  }
}

class UserDAO {
  static async upsertUser(userId, userData) {
    try {
      return await User.findOneAndUpdate(
        { userId },
        { $set: userData, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('Error upserting user:', error.message);
      throw error;
    }
  }

  static async getUser(userId) {
    try {
      return await User.findOne({ userId });
    } catch (error) {
      console.error('Error fetching user:', error.message);
      throw error;
    }
  }
}

class AnalyticsDAO {
  static async recordEvent(eventData) {
    try {
      const event = new AnalyticsEvent(eventData);
      await event.save();
      return event;
    } catch (error) {
      console.error('Error recording event:', error.message);
      throw error;
    }
  }

  static async getCampaignAnalytics(campaignId) {
    try {
      const events = await AnalyticsEvent.find({ campaignId });
      return {
        total: events.length,
        opens: events.filter(e => e.eventType === 'open').length,
        clicks: events.filter(e => e.eventType === 'click').length,
        bounces: events.filter(e => e.eventType === 'bounce').length,
        complaints: events.filter(e => e.eventType === 'complaint').length,
        conversions: events.filter(e => e.eventType === 'conversion').length,
      };
    } catch (error) {
      console.error('Error fetching analytics:', error.message);
      throw error;
    }
  }
}

// ============================================================================
// CACHE LAYER
// ============================================================================

class CacheManager {
  constructor(redisClient) {
    this.client = redisClient;
    this.ttl = 3600;
  }

  async get(key) {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = this.ttl) {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error.message);
      return false;
    }
  }
}

module.exports = {
  DatabaseManager,
  Campaign,
  User,
  AnalyticsEvent,
  CampaignDAO,
  UserDAO,
  AnalyticsDAO,
  CacheManager,
};
