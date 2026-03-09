import mongoose from 'mongoose';

const FolderSchema = new mongoose.Schema({
    name: { type: String, required: true },
    course: { type: String }, // For question/resource folders (Batch Name from CSV)
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null }, // null = top-level
    createdBy: { type: String }, // Admin email for test folders
    type: { type: String, enum: ['question', 'resource', 'test'], default: 'question' },
    createdAt: { type: Date, default: Date.now }
});

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Folder;
}

export default mongoose.models.Folder || mongoose.model('Folder', FolderSchema);
