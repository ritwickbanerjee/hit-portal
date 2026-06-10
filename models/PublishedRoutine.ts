import mongoose from 'mongoose';

const PublishedRoutineSchema = new mongoose.Schema({
    facultyCode: { type: String, required: true, unique: true },
    timeSlots: { type: [String], default: [
        '9:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '11:00 AM - 12:00 PM',
        '12:00 PM - 1:00 PM',
        '1:00 PM - 2:00 PM',
        '2:00 PM - 3:00 PM',
        '3:00 PM - 4:00 PM',
        '4:00 PM - 5:00 PM',
        '5:00 PM - 6:00 PM',
    ]},
    routine: {
        type: Map,
        of: [{ time: String, group: String, content: String }],
        default: {}
    },
    publishedAt: { type: Date, default: Date.now },
    publishedBy: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.PublishedRoutine || mongoose.model('PublishedRoutine', PublishedRoutineSchema);
