import Link from 'next/link';
import { BookOpen, ShieldCheck, ArrowRight } from 'lucide-react';
import LogoHero from '@/components/LogoHero';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050b14] text-gray-200 font-sans selection:bg-cyan-500 selection:text-white overflow-hidden relative">

      {/* Abstract Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[60%] bg-purple-900/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 h-screen flex flex-col items-center justify-center p-4">

        {/* Main Content Container - Compacted */}
        <div className="w-full max-w-5xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-700 ease-out">

          {/* Hero Section */}
          <div className="text-center flex flex-col items-center gap-4">
            <div className="scale-90 sm:scale-100 origin-center">
              <LogoHero />
            </div>

            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400 tracking-tight leading-tight">
                Select Your <span className="text-cyan-400">Portal</span>
              </h1>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl mt-4">

            {/* Student Portal Card */}
            <Link href="/student" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative h-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:-translate-y-2 hover:border-cyan-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-7 w-7 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Student Portal</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Access attendance, assignments & resources.
                </p>
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all">
                  Enter Portal <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* Admin Portal Card */}
            <Link href="/admin/login" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl blur opacity-20 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative h-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center hover:-translate-y-2 hover:border-emerald-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <ShieldCheck className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Admin Portal</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Manage students, attendance & question banks.
                </p>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider group-hover:gap-3 transition-all">
                  Secure Login <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-8 text-xs text-slate-500 font-medium">
            &copy; 2025 Dept. of Mathematics, HIT
          </div>
        </div>
      </div>
    </div>
  );
}
