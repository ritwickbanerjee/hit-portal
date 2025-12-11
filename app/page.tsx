import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050b14] text-gray-200 font-sans selection:bg-cyan-500 selection:text-white overflow-hidden relative">

      {/* Abstract Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[20%] -right-[10%] w-[40%] h-[60%] bg-purple-900/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">

        {/* Main Content Container */}
        <div className="w-full max-w-5xl flex flex-col items-center gap-8 sm:gap-12 animate-in fade-in zoom-in duration-700 ease-out">

          {/* Hero Section */}
          <div className="text-center flex flex-col items-center gap-6">
            <div className="relative w-full max-w-md mx-auto h-48 sm:h-64 md:h-80 flex items-center justify-center mb-4">
              {/* Glowing effect behind image */}
              <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] rounded-full scale-75 animate-pulse"></div>
              <Image
                src="/hero-glow.png"
                alt="Portal Gateway"
                width={500}
                height={500}
                className="object-contain w-full h-full drop-shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:scale-105 transition-transform duration-500"
                priority
              />
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 text-sm font-medium backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <Sparkles className="h-4 w-4" />
                <span>Welcome to the Future of Learning</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400 tracking-tight leading-tight">
                Select Your <span className="text-cyan-400">Portal</span>
              </h1>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                Access your personalized dashboard with seamless efficiency. Choose your gateway below to get started.
              </p>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mt-4">

            {/* Student Portal Card */}
            <Link href="/student" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative h-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center hover:-translate-y-2 hover:border-cyan-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-8 w-8 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Student Portal</h3>
                <p className="text-slate-400 text-sm mb-6 flex-grow">
                  Access attendance records, submit assignments, and view resources.
                </p>
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm group-hover:gap-3 transition-all">
                  Enter Portal <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>

            {/* Admin Portal Card */}
            <Link href="/admin/login" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl blur opacity-20 group-hover:opacity-60 transition-opacity duration-500"></div>
              <div className="relative h-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center hover:-translate-y-2 hover:border-emerald-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <ShieldCheck className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Admin Portal</h3>
                <p className="text-slate-400 text-sm mb-6 flex-grow">
                  Manage students, attendance, question banks, and portal settings.
                </p>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm group-hover:gap-3 transition-all">
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
