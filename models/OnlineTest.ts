import mongoose from 'mongoose';

const OnlineTestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    questions: [{
        id: { type: String, required: true },
        text: { type: String, required: true },
        image: { type: String }, // Base64
        type: { type: String, enum: ['mcq', 'msq', 'number', 'broad'], required: true },
        topic: { type: String },
        subtopic: { type: String },
        marks: { type: Number, required: true, default: 1 },
        negativeMarks: { type: Number, default: 0 },
        options: [{ type: String }], // For MCQ/MSQ
        correctAnswers: [{ type: String }], // Array of correct options or number range
        numberRange: {
            min: { type: Number },
            max: { type: Number }
        }
    }],
    deployment: {
        department: [{ type: String }], // Changed to Array for Multi-Select
        year: { type: String },
        course: { type: String },
        startTime: { type: Date },
        durationMinutes: { type: Number },
        endTime: { type: Date }
    },
    config: {
        shuffleQuestions: { type: Boolean, default: false },
        timerPerQuestion: { type: Boolean, default: false },
        timePerQuestion: { type: Number }, // in minutes
        allowBackNavigation: { type: Boolean, default: true }
    },
    randomization: {
        enabled: { type: Boolean, default: false },
        totalQuestions: { type: Number },
        categoryRules: [{
            topic: { type: String },
            count: { type: Number }
        }]
    },
    status: { type: String, enum: ['draft', 'deployed', 'completed'], default: 'draft' },
    createdBy: { type: String, required: true }, // Faculty Email
}, { timestamps: true });

export default mongoose.models.OnlineTest || mongoose.model('OnlineTest', OnlineTestSchema);
