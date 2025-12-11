'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { Bell, LogOut, PieChart, PenTool, BookOpen, ChevronRight, Sparkles, Calendar, User, Mail, XCircle, Loader2 } from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';

export default function StudentDashboard() {
    const [student, setStudent] = useState<any>(null);
    const router = useRouter();

    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [greeting, setGreeting] = useState('');

    // Email Update State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [updatingEmail, setUpdatingEmail] = useState(false);

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) {
            router.push('/student/login');
            return;
        }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);
        fetchNotifications(parsedStudent.id || parsedStudent._id);

        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 17) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, [router]);

    const fetchNotifications = async (studentId: string) => {
        try {
            const res = await fetch(`/api/student/notifications?studentId=${studentId}`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (error) {
            console.error('Failed to fetch notifications');
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await fetch('/api/student/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId })
            });
            setNotifications(prev => prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark read');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('student');
        localStorage.removeItem('auth_token'); // Ensure token is also removed
        router.push('/student/login');
    };

    const handleUpdateEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            toast.error('Please enter a valid email');
            return;
        }

        setUpdatingEmail(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/student/profile/update-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    studentId: student._id,
                    email: newEmail
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update email');

            // Update local state
            const updatedStudent = { ...student, email: newEmail };
            setStudent(updatedStudent);
            localStorage.setItem('student', JSON.stringify(updatedStudent));

            toast.success('Email updated successfully');
            setShowEmailModal(false);
            setNewEmail('');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUpdatingEmail(false);
        }
    };

    if (!student) return null;

    const initials = student.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    const firstName = student.name.split(' ')[0];

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a] text-gray-200 font-sans overflow-x-hidden">
            {/* Animated Background - Simplified for mobile */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] left-[-30%] w-[80%] h-[80%] bg-gradient-radial from-purple-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-30%] right-[-30%] w-[80%] h-[80%] bg-gradient-radial from-blue-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
            </div>

            {/* Header - Compact */}
            <header className="sticky top-0 z-50 px-3 sm:px-6 py-3 bg-[#0a0f1a]/90 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg shadow-lg ring-2 ring-white/10">
                            {initials}
                        </div>
                        <div>
                            <p className="text-xs text-purple-300/80">{greeting} 👋</p>
                            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">{firstName}</h1>
                            <p className="text-[10px] text-gray-400 font-medium">
                                {student.department} • {student.year} Yr{Array.isArray(student.course_code) ? ` • ${student.course_code.join(', ')}` : student.course_code ? ` • ${student.course_code}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 sm:p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center"
                            >
                                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                                {unreadCount > 0 && (
                                    <>
                                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 ring-2 ring-[#0a0f1a]"></span>
                                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50 animate-bounce">
                                            {unreadCount} NEW
                                        </div>
                                    </>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-80 bg-[#12182a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                                    <div className="p-3 border-b border-white/5 flex justify-between items-center bg-[#12182a]">
                                        <h3 className="text-sm font-bold text-white">Notifications</h3>
                                        <div className="flex gap-2 items-center">
                                            {unreadCount > 0 && (
                                                <span className="text-xs bg-gradient-to-r from-pink-500 to-orange-500 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>
                                            )}
                                            {notifications.length > 0 && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const res = await fetch(`/api/student/notifications?studentId=${student._id}`, { method: 'DELETE' });
                                                            if (res.ok) {
                                                                setNotifications([]);
                                                                setUnreadCount(0);
                                                                toast.success('Notifications cleared');
                                                            }
                                                        } catch (err) {
                                                            toast.error('Failed to clear');
                                                        }
                                                    }}
                                                    className="text-[10px] text-gray-400 hover:text-white underline"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
                                        ) : (
                                            notifications.map((notif: any) => (
                                                <div
                                                    key={notif._id}
                                                    onClick={() => {
                                                        markAsRead(notif._id);
                                                        setShowNotifications(false);
                                                        if (notif.link) router.push(notif.link);
                                                    }}
                                                    className={`p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer ${!notif.isRead ? 'bg-purple-500/5' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start gap-1">
                                                        <h4 className={`text-xs ${!notif.isRead ? 'text-purple-300 font-semibold' : 'text-gray-400'}`}>{notif.message || notif.title}</h4>
                                                        {!notif.isRead && (
                                                            <span className="shrink-0 text-[8px] font-bold bg-blue-500 text-white px-1 py-0.5 rounded">NEW</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{new Date(notif.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Edit Email Button */}
                        <button
                            onClick={() => setShowEmailModal(true)}
                            className="p-2 sm:p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 transition-all ml-2"
                            title="Update Email"
                        >
                            <User className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="p-2 sm:p-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 transition-all ml-2"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Email Update Modal */}
            {showEmailModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#0f1523] border border-white/10 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
                        <button
                            onClick={() => setShowEmailModal(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white"
                        >
                            <XCircle className="h-6 w-6" />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Mail className="h-5 w-5 text-blue-400" />
                            Update Email
                        </h2>
                        <p className="text-sm text-gray-400 mb-6">
                            Current: <span className="text-blue-300">{student.email}</span>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">New Email Address</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="Enter new email"
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <button
                                onClick={handleUpdateEmail}
                                disabled={updatingEmail}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {updatingEmail ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content - Compact */}
            <main className="flex-1 w-full px-3 sm:px-6 py-4 sm:py-6 z-10">
                <div className="max-w-6xl mx-auto">
                    {/* Hero - Compact */}
                    <div className="text-center mb-4 sm:mb-8">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-xs text-purple-300 mb-3">
                            Welcome Back
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
                            Student Dashboard
                        </h2>
                    </div>

                    {/* Student Info Card - Compact */}
                    <div className="mb-4 sm:mb-6 p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-white/10">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm text-white font-bold">{student.department} • {student.year} Yr</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-6">
                                <div className="text-right">
                                    <p className="text-sm sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">{student.roll}</p>
                                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Roll</p>
                                </div>
                                <div className="text-right max-w-[150px] sm:max-w-xs">
                                    <p className="text-xs sm:text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 truncate">
                                        {Array.isArray(student.course_code) ? student.course_code.join(', ') : (student.course_code || 'N/A')}
                                    </p>
                                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase">Course{Array.isArray(student.course_code) && student.course_code.length > 1 ? 's' : ''}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Cards - 2x1 Grid Layout */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        {/* Attendance Card */}
                        <Link href="/student/attendance" className="group">
                            <div className="h-full p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-900/40 to-cyan-900/20 border border-blue-500/20 hover:border-blue-400/50 transition-all hover:scale-[1.02] flex flex-col items-center text-center">
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                                    <PieChart className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                                </div>
                                <h3 className="text-xs sm:text-lg font-bold text-white mb-0.5 sm:mb-1">Attendance</h3>
                                <p className="text-[9px] sm:text-xs text-blue-300/60 hidden sm:block">Track participation</p>
                                <div className="flex items-center gap-1 text-blue-400 text-[10px] sm:text-xs mt-1 sm:mt-3">
                                    <span className="hidden sm:inline">View</span>
                                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                                </div>
                            </div>
                        </Link>

                        {/* Assignments Card */}
                        <Link href="/student/assignments" className="group">
                            <div className="h-full p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/20 hover:border-emerald-400/50 transition-all hover:scale-[1.02] flex flex-col items-center text-center">
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                                    <PenTool className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                                </div>
                                <h3 className="text-xs sm:text-lg font-bold text-white mb-0.5 sm:mb-1">Assignments</h3>
                                <p className="text-[9px] sm:text-xs text-emerald-300/60 hidden sm:block">Submit work</p>
                                <div className="flex items-center gap-1 text-emerald-400 text-[10px] sm:text-xs mt-1 sm:mt-3">
                                    <span className="hidden sm:inline">View</span>
                                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                                </div>
                            </div>
                        </Link>

                        {/* Resources Card - Centered on second row */}
                        <div className="col-span-2 flex flex-col items-center">
                            <Link href="/student/resources" className="group w-full flex justify-center mb-4">
                                <div className="h-full w-[calc(50%-0.25rem)] p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-900/40 to-pink-900/20 border border-purple-500/20 hover:border-purple-400/50 transition-all hover:scale-[1.02] flex flex-col items-center text-center">
                                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-2 sm:mb-4 shadow-lg">
                                        <BookOpen className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
                                    </div>
                                    <h3 className="text-xs sm:text-lg font-bold text-white mb-0.5 sm:mb-1">Resources</h3>
                                    <p className="text-[9px] sm:text-xs text-purple-300/60 hidden sm:block">Study materials</p>
                                    <div className="flex items-center gap-1 text-purple-400 text-[10px] sm:text-xs mt-1 sm:mt-3">
                                        <span className="hidden sm:inline">Browse</span>
                                        <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </div>
                                </div>
                            </Link>

                            {/* PWA Install Button */}
                            <InstallPWA type="student" />
                        </div>
                    </div>
                </div>
            </main>



            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}
