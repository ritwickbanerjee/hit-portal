import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    answers: {
        type: Map,
        of: String, // questionId -> answer
    },
    driveLink: { type: String }, // Link to uploaded PDF in Google Drive
    pageCount: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    marksObtained: { type: Number, default: 0 },
    status: { type: String, enum: ['submitted', 'graded'], default: 'submitted' },
    submittedAt: { type: Date, default: Date.now },
});

export default mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
