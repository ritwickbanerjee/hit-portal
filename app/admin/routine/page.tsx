'use client';

import { useState, useEffect, useRef } from 'react';
import { CalendarDays, MapPin, Clock, Loader2, AlertCircle, Phone, X, Save, Sparkles, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface RoutineItem {
    time: string;
    group: string;
    content: string;
}

interface CRContact {
    _id?: string;
    facultyName: string;
    department: string;
    year: string;
    courseCode: string;
    crPhone: string;
    crName: string;
}

export default function MyRoutinePage() {
    const [routine, setRoutine] = useState<Record<string, RoutineItem[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeDay, setActiveDay] = useState("");
    const [facultyCode, setFacultyCode] = useState("");
    const [facultyEmail, setFacultyEmail] = useState("");
    const [crContacts, setCrContacts] = useState<CRContact[]>([]);
    const [showCRModal, setShowCRModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<{ dept: string; year: string; course: string; content: string } | null>(null);
    const [crForm, setCrForm] = useState({ crPhone: '', crName: '' });
    const [savingCR, setSavingCR] = useState(false);
    const dayScrollRef = useRef<HTMLDivElement>(null);

    const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayLabels: Record<string, string> = {
        MON: "Monday", TUE: "Tuesday", WED: "Wednesday",
        THU: "Thursday", FRI: "Friday", SAT: "Saturday"
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setFacultyCode(user.name);
                setFacultyEmail(user.email);
            } catch (e) {
                setError("Failed to identify user faculty code.");
            }
        }

        const today = new Date().getDay();
        const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const currentDay = dayNames[today];
        setActiveDay(days.includes(currentDay) ? currentDay : "MON");
    }, []);

    useEffect(() => {
        if (!facultyCode) return;

        async function fetchRoutine() {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/routine?facultyCode=${encodeURIComponent(facultyCode)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch routine');
                setRoutine(data.routine);
                setError(null);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        async function fetchCRContacts() {
            try {
                // Fetch all CR contacts for global mapping
                const res = await fetch('/api/admin/cr-contacts');
                const data = await res.json();
                if (res.ok) setCrContacts(data.contacts || []);
            } catch (err) {
                console.error('Failed to fetch CR contacts:', err);
            }
        }

        fetchRoutine();
        fetchCRContacts();
    }, [facultyCode]);

    // Scroll active day into view
    useEffect(() => {
        if (activeDay && dayScrollRef.current) {
            const activeBtn = dayScrollRef.current.querySelector(`[data-day="${activeDay}"]`);
            if (activeBtn) {
                activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeDay]);

    const colors = [
        { bg: "bg-rose-500/15", border: "border-rose-400/30", text: "text-rose-300", accent: "bg-rose-500", dot: "bg-rose-400" },
        { bg: "bg-indigo-500/15", border: "border-indigo-400/30", text: "text-indigo-300", accent: "bg-indigo-500", dot: "bg-indigo-400" },
        { bg: "bg-emerald-500/15", border: "border-emerald-400/30", text: "text-emerald-300", accent: "bg-emerald-500", dot: "bg-emerald-400" },
        { bg: "bg-amber-500/15", border: "border-amber-400/30", text: "text-amber-300", accent: "bg-amber-500", dot: "bg-amber-400" },
        { bg: "bg-violet-500/15", border: "border-violet-400/30", text: "text-violet-300", accent: "bg-violet-500", dot: "bg-violet-400" },
        { bg: "bg-cyan-500/15", border: "border-cyan-400/30", text: "text-cyan-300", accent: "bg-cyan-500", dot: "bg-cyan-400" },
        { bg: "bg-fuchsia-500/15", border: "border-fuchsia-400/30", text: "text-fuchsia-300", accent: "bg-fuchsia-500", dot: "bg-fuchsia-400" },
    ];

    const getCardStyles = (content: string, index: number) => {
        const hash = content.length + index;
        return colors[hash % colors.length];
    };

    const parseContent = (content: string) => {
        const parts = content.split('\n');
        const main = parts[0];
        const room = parts[1]?.replace('Room No.-', '').trim() || "";

        const mainParts = main.split('/');
        const type = mainParts[0] || "";
        const subject = mainParts[1] || "";
        const topic = mainParts[2] || "";

        // Try to extract dept, year from topic like "CSE 3rd" or from subject
        let dept = '';
        let year = '';
        const topicMatch = topic.match(/([A-Z]+)\s*(\d+(?:st|nd|rd|th))/i);
        if (topicMatch) {
            dept = topicMatch[1].toUpperCase();
            year = topicMatch[2];
        }

        return { type, subject, topic, room, dept, year };
    };

    const getCRForClass = (dept: string, year: string, courseCode: string) => {
        return crContacts.find(c =>
            (c.department || "").trim().toLowerCase() === (dept || "").trim().toLowerCase() &&
            (c.year || "").trim().toLowerCase() === (year || "").trim().toLowerCase() &&
            (c.courseCode || "").trim().toLowerCase() === (courseCode || "").trim().toLowerCase()
        );
    };

    const handleClassClick = (item: RoutineItem) => {
        const { dept, year, subject } = parseContent(item.content);
        setSelectedClass({ dept, year, course: subject, content: item.content });

        // Pre-fill if contact exists
        const existing = getCRForClass(dept, year, subject);
        if (existing) {
            setCrForm({ crPhone: existing.crPhone, crName: existing.crName });
        } else {
            setCrForm({ crPhone: '', crName: '' });
        }
        setShowCRModal(true);
    };

    const handleSaveCR = async () => {
        if (!selectedClass || !crForm.crPhone.trim()) {
            toast.error('Phone number is required');
            return;
        }

        setSavingCR(true);
        try {
            const res = await fetch('/api/admin/cr-contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Email': facultyEmail || '' },
                body: JSON.stringify({
                    department: selectedClass.dept,
                    year: selectedClass.year,
                    courseCode: selectedClass.course,
                    crPhone: crForm.crPhone.trim(),
                    crName: crForm.crName.trim()
                })
            });

            if (!res.ok) throw new Error('Failed to save');

            // Refresh all contacts
            const refreshRes = await fetch('/api/admin/cr-contacts');
            const refreshData = await refreshRes.json();
            if (refreshRes.ok) setCrContacts(refreshData.contacts || []);

            toast.success('CR contact saved!');
            setShowCRModal(false);
        } catch (err) {
            toast.error('Failed to save CR contact');
        } finally {
            setSavingCR(false);
        }
    };

    if (loading && !Object.keys(routine).length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                <p className="text-slate-400 text-sm font-medium animate-pulse">Syncing your routine...</p>
            </div>
        );
    }

    const currentDayRoutine = routine[activeDay] || [];

    return (
        <div className="space-y-4 max-w-4xl mx-auto pb-20 px-3 sm:px-4">
            {/* Header - Compact */}
            <div className="flex items-center gap-3 py-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
                    <CalendarDays className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white">My Schedule</h2>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                        <Sparkles className="h-3 w-3 text-amber-400 inline mr-1" />
                        {facultyCode}
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Day Tabs - Pill Style with visible scroll indicator */}
            <div className="sticky top-0 z-30 py-2 bg-slate-950/90 backdrop-blur-xl rounded-2xl">
                <div ref={dayScrollRef} className="flex gap-1.5 px-2 overflow-x-auto scrollbar-thin">
                    {days.map((day) => {
                        const isActive = activeDay === day;
                        const today = new Date().getDay();
                        const dayNumMap: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
                        const isToday = dayNumMap[day] === today;
                        const dayCount = (routine[day] || []).length;

                        return (
                            <button
                                key={day}
                                data-day={day}
                                onClick={() => setActiveDay(day)}
                                className={`flex-1 min-w-[4.5rem] py-2 px-2 rounded-xl transition-all duration-300 text-center relative ${
                                    isActive
                                        ? 'bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                                        : 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                                }`}
                            >
                                <span className="text-[10px] sm:text-xs font-black block">{day}</span>
                                <span className={`text-[8px] sm:text-[10px] block mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-600'}`}>
                                    {dayCount > 0 ? `${dayCount} class${dayCount > 1 ? 'es' : ''}` : 'Free'}
                                </span>
                                {isToday && !isActive && (
                                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400"></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Day Title */}
            <div className="flex items-center gap-2 px-1">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent rounded-full"></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{dayLabels[activeDay]}</span>
                <div className="h-0.5 flex-1 bg-gradient-to-l from-indigo-500/50 to-transparent rounded-full"></div>
            </div>

            {/* Routine Cards - Compact for Mobile */}
            <div className="space-y-2.5">
                {currentDayRoutine.length > 0 ? (
                    currentDayRoutine.map((item, idx) => {
                        const { type, subject, topic, room, dept, year } = parseContent(item.content);
                        const styles = getCardStyles(item.content, idx);
                        const crContact = getCRForClass(dept, year, subject);

                        return (
                            <div
                                key={idx}
                                onClick={() => handleClassClick(item)}
                                className={`relative p-3 sm:p-4 rounded-xl border backdrop-blur-sm cursor-pointer transition-all duration-200 active:scale-[0.98] hover:shadow-lg ${styles.bg} ${styles.border}`}
                            >
                                {/* Left accent bar */}
                                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${styles.accent}`}></div>

                                <div className="pl-3 flex items-start gap-3">
                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className={`text-base sm:text-lg font-black ${styles.text} truncate`}>{subject}</h3>
                                            <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/30 ${styles.text}`}>
                                                {type === 'L' ? 'LEC' : type === 'T' ? 'TUT' : type}
                                            </span>
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-slate-400 truncate">{topic}</p>

                                        {/* Time + Room row */}
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500">
                                                <Clock className="h-3 w-3" />{item.time}
                                            </span>
                                            {room && (
                                                <span className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500">
                                                    <MapPin className="h-3 w-3" />{room}
                                                </span>
                                            )}
                                            {item.group && (
                                                <span className="text-[8px] sm:text-[10px] text-slate-600 font-bold">{item.group}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* CR Contact Badge */}
                                    {crContact && (
                                        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                                            <Phone className="h-3 w-3 text-emerald-400" />
                                            <div className="text-right">
                                                <p className="text-[8px] sm:text-[10px] text-emerald-400 font-bold leading-tight">CR</p>
                                                <p className="text-[10px] sm:text-xs text-emerald-300 font-mono">{crContact.crPhone}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="py-16 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-slate-600">
                        <CalendarDays className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm font-bold opacity-50">No sessions for {dayLabels[activeDay]}</p>
                    </div>
                )}
            </div>

            {/* CR Contact Modal */}
            {showCRModal && selectedClass && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCRModal(false)}>
                    <div
                        className="w-full sm:w-96 bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <Phone className="h-5 w-5 text-emerald-400" />
                                CR Contact
                            </h3>
                            <button onClick={() => setShowCRModal(false)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10">
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>

                        {/* Class info */}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 w-16">Course:</span>
                                <span className="text-white font-bold">{selectedClass.course}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 w-16">Dept:</span>
                                <span className="text-white font-bold">{selectedClass.dept || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 w-16">Year:</span>
                                <span className="text-white font-bold">{selectedClass.year || 'N/A'}</span>
                            </div>
                        </div>

                        {/* Dept/Year inputs (Always visible for verification/correction) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold block mb-1">Department</label>
                                <input
                                    type="text"
                                    placeholder="e.g. CSE"
                                    value={selectedClass.dept}
                                    onChange={e => setSelectedClass({ ...selectedClass, dept: e.target.value.toUpperCase() })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold block mb-1">Year</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 3rd"
                                    value={selectedClass.year}
                                    onChange={e => setSelectedClass({ ...selectedClass, year: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {(!selectedClass.dept || !selectedClass.year) && (
                            <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                                ⚠️ Dept/Year could not be auto-detected. Please ensure they are correct.
                            </div>
                        )}

                        <div>
                            <label className="text-xs text-slate-400 font-bold block mb-1.5">
                                <User className="h-3 w-3 inline mr-1" />CR Name (optional)
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Rahul Sharma"
                                value={crForm.crName}
                                onChange={e => setCrForm({ ...crForm, crName: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 font-bold block mb-1.5">
                                <Phone className="h-3 w-3 inline mr-1" />Phone Number *
                            </label>
                            <input
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={crForm.crPhone}
                                onChange={e => setCrForm({ ...crForm, crPhone: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                            />
                        </div>

                        <button
                            onClick={handleSaveCR}
                            disabled={savingCR || !crForm.crPhone.trim()}
                            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                        >
                            {savingCR ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {savingCR ? 'Saving...' : 'Save CR Contact'}
                        </button>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .scrollbar-thin::-webkit-scrollbar {
                    height: 3px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: rgba(99,102,241,0.3);
                    border-radius: 10px;
                }
                .scrollbar-thin {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(99,102,241,0.3) rgba(255,255,255,0.05);
                }
            `}</style>
        </div>
    );
}
