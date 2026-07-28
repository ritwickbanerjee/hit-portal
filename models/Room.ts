import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
    roomNo:   { type: String, required: true, unique: true, trim: true, uppercase: true },
    label:    { type: String, trim: true, default: '' },
    building: { type: String, trim: true, default: '' },
    capacity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // 'manual' = added by admin, 'routine' = auto-detected from Google Sheets sync
    source:   { type: String, enum: ['manual', 'routine'], default: 'manual' },
    addedBy:  { type: String, default: '' },
}, { timestamps: true });

if (mongoose.models.Room) delete mongoose.models.Room;
const Room = mongoose.model('Room', RoomSchema);
export default Room;
