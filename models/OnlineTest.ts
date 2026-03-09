import mongoose from 'mongoose';

const OnlineTestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    questions: [{
        id: { type: String, required: true },
        text: { type: String, required: true },
        image: { type: String }, // Base64 for question image/screenshot
        latexContent: { type: Boolean, default: false }, // Flag if text contains LaTeX
        type: { type: String, enum: ['mcq', 'msq', 'fillblank', 'comprehension', 'broad'], required: true },
        topic: { type: String },
        subtopic: { type: String },
        marks: { type: Number, required: true, default: 1 },
        negativeMarks: { type: Number, default: 0 },
        timeLimit: { type: Number }, // Optional override for specific question duration (seconds)
        isGrace: { type: Boolean, default: false }, // Grace question flag

        // Solution / Explanation
        solutionText: { type: String }, // Latex enabled detailed solution
        solutionImage: { type: String }, // Base64 image for solution

        // MCQ/MSQ specific
        options: [{ type: String }], // Options for MCQ/MSQ
        correctIndices: [{ type: Number }], // Indices of correct options (0-based)
        shuffleOptions: { type: Boolean, default: false }, // Per-question option shuffle

        // Fill in the blank
        fillBlankAnswer: { type: String }, // Correct answer for fill-blank type
        caseSensitive: { type: Boolean, default: false }, // For fill-blank answer matching
        isNumberRange: { type: Boolean, default: false }, // True if answer is a numeric range
        numberRangeMin: { type: Number }, // Minimum value for number range
        numberRangeMax: { type: Number }, // Maximum value for number range

        // Comprehension specific
        comprehensionText: { type: String }, // Passage/context for comprehension
        comprehensionImage: { type: String }, // Base64 image for comprehension passage
        subQuestions: [{
            id: { type: String },
            text: { type: String },
            latexContent: { type: Boolean, default: false },
            type: { type: String, enum: ['mcq', 'msq', 'fillblank'] },
            options: [{ type: String }],
            correctIndices: [{ type: Number }],
            shuffleOptions: { type: Boolean, default: false },
            marks: { type: Number, default: 1 },
            negativeMarks: { type: Number, default: 0 },
            // Fill in the blank specific
            fillBlankAnswer: { type: String },
            caseSensitive: { type: Boolean, default: false },
            isNumberRange: { type: Boolean, default: false },
            numberRangeMin: { type: Number },
            numberRangeMax: { type: Number }
        }]
    }],
    deployment: {
        batches: [{ type: String }], // Batch names from Google Sheets
        students: [{
            phoneNumber: { type: String }, // Student phone number (unique identifier)
            studentName: { type: String },
            batchName: { type: String }
        }], // Optional: specific students. If empty, deploys to all students in batches
        startTime: { type: Date },
        endTime: { type: Date },
        durationMinutes: { type: Number }
    },
    config: {
        shuffleQuestions: { type: Boolean, default: false },
        showTimer: { type: Boolean, default: true },
        allowBackNavigation: { type: Boolean, default: true },
        showResults: { type: Boolean, default: true }, // Show results after submission
        showResultsImmediately: { type: Boolean, default: true }, // New: If false, hide results until exam end time
        maxQuestionsToAttempt: { type: Number, default: null }, // New: If set, pick X random questions per student
        passingPercentage: { type: Number, default: 40 },
        enablePerQuestionTimer: { type: Boolean, default: false }, // Per-question timer toggle
        perQuestionDuration: { type: Number, default: 60 } // Default duration in seconds per question
    },
    status: { type: String, enum: ['draft', 'deployed', 'completed'], default: 'draft' },
    createdBy: { type: String, required: true }, // Admin/Faculty Email
    folderId: { type: String, default: null }, // Optional folder organization
    totalMarks: { type: Number }, // Auto-calculated from questions
}, { timestamps: true });

// Calculate total marks before saving
// Calculate total marks before saving
OnlineTestSchema.pre('save', function () {
    let total = 0;

    // Determine questions to count
    let questionsToCount: any[] = this.questions;
    if (this.config && this.config.maxQuestionsToAttempt && this.config.maxQuestionsToAttempt > 0) {
        questionsToCount = this.questions.slice(0, this.config.maxQuestionsToAttempt);
    }

    questionsToCount.forEach(q => {
        if (q.type === 'comprehension' && q.subQuestions) {
            q.subQuestions.forEach((sq: any) => total += sq.marks || 0);
        } else {
            total += q.marks || 0;
        }
    });
    this.totalMarks = total;
});

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.OnlineTest;
}

export default mongoose.models.OnlineTest || mongoose.model('OnlineTest', OnlineTestSchema);
