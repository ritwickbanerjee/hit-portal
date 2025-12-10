'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Upload, FileDown, Save, Trash2, Edit, Download } from 'lucide-react';

export default function AdminDashboard() {
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, attendanceRules: {}, teacherAssignments: {} });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);

    // Student Form State
    const [studentForm, setStudentForm] = useState({
        email: '', name: '', roll: '', department: '', year: '', course_code: '', guardian_email: ''
    });

    // CSV State
    const [stagedStudents, setStagedStudents] = useState<any[]>([]);
    const [showStaging, setShowStaging] = useState(false);

    // Teacher Assignment State
    const [assignFilter, setAssignFilter] = useState({ dept: '', year: '', course: '' });
    const [teacherInput, setTeacherInput] = useState({ name: '', email: '' });
    const [currentAssignmentRule, setCurrentAssignmentRule] = useState<number>(70);

    // Student List State
    const [students, setStudents] = useState<any[]>([]);

    // View Filters for Student List [NEW]
    const [viewFilter, setViewFilter] = useState({ dept: '', year: '', course: '' });

    // Derived Lists for Dropdowns
    const { departments, years, courses } = useMemo(() => {
        const depts = new Set<string>();
        const yrs = new Set<string>();
        const crs = new Set<string>();
        students.forEach(s => {
            if (s.department) depts.add(s.department);
            if (s.year) yrs.add(s.year);
            if (s.course_code) crs.add(s.course_code);
        });
        return {
            departments: Array.from(depts).sort(),
            years: Array.from(yrs).sort(),
            courses: Array.from(crs).sort()
        };
    }, [students]);

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

        fetchConfig();
        fetchStudents();
    }, []);

    // Filtered Students based on Access Control AND View Filters [UPDATED]
    const visibleStudents = useMemo(() => {
        let filtered = students;

        // 1. Access Control (Teacher Assignments)
        if (adminEmail) {
            const assignedKeys = Object.entries(config.teacherAssignments || {}).filter(([key, teachers]: [string, any]) => {
                return Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
            }).map(([key]) => key);

            if (assignedKeys.length > 0) {
                filtered = filtered.filter(s => {
                    const key = `${s.department}_${s.year}_${s.course_code}`;
                    return assignedKeys.includes(key);
                });
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
    }, [students, config, adminEmail, viewFilter]);

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

    const handleDeleteStudent = async (id: string) => {
        if (!confirm('Are you sure you want to delete this student?')) return;
        try {
            const res = await fetch(`/api/admin/students/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete student');
            }

            alert('Student deleted');
            fetchStudents();
        } catch (error: any) {
            alert(error.message);
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
        try {
            const res = await fetch('/api/admin/students/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ students: stagedStudents }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Bulk upload failed');
            }

            alert('Students uploaded successfully!');
            setStagedStudents([]);
            setShowStaging(false);
            fetchStudents();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
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

    const removeAssignment = async (key: string, emailToRemove: string) => {
        if (!confirm('Are you sure?')) return;
        const newConfig = { ...config };

        if (newConfig.teacherAssignments[key]) {
            newConfig.teacherAssignments[key] = newConfig.teacherAssignments[key].filter((t: any) => t.email !== emailToRemove);
            if (newConfig.teacherAssignments[key].length === 0) {
                delete newConfig.teacherAssignments[key];
            }
        }

        setConfig(newConfig);
        await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig),
        });
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ALL ${visibleStudents.length} displayed students? This cannot be undone.`)) return;

        setLoading(true);
        try {
            // Send IDs to delete
            const idsToDelete = visibleStudents.map(s => s._id);
            const res = await fetch('/api/admin/students/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: idsToDelete }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Bulk delete failed');
            }

            const data = await res.json();
            alert(data.message);
            fetchStudents(); // Refresh list
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Change Password State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.new !== passwordForm.confirm) {
            alert('New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/profile/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update password');

            alert('Password updated successfully! Please login again with the new password.');
            localStorage.removeItem('user');
            // Force logout
            window.location.href = '/admin/login';
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-white">Student Data Entry</h1>
                <div className="flex items-center gap-4">
                    {adminEmail && <div className="text-sm text-gray-400 hidden sm:block">Logged in as: <span className="text-blue-400 font-semibold">{JSON.parse(localStorage.getItem('user') || '{}').name}</span></div>}
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md transition-colors flex items-center gap-2 border border-gray-600"
                    >
                        <Save className="h-4 w-4" /> Change Password
                    </button>
                </div>
            </div>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-md p-6 shadow-2xl relative">
                        <h3 className="text-xl font-bold text-white mb-4">Change Password</h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
                                <input
                                    type="password" required
                                    className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={passwordForm.current}
                                    onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                                <input
                                    type="password" required
                                    className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={passwordForm.new}
                                    onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                                <input
                                    type="password" required
                                    className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={passwordForm.confirm}
                                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium shadow-sm transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Student & CSV */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Single Student */}
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-3">Add Single Student</h3>
                    <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 items-end">
                        <input type="email" placeholder="Email*" required className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500" value={studentForm.email} onChange={e => setStudentForm({ ...studentForm, email: e.target.value })} />
                        <input type="text" placeholder="Name*" required className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500" value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} />
                        <input type="text" placeholder="Roll*" required className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500" value={studentForm.roll} onChange={e => setStudentForm({ ...studentForm, roll: e.target.value })} />
                        <input type="text" placeholder="Department*" required className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500" value={studentForm.department} onChange={e => setStudentForm({ ...studentForm, department: e.target.value })} />
                        <input type="text" placeholder="Year*" required className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500" value={studentForm.year} onChange={e => setStudentForm({ ...studentForm, year: e.target.value })} />
                        <input type="text" placeholder="Course Code*" required className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500" value={studentForm.course_code} onChange={e => setStudentForm({ ...studentForm, course_code: e.target.value })} />
                        <input type="email" placeholder="Guardian Email" className="w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500 sm:col-span-2" value={studentForm.guardian_email} onChange={e => setStudentForm({ ...studentForm, guardian_email: e.target.value })} />
                        <button type="submit" disabled={loading} className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 w-full sm:col-span-2 disabled:opacity-50">{loading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Add'}</button>
                    </form>
                </div>

                {/* CSV Upload */}
                <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-3">Bulk Upload Students</h3>
                    <div className="flex gap-2 mt-2 flex-wrap items-center">
                        <label className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-500 cursor-pointer transition-colors text-sm font-semibold">
                            <Upload className="w-4 h-4 mr-2" />
                            Choose CSV
                            <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                        </label>
                        <button onClick={handleDownloadSample} className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md shadow-sm hover:bg-gray-500 transition-colors text-sm font-semibold">
                            <Download className="w-4 h-4 mr-2" />
                            Sample CSV
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Required: email, name, roll, department, year, course_code</p>
                </div>
            </div>

            {/* Staging Area */}
            {showStaging && (
                <div className="mt-4 mb-6">
                    <h3 className="text-lg font-semibold text-white">Staged Students ({stagedStudents.length})</h3>
                    <div className="mt-2 overflow-auto max-h-64 bg-gray-800 rounded-lg border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700 text-sm text-gray-300">
                            <thead className="bg-gray-700 sticky top-0 text-white">
                                <tr>
                                    <th className="px-3 py-2 text-left">Email</th>
                                    <th className="px-3 py-2 text-left">Name</th>
                                    <th className="px-3 py-2 text-left">Roll</th>
                                    <th className="px-3 py-2 text-left">Dept</th>
                                    <th className="px-3 py-2 text-left">Year</th>
                                    <th className="px-3 py-2 text-left">Course</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {stagedStudents.map((s, i) => (
                                    <tr key={i}>
                                        <td className="px-3 py-2">{s.email}</td>
                                        <td className="px-3 py-2">{s.name}</td>
                                        <td className="px-3 py-2">{s.roll}</td>
                                        <td className="px-3 py-2">{s.department}</td>
                                        <td className="px-3 py-2">{s.year}</td>
                                        <td className="px-3 py-2">{s.course_code}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={handleSubmitStaged} disabled={loading} className="mt-4 w-full rounded-md bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50">
                        {loading ? 'Uploading...' : 'Save Upload'}
                    </button>
                </div>
            )}

            {/* Registered Students List */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <h3 className="text-xl font-semibold text-white">Registered Students ({visibleStudents.length})</h3>

                    {/* View Filters */}
                    <div className="flex gap-2 text-sm">
                        <select
                            className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                            value={viewFilter.dept} onChange={e => setViewFilter({ ...viewFilter, dept: e.target.value })}
                        >
                            <option value="">All Depts</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                            className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                            value={viewFilter.year} onChange={e => setViewFilter({ ...viewFilter, year: e.target.value })}
                        >
                            <option value="">All Years</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                            className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
                            value={viewFilter.course} onChange={e => setViewFilter({ ...viewFilter, course: e.target.value })}
                        >
                            <option value="">All Courses</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        {visibleStudents.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded flex items-center gap-1 transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete Filtered
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-600 shadow-md max-h-96">
                    <table className="min-w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-200 uppercase bg-gray-700 border-b border-gray-600 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 font-bold">Name</th>
                                <th className="px-6 py-3 font-bold">Email</th>
                                <th className="px-6 py-3 font-bold">Roll</th>
                                <th className="px-6 py-3 font-bold">Dept/Year</th>
                                <th className="px-6 py-3 font-bold">Course</th>
                                <th className="px-6 py-3 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {visibleStudents.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-4">No students found (or not assigned to you)</td></tr>
                            ) : (
                                visibleStudents.map((s) => (
                                    <tr key={s._id} className="hover:bg-gray-800">
                                        <td className="px-6 py-4 font-medium text-white">{s.name}</td>
                                        <td className="px-6 py-4">{s.email}</td>
                                        <td className="px-6 py-4">{s.roll}</td>
                                        <td className="px-6 py-4">{s.department} - {s.year}</td>
                                        <td className="px-6 py-4">{s.course_code}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleDeleteStudent(s._id)} className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1 ml-auto">
                                                <Trash2 className="h-3 w-3" /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Global Settings */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Global Settings & Assignments</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end mb-6">
                    {/* Filters */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                        <select
                            className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            value={assignFilter.dept} onChange={e => setAssignFilter({ ...assignFilter, dept: e.target.value })}
                        >
                            <option value="">Select Dept</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Year</label>
                        <select
                            className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            value={assignFilter.year} onChange={e => setAssignFilter({ ...assignFilter, year: e.target.value })}
                        >
                            <option value="">Select Year</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Course</label>
                        <select
                            className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            value={assignFilter.course} onChange={e => setAssignFilter({ ...assignFilter, course: e.target.value })}
                        >
                            <option value="">Select Course</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Assignment & Rules (Only visible if filters selected) */}
                {assignFilter.dept && assignFilter.year && assignFilter.course && (
                    <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 mb-6">
                        <h4 className="text-lg font-semibold text-white mb-3">Settings for {assignFilter.dept} - {assignFilter.year} - {assignFilter.course}</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Attendance Requirement (%)</label>
                                <input
                                    type="number" min="0" max="100"
                                    className="block w-full rounded-md border-0 bg-gray-700 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                    value={currentAssignmentRule}
                                    onChange={e => setCurrentAssignmentRule(parseInt(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Teacher</label>
                                <div className="flex items-center gap-2 p-2 bg-gray-700/50 rounded border border-gray-600">
                                    <span className="text-gray-300 text-sm">Assign to:</span>
                                    <span className="text-blue-400 font-semibold text-sm">
                                        {JSON.parse(localStorage.getItem('user') || '{}').name || 'Me'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSaveSettings} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 mt-4 disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save / Add Assignment'}
                        </button>
                    </div>
                )}

                {/* Assignments List */}
                <div className="mt-8 pt-6 border-t border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Active Faculty Assignments</h4>
                    <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-600 shadow-md">
                        <table className="min-w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-200 uppercase bg-gray-700 border-b border-gray-600">
                                <tr>
                                    <th className="px-6 py-3 font-bold">Assignment Key</th>
                                    <th className="px-6 py-3 font-bold">Attendance %</th>
                                    <th className="px-6 py-3 font-bold">Faculty Members</th>
                                    <th className="px-6 py-3 font-bold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {Object.entries(config.teacherAssignments || {}).map(([key, teachers]: [string, any]) => (
                                    <tr key={key} className="hover:bg-gray-800">
                                        <td className="px-6 py-4 font-medium text-white">{key}</td>
                                        <td className="px-6 py-4 text-blue-300">{config.attendanceRules?.[key] || config.attendanceRequirement}%</td>
                                        <td className="px-6 py-4 text-gray-300">
                                            <div className="flex flex-col gap-1">
                                                {Array.isArray(teachers) && teachers.map((t: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between bg-gray-800 px-2 py-1 rounded border border-gray-700">
                                                        <span>{t.name} <span className="text-xs text-gray-500">({t.email})</span></span>
                                                        <button onClick={() => removeAssignment(key, t.email)} className="text-red-500 hover:text-red-400 ml-2"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {/* Actions handled per teacher above */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
