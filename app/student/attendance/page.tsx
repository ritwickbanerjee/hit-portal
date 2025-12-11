'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PieChart, User, Calendar, Loader2, CheckCircle, XCircle, AlertTriangle, Users, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function StudentAttendance() {
    const [student, setStudent] = useState<any>(null);
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [massBunkCount, setMassBunkCount] = useState(0);
    const [massBunkDates, setMassBunkDates] = useState<any[]>([]);
    const [adjustments, setAdjustments] = useState<Record<string, { attended: number, total: number }>>({});
    const [loading, setLoading] = useState(true);
    const [activeCourse, setActiveCourse] = useState<string | null>(null);
    const [expandedFaculties, setExpandedFaculties] = useState<Set<string>>(new Set());
    const router = useRouter();

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);
        fetchAttendance(parsedStudent._id);
    }, [router]);

    const fetchAttendance = async (studentId: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/attendance?studentId=${studentId}`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 404 || res.status === 401) {
                toast.error('Session expired or invalid. Please login again.');
                localStorage.removeItem('student');
                router.push('/student/login');
                return;
            }

            if (res.ok) {
                const data = await res.json();
                // Handle both old format (array) and new format (object with records)
                if (Array.isArray(data)) {
                    setAttendanceData(data);
                } else {
                    setAttendanceData(data.records || []);
                    setMassBunkCount(data.massBunkCount || 0);
                    setAttendanceData(data.records || []);
                    setMassBunkCount(data.massBunkCount || 0);
                    setMassBunkDates(data.massBunkDates || []);
                    setAdjustments(data.adjustments || {});
                }
            } else {
                toast.error('Failed to load attendance');
            }
        } catch (error) {
            console.error('Failed to fetch attendance', error);
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    const groupedData = useMemo(() => {
        return attendanceData.reduce((acc: any, record: any) => {
            const course = record.course_code;
            const faculty = record.teacherName || 'Unknown Faculty';

            if (!acc[course]) acc[course] = { faculties: {}, totalAttended: 0, totalClasses: 0 };
            if (!acc[course].faculties[faculty]) acc[course].faculties[faculty] = { attended: 0, total: 0, dates: [] };

            // Use the status calculated by the backend which handles multiple Student IDs
            const isPresent = record.status === 'Present';

            acc[course].faculties[faculty].total++;
            acc[course].totalClasses++;

            if (isPresent) {
                acc[course].faculties[faculty].attended++;
                acc[course].totalAttended++;
            }

            acc[course].faculties[faculty].dates.push({
                date: record.date,
                timeSlot: record.timeSlot,
                status: isPresent ? 'Present' : 'Absent'
            });

            acc[course].faculties[faculty].dates.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return acc;
        }, {});
    }, [attendanceData, student?._id]);

    const courses = useMemo(() => Object.keys(groupedData).sort(), [groupedData]);

    useEffect(() => {
        if (courses.length > 0 && activeCourse === null) {
            setActiveCourse(courses[0]);
        }
    }, [courses, activeCourse]);

    const overallStats = useMemo(() => {
        let totalAttendedAll = 0;
        let totalClassesAll = 0;

        // Sum up base values + adjustments for each course
        Object.entries(groupedData).forEach(([course, data]: [string, any]) => {
            totalAttendedAll += data.totalAttended;
            totalClassesAll += data.totalClasses;

            // Apply adjustment for THIS specific course
            const adj = adjustments[course];
            if (adj) {
                totalAttendedAll += adj.attended;
                totalClassesAll += adj.total;
            }
        });

        // Also add adjustments for courses that might not have any records yet but exist in adjustments
        Object.entries(adjustments).forEach(([course, adj]) => {
            if (!groupedData[course]) {
                totalAttendedAll += adj.attended;
                totalClassesAll += adj.total;
            }
        });

        const percent = totalClassesAll > 0 ? Math.round((totalAttendedAll / totalClassesAll) * 100) : 0;
        return { totalAttendedAll, totalClassesAll, percent };
    }, [groupedData, adjustments]);

    const getPercentColor = (percent: number) => {
        if (percent >= 75) return { text: 'text-emerald-400', bg: 'from-emerald-500 to-teal-500', bgLight: 'bg-emerald-500/20', ring: 'ring-emerald-500/30' };
        if (percent >= 60) return { text: 'text-amber-400', bg: 'from-amber-500 to-orange-500', bgLight: 'bg-amber-500/20', ring: 'ring-amber-500/30' };
        return { text: 'text-rose-400', bg: 'from-rose-500 to-red-500', bgLight: 'bg-rose-500/20', ring: 'ring-rose-500/30' };
    };

    const toggleFaculty = (faculty: string) => {
        setExpandedFaculties(prev => {
            const newSet = new Set(prev);
            if (newSet.has(faculty)) newSet.delete(faculty);
            else newSet.add(faculty);
            return newSet;
        });
    };

    const downloadAttendancePDF = () => {
        if (!activeCourse || !student) return;

        const courseData = groupedData[activeCourse];
        if (!courseData) return;

        // Create a Set of mass bunk date-timeSlot combinations for quick lookup
        const massBunkKeys = new Set(
            massBunkDates.map((mb: any) => `${mb.date}-${mb.timeSlot}-${mb.course_code}`)
        );

        // Collect all dates from all faculties for this course
        const allDates: any[] = [];
        Object.entries(courseData.faculties).forEach(([faculty, data]: [string, any]) => {
            data.dates.forEach((d: any) => {
                // Check if this date-timeSlot-course combination is a mass bunk
                const key = `${d.date}-${d.timeSlot}-${activeCourse}`;
                const isMassBunk = massBunkKeys.has(key);

                // If absent and it's a mass bunk, label it as "Mass Bunk"
                let status = d.status;
                if (status === 'Absent' && isMassBunk) {
                    status = 'Mass Bunk';
                }

                allDates.push({
                    date: d.date,
                    timeSlot: d.timeSlot,
                    faculty,
                    status
                });
            });
        });

        // Sort by date ascending
        allDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (allDates.length === 0) {
            alert('No attendance data to download.');
            return;
        }

        // Prepare table data
        const tableBodyData = allDates.map(record => [
            `${new Date(record.date).toLocaleDateString('en-IN')} (${record.timeSlot || '-'})`,
            record.faculty,
            record.status
        ]);

        // Generate PDF
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text(`Attendance Register: ${activeCourse}`, 14, 15);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Name: ${student.name} | Roll: ${student.roll}`, 14, 22);
        doc.text(`Department: ${student.department} | Year: ${student.year}`, 14, 27);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);

        autoTable(doc, {
            startY: 38,
            head: [['Date & Time', 'Faculty', 'Status']],
            body: tableBodyData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, minCellHeight: 6 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 40, fontStyle: 'bold' }
            },
            didParseCell: function (data) {
                if (data.section === 'body') {
                    const status = data.row.cells[2].raw;

                    // Highlight entire row for Mass Bunk
                    if (status === 'Mass Bunk') {
                        data.cell.styles.fillColor = [255, 243, 224]; // Light Orange background
                        if (data.column.index === 2) {
                            data.cell.styles.textColor = [255, 140, 0]; // Dark Orange text
                            data.cell.styles.fontStyle = 'bold';
                        }
                    } else if (data.column.index === 2) {
                        // Standard status coloring
                        if (status === 'Present') data.cell.styles.textColor = [0, 128, 0];
                        else if (status === 'Absent') data.cell.styles.textColor = [255, 0, 0];
                        // Calculate Grand Totals
                        const totalClasses = allDates.length;
                        const totalAttended = allDates.filter(d => d.status === 'Present').length;
                        const totalMassBunks = allDates.filter(d => d.status === 'Mass Bunk').length;
                        const totalAbsent = totalClasses - totalAttended;

                        // Add Total Row
                        summaryBody.push(['TOTAL', totalClasses, totalAttended, totalAbsent, totalMassBunks]);

                        // Add Summary Section
                        // Get final Y position of the previous table
                        const finalY = (doc as any).lastAutoTable.finalY + 10;

                        doc.setFontSize(14);
                        doc.setTextColor(40);
                        doc.text("Attendance Summary", 14, finalY);

                        autoTable(doc, {
                            startY: finalY + 5,
                            head: [['Faculty', 'Total Class', 'Present', 'Absent', 'Mass Bunk']],
                            body: summaryBody,
                            theme: 'grid',
                            headStyles: {
                                fillColor: [41, 128, 185],
                                textColor: 255,
                                fontSize: 10,
                                halign: 'center'
                            },
                            bodyStyles: {
                                textColor: 50,
                                fontSize: 10,
                                halign: 'center',
                                fontStyle: 'bold'
                            },
                            columnStyles: {
                                0: { halign: 'left', fontStyle: 'bold' }, // Faculty Name
                                1: { fillColor: [240, 248, 255] }, // Light Blue (Total)
                                2: { fillColor: [220, 252, 231] }, // Light Green (Present)
                                3: { fillColor: [254, 226, 226] }, // Light Red (Absent)
                                4: { fillColor: [255, 237, 213] }  // Light Orange (Mass Bunk)
                            },
                            didParseCell: function (data) {
                                // Style the TOTAL row
                                if (data.section === 'body' && data.row.index === summaryBody.length - 1) {
                                    data.cell.styles.fontStyle = 'bold';
                                    data.cell.styles.fillColor = [200, 200, 200]; // Grey background for total row
                                    // Keep column colors for cells if desired, or override:
                                    if (data.column.index === 1) data.cell.styles.fillColor = [190, 230, 255];
                                    if (data.column.index === 2) data.cell.styles.fillColor = [190, 235, 200];
                                    if (data.column.index === 3) data.cell.styles.fillColor = [255, 200, 200];
                                    if (data.column.index === 4) data.cell.styles.fillColor = [255, 220, 180];
                                }
                            }
                        });

                        doc.save(`Attendance_${activeCourse}_${student.roll}.pdf`);
                    };

                    if (!student) return null;

                    return (
                        <div className="min-h-screen bg-[#0a0f1a] text-gray-200 font-sans">
                            {/* Animated Background */}
                            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-gradient-radial from-blue-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
                                <div className="absolute bottom-[-30%] right-[-20%] w-[60%] h-[60%] bg-gradient-radial from-cyan-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
                            </div>

                            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
                                {/* Header */}
                                <div className="flex items-center justify-between gap-4 mb-8">
                                    <div className="flex items-center gap-4">
                                        <Link href="/student" className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all">
                                            <ArrowLeft className="h-5 w-5" />
                                        </Link>
                                        <div>
                                            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                                Attendance
                                            </h1>
                                            <p className="text-gray-500 text-sm">Track your class participation</p>
                                        </div>
                                    </div>
                                    {activeCourse && courses.length > 0 && (
                                        <button
                                            onClick={downloadAttendancePDF}
                                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                                        >
                                            <FileDown className="h-4 w-4" />
                                            <span className="hidden sm:inline">Download PDF</span>
                                            <span className="sm:hidden">PDF</span>
                                        </button>
                                    )}
                                </div>

                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                    </div>
                                ) : courses.length === 0 ? (
                                    <div className="text-center py-20">
                                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-800/50 flex items-center justify-center">
                                            <PieChart className="h-10 w-10 text-gray-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-400 mb-2">No Records</h3>
                                        <p className="text-gray-600">No attendance data available yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Stats Row - Overall + Mass Bunk */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            {/* Overall Stats Card */}
                                            <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${getPercentColor(overallStats.percent).bgLight} border border-white/10`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center ring-2 sm:ring-4 ${getPercentColor(overallStats.percent).ring} bg-[#0a0f1a]`}>
                                                        <p className={`text-xl sm:text-2xl font-black ${getPercentColor(overallStats.percent).text}`}>
                                                            {overallStats.percent}%
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base sm:text-lg font-bold text-white">Overall Attendance</h3>
                                                        <p className="text-gray-400 text-xs sm:text-sm">
                                                            {overallStats.totalAttendedAll}/{overallStats.totalClassesAll} classes
                                                        </p>
                                                        <div className="flex gap-2 sm:gap-3 mt-1 sm:mt-2 text-xs">
                                                            <span className="text-emerald-400 flex items-center gap-1">
                                                                <CheckCircle className="h-3 w-3" /> {overallStats.totalAttendedAll}
                                                            </span>
                                                            <span className="text-rose-400 flex items-center gap-1">
                                                                <XCircle className="h-3 w-3" /> {overallStats.totalClassesAll - overallStats.totalAttendedAll}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mass Bunk Counter Card */}
                                            <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border ${massBunkCount > 0 ? 'bg-rose-900/20 border-rose-500/30' : 'bg-white/5 border-white/10'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center ${massBunkCount > 0 ? 'bg-rose-500/20' : 'bg-white/5'}`}>
                                                        <Users className={`h-6 w-6 sm:h-7 sm:w-7 ${massBunkCount > 0 ? 'text-rose-400' : 'text-gray-500'}`} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs sm:text-sm text-gray-400">Mass Bunks</p>
                                                        <p className={`text-2xl sm:text-3xl font-black ${massBunkCount > 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                                                            {massBunkCount}
                                                        </p>
                                                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                                                            {massBunkCount === 0 ? 'No mass bunks recorded' : 'Classes where all students were absent'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mass Bunk Warning */}
                                        {massBunkCount > 0 && (
                                            <div className="p-4 rounded-xl bg-rose-900/20 border border-rose-500/30">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-rose-300 font-bold text-sm">Mass Bunk Warning</p>
                                                        <p className="text-rose-300/70 text-xs mt-1">
                                                            {massBunkCount} class(es) where the entire batch was absent. These may have disciplinary consequences.
                                                        </p>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {massBunkDates.slice(0, 5).map((mb, i) => (
                                                                <span key={i} className="text-xs bg-rose-500/20 text-rose-300 px-2 py-1 rounded-lg">
                                                                    {new Date(mb.date).toLocaleDateString()} • {mb.teacherName}
                                                                </span>
                                                            ))}
                                                            {massBunkDates.length > 5 && (
                                                                <span className="text-xs text-rose-400">+{massBunkDates.length - 5} more</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Course Tabs */}
                                        <div className="flex flex-wrap gap-2">
                                            {courses.map(course => {
                                                const data = groupedData[course];
                                                const adj = adjustments[course] || { attended: 0, total: 0 };

                                                const finalAttended = data.totalAttended + adj.attended;
                                                const finalTotal = data.totalClasses + adj.total;

                                                const percent = finalTotal > 0 ? Math.round((finalAttended / finalTotal) * 100) : 0;
                                                const color = getPercentColor(percent);

                                                return (
                                                    <button
                                                        key={course}
                                                        onClick={() => setActiveCourse(course)}
                                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeCourse === course
                                                            ? `bg-gradient-to-r ${color.bg} text-white shadow-lg`
                                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                                                            }`}
                                                    >
                                                        {course}
                                                        <span className={`ml-2 ${activeCourse === course ? 'text-white/80' : color.text}`}>
                                                            {percent}%
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Faculty Cards - Side by Side Grid (Always 2 columns) */}
                                        {activeCourse && groupedData[activeCourse] && (
                                            <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                                {Object.entries(groupedData[activeCourse].faculties).map(([faculty, data]: [string, any]) => {
                                                    const percent = data.total > 0 ? Math.round((data.attended / data.total) * 100) : 0;
                                                    const color = getPercentColor(percent);
                                                    const isExpanded = expandedFaculties.has(faculty);
                                                    const recentDates = isExpanded ? data.dates : data.dates.slice(0, 3);

                                                    return (
                                                        <div
                                                            key={faculty}
                                                            className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/40 border border-white/10 overflow-hidden"
                                                        >
                                                            {/* Faculty Header - Compact on mobile */}
                                                            <div className="p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                                <div className="flex items-center gap-2 sm:gap-3">
                                                                    <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br ${color.bg}`}>
                                                                        <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <h4 className="text-xs sm:text-base font-bold text-white truncate">{faculty}</h4>
                                                                        <p className="text-gray-500 text-[10px] sm:text-xs">{data.attended}/{data.total}</p>
                                                                    </div>
                                                                </div>
                                                                <div className={`text-lg sm:text-2xl font-black ${color.text}`}>
                                                                    {percent}%
                                                                </div>
                                                            </div>

                                                            {/* Attendance History - Compact on mobile */}
                                                            <div className="px-2 sm:px-5 pb-2 sm:pb-4 space-y-1 sm:space-y-2 max-h-64 sm:max-h-96 overflow-y-auto custom-scrollbar">
                                                                {recentDates.map((d: any, i: number) => (
                                                                    <div
                                                                        key={i}
                                                                        className={`flex items-center justify-between p-1.5 sm:p-2.5 rounded-md sm:rounded-lg text-xs sm:text-sm ${d.status === 'Present'
                                                                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                                            : 'bg-rose-500/10 border border-rose-500/20'
                                                                            }`}
                                                                    >
                                                                        <div className="flex flex-col min-w-0 flex-1">
                                                                            <div className="flex items-center gap-1">
                                                                                <Calendar className="h-3 w-3 text-gray-500 shrink-0" />
                                                                                <span className="text-gray-300 text-[10px] sm:text-xs truncate">
                                                                                    {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                                </span>
                                                                            </div>
                                                                            {d.timeSlot && (
                                                                                <span className="text-gray-500 text-[9px] sm:text-[10px] ml-4">{d.timeSlot}</span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`text-[10px] sm:text-xs font-bold flex items-center gap-0.5 shrink-0 ${d.status === 'Present' ? 'text-emerald-400' : 'text-rose-400'
                                                                            }`}>
                                                                            {d.status === 'Present' ? <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                                                                            {d.status === 'Present' ? 'P' : 'A'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Show More/Less */}
                                                            {data.dates.length > 3 && (
                                                                <button
                                                                    onClick={() => toggleFaculty(faculty)}
                                                                    className="w-full py-2 sm:py-2.5 bg-white/5 border-t border-white/5 text-gray-400 hover:text-white text-[10px] sm:text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                                >
                                                                    {isExpanded ? (
                                                                        <>Less <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /></>
                                                                    ) : (
                                                                        <>+{data.dates.length - 3} <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" /></>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 2px;
                }
            `}</style>
                        </div >
                    );
                }
