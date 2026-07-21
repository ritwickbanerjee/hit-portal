import mongoose from 'mongoose';

const ResourceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ['pdf', 'link', 'video', 'practice', 'hints', 'html_content'], default: 'link' },
    url: { type: String }, // Optional for practice/hints
    videoLink: { type: String },

    // For HTML content resources
    htmlContent: { type: String }, // Raw HTML code pasted by admin

    // Context
    course_code: { type: String }, // Can be main target
    targetDepartments: { type: [String], default: [] },
    targetYear: { type: String },
    targetCourse: { type: String }, // Redundant but keeps consistency with legacy

    // For Videos/Practice
    topic: { type: String },
    subtopic: { type: String },

    // For Practice/Hints
    questions: { type: [String], default: [] }, // Array of Question IDs
    hints: { type: Map, of: [String], default: {} }, // Map of Question ID -> Array of Hints

    // Ownership
    uploadedBy: { type: String, required: true }, // Email
    facultyName: { type: String },

    createdAt: { type: Date, default: Date.now },
});

// Prevent model overwrite in dev
if (process.env.NODE_ENV === 'development') {
    delete mongoose.models.Resource;
}

export default mongoose.models.Resource || mongoose.model('Resource', ResourceSchema);
