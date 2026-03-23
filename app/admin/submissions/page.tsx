'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Download, Save, FileText, CheckCircle, XCircle, Eye, X, BookOpen, BarChart } from 'lucide-react';
import { toast } from 'react-hot-toast';
import InstructionsBox from '../assignments/components/InstructionsBox';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function AssignmentSubmissionsPage() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70, teacherAssignments: {} });
    const [user, setUser] = useState<any>(null);

    const [activeTab, setActiveTab] = useState<'submissions' | 'marks'>('submissions');

    // Filters
    const [filters, setFilters] = useState({
        dept: 'all',
        year: 'all',
        course: 'all',
        assignmentId: ''
    });

    const [reportData, setReportData] = useState<any[]>([]);
    const [marksData, setMarksData] = useState<any[]>([]);
    const [showReport, setShowReport] = useState(false);

    // View Questions Modal State
    const [viewQuestionsModal, setViewQuestionsModal] = useState(false);
    const [viewQuestionsData, setViewQuestionsData] = useState<any[]>([]);
    const [viewQuestionsLoading, setViewQuestionsLoading] = useState(false);
    const [viewQuestionsStudent, setViewQuestionsStudent] = useState('');

    useEffect(() => {
        const init = async () => {
            const storedUser = localStorage.getItem('user');
            const isGA = localStorage.getItem('globalAdminActive') === 'true';

            let headers: any = {};

            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                headers['X-User-Email'] = parsedUser.email;

                if (isGA) {
                    headers['X-Global-Admin-Key'] = 'globaladmin_25';
                }
            }
            fetchData(headers);
        };
        init();
    }, []);

    const fetchData = async (headers: any = {}) => {
        try {
            const [sRes, aRes, subRes, attRes, cRes] = await Promise.all([
                fetch('/api/admin/students/all', { headers }),
                fetch('/api/admin/assignments', { headers }),
                fetch('/api/admin/submissions', { headers }),
                fetch('/api/admin/attendance', { headers }),
                fetch('/api/admin/config', { headers })
            ]);

            if (sRes.ok && aRes.ok && subRes.ok && attRes.ok) {
                setStudents(await sRes.json());
                setAssignments(await aRes.json());
                setSubmissions(await subRes.json());
                setAttendanceRecords(await attRes.json());
                if (cRes.ok) setConfig(await cRes.json());
            }
        } catch (error) {
            console.error("Error fetching data", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    // Derived Lists for Dropdowns
    const { depts, years, courses } = useMemo(() => {
        const d = new Set<string>();
        const y = new Set<string>();
        const c = new Set<string>();

        const isGA = typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true';

        if (isGA) {
            students.forEach(s => {
                if (s.department) d.add(s.department);
                if (s.year) y.add(s.year);
                if (s.course_code) c.add(s.course_code);
            });
        } else if (user?.email && config.teacherAssignments) {
            Object.entries(config.teacherAssignments).forEach(([key, teachers]: [string, any]) => {
                if (Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === user.email.toLowerCase())) {
                    const parts = key.split('_');
                    if (parts.length >= 3) {
                        d.add(parts[0]);
                        y.add(parts[1]);
                        c.add(parts[2]);
                    }
                }
            });
        }

        return {
            depts: Array.from(d).sort(),
            years: Array.from(y).sort(),
            courses: Array.from(c).sort()
        };
    }, [students, config, user]);

    // ----------- MARKS CALCULATION -----------
    const calculateMarks = () => {
        let filteredStudents = students;
        const isGA = typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true';

        if (!isGA && user?.email && config.teacherAssignments) {
            const assignedKeys = Object.entries(config.teacherAssignments)
                .filter(([key, teachers]: [string, any]) =>
                    Array.isArray(teachers) && teachers.some((t: any) => t.email?.toLowerCase() === user.email.toLowerCase())
                )
                .map(([key]) => key);

            if (assignedKeys.length > 0) {
                filteredStudents = filteredStudents.filter(s => {
                    const key = `${s.department}_${s.year}_${s.course_code}`;
                    return assignedKeys.includes(key);
                });
            } else {
                filteredStudents = [];
            }
        }

        filteredStudents = filteredStudents.filter(s =>
            (filters.dept === 'all' || s.department === filters.dept) &&
            (filters.year === 'all' || s.year === filters.year) &&
            (filters.course === 'all' || s.course_code === filters.course)
        );

        const now = new Date();

        const data = filteredStudents.map(student => {
            const taggedAssignments = assignments.filter(asn => {
                const createdDate = asn.createdAt ? new Date(asn.createdAt) : new Date(0);
                if (createdDate > now) return false; 
                if (asn.targetDepartments && Array.isArray(asn.targetDepartments) && asn.targetDepartments.length > 0) {
                    if (!asn.targetDepartments.includes(student.department)) return false;
                }
                if (asn.targetYear && asn.targetYear !== 'all') {
                    if (asn.targetYear !== student.year) return false;
                }
                return true;
            });

            const totalTagged = taggedAssignments.length;
            const taggedIds = new Set(taggedAssignments.map(a => a._id.toString()));
            const involvedCourses = new Set(taggedAssignments.map(a => a.targetCourse).filter(Boolean));

            const studentSubmissions = submissions.filter(sub => {
                const studentId = sub.student?._id || sub.student;
                const assignmentId = sub.assignment?._id || sub.assignment;
                return (studentId && studentId.toString() === student._id.toString()) && 
                       (assignmentId && taggedIds.has(assignmentId.toString()));
            });

            let totalManualAdj = 0;
            const adjustments = student.submission_adjustments || {};
            involvedCourses.forEach(c => {
                totalManualAdj += (adjustments[c] || 0);
            });

            const submittedCount = studentSubmissions.length + totalManualAdj;

            let marks = 0;
            if (totalTagged > 0) {
                marks = (submittedCount / totalTagged) * 10;
                if (marks > 10) marks = 10;
            }

            return {
                studentId: student._id,
                name: student.name,
                roll: student.roll,
                dept: student.department,
                year: student.year,
                course: student.course_code,
                total: totalTagged,
                submitted: submittedCount,
                manualAdj: totalManualAdj,
                marks: marks.toFixed(2)
            };
        });

        data.sort((a, b) => a.roll.localeCompare(b.roll));
        setMarksData(data);
    };

    useEffect(() => {
        if (students.length > 0 && activeTab === 'marks') {
            calculateMarks();
        }
    }, [students, assignments, submissions, filters, config, user, activeTab]);

    const getMarkColor = (marks: string) => {
        const m = parseFloat(marks);
        if (m >= 8) return 'text-green-400';
        if (m >= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    // ----------- INDIVIDUAL SUBMISSIONS CALCULATION -----------
    const getRecordDateObject = (dateStr: string, timeSlotStr: string) => {
        try {
            if (!timeSlotStr) return new Date(dateStr + "T00:00:00");
            const parts = timeSlotStr.split('-');
            let startPart = parts[0];
            let hour = parseInt(startPart);
            if (hour < 7) hour += 12; 

            const d = new Date(dateStr);
            d.setHours(hour, 0, 0, 0);
            return d;
        } catch (e) {
            return new Date(dateStr);
        }
    };

    const calculateAttendance = (student: any, targetCourse: string, deadlineDate: Date) => {
        const now = new Date();
        let records = attendanceRecords.filter(r =>
            (r.course_code || "").trim().toUpperCase() === (targetCourse || "").trim().toUpperCase()
        );

        const cutoffDate = now >= deadlineDate ? deadlineDate : now;
        records = records.filter(r => {
            const recordDate = getRecordDateObject(r.date, r.timeSlot);
            return recordDate <= cutoffDate;
        });

        records = records.filter(r =>
            (r.presentStudentIds && r.presentStudentIds.includes(student._id)) ||
            (r.absentStudentIds && r.absentStudentIds.includes(student._id))
        );

        const total = records.length;
        const adj = parseInt(student.attended_adjustment || 0);
        const present = records.filter(r =>
            (r.presentStudentIds && r.presentStudentIds.includes(student._id))
        ).length;

        const finalPresent = present + adj;
        const pct = total > 0 ? (finalPresent / total) * 100 : 0;

        return {
            percentage: pct,
            isEligible: pct >= (config.attendanceRequirement || 70)
        };
    };

    const handleGenerateReport = () => {
        if (!filters.assignmentId) return toast.error("Please select an assignment");

        const assignment = assignments.find(a => a._id === filters.assignmentId);
        if (!assignment) return;

        const targetCourse = assignment.targetCourse || assignment.course_code;
        if (!targetCourse) return toast.error("Assignment has no target course configured");
        const deadlineDate = new Date(assignment.deadline);

        const filteredStudents = students.filter(s =>
            (filters.dept === 'all' || s.department === filters.dept) &&
            (filters.year === 'all' || s.year === filters.year) &&
            (filters.course === 'all' || s.course_code === filters.course) &&
            (!assignment.targetYear || assignment.targetYear === 'all' || s.year === assignment.targetYear)
        );

        const data = filteredStudents.map(student => {
            const sub = submissions.find(s =>
                (s.student._id === student._id || s.student === student._id) &&
                (s.assignment._id === assignment._id || s.assignment === assignment._id)
            );

            const attendance = calculateAttendance(student, targetCourse, deadlineDate);
            const adjustments = student.submission_adjustments || {};
            const manualAdj = adjustments[targetCourse] || 0;

            return {
                studentId: student._id,
                name: student.name,
                roll: student.roll,
                status: sub ? 'Submitted' : 'Not Submitted',
                generatedAt: assignment.createdAt ? new Date(assignment.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A',
                deadlineAt: deadlineDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                submittedAt: sub ? new Date(sub.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A',
                attendanceAtDeadline: attendance.percentage.toFixed(1),
                isEligible: attendance.isEligible,
                driveLink: sub?.driveLink || '',
                manualAdj: manualAdj,
                courseCode: targetCourse
            };
        });

        data.sort((a, b) => a.roll.localeCompare(b.roll));
        setReportData(data);
        setShowReport(true);
    };

    const handleAdjustmentChange = (studentId: string, newVal: string) => {
        const val = parseInt(newVal) || 0;
        setReportData(prev => prev.map(d =>
            d.studentId === studentId ? { ...d, manualAdj: val, _changed: true } : d
        ));
    };

    const saveAdjustment = async (studentId: string, courseCode: string, newVal: number) => {
        const toastId = toast.loading("Saving...");
        try {
            setReportData(prev => prev.map(d =>
                d.studentId === studentId ? { ...d, _changed: false } : d
            ));

            const student = students.find(s => s._id === studentId);
            if (!student) throw new Error("Student not found");

            const currentMap = student.submission_adjustments || {};
            const updatedMap = { ...currentMap, [courseCode]: newVal };

            const res = await fetch(`/api/admin/students/${studentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission_adjustments: updatedMap })
            });

            if (!res.ok) throw new Error("Failed to update");

            setStudents(prev => prev.map(s =>
                s._id === studentId ? { ...s, submission_adjustments: updatedMap } : s
            ));

            toast.success("Saved", { id: toastId });
            // Recalculate marks if needed
            if (activeTab === 'marks') calculateMarks();
        } catch (error) {
            toast.error("Failed to save", { id: toastId });
        }
    };

    const exportCSV = () => {
        if (activeTab === 'submissions') {
            if (reportData.length === 0) return;
            const headers = ["Name", "Roll", "Status", "Assignment Date", "Deadline", "Submitted At", "Manual Adj", "Attd %", "Eligible", "Link"];
            const rows = reportData.map(d => [
                d.name, d.roll, d.status, d.generatedAt, d.deadlineAt, d.submittedAt, d.manualAdj, d.attendanceAtDeadline, d.isEligible ? "Yes" : "No", d.driveLink
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Submission_Report_${new Date().toISOString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            if (marksData.length === 0) return;
            const headers = ["Name", "Roll", "Dept", "Year", "Course", "Total Assignments", "Submitted", "Manual Adj", "Marks (10)"];
            const rows = marksData.map(d => [
                d.name, d.roll, d.dept, d.year, d.course, d.total, d.submitted, d.manualAdj, d.marks
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Marks_Report_${new Date().toISOString()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleViewQuestions = async (studentId: string, studentName: string) => {
        if (!filters.assignmentId) return;
        setViewQuestionsLoading(true);
        setViewQuestionsStudent(studentName);
        setViewQuestionsModal(true);
        setViewQuestionsData([]);

        try {
            const res = await fetch(`/api/admin/submissions/student-questions?studentId=${studentId}&assignmentId=${filters.assignmentId}`);
            if (res.ok) {
                const data = await res.json();
                setViewQuestionsData(data.questions || []);
            } else {
                toast.error('Failed to load questions');
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
            toast.error('Error loading questions');
        } finally {
            setViewQuestionsLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Tab Navigation */}
            <div className="flex space-x-1 rounded-lg bg-gray-800 p-1 w-full max-w-md mx-auto sm:mx-0">
                <button
                    onClick={() => { setActiveTab('submissions'); setShowReport(false); }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                        activeTab === 'submissions'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    } flex items-center justify-center gap-2`}
                >
                    <FileText className="h-4 w-4" /> Reports
                </button>
                <button
                    onClick={() => { setActiveTab('marks'); setShowReport(false); }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                        activeTab === 'marks'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    } flex items-center justify-center gap-2`}
                >
                    <BarChart className="h-4 w-4" /> Marks Overview
                </button>
            </div>

            <InstructionsBox>
                {activeTab === 'submissions' ? (
                    <ul className="list-disc list-inside space-y-1">
                        <li>Select an <strong>Assignment</strong> to generate the individual submission report.</li>
                        <li>The report shows submission status and <strong>Attendance Eligibility</strong> at the time of the deadline.</li>
                        <li>You can view individual questions assigned to students for randomized assignments.</li>
                        <li>Use the <strong>Export CSV</strong> button to download the data.</li>
                    </ul>
                ) : (
                    <ul className="list-disc list-inside space-y-1">
                        <li>Marks are calculated out of <strong>10</strong> based on overall submission ratio.</li>
                        <li>Formula: <code>(Submitted + Manual Adj) / Total Assigned × 10</code>.</li>
                        <li>You can manually adjust the submission count for a student in the Submissions Report tab.</li>
                        <li>Only assignments that have started (creation date passed) are counted.</li>
                    </ul>
                )}
            </InstructionsBox>

            {/* Filters */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                <h2 className="text-xl font-semibold text-white">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                        <select
                            value={filters.dept}
                            onChange={e => { setFilters({ ...filters, dept: e.target.value }); setShowReport(false); }}
                            className="w-full rounded-md border-0 bg-gray-900 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Departments</option>
                            {depts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Year</label>
                        <select
                            value={filters.year}
                            onChange={e => { setFilters({ ...filters, year: e.target.value }); setShowReport(false); }}
                            className="w-full rounded-md border-0 bg-gray-900 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Years</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Course</label>
                        <select
                            value={filters.course}
                            onChange={e => { setFilters({ ...filters, course: e.target.value }); setShowReport(false); }}
                            className="w-full rounded-md border-0 bg-gray-900 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Courses</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {activeTab === 'submissions' && (
                    <div className="mt-4 animate-in fade-in duration-300">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Assignment</label>
                        <select
                            value={filters.assignmentId}
                            onChange={e => { setFilters({ ...filters, assignmentId: e.target.value }); setShowReport(false); }}
                            className="w-full rounded-md border-0 bg-gray-900 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select an assignment...</option>
                            {assignments.map(a => <option key={a._id} value={a._id}>{a.title}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="flex gap-4 items-center justify-between">
                <div>
                    {activeTab === 'submissions' && (
                        <button
                            onClick={handleGenerateReport}
                            disabled={!filters.assignmentId}
                            className="rounded-md bg-transparent border border-blue-500 text-blue-400 px-6 py-2 text-sm font-semibold hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Generate Report
                        </button>
                    )}
                </div>
                
                {((activeTab === 'submissions' && showReport) || (activeTab === 'marks')) && (
                    <button
                        onClick={exportCSV}
                        disabled={activeTab === 'marks' && marksData.length === 0}
                        className="rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-green-900/20 hover:bg-green-500 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="h-4 w-4" /> Export CSV
                    </button>
                )}
            </div>

            {/* Content Area Based on Active Tab */}
            {activeTab === 'submissions' ? (
                /* Report Table */
                showReport && (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-white/10 text-sm text-gray-300">
                                <thead className="bg-white/5 text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Student Name</th>
                                        <th className="px-4 py-3 text-left">Roll</th>
                                        <th className="px-4 py-3 text-left">Status</th>
                                        <th className="px-4 py-3 text-left">Gen. Date</th>
                                        <th className="px-4 py-3 text-left">Deadline</th>
                                        <th className="px-4 py-3 text-left">Submitted At</th>
                                        <th className="px-4 py-3 text-center w-32">Adj.</th>
                                        <th className="px-4 py-3 text-left">Attd. %</th>
                                        <th className="px-4 py-3 text-left">File</th>
                                        <th className="px-4 py-3 text-center">View Questions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {reportData.length === 0 ? (
                                        <tr><td colSpan={10} className="text-center py-8 text-gray-500">No students found matching criteria.</td></tr>
                                    ) : (
                                        reportData.map((d) => (
                                            <tr key={d.studentId} className="hover:bg-gray-700/30 transition-colors">
                                                <td className="px-4 py-3 font-medium text-white">{d.name}</td>
                                                <td className="px-4 py-3">{d.roll}</td>
                                                <td className={`px-4 py-3 font-bold ${d.status === 'Submitted' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {d.status}
                                                </td>
                                                <td className="px-4 py-3 text-gray-400">{d.generatedAt}</td>
                                                <td className="px-4 py-3 text-gray-400">{d.deadlineAt}</td>
                                                <td className="px-4 py-3 text-gray-300">{d.submittedAt}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={d.manualAdj}
                                                            onChange={(e) => handleAdjustmentChange(d.studentId, e.target.value)}
                                                            className="w-16 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-center text-white focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        {d._changed && (
                                                            <button
                                                                onClick={() => saveAdjustment(d.studentId, d.courseCode, d.manualAdj)}
                                                                className="text-green-400 hover:text-green-300"
                                                                title="Save Adjustment"
                                                            >
                                                                <Save className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 font-bold ${d.isEligible ? 'text-green-400' : 'text-red-400'}`}>
                                                    {d.attendanceAtDeadline}%
                                                </td>
                                                <td className="px-4 py-3">
                                                    {d.driveLink ? (
                                                        <a href={d.driveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1">
                                                            <Download className="h-3 w-3" /> Link
                                                        </a>
                                                    ) : <span className="text-gray-600">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleViewQuestions(d.studentId, d.name)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-medium transition-all border border-indigo-500/30"
                                                    >
                                                        <Eye className="h-3 w-3" /> View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : (
                /* Marks Table */
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10 text-sm text-gray-300">
                            <thead className="bg-white/5 text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left">Student Name</th>
                                    <th className="px-4 py-3 text-left">Roll</th>
                                    <th className="px-4 py-3 text-left">Dept - Year</th>
                                    <th className="px-4 py-3 text-left">Course</th>
                                    <th className="px-4 py-3 text-center">Submitted / Total</th>
                                    <th className="px-4 py-3 text-right">Marks (10)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {marksData.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No students found matching criteria.</td></tr>
                                ) : (
                                    marksData.map((d) => (
                                        <tr key={d.studentId} className="hover:bg-gray-700/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-white">{d.name}</td>
                                            <td className="px-4 py-3">{d.roll}</td>
                                            <td className="px-4 py-3 text-gray-400">{d.dept} - {d.year}</td>
                                            <td className="px-4 py-3 text-gray-400">{d.course}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-xs font-medium text-gray-300 shadow-inner">
                                                    <span className="text-white">{d.submitted}</span>
                                                    <span className="mx-1 text-gray-500">/</span>
                                                    <span>{d.total}</span>
                                                    {d.manualAdj > 0 && <span className="text-green-400 font-bold ml-1.5">(+{d.manualAdj})</span>}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold text-lg ${getMarkColor(d.marks)}`}>
                                                {d.marks}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* View Questions Modal */}
            {viewQuestionsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
                            <div>
                                <h3 className="text-lg font-bold text-white">Assigned Questions</h3>
                                <p className="text-sm text-gray-400">Student: <span className="text-white">{viewQuestionsStudent}</span></p>
                            </div>
                            <button
                                onClick={() => setViewQuestionsModal(false)}
                                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded-md"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 shadow-inner">
                            {viewQuestionsLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                                    <p className="text-gray-400 text-sm">Loading questions...</p>
                                </div>
                            ) : viewQuestionsData.length === 0 ? (
                                <div className="text-center flex flex-col items-center justify-center py-16 text-gray-500 bg-gray-800/20 rounded-xl border border-dashed border-gray-700">
                                    <FileText className="h-12 w-12 text-gray-600 mb-3" />
                                    <p className="font-medium text-gray-400">No questions found for this student.</p>
                                    <p className="text-xs mt-1 text-gray-500">This may happen for non-randomized assignments where all students get the same questions.</p>
                                </div>
                            ) : (
                                viewQuestionsData.map((q: any, idx: number) => (
                                    <div key={q._id || idx} className="bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 hover:border-indigo-500/50 transition-colors rounded-xl p-5 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-sm font-bold shadow-sm">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex gap-2 mb-3 flex-wrap">
                                                    {q.topic && <span className="text-[10px] bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{q.topic}</span>}
                                                    {q.subtopic && <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{q.subtopic}</span>}
                                                    {q.type && <span className="text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">{q.type}</span>}
                                                </div>
                                                <div className="text-sm text-gray-200 leading-relaxed font-medium">
                                                    <Latex>{q.text || ''}</Latex>
                                                </div>
                                                {q.image && (
                                                    <div className="mt-4 border border-gray-700 rounded-lg overflow-hidden bg-black/50 p-1 w-fit">
                                                        <img src={q.image} alt="Question" className="max-h-56 rounded pointer-events-none" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50">
                            <button
                                onClick={() => setViewQuestionsModal(false)}
                                className="w-full py-2.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:border-gray-500 text-white text-sm font-semibold transition-all shadow-sm"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
