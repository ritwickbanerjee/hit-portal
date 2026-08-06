'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ExternalLink, Loader2, FileText, Video, Brain, Zap, Play, User, ChevronRight, Folder, Code, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Expired';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function HtmlCountdown({ deadline }: { deadline: string }) {
    const [remaining, setRemaining] = useState(() => new Date(deadline).getTime() - Date.now());
    useEffect(() => {
        const timer = setInterval(() => setRemaining(new Date(deadline).getTime() - Date.now()), 1000);
        return () => clearInterval(timer);
    }, [deadline]);
    const expired = remaining <= 0;
    return (
        <div className={`flex items-center gap-1 text-[10px] font-mono font-bold mt-1 ${expired ? 'text-red-400' : remaining < 3600000 ? 'text-amber-400' : 'text-emerald-400'}`}>
            <Clock className="h-3 w-3 shrink-0" />
            {expired ? 'Expired' : `Closes in ${formatCountdown(remaining)}`}
        </div>
    );
}

export default function StudentResources() {
    const [student, setStudent] = useState<any>(null);
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCourse, setActiveCourse] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'dashboard' | 'materials' | 'videos' | 'practice' | 'mock'>('dashboard');
    const [submittedHtmlIds, setSubmittedHtmlIds] = useState<Set<string>>(new Set());
    const checkedHtmlIds = React.useRef<Set<string>>(new Set());
    const router = useRouter();

    useEffect(() => {
        const storedStudent = localStorage.getItem('student');
        if (!storedStudent) { router.push('/student/login'); return; }
        const parsedStudent = JSON.parse(storedStudent);
        setStudent(parsedStudent);
        if (!parsedStudent.department || !parsedStudent.year) {
            toast.error('Session data missing. Please log in again.');
            localStorage.removeItem('student');
            router.push('/student/login');
            return;
        }
        fetchResources(parsedStudent.department, parsedStudent.year, parsedStudent.course_code);
    }, [router]);

    const fetchResources = async (dept: string, year: string, courseCode?: string | string[]) => {
        try {
            const params = new URLSearchParams({ department: dept, year: year });
            if (courseCode) params.append('course_code', Array.isArray(courseCode) ? courseCode.join(',') : courseCode);
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/student/resources?${params.toString()}`, {
                credentials: 'include',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setResources(await res.json());
            else toast.error('Failed to fetch resources');
        } catch { toast.error('Something went wrong'); }
        finally { setLoading(false); }
    };

    // When resources load, check submission status for all HTML resources
    useEffect(() => {
        if (!student?._id || resources.length === 0) return;
        const htmlResources = resources.filter((r: any) => r.type === 'html_content');
        htmlResources.forEach(async (r: any) => {
            if (checkedHtmlIds.current.has(r._id)) return;
            checkedHtmlIds.current.add(r._id);
            try {
                const res = await fetch(`/api/student/html-submissions?studentId=${student._id}&resourceId=${r._id}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.submitted) {
                        setSubmittedHtmlIds(prev => new Set([...prev, r._id]));
                    }
                }
            } catch { /* silent */ }
        });
    }, [student, resources]);

    const checkAndMarkSubmitted = async (resourceId: string) => {
        if (!student?._id) return;
        try {
            const res = await fetch(`/api/student/html-submissions?studentId=${student._id}&resourceId=${resourceId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.submitted) {
                    setSubmittedHtmlIds(prev => new Set([...prev, resourceId]));
                }
            }
        } catch { /* silent */ }
    };

    const courses = useMemo(() => {
        const courseSet = new Set<string>();
        resources.forEach(r => { const c = r.targetCourse || r.course_code; if (c) courseSet.add(c); });
        return Array.from(courseSet).sort();
    }, [resources]);

    useEffect(() => { if (courses.length > 0 && activeCourse === null) setActiveCourse(courses[0]); }, [courses, activeCourse]);

    const getResourcesByType = (type: string) => {
        if (!activeCourse) return [];
        return resources.filter(r => {
            const course = r.targetCourse || r.course_code;
            const matchesCourse = course === activeCourse;
            if (type === 'materials') return matchesCourse && (r.type === 'pdf' || r.type === 'study_material' || r.type === 'html_content');
            if (type === 'videos') return matchesCourse && (r.type === 'video' || r.type === 'video_resource');
            if (type === 'practice') return matchesCourse && (r.type === 'practice' || r.type === 'hints' || r.type === 'practice_questions' || r.type === 'practice_questions_hints');
            return false;
        });
    };

    const openHtmlResource = (resource: any) => {
        if (!resource.htmlContent) return;

        // Build the portal SDK script to inject — gives the HTML tab
        // everything it needs to record the submission directly, even
        // if this portal tab is later closed.
        const apiBase = window.location.origin;
        const isAlreadySubmitted = submittedHtmlIds.has(resource._id);
        const portalContext = {
            studentId:         student?._id || '',
            studentName:       student?.name || '',
            studentRoll:       student?.roll || '',
            studentEmail:      student?.email || '',
            studentDepartment: student?.department || '',
            studentYear:       student?.year || '',
            resourceId:        resource._id || '',
            alreadySubmitted:  isAlreadySubmitted,
            apiBase
        };

        const sdkScript = `
<script>
(function() {
  window.__PORTAL__ = ${JSON.stringify(portalContext)};

  // If already submitted, block all submit actions in the HTML
  if (window.__PORTAL__.alreadySubmitted) {
    document.addEventListener('submit', function(e) { e.preventDefault(); alert('You have already submitted this assignment.'); }, true);
    document.addEventListener('click', function(e) {
      var el = e.target && (e.target.closest ? e.target.closest('[type="submit"],[data-submit],[data-portal-submit]') : null);
      if (el) { e.preventDefault(); alert('You have already submitted this assignment.'); }
    }, true);
    return;
  }

  var submitted = false;

  function portalSubmit() {
    if (submitted) return;
    var p = window.__PORTAL__;
    if (!p || !p.studentId || !p.resourceId) return;
    submitted = true;

    fetch(p.apiBase + '/api/student/html-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId:         p.studentId,
        studentName:       p.studentName,
        studentRoll:       p.studentRoll,
        studentEmail:      p.studentEmail,
        studentDepartment: p.studentDepartment,
        studentYear:       p.studentYear,
        resourceId:        p.resourceId
      })
    })
    .then(function(r) {
      if (r.status === 409) {
        alert('You have already submitted this assignment.');
        return;
      }
      if (r.ok) {
        if (window.opener) {
          window.opener.postMessage({ type: 'HIT_PORTAL_HTML_SUBMITTED', resourceId: p.resourceId }, p.apiBase);
        }
      }
    })
    .catch(function() {
      submitted = false;
    });
  }

  document.addEventListener('submit', function(e) { portalSubmit(); }, true);
  document.addEventListener('click', function(e) {
    var el = e.target && (e.target.closest ? e.target.closest('[type="submit"],[data-submit],[data-portal-submit]') : null);
    if (el) portalSubmit();
  }, true);
})();
<\/script>`;

        // Inject SDK just before </body> (or at end if no </body>)
        let html = resource.htmlContent;
        if (html.includes('</body>')) {
            html = html.replace('</body>', sdkScript + '</body>');
        } else {
            html = html + sdkScript;
        }

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const newTab = window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 15000);

        // Listen for the submission signal if portal tab stays open
        const messageHandler = (event: MessageEvent) => {
            if (event.origin !== apiBase) return;
            if (event.data?.type === 'HIT_PORTAL_HTML_SUBMITTED' && event.data?.resourceId === resource._id) {
                setSubmittedHtmlIds(prev => new Set([...prev, resource._id]));
                window.removeEventListener('message', messageHandler);
            }
        };
        window.addEventListener('message', messageHandler);

        // Also poll once after a delay to catch the case where user submitted then returned
        setTimeout(() => checkAndMarkSubmitted(resource._id), 5000);
    };

    const materialsCount = getResourcesByType('materials').length;
    const videosCount = getResourcesByType('videos').length;
    const practiceCount = getResourcesByType('practice').length;

    if (!student) return null;

    const categories = [
        { id: 'materials', label: 'Materials', icon: FileText, count: materialsCount, gradient: 'from-blue-500 to-cyan-500' },
        { id: 'videos', label: 'Videos', icon: Video, count: videosCount, gradient: 'from-rose-500 to-pink-500' },
        { id: 'practice', label: 'Practice', icon: Brain, count: practiceCount, gradient: 'from-purple-500 to-violet-500' },
        { id: 'mock', label: 'Mock Test', icon: Zap, count: 0, gradient: 'from-emerald-500 to-teal-500' },
    ];

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-gray-200 font-sans">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-30%] right-[-20%] w-[60%] h-[60%] bg-gradient-radial from-purple-900/20 via-transparent to-transparent rounded-full blur-3xl"></div>
            </div>
            <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
                <div className="flex items-center gap-3 mb-4">
                    <Link href="/student" className="p-2 sm:p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Resources</h1>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-purple-500" /></div>
                ) : courses.length === 0 ? (
                    <div className="text-center py-16">
                        <BookOpen className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500">No resources found</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {courses.map(course => (
                                <button key={course} onClick={() => { setActiveCourse(course); setActiveView('dashboard'); }}
                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeCourse === course ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                    {course}
                                </button>
                            ))}
                        </div>

                        {activeView === 'dashboard' && (
                            <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                {categories.map((cat) => (
                                    <button key={cat.id} onClick={() => setActiveView(cat.id as any)}
                                        className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800/60 to-gray-900/40 border border-white/10 hover:border-white/20 transition-all text-left">
                                        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                            <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-gradient-to-br ${cat.gradient}`}>
                                                <cat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                                            </div>
                                            {cat.id !== 'mock' && <span className="text-lg sm:text-2xl font-black text-white">{cat.count}</span>}
                                        </div>
                                        <h3 className="text-xs sm:text-sm font-bold text-white">{cat.label}</h3>
                                        <div className="flex items-center gap-1 text-gray-500 text-[10px] sm:text-xs mt-1">
                                            <span className="hidden sm:inline">Browse</span>
                                            <ChevronRight className="h-3 w-3" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeView !== 'dashboard' && activeView !== 'mock' && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActiveView('dashboard')} className="p-2 rounded-lg bg-white/5 text-gray-400">
                                        <ArrowLeft className="h-4 w-4" />
                                    </button>
                                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                        {activeView === 'materials' && <><FileText className="h-4 w-4 text-blue-400" /> Materials</>}
                                        {activeView === 'videos' && <><Video className="h-4 w-4 text-rose-400" /> Videos</>}
                                        {activeView === 'practice' && <><Brain className="h-4 w-4 text-purple-400" /> Practice</>}
                                    </h2>
                                </div>

                                {getResourcesByType(activeView).length === 0 ? (
                                    <div className="text-center py-10 rounded-xl bg-white/5 border border-white/10">
                                        <Folder className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">No {activeView} found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {getResourcesByType(activeView).map((resource) => {
                                            if (resource.questions && resource.questions.length > 0) {
                                                return (
                                                    <Link key={resource._id} href={`/student/resources/${resource._id}`}
                                                        className="block p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-lg shrink-0 bg-purple-500/20"><Brain className="h-4 w-4 text-purple-400" /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm font-bold text-white truncate">{resource.title}</h3>
                                                                {resource.facultyName && <p className="text-[10px] text-gray-500 flex items-center gap-1"><User className="h-3 w-3" /> {resource.facultyName}</p>}
                                                            </div>
                                                            <ChevronRight className="h-5 w-5 text-purple-400 shrink-0" />
                                                        </div>
                                                    </Link>
                                                );
                                            }

                                            if (resource.type === 'html_content') {
                                                const isExpired = resource.htmlDeadline && new Date(resource.htmlDeadline) < new Date();
                                                const isSubmitted = submittedHtmlIds.has(resource._id);



                                                return (
                                                    <div key={resource._id}
                                                        className={`p-3 sm:p-4 rounded-xl border transition-all ${
                                                            isSubmitted ? 'bg-emerald-950/20 border-emerald-500/30' :
                                                            isExpired   ? 'bg-red-950/20 border-red-500/20' :
                                                                          'bg-white/5 border-white/10'
                                                        }`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg shrink-0 ${
                                                                isSubmitted ? 'bg-emerald-500/20' :
                                                                isExpired   ? 'bg-red-500/20' :
                                                                              'bg-emerald-500/20'
                                                            }`}>
                                                                <Code className={`h-4 w-4 ${
                                                                    isSubmitted ? 'text-emerald-400' :
                                                                    isExpired   ? 'text-red-400' :
                                                                                  'text-emerald-400'
                                                                }`} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm font-bold text-white truncate">{resource.title}</h3>
                                                                {resource.facultyName && <p className="text-[10px] text-gray-500 flex items-center gap-1"><User className="h-3 w-3" /> {resource.facultyName}</p>}
                                                                {resource.htmlDeadline && <HtmlCountdown deadline={resource.htmlDeadline} />}
                                                            </div>
                                                            {isSubmitted ? (
                                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                                                        <span>✓ Submitted</span>
                                                                    </div>
                                                                    {/* Allow re-opening in read mode even after submission */}
                                                                    {resource.htmlContent && (
                                                                        <button onClick={() => openHtmlResource(resource)}
                                                                            className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                                                                            title="View again (submission already recorded)">
                                                                            View again
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : isExpired ? (
                                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold">
                                                                        <AlertTriangle className="h-3 w-3" />
                                                                        <span>Missed</span>
                                                                    </div>
                                                                    <span className="text-[9px] text-red-600 font-medium">Deadline over</span>
                                                                </div>
                                                            ) : resource.htmlContent ? (
                                                                <button onClick={() => openHtmlResource(resource)}
                                                                    className="px-3 py-1.5 rounded-lg shrink-0 bg-emerald-500 hover:bg-emerald-400 transition-colors text-white text-xs font-bold flex items-center gap-1.5"
                                                                    title="Open HTML page in browser">
                                                                    <Code className="h-3.5 w-3.5" /> Open
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={resource._id} className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg shrink-0 ${activeView === 'materials' ? 'bg-blue-500/20' : 'bg-rose-500/20'}`}>
                                                            {activeView === 'materials' && <FileText className="h-4 w-4 text-blue-400" />}
                                                            {activeView === 'videos' && <Video className="h-4 w-4 text-rose-400" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-sm font-bold text-white truncate">{resource.title}</h3>
                                                            {resource.facultyName && <p className="text-[10px] text-gray-500 flex items-center gap-1"><User className="h-3 w-3" /> {resource.facultyName}</p>}
                                                        </div>
                                                        {(resource.url || resource.videoLink) && (
                                                            <a href={resource.url || resource.videoLink} target="_blank" rel="noopener noreferrer"
                                                                className={`p-2 rounded-lg shrink-0 ${activeView === 'videos' ? 'bg-rose-500' : 'bg-blue-500'}`}>
                                                                {activeView === 'videos' ? <Play className="h-4 w-4 text-white" /> : <ExternalLink className="h-4 w-4 text-white" />}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeView === 'mock' && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActiveView('dashboard')} className="p-2 rounded-lg bg-white/5 text-gray-400"><ArrowLeft className="h-4 w-4" /></button>
                                    <h2 className="text-base font-bold text-white flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" /> Mock Test</h2>
                                </div>
                                <button onClick={() => router.push('/student/resources/mock-test')}
                                    className="w-full p-6 sm:p-8 rounded-xl bg-gradient-to-br from-emerald-900/40 to-teal-900/30 border border-emerald-500/30 hover:border-emerald-400/50 transition-all text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                        <Zap className="h-7 w-7 text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">Start Mock Test</h3>
                                    <p className="text-sm text-gray-300">Generate random test from {activeCourse} question bank</p>
                                    <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400 font-semibold">
                                        <span>Begin Test</span><ChevronRight className="h-4 w-4" />
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <style jsx>{`
                .bg-gradient-radial { background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%); }
            `}</style>
        </div>
    );
}
