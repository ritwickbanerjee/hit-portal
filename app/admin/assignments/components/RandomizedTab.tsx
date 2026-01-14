'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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

export default function RandomizedTab({ onSuccess, user, context, isGlobalAdmin }: Props) {
    const [loading, setLoading] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [subTopics, setSubTopics] = useState<string[]>([]);
    const [allQuestions, setAllQuestions] = useState<any[]>([]);

    // Step 1 Rule: Pool of allowed questions (initially all, then filtered by user)
    const [allowedQuestionIds, setAllowedQuestionIds] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        questionCount: 5,
        targetDepartments: [] as string[],
        targetCourse: '',
        startTime: '',
        deadline: '',
        selectedTopics: [] as string[],
        selectedSubTopics: [] as string[]
    });

    const [filteredQuestions, setFilteredQuestions] = useState<any[]>([]);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    useEffect(() => {
        // Update available subtopics based on selected topics
        const relevantQuestions = formData.selectedTopics.length === 0
            ? allQuestions
            : allQuestions.filter(q => formData.selectedTopics.includes(q.topic));

        const newSubTopics = Array.from(new Set(relevantQuestions.map(q => q.subtopic).filter(Boolean))).sort();
        setSubTopics(newSubTopics);

        // Clear invalid subtopics
        setFormData(prev => ({
            ...prev,
            selectedSubTopics: prev.selectedSubTopics.filter(s => newSubTopics.includes(s))
        }));
    }, [formData.selectedTopics, allQuestions]);

    useEffect(() => {
        // Filter questions based on selected topics AND subtopics
        const filtered = allQuestions.filter(q => {
            const topicMatch = formData.selectedTopics.length === 0 || formData.selectedTopics.includes(q.topic);
            const subTopicMatch = formData.selectedSubTopics.length === 0 || formData.selectedSubTopics.includes(q.subtopic);
            return topicMatch && subTopicMatch;
        });
        setFilteredQuestions(filtered);

        // Reset allowed IDs to match filter when filter changes (optional, or keep selection?)
        // User requirement: "unselect some questions so that they are never used"
        // Better strategy: Initialize allowed IDs with ALL filtered questions, then let user uncheck.
        // But if topics change, the set changes.
        // Let's just track allowed IDs. If a question is filtered out by topic, it's effectively excluded anyway.
        // But for the UI, we only show filtered questions.
        // We should auto-select new questions that appear in the filter?
        // Let's auto-select all filtered questions initially.
        setAllowedQuestionIds(filtered.map(q => q._id));
    }, [formData.selectedTopics, formData.selectedSubTopics, allQuestions]);

    const fetchData = async () => {
        if (!user?.email) return;
        try {
            const headers: any = { 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const qRes = await fetch('/api/admin/questions', {
                headers
            });
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.name) return toast.error('User not identified');
        if (!formData.targetCourse) return toast.error('Select Course');

        // Final pool is intersection of (Topic Filter) AND (User Selection)
        // Since allowedQuestionIds is derived from filteredQuestions and user interaction,
        // we just use allowedQuestionIds that are currently in the filtered set.
        const finalPool = allowedQuestionIds.filter(id => filteredQuestions.some(q => q._id === id));

        if (finalPool.length < formData.questionCount) return toast.error(`Not enough questions selected (${finalPool.length} available, ${formData.questionCount} needed)`);

        setLoading(true);
        const toastId = toast.loading('Publishing randomized assignment...');

        try {

            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'randomized',
                    title: `${formData.title} (${formData.targetCourse}) (Faculty: ${user.name})`,
                    questionCount: formData.questionCount,
                    startTime: formData.startTime,
                    deadline: formData.deadline,
                    targetDepartments: formData.targetDepartments,
                    targetCourse: formData.targetCourse,
                    facultyName: user.name,
                    questionPool: finalPool // Send only the allowed IDs
                })
            });

            if (res.ok) {
                toast.success('Published successfully', { id: toastId });
                setFormData({
                    title: '',
                    questionCount: 5,
                    targetDepartments: [],
                    targetCourse: '',
                    startTime: '',
                    deadline: '',
                    selectedTopics: [],
                    selectedSubTopics: []
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
                    <li><strong>Randomized Assignment:</strong> Each student gets a unique set of questions randomly picked from your selected pool.</li>
                    <li><strong>Step 1 Rule:</strong> Use the "Refine Question Pool" section to uncheck any questions you want to <strong>exclude</strong>. Unchecked questions will NEVER be assigned to any student.</li>
                    <li>You can filter the pool by topics first, then manually refine the selection.</li>
                    <li>Ensure you have selected enough questions in the pool to satisfy the "Questions Count" requirement.</li>
                </ul>
            </InstructionsBox>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                                required
                                value={formData.targetCourse}
                                onChange={e => setFormData({ ...formData, targetCourse: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select Course</option>
                                {context.courses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300">Target Departments</label>
                        <div className="mt-2">
                            <MultiSelect
                                options={context.depts}
                                selected={formData.targetDepartments}
                                onChange={s => setFormData({ ...formData, targetDepartments: s })}
                                placeholder="Select departments..."
                            />
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
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 textwhite ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                                placeholder="Filter by topic..."
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 w-full disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                    >
                        {loading && <Loader2 className="animate-spin h-4 w-4" />}
                        Publish Randomized Assignment
                    </button>
                </div>

                {/* Right Column: Question Exclusion (2/3 width) */}
                <div className="space-y-4 lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-300">Step 1: Refine Question Pool</label>
                    <QuestionSelector
                        questions={filteredQuestions}
                        selectedIds={allowedQuestionIds}
                        onChange={setAllowedQuestionIds}
                    />
                    <p className="text-xs text-gray-400 text-right">
                        {allowedQuestionIds.filter(id => filteredQuestions.some(q => q._id === id)).length} questions available for randomization
                    </p>
                </div>
            </div>
        </form>
    );
}
