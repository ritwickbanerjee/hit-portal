'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Users, ClipboardList, CheckSquare, FileText,
    Upload, BarChart, BookOpen, LogOut, Menu, X, GraduationCap, Laptop, CalendarDays, LayoutGrid, Sparkles, ClipboardCheck, Building2, Shield, Trash2, UserPlus, Copy, Check
} from 'lucide-react';
import InstallPWA from '@/components/InstallPWA';
import ActiveDeploymentToggle from '@/components/ActiveDeploymentToggle';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [routineMakerAccess, setRoutineMakerAccess] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [showGlobalAdminModal, setShowGlobalAdminModal] = useState(false);
    const [globalAdminPassword, setGlobalAdminPassword] = useState('');
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    // Welcome Notification State
    const [showWelcomeNotification, setShowWelcomeNotification] = useState(false);

    // Admin list management
    const [showAdminListModal, setShowAdminListModal] = useState(false);
    const [adminList, setAdminList] = useState<any[]>([]);
    const [adminListLoading, setAdminListLoading] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminName, setNewAdminName] = useState('');
    const [addingAdmin, setAddingAdmin] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [copiedPwd, setCopiedPwd] = useState(false);
    const [adminListError, setAdminListError] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsGlobalAdmin(localStorage.getItem('globalAdminActive') === 'true');
            if (!localStorage.getItem('adminWelcomeNotificationSeen')) {
                setShowWelcomeNotification(true);
            }
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

    const getAuthHeaders = () => {
        const token = localStorage.getItem('auth_token');
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) h['Authorization'] = `Bearer ${token}`;
        if (user?.email) h['X-User-Email'] = user.email;
        return h;
    };

    const fetchAdmins = async () => {
        setAdminListLoading(true);
        setAdminListError('');
        try {
            const res = await fetch('/api/admin/manage-admins', { headers: getAuthHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch admins');
            setAdminList(data.admins);
        } catch (e: any) {
            setAdminListError(e.message);
        } finally {
            setAdminListLoading(false);
        }
    };

    const handleAddAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingAdmin(true);
        setAdminListError('');
        setTempPassword(null);
        try {
            const res = await fetch('/api/admin/manage-admins', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ email: newAdminEmail, name: newAdminName }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create admin');
            setTempPassword(data.tempPassword);
            setNewAdminEmail('');
            setNewAdminName('');
            fetchAdmins();
        } catch (e: any) {
            setAdminListError(e.message);
        } finally {
            setAddingAdmin(false);
        }
    };

    const handleDeleteAdmin = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete admin "${name}"? They will immediately lose login access.`)) return;
        try {
            const res = await fetch('/api/admin/manage-admins', {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete admin');
            fetchAdmins();
        } catch (e: any) {
            setAdminListError(e.message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedPwd(true);
        setTimeout(() => setCopiedPwd(false), 2000);
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

    const handleGlobalAdminSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (globalAdminPassword.trim() === 'globaladmin_25') {
            localStorage.setItem('globalAdminActive', 'true');
            setShowGlobalAdminModal(false);
            setGlobalAdminPassword('');
            window.location.reload(); // Reload to apply global admin powers
        } else {
            alert('Invalid Password');
        }
    };

    const handleDismissWelcome = () => {
        localStorage.setItem('adminWelcomeNotificationSeen', 'true');
        setShowWelcomeNotification(false);
    };

    // Check routine maker access
    useEffect(() => {
        if (user?.email) {
            const headers: any = {};
            if (user.email) headers['X-User-Email'] = user.email;
            const isGA = typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true';
            if (isGA) headers['X-Global-Admin-Key'] = 'globaladmin_25';
            fetch('/api/admin/routine-maker/access?check=true', { headers })
                .then(r => r.json())
                .then(data => { if (data.hasAccess) setRoutineMakerAccess(true); })
                .catch(() => {});
        }
    }, [user]);

    // Explicitly authorize specific users for HIT Routine access based on their email
    const HIT_ROUTINE_EMAILS = [
        'ritwick92@gmail.com',
        'dipankar.chakraborty@heritageit.edu',
        'sandip.chatterjee@heritageit.edu'
    ];
    const hasHitRoutineAccess = user?.email && HIT_ROUTINE_EMAILS.includes(user.email.toLowerCase());

    const navigation = [
        { name: 'Student & Course Management', href: '/admin/dashboard', icon: Users },
        { name: 'Mark Daily Attendance', href: '/admin/attendance', icon: CheckSquare },
        { name: 'Track Attendance', href: '/admin/reports', icon: ClipboardList },
        { name: 'My Routine', href: '/admin/routine', icon: CalendarDays },
        ...(routineMakerAccess ? [{ name: 'Routine Maker', href: '/admin/routine-maker', icon: LayoutGrid }] : []),
        ...(hasHitRoutineAccess ? [{ name: 'HIT Routine', href: '/admin/hit-routine', icon: Building2 }] : []),
        { name: 'Question Bank', href: '/admin/questions', icon: FileText },
        { name: 'Assignments', href: '/admin/assignments', icon: Upload },
        { name: 'Assignment Submissions', href: '/admin/submissions', icon: FileText },
        { name: 'Online Test', href: '/admin/online-test', icon: Laptop },
        { name: 'Study Materials', href: '/admin/resources', icon: BookOpen },
        { name: 'The Magic PPT', href: '/admin/magic-ppt', icon: Sparkles },
        { name: 'Uploading Marks in ERP', href: '/admin/erp-marks', icon: ClipboardCheck },
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
            <div id="admin-sidebar" className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/95 backdrop-blur-xl border-r border-white/5 transform transition-transform duration-300 ease-out md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:ml-4 md:mb-4 md:rounded-2xl md:border md:border-white/5 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full shadow-2xl'} ${pathname === '/admin/routine-maker' || pathname === '/admin/magic-ppt' ? 'hidden' : ''}`}>
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
                            </div>
                        </div>
                        <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
                            <X className="h-6 w-6 text-slate-400 hover:text-white transition-colors" />
                        </button>
                    </div>

                    {/* Global Admin - Separate Section */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <button
                            onClick={() => {
                                const isGA = localStorage.getItem('globalAdminActive') === 'true';
                                if (isGA) {
                                    localStorage.removeItem('globalAdminActive');
                                    window.location.reload();
                                } else {
                                    setShowGlobalAdminModal(true);
                                }
                            }}
                            className={`w-full text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border transition-all ${(typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true')
                                ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:bg-red-500/30'
                                : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                                }`}
                        >
                            {(typeof window !== 'undefined' && localStorage.getItem('globalAdminActive') === 'true') ? '● GLOBAL ADMIN' : 'GLOBAL ADMIN'}
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

                <main className={`flex-1 overflow-y-auto relative z-10 scroll-smooth ${pathname === '/admin/magic-ppt' ? 'p-0' : 'p-4 md:p-8'}`}>
                    {/* Global Header */}
                    <div className={`${pathname === '/admin/magic-ppt' ? 'hidden' : 'hidden md:flex'} justify-between items-center mb-8`}>
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
                                {pathname === '/admin/routine' && 'View your individual teaching schedule'}
                                {pathname === '/admin/attendance' && 'Mark daily attendance for students'}
                                {pathname === '/admin/questions' && 'Manage question bank'}
                                {pathname === '/admin/assignments' && 'Manage assignments'}
                                {pathname === '/admin/submissions' && 'View submissions and student marks'}
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
                                {user.email === 'ritwick92@gmail.com' && (
                                    <div className="p-1 border-b border-white/5">
                                        <ActiveDeploymentToggle userEmail={user.email} />
                                    </div>
                                )}
                                {user.email === 'ritwick92@gmail.com' && (
                                    <div className="p-1 border-b border-white/5">
                                        <button
                                            onClick={() => { setShowAdminListModal(true); fetchAdmins(); setTempPassword(null); setAdminListError(''); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors"
                                        >
                                            <Shield className="h-4 w-4" />
                                            Manage Admin List
                                        </button>
                                    </div>
                                )}
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

                {/* Admin List Modal */}
                {showAdminListModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-900 rounded-2xl border border-indigo-500/20 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl shadow-indigo-500/10 flex flex-col relative">
                            {/* Top accent */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 pt-7 pb-4 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                        <Shield className="h-5 w-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Admin Management</h3>
                                        <p className="text-xs text-slate-500">Manage who can log in as admin</p>
                                    </div>
                                </div>
                                <button onClick={() => { setShowAdminListModal(false); setTempPassword(null); setAdminListError(''); }} className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Add new admin form */}
                                <div className="bg-slate-800/50 rounded-xl border border-white/5 p-5">
                                    <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><UserPlus className="h-4 w-4 text-indigo-400" /> Add New Admin</h4>
                                    <form onSubmit={handleAddAdmin} className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Full Name</label>
                                                <input
                                                    type="text" required placeholder="e.g. Dr. Rahul Sharma"
                                                    value={newAdminName}
                                                    onChange={e => setNewAdminName(e.target.value)}
                                                    className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Email Address</label>
                                                <input
                                                    type="email" required placeholder="e.g. admin@heritageit.edu"
                                                    value={newAdminEmail}
                                                    onChange={e => setNewAdminEmail(e.target.value)}
                                                    className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit" disabled={addingAdmin}
                                            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                                        >
                                            {addingAdmin ? 'Creating...' : 'Create Admin Account'}
                                        </button>
                                    </form>

                                    {/* Temp password display */}
                                    {tempPassword && (
                                        <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                                            <p className="text-xs text-emerald-400 font-semibold mb-2">✓ Admin created! Share this temporary password with them:</p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 bg-slate-950/60 text-emerald-300 font-mono text-sm px-3 py-2 rounded-lg border border-emerald-500/20">{tempPassword}</code>
                                                <button onClick={() => copyToClipboard(tempPassword)} className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                                    {copiedPwd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">The admin must use "Forgot Password" to set a permanent password on their first login.</p>
                                        </div>
                                    )}

                                    {adminListError && (
                                        <div className="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">{adminListError}</div>
                                    )}
                                </div>

                                {/* Admin list */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" /> Current Admins ({adminList.length})</h4>
                                    {adminListLoading ? (
                                        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" /></div>
                                    ) : (
                                        <div className="space-y-2">
                                            {adminList.map(admin => (
                                                <div key={admin._id} className={`flex items-center gap-3 p-3 rounded-xl border ${admin.email === 'ritwick92@gmail.com' ? 'bg-indigo-950/20 border-indigo-500/20' : 'bg-slate-800/30 border-white/5'} transition-all`}>
                                                    <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm border ${admin.email === 'ritwick92@gmail.com' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600/30'}`}>
                                                        {admin.name?.[0]?.toUpperCase() || 'A'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">{admin.name}</p>
                                                        <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                                                    </div>
                                                    {admin.email === 'ritwick92@gmail.com' ? (
                                                        <span className="text-xs text-indigo-400 font-semibold px-2 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">Super Admin</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDeleteAdmin(admin._id, admin.name)}
                                                            className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                                                            title="Remove admin access"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

                {/* Global Admin Password Modal */}
                {showGlobalAdminModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/20 max-w-md w-full">
                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-400 mb-6">Global Admin Access</h3>
                                <form onSubmit={handleGlobalAdminSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-400 mb-2">Enter Global Admin Password</label>
                                        <input
                                            type="password"
                                            required
                                            autoFocus
                                            className="w-full rounded-lg border border-red-500/30 bg-slate-950/70 py-3 px-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                                            value={globalAdminPassword}
                                            onChange={e => setGlobalAdminPassword(e.target.value)}
                                            placeholder="Enter password"
                                        />
                                    </div>
                                    <div className="flex gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => { setShowGlobalAdminModal(false); setGlobalAdminPassword(''); }}
                                            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors border border-white/5"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white rounded-lg font-bold shadow-lg shadow-red-500/25 transition-all"
                                        >
                                            Activate
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Welcome Notification Modal */}
                {showWelcomeNotification && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                        <div className="bg-slate-900 rounded-3xl border border-indigo-500/30 w-full max-w-2xl shadow-[0_0_50px_rgba(99,102,241,0.15)] relative overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Decorative background accents */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                            
                            {/* Scrollable content area */}
                            <div className="relative z-10 overflow-y-auto flex-1 p-8 pb-4">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                                        <Sparkles className="h-8 w-8 text-indigo-400" />
                                    </div>
                                    <h3 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                                        Welcome to the new portal updates!
                                    </h3>
                                </div>
                                
                                <div className="space-y-4 text-slate-300">
                                    <div className="flex gap-4 p-4 rounded-xl bg-slate-950/50 border border-white/5 hover:border-indigo-500/30 transition-colors">
                                        <div className="shrink-0 mt-1"><Laptop className="h-5 w-5 text-indigo-400" /></div>
                                        <div>
                                            <p className="font-semibold text-white mb-1">Install as an App</p>
                                            <p className="text-sm text-slate-400 leading-relaxed">You can save this portal on your phone just like an App! Simply go to the <span className="text-indigo-300 font-medium">Mark Daily Attendance</span> page from your mobile browser and click the <span className="font-bold text-white">"Install App"</span> button.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 p-4 rounded-xl bg-slate-950/50 border border-white/5 hover:border-violet-500/30 transition-colors">
                                        <div className="shrink-0 mt-1"><CalendarDays className="h-5 w-5 text-violet-400" /></div>
                                        <div>
                                            <p className="font-semibold text-white mb-1">My Routine & CR Contacts</p>
                                            <p className="text-sm text-slate-400 leading-relaxed">Your class routines are visible in the <span className="text-violet-300 font-medium">"My Routine"</span> tab. If you click on any class, you can easily save the phone number of the CR for that class to access it anytime.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 p-4 rounded-xl bg-slate-950/50 border border-white/5 hover:border-emerald-500/30 transition-colors">
                                        <div className="shrink-0 mt-1"><CheckSquare className="h-5 w-5 text-emerald-400" /></div>
                                        <div>
                                            <p className="font-semibold text-white mb-1">Multi-Select Departments for Attendance</p>
                                            <p className="text-sm text-slate-400 leading-relaxed">You can now multi-select departments while marking attendance in one go! This saves time and increases convenience, especially when taking open electives across different departments.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 p-4 rounded-xl bg-slate-950/50 border border-white/5 hover:border-pink-500/30 transition-colors">
                                        <div className="shrink-0 mt-1"><Sparkles className="h-5 w-5 text-pink-400" /></div>
                                        <div>
                                            <p className="font-semibold text-white mb-1">Magic PPT Generator</p>
                                            <p className="text-sm text-slate-400 leading-relaxed">Check out the new <span className="text-pink-300 font-medium">Magic PPT</span> button. You can use this AI-powered feature to create visually attractive course content in minutes!</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* OK button — always visible, never scrolls away */}
                            <div className="relative z-10 p-6 pt-4 border-t border-white/5">
                                <button
                                    onClick={handleDismissWelcome}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    Ok Great!
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
