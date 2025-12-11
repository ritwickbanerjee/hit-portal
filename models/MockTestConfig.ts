import mongoose from 'mongoose';

const MockTestConfigSchema = new mongoose.Schema({
    facultyName: { type: String, required: true, unique: true },
    enabledTopics: { type: [String], default: [] }, // Topics that are visible to students
}, { timestamps: true });

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.MockTestConfig;
}

export default mongoose.models.MockTestConfig || mongoose.model('MockTestConfig', MockTestConfigSchema);
