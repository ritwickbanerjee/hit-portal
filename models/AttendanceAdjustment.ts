import mongoose from 'mongoose';

const AttendanceAdjustmentSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    studentRoll: {
        type: String,
        required: true,
        trim: true
    },
    studentName: {
        type: String,
        required: true
    },
    facultyEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    facultyName: {
        type: String,
        required: true
    },
    courseCode: {
        type: String,
        required: true,
        trim: true
    },
    batchKey: {
        type: String,
        required: true,
        trim: true
    },
    date: {
        type: String, // YYYY-MM-DD — the date the absence relates to
        default: ''
    },
    delta: {
        type: Number,
        required: true,
        min: 1 // Only positive adjustments
    },
    reason: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Index for efficient querying
AttendanceAdjustmentSchema.index({ studentId: 1, courseCode: 1 });
AttendanceAdjustmentSchema.index({ batchKey: 1 });
AttendanceAdjustmentSchema.index({ studentRoll: 1 });

// Force recompilation in dev
if (mongoose.models.AttendanceAdjustment) {
    delete mongoose.models.AttendanceAdjustment;
}

const AttendanceAdjustment = mongoose.model('AttendanceAdjustment', AttendanceAdjustmentSchema);
export default AttendanceAdjustment;
