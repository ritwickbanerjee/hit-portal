'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar, Clock, CheckCircle, AlertCircle, User, Loader2, XCircle, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StudentAssignments() {
    const [student, setStudent] = useState<any>(null);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCourse, setActiveCourse] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);

        if (!parsedStudent.department || !parsedStudent.year) {
            toast.error('Session data missing. Please log in again.');
            localStorage.removeItem('student');
            router.push('/student/login');
            return;
        }

        fetchAssignments(parsedStudent);
    }, [router]);

    const fetchAssignments = async (studentData: any) => {
        try {
            const params = new URLSearchParams({
                department: studentData.department,
                year: studentData.year,
            });
            if (studentData.course_code) {
                const courses = Array.isArray(studentData.course_code)
                    ? studentData.course_code.join(',')
                    : studentData.course_code;
                params.append('course_code', courses);
            }
            if (studentData._id) params.append('studentId', studentData._id);

            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/assignments?${params.toString()}`, {
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setAssignments(await res.json());
            } else {
                toast.error('Failed to fetch assignments');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // Format date as DD/MM/YYYY
    const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Calculate precise time remaining
    const getTimeRemaining = (deadline: Date) => {
        const now = new Date();
        const diffMs = deadline.getTime() - now.getTime();

        if (diffMs <= 0) return "Expired";

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ${hours} hr${hours !== 1 ? 's' : ''} left`;
        } else {
            return `${hours} hr${hours !== 1 ? 's' : ''} left`;
        }
    };

    const courses = useMemo(() => {
        const courseSet = new Set<string>();
        assignments.forEach(a => {
            const course = a.targetCourse || a.course_code;
            if (course) courseSet.add(course);
        });
        return Array.from(courseSet).sort();
    }, [assignments]);

    useEffect(() => {
        if (courses.length > 0 && activeCourse === null) {
            setActiveCourse(courses[0]);
        }
    }, [courses, activeCourse]);

    const filteredAssignments = useMemo(() => {
        if (!activeCourse) return [];
        return assignments.filter(a => {
            const course = a.targetCourse || a.course_code;
            return course === activeCourse;
        }).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    }, [assignments, activeCourse]);

    const stats = useMemo(() => {
        const now = new Date();
        const active = filteredAssignments.filter(a => new Date(a.deadline) >= now);
        const missed = filteredAssignments.filter(a => new Date(a.deadline) < now && !a.submitted);
        const submitted = filteredAssignments.filter(a => a.submitted);
        const pending = filteredAssignments.filter(a => new Date(a.deadline) >= now && !a.submitted);
        return {
            total: filteredAssignments.length,
            submitted: submitted.length,
            pending: pending.length,
            active: active.length,
            missed: missed.length,
            missedList: missed
        };
    }, [filteredAssignments]);

    if (!student) return null;

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-200 font-sans">
            {/* Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] right-[-20%] w-[60%] h-[60%] bg-gradient-radial from-emerald-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                {/* Header - Compact */}
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                    <Link href="/student" className="p-2 sm:p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                            Assignments
                        </h1>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                    </div>
                ) : courses.length === 0 ? (
                    <div className="text-center py-16">
                        <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500">No assignments found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Course Tabs - Compact */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {courses.map(course => (
                                <button
                                    key={course}
                                    onClick={() => setActiveCourse(course)}
                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeCourse === course
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                                        : 'bg-white/5 text-gray-400 border border-white/10'
                                        }`}
                                >
                                    {course}
                                </button>
                            ))}
                        </div>

                        {/* Stats - Compact Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div className="p-3 rounded-xl bg-blue-900/30 border border-blue-500/20 text-center">
                                <p className="text-lg sm:text-2xl font-black text-white">{stats.total}</p>
                                <p className="text-[10px] sm:text-xs text-blue-400 font-semibold">Total Assigned</p>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-500/20 text-center">
                                <p className="text-lg sm:text-2xl font-black text-white">{stats.submitted}</p>
                                <p className="text-[10px] sm:text-xs text-emerald-400 font-semibold">Submitted</p>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-900/30 border border-purple-500/20 text-center">
                                <p className="text-lg sm:text-2xl font-black text-white">{stats.pending}</p>
                                <p className="text-[10px] sm:text-xs text-purple-400 font-semibold">Pending</p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-900/30 border border-amber-500/20 text-center">
                                <p className="text-lg sm:text-2xl font-black text-white">{stats.active}</p>
                                <p className="text-[10px] sm:text-xs text-amber-400 font-semibold">Active</p>
                            </div>
                            <div className="p-3 rounded-xl bg-rose-900/30 border border-rose-500/20 text-center col-span-2 sm:col-span-1">
                                <p className="text-lg sm:text-2xl font-black text-white">{stats.missed}</p>
                                <p className="text-[10px] sm:text-xs text-rose-400 font-semibold">Missed</p>
                            </div>
                        </div>

                        {/* Missed Warning - Compact */}
                        {stats.missed > 0 && (
                            <div className="p-3 rounded-xl bg-rose-900/20 border border-rose-500/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-4 w-4 text-rose-400" />
                                    <span className="font-bold text-rose-300 text-sm">Missed Deadlines</span>
                                </div>
                                <div className="space-y-1">
                                    {stats.missedList.slice(0, 3).map((a: any) => (
                                        <div key={a._id} className="flex justify-between text-xs p-2 rounded-lg bg-rose-950/30">
                                            <span className="text-gray-300 truncate flex-1">{a.title}</span>
                                            <span className="text-rose-400 shrink-0 ml-2">{formatDate(new Date(a.deadline))}</span>
                                        </div>
                                    ))}
                                    {stats.missedList.length > 3 && (
                                        <p className="text-[10px] text-rose-400 text-center">+{stats.missedList.length - 3} more</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Assignment List - Compact Cards */}
                        <div className="space-y-2">
                            {filteredAssignments.filter(a => new Date(a.deadline) >= new Date()).length === 0 ? (
                                <div className="text-center py-8 rounded-xl bg-white/5 border border-white/10">
                                    <CheckCircle className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">All caught up!</p>
                                </div>
                            ) : (
                                filteredAssignments.filter(a => new Date(a.deadline) >= new Date()).map((assignment) => {
                                    const deadline = new Date(assignment.deadline);
                                    const hoursLeft = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
                                    const isUrgent = hoursLeft < 24;
                                    const timeRemaining = getTimeRemaining(deadline);
                                    const isSubmitted = assignment.submitted;

                                    return (
                                        <div
                                            key={assignment._id}
                                            onClick={() => router.push(`/student/assignments/${assignment._id}`)}
                                            className={`p-3 sm:p-4 rounded-xl cursor-pointer transition-all active:scale-[0.98] relative ${isSubmitted
                                                ? 'bg-gradient-to-r from-emerald-900/40 to-green-900/30 border border-emerald-500/30'
                                                : isUrgent
                                                    ? 'bg-gradient-to-r from-orange-900/40 to-amber-900/30 border border-orange-500/30'
                                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                }`}
                                        >
                                            {/* Submitted Badge */}
                                            {isSubmitted && (
                                                <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                    Submitted
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg shrink-0 ${isSubmitted ? 'bg-emerald-500/20' : isUrgent ? 'bg-orange-500/20' : 'bg-emerald-500/20'
                                                    }`}>
                                                    {isSubmitted ? (
                                                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                                                    ) : (
                                                        <FileText className={`h-4 w-4 sm:h-5 sm:w-5 ${isUrgent ? 'text-orange-400' : 'text-emerald-400'}`} />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm sm:text-base font-bold text-white truncate">{assignment.title}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <span className={`text-[10px] sm:text-xs ${isUrgent ? 'text-orange-400' : 'text-gray-500'}`}>
                                                            {formatDate(deadline)} • {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {assignment.facultyName && (
                                                            <span className="text-[10px] text-gray-600 hidden sm:inline">• {assignment.facultyName}</span>
                                                        )}
                                                    </div>
                                                    {isSubmitted && assignment.submissionData?.submittedAt ? (
                                                        <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-bold text-emerald-400">
                                                            <CheckCircle className="h-3 w-3" />
                                                            Submitted on {formatDate(new Date(assignment.submissionData.submittedAt))}
                                                        </div>
                                                    ) : (
                                                        <div className={`flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-bold ${isUrgent ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                            <Clock className="h-3 w-3" />
                                                            {timeRemaining}
                                                        </div>
                                                    )}
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}
