import mongoose from 'mongoose';

const ConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'data'
    },
    attendanceRequirement: {
        type: Number,
        default: 70,
    },
    attendanceRules: {
        type: Map,
        of: Number,
        default: {},
    },
    teacherAssignments: {
        type: Map,
        of: [{
            name: String,
            email: String
        }],
        default: {},
    },
    aiEnabledTopics: {
        type: [String],
        default: []
    },
    activePlatform: {
        type: String,
        enum: ['vercel', 'netlify'],
        default: 'vercel'
    }
}, { timestamps: true });

// Force recompilation
if (mongoose.models.Config) {
    delete mongoose.models.Config;
}

const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);
export default Config;
