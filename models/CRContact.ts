import mongoose from 'mongoose';

const CRContactSchema = new mongoose.Schema({
    facultyName: { type: String, required: true },
    department: { type: String, required: true },
    year: { type: String, required: true },
    courseCode: { type: String, required: true },
    crPhone: { type: String, required: true },
    crName: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

// Unique per faculty + dept + year + course
CRContactSchema.index({ facultyName: 1, department: 1, year: 1, courseCode: 1 }, { unique: true });

export default mongoose.models.CRContact || mongoose.model('CRContact', CRContactSchema);
