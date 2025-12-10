'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, FileSpreadsheet, Copy, Mail, Search, Upload, Download, Edit, Save, X, Trash2, ArrowRight } from 'lucide-react';

export default function AdminReports() {
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [allAttendanceRecords, setAllAttendanceRecords] = useState<any[]>([]);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, teacherAssignments: {} });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [adminName, setAdminName] = useState<string | null>(null);

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
    }, []);

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

    // Access Control (Faculty Visibility)
    const visibleStudents = useMemo(() => {
        if (!adminEmail) return students;
        const assignedKeys = Object.entries(config.teacherAssignments || {}).filter(([key, teachers]: [string, any]) => {
            return Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === adminEmail.toLowerCase());
        }).map(([key]) => key);

        if (assignedKeys.length === 0) return students;

        return students.filter(s => {
            const key = `${s.department}_${s.year}_${s.course_code}`;
            return assignedKeys.includes(key);
        });
    }, [students, config, adminEmail]);

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
            <div className="flex justify-between items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-white">Track Attendance</h1>
                {adminName && <div className="text-sm text-gray-400">Logged in as: <span className="text-blue-400 font-semibold">{adminName}</span></div>}
            </div>

            {/* --- SECTION 1: Current Student Database --- */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-end">
                    <div className="flex flex-wrap gap-2 items-end w-full">
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-gray-400 mb-1">Search</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Name or Roll..."
                                    className="pl-8 bg-gray-700 border-none rounded-md text-white text-sm py-2 w-full md:w-48 focus:ring-2 focus:ring-blue-500"
                                    value={dbSearch}
                                    onChange={e => setDbSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <select className="bg-gray-700 border-none rounded-md text-white text-sm py-2" value={dbFilters.dept} onChange={e => setDbFilters({ ...dbFilters, dept: e.target.value })}>
                            <option value="">All Depts</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select className="bg-gray-700 border-none rounded-md text-white text-sm py-2" value={dbFilters.year} onChange={e => setDbFilters({ ...dbFilters, year: e.target.value })}>
                            <option value="">All Years</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select className="bg-gray-700 border-none rounded-md text-white text-sm py-2" value={dbFilters.course} onChange={e => setDbFilters({ ...dbFilters, course: e.target.value })}>
                            <option value="">All Courses</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <label className="cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2">
                            <Upload className="h-4 w-4" /> Import CSV
                            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                        </label>
                        <button onClick={exportDbToCSV} className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-3 py-2 rounded-md flex items-center gap-2">
                            <Download className="h-4 w-4" /> Export CSV
                        </button>
                    </div>
                </div >

                <div className="overflow-x-auto max-h-[500px]">
                    <table className="min-w-full divide-y divide-gray-700 text-sm">
                        <thead className="bg-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 text-left font-semibold text-white">Name</th>
                                <th className="px-2 py-3 text-center font-semibold text-white">Roll</th>
                                <th className="px-2 py-3 text-center font-semibold text-white">Dept</th>
                                <th className="px-2 py-3 text-center font-semibold text-white">Year</th>
                                <th className="px-2 py-3 text-center font-semibold text-white">Course</th>
                                <th className="px-2 py-3 text-center font-semibold text-white">Attended<br /><span className="text-[10px] text-gray-400">(System)</span></th>
                                <th className="px-2 py-3 text-center font-semibold text-white border-r border-gray-600">Classes<br /><span className="text-[10px] text-gray-400">(System)</span></th>

                                <th className="px-2 py-3 text-center font-semibold text-white w-20">Attended<br /><span className="text-[10px] text-yellow-400">(Adjusted)</span></th>
                                <th className="px-2 py-3 text-center font-semibold text-white w-20 border-r border-gray-600">Classes<br /><span className="text-[10px] text-yellow-400">(Adjusted)</span></th>

                                <th className="px-2 py-3 text-center font-semibold text-white">Attended<br /><span className="text-[10px] text-green-400">(Total)</span></th>
                                <th className="px-2 py-3 text-center font-semibold text-white">Classes<br /><span className="text-[10px] text-green-400">(Total)</span></th>
                                <th className="px-2 py-3 text-center font-semibold text-white">%</th>
                                <th className="px-3 py-3 text-center font-semibold text-white">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700 bg-gray-800">
                            {loading ? (
                                <tr><td colSpan={10} className="text-center py-8 text-gray-400">Loading data...</td></tr>
                            ) : filteredDbStudents.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-8 text-gray-400">No students found.</td></tr>
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
                                        <tr key={student._id} className="hover:bg-gray-700/50">
                                            <td className="px-3 py-2 text-white">{student.name}</td>
                                            <td className="px-2 py-2 text-center text-gray-300">{student.roll}</td>
                                            <td className="px-2 py-2 text-center text-gray-300">{student.department}</td>
                                            <td className="px-2 py-2 text-center text-gray-300">{student.year}</td>
                                            <td className="px-2 py-2 text-center text-gray-300">{student.course_code}</td>
                                            <td className="px-2 py-2 text-center text-gray-300">{stats.baseAttended}</td>
                                            <td className="px-2 py-2 text-center text-gray-300 border-r border-gray-600">{stats.baseTotal}</td>

                                            <td className="px-2 py-2 text-center">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-gray-900 border border-gray-600 rounded px-1 text-center text-yellow-400 focus:border-yellow-500"
                                                    value={currentAttAdj}
                                                    onChange={(e) => handleAdjustmentChange(student._id, 'attended', e.target.value)}
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center border-r border-gray-600">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-gray-900 border border-gray-600 rounded px-1 text-center text-yellow-400 focus:border-yellow-500"
                                                    value={currentTotAdj}
                                                    onChange={(e) => handleAdjustmentChange(student._id, 'total', e.target.value)}
                                                />
                                            </td>

                                            <td className="px-2 py-2 text-center text-white font-bold">{stats.finalAttended}</td>
                                            <td className="px-2 py-2 text-center text-white font-bold">{stats.finalTotal}</td>
                                            <td className={`px-2 py-2 text-center font-bold ${Number(stats.percent) >= config.attendanceRequirement ? 'text-green-400' : 'text-red-400'}`}>
                                                {stats.percent}%
                                            </td>
                                            <td className="px-3 py-2 text-center flex justify-center gap-2">
                                                {hasChanged && (
                                                    <button onClick={() => handleSaveAdjustment(student)} className="text-green-400 hover:text-green-300" title="Save Adjustment">
                                                        <Save className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEditClick(student)} className="text-blue-400 hover:text-blue-300" title="Edit Details">
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
            < div className="bg-gray-800 p-6 rounded-lg border border-gray-700" >
                <h2 className="text-xl font-bold text-white mb-4">Generate Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                        <input type="date" className="bg-gray-700 border-none rounded-md text-white w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">End Date</label>
                        <input type="date" className="bg-gray-700 border-none rounded-md text-white w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    {/* Reuse filters logic but separate state */}
                    <select className="bg-gray-700 border-none rounded-md text-white" value={reportFilters.dept} onChange={e => setReportFilters({ ...reportFilters, dept: e.target.value })}>
                        <option value="">All Depts</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select className="bg-gray-700 border-none rounded-md text-white" value={reportFilters.year} onChange={e => setReportFilters({ ...reportFilters, year: e.target.value })}>
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select className="bg-gray-700 border-none rounded-md text-white" value={reportFilters.course} onChange={e => setReportFilters({ ...reportFilters, course: e.target.value })}>
                        <option value="">All Courses</option>
                        {courses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    {/* Faculty Multi-Select */}
                    <div className="relative group">
                        <button className="bg-gray-700 border-none rounded-md text-white px-3 py-2 w-full text-left text-xs flex justify-between items-center">
                            <span className="truncate">
                                {selectedFaculties.length === 0 ? 'All Faculties' : `${selectedFaculties.length} Selected`}
                            </span>
                        </button>
                        <div className="absolute hidden group-hover:block bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 w-48 p-2 max-h-48 overflow-y-auto">
                            {availableFaculties.length === 0 ? (
                                <div className="text-gray-500 text-xs p-2">Select Course First</div>
                            ) : (
                                availableFaculties.map((f: any) => (
                                    <label key={f.email} className="flex items-center gap-2 p-1 hover:bg-gray-700 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedFaculties.includes(f.email)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedFaculties([...selectedFaculties, f.email]);
                                                else setSelectedFaculties(selectedFaculties.filter(email => email !== f.email));
                                            }}
                                            className="rounded bg-gray-600 border-gray-500 text-blue-500"
                                        />
                                        <span className="text-xs text-white truncate" title={f.name}>{f.name}</span>
                                    </label>
                                ))
                            )}
                            {availableFaculties.length > 0 && (
                                <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between">
                                    <button
                                        onClick={() => setSelectedFaculties(availableFaculties.map((f: any) => f.email))}
                                        className="text-[10px] text-blue-400 hover:text-blue-300"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSelectedFaculties([])}
                                        className="text-[10px] text-gray-400 hover:text-gray-300"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <button onClick={handleGenerateReport} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-md flex justify-center items-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />} Generate
                    </button>
                </div>

                {
                    reportData && (
                        <div className="mt-6 overflow-x-auto max-h-[500px] border border-gray-700 rounded-lg">
                            <div className="p-4 bg-gray-700 border-b border-gray-600 flex justify-end items-center text-white">
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <span className="text-gray-400 text-xs uppercase tracking-wider">Generated On</span>
                                        <div className="font-bold">{new Date().toLocaleString()}</div>
                                    </div>
                                    <button onClick={exportReportToCSV} className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded-md flex items-center gap-2">
                                        <Download className="h-3 w-3" /> Export Report
                                    </button>
                                </div>
                            </div>
                            {reportData.records.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">
                                    No attendance records found for this period.
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-700 text-xs">
                                    <thead className="bg-gray-700 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-3 text-left font-semibold text-white min-w-[150px]">Student</th>
                                            {reportData.records.map((r: any) => (
                                                <th key={r._id} className="px-2 py-2 text-center font-semibold text-white min-w-[80px]">
                                                    <div className="whitespace-nowrap">{r.date.split('-').reverse().slice(0, 2).join('/')}</div>
                                                    <div className="text-gray-400 text-[10px]">{r.timeSlot}</div>
                                                    <div className="text-blue-400 text-[10px] mx-auto" title={r.teacherName}>{r.teacherName}</div>
                                                </th>
                                            ))}
                                            <th className="px-2 py-3 text-center font-semibold text-white">Stats</th>
                                            <th className="px-2 py-3 text-center font-semibold text-white text-[10px] w-24">Email Actions</th>
                                            <th className="px-2 py-3 text-center font-semibold text-white text-[10px] w-24">Text Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700 bg-gray-800">
                                        {reportData.students.map(student => {
                                            const participated = reportData.records.filter((r: any) =>
                                                (r.presentStudentIds?.includes(student._id)) || (r.absentStudentIds?.includes(student._id))
                                            );
                                            const baseAttended = participated.filter((r: any) => r.presentStudentIds?.includes(student._id)).length;
                                            const total = participated.length + (student.total_classes_adjustment || 0);
                                            const attended = baseAttended + (student.attended_adjustment || 0);
                                            const percent = total > 0 ? ((attended / total) * 100).toFixed(0) : 0;

                                            return (
                                                <tr key={student._id} className="hover:bg-gray-700/50">
                                                    <td className="px-3 py-2 font-medium text-white">
                                                        {student.name} <span className="text-gray-400">({student.roll})</span>
                                                    </td>
                                                    {reportData.records.map((r: any) => {
                                                        const isPresent = r.presentStudentIds?.includes(student._id);
                                                        const isAbsent = r.absentStudentIds?.includes(student._id);
                                                        return <td key={r._id} className={`px-2 py-2 text-center font-bold ${isPresent ? 'text-green-400' : isAbsent ? 'text-red-400' : 'text-gray-600'}`}>{isPresent ? 'P' : isAbsent ? 'A' : '-'}</td>;
                                                    })}
                                                    <td className="px-2 py-2 text-center text-white font-bold">{percent}%</td>
                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <button
                                                                onClick={() => copyToClipboard(student.guardian_email)}
                                                                disabled={!student.guardian_email}
                                                                className="w-full text-[10px] bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-2 py-1 rounded"
                                                                title={student.guardian_email || "No Guardian Email"}
                                                            >
                                                                Guardian Mail
                                                            </button>
                                                            <button
                                                                onClick={() => copyToClipboard(student.email)}
                                                                disabled={!student.email || !student.email.endsWith('@heritageit.edu.in')}
                                                                className="w-full text-[10px] bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-2 py-1 rounded"
                                                                title={student.email && !student.email.endsWith('@heritageit.edu.in') ? "Invalid Domain" : "Student Mail"}
                                                            >
                                                                Student Mail
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            <button
                                                                onClick={() => copyGuardianText(student, percent, startDate, endDate)}
                                                                className="w-full text-[10px] bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded"
                                                                title="Copy Warning to Guardian"
                                                            >
                                                                Guardian Text
                                                            </button>
                                                            <button
                                                                onClick={() => copyStudentText(student, percent, startDate, endDate)}
                                                                className="w-full text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                                                                title="Copy Warning to Student"
                                                            >
                                                                Student Text
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )
                }
            </div >

            {/* --- Edit Modal --- */}
            {
                isEditModalOpen && editingStudent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-2xl p-6 shadow-2xl relative">
                            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <X className="h-6 w-6" />
                            </button>
                            <h3 className="text-xl font-bold text-white mb-4">Edit Student Details</h3>
                            <form onSubmit={handleSaveStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-xs text-gray-400 mb-1">Name</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.name} onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-400 mb-1">Roll</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.roll} onChange={e => setEditingStudent({ ...editingStudent, roll: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-400 mb-1">Department</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.department} onChange={e => setEditingStudent({ ...editingStudent, department: e.target.value })} /></div>
                                <div><label className="block text-xs text-gray-400 mb-1">Year</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.year} onChange={e => setEditingStudent({ ...editingStudent, year: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className="block text-xs text-gray-400 mb-1">Course Code</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.course_code} onChange={e => setEditingStudent({ ...editingStudent, course_code: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className="block text-xs text-gray-400 mb-1">Student Email</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.email} onChange={e => setEditingStudent({ ...editingStudent, email: e.target.value })} /></div>
                                <div className="md:col-span-2"><label className="block text-xs text-gray-400 mb-1">Guardian Email</label><input className="w-full bg-gray-700 border-none rounded px-3 py-2 text-white" value={editingStudent.guardian_email || ''} onChange={e => setEditingStudent({ ...editingStudent, guardian_email: e.target.value })} /></div>

                                <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white">Cancel</button>
                                    <button type="submit" className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-bold">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* --- Import Preview Modal --- */}
            {
                isImportModalOpen && importPreviewData.length > 0 && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-gray-800 rounded-lg border border-gray-700 w-full max-w-4xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
                            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <X className="h-6 w-6" />
                            </button>
                            <h3 className="text-xl font-bold text-white mb-4">Confirm Offline Attendance Import</h3>
                            <p className="text-gray-400 mb-4 text-sm">
                                The following changes will be applied to <b>Adjusted Attendance</b>.
                                <br />
                                <span className="text-yellow-400">Note:</span> If you imported "Total", Adjusted is calculated as <code>Total - System</code>.
                            </p>

                            <div className="overflow-auto flex-1 border border-gray-700 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-700 text-sm">
                                    <thead className="bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-white">Student</th>
                                            <th className="px-2 py-2 text-center text-white">Roll</th>
                                            <th className="px-2 py-2 text-center text-white">Total Attended</th>
                                            <th className="px-2 py-2 text-center text-white">Total Classes</th>
                                            <th className="px-2 py-2 text-center text-white">Adjusted Change</th>
                                            <th className="px-2 py-2 text-center text-white">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700 bg-gray-800">
                                        {importPreviewData.map((item, idx) => {
                                            const oldFinalAtt = item.baseAttended + item.oldAttAdj;
                                            const newFinalAtt = item.baseAttended + item.newAttAdj;
                                            const oldFinalTot = item.baseTotal + item.oldTotAdj;
                                            const newFinalTot = item.baseTotal + item.newTotAdj;

                                            const attChanged = item.oldAttAdj !== item.newAttAdj;
                                            const totChanged = item.oldTotAdj !== item.newTotAdj;

                                            return (
                                                <tr key={idx} className="hover:bg-gray-700/50">
                                                    <td className="px-3 py-2 text-white">{item.student.name}</td>
                                                    <td className="px-2 py-2 text-center text-gray-300">{item.student.roll}</td>

                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="text-gray-400">{oldFinalAtt}</span>
                                                            {attChanged && <ArrowRight className="h-3 w-3 text-gray-500" />}
                                                            {attChanged && <span className={newFinalAtt > oldFinalAtt ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{newFinalAtt}</span>}
                                                        </div>
                                                    </td>

                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <span className="text-gray-400">{oldFinalTot}</span>
                                                            {totChanged && <ArrowRight className="h-3 w-3 text-gray-500" />}
                                                            {totChanged && <span className={newFinalTot > oldFinalTot ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{newFinalTot}</span>}
                                                        </div>
                                                    </td>

                                                    <td className="px-2 py-2 text-center text-xs">
                                                        {attChanged && (
                                                            <div className="text-blue-300">
                                                                Att: {item.oldAttAdj} &rarr; {item.newAttAdj}
                                                            </div>
                                                        )}
                                                        {totChanged && (
                                                            <div className="text-blue-300">
                                                                Tot: {item.oldTotAdj} &rarr; {item.newTotAdj}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2 text-center text-gray-400 text-[10px]">
                                                        {item.reasonAtt && <div>Att: {item.reasonAtt}</div>}
                                                        {item.reasonTot && <div>Tot: {item.reasonTot}</div>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-700">
                                <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white">Cancel</button>
                                <button onClick={confirmImport} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
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
