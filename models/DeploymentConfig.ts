import mongoose from 'mongoose';

const deploymentConfigSchema = new mongoose.Schema({
    activePlatform: {
        type: String,
        enum: ['vercel', 'netlify'],
        default: 'vercel'
    },
    updatedBy: {
        type: String,
        required: true
    }
}, { timestamps: true });

export default mongoose.models.DeploymentConfig || mongoose.model('DeploymentConfig', deploymentConfigSchema);
