import mongoose from 'mongoose';

const BatchStudentSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    courses: [String],
    guardianPhone: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    email: { type: String, sparse: true, trim: true, lowercase: true },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        default: []
    }]
}, { timestamps: true });

// Prevent overwrite
const BatchStudent = mongoose.models.BatchStudent || mongoose.model('BatchStudent', BatchStudentSchema);
export default BatchStudent;
