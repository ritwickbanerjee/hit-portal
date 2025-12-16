import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
    },
    email: { // Institute Email
        type: String,
        required: [true, 'Please provide an institute email'],
        trim: true,
        lowercase: true,
    },
    secondary_email: { // Gmail
        type: String,
        sparse: true,
        trim: true,
        lowercase: true,
    },
    guardian_email: {
        type: String,
        sparse: true,
        trim: true,
        lowercase: true,
    },
    roll: {
        type: String,
        required: [true, 'Please provide a roll number'],
        trim: true,
    },
    department: {
        type: String,
        required: [true, 'Please provide a department'],
        trim: true,
    },
    year: {
        type: String,
        required: [true, 'Please provide a year'],
        trim: true,
    },
    course_code: {
        type: String,
        required: [true, 'Please provide a course code'],
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    attended_adjustment: {
        type: Number,
        default: 0
    },
    total_classes_adjustment: {
        type: Number,
        default: 0
    },
    submission_adjustments: {
        type: Map,
        of: Number,
        default: {}
    },
    loginDisabled: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String,
        select: false
    },
    otpExpiry: {
        type: Date,
        select: false
    }
}, { timestamps: true });

// Force recompilation of the model in dev mode if it exists, to ensure schema updates are applied
if (mongoose.models.Student) {
    delete mongoose.models.Student;
}

// Compound index to prevent duplicate enrollment in SAME course
StudentSchema.index({ roll: 1, course_code: 1 }, { unique: true });

const Student = mongoose.model('Student', StudentSchema);
export default Student;
