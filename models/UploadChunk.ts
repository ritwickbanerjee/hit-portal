import mongoose from 'mongoose';

const UploadChunkSchema = new mongoose.Schema({
    uploadId: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true },
    totalChunks: { type: Number, required: true },
    data: { type: String, required: true }, // base64 chunk
    studentId: { type: String, required: true },
    assignmentId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 3600 } // TTL: auto-delete after 1 hour
});

// Compound index for efficient queries
UploadChunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

export default mongoose.models.UploadChunk || mongoose.model('UploadChunk', UploadChunkSchema);
