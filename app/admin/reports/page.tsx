'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2, Calendar, FileSpreadsheet, Copy, Mail, Search, Upload, Download, Edit, Save, X, Trash2, ArrowRight, MessageSquare, MessageCircle, Shield } from 'lucide-react';

export default function AdminReports() {
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [allAttendanceRecords, setAllAttendanceRecords] = useState<any[]>([]);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, teacherAssignments: {} });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [adminName, setAdminName] = useState<string | null>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    // Global Admin State
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    // Student Database Filters
    const [dbSearch, setDbSearch] = useState('');
    const [dbFilters, setDbFilters] = useState({ dept: '', year: '', course: '' });

    // Report Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportFilters, setReportFilters] = useState({ dept: '', year: '', course: '' });
    const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);
    const [reportData, setReportData] = useState<{ students: any[], records: any[] } | null>(null);

    // Edit Modal
    const [editingStudent, setEditingStudent] = useState<any | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Import Preview Modal
    const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Adjustment State (for inline editing)
    const [adjustments, setAdjustments] = useState<{ [key: string]: { attended: number, total: number } }>({});

    // Fetch Initial Data
    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                setAdminEmail(parsed.email || null);
                setAdminName(parsed.name || null);
            } catch (e) { console.error(e); }
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const [studentsRes, configRes, attendanceRes] = await Promise.all([
                    fetch('/api/admin/students/all'),
                    fetch('/api/admin/config'),
                    fetch('/api/admin/attendance') // Fetch all for stats
                ]);

                if (studentsRes.ok) setStudents(await studentsRes.json());
                if (configRes.ok) setConfig(await configRes.json());
                if (attendanceRes.ok) setAllAttendanceRecords(await attendanceRes.json());
            } catch (error) {
                console.error('Failed to fetch data', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // Check Global Admin Status
        const ga = localStorage.getItem('globalAdminActive');
        if (ga === 'true') setIsGlobalAdmin(true);

    }, []);

    // Access Control (Faculty Visibility)
    const visibleStudents = useMemo(() => {
        let filtered = students;

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
                filtered = []; // Blank slate
            }
        }
        // If isGlobalAdmin is true, return all students (no filtering)

        return filtered;
    }, [students, config, adminEmail, isGlobalAdmin]);

    // Derived Lists for Dropdowns
    const { departments, years, courses } = useMemo(() => {
        const depts = new Set<string>();
        const yrs = new Set<string>();
        const crs = new Set<string>();
        visibleStudents.forEach(s => {
            if (s.department) depts.add(s.department);
            if (s.year) yrs.add(s.year);
            if (s.course_code) crs.add(s.course_code);
        });
        return {
            departments: Array.from(depts).sort(),
            years: Array.from(yrs).sort(),
            courses: Array.from(crs).sort()
        };
    }, [visibleStudents]);

    // Available Faculties for Report Filters
    const availableFaculties = useMemo(() => {
        if (!reportFilters.dept || !reportFilters.year || !reportFilters.course) return [];
        const key = `${reportFilters.dept}_${reportFilters.year}_${reportFilters.course}`;
        return config.teacherAssignments?.[key] || [];
    }, [config, reportFilters]);

    // Reset selected faculties when filters change
    useEffect(() => {
        setSelectedFaculties([]);
    }, [reportFilters]);

    // Filtered Students for Database View
    const filteredDbStudents = useMemo(() => {
        return visibleStudents.filter(s => {
            const matchesSearch = !dbSearch ||
                (s.name?.toLowerCase().includes(dbSearch.toLowerCase())) ||
                (s.roll?.toLowerCase().includes(dbSearch.toLowerCase()));

            const matchesDept = !dbFilters.dept || s.department === dbFilters.dept;
            const matchesYear = !dbFilters.year || s.year === dbFilters.year;
            const matchesCourse = !dbFilters.course || s.course_code === dbFilters.course;

            return matchesSearch && matchesDept && matchesYear && matchesCourse;
        }).sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));
    }, [visibleStudents, dbSearch, dbFilters]);

    // --- Actions ---

    const handleEditClick = (student: any) => {
        setEditingStudent({ ...student });
        setIsEditModalOpen(true);
    };

    const handleSaveStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudent) return;

        try {
            const res = await fetch(`/api/admin/students/${editingStudent._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingStudent)
            });

            if (!res.ok) throw new Error('Failed to update student');

            const updated = await res.json();
            setStudents(prev => prev.map(s => s._id === updated._id ? updated : s));
            setIsEditModalOpen(false);
            alert('Student updated successfully!');
        } catch (error) {
            console.error(error);
            alert('Failed to update student.');
        }
    };

    const handleAdjustmentChange = (studentId: string, field: 'attended' | 'total', value: string) => {
        const numVal = parseInt(value) || 0;
        setAdjustments(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field === 'attended' ? 'attended' : 'total']: numVal
            }
        }));
    };

    const handleSaveAdjustment = async (student: any) => {
        const adj = adjustments[student._id];
        if (!adj) return;

        const newAttendedAdj = adj.attended !== undefined ? adj.attended : (student.attended_adjustment || 0);
        const newTotalAdj = adj.total !== undefined ? adj.total : (student.total_classes_adjustment || 0);

        try {
            const res = await fetch(`/api/admin/students/${student._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attended_adjustment: newAttendedAdj,
                    total_classes_adjustment: newTotalAdj
                })
            });

            if (!res.ok) throw new Error('Failed to save adjustment');

            const updated = await res.json();
            setStudents(prev => prev.map(s => s._id === updated._id ? updated : s));
            setAdjustments(prev => {
                const next = { ...prev };
                delete next[student._id];
                return next;
            });
            alert('Adjustment saved!');
        } catch (error) {
            console.error(error);
            alert('Failed to save adjustment.');
        }
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            alert('Please select a date range.');
            return;
        }
        setLoading(true);
        try {
            const filteredStudents = visibleStudents.filter(s =>
                (!reportFilters.dept || s.department === reportFilters.dept) &&
                (!reportFilters.year || s.year === reportFilters.year) &&
                (!reportFilters.course || s.course_code === reportFilters.course)
            ).sort((a, b) => (a.roll || '').localeCompare(b.roll || ''));

            if (filteredStudents.length === 0) {
                alert('No students match the selected filters.');
                setReportData(null);
                return;
            }

            const params = new URLSearchParams({ startDate, endDate });
            if (reportFilters.dept) params.append('department', reportFilters.dept);
            if (reportFilters.year) params.append('year', reportFilters.year);
            if (reportFilters.course) params.append('course_code', reportFilters.course);

            console.log('Fetching report with params:', params.toString()); // Debug

            const res = await fetch(`/api/admin/attendance?${params}`);
            if (!res.ok) throw new Error('Failed to fetch attendance records');

            let records = await res.json();
            console.log('Fetched records:', records.length); // Debug

            const timeSlotOrder = ["9-10AM", "10-11AM", "11-12PM", "12-1PM", "1-2PM", "2-3PM", "3-4PM", "4-5PM", "5-6PM"];
            records.sort((a: any, b: any) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return timeSlotOrder.indexOf(a.timeSlot) - timeSlotOrder.indexOf(b.timeSlot);
            });

            // Filter by selected faculties if any
            if (selectedFaculties.length > 0) {
                records = records.filter((r: any) => selectedFaculties.includes(r.teacherEmail));
            }

            if (records.length === 0) {
                alert('No attendance records found for the selected criteria.');
                // We still set reportData to show the empty table structure or handle it in UI
            }

            setReportData({ students: filteredStudents, records });
            setTimeout(() => {
                reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (error) {
            console.error(error);
            alert('Error generating report');
        } finally {
            setLoading(false);
        }
    };

    // --- Import/Export ---

    const exportDbToCSV = () => {
        const headers = [
            "Student Name", "Roll Number", "Department", "Year", "Course Code",
            "Student Email", "Guardian Email",
            "System Attended", "System Total Classes",
            "System Attended", "System Total Classes",
            "Adjusted Attended", "Adjusted Total Classes",
            "Total Attended", "Total Classes",
            "Attendance Percentage"
        ];
        let csvContent = headers.join(',') + '\n';

        filteredDbStudents.forEach(s => {
            const stats = calculateStats(s, allAttendanceRecords);
            const row = [
                `"${s.name}"`, s.roll, s.department, s.year, s.course_code,
                s.email, s.guardian_email || '',
                stats.baseAttended, stats.baseTotal,
                s.attended_adjustment || 0, s.total_classes_adjustment || 0,
                stats.finalAttended, stats.finalTotal,
                `${stats.percent}%`
            ];
            csvContent += row.join(',') + '\n';
        });

        downloadCSV(csvContent, 'Student_Attendance_Report.csv');
    };

    const exportReportToCSV = () => {
        if (!reportData) return;

        // Header
        let csvContent = "Student Name,Roll Number,Department,Year,Course Code,";
        reportData.records.forEach((r: any) => {
            const dateStr = r.date.split('-').reverse().slice(0, 2).join('/');
            csvContent += `"${dateStr} ${r.timeSlot} (${r.teacherName})",`;
        });
        csvContent += "Attended,Total,Percentage\n";

        // Rows
        reportData.students.forEach(student => {
            const participated = reportData.records.filter((r: any) =>
                (r.presentStudentIds?.includes(student._id)) || (r.absentStudentIds?.includes(student._id))
            );
            const baseAttended = participated.filter((r: any) => r.presentStudentIds?.includes(student._id)).length;
            const total = participated.length + (student.total_classes_adjustment || 0);
            const attended = baseAttended + (student.attended_adjustment || 0);
            const percent = total > 0 ? ((attended / total) * 100).toFixed(0) : 0;

            let row = `"${student.name}",${student.roll},${student.department},${student.year},${student.course_code},`;

            reportData.records.forEach((r: any) => {
                const isPresent = r.presentStudentIds?.includes(student._id);
                const isAbsent = r.absentStudentIds?.includes(student._id);
                row += `${isPresent ? 'P' : isAbsent ? 'A' : '-'},`;
            });

            row += `${attended},${total},${percent}%\n`;
            csvContent += row;
        });

        downloadCSV(csvContent, `Attendance_Report_${startDate}_to_${endDate}.csv`);
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const rows = text.split('\n').map(row => row.split(','));
            const headers = rows[0].map(h => h.trim().toLowerCase().replace(/"/g, ''));

            const emailIdx = headers.findIndex(h => h.includes('student email') || h === 'email');
            const rollIdx = headers.findIndex(h => h.includes('roll number') || h === 'roll');

            // Offline columns
            const offlineAttIdx = headers.findIndex(h => h.includes('adjusted attended') || h.includes('offline attended'));
            const offlineTotIdx = headers.findIndex(h => h.includes('adjusted total classes') || h.includes('offline total classes'));

            // Total columns
            const totalAttIdx = headers.findIndex(h => h.includes('total attended'));
            const totalTotIdx = headers.findIndex(h => h.includes('total classes') && !h.includes('system') && !h.includes('offline') && !h.includes('adjusted'));

            if ((emailIdx === -1 && rollIdx === -1)) {
                alert('Invalid CSV format. Must contain "Student Email" or "Roll Number" column.');
                return;
            }

            const preview: any[] = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < headers.length) continue;

                const email = emailIdx !== -1 ? row[emailIdx]?.replace(/"/g, '').trim() : null;
                const roll = rollIdx !== -1 ? row[rollIdx]?.trim() : null;

                const student = students.find(s =>
                    (email && s.email?.toLowerCase() === email.toLowerCase()) ||
                    (roll && s.roll === roll)
                );

                if (student) {
                    const stats = calculateStats(student, allAttendanceRecords);
                    let newAttAdj = student.attended_adjustment || 0;
                    let newTotAdj = student.total_classes_adjustment || 0;
                    let changed = false;
                    let reasonAtt = '';
                    let reasonTot = '';

                    // Logic for Attended
                    if (totalAttIdx !== -1) {
                        const val = parseInt(row[totalAttIdx]);
                        if (!isNaN(val)) {
                            // Offline = Total - System
                            const calculatedOffline = val - stats.baseAttended;
                            if (calculatedOffline !== newAttAdj) {
                                newAttAdj = calculatedOffline;
                                changed = true;
                                reasonAtt = `Calc from Total (${val})`;
                            }
                        }
                    } else if (offlineAttIdx !== -1) {
                        const val = parseInt(row[offlineAttIdx]);
                        if (!isNaN(val)) {
                            if (val !== newAttAdj) {
                                newAttAdj = val;
                                changed = true;
                                reasonAtt = `Direct Offline`;
                            }
                        }
                    }

                    // Logic for Total
                    if (totalTotIdx !== -1) {
                        const val = parseInt(row[totalTotIdx]);
                        if (!isNaN(val)) {
                            // Offline = Total - System
                            const calculatedOffline = val - stats.baseTotal;
                            if (calculatedOffline !== newTotAdj) {
                                newTotAdj = calculatedOffline;
                                changed = true;
                                reasonTot = `Calc from Total (${val})`;
                            }
                        }
                    } else if (offlineTotIdx !== -1) {
                        const val = parseInt(row[offlineTotIdx]);
                        if (!isNaN(val)) {
                            if (val !== newTotAdj) {
                                newTotAdj = val;
                                changed = true;
                                reasonTot = `Direct Offline`;
                            }
                        }
                    }

                    if (changed) {
                        preview.push({
                            student,
                            oldAttAdj: student.attended_adjustment || 0,
                            newAttAdj,
                            oldTotAdj: student.total_classes_adjustment || 0,
                            newTotAdj,
                            baseAttended: stats.baseAttended,
                            baseTotal: stats.baseTotal,
                            reasonAtt,
                            reasonTot
                        });
                    }
                }
            }

            if (preview.length === 0) {
                alert('No changes detected or no matching students found.');
                e.target.value = ''; // Reset input so same file can be selected again if needed
                return;
            }

            setImportPreviewData(preview);
            setIsImportModalOpen(true);
            e.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    };

    const confirmImport = async () => {
        setLoading(true);
        let updatedCount = 0;
        try {
            for (const item of importPreviewData) {
                await fetch(`/api/admin/students/${item.student._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attended_adjustment: item.newAttAdj,
                        total_classes_adjustment: item.newTotAdj
                    })
                });
                updatedCount++;
            }
            alert(`Successfully updated ${updatedCount} students.`);
            setIsImportModalOpen(false);
            setImportPreviewData([]);

            // Refresh
            const res = await fetch('/api/admin/students/all');
            if (res.ok) setStudents(await res.json());
        } catch (error) {
            console.error(error);
            alert('Error during import.');
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Helpers ---

    const calculateStats = (student: any, records: any[]) => {
        // Filter records relevant to this student (by course/dept/year match in record vs student)
        // Actually, records store student IDs.
        const participated = records.filter(r =>
            (r.presentStudentIds?.includes(student._id)) || (r.absentStudentIds?.includes(student._id))
        );

        const baseAttended = participated.filter(r => r.presentStudentIds?.includes(student._id)).length;
        const baseTotal = participated.length;

        const finalAttended = baseAttended + (student.attended_adjustment || 0);
        const finalTotal = baseTotal + (student.total_classes_adjustment || 0);

        const percent = finalTotal > 0 ? ((finalAttended / finalTotal) * 100).toFixed(1) : '0.0';

        return { baseAttended, baseTotal, finalAttended, finalTotal, percent };
    };

    const copyToClipboard = async (text: string) => {
        try { await navigator.clipboard.writeText(text); alert('Copied!'); } catch (e) { console.error(e); }
    };

    const copyGuardianText = (student: any, percent: string, startDate: string, endDate: string) => {
        const text = `Subject: Urgent: Attendance Concern - ${student.name} | Heritage Institute of Technology
Dear Guardian of ${student.name},

I am writing to express my serious concern regarding ${student.name}’s recent attendance record. The student has missed a significant number of classes, and the current attendance percentage is ${percent}% during ${startDate} to ${endDate}.
I am worried that this is starting to negatively impact academic progress.
It is urgent that we address this matter immediately to ensure ${student.name} does not fall further behind.
Please contact me at your earliest convenience to discuss the reasons for these absences and how we can support ${student.name} in returning to regular attendance.`;
        copyToClipboard(text);
    };

    const copyStudentText = (student: any, percent: string, startDate: string, endDate: string) => {
        const text = `Subject: WARNING: Low Attendance Alert & Required Disciplinary Action
Dear ${student.name},

This email serves as a formal warning regarding your critically low attendance. Your current attendance record stands at ${percent}% for the period between ${startDate} and ${endDate}.
This falls below the mandatory academic requirements. As a result, you are hereby directed to complete the following disciplinary procedure immediately:
1) Access the Portal: Log in to your Student Portal at: https://maths-hit-attendance-assignment-track.netlify.app/student/login
Navigate: Open the Attendance Portal.
Retrieve Data: Click on the "Download pdf" button to download your attendance register.
2) Prepare Documentation: Write a formal written application justifying your reasons for absence during the aforementioned period. You must attach the printed copy of the downloaded attendance register to this application.
3) Verification: Take this complete document set (Application + Printed Register) and obtain signatures from:
The HOD of Mathematics
The HOD of ${student.department}
4) Submission: Submit the fully signed documents to me (the undersigned) in person.

Failure to comply with these instructions or to submit the required documents will result in further strict disciplinary action.

Treat this matter with extreme urgency.`;
        copyToClipboard(text);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header / Global Admin Indicator Only */}
            <div className="flex justify-end">
                {isGlobalAdmin && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded bg-indigo-500/20 border border-indigo-500/30">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Global Admin Active</span>
                    </div>
                )}
            </div>

            {/* --- SECTION 1: Current Student Database --- */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col xl:flex-row gap-6 justify-between items-end">
                    <div className="flex flex-wrap gap-3 items-end w-full">
                        <div className="w-full sm:w-64">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Search Student</label>
                            <div className="relative group">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Name or Roll Number..."
                                    className="pl-10 bg-slate-950/50 border border-white/10 rounded-lg text-slate-200 text-sm py-2.5 w-full focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
                                    value={dbSearch}
                                    onChange={e => setDbSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
                            <select className="w-full bg-slate-950/50 border border-white/10 rounded-lg text-slate-300 text-sm py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={dbFilters.dept} onChange={e => setDbFilters({ ...dbFilters, dept: e.target.value })}>
                                <option value="" className="bg-slate-950 text-slate-300">All Depts</option>
                                {departments.map(d => <option key={d} value={d} className="bg-slate-950 text-slate-300">{d}</option>)}
                            </select>
                        </div>
                        <div className="w-32">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Year</label>
                            <select className="w-full bg-slate-950/50 border border-white/10 rounded-lg text-slate-300 text-sm py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={dbFilters.year} onChange={e => setDbFilters({ ...dbFilters, year: e.target.value })}>
                                <option value="" className="bg-slate-950 text-slate-300">All Years</option>
                                {years.map(y => <option key={y} value={y} className="bg-slate-950 text-slate-300">{y}</option>)}
                            </select>
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Course</label>
                            <select className="w-full bg-slate-950/50 border border-white/10 rounded-lg text-slate-300 text-sm py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={dbFilters.course} onChange={e => setDbFilters({ ...dbFilters, course: e.target.value })}>
                                <option value="" className="bg-slate-950 text-slate-300">All Courses</option>
                                {courses.map(c => <option key={c} value={c} className="bg-slate-950 text-slate-300">{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 shrink-0 w-full xl:w-auto">
                        <label className="cursor-pointer bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 text-sm px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all font-medium flex-1 xl:flex-none">
                            <Upload className="h-4 w-4" /> Import CSV
                            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                        </label>
                        <button onClick={exportDbToCSV} className="bg-emerald-500/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 text-sm px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all font-medium flex-1 xl:flex-none">
                            <Download className="h-4 w-4" /> Export CSV
                        </button>
                    </div>
                </div >

                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="min-w-full divide-y divide-white/5 text-sm">
                        <thead className="bg-slate-950/80 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-4 py-3.5 text-left font-semibold text-slate-200">Name</th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200">Roll</th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200">Dept</th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200">Year</th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200">Course</th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200">Attended<br /><span className="text-[10px] text-slate-500 font-normal uppercase tracking-wider">(System)</span></th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200 border-r border-white/5">Classes<br /><span className="text-[10px] text-slate-500 font-normal uppercase tracking-wider">(System)</span></th>

                                <th className="px-3 py-3.5 text-center font-semibold text-amber-200 w-24 bg-amber-500/5">Attended<br /><span className="text-[10px] text-amber-500/70 font-normal uppercase tracking-wider">(Adjusted)</span></th>
                                <th className="px-3 py-3.5 text-center font-semibold text-amber-200 w-24 border-r border-white/5 bg-amber-500/5">Classes<br /><span className="text-[10px] text-amber-500/70 font-normal uppercase tracking-wider">(Adjusted)</span></th>

                                <th className="px-3 py-3.5 text-center font-semibold text-emerald-200 bg-emerald-500/5">Attended<br /><span className="text-[10px] text-emerald-500/70 font-normal uppercase tracking-wider">(Total)</span></th>
                                <th className="px-3 py-3.5 text-center font-semibold text-emerald-200 bg-emerald-500/5">Classes<br /><span className="text-[10px] text-emerald-500/70 font-normal uppercase tracking-wider">(Total)</span></th>
                                <th className="px-3 py-3.5 text-center font-semibold text-slate-200">%</th>
                                <th className="px-4 py-3.5 text-center font-semibold text-slate-200">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-transparent">
                            {loading ? (
                                <tr><td colSpan={13} className="text-center py-12 text-slate-500 animate-pulse">Loading student data...</td></tr>
                            ) : filteredDbStudents.length === 0 ? (
                                <tr><td colSpan={13} className="text-center py-12 text-slate-500 italic">No students found matching your criteria.</td></tr>
                            ) : (
                                filteredDbStudents.map(student => {
                                    const stats = calculateStats(student, allAttendanceRecords);
                                    const adj = adjustments[student._id] || {};
                                    const currentAttAdj = adj.attended !== undefined ? adj.attended : (student.attended_adjustment || 0);
                                    const currentTotAdj = adj.total !== undefined ? adj.total : (student.total_classes_adjustment || 0);

                                    const hasChanged =
                                        currentAttAdj !== (student.attended_adjustment || 0) ||
                                        currentTotAdj !== (student.total_classes_adjustment || 0);

                                    return (
                                        <tr key={student._id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-4 py-3 text-white font-medium">{student.name}</td>
                                            <td className="px-3 py-3 text-center text-slate-400 font-mono text-xs">{student.roll}</td>
                                            <td className="px-3 py-3 text-center text-slate-400">{student.department}</td>
                                            <td className="px-3 py-3 text-center text-slate-400">{student.year}</td>
                                            <td className="px-3 py-3 text-center text-slate-400">{student.course_code}</td>
                                            <td className="px-3 py-3 text-center text-slate-500">{stats.baseAttended}</td>
                                            <td className="px-3 py-3 text-center text-slate-500 border-r border-white/5">{stats.baseTotal}</td>

                                            <td className="px-3 py-3 text-center bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-slate-900 border border-white/10 rounded px-1 py-1 text-center text-amber-400 focus:border-amber-500 outline-none transition-all font-mono text-sm"
                                                    value={currentAttAdj}
                                                    onChange={(e) => handleAdjustmentChange(student._id, 'attended', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-3 py-3 text-center border-r border-white/5 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-slate-900 border border-white/10 rounded px-1 py-1 text-center text-amber-400 focus:border-amber-500 outline-none transition-all font-mono text-sm"
                                                    value={currentTotAdj}
                                                    onChange={(e) => handleAdjustmentChange(student._id, 'total', e.target.value)}
                                                />
                                            </td>

                                            <td className="px-3 py-3 text-center text-emerald-300 font-bold bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">{stats.finalAttended}</td>
                                            <td className="px-3 py-3 text-center text-emerald-300 font-bold bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors">{stats.finalTotal}</td>
                                            <td className={`px-3 py-3 text-center font-bold ${Number(stats.percent) >= config.attendanceRequirement ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {stats.percent}%
                                            </td>
                                            <td className="px-4 py-3 text-center flex justify-center gap-3">
                                                {hasChanged && (
                                                    <button onClick={() => handleSaveAdjustment(student)} className="text-emerald-400 hover:text-emerald-300 transition-transform hover:scale-110" title="Save Adjustment">
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEditClick(student)} className="text-indigo-400 hover:text-indigo-300 transition-transform hover:scale-110" title="Edit Details">
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* --- SECTION 2: Attendance Report --- */}
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-6 shadow-xl relative overflow-visible z-20">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
                        <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-white">Generate Attendance Report</h2>
                        <p className="text-sm text-slate-400">Create comprehensive attendance sheets</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5 items-end bg-slate-950/30 p-5 rounded-xl border border-white/5">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Start Date</label>
                        <input type="date" className="bg-slate-900 border border-white/10 rounded-lg text-slate-300 w-full py-2 px-3 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">End Date</label>
                        <input type="date" className="bg-slate-900 border border-white/10 rounded-lg text-slate-300 w-full py-2 px-3 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    {/* Reuse filters logic but separate state */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                        <select className="bg-slate-900 border border-white/10 rounded-lg text-slate-300 w-full py-2 px-3 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={reportFilters.dept} onChange={e => setReportFilters({ ...reportFilters, dept: e.target.value })}>
                            <option value="">All Depts</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Year</label>
                        <select className="bg-slate-900 border border-white/10 rounded-lg text-slate-300 w-full py-2 px-3 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={reportFilters.year} onChange={e => setReportFilters({ ...reportFilters, year: e.target.value })}>
                            <option value="">All Years</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Course</label>
                        <select className="bg-slate-900 border border-white/10 rounded-lg text-slate-300 w-full py-2 px-3 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={reportFilters.course} onChange={e => setReportFilters({ ...reportFilters, course: e.target.value })}>
                            <option value="">All Courses</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Faculty Multi-Select */}
                    <div className="relative group z-50">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Faculty Filter</label>
                        <button className="bg-slate-900 border border-white/10 rounded-lg text-slate-300 px-3 py-2 w-full text-left text-sm flex justify-between items-center focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all hover:bg-slate-800">
                            <span className="truncate">
                                {selectedFaculties.length === 0 ? 'All Faculties' : `${selectedFaculties.length} Selected`}
                            </span>
                        </button>
                        <div className="absolute hidden group-hover:block bg-slate-900 border border-white/10 rounded-lg shadow-2xl z-50 w-64 p-2 max-h-60 overflow-y-auto bottom-full mb-1 custom-scrollbar">
                            {availableFaculties.length === 0 ? (
                                <div className="text-slate-500 text-xs p-2 italic">Select Course First</div>
                            ) : (
                                availableFaculties.map((f: any) => (
                                    <label key={f.email} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedFaculties.includes(f.email)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedFaculties([...selectedFaculties, f.email]);
                                                else setSelectedFaculties(selectedFaculties.filter(email => email !== f.email));
                                            }}
                                            className="rounded bg-slate-700 border-slate-600 text-indigo-500 focus:ring-indigo-500"
                                        />
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm text-slate-200 truncate" title={f.name}>{f.name}</span>
                                            <span className="text-[10px] text-slate-500 truncate">{f.email}</span>
                                        </div>
                                    </label>
                                ))
                            )}
                            {availableFaculties.length > 0 && (
                                <div className="border-t border-white/5 mt-2 pt-2 flex justify-between sticky bottom-0 bg-slate-900 p-1">
                                    <button
                                        onClick={() => setSelectedFaculties(availableFaculties.map((f: any) => f.email))}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSelectedFaculties([])}
                                        className="text-xs text-slate-400 hover:text-slate-300"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex justify-end">
                    <button onClick={handleGenerateReport} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2 disabled:opacity-50 hover:-translate-y-0.5 transition-all w-full md:w-auto">
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
                        Generate Report
                    </button>
                </div>

                {
                    reportData && (
                        <div ref={reportRef} className="mt-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-white">Report Results</h3>
                                <div className="text-right flex items-center gap-4">
                                    <div className="hidden sm:block">
                                        <span className="text-slate-500 text-xs uppercase tracking-wider block">Generated On</span>
                                        <div className="font-mono text-sm text-slate-300">{new Date().toLocaleString()}</div>
                                    </div>
                                    <button onClick={exportReportToCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all hover:-translate-y-0.5">
                                        <Download className="h-4 w-4" /> Export CSV
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900 shadow-2xl">
                                {reportData.records.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500 italic flex flex-col items-center gap-2">
                                        <Calendar className="h-10 w-10 opacity-20" />
                                        No attendance records found for this period.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                                        <table className="min-w-full divide-y divide-white/5 text-xs">
                                            <thead className="bg-slate-950 sticky top-0 z-20 shadow-md">
                                                <tr>
                                                    <th className="px-4 py-4 text-left font-bold text-white min-w-[180px] bg-slate-950 sticky left-0 z-30 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.5)]">
                                                        Student Details
                                                    </th>
                                                    {reportData.records.map((r: any) => (
                                                        <th key={r._id} className="px-2 py-2 text-center font-semibold text-slate-300 min-w-[100px] border-l border-white/5 group relative hover:bg-white/5 transition-colors">
                                                            <div className="whitespace-nowrap font-mono text-indigo-300 mb-0.5">{r.date.split('-').reverse().slice(0, 2).join('/')}</div>
                                                            <div className="text-slate-500 text-[10px] uppercase tracking-wider">{r.timeSlot}</div>
                                                            <div className="text-slate-400 text-[10px] mt-1 px-1 truncate max-w-[90px] mx-auto opacity-70 group-hover:opacity-100" title={r.teacherName}>{r.teacherName.split(' ')[0]}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-3 text-center font-bold text-white min-w-[80px] border-l border-white/10 bg-slate-900/50">Stats</th>
                                                    <th className="px-3 py-3 text-center font-bold text-white min-w-[100px] border-l border-white/5">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 bg-transparent">
                                                {reportData.students.map(student => {
                                                    const participated = reportData.records.filter((r: any) =>
                                                        (r.presentStudentIds?.includes(student._id)) || (r.absentStudentIds?.includes(student._id))
                                                    );
                                                    const baseAttended = participated.filter((r: any) => r.presentStudentIds?.includes(student._id)).length;
                                                    const total = participated.length + (student.total_classes_adjustment || 0);
                                                    const attended = baseAttended + (student.attended_adjustment || 0);
                                                    const percent = total > 0 ? ((attended / total) * 100).toFixed(0) : "0";

                                                    const isLowAttendance = Number(percent) < config.attendanceRequirement;

                                                    return (
                                                        <tr key={student._id} className="hover:bg-white/5 group transition-colors">
                                                            <td className="px-4 py-3 bg-slate-900/50 sticky left-0 z-10 border-r border-white/5 group-hover:bg-slate-800/80 transition-colors">
                                                                <div className="font-medium text-white text-sm">{student.name}</div>
                                                                <div className="flex gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                                                    <span>{student.roll}</span>
                                                                    <span>•</span>
                                                                    <span>{student.department}</span>
                                                                </div>
                                                            </td>
                                                            {reportData.records.map((r: any) => {
                                                                const isPresent = r.presentStudentIds?.includes(student._id);
                                                                const isAbsent = r.absentStudentIds?.includes(student._id);

                                                                let cellContent = <span className="text-slate-700">-</span>;
                                                                let cellClass = "bg-transparent";

                                                                if (isPresent) {
                                                                    cellContent = <span className="text-emerald-400 font-bold">P</span>;
                                                                    cellClass = "bg-emerald-500/5";
                                                                } else if (isAbsent) {
                                                                    cellContent = <span className="text-red-400 font-bold">A</span>;
                                                                    cellClass = "bg-red-500/5";
                                                                }

                                                                return (
                                                                    <td key={r._id} className={`px-2 py-3 text-center border-l border-white/5 ${cellClass}`}>
                                                                        {cellContent}
                                                                    </td>
                                                                );
                                                            })}

                                                            <td className="px-3 py-3 text-center border-l border-white/10 bg-slate-900/30">
                                                                <div className="flex flex-col items-center">
                                                                    <span className={`text-sm font-bold ${isLowAttendance ? 'text-red-400' : 'text-emerald-400'}`}>
                                                                        {percent}%
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {attended}/{total}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            <td className="px-3 py-3 text-center border-l border-white/5">
                                                                <div className="flex justify-center gap-2">
                                                                    {/* Email Student */}
                                                                    <button
                                                                        onClick={() => {
                                                                            if (student.email?.endsWith('@heritageit.edu.in')) {
                                                                                copyToClipboard(student.email);
                                                                            }
                                                                        }}
                                                                        disabled={!student.email?.endsWith('@heritageit.edu.in')}
                                                                        className={`p - 1.5 rounded - md transition - all ${student.email?.endsWith('@heritageit.edu.in')
                                                                            ? 'text-indigo-400 bg-indigo-500/10 shadow-[0_0_8px_rgba(99,102,241,0.4)] hover:bg-indigo-500/20 hover:text-indigo-300 hover:shadow-[0_0_12px_rgba(99,102,241,0.6)] cursor-copy'
                                                                            : 'text-slate-600 bg-white/5 opacity-40 cursor-not-allowed'
                                                                            } `}
                                                                        title={student.email?.endsWith('@heritageit.edu.in') ? `Copy Email: ${student.email} ` : 'Invalid Institutional Email'}
                                                                    >
                                                                        <Mail className="h-4 w-4" />
                                                                    </button>

                                                                    {/* Text Student */}
                                                                    <button
                                                                        onClick={() => copyStudentText(student, percent, startDate, endDate)}
                                                                        className="text-slate-500 hover:text-pink-400 transition-colors bg-white/5 p-1.5 rounded-md hover:bg-white/10"
                                                                        title="Copy Warning for Student"
                                                                    >
                                                                        <MessageSquare className="h-4 w-4" />
                                                                    </button>

                                                                    {/* Email Guardian */}
                                                                    <button
                                                                        onClick={() => {
                                                                            if (student.guardian_email) {
                                                                                copyToClipboard(student.guardian_email);
                                                                            }
                                                                        }}
                                                                        disabled={!student.guardian_email}
                                                                        className={`p - 1.5 rounded - md transition - all ${student.guardian_email
                                                                            ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.4)] hover:bg-emerald-500/20 hover:text-emerald-300 hover:shadow-[0_0_12px_rgba(16,185,129,0.6)] cursor-copy'
                                                                            : 'text-slate-600 bg-white/5 opacity-40 cursor-not-allowed'
                                                                            } `}
                                                                        title={student.guardian_email ? `Copy Guardian Email: ${student.guardian_email} ` : 'No Guardian Email Required'}
                                                                    >
                                                                        <Shield className="h-4 w-4" />
                                                                    </button>

                                                                    {/* Text Guardian */}
                                                                    <button
                                                                        onClick={() => copyGuardianText(student, percent, startDate, endDate)}
                                                                        className="text-slate-500 hover:text-amber-400 transition-colors bg-white/5 p-1.5 rounded-md hover:bg-white/10"
                                                                        title="Copy Text for Guardian"
                                                                    >
                                                                        <MessageCircle className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div>


            {/* --- Edit Modal --- */}
            {
                isEditModalOpen && editingStudent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-2xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
                            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                            <h3 className="text-2xl font-bold text-white mb-6">Edit Student Details</h3>
                            <form onSubmit={handleSaveStudent} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Name</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.name} onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })} /></div>
                                <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Roll</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.roll} onChange={e => setEditingStudent({ ...editingStudent, roll: e.target.value })} /></div>
                                <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Department</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.department} onChange={e => setEditingStudent({ ...editingStudent, department: e.target.value })} /></div>
                                <div><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Year</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.year} onChange={e => setEditingStudent({ ...editingStudent, year: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Course Code</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.course_code} onChange={e => setEditingStudent({ ...editingStudent, course_code: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Student Email</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.email} onChange={e => setEditingStudent({ ...editingStudent, email: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Guardian Email</label><input className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={editingStudent.guardian_email || ''} onChange={e => setEditingStudent({ ...editingStudent, guardian_email: e.target.value })} /></div>

                                <div className="md:col-span-2 flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-medium border border-white/5">Cancel</button>
                                    <button type="submit" className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }


            {/* --- Import Preview Modal --- */}
            {
                isImportModalOpen && importPreviewData.length > 0 && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-4xl p-8 shadow-2xl relative max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
                                <X className="h-6 w-6" />
                            </button>
                            <h3 className="text-2xl font-bold text-white mb-2">Confirm Offline Attendance Import</h3>
                            <p className="text-slate-400 mb-6 text-sm">
                                The following changes will be applied to <b className="text-slate-200">Adjusted Attendance</b>.
                                <br />
                                <span className="text-amber-400 font-semibold">Note:</span> If you imported "Total", Adjusted is calculated as <code className="bg-slate-950 px-1 py-0.5 rounded border border-white/10">Total - System</code>.
                            </p>

                            <div className="overflow-auto flex-1 border border-white/10 rounded-xl custom-scrollbar bg-slate-950/30">
                                <table className="min-w-full divide-y divide-white/5 text-sm">
                                    <thead className="bg-slate-950 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-slate-200">Student</th>
                                            <th className="px-3 py-3 text-center font-bold text-slate-200">Roll</th>
                                            <th className="px-3 py-3 text-center font-bold text-slate-200">Total Attended</th>
                                            <th className="px-3 py-3 text-center font-bold text-slate-200">Total Classes</th>
                                            <th className="px-3 py-3 text-center font-bold text-slate-200">Adjusted Change</th>
                                            <th className="px-3 py-3 text-center font-bold text-slate-200">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 bg-transparent">
                                        {importPreviewData.map((item, idx) => {
                                            const oldFinalAtt = item.baseAttended + item.oldAttAdj;
                                            const newFinalAtt = item.baseAttended + item.newAttAdj;
                                            const oldFinalTot = item.baseTotal + item.oldTotAdj;
                                            const newFinalTot = item.baseTotal + item.newTotAdj;

                                            const attChanged = item.oldAttAdj !== item.newAttAdj;
                                            const totChanged = item.oldTotAdj !== item.newTotAdj;

                                            return (
                                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 text-slate-300 font-medium">{item.student.name}</td>
                                                    <td className="px-3 py-3 text-center text-slate-400 font-mono text-xs">{item.student.roll}</td>

                                                    <td className="px-3 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="text-slate-500">{oldFinalAtt}</span>
                                                            {attChanged && <ArrowRight className="h-3 w-3 text-slate-600" />}
                                                            {attChanged && <span className={newFinalAtt > oldFinalAtt ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{newFinalAtt}</span>}
                                                        </div>
                                                    </td>

                                                    <td className="px-3 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="text-slate-500">{oldFinalTot}</span>
                                                            {totChanged && <ArrowRight className="h-3 w-3 text-slate-600" />}
                                                            {totChanged && <span className={newFinalTot > oldFinalTot ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{newFinalTot}</span>}
                                                        </div>
                                                    </td>

                                                    <td className="px-3 py-3 text-center text-xs">
                                                        {attChanged && (
                                                            <div className="text-indigo-300 font-mono">
                                                                Att: {item.oldAttAdj} &rarr; {item.newAttAdj}
                                                            </div>
                                                        )}
                                                        {totChanged && (
                                                            <div className="text-indigo-300 font-mono mt-0.5">
                                                                Tot: {item.oldTotAdj} &rarr; {item.newTotAdj}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-center text-slate-500 text-[10px]">
                                                        {item.reasonAtt && <div>Att: {item.reasonAtt}</div>}
                                                        {item.reasonTot && <div>Tot: {item.reasonTot}</div>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-4 mt-6 pt-6 border-t border-white/5">
                                <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-medium border border-white/5">Cancel</button>
                                <button onClick={confirmImport} className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                    {loading && <Loader2 className="animate-spin h-4 w-4" />}
                                    Confirm Import
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

