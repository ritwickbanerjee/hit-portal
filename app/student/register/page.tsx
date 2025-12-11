'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, User, ArrowRight, CheckCircle, Eye, EyeOff, Sparkles, GraduationCap } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function StudentRegister() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [roll, setRoll] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const router = useRouter();

    const handleIdentify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/student/auth/register-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll, email }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

            toast.success(data.message || 'OTP sent to your email!');
            setStep(2);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/student/auth/register-complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll, email, otp, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');

            toast.success('Registration successful! Please login.');
            router.push('/student/login');
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
                <div className="absolute top-[-40%] right-[-20%] w-[80%] h-[80%] bg-gradient-radial from-emerald-900/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-[-40%] left-[-20%] w-[80%] h-[80%] bg-gradient-radial from-teal-900/30 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }}></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-400' : 'text-gray-600'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                            {step > 1 ? <CheckCircle className="h-5 w-5" /> : '1'}
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Verify</span>
                    </div>
                    <div className={`w-16 h-0.5 ${step > 1 ? 'bg-emerald-500' : 'bg-gray-700'}`}></div>
                    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-400' : 'text-gray-600'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                            2
                        </div>
                        <span className="text-sm font-medium hidden sm:inline">Complete</span>
                    </div>
                </div>

                {/* Card */}
                <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl blur-xl opacity-50"></div>
                            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-xl">
                                <GraduationCap className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-2">
                            Create Account
                        </h1>
                        <p className="text-gray-400 flex items-center justify-center gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                            {step === 1 ? 'Verify your identity' : 'Set up your password'}
                        </p>
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleIdentify} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">Roll Number</label>
                                <input
                                    type="text"
                                    required
                                    className="block w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-mono tracking-wider"
                                    placeholder="Enter your roll number"
                                    value={roll}
                                    onChange={e => setRoll(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">Institute Email</label>
                                <input
                                    type="email"
                                    required
                                    className="block w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                                    placeholder="your.email@institute.edu"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Sending OTP...
                                    </>
                                ) : (
                                    <>
                                        Get OTP
                                        <ArrowRight className="h-5 w-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleRegister} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">Enter OTP</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    className="block w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-center tracking-[0.5em] text-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                                    placeholder="• • • • • •"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                />
                                <p className="text-xs text-gray-500 text-center">Sent to {email}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        className="block w-full px-5 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                                        placeholder="Create a strong password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
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

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        className="block w-full px-5 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-5 w-5" />
                                        Complete Registration
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Links */}
                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-gray-500 text-sm">
                            Already have an account?{' '}
                            <Link href="/student/login" className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-bold hover:from-emerald-300 hover:to-teal-300 transition-all">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center mt-8 text-xs text-gray-600">
                    &copy; 2025 copyright Dept. of Mathematics, HIT • All rights reserved
                </p>
            </div>

            <style jsx>{`
                .bg-gradient-radial {
                    background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
                }
            `}</style>
        </div>
    );
}
