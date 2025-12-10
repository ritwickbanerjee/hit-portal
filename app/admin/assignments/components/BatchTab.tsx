'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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

interface AttendanceRule {
    min: number;
    max: number;
    count: number;
}

export default function BatchTab({ onSuccess, user, context, isGlobalAdmin }: Props) {
    const [loading, setLoading] = useState(false);
    const [topics, setTopics] = useState<string[]>([]);
    const [allQuestions, setAllQuestions] = useState<any[]>([]);

    // Step 1 Rule: Pool of allowed questions
    const [allowedQuestionIds, setAllowedQuestionIds] = useState<string[]>([]);
    const [filteredQuestions, setFilteredQuestions] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        targetDepartments: [] as string[],
        targetCourse: '',
        startTime: '',
        deadline: '',
        topicWeights: [] as { topic: string, weight: number }[],
        rules: [{ min: 70, max: 100, count: 5 }] as AttendanceRule[]
    });

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    useEffect(() => {
        // Filter questions based on topic weights (if any topic is selected in weights)
        // If no weights, maybe show all? Or show none?
        // Usually batch assignment implies topics are weighted.
        // Let's show all questions that belong to topics present in topicWeights.
        // If topicWeights is empty, show all?

        const weightedTopics = formData.topicWeights.map(t => t.topic);
        const filtered = allQuestions.filter(q =>
            weightedTopics.length === 0 || weightedTopics.includes(q.topic)
        );
        setFilteredQuestions(filtered);

        // Auto-select new questions if they match criteria, but preserve unselected ones?
        // Simpler: Just reset to all filtered. User has to re-uncheck if they change topics.
        // Or we can try to preserve.
        // Let's reset for now to ensure consistency.
        setAllowedQuestionIds(filtered.map(q => q._id));
    }, [formData.topicWeights, allQuestions]);

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

    const handleTopicWeightChange = (topic: string, weight: number) => {
        const current = [...formData.topicWeights];
        const idx = current.findIndex(t => t.topic === topic);
        if (idx >= 0) {
            if (weight <= 0) current.splice(idx, 1);
            else current[idx].weight = weight;
        } else if (weight > 0) {
            current.push({ topic, weight });
        }
        setFormData({ ...formData, topicWeights: current });
    };

    const addRule = () => {
        setFormData({
            ...formData,
            rules: [...formData.rules, { min: 0, max: 0, count: 5 }]
        });
    };

    const removeRule = (index: number) => {
        const newRules = [...formData.rules];
        newRules.splice(index, 1);
        setFormData({ ...formData, rules: newRules });
    };

    const updateRule = (index: number, field: keyof AttendanceRule, value: number) => {
        const newRules = [...formData.rules];
        newRules[index] = { ...newRules[index], [field]: value };
        setFormData({ ...formData, rules: newRules });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.name) return toast.error('User not identified');
        if (!formData.targetCourse) return toast.error('Select Course');
        if (formData.topicWeights.length === 0) return toast.error('Select at least one topic weight');

        // Validate topic weights total equals 100%
        const totalWeight = formData.topicWeights.reduce((sum, tw) => sum + tw.weight, 0);
        if (totalWeight !== 100) return toast.error(`Topic weights must total 100%. Current: ${totalWeight}%`);

        if (formData.rules.length === 0) return toast.error('Add at least one attendance rule');

        // Validate rules
        for (const rule of formData.rules) {
            if (rule.min > rule.max) return toast.error(`Invalid rule: Min (${rule.min}) cannot be greater than Max (${rule.max})`);
        }

        const finalPool = allowedQuestionIds.filter(id => filteredQuestions.some(q => q._id === id));
        if (finalPool.length === 0) return toast.error('No questions selected in pool');

        setLoading(true);
        const toastId = toast.loading('Publishing manually randomized assignment...');

        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'batch_attendance',
                    title: `${formData.title} (${formData.targetCourse}) (Faculty: ${user.name})`,
                    startTime: formData.startTime,
                    deadline: formData.deadline,
                    targetDepartments: formData.targetDepartments,
                    targetCourse: formData.targetCourse,
                    facultyName: user.name,
                    topicWeights: formData.topicWeights,
                    rules: formData.rules, // Send array of rules
                    questionPool: finalPool
                })
            });

            if (res.ok) {
                toast.success('Published successfully', { id: toastId });
                setFormData({
                    title: '',
                    targetDepartments: [],
                    targetCourse: '',
                    startTime: '',
                    deadline: '',
                    topicWeights: [],
                    rules: [{ min: 70, max: 100, count: 5 }]
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Departments</label>
                            <div className="mt-2">
                                <MultiSelect
                                    options={context.depts}
                                    selected={formData.targetDepartments}
                                    onChange={s => setFormData({ ...formData, targetDepartments: s })}
                                    placeholder="Select departments..."
                                />
                            </div>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Start Time</label>
                            <input
                                type="datetime-local" required
                                value={formData.startTime}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Deadline</label>
                            <input
                                type="datetime-local" required
                                value={formData.deadline}
                                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                className="mt-2 block w-full rounded-md border-0 bg-gray-900/50 py-2 px-3 text-white ring-1 ring-inset ring-gray-600 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-white">Attendance Rules</h3>
                            <button type="button" onClick={addRule} className="text-xs flex items-center gap-1 bg-blue-600 px-2 py-1 rounded text-white hover:bg-blue-500">
                                <Plus className="h-3 w-3" /> Add Rule
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.rules.map((rule, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700">
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-400">Min %</label>
                                            <input type="number" min="0" max="100" value={rule.min} onChange={e => updateRule(idx, 'min', parseInt(e.target.value) || 0)} className="w-full bg-gray-800 border-gray-600 rounded text-white text-xs p-1" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">Max %</label>
                                            <input type="number" min="0" max="100" value={rule.max} onChange={e => updateRule(idx, 'max', parseInt(e.target.value) || 0)} className="w-full bg-gray-800 border-gray-600 rounded text-white text-xs p-1" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400">Questions</label>
                                            <input type="number" min="1" value={rule.count} onChange={e => updateRule(idx, 'count', parseInt(e.target.value) || 1)} className="w-full bg-gray-800 border-gray-600 rounded text-white text-xs p-1" />
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => removeRule(idx)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-white">Topic Weights (%)</h3>
                            {(() => {
                                const total = formData.topicWeights.reduce((sum, tw) => sum + tw.weight, 0);
                                return (
                                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${total === 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                        total > 100 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                        }`}>
                                        Total: {total}%
                                    </span>
                                );
                            })()}
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Assign percentage weights to topics. <strong>Total must equal 100%.</strong></p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
                            {topics.map(topic => {
                                const currentWeight = formData.topicWeights.find(t => t.topic === topic)?.weight || 0;
                                return (
                                    <div key={topic} className="flex items-center justify-between bg-gray-900/50 p-3 rounded border border-gray-700">
                                        <span className="text-sm text-gray-300 truncate mr-2" title={topic}>{topic}</span>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number" min="0" max="100"
                                                value={currentWeight || ''}
                                                placeholder="0"
                                                className="w-16 rounded bg-gray-800 border-gray-600 text-white text-sm p-1 text-center"
                                                onChange={(e) => handleTopicWeightChange(topic, parseInt(e.target.value) || 0)}
                                            />
                                            <span className="text-gray-500 text-xs">%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Question Exclusion */}
                <div className="space-y-4">
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

            <InstructionsBox>
                <ul className="list-disc list-inside space-y-2">
                    <li><strong>Manually Randomized (Batch):</strong> Assign different number of questions based on student attendance.</li>
                    <li><strong>Attendance Rules:</strong> Add rules like "70-100% attendance gets 5 questions".
                        <ul className="list-disc list-inside ml-4 text-gray-400">
                            <li>If a student's attendance falls on a boundary (e.g., exactly 70%), they are considered for the <strong>upper interval</strong> (e.g., 70-100%).</li>
                        </ul>
                    </li>
                    <li><strong>Step 1 Rule:</strong> Use the "Refine Question Pool" section to uncheck any questions you want to <strong>exclude</strong>.</li>
                    <li>Questions are drawn from the pool based on the <strong>Topic Weights</strong> you define.</li>
                </ul>
            </InstructionsBox>

            <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 w-full md:w-auto disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
                {loading && <Loader2 className="animate-spin h-4 w-4" />}
                Publish Manually Randomized Assignment
            </button>
        </form>
    );
}
