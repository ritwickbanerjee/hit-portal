import mongoose from 'mongoose';

const DeploymentSchema = new mongoose.Schema({
    department: { type: String, required: true },
    year: { type: String, required: true },
    course: { type: String, required: true }
}, { _id: false });

const TopicConfigSchema = new mongoose.Schema({
    topic: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    deployments: { type: [DeploymentSchema], default: [] }
}, { _id: false });

const MockTestConfigSchema = new mongoose.Schema({
    userEmail: { type: String, required: true, unique: true },
    facultyName: { type: String, required: true },
    topics: { type: [TopicConfigSchema], default: [] }
}, { timestamps: true });

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.MockTestConfig;
}

export default mongoose.models.MockTestConfig || mongoose.model('MockTestConfig', MockTestConfigSchema);
