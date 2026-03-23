'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Download, Save, FileText, CheckCircle, XCircle, Eye, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import InstructionsBox from '../assignments/components/InstructionsBox';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

export default function SubmissionsPage() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [config, setConfig] = useState<any>({ attendanceRequirement: 70 });

    // Filters
    const [filters, setFilters] = useState({
        dept: 'all',
        year: 'all',
        course: 'all',
        assignmentId: ''
    });

    const [user, setUser] = useState<any>(null);

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

    const [reportData, setReportData] = useState<any[]>([]);
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
                const sData = await sRes.json();
                const aData = await aRes.json();
                setStudents(sData);
                setAssignments(aData);
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



    const handleGenerateReport = () => {
        if (!filters.assignmentId) return toast.error("Please select an assignment");

        const assignment = assignments.find(a => a._id === filters.assignmentId);
        if (!assignment) return;

        const targetCourse = assignment.targetCourse || assignment.course_code;
        if (!targetCourse) return toast.error("Assignment has no target course configured");
        const deadlineDate = new Date(assignment.deadline);

        // Filter Students
        const filteredStudents = students.filter(s =>
            (filters.dept === 'all' || s.department === filters.dept) &&
            (filters.year === 'all' || s.year === filters.year) &&
            (filters.course === 'all' || s.course_code === filters.course) &&
            // Also filter by the assignment's target year if set
            (!assignment.targetYear || assignment.targetYear === 'all' || s.year === assignment.targetYear)
        );

        const data = filteredStudents.map(student => {
            const sub = submissions.find(s =>
                (s.student._id === student._id || s.student === student._id) &&
                (s.assignment._id === assignment._id || s.assignment === assignment._id)
            );

            // Attendance Logic
            const attendance = calculateAttendance(student, targetCourse, deadlineDate);

            // Manual Adjustment
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

        // Sort by roll number in ascending order
        data.sort((a, b) => a.roll.localeCompare(b.roll));

        setReportData(data);
        setShowReport(true);
    };

    const calculateAttendance = (student: any, targetCourse: string, deadlineDate: Date) => {
        const now = new Date();

        console.log('[ATTENDANCE CALC]', student.name);
        console.log('  Deadline:', deadlineDate);
        console.log('  Now:', now);
        console.log('  Deadline has passed?', now >= deadlineDate);

        // 1. Filter by Course
        let records = attendanceRecords.filter(r =>
            (r.course_code || "").trim().toUpperCase() === (targetCourse || "").trim().toUpperCase()
        );

        // 2. Filter by Deadline (if passed) or Current Date (if not)
        const cutoffDate = now >= deadlineDate ? deadlineDate : now;
        console.log('  Cutoff Date:', cutoffDate);

        records = records.filter(r => {
            const recordDate = getRecordDateObject(r.date, r.timeSlot);
            return recordDate <= cutoffDate;
        });

        console.log('  Total records before cutoff:', attendanceRecords.filter(r =>
            (r.course_code || "").trim().toUpperCase() === (targetCourse || "").trim().toUpperCase()
        ).length);
        console.log('  Records after cutoff:', records.length);

        // 3. Filter by Student Presence (Explicitly marked)
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

        console.log('  Final attendance %:', pct.toFixed(1));

        return {
            percentage: pct,
            isEligible: pct >= (config.attendanceRequirement || 70)
        };
    };

    const getRecordDateObject = (dateStr: string, timeSlotStr: string) => {
        try {
            if (!timeSlotStr) return new Date(dateStr + "T00:00:00");
            const parts = timeSlotStr.split('-');
            let startPart = parts[0];
            let hour = parseInt(startPart);
            if (hour < 7) hour += 12; // PM assumption

            const d = new Date(dateStr);
            d.setHours(hour, 0, 0, 0);
            return d;
        } catch (e) {
            return new Date(dateStr);
        }
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
            // Optimistic update
            setReportData(prev => prev.map(d =>
                d.studentId === studentId ? { ...d, _changed: false } : d
            ));

            // Fetch current student to get existing map
            // We need to merge, not overwrite the whole map if we were sending the whole map.
            // But here we can just send the updated map if we had it. 
            // Better approach: Get current student from state, update map, send whole map.

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

            // Update local students state
            setStudents(prev => prev.map(s =>
                s._id === studentId ? { ...s, submission_adjustments: updatedMap } : s
            ));

            toast.success("Saved", { id: toastId });
        } catch (error) {
            toast.error("Failed to save", { id: toastId });
        }
    };

    const exportCSV = () => {
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

            <InstructionsBox>
                <ul className="list-disc list-inside space-y-1">
                    <li>Select an <strong>Assignment</strong> to generate the report.</li>
                    <li>The report shows submission status and <strong>Attendance Eligibility</strong> at the time of the deadline.</li>
                    <li>You can manually adjust the submission count for a student in the "Adj." column.</li>
                    <li>Use the <strong>Export CSV</strong> button to download the data.</li>
                </ul>
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

                <div>
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
            </div>



            <div className="flex gap-4">
                <button
                    onClick={handleGenerateReport}
                    disabled={!filters.assignmentId}
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Generate Report
                </button>
                {showReport && (
                    <button
                        onClick={exportCSV}
                        className="rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-green-900/20 hover:bg-green-500 flex items-center gap-2 transition-all"
                    >
                        <Download className="h-4 w-4" /> Export CSV
                    </button>
                )}
            </div>

            {/* Report Table */}
            {showReport && (
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
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
                                                    <a href={d.driveLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                                                        Open
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
            )}

            {/* View Questions Modal */}
            {viewQuestionsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
                            <div>
                                <h3 className="text-lg font-bold text-white">Assigned Questions</h3>
                                <p className="text-sm text-gray-400">Student: {viewQuestionsStudent}</p>
                            </div>
                            <button
                                onClick={() => setViewQuestionsModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {viewQuestionsLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                                </div>
                            ) : viewQuestionsData.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <p>No questions found for this student.</p>
                                    <p className="text-xs mt-1">This may happen for non-randomized assignments.</p>
                                </div>
                            ) : (
                                viewQuestionsData.map((q: any, idx: number) => (
                                    <div key={q._id || idx} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex gap-2 mb-2 flex-wrap">
                                                    {q.topic && <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold">{q.topic}</span>}
                                                    {q.subtopic && <span className="text-[10px] bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded uppercase font-bold">{q.subtopic}</span>}
                                                    {q.type && <span className="text-[10px] bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded uppercase font-bold">{q.type}</span>}
                                                </div>
                                                <div className="text-sm text-gray-200 leading-relaxed">
                                                    <Latex>{q.text || ''}</Latex>
                                                </div>
                                                {q.image && (
                                                    <img src={q.image} alt="Question" className="mt-3 max-h-48 rounded-lg border border-gray-700" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-6 py-3 border-t border-gray-700">
                            <button
                                onClick={() => setViewQuestionsModal(false)}
                                className="w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
