import mongoose from 'mongoose';

const FacultyConfigSchema = new mongoose.Schema({
    facultyName: { type: String, required: true, unique: true },
    rootFolderId: { type: String, required: false },
    scriptUrl: { type: String, required: false },
    seniority: { type: Number, required: false }
}, { timestamps: true });

export default mongoose.models.FacultyConfig || mongoose.model('FacultyConfig', FacultyConfigSchema);
