'use client';

import { useState, useEffect } from 'react';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import InstructionsBox from '../assignments/components/InstructionsBox';

export default function MarksPage() {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);

    // Filters
    const [filters, setFilters] = useState({
        dept: 'all',
        year: 'all',
        course: 'all'
    });

    // Derived Lists
    const [depts, setDepts] = useState<string[]>([]);
    const [years, setYears] = useState<string[]>([]);
    const [courses, setCourses] = useState<string[]>([]);

    // Calculated Data
    const [marksData, setMarksData] = useState<any[]>([]);

    const [user, setUser] = useState<any>(null);
    const [allowedContext, setAllowedContext] = useState<any>(null);

    useEffect(() => {
        const init = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);

                const isGA = localStorage.getItem('globalAdminActive') === 'true';

                try {
                    // If Global Admin, we don't restrict context; let it fall back to all students
                    if (!isGA) {
                        const cRes = await fetch('/api/admin/config');
                        if (cRes.ok) {
                            const config = await cRes.json();
                            const courses = new Set<string>();
                            const depts = new Set<string>();
                            const years = new Set<string>();

                            if (config.teacherAssignments) {
                                Object.entries(config.teacherAssignments).forEach(([key, teachers]: [string, any]) => {
                                    if (Array.isArray(teachers) && teachers.some((t: any) => t.email === parsedUser.email)) {
                                        const [d, y, c] = key.split('_');
                                        if (d) depts.add(d);
                                        if (y) years.add(y);
                                        if (c) courses.add(c);
                                    }
                                });
                            }
                            setAllowedContext({
                                courses: Array.from(courses).sort(),
                                depts: Array.from(depts).sort(),
                                years: Array.from(years).sort()
                            });
                        }
                    } else {
                        setAllowedContext(null); // Ensure it's null for GA so it uses all data
                    }
                } catch (e) {
                    console.error("Error fetching config", e);
                }
            }
            fetchData();
        };
        init();
    }, []);

    const fetchData = async () => {
        try {
            const [sRes, aRes, subRes] = await Promise.all([
                fetch('/api/admin/students/all'),
                fetch('/api/admin/assignments'),
                fetch('/api/admin/submissions')
            ]);

            if (sRes.ok && aRes.ok && subRes.ok) {
                const sData = await sRes.json();
                setStudents(sData);
                setAssignments(await aRes.json());
                setSubmissions(await subRes.json());
            }
        } catch (error) {
            console.error("Error fetching data", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loading) calculateMarks();
    }, [filters, students, assignments, submissions]);

    // Update derived lists based on allowedContext
    useEffect(() => {
        if (!allowedContext) {
            if (students.length > 0) {
                const d = new Set<string>();
                const y = new Set<string>();
                const c = new Set<string>();
                students.forEach((s: any) => {
                    if (s.department) d.add(s.department);
                    if (s.year) y.add(s.year);
                    if (s.course_code) c.add(s.course_code);
                });
                setDepts(Array.from(d).sort());
                setYears(Array.from(y).sort());
                setCourses(Array.from(c).sort());
            }
            return;
        }

        setDepts(allowedContext.depts);
        setYears(allowedContext.years);
        setCourses(allowedContext.courses);

    }, [allowedContext, students]);

    const calculateMarks = () => {
        // 1. Filter Students
        const filteredStudents = students.filter(s =>
            (filters.dept === 'all' || s.department === filters.dept) &&
            (filters.year === 'all' || s.year === filters.year) &&
            (filters.course === 'all' || s.course_code === filters.course)
        );

        const now = new Date();

        const data = filteredStudents.map(student => {
            // A. Identify Tagged Assignments
            const taggedAssignments = assignments.filter(asn => {
                const createdDate = asn.createdAt ? new Date(asn.createdAt) : new Date(0);
                if (createdDate > now) return false; // Future assignments don't count

                // Check Department Targeting
                if (asn.targetDepartments && Array.isArray(asn.targetDepartments) && asn.targetDepartments.length > 0) {
                    return asn.targetDepartments.includes(student.department);
                }
                return true; // Default to all if no specific target
            });

            const totalTagged = taggedAssignments.length;
            const taggedIds = new Set(taggedAssignments.map(a => a._id));
            const involvedCourses = new Set(taggedAssignments.map(a => a.targetCourse).filter(Boolean));

            // B. Count Submitted
            const studentSubmissions = submissions.filter(sub =>
                (sub.student._id === student._id || sub.student === student._id) &&
                taggedIds.has(sub.assignment._id || sub.assignment)
            );

            // C. Manual Adjustments
            let totalManualAdj = 0;
            const adjustments = student.submission_adjustments || {};
            involvedCourses.forEach(c => {
                totalManualAdj += (adjustments[c] || 0);
            });

            const submittedCount = studentSubmissions.length + totalManualAdj;

            // D. Calculate Score
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

        // Sort by Roll
        data.sort((a, b) => a.roll.localeCompare(b.roll));
        setMarksData(data);
    };

    const exportCSV = () => {
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
    };

    const getMarkColor = (marks: string) => {
        const m = parseFloat(marks);
        if (m >= 8) return 'text-green-400';
        if (m >= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">


            {/* Filters */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4">
                <h2 className="text-xl font-semibold text-white">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Department</label>
                        <select
                            value={filters.dept}
                            onChange={e => setFilters({ ...filters, dept: e.target.value })}
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
                            onChange={e => setFilters({ ...filters, year: e.target.value })}
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
                            onChange={e => setFilters({ ...filters, course: e.target.value })}
                            className="w-full rounded-md border-0 bg-gray-900 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Courses</option>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <InstructionsBox>
                <ul className="list-disc list-inside space-y-1">
                    <li>Marks are calculated out of <strong>10</strong> based on submission ratio.</li>
                    <li>Formula: <code>(Submitted + Manual Adj) / Total Assigned × 10</code>.</li>
                    <li>Only assignments that have started (creation date passed) are counted.</li>
                    <li>Use filters to narrow down the list and <strong>Export CSV</strong> to download.</li>
                </ul>
            </InstructionsBox>

            <div className="flex justify-end">
                <button
                    onClick={exportCSV}
                    disabled={marksData.length === 0}
                    className="rounded-md bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-green-900/20 hover:bg-green-500 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="h-4 w-4" /> Export CSV
                </button>
            </div>

            {/* Marks Table */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
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
                                            <span className="inline-flex items-center rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-gray-300 ring-1 ring-inset ring-gray-700">
                                                {d.submitted} / {d.total}
                                                {d.manualAdj > 0 && <span className="text-green-400 ml-1">(+{d.manualAdj})</span>}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${getMarkColor(d.marks)}`}>
                                            {d.marks}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
