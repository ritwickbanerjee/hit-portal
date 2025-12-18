'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, FileText, AlertTriangle, CheckCircle, User, Loader2, Lock, Upload, ExternalLink, Shrink, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';


import { toast } from 'react-hot-toast';
import LatexRenderer from '@/components/LatexRenderer';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

interface AssignmentDetailClientProps {
    assignmentId: string;
}

export default function AssignmentDetailClient({ assignmentId }: AssignmentDetailClientProps) {
    const [student, setStudent] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showQuestions, setShowQuestions] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);
        fetchAssignmentDetail(parsedStudent._id);
    }, [router, assignmentId]);

    const fetchAssignmentDetail = async (studentId: string) => {
        try {
            // Remove studentId query param, utilize cookie
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/assignments/${assignmentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setData(await res.json());
            } else {
                const errData = await res.json();
                toast.error(errData.error || 'Failed to load assignment');
            }
        } catch (error) {
            toast.error('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Please select a PDF file');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            toast.error('File too large (>3MB). Please compress it first.');
            return;
        }

        setSelectedFile(file);
    };

    const handleSubmit = async () => {
        if (!selectedFile || !data?.scriptUrl) {
            toast.error('Please select a file first');
            return;
        }

        setUploading(true);
        const toastId = toast.loading('Uploading to Google Drive...');

        try {
            const { assignment, student: studentData } = data;
            const folderPath = [
                studentData.course_code,
                studentData.year,
                studentData.department,
                assignment.title.replace(/[^a-z0-9]/gi, '_'),
            ].join('/');

            const fileName = [
                studentData.roll,
                studentData.name.replace(/ /g, '_'),
                studentData.department,
                studentData.course_code,
                studentData.year,
            ].join('_') + '.pdf';

            const fileData = await fileToBase64(selectedFile);

            // Debug logging
            console.log('Upload Debug:', {
                scriptUrl: data.scriptUrl,
                fileName,
                folderPath,
                fileDataLength: fileData.length
            });

            // Use server-side proxy to avoid CORS issues
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/student/upload-to-drive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ scriptUrl: data.scriptUrl, fileData, fileName, folderPath }),
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch {
                throw new Error('Invalid response from server');
            }

            if (result.status !== 'success' || !result.driveLink) {
                // Show the detailed message from server if available
                const errorMsg = result.message || result.error || 'Upload failed';
                throw new Error(errorMsg);
            }

            const saveRes = await fetch('/api/student/submissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    assignmentId: assignment._id,
                    studentId: studentData._id,
                    driveLink: result.driveLink,
                }),
            });

            if (!saveRes.ok) {
                throw new Error('Failed to save submission');
            }

            toast.success('Submitted successfully!', { id: toastId });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchAssignmentDetail(studentData._id);
        } catch (error: any) {
            let msg = error.message;
            if (msg.includes('Failed to fetch')) {
                msg = "Network Error. Check if Google Script is deployed as 'Anyone'.";
            }
            toast.error(msg, { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    if (!student) return null;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#0a0f1a] text-gray-200 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Link href="/student/assignments" className="flex items-center gap-2 text-gray-400 hover:text-white mb-8">
                        <ArrowLeft className="h-5 w-5" />
                        Back to Assignments
                    </Link>
                    <div className="text-center py-20 text-gray-400">
                        Assignment not found or you don&apos;t have access
                    </div>
                </div>
            </div>
        );
    }

    const { assignment, questions, attendance, access, submission, scriptUrl } = data;
    const now = new Date();

    // TIMEZONE FIX: Retrieve raw string and treat as local time (effectively subtracting 5.5h if it was auto-converted)
    // We do this by creating a date, getting its time, and subtracting the offset
    // OR simply by assuming the time string provided by server is what the user intended in IST
    const adjustTime = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        // If the server returns UTC but meant IST, we need to subtract 5.5 hours to match "visual" time
        // However, standard new Date() converts UTC to Local (+5.5h).
        // If 11:47 became 17:17, we need to subtract 5.5h.
        return new Date(date.getTime() - (5.5 * 60 * 60 * 1000));
    }

    const startTime = assignment.startTime ? adjustTime(assignment.startTime) : null;
    const hasStarted = !startTime || startTime <= now;

    // Check if the deadline also needs adjustment or if it relies on 'isPastDeadline' flag from server
    // We trust the server flag 'isPastDeadline' for logic, but for display we might need adjustment
    const deadline = assignment.deadline ? adjustTime(assignment.deadline) : null;
    const isPastDeadline = access.isPastDeadline; // Keep server logic for safety
    const hasSubmitted = submission?.status === 'submitted' || submission?.driveLink;

    const getAttendanceColor = (percent: number) => {
        if (percent >= 75) return { text: 'text-emerald-400', bg: 'from-emerald-500 to-teal-500', bgLight: 'bg-emerald-500/20' };
        if (percent >= 60) return { text: 'text-amber-400', bg: 'from-amber-500 to-orange-500', bgLight: 'bg-amber-500/20' };
        return { text: 'text-rose-400', bg: 'from-rose-500 to-red-500', bgLight: 'bg-rose-500/20' };
    };

    const attendanceColor = getAttendanceColor(attendance.percent);

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-200 font-sans">
            {/* Background gradients */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-gradient-radial from-emerald-900/20 via-transparent to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-[-30%] right-[-20%] w-[60%] h-[60%] bg-gradient-radial from-teal-900/20 via-transparent to-transparent rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4 sm:mb-6">
                    <Link
                        href="/student/assignments"
                        className="p-2 sm:p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 line-clamp-1">
                            {assignment.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] sm:text-sm text-gray-400">
                            {assignment.targetCourse && (
                                <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                                    {assignment.targetCourse}
                                </span>
                            )}
                            {assignment.facultyName && (
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                                    {assignment.facultyName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-8">
                    {/* Attendance Card */}
                    <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${attendanceColor.bgLight} border border-white/10`}>
                        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">
                            Attendance ({attendance.facultyName})
                        </p>
                        <p className={`text-xl sm:text-3xl font-black ${attendanceColor.text}`}>
                            {attendance.percent}%
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                            {attendance.attendedClasses}/{attendance.totalClasses} classes
                        </p>
                    </div>

                    {/* Deadline Card */}
                    {deadline && (
                        <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-white/10 ${isPastDeadline ? 'bg-rose-500/10' : 'bg-white/5'}`}>
                            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">Deadline</p>
                            <p className={`text-sm sm:text-lg font-bold ${isPastDeadline ? 'text-rose-400' : 'text-white'}`}>
                                {formatDate(deadline)}
                            </p>
                            <p className={`text-[10px] sm:text-sm ${isPastDeadline ? 'text-rose-400' : 'text-gray-400'}`}>
                                {deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isPastDeadline && ' • Passed'}
                            </p>
                        </div>
                    )}

                    {/* Status Card */}
                    <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-white/10 ${hasSubmitted ? 'bg-emerald-500/10' : isPastDeadline ? 'bg-rose-500/10' : 'bg-amber-500/10'} col-span-2 md:col-span-1`}>
                        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-1">Status</p>
                        {hasSubmitted ? (
                            <div className="flex items-center gap-2 text-emerald-400">
                                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-lg sm:text-xl font-bold">Submitted</span>
                            </div>
                        ) : isPastDeadline ? (
                            <div className="flex items-center gap-2 text-rose-400">
                                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-lg sm:text-xl font-bold">Missed</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-amber-400">
                                <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
                                <span className="text-lg sm:text-xl font-bold">Pending</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Access Restricted Warning */}
                {!access.canAccess && !isPastDeadline && (
                    <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-rose-900/20 border border-rose-500/30 mb-6 sm:mb-8">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-rose-500/20">
                                <AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8 text-rose-400" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-xl font-bold text-rose-300 mb-1">Access Restricted</h2>
                                <p className="text-xs sm:text-base text-rose-200/80">
                                    Your attendance is below the required {access.requiredAttendance}%.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Deadline Passed Warning */}
                {isPastDeadline && (
                    <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gray-800/50 border border-gray-700 mb-6 sm:mb-8">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gray-700">
                                <Lock className="h-5 w-5 sm:h-8 sm:w-8 text-gray-400" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-xl font-bold text-gray-300 mb-1">Deadline Passed</h2>
                                <p className="text-xs sm:text-base text-gray-400">
                                    Questions are no longer visible after the deadline.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Not Started Warning */}
                {!hasStarted && (
                    <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-amber-900/20 border border-amber-500/30 mb-6 sm:mb-8">
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-amber-500/20">
                                <Clock className="h-5 w-5 sm:h-8 sm:w-8 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-xl font-bold text-amber-300 mb-1">Assignment Not Started</h2>
                                <p className="text-xs sm:text-base text-amber-200/80">
                                    This assignment will open on {startTime?.toLocaleString()}.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {access.canAccess && hasStarted && !isPastDeadline && (
                    <>
                        {/* Instructions */}
                        {assignment.type === 'manual' && assignment.description && (
                            <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/40 border border-white/10 mb-6 sm:mb-8">
                                <h2 className="text-sm sm:text-lg font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                                    Assignment Questions
                                </h2>
                                <div className="text-xs sm:text-base text-gray-300 leading-relaxed">
                                    <LatexRenderer content={assignment.description} />
                                </div>
                            </div>
                        )}

                        {/* Questions */}
                        {questions.length === 0 && (
                            <div className="p-8 rounded-xl bg-gray-800/30 border border-white/10 text-center mb-8">
                                <p className="text-gray-400">No questions have been uploaded for this assignment yet.</p>
                            </div>
                        )}

                        {questions.length > 0 && (
                            <div className="mb-6 sm:mb-8">
                                <button
                                    onClick={() => setShowQuestions(!showQuestions)}
                                    className="w-full py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-emerald-500/25"
                                >
                                    <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                                    <span className="text-sm sm:text-base">{showQuestions ? 'Hide Details' : 'View Details'}</span>
                                    {showQuestions ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />}
                                </button>

                                {showQuestions && (
                                    <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                                        {questions.map((question: any, index: number) => (
                                            <div
                                                key={question._id}
                                                className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/40 border border-white/10 hover:border-emerald-500/30 transition-all"
                                            >
                                                <div className="flex items-start gap-3 sm:gap-4">
                                                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-lg">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                                                            {question.topic && (
                                                                <span className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                                                                    {question.topic}
                                                                </span>
                                                            )}
                                                            {question.subtopic && (
                                                                <span className="text-[10px] sm:text-xs px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg bg-white/5 text-gray-400">
                                                                    {question.subtopic}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs sm:text-base text-gray-200 leading-relaxed">
                                                            <LatexRenderer content={question.latex || question.text} />
                                                        </div>
                                                        {question.image && (
                                                            <div className="mt-3 sm:mt-4">
                                                                <img
                                                                    src={question.image}
                                                                    alt="Question Illustration"
                                                                    className="max-w-full max-h-64 rounded-lg border border-white/10"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Submission Section */}
                        <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/40 border border-white/10">
                            <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                                <Upload className="h-5 w-5 text-emerald-400" />
                                {hasSubmitted ? 'Update Submission' : 'Submit Assignment'}
                            </h3>

                            <div className="space-y-3 sm:space-y-4">
                                {/* Compress Link */}
                                <a
                                    href="https://bigpdf.11zon.com/en/compress-pdf/compress-pdf-to-1mb.php"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 sm:p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-blue-500/20 group-hover:scale-110 transition-transform">
                                            <Shrink className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-white text-sm sm:text-base">Step 1: Compress PDF</p>
                                            <p className="text-[10px] sm:text-sm text-blue-300/70">Reduce file size below 3MB</p>
                                        </div>
                                        <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                                    </div>
                                </a>

                                {/* File Input */}
                                <div className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                                        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-purple-500/20">
                                            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-white text-sm sm:text-base">Step 2: Select File</p>
                                            <p className="text-[10px] sm:text-sm text-gray-400">PDF only, max 3MB</p>
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileChange}
                                        className="block w-full text-xs sm:text-sm text-gray-400 file:mr-2 sm:file:mr-4 file:py-2 sm:file:py-3 file:px-3 sm:file:px-5 file:rounded-xl file:border-0 file:text-xs sm:file:text-sm file:font-bold file:bg-purple-500 file:text-white hover:file:bg-purple-400 cursor-pointer file:transition-colors"
                                    />
                                    {selectedFile && (
                                        <p className="text-[10px] sm:text-sm text-emerald-400 mt-2 sm:mt-3 flex items-center gap-2">
                                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                                            {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                                        </p>
                                    )}
                                </div>

                                {/* Submit Button */}
                                {scriptUrl ? (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!selectedFile || uploading}
                                        className="w-full py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                                                <span className="text-sm sm:text-base">Uploading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                                                <span className="text-sm sm:text-base">Step 3: {hasSubmitted ? 'Resubmit' : 'Submit'}</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="p-3 sm:p-4 rounded-xl bg-amber-900/20 border border-amber-500/30 text-center">
                                        <p className="text-amber-300 text-xs sm:text-sm flex items-center justify-center gap-2">
                                            <AlertTriangle className="h-4 w-4" />
                                            Faculty hasn&apos;t configured their Google Drive yet.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Submitted File Link */}
                            {hasSubmitted && submission.driveLink && (
                                <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
                                    <p className="text-emerald-300 text-xs sm:text-sm mb-2 flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" />
                                        Submitted on {new Date(submission.submittedAt).toLocaleString()}
                                    </p>
                                    <a
                                        href={submission.driveLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm flex items-center gap-2 font-medium"
                                    >
                                        <ExternalLink className="h-3 w-3 sm:h-4 w-4" />
                                        View submitted file
                                    </a>
                                </div>
                            )}
                        </div>
                    </>
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
