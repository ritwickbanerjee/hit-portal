'use client';

import { useState, useEffect } from 'react';
import { LayoutGrid, FileText, Shuffle, Users, UserCheck, Trash2, Loader2, Edit, X, AlertTriangle, Link } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DriveTab from './components/DriveTab';
import CustomTab from './components/CustomTab';
import RandomizedTab from './components/RandomizedTab';
import BatchTab from './components/BatchTab';
import PersonalizedTab from './components/PersonalizedTab';

export default function AssignmentsPage() {
    const [activeTab, setActiveTab] = useState('custom');
    const [assignments, setAssignments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [allowedContext, setAllowedContext] = useState<{
        courses: string[],
        depts: string[],
        years: string[]
    }>({ courses: [], depts: [], years: [] });

    // Google Drive Link State
    const [driveConfig, setDriveConfig] = useState<any>(null);
    const [showDriveModal, setShowDriveModal] = useState(false);
    const [driveLinkRequired, setDriveLinkRequired] = useState(false);

    // Edit Modal State
    const [editModal, setEditModal] = useState<{ open: boolean; assignment: any }>({ open: false, assignment: null });
    const [editDeadline, setEditDeadline] = useState('');
    const [editStartTime, setEditStartTime] = useState('');
    const [editDepartments, setEditDepartments] = useState<string[]>([]);
    const [editYear, setEditYear] = useState('');
    const [saving, setSaving] = useState(false);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; assignment: any }>({ open: false, assignment: null });
    const [deleting, setDeleting] = useState(false);

    // 1. Initialize User & Global Admin State
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            setLoading(false);
        }
        const ga = localStorage.getItem('globalAdminActive');
        setIsGlobalAdmin(ga === 'true');
    }, []);

    // 2. Fetch Data when User/GA is ready
    useEffect(() => {
        if (!user) return;

        const fetchConfig = async () => {
            try {
                const headers: any = { 'X-User-Email': user.email };
                if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

                const res = await fetch('/api/admin/config', { headers });
                if (res.ok) {
                    const config = await res.json();
                    const courses = new Set<string>();
                    const depts = new Set<string>();
                    const years = new Set<string>();

                    if (config.teacherAssignments) {
                        Object.entries(config.teacherAssignments).forEach(([key, teachers]: [string, any]) => {
                            if (isGlobalAdmin || (Array.isArray(teachers) && teachers.some((t: any) => t.email === user.email))) {
                                const [d, y, c] = key.split('_');
                                if (d) depts.add(d);
                                if (y) years.add(y);
                                if (c) courses.add(c);
                            }
                        });
                    }
                    setAllowedContext({
                        courses: Array.from(courses).sort(),
                        depts: Array.from(depts).sort(),
                        years: Array.from(years).sort()
                    });
                }
            } catch (e) {
                console.error("Error fetching config", e);
            }
        };

        const fetchDriveConfig = async () => {
            try {
                const headers: any = { 'X-User-Email': user.email };
                if (isGlobalAdmin) headers['X-Global-Admin-Key'] = 'globaladmin_25';

                const fcRes = await fetch('/api/admin/faculty-configs', { headers });
                if (fcRes.ok) {
                    const configs = await fcRes.json();
                    const myConfig = configs.find((c: any) => c.facultyName === user.name);
                    setDriveConfig(myConfig);

                    // Show blocking modal if no Drive config
                    if (!myConfig || !myConfig.rootFolderId) {
                        setDriveLinkRequired(true);
                        setShowDriveModal(true);
                    }
                }
            } catch (e) {
                console.error("Error fetching drive config", e);
            }
        };

        fetchConfig();
        fetchDriveConfig();
        fetchAssignments();
    }, [user, isGlobalAdmin]);

    const getHeaders = () => {
        const headers: any = { 'X-User-Email': user?.email || '' };
        const ga = localStorage.getItem('globalAdminActive');
        if (ga === 'true' || isGlobalAdmin) {
            headers['X-Global-Admin-Key'] = 'globaladmin_25';
        }
        return headers;
    };

    const fetchAssignments = async () => {
        if (!user) return;
        try {
            const res = await fetch('/api/admin/assignments', {
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setAssignments(data);
            }
        } catch (error) {
            console.error("Error fetching assignments", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.assignment) return;

        setDeleting(true);
        const toastId = toast.loading('Deleting...');
        try {
            const res = await fetch(`/api/admin/assignments?id=${deleteModal.assignment._id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (res.ok) {
                toast.success('Deleted successfully', { id: toastId });
                setDeleteModal({ open: false, assignment: null });
                fetchAssignments();
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error deleting assignment', { id: toastId });
        } finally {
            setDeleting(false);
        }
    };

    const openEditModal = (assignment: any) => {
        setEditModal({ open: true, assignment });
        const deadlineDate = new Date(assignment.deadline);
        const startDate = assignment.startTime ? new Date(assignment.startTime) : null;
        setEditDeadline(deadlineDate.toISOString().slice(0, 16));
        setEditStartTime(startDate ? startDate.toISOString().slice(0, 16) : '');
        setEditDepartments(assignment.targetDepartments || []);
        setEditYear(assignment.targetYear || '');
    };

    const handleSaveEdit = async () => {
        if (!editModal.assignment) return;

        setSaving(true);
        const toastId = toast.loading('Saving...');
        try {
            const res = await fetch('/api/admin/assignments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...getHeaders() },
                body: JSON.stringify({
                    id: editModal.assignment._id,
                    deadline: editDeadline ? editDeadline + ':00+05:30' : undefined,
                    startTime: editStartTime ? editStartTime + ':00+05:30' : undefined,
                    targetDepartments: editDepartments,
                    targetYear: editYear
                })
            });

            if (res.ok) {
                toast.success('Updated successfully', { id: toastId });
                setEditModal({ open: false, assignment: null });
                fetchAssignments();
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error updating assignment', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'custom', label: 'Custom Assignment', icon: FileText },
        { id: 'randomized', label: 'Fixed Randomized', icon: Shuffle },
        { id: 'batch', label: 'Variable Randomized', icon: Users },
        { id: 'personalized', label: 'Personalized', icon: UserCheck },
    ];

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>;

    return (
        <div className="space-y-8">
            {/* Header with Drive Button */}
            <div className="flex items-center justify-end">
                <button
                    onClick={() => setShowDriveModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                >
                    <Link className="h-4 w-4" />
                    Edit Google Drive Link
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 bg-gray-800/50 p-1 rounded-lg border border-gray-700 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'}`}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 min-h-[500px]">
                {activeTab === 'custom' && <CustomTab onSuccess={fetchAssignments} user={user} context={allowedContext} isGlobalAdmin={isGlobalAdmin} />}
                {activeTab === 'randomized' && <RandomizedTab onSuccess={fetchAssignments} user={user} context={allowedContext} isGlobalAdmin={isGlobalAdmin} />}
                {activeTab === 'batch' && <BatchTab onSuccess={fetchAssignments} user={user} context={allowedContext} isGlobalAdmin={isGlobalAdmin} />}
                {activeTab === 'personalized' && <PersonalizedTab onSuccess={fetchAssignments} user={user} context={allowedContext} isGlobalAdmin={isGlobalAdmin} />}
            </div>

            {/* Existing Assignments List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50">
                    <h3 className="text-lg font-semibold text-white">Existing Assignments</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-200 uppercase bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3">Title</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Faculty</th>
                                <th className="px-6 py-3">Course</th>
                                <th className="px-6 py-3">Dept+Year</th>
                                <th className="px-6 py-3">Deadline</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {assignments.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-gray-500">No assignments found</td></tr>
                            ) : (
                                assignments.map((a) => (
                                    <tr key={a._id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{a.title}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${a.type === 'manual' ? 'bg-purple-900/30 text-purple-400 border border-purple-800' : a.type === 'randomized' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : a.type === 'batch_attendance' ? 'bg-orange-900/30 text-orange-400 border border-orange-800' : a.type === 'personalized' ? 'bg-pink-900/30 text-pink-400 border border-pink-800' : 'bg-green-900/30 text-green-400 border border-green-800'}`}>
                                                {a.type?.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{a.facultyName}</td>
                                        <td className="px-6 py-4">{a.targetCourse}</td>
                                        <td className="px-6 py-4">
                                            {a.targetDepartments && a.targetDepartments.length > 0
                                                ? `${a.targetDepartments.join(', ')} - ${a.targetYear || 'N/A'}`
                                                : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">{new Date(a.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(a)}
                                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 p-2 rounded transition-colors"
                                                    title="Edit Deadline"
                                                >
                                                    <Edit className="h-4 w-4 pointer-events-none" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteModal({ open: true, assignment: a })}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded transition-colors"
                                                    title="Delete Assignment"
                                                >
                                                    <Trash2 className="h-4 w-4 pointer-events-none" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-gray-800 border border-red-500/50 rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="p-6 text-center">
                            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="h-8 w-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Delete Assignment?</h3>
                            <p className="text-gray-400 mb-2">
                                Are you sure you want to delete:
                            </p>
                            <p className="text-white font-semibold mb-4">"{deleteModal.assignment?.title}"</p>
                            <p className="text-red-400 text-sm mb-6">
                                This will permanently delete all student records, submissions, and notifications for this assignment.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteModal({ open: false, assignment: null })}
                                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                                    disabled={deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                                >
                                    {deleting ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700">
                            <h3 className="text-xl font-bold text-white">Edit Assignment</h3>
                            <button onClick={() => setEditModal({ open: false, assignment: null })} className="text-gray-400 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Assignment</p>
                                <p className="text-white font-semibold">{editModal.assignment?.title}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Start Time (Optional)</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                    onClick={(e: any) => e.target.showPicker && e.target.showPicker()}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Deadline *</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    onClick={(e: any) => e.target.showPicker && e.target.showPicker()}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Departments</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white text-left flex justify-between items-center"
                                        onClick={() => {
                                            const dropdown = document.getElementById('edit-dept-dropdown');
                                            dropdown?.classList.toggle('hidden');
                                        }}
                                    >
                                        <span className="truncate">
                                            {editDepartments.length > 0 ? editDepartments.join(', ') : 'Select Departments'}
                                        </span>
                                        <span className="text-xs">▼</span>
                                    </button>
                                    <div id="edit-dept-dropdown" className="hidden absolute top-full left-0 w-full bg-gray-900 border border-gray-600 rounded mt-1 z-10 max-h-40 overflow-y-auto">
                                        {allowedContext.depts.map(d => (
                                            <label key={d} className="flex items-center gap-2 p-2 hover:bg-gray-700 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editDepartments.includes(d)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setEditDepartments([...editDepartments, d]);
                                                        } else {
                                                            setEditDepartments(editDepartments.filter(x => x !== d));
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm text-white">{d}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Year</label>
                                <select
                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editYear}
                                    onChange={(e) => setEditYear(e.target.value)}
                                >
                                    <option value="">Select Year</option>
                                    {allowedContext.years.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setEditModal({ open: false, assignment: null })}
                                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving || !editDeadline}
                                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Google Drive Link Modal */}
            {showDriveModal && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm ${driveLinkRequired ? 'pointer-events-auto' : ''}`}>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                            <h3 className="text-xl font-bold text-white">Google Drive Configuration</h3>
                            {(!driveLinkRequired || isGlobalAdmin) && (
                                <button onClick={() => setShowDriveModal(false)} className="text-gray-400 hover:text-white">
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <div className="p-6">
                            {driveLinkRequired && !driveConfig?.rootFolderId && (
                                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="h-5 w-5 text-red-400" />
                                        <p className="text-red-300 font-medium">You must link Google Drive before creating assignments</p>
                                    </div>
                                </div>
                            )}
                            <DriveTab user={user} isGlobalAdmin={isGlobalAdmin} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
