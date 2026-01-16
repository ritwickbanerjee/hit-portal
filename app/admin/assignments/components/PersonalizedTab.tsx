'use client';

import { useState, useEffect } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import MultiSelect from './MultiSelect';
import InstructionsBox from './InstructionsBox';
import QuestionSelector from './QuestionSelector';

interface Props {
    onSuccess: () => void;
    user: any;
    context: { courses: string[], depts: string[], years: string[] };
    isGlobalAdmin: boolean;
}

export default function PersonalizedTab({ onSuccess, user, context, isGlobalAdmin }: Props) {
    const [loading, setLoading] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [subTopics, setSubTopics] = useState<string[]>([]);
    const [allQuestions, setAllQuestions] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterCourse, setFilterCourse] = useState('');

    // Step 1 Rule: Pool of allowed questions
    const [allowedQuestionIds, setAllowedQuestionIds] = useState<string[]>([]);
    const [filteredQuestions, setFilteredQuestions] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        questionCount: 5,
        targetCourse: '',
        startTime: '',
        deadline: '',
        selectedTopics: [] as string[],
        selectedSubTopics: [] as string[],
        selectedStudentIds: [] as string[]
    });

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    useEffect(() => {
        // Filter students based on search and context
        const lowerSearch = searchTerm.toLowerCase();
        const filtered = students.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(lowerSearch) || (s.roll && s.roll.toLowerCase().includes(lowerSearch));

            // Context matches (if provided via props)
            const matchesContext = (context.depts.length === 0 || context.depts.includes(s.department)) &&
                (context.courses.length === 0 || context.courses.includes(s.course_code));

            // UI Filters matches
            const matchesFilterDept = !filterDept || s.department === filterDept;
            const matchesFilterYear = !filterYear || s.year === filterYear;
            const matchesFilterCourse = !filterCourse || s.course_code === filterCourse;

            return matchesSearch && matchesContext && matchesFilterDept && matchesFilterYear && matchesFilterCourse;
        });
        setFilteredStudents(filtered);
    }, [searchTerm, students, context, filterDept, filterYear, filterCourse]);

    useEffect(() => {
        // Update available subtopics based on selected topics
        const relevantQuestions = formData.selectedTopics.length === 0
            ? allQuestions
            : allQuestions.filter(q => formData.selectedTopics.includes(q.topic));

        const newSubTopics = Array.from(new Set(relevantQuestions.map(q => q.subtopic).filter(Boolean))).sort();
        setSubTopics(newSubTopics);
    }, [formData.selectedTopics, allQuestions]);

    useEffect(() => {
        const filtered = allQuestions.filter(q => {
            const topicMatch = formData.selectedTopics.length === 0 || formData.selectedTopics.includes(q.topic);
            const subTopicMatch = formData.selectedSubTopics.length === 0 || formData.selectedSubTopics.includes(q.subtopic);
            return topicMatch && subTopicMatch;
        });
        setFilteredQuestions(filtered);
        setAllowedQuestionIds(filtered.map(q => q._id));
    }, [formData.selectedTopics, formData.selectedSubTopics, allQuestions]);

    const fetchData = async () => {
        if (!user?.email) return;
        try {
            const headers: any = { 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const [studentRes, qRes] = await Promise.all([
                fetch('/api/admin/students', { headers }),
                fetch('/api/admin/questions', { headers })
            ]);

            if (studentRes.ok) {
                const data = await studentRes.json();
                setStudents(data);
            }

            if (qRes.ok) {
                const qs = await qRes.json();
                setAllQuestions(qs);
                const tps = new Set<string>();
                qs.forEach((q: any) => { if (q.topic) tps.add(q.topic); });
                setTopics(Array.from(tps).sort());
            }
        } catch (error) {
            console.error("Error fetching data", error);
        }
    };

    const toggleStudent = (id: string) => {
        const current = [...formData.selectedStudentIds];
        if (current.includes(id)) {
            setFormData({ ...formData, selectedStudentIds: current.filter(s => s !== id) });
        } else {
            setFormData({ ...formData, selectedStudentIds: [...current, id] });
        }
    };

    const selectAllFiltered = () => {
        const ids = filteredStudents.map(s => s._id);
        const newSet = new Set([...formData.selectedStudentIds, ...ids]);
        setFormData({ ...formData, selectedStudentIds: Array.from(newSet) });
    };

    const clearSelection = () => {
        setFormData({ ...formData, selectedStudentIds: [] });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.name) return toast.error('User not identified');
        if (!formData.targetCourse) return toast.error('Select Course');
        if (formData.selectedStudentIds.length === 0) return toast.error('Select at least one student');

        const finalPool = allowedQuestionIds.filter(id => filteredQuestions.some(q => q._id === id));
        if (finalPool.length < formData.questionCount) return toast.error(`Not enough questions selected (${finalPool.length} available, ${formData.questionCount} needed)`);

        setLoading(true);
        const toastId = toast.loading('Publishing personalized assignment...');

        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'personalized',
                    title: `${formData.title} (${formData.targetCourse}) (Faculty: ${user.name})`,
                    questionCount: formData.questionCount,
                    startTime: formData.startTime,
                    deadline: formData.deadline,
                    targetCourse: formData.targetCourse,
                    facultyName: user.name,
                    targetStudentIds: formData.selectedStudentIds, // Backend expects targetStudentIds for personalized
                    questionPool: finalPool
                })
            });

            if (res.ok) {
                toast.success('Published successfully', { id: toastId });
                setFormData({
                    title: '',
                    questionCount: 5,
                    targetCourse: '',
                    startTime: '',
                    deadline: '',
                    selectedTopics: [],
                    selectedSubTopics: [],
                    selectedStudentIds: []
                });
                onSuccess();
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Failed to publish');
            }
        } catch (error: any) {
            toast.error(error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500">
            <InstructionsBox>
                <ul className="list-disc list-inside space-y-2">
                    <li><strong>Personalized Assignment:</strong> Assign a unique set of questions to specific students.</li>
                    <li><strong>Step 1 Rule:</strong> Use the "Refine Question Pool" section to uncheck any questions you want to <strong>exclude</strong>.</li>
                    <li>Select the students you want to assign this work to from the list on the right.</li>
                    <li>Ensure the pool has enough questions to satisfy the "Questions Count" for each student.</li>
                </ul>
            </InstructionsBox>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Settings */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Title</label>
                        <input
                            type="text" required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Questions Count</label>
                            <input
                                type="number" min="1" required
                                value={formData.questionCount}
                                onChange={e => setFormData({ ...formData, questionCount: parseInt(e.target.value) || 0 })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Target Course</label>
                            <select
                                value={formData.targetCourse}
                                onChange={e => setFormData({ ...formData, targetCourse: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2.5 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Select Course</option>
                                {context.courses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Start Time</label>
                            <input
                                type="datetime-local" required
                                value={formData.startTime}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                onClick={(e: any) => e.target.showPicker && e.target.showPicker()}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Deadline</label>
                            <input
                                type="datetime-local" required
                                value={formData.deadline}
                                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                onClick={(e: any) => e.target.showPicker && e.target.showPicker()}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300">Topic Filter</label>
                        <div className="mt-2">
                            <MultiSelect
                                options={topics}
                                selected={formData.selectedTopics}
                                onChange={s => setFormData({ ...formData, selectedTopics: s })}
                                placeholder="Filter question pool..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300">Sub-topic Filter</label>
                        <div className="mt-2">
                            <MultiSelect
                                options={subTopics}
                                selected={formData.selectedSubTopics}
                                onChange={s => setFormData({ ...formData, selectedSubTopics: s })}
                                placeholder="Filter by sub-topic..."
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Step 1: Refine Question Pool</label>
                        <QuestionSelector
                            questions={filteredQuestions}
                            selectedIds={allowedQuestionIds}
                            onChange={setAllowedQuestionIds}
                        />
                        <p className="text-xs text-gray-400 text-right">
                            {allowedQuestionIds.filter(id => filteredQuestions.some(q => q._id === id)).length} questions available
                        </p>
                    </div>
                </div>

                {/* Right Column: Student Selection */}
                <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-white">Select Students</h3>
                        <span className="text-sm text-blue-400 font-bold">{formData.selectedStudentIds.length} selected</span>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search by name or roll number..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 block w-full rounded-md border-0 bg-gray-900 py-2 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>
                        <button type="button" onClick={selectAllFiltered} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded">Select All</button>
                        <button type="button" onClick={clearSelection} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded">Clear</button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <select
                            value={filterDept}
                            onChange={e => setFilterDept(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded text-xs text-white p-1"
                        >
                            <option value="">Dept: All</option>
                            {context.depts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select
                            value={filterYear}
                            onChange={e => setFilterYear(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded text-xs text-white p-1"
                        >
                            <option value="">Year: All</option>
                            {context.years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                            value={filterCourse}
                            onChange={e => setFilterCourse(e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded text-xs text-white p-1"
                        >
                            <option value="">Course: All</option>
                            {context.courses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {filteredStudents.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No students found</p>
                        ) : (
                            filteredStudents.map(student => (
                                <div
                                    key={student._id}
                                    onClick={() => toggleStudent(student._id)}
                                    className={`
                                        flex items-center justify-between p-3 rounded cursor-pointer transition-colors border
                                        ${formData.selectedStudentIds.includes(student._id)
                                            ? 'bg-blue-900/30 border-blue-500/50'
                                            : 'bg-gray-900/30 border-gray-700 hover:bg-gray-700/50'}
                                    `}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-white">{student.name}</p>
                                        <p className="text-xs text-gray-400">{student.roll} • {student.department} • {student.year} • <span className="text-blue-400">{student.course_code}</span></p>
                                    </div>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.selectedStudentIds.includes(student._id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                        {formData.selectedStudentIds.includes(student._id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>



            <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 w-full md:w-auto disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
                {loading && <Loader2 className="animate-spin h-4 w-4" />}
                Publish Personalized Assignment
            </button>
        </form>
    );
}
