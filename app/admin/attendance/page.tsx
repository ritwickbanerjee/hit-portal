'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, Users, Clock, Save, Search, Trash2, CheckSquare, Square } from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';

export default function AdminAttendance() {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [students, setStudents] = useState<any[]>([]);

    // Tab State
    const [activeTab, setActiveTab] = useState<'take' | 'manage'>('take');

    // Take Attendance State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [filters, setFilters] = useState({ dept: '', year: '', course: '' });
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
    const [attendanceData, setAttendanceData] = useState<Record<string, boolean>>({}); // studentId -> present (true/false)
    const [selectAll, setSelectAll] = useState(true);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

    // Manage Attendance State
    const [manageFilters, setManageFilters] = useState({ date: new Date().toISOString().split('T')[0], dept: '', year: '', course: '' });
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const TIME_SLOTS = [
        "9-10AM", "10-11AM", "11-12PM", "12-1PM",
        "1-2PM", "2-3PM", "3-4PM", "4-5PM", "5-6PM"
    ];

    // Fetch Data
    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/admin/students/all');
            if (res.ok) setStudents(await res.json());
        } catch (error) { console.error('Failed to fetch students', error); }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/config');
            if (res.ok) setConfig(await res.json() || { attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
        } catch (error) { console.error('Failed to fetch config', error); }
    };

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                setAdminEmail(parsed.email || null);
            } catch (e) { console.error(e); }
        }
        fetchConfig();
        fetchStudents();
    }, []);

    // Derived Lists [UPDATED with Access Control]
    const { departments, years, courses } = useMemo(() => {
        const depts = new Set<string>();
        const yrs = new Set<string>();
        const crs = new Set<string>();

        // Check if Global Admin (via localStorage or prop if available)
        // We need to read it here or trust the component state if we add it. 
        // Since we don't have isGlobalAdmin state in this file yet (wait, we need to check), we can read localStorage.
        // Actually best to add isGlobalAdmin state.

        const isGA = typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true';

        if (isGA) {
            students.forEach(s => {
                if (s.department) depts.add(s.department);
                if (s.year) yrs.add(s.year);
                if (s.course_code) crs.add(s.course_code);
            });
        } else if (adminEmail && config.teacherAssignments) {
            Object.entries(config.teacherAssignments).forEach(([key, teachers]: [string, any]) => {
                if (Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase())) {
                    const parts = key.split('_');
                    if (parts.length >= 3) {
                        depts.add(parts[0]);
                        yrs.add(parts[1]);
                        crs.add(parts[2]);
                    }
                }
            });
        }

        return {
            departments: Array.from(depts).sort(),
            years: Array.from(yrs).sort(),
            courses: Array.from(crs).sort()
        };
    }, [students, config, adminEmail]);

    // Access Control & Filtering
    const visibleStudents = useMemo(() => {
        if (!adminEmail) return students;
        const assignedKeys = Object.entries(config.teacherAssignments || {}).filter(([key, teachers]: [string, any]) => {
            return Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
        }).map(([key]) => key);

        if (assignedKeys.length === 0) return students; // Fallback

        return students.filter(s => {
            const key = `${s.department}_${s.year}_${s.course_code}`;
            return assignedKeys.includes(key);
        });
    }, [students, config, adminEmail]);

    // Filtered Students for Attendance Table
    const tableStudents = useMemo(() => {
        if (!filters.dept || !filters.year || !filters.course) return [];
        return visibleStudents.filter(s =>
            s.department === filters.dept &&
            s.year === filters.year &&
            s.course_code === filters.course
        ).sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));
    }, [visibleStudents, filters]);

    // Initialize Checkboxes
    useEffect(() => {
        if (tableStudents.length > 0 && !editingRecordId) {
            const initial: Record<string, boolean> = {};
            tableStudents.forEach(s => initial[s._id] = true);
            setAttendanceData(initial);
            setSelectAll(true);
        }
    }, [tableStudents, editingRecordId]);

    // Available Teachers for Selected Group
    const availableTeachers = useMemo(() => {
        if (!filters.dept || !filters.year || !filters.course) return [];
        const key = `${filters.dept}_${filters.year}_${filters.course}`;
        return config.teacherAssignments?.[key] || [];
    }, [config, filters]);

    // Auto-select logged-in teacher
    useEffect(() => {
        if (availableTeachers.length > 0 && adminEmail && !editingRecordId) {
            const me = availableTeachers.find((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
            if (me) {
                setSelectedTeacher(JSON.stringify(me));
            } else {
                setSelectedTeacher(''); // Not assigned to this course
            }
        }
    }, [availableTeachers, adminEmail, editingRecordId]);

    // Handlers
    const handleSelectAll = () => {
        const newVal = !selectAll;
        setSelectAll(newVal);
        const updated: Record<string, boolean> = {};
        tableStudents.forEach(s => updated[s._id] = newVal);
        setAttendanceData(updated);
    };

    const toggleStudent = (id: string) => {
        setAttendanceData(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleEditRecord = (record: any) => {
        setEditingRecordId(record._id);
        setDate(record.date);
        setFilters({ dept: record.department, year: record.year, course: record.course_code });

        const teacherObj = { name: record.teacherName, email: record.teacherEmail };
        setSelectedTeacher(JSON.stringify(teacherObj));

        setSelectedTimeSlots([record.timeSlot]);

        const attData: Record<string, boolean> = {};
        if (record.presentStudentIds && Array.isArray(record.presentStudentIds)) {
            record.presentStudentIds.forEach((id: string) => attData[id] = true);
        }
        setAttendanceData(attData);

        setActiveTab('take');
    };

    const handleSaveAttendance = async () => {
        if (!date || !selectedTeacher || selectedTimeSlots.length === 0 || tableStudents.length === 0) {
            alert('Please fill all fields and ensure students are listed.');
            return;
        }

        const action = editingRecordId ? 'Update' : 'Save';
        if (!confirm(`${action} attendance for ${selectedTimeSlots.length} slot(s)?`)) return;

        setLoading(true);
        try {
            const presentIds = tableStudents.filter(s => attendanceData[s._id]).map(s => s._id);
            const absentIds = tableStudents.filter(s => !attendanceData[s._id]).map(s => s._id);

            let teacherName = '';
            let teacherEmail = '';

            if (typeof selectedTeacher === 'string') {
                try {
                    const parsed = JSON.parse(selectedTeacher);
                    teacherName = parsed.name;
                    teacherEmail = parsed.email;
                } catch (e) {
                    teacherName = selectedTeacher; // Fallback
                }
            } else if (typeof selectedTeacher === 'object') {
                teacherName = (selectedTeacher as any).name;
                teacherEmail = (selectedTeacher as any).email;
            }

            const payload = {
                date,
                teacherName,
                teacherEmail,
                department: filters.dept,
                year: filters.year,
                course_code: filters.course,
                timeSlot: selectedTimeSlots[0],
                presentStudentIds: presentIds,
                absentStudentIds: absentIds
            };

            let res;
            if (editingRecordId) {
                res = await fetch(`/api/admin/attendance/${editingRecordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                const records = selectedTimeSlots.map(slot => ({
                    ...payload,
                    timeSlot: slot
                }));
                res = await fetch('/api/admin/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records })
                });
            }

            if (!res.ok) throw new Error(`Failed to ${action.toLowerCase()}`);

            alert(`Attendance ${action.toLowerCase()}d successfully!`);

            if (editingRecordId) {
                setEditingRecordId(null);
                setActiveTab('manage');
                handleSearchRecords();
            } else {
                setSelectedTimeSlots([]);
            }
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingRecordId(null);
        setActiveTab('manage');
        setSelectedTimeSlots([]);
        setAttendanceData({});
    };

    const handleSearchRecords = async () => {
        if (!manageFilters.dept || !manageFilters.year || !manageFilters.course) {
            alert('Please select Department, Year, and Course.');
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (manageFilters.date) params.append('date', manageFilters.date);
            params.append('department', manageFilters.dept);
            params.append('year', manageFilters.year);
            params.append('course_code', manageFilters.course);

            const res = await fetch(`/api/admin/attendance?${params.toString()}`);
            if (res.ok) {
                setSearchResults(await res.json());
                setHasSearched(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Delete this record?')) return;
        try {
            const res = await fetch(`/api/admin/attendance/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSearchResults(prev => prev.filter(r => r._id !== id));
            }
        } catch (error) { console.error(error); }
    };

    const handleDeleteAllFiltered = async () => {
        if (searchResults.length === 0) return;
        if (!confirm(`Delete ALL ${searchResults.length} records? This cannot be undone.`)) return;

        setLoading(true);
        try {
            const ids = searchResults.map(r => r._id);
            const res = await fetch('/api/admin/attendance', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            if (res.ok) {
                setSearchResults([]);
                alert('All records deleted.');
            }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">


            {/* Tabs */}
            <div className="flex space-x-1 rounded-xl bg-slate-900/50 p-1 mb-8 max-w-md border border-white/5 backdrop-blur-md">
                <button
                    onClick={() => { setActiveTab('take'); setEditingRecordId(null); }}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${activeTab === 'take' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    {editingRecordId ? 'Edit Record' : 'Take Attendance'}
                </button>
                <button
                    onClick={() => { setActiveTab('manage'); setEditingRecordId(null); }}
                    className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200 ${activeTab === 'manage' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Manage Records
                </button>
            </div>

            {/* TAKE ATTENDANCE TAB */}
            {activeTab === 'take' && (
                <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                    {editingRecordId && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl mb-6 flex justify-between items-center backdrop-blur-sm">
                            <span className="text-indigo-300 font-medium">Editing Record: {date} - {filters.dept} {filters.year} {filters.course}</span>
                            <button onClick={handleCancelEdit} className="text-sm text-slate-400 hover:text-white underline decoration-slate-500/30 underline-offset-4">Cancel Edit</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Date */}
                        <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-xl">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">1. Select Date</label>
                            <input
                                type="date"
                                className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                disabled={!!editingRecordId}
                            />
                        </div>

                        {/* Group Filters */}
                        <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-xl md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">2. Select Student Group</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <select
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    value={filters.dept} onChange={e => setFilters({ ...filters, dept: e.target.value })}
                                    disabled={!!editingRecordId}
                                >
                                    <option value="">Select Dept</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })}
                                    disabled={!!editingRecordId}
                                >
                                    <option value="">Select Year</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    value={filters.course} onChange={e => setFilters({ ...filters, course: e.target.value })}
                                    disabled={!!editingRecordId}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Teacher Display (Auto-selected) */}
                        <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-xl">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">3. Faculty</label>
                            <div className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-3 px-4 text-slate-300">
                                {selectedTeacher ? (
                                    <span className="flex items-center gap-2">
                                        <span className="font-medium text-indigo-400">
                                            {typeof selectedTeacher === 'string' ? JSON.parse(selectedTeacher).name : (selectedTeacher as any).name}
                                        </span>
                                        <span className="text-slate-500 text-xs text-opacity-70">
                                            ({typeof selectedTeacher === 'string' ? JSON.parse(selectedTeacher).email : (selectedTeacher as any).email})
                                        </span>
                                    </span>
                                ) : (
                                    <span className="text-slate-600 italic text-sm">
                                        {filters.course ? 'You are not assigned to this course.' : 'Select Group First'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Time Slots (Multi-select) */}
                        <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/5 shadow-xl">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">4. Select Time Slots</label>
                            <div className="flex flex-wrap gap-2">
                                {TIME_SLOTS.map(slot => (
                                    <button
                                        key={slot}
                                        onClick={() => {
                                            if (editingRecordId) return;
                                            setSelectedTimeSlots(prev =>
                                                prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
                                            );
                                        }}
                                        disabled={!!editingRecordId}
                                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${selectedTimeSlots.includes(slot)
                                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/25 scale-105'
                                            : 'bg-slate-950 text-slate-400 border-white/10 hover:border-white/20 hover:text-slate-200 hover:bg-slate-900'
                                            } ${editingRecordId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>


                    {/* Student List */}
                    <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl shadow-xl overflow-hidden mt-8">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users className="h-5 w-5 text-indigo-400" />
                                5. Mark Attendance <span className="text-slate-500 text-sm font-normal ml-2">({tableStudents.length} Students)</span>
                            </h3>
                            <button onClick={handleSelectAll} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                                {selectAll ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                {selectAll ? 'Unselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                            <table className="min-w-full divide-y divide-white/5">
                                <thead className="bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
                                    <tr>
                                        <th className="px-5 py-4 text-left w-16">
                                            <input
                                                type="checkbox"
                                                checked={selectAll}
                                                onChange={handleSelectAll}
                                                className="rounded bg-slate-800 border-gray-600 text-indigo-500 focus:ring-indigo-500 h-4 w-4 transition-all"
                                            />
                                        </th>
                                        <th className="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                                        <th className="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Roll</th>
                                        <th className="px-5 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-transparent">
                                    {tableStudents.length === 0 ? (
                                        <tr><td colSpan={4} className="text-center py-12 text-slate-500 italic">Select a valid group above to load students.</td></tr>
                                    ) : (
                                        tableStudents.map(s => (
                                            <tr key={s._id} className="hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => toggleStudent(s._id)}>
                                                <td className="px-5 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!attendanceData[s._id]}
                                                        onChange={() => toggleStudent(s._id)}
                                                        className="rounded bg-slate-800 border-gray-600 text-indigo-500 focus:ring-indigo-500 h-4 w-4 transition-all cursor-pointer"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-sm text-slate-200 font-medium group-hover:text-white transition-colors">{s.name}</td>
                                                <td className="px-5 py-3 text-sm text-slate-500 font-mono group-hover:text-slate-400 transition-colors">{s.roll}</td>
                                                <td className="px-5 py-3 text-sm">
                                                    {attendanceData[s._id] ? (
                                                        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">Present</span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]">Absent</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSaveAttendance}
                            disabled={loading || tableStudents.length === 0}
                            className="w-full md:w-auto ml-auto rounded-xl bg-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex justify-center items-center gap-3 transition-all duration-200"
                        >
                            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                            {editingRecordId ? 'Update Attendance Record' : 'Save Attendance Record'}
                        </button>
                    </div>
                </div>
            )}

            {/* MANAGE RECORDS TAB */}
            {activeTab === 'manage' && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-xl mb-8">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Search className="h-5 w-5 text-indigo-400" />
                            Search Existing Records
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date (Optional)</label>
                                <input
                                    type="date"
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-500"
                                    value={manageFilters.date}
                                    onChange={e => setManageFilters({ ...manageFilters, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                                <select
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    value={manageFilters.dept} onChange={e => setManageFilters({ ...manageFilters, dept: e.target.value })}
                                >
                                    <option value="">Select Dept</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Year</label>
                                <select
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    value={manageFilters.year} onChange={e => setManageFilters({ ...manageFilters, year: e.target.value })}
                                >
                                    <option value="">Select Year</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Course</label>
                                <select
                                    className="block w-full rounded-lg border border-white/10 bg-slate-950 text-slate-200 py-3 px-4 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                                    value={manageFilters.course} onChange={e => setManageFilters({ ...manageFilters, course: e.target.value })}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={handleSearchRecords}
                            disabled={loading}
                            className="mt-6 w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                            Find Records
                        </button>
                    </div>

                    {hasSearched && (
                        <div className="animate-in fade-in duration-500">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    Found Records
                                    <span className="bg-slate-800 text-slate-300 text-sm py-1 px-3 rounded-full border border-white/10">{searchResults.length}</span>
                                </h3>
                                {searchResults.length > 0 && (
                                    <button
                                        onClick={handleDeleteAllFiltered}
                                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-sm font-bold py-2 px-5 rounded-lg flex items-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                                    >
                                        <Trash2 className="h-4 w-4" /> Delete ALL Shown
                                    </button>
                                )}
                            </div>

                            {searchResults.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 bg-slate-900/30 rounded-2xl border border-white/5 border-dashed">
                                    <Clock className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                                    No attendance records found for these criteria.
                                </div>
                            ) : (
                                <div className="overflow-hidden bg-slate-900/50 backdrop-blur-md shadow-xl rounded-2xl border border-white/5">
                                    <ul className="divide-y divide-white/5">
                                        {searchResults.map(record => (
                                            <li key={record._id} className="group hover:bg-white/[0.02] transition-colors">
                                                <div className="px-6 py-5 flex items-center justify-between">
                                                    <div className="flex items-center gap-6">
                                                        <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 min-w-[100px] flex flex-col items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                                                            <span className="text-indigo-400 font-bold text-[10px] uppercase tracking-wider mb-1">Time Slot</span>
                                                            <span className="text-white font-bold text-sm text-center">{record.timeSlot}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-bold text-white flex items-center gap-2">
                                                                {record.teacherName}
                                                                <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-white/5">{record.teacherEmail}</span>
                                                            </p>
                                                            <div className="mt-2 flex items-center gap-3 text-sm text-slate-400 font-mono">
                                                                <span className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-400 border border-emerald-500/10">
                                                                    <Users className="h-3 w-3" /> Present: {record.presentStudentIds?.length || 0}
                                                                </span>
                                                                <span className="flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded text-rose-400 border border-rose-500/10">
                                                                    <Users className="h-3 w-3" /> Absent: {record.absentStudentIds?.length || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 ml-4 gap-3">
                                                        <button
                                                            onClick={() => handleEditRecord(record)}
                                                            className="rounded-lg bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-400 ring-1 ring-inset ring-indigo-500/20 hover:bg-indigo-500/20 transition-all hover:scale-105"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRecord(record._id)}
                                                            className="rounded-lg bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-400 ring-1 ring-inset ring-rose-500/20 hover:bg-rose-500/20 transition-all hover:scale-105"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
