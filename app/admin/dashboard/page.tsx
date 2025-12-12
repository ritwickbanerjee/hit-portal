'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Upload, FileDown, Save, Trash2, Edit, Download, CheckSquare, Square, AlertTriangle, X } from 'lucide-react';

export default function AdminDashboard() {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);

    // Global Admin State
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    // Student Form State
    const [studentForm, setStudentForm] = useState({
        email: '', name: '', roll: '', department: '', year: '', course_code: '', guardian_email: ''
    });

    // CSV State
    const [stagedStudents, setStagedStudents] = useState<any[]>([]);
    const [showStaging, setShowStaging] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, failed: 0 });

    // Teacher Assignment State
    const [assignFilter, setAssignFilter] = useState({ dept: '', year: '', course: '' });
    const [teacherInput, setTeacherInput] = useState({ name: '', email: '' });
    const [currentAssignmentRule, setCurrentAssignmentRule] = useState<number>(70);

    // Student List State
    const [students, setStudents] = useState<any[]>([]);

    // View Filters for Student List [NEW]
    const [viewFilter, setViewFilter] = useState({ dept: '', year: '', course: '' });

    // Selection & Delete Modal State [NEW]
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, type: 'single' | 'bulk' | 'assignment', id?: string, count?: number, payload?: any }>({ open: false, type: 'single' });

    // Clear selection when filters change
    useEffect(() => {
        setSelectedStudentIds(new Set());
    }, [viewFilter]);

    // Derived Lists for Dropdowns [UPDATED with Access Control]
    const { departments, years, courses } = useMemo(() => {
        const depts = new Set<string>();
        const yrs = new Set<string>();
        const crs = new Set<string>();

        // If Global Admin, use all students to populate dropdowns (as they have access to everything)
        if (isGlobalAdmin) {
            students.forEach(s => {
                if (s.department) depts.add(s.department);
                if (s.year) yrs.add(s.year);
                if (s.course_code) crs.add(s.course_code);
            });
        } else if (adminEmail && config.teacherAssignments) {
            // If Faculty, only show what they are assigned to
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
    }, [students, isGlobalAdmin, adminEmail, config]);

    // ...

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/admin/students/all');
            if (res.ok) {
                const data = await res.json();
                setStudents(data);
            }
        } catch (error) {
            console.error('Failed to fetch students', error);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/config');
            if (res.ok) {
                const data = await res.json();
                setConfig(data || { attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
            }
        } catch (error) {
            console.error('Failed to fetch config', error);
        }
    };

    useEffect(() => {
        // Get Admin Email from localStorage (Temporary Auth)
        const user = localStorage.getItem('user'); // FIXED: Matches login page key
        if (user) {
            try {
                const parsed = JSON.parse(user);
                setAdminEmail(parsed.email || null);
            } catch (e) { console.error(e); }
        }

        // Check Global Admin Status
        const ga = localStorage.getItem('globalAdminActive');
        if (ga === 'true') setIsGlobalAdmin(true);

        fetchConfig();
        fetchStudents();
    }, []);

    // Filtered Students based on Access Control AND View Filters [UPDATED]
    const visibleStudents = useMemo(() => {
        let filtered = students;

        // 1. Access Control (Teacher Assignments)
        if (!isGlobalAdmin && adminEmail) {
            const assignedKeys = Object.entries(config.teacherAssignments || {}).filter(([key, teachers]: [string, any]) => {
                return Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
            }).map(([key]) => key);

            if (assignedKeys.length > 0) {
                filtered = filtered.filter(s => {
                    const key = `${s.department}_${s.year}_${s.course_code}`;
                    return assignedKeys.includes(key);
                });
            } else {
                filtered = [];
            }
        }

        // 2. View Filters
        if (viewFilter.dept) filtered = filtered.filter(s => s.department === viewFilter.dept);
        if (viewFilter.year) filtered = filtered.filter(s => s.year === viewFilter.year);
        if (viewFilter.course) filtered = filtered.filter(s => s.course_code === viewFilter.course);

        // Sort by Roll Number Ascending
        filtered.sort((a, b) => {
            const rollA = a.roll ? String(a.roll).toLowerCase() : '';
            const rollB = b.roll ? String(b.roll).toLowerCase() : '';

            // Try numeric sort first if both are numbers
            const numA = parseInt(rollA);
            const numB = parseInt(rollB);

            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }

            return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
        });

        return filtered;
    }, [students, config, adminEmail, viewFilter, isGlobalAdmin]);

    // Active Assignments Filter (Access Control)
    const visibleAssignments = useMemo(() => {
        const allAssignments = Object.entries(config.teacherAssignments || {});
        if (isGlobalAdmin) return allAssignments;

        if (!adminEmail) return [];

        return allAssignments.filter(([key, teachers]: [string, any]) => {
            return Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
        });
    }, [config, adminEmail, isGlobalAdmin]);

    const handleGlobalAdminLogin = () => {
        if (isGlobalAdmin) {
            // Logout Logic
            setIsGlobalAdmin(false);
            localStorage.removeItem('globalAdminActive');
            alert("Global Admin Access Revoked");
        } else {
            // Login Logic
            const password = prompt("Enter Global Admin Password:");
            if (password === "globaladmin_25") {
                setIsGlobalAdmin(true);
                localStorage.setItem('globalAdminActive', 'true');
                alert("Global Admin Access Granted");
            } else if (password) {
                alert("Incorrect Password");
            }
        }
    };

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/admin/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentForm),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to add student');
            }

            alert('Student added successfully!');
            setStudentForm({ email: '', name: '', roll: '', department: '', year: '', course_code: '', guardian_email: '' });
            fetchStudents();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStudent = (id: string) => {
        setDeleteConfirm({ open: true, type: 'single', id });
    };

    const handleBulkDelete = () => {
        if (selectedStudentIds.size === 0) return;
        setDeleteConfirm({ open: true, type: 'bulk', count: selectedStudentIds.size });
    };

    const confirmDeleteAction = async () => {
        setLoading(true);
        try {
            if (deleteConfirm.type === 'single' && deleteConfirm.id) {
                const res = await fetch(`/api/admin/students/${deleteConfirm.id}`, { method: 'DELETE' });
                if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to delete student'); }
                alert('Student deleted');
            } else if (deleteConfirm.type === 'bulk') {
                const idsToDelete = Array.from(selectedStudentIds);
                const res = await fetch('/api/admin/students/bulk-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: idsToDelete }),
                });
                if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Bulk delete failed'); }
                const data = await res.json();
                alert(data.message);
                setSelectedStudentIds(new Set());
            } else if (deleteConfirm.type === 'assignment' && deleteConfirm.payload) {
                const { key, email } = deleteConfirm.payload;
                const newConfig = { ...config };
                if (newConfig.teacherAssignments[key]) {
                    newConfig.teacherAssignments[key] = newConfig.teacherAssignments[key].filter((t: any) => t.email !== email);
                    if (newConfig.teacherAssignments[key].length === 0) delete newConfig.teacherAssignments[key];
                }
                setConfig(newConfig);
                await fetch('/api/admin/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig),
                });
            }
            fetchStudents();
            setDeleteConfirm({ ...deleteConfirm, open: false });
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Improved CSV Parsing
    const parseCSV = (text: string) => {
        const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) throw new Error('CSV is empty or missing data');

        // Normalize headers: remove spaces, lowercase, handle aliases
        const normalizeHeader = (h: string) => {
            const lower = h.toLowerCase().replace(/[\s_]+/g, ''); // remove spaces and underscores
            if (lower === 'coursecode' || lower === 'course') return 'course_code';
            if (lower === 'dept' || lower === 'department') return 'department';
            if (lower === 'guardian' || lower === 'guardianemail') return 'guardian_email';
            return lower;
        };

        const headers = lines[0].split(',').map(h => normalizeHeader(h.trim()));
        const required = ['email', 'name', 'roll', 'department', 'year', 'course_code'];

        const missing = required.filter(r => !headers.includes(r));
        if (missing.length > 0) throw new Error(`Missing headers: ${missing.join(', ')}`);

        return lines.slice(1).map((line, i) => {
            const values = line.split(','); // Simple split
            const obj: any = {};
            headers.forEach((h, idx) => {
                obj[h] = values[idx]?.trim();
            });
            return obj;
        }).filter(row => row.email && row.roll);
    };

    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = parseCSV(text);
            setStagedStudents(data);
            setShowStaging(true);
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleDownloadSample = () => {
        const headers = ['email', 'name', 'roll', 'department', 'year', 'course_code', 'guardian_email'];
        const sample = 'student@example.com,John Doe,123,CSE,3rd,CS301,parent@example.com';
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + sample;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_sample.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmitStaged = async () => {
        setLoading(true);
        const BATCH_SIZE = 40;
        const total = stagedStudents.length;
        setUploadProgress({ current: 0, total, failed: 0 });

        let processed = 0;
        let failedCount = 0;
        let errors: string[] = [];

        try {
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = stagedStudents.slice(i, i + BATCH_SIZE);

                try {
                    const res = await fetch('/api/admin/students/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ students: batch }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        failedCount += batch.length;
                        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data.error || 'Failed'}`);
                    } else {
                        // Backend returns results: { added: n, failed: m, errors: [...] }
                        if (data.results?.failed) {
                            failedCount += data.results.failed;
                            if (data.results.errors) errors.push(...data.results.errors);
                        }
                    }
                } catch (err: any) {
                    failedCount += batch.length;
                    errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} network error: ${err.message}`);
                }

                processed += batch.length;
                setUploadProgress(prev => ({ ...prev, current: processed, failed: failedCount }));
            }

            if (failedCount > 0) {
                alert(`Upload complete with issues.\nProcessed: ${total}\nFailed: ${failedCount}\n\nCheck console for details.`);
                console.error("Upload Errors:", errors);
            } else {
                alert(`Successfully uploaded ${total} students!`);
            }

            setStagedStudents([]);
            setShowStaging(false);
            fetchStudents();
        } catch (error: any) {
            alert('Critical upload error: ' + error.message);
        } finally {
            setLoading(false);
            setUploadProgress({ current: 0, total: 0, failed: 0 });
        }
    };

    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            const newConfig = { ...config };

            if (assignFilter.dept && assignFilter.year && assignFilter.course) {
                const key = `${assignFilter.dept}_${assignFilter.year}_${assignFilter.course}`;

                // Save Attendance Rule
                if (!newConfig.attendanceRules) newConfig.attendanceRules = {};
                newConfig.attendanceRules[key] = currentAssignmentRule;

                // Save Teacher Assignment (Auto-assign Current Admin)
                if (adminEmail) {
                    if (!newConfig.teacherAssignments) newConfig.teacherAssignments = {};
                    if (!newConfig.teacherAssignments[key]) newConfig.teacherAssignments[key] = [];

                    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                    const teacherData = { name: currentUser.name || 'Admin', email: adminEmail };

                    // Add if not exists
                    const exists = newConfig.teacherAssignments[key].some((t: any) => t.email === teacherData.email);
                    if (!exists) {
                        newConfig.teacherAssignments[key].push(teacherData);
                    }
                }
            }

            const res = await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig),
            });

            if (!res.ok) throw new Error('Failed to save settings');

            setConfig(newConfig);
            setTeacherInput({ name: '', email: '' }); // Reset input
            alert('Settings saved!');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const removeAssignment = (key: string, emailToRemove: string) => {
        setDeleteConfirm({ open: true, type: 'assignment', payload: { key, email: emailToRemove } });
    };



    // Change Password State


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Global Admin - REMOVED (Moved to Layout) */}
            <div className="flex justify-end gap-2 items-center">
                {/* Placeholder to keep spacing if needed, or just remove */}
            </div>

            {/* Add Student & CSV */}

            {/* Add Student & CSV */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Add Students (Bulk) - SWAPPED LEFT */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-6 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Upload className="h-4 w-4" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Add Students</h3> {/* Renamed */}
                        </div>
                        <p className="text-sm text-slate-400 mb-6">Upload a CSV to add multiple students. Ensure it follows the required format.</p>

                        <div className="flex gap-3 flex-wrap items-center">
                            <label className="flex-1 flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 cursor-pointer transition-all text-sm font-medium hover:-translate-y-0.5">
                                <Upload className="w-4 h-4 mr-2" />
                                Select CSV File
                                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                            </label>
                            <button onClick={handleDownloadSample} className="flex-1 flex items-center justify-center px-4 py-3 bg-slate-800 text-slate-300 rounded-lg border border-white/5 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium">
                                <Download className="w-4 h-4 mr-2" />
                                Download Sample
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                        <p className="text-xs font-mono text-indigo-300 break-all">Format: email, name, roll, department, year, course_code, guardian_email</p>
                    </div>
                </div>

                {/* Add Single Student  - SWAPPED RIGHT */}
                <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-8 w-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                            <Edit className="h-4 w-4" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Add Single Student</h3>
                    </div>
                    <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="email" placeholder="Email Address*" required className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all" value={studentForm.email} onChange={e => setStudentForm({ ...studentForm, email: e.target.value })} />
                        <input type="text" placeholder="Full Name*" required className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all" value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} />
                        <input type="text" placeholder="Roll Number*" required className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all" value={studentForm.roll} onChange={e => setStudentForm({ ...studentForm, roll: e.target.value })} />
                        <input type="text" placeholder="Department (e.g. ME, CSE-A, etc.)*" required className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all" value={studentForm.department} onChange={e => setStudentForm({ ...studentForm, department: e.target.value })} />
                        <input type="text" placeholder="Year (e.g. 4th)*" required className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all" value={studentForm.year} onChange={e => setStudentForm({ ...studentForm, year: e.target.value })} />
                        <input type="text" placeholder="Course Code*" required className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all" value={studentForm.course_code} onChange={e => setStudentForm({ ...studentForm, course_code: e.target.value })} />
                        <input type="email" placeholder="Guardian Email (Optional)" className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-green-500 outline-none transition-all sm:col-span-2" value={studentForm.guardian_email} onChange={e => setStudentForm({ ...studentForm, guardian_email: e.target.value })} />

                        <button type="submit" disabled={loading} className="col-span-1 sm:col-span-2 mt-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/20 hover:bg-green-500 transition-all disabled:opacity-50 disabled:shadow-none">
                            {loading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Add Student'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Staging Area */}
            {showStaging && (
                <div className="mt-4 mb-8 animate-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-semibold text-white mb-3">Staged Students <span className="text-slate-400 text-sm font-normal">({stagedStudents.length} records found)</span></h3>
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-md shadow-2xl">
                        <div className="overflow-x-auto max-h-64 custom-scrollbar">
                            <table className="min-w-full divide-y divide-white/5 text-sm text-slate-300">
                                <thead className="bg-white/5 sticky top-0 text-white backdrop-blur-md z-1">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Email</th>
                                        <th className="px-4 py-3 text-left font-medium">Name</th>
                                        <th className="px-4 py-3 text-left font-medium">Roll</th>
                                        <th className="px-4 py-3 text-left font-medium">Dept</th>
                                        <th className="px-4 py-3 text-left font-medium">Year</th>
                                        <th className="px-4 py-3 text-left font-medium">Course</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 bg-transparent">
                                    {stagedStudents.map((s, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-2.5">{s.email}</td>
                                            <td className="px-4 py-2.5 font-medium text-white">{s.name}</td>
                                            <td className="px-4 py-2.5 font-mono text-xs">{s.roll}</td>
                                            <td className="px-4 py-2.5">{s.department}</td>
                                            <td className="px-4 py-2.5">{s.year}</td>
                                            <td className="px-4 py-2.5">{s.course_code}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <button onClick={handleSubmitStaged} disabled={loading} className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-green-500/20 hover:bg-green-500 transition-all disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5">
                        {loading && uploadProgress.total > 0
                            ? `Uploading... ${Math.round((uploadProgress.current / uploadProgress.total) * 100)}% (${uploadProgress.current}/${uploadProgress.total})`
                            : loading
                                ? 'Uploading Students...'
                                : `Confirm & Upload ${stagedStudents.length} Students`}
                    </button>
                    {loading && uploadProgress.total > 0 && (
                        <div className="w-full bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                            <div
                                className="bg-green-500 h-2 transition-all duration-300 ease-out"
                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            )}

            {/* Registered Students List */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-6 shadow-xl mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-semibold text-white">Registered Students</h3>
                        <p className="text-sm text-slate-400 mt-1">Manage existing student records ({visibleStudents.length})</p>
                    </div>

                    {/* View Filters */}
                    <div className="flex flex-wrap gap-2 text-sm bg-slate-950/50 p-1.5 rounded-lg border border-white/5">
                        <select
                            className="bg-transparent text-slate-300 border-none rounded px-3 py-1.5 focus:ring-0 outline-none hover:text-white transition-colors cursor-pointer"
                            value={viewFilter.dept} onChange={e => setViewFilter({ ...viewFilter, dept: e.target.value })}
                        >
                            <option value="" className="bg-slate-900 text-slate-200">All Depts</option>
                            {departments.map(d => <option key={d} value={d} className="bg-slate-900 text-slate-200">{d}</option>)}
                        </select>
                        <div className="w-px bg-white/10 my-1"></div>
                        <select
                            className="bg-transparent text-slate-300 border-none rounded px-3 py-1.5 focus:ring-0 outline-none hover:text-white transition-colors cursor-pointer"
                            value={viewFilter.year} onChange={e => setViewFilter({ ...viewFilter, year: e.target.value })}
                        >
                            <option value="" className="bg-slate-900 text-slate-200">All Years</option>
                            {years.map(y => <option key={y} value={y} className="bg-slate-900 text-slate-200">{y}</option>)}
                        </select>
                        <div className="w-px bg-white/10 my-1"></div>
                        <select
                            className="bg-transparent text-slate-300 border-none rounded px-3 py-1.5 focus:ring-0 outline-none hover:text-white transition-colors cursor-pointer"
                            value={viewFilter.course} onChange={e => setViewFilter({ ...viewFilter, course: e.target.value })}
                        >
                            <option value="" className="bg-slate-900 text-slate-200">All Courses</option>
                            {courses.map(c => <option key={c} value={c} className="bg-slate-900 text-slate-200">{c}</option>)}
                        </select>

                        {visibleStudents.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedStudentIds.size === 0}
                                className={`ml-2 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all text-xs font-medium border ${selectedStudentIds.size > 0
                                    ? 'bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border-red-500/20 shadow-lg shadow-red-500/10'
                                    : 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
                                    }`}
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete Selected ({selectedStudentIds.size})
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-white/5">
                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                        <table className="min-w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-200 uppercase bg-white/5 border-b border-white/5 sticky top-0 backdrop-blur-md z-10">
                                <tr>
                                    <th className="px-6 py-4 font-semibold tracking-wider w-10">
                                        <button
                                            onClick={() => {
                                                if (selectedStudentIds.size === visibleStudents.length) setSelectedStudentIds(new Set());
                                                else setSelectedStudentIds(new Set(visibleStudents.map(s => s._id)));
                                            }}
                                            className="text-slate-400 hover:text-white transition-colors"
                                        >
                                            {visibleStudents.length > 0 && selectedStudentIds.size === visibleStudents.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                        </button>
                                    </th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Name</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Email</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Roll</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Dept/Year</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider">Course</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Edit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-transparent">
                                {visibleStudents.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-slate-500 italic">No students found matching filters (or no assignment access).</td></tr>
                                ) : (
                                    visibleStudents.map((s) => (
                                        <tr key={s._id} className={`transition-colors group ${selectedStudentIds.has(s._id) ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-white/5'}`}>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => {
                                                        const newSet = new Set(selectedStudentIds);
                                                        if (newSet.has(s._id)) newSet.delete(s._id);
                                                        else newSet.add(s._id);
                                                        setSelectedStudentIds(newSet);
                                                    }}
                                                    className={`transition-colors ${selectedStudentIds.has(s._id) ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    {selectedStudentIds.has(s._id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white">{s.name}</td>
                                            <td className="px-6 py-4">{s.email}</td>
                                            <td className="px-6 py-4 font-mono text-xs">{s.roll}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs border border-white/5">{s.department}</span>
                                                <span className="mx-2 text-slate-600">/</span>
                                                <span>{s.year}</span>
                                            </td>
                                            <td className="px-6 py-4">{s.course_code}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDeleteStudent(s._id)} className="text-xs bg-transparent hover:bg-red-500/10 text-slate-500 hover:text-red-400 px-3 py-1.5 rounded transition-all flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100">
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="mt-4 text-center text-xs text-slate-500">
                    Showing {visibleStudents.length} records
                </div>
            </div>

            {/* Global Settings */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-6 shadow-xl mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Assign Students & Attendance Percentage</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end mb-6">
                    {/* Filters */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                        <select
                            className="block w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            value={assignFilter.dept} onChange={e => setAssignFilter({ ...assignFilter, dept: e.target.value })}
                        >
                            <option value="" className="bg-slate-950 text-slate-300">Select Dept</option>
                            {departments.map(d => <option key={d} value={d} className="bg-slate-950 text-slate-300">{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Year</label>
                        <select
                            className="block w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            value={assignFilter.year} onChange={e => setAssignFilter({ ...assignFilter, year: e.target.value })}
                        >
                            <option value="" className="bg-slate-950 text-slate-300">Select Year</option>
                            {years.map(y => <option key={y} value={y} className="bg-slate-950 text-slate-300">{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Course</label>
                        <select
                            className="block w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            value={assignFilter.course} onChange={e => setAssignFilter({ ...assignFilter, course: e.target.value })}
                        >
                            <option value="" className="bg-slate-950 text-slate-300">Select Course</option>
                            {courses.map(c => <option key={c} value={c} className="bg-slate-950 text-slate-300">{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Assignment & Rules (Only visible if filters selected) */}
                {assignFilter.dept && assignFilter.year && assignFilter.course && (
                    <div className="bg-slate-950/30 p-4 rounded-xl border border-white/10 mb-6 backdrop-blur-sm">
                        <h4 className="text-lg font-semibold text-white mb-3">Attendance Requirement in {assignFilter.course} classes for {assignFilter.dept} ({assignFilter.year})</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Attendance Requirement (%)</label>
                                <div className="relative">
                                    <input
                                        type="number" min="0" max="100"
                                        className="block w-full rounded-lg border border-white/10 bg-slate-900 py-2.5 px-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-8"
                                        value={currentAssignmentRule}
                                        onChange={e => setCurrentAssignmentRule(parseInt(e.target.value))}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-slate-500 font-bold">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Teacher</label>
                                <div className="flex items-center gap-2 p-2.5 bg-slate-900 rounded-lg border border-white/10">
                                    <span className="text-slate-400 text-sm">Assign to:</span>
                                    <span className="text-indigo-400 font-semibold text-sm">
                                        {JSON.parse(localStorage.getItem('user') || '{}').name || 'Me'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSaveSettings} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 mt-4 disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-white/5">
                    <h4 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">Co-teachers</h4>
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-950/30 overflow-x-auto custom-scrollbar">
                        <table className="min-w-full text-sm text-left text-slate-400">
                            <thead className="text-xs text-slate-200 uppercase bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-3 font-bold">Course</th>
                                    <th className="px-6 py-3 font-bold">Attendance %</th>
                                    <th className="px-6 py-3 font-bold">Faculty Members</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {visibleAssignments.map(([key, teachers]: [string, any]) => (
                                    <tr key={key} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{key}</td>
                                        <td className="px-6 py-4 text-emerald-400 font-bold">{config.attendanceRules?.[key] || config.attendanceRequirement}%</td>
                                        <td className="px-6 py-4 text-slate-300">
                                            <div className="flex flex-col gap-2">
                                                {Array.isArray(teachers) && teachers.map((t: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                                                        <span>{t.name} <span className="text-xs text-slate-500">({t.email})</span></span>
                                                        <button onClick={() => removeAssignment(key, t.email)} className="text-slate-500 hover:text-red-400 ml-2 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {/* Delete Confirmation Modal */}
            {deleteConfirm.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-md p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center p-4">
                            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Confirm Deletion</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                {deleteConfirm.type === 'single' && "Are you sure you want to delete this student? This action cannot be undone."}
                                {deleteConfirm.type === 'bulk' && `Are you sure you want to delete ${deleteConfirm.count} selected students? This action cannot be undone.`}
                                {deleteConfirm.type === 'assignment' && "Remove this faculty assignment?"}
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setDeleteConfirm({ ...deleteConfirm, open: false })} className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-white/5">Cancel</button>
                                <button onClick={confirmDeleteAction} className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-500/20 transition-all hover:-translate-y-0.5">
                                    {loading ? <Loader2 className="animate-spin h-4 w-4 mx-auto" /> : 'Confirm Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
