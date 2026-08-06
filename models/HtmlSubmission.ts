import mongoose from 'mongoose';

const HtmlSubmissionSchema = new mongoose.Schema({
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource',
        required: true
    },
    resourceTitle: {
        type: String,
        default: ''
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    studentRoll: {
        type: String,
        required: true
    },
    studentEmail: {
        type: String,
        default: ''
    },
    studentDepartment: {
        type: String,
        default: ''
    },
    studentYear: {
        type: String,
        default: ''
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// One submission per student per resource
HtmlSubmissionSchema.index({ resourceId: 1, studentId: 1 }, { unique: true });
HtmlSubmissionSchema.index({ resourceId: 1 });
HtmlSubmissionSchema.index({ studentId: 1 });

if (mongoose.models.HtmlSubmission) {
    delete mongoose.models.HtmlSubmission;
}

const HtmlSubmission = mongoose.model('HtmlSubmission', HtmlSubmissionSchema);
export default HtmlSubmission;
