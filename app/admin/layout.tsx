'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Users, ClipboardList, CheckSquare, FileText,
    Upload, BarChart, BookOpen, LogOut, Menu, X, GraduationCap
} from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [showGlobalAdminModal, setShowGlobalAdminModal] = useState(false);
    const [globalAdminPassword, setGlobalAdminPassword] = useState('');
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsGlobalAdmin(localStorage.getItem('globalAdminActive') === 'true');
        }
    }, []);

    useEffect(() => {
        // Safety Timeout in case logic hangs
        const timer = setTimeout(() => setLoading(false), 2000);

        const storedUser = localStorage.getItem('user');
        const sessionStart = localStorage.getItem('adminSessionStart');

        // Session duration: Use custom expiry if set (for remember me), otherwise default to 30 minutes
        const customExpiry = localStorage.getItem('admin_session_expiry');
        const SESSION_DURATION = customExpiry ? parseInt(customExpiry) : 30 * 60 * 1000;

        if (!storedUser || !sessionStart) {
            router.push('/admin/login');
        } else {
            const now = Date.now();
            if (now - parseInt(sessionStart) > SESSION_DURATION) {
                // Session expired
                localStorage.removeItem('user');
                localStorage.removeItem('adminSessionStart');
                localStorage.removeItem('admin_session_expiry');
                router.push('/admin/login');
            } else {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser.role !== 'admin') {
                        router.push('/admin/login');
                    } else {
                        setUser(parsedUser);
                    }
                } catch (e) {
                    localStorage.removeItem('user');
                    localStorage.removeItem('adminSessionStart');
                    localStorage.removeItem('admin_session_expiry');
                    router.push('/admin/login');
                }
            }
        }

        // Ensure loading is turned off quickly to allow redirect or render
        setLoading(false);

        return () => clearTimeout(timer);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('adminSessionStart');
        router.push('/admin/login');
    };

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
            localStorage.removeItem('adminSessionStart');
            // Force logout
            window.location.href = '/admin/login';
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
            setShowPasswordModal(false);
        }
    };

    const navigation = [
        { name: 'Student & Course Management', href: '/admin/dashboard', icon: Users },
        { name: 'Mark Daily Attendance', href: '/admin/attendance', icon: CheckSquare },
        { name: 'Track Attendance', href: '/admin/reports', icon: ClipboardList },
        { name: 'Question Bank', href: '/admin/questions', icon: FileText },
        { name: 'Assignments', href: '/admin/assignments', icon: Upload },
        { name: 'Submissions', href: '/admin/submissions', icon: FileText },
        { name: 'Student Marks', href: '/admin/marks', icon: BarChart },
        { name: 'Study Materials', href: '/admin/resources', icon: BookOpen },
    ];

    // Bypass auth check for login and forgot password pages
    if (pathname === '/admin/login' || pathname === '/admin/forgot-password') {
        return <>{children}</>;
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-gray-400">Loading Admin Portal...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex font-inter">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/5 transform transition-transform duration-300 ease-out md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:ml-4 md:mb-4 md:rounded-2xl md:border md:border-white/5 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
                <div className="flex flex-col h-full">
                    {/* Logo Area */}
                    <div className="flex h-20 shrink-0 items-center px-6 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className="h-14 w-14 rounded-xl bg-blue-900/20 border border-blue-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                <GraduationCap className="h-8 w-8 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            </div>
                            <div className="flex flex-col justify-center h-14 py-2">
                                <span className="text-xl font-bold text-white tracking-tight block leading-tight mb-1">Admin<span className="text-indigo-400">Portal</span></span>
                                <div className="text-left">
                                    <span className="text-[10px] text-slate-500 font-medium tracking-wide opacity-80 block leading-tight">
                                        Developed by
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold tracking-wide block leading-tight">
                                        Dr. Ritwick Banerjee
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <button
                                        onClick={() => {
                                            if (isGlobalAdmin) {
                                                localStorage.removeItem('globalAdminActive');
                                                setIsGlobalAdmin(false);
                                            } else {
                                                setShowGlobalAdminModal(true);
                                            }
                                        }}
                                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded border transition-all ${isGlobalAdmin
                                            ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:bg-red-500/30'
                                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300 hover:border-slate-600'
                                            }`}
                                    >
                                        {isGlobalAdmin ? '● GLOBAL ADMIN' : 'GLOBAL ADMIN'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
                            <X className="h-6 w-6 text-slate-400 hover:text-white transition-colors" />
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (

                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center gap-x-3 rounded-lg p-3 text-sm font-medium transition-all duration-200 relative ${isActive
                                        ? 'light-beam-border text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                                        }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    {/* Background overlay for active state to ensure text readability over the beam */}
                                    {isActive && <div className="absolute inset-[1px] bg-slate-900/90 rounded-[inherit] z-[-1]" />}

                                    <item.icon className={`h-5 w-5 shrink-0 transition-colors z-10 ${isActive ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                    <span className="z-10">{item.name}</span>
                                </Link>
                            );

                        })}
                    </nav>

                    <div className="p-4 border-t border-white/5 bg-slate-900/50 block md:hidden">
                        <div className="flex items-center gap-3 px-2 mb-4">
                            <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
                                {user.name?.[0] || 'A'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="group flex w-full items-center gap-x-3 rounded-lg p-2 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                            <LogOut className="h-5 w-5 shrink-0 transition-colors group-hover:text-red-400" />
                            Sign out
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Pattern */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)' }}></div>

                {/* Mobile Header */}
                <div className="md:hidden flex items-center justify-between bg-slate-900/80 backdrop-blur-md p-4 border-b border-white/5 sticky top-0 z-20">
                    <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
                        <Menu className="h-6 w-6" />
                    </button>
                    <span className="text-lg font-bold text-white">Admin<span className="text-indigo-400">Portal</span></span>
                    {pathname === '/admin/attendance' ? <InstallPWA type="admin" /> : <div className="w-6" />}
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 scroll-smooth">
                    {/* Global Header */}
                    <div className="hidden md:flex justify-between items-center mb-8">
                        <div>
                            <div className="flex items-center gap-4">
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                    {navigation.find(n => n.href === pathname)?.name || 'Admin Portal'}
                                </h1>
                                {pathname === '/admin/attendance' && <InstallPWA type="admin" />}
                            </div>
                            <p className="text-slate-400 text-sm mt-1">
                                {pathname === '/admin/dashboard' && ''}
                                {pathname === '/admin/reports' && 'Manage attendance and generate detailed reports'}
                                {pathname === '/admin/attendance' && 'Mark daily attendance for students'}
                                {pathname === '/admin/questions' && 'Manage question bank'}
                                {pathname === '/admin/assignments' && 'Manage assignments'}
                                {pathname === '/admin/submissions' && 'View and grade submissions'}
                                {pathname === '/admin/marks' && 'View student marks'}
                                {pathname === '/admin/resources' && 'Manage study materials'}
                            </p>
                        </div>
                        <div className="relative group z-50">
                            <button className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-white/5 hover:bg-slate-800/50 transition-colors">
                                <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30">
                                    {user.name?.[0] || 'A'}
                                </div>
                                <div className="text-left hidden sm:block">
                                    <span className="text-slate-300 text-sm font-medium block leading-tight">{user.name}</span>
                                    <span className="text-[10px] text-slate-500 block leading-tight">Admin</span>
                                </div>
                            </button>

                            {/* Dropdown */}
                            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-slate-900 border border-white/10 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform z-50">
                                <div className="p-3 border-b border-white/5">
                                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                </div>
                                <div className="p-1">
                                    <button
                                        onClick={() => setShowPasswordModal(true)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                        <div className="h-4 w-4 text-slate-400"><FileText className="h-4 w-4" /></div> {/* Reusing FileText as placeholder if Key not imported, but will add Key import */}
                                        Change Password
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {children}
                </main>

                {/* Change Password Modal (Global) */}
                {showPasswordModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-md p-8 shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500"></div>
                            <h3 className="text-xl font-bold text-white mb-6">Change Password</h3>
                            <form onSubmit={handleChangePassword} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Password</label>
                                    <input
                                        type="password" required
                                        className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        value={passwordForm.current}
                                        onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                                    <input
                                        type="password" required
                                        className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        value={passwordForm.new}
                                        onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                                    <input
                                        type="password" required
                                        className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2.5 px-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                        value={passwordForm.confirm}
                                        onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-4 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordModal(false)}
                                        className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors border border-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:shadow-none"
                                    >
                                        {loading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
