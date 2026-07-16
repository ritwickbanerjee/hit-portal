import mongoose from 'mongoose';

const RoutineSlotSchema = new mongoose.Schema({
    faculty: { type: String, required: true },
    type: { type: String, default: 'L' }, // L, T, P, etc.
    course: { type: String, default: '' },
    dept: { type: String, default: '' },
    room: { type: String, default: '' },
}, { _id: false });

const RoutineRowSchema = new mongoose.Schema({
    id: { type: String, required: true },
    slots: { type: [mongoose.Schema.Types.Mixed], default: () => Array(9).fill(null) }, // 9 periods
}, { _id: false });

const FacultyAvailabilitySchema = new mongoose.Schema({
    Monday: { type: [Boolean], default: () => Array(9).fill(true) },
    Tuesday: { type: [Boolean], default: () => Array(9).fill(true) },
    Wednesday: { type: [Boolean], default: () => Array(9).fill(true) },
    Thursday: { type: [Boolean], default: () => Array(9).fill(true) },
    Friday: { type: [Boolean], default: () => Array(9).fill(true) },
}, { _id: false });

const RoutineFacultySchema = new mongoose.Schema({
    code: { type: String, required: true },
    name: { type: String, default: '' },
    color: { type: String, default: '#4b5563' },
    designation: { type: String, default: '' },
    employeeCode: { type: String, default: '' },
    seniority: { type: Number },
    availability: { type: FacultyAvailabilitySchema, default: () => ({}) },
}, { _id: false });

const MappingRuleSchema = new mongoose.Schema({
    startsWith: { type: String, required: true },
    mapsTo: { type: String, required: true },
}, { _id: false });

const LockedCellSchema = new mongoose.Schema({
    day: { type: String, required: true },
    rowId: { type: String, required: true },
    periodIndex: { type: Number, required: true },
}, { _id: false });

const CodeResponsibilitySchema = new mongoose.Schema({
    course: { type: String, required: true },
    dept: { type: String, required: true },
    faculty: { type: String, default: '' },
}, { _id: false });

const RoutineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    createdBy: { type: String, required: true },
    grid: {
        type: Map,
        of: [RoutineRowSchema],
        default: () => {
            const grid: any = {};
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            days.forEach(day => {
                grid[day] = [{ id: Math.random().toString(36).substr(2, 9), slots: Array(9).fill(null) }];
            });
            return grid;
        }
    },
    faculties: { type: [RoutineFacultySchema], default: [] },
    mappingRules: { type: [MappingRuleSchema], default: [] },
    lockedCells: { type: [LockedCellSchema], default: [] },
    codeResponsibilities: { type: [CodeResponsibilitySchema], default: [] },
    isArchived: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.Routine || mongoose.model('Routine', RoutineSchema);
