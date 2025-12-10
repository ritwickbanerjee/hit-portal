import mongoose from 'mongoose';

const AssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ['manual', 'randomized', 'batch_attendance', 'personalized'], default: 'manual' },
    course_code: { type: String }, // For manual
    targetCourse: { type: String }, // For others
    targetDepartments: [{ type: String }],
    targetYear: { type: String },
    facultyName: { type: String },
    createdBy: { type: String }, // Email of the creator
    scriptUrl: { type: String },

    // Manual
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    totalMarks: { type: Number, default: 0 },

    // Randomized / Batch / Personalized
    questionCount: { type: Number },
    questionPool: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],

    // Batch
    rules: [{
        min: Number,
        max: Number,
        count: Number
    }],
    topicWeights: [{
        topic: String,
        weight: Number
    }],

    // Personalized
    topicConfig: [{
        topic: String,
        count: Number
    }],
    targetStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],

    startTime: { type: Date },
    deadline: { type: Date },
    dueDate: { type: Date }, // Legacy support
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
