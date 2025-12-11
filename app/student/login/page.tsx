'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock, ArrowRight, GraduationCap, Sparkles, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StudentLogin() {
    const [formData, setFormData] = useState({
        roll: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/student/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roll: formData.roll,
                    password: formData.password
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }
            localStorage.setItem('student', JSON.stringify(data.user));
            toast.success('Welcome back! 🚀');
            router.push('/student');
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0f1a] text-gray-200 px-4 relative overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-40%] left-[-20%] w-[80%] h-[80%] bg-gradient-radial from-purple-900/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-[-40%] right-[-20%] w-[80%] h-[80%] bg-gradient-radial from-blue-900/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-pink-900/10 via-transparent to-transparent rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Card */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50"></div>
                            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center shadow-xl">
                                <GraduationCap className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 mb-2">
                            Student Portal
                        </h1>
                        <p className="text-gray-400 flex items-center justify-center gap-2">
                            Sign in to continue
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Roll Number */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Roll Number</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    name="roll"
                                    required
                                    value={formData.roll}
                                    onChange={handleChange}
                                    className="block w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all font-mono tracking-wider"
                                    placeholder="Enter your roll number"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="block w-full px-5 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Links */}
                    <div className="mt-8 space-y-4 text-center">
                        <Link
                            href="/student/forgot-password"
                            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            Forgot your password?
                        </Link>

                        <div className="pt-4 border-t border-white/5">
                            <p className="text-gray-500 text-sm">
                                New student?{' '}
                                <Link href="/student/register" className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-bold hover:from-purple-300 hover:to-pink-300 transition-all">
                                    Create an account
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                
            </div>

            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}
