'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Auto-fill saved credentials on mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('admin_saved_email');
        const savedRemember = localStorage.getItem('admin_remember_me');

        if (savedEmail && savedRemember === 'true') {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (data.user.role !== 'admin') {
                throw new Error('You are not authorized as an admin.');
            }

            // Store user in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('adminSessionStart', Date.now().toString());

            // Handle "Remember Me" functionality
            if (rememberMe) {
                localStorage.setItem('admin_saved_email', email.trim());
                localStorage.setItem('admin_remember_me', 'true');
                // For remembered sessions, extend expiry to 30 days
                localStorage.setItem('admin_session_expiry', (30 * 24 * 60 * 60 * 1000).toString());
            } else {
                localStorage.removeItem('admin_saved_email');
                localStorage.removeItem('admin_remember_me');
                // For non-remembered sessions, use 30 minutes
                localStorage.setItem('admin_session_expiry', (30 * 60 * 1000).toString());
            }

            // Force hard navigation to resolve potential freeze/infinite loading issues
            window.location.href = '/admin/dashboard';
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#050b14] text-gray-200 relative overflow-hidden">

            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-900/20 rounded-full blur-[120px] animate-pulse"></div>
            </div>

            <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-4 ring-1 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        <ShieldCheck className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-teal-400">
                        Admin Portal
                    </h2>
                    <p className="text-slate-400 text-sm mt-2">Sign in to manage the platform</p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-black/40 pl-10 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                                    Password
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-white transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                                Remember me for 30 days
                            </label>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <Link href="/" className="text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                                ← Back
                            </Link>
                            <Link href="/admin/forgot-password" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-emerald-900/40 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4" /></span>
                            )}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                        <ShieldCheck className="h-3 w-3" /> Secure Admin Access
                    </p>
                </div>

            </div>
        </div>
    );
}
