'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import MultiSelect from './MultiSelect';
import LatexWrapper from './LatexWrapper';
import InstructionsBox from './InstructionsBox';

interface Props {
    onSuccess: () => void;
    user: any;
    context: { courses: string[], depts: string[], years: string[] };
    isGlobalAdmin: boolean;
}

export default function CustomTab({ onSuccess, user, context, isGlobalAdmin }: Props) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        targetDepartments: [] as string[],
        targetCourse: '',
        startTime: '',
        deadline: '',
        description: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.name) return toast.error('User not identified');
        if (!formData.targetCourse) return toast.error('Select Course');

        setLoading(true);
        const toastId = toast.loading('Publishing assignment...');

        try {
            const headers: any = { 'Content-Type': 'application/json', 'X-User-Email': user.email };
            if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

            const res = await fetch('/api/admin/assignments', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    type: 'manual',
                    title: `${formData.title} (${formData.targetCourse}) (Faculty: ${user.name})`,
                    description: formData.description,
                    startTime: formData.startTime,
                    deadline: formData.deadline,
                    targetDepartments: formData.targetDepartments,
                    targetCourse: formData.targetCourse,
                    facultyName: user.name
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
                    description: ''
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
                    <li><strong>Custom Assignment:</strong> Create a specific assignment with a fixed set of questions.</li>
                    <li>All students in the target course/departments will receive the <strong>exact same questions</strong>.</li>
                    <li>Use the LaTeX editor to write your questions or paste them.</li>
                    <li>You can preview the rendered LaTeX below before publishing.</li>
                </ul>
            </InstructionsBox>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inputs */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Assignment Title</label>
                        <input
                            type="text" required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Start Time</label>
                            <input
                                type="datetime-local" required
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                value={formData.startTime}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                onClick={(e: any) => e.target.showPicker && e.target.showPicker()}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Deadline</label>
                            <input
                                type="datetime-local" required
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                value={formData.deadline}
                                onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                min={formData.startTime || undefined}
                                onClick={(e: any) => e.target.showPicker && e.target.showPicker()}
                            />
                        </div>
                    </div>
                </div>

                {/* Info / Help */}

            </div>

            {/* Description & Preview (Full Width) */}
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-300">Description (LaTeX supported)</label>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <textarea
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="block w-full h-64 rounded-md border-0 bg-gray-900/50 py-3 px-4 text-white font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter description here..."
                    />
                    <div className="w-full h-64 rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-gray-200 overflow-y-auto">
                        <LatexWrapper>{formData.description || 'Preview will appear here...'}</LatexWrapper>
                    </div>
                </div>
            </div>



            <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 w-full md:w-auto disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
                {loading && <Loader2 className="animate-spin h-4 w-4" />}
                Publish Custom Assignment
            </button>
        </form>
    );
}
