import mongoose from 'mongoose';

const ApiUsageSchema = new mongoose.Schema({
    userEmail: {
        type: String,
        required: true,
        index: true
    },
    date: {
        type: String,
        required: true, // Format: YYYY-MM-DD
        index: true
    },
    requestCount: {
        type: Number,
        default: 0
    },
    tokensUsed: {
        type: Number,
        default: 0
    },
    lastReset: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 604800 // Auto-delete after 7 days
    }
});

// Compound index for efficient queries
ApiUsageSchema.index({ userEmail: 1, date: 1 }, { unique: true });

export default mongoose.models.ApiUsage || mongoose.model('ApiUsage', ApiUsageSchema);
