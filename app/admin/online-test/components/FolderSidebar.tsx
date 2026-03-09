'use client';

import { useState } from 'react';
import { Folder as FolderIcon, Plus, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Folder {
    _id: string;
    name: string;
    type: string;
    createdAt: string;
}

interface FolderSidebarProps {
    folders: Folder[];
    selectedFolder: string | null;
    onSelectFolder: (folderId: string | null) => void;
    onFolderChange: () => void;
    userEmail: string;
}

export default function FolderSidebar({
    folders,
    selectedFolder,
    onSelectFolder,
    onFolderChange,
    userEmail
}: FolderSidebarProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [folderName, setFolderName] = useState('');

    const createFolder = async () => {
        if (!folderName.trim()) {
            toast.error('Folder name is required');
            return;
        }

        try {
            const res = await fetch('/api/admin/online-test/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail
                },
                body: JSON.stringify({ name: folderName.trim() })
            });

            if (res.ok) {
                toast.success('Folder created');
                setIsCreating(false);
                setFolderName('');
                onFolderChange();
            } else {
                toast.error('Failed to create folder');
            }
        } catch (error) {
            toast.error('Error creating folder');
        }
    };

    const renameFolder = async (id: string) => {
        if (!folderName.trim()) {
            toast.error('Folder name is required');
            return;
        }

        try {
            const res = await fetch('/api/admin/online-test/folders', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': userEmail
                },
                body: JSON.stringify({ id, name: folderName.trim() })
            });

            if (res.ok) {
                toast.success('Folder renamed');
                setIsEditing(null);
                setFolderName('');
                onFolderChange();
            } else {
                toast.error('Failed to rename folder');
            }
        } catch (error) {
            toast.error('Error renaming folder');
        }
    };

    const deleteFolder = async (id: string) => {
        if (!confirm('Delete this folder? Tests will be moved to root.')) return;

        try {
            const res = await fetch(`/api/admin/online-test/folders?id=${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Email': userEmail }
            });

            if (res.ok) {
                toast.success('Folder deleted');
                if (selectedFolder === id) {
                    onSelectFolder(null);
                }
                onFolderChange();
            } else {
                toast.error('Failed to delete folder');
            }
        } catch (error) {
            toast.error('Error deleting folder');
        }
    };

    return (
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Folders</h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title="Create Folder"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            {/* All Tests */}
            <button
                onClick={() => onSelectFolder(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-2 transition-colors ${selectedFolder === null
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
            >
                <FolderIcon className="h-4 w-4" />
                <span className="text-sm">All Tests</span>
            </button>

            {/* Create New Folder Input */}
            {isCreating && (
                <div className="mb-2 p-2 bg-slate-800/50 rounded-lg">
                    <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') createFolder();
                            if (e.key === 'Escape') {
                                setIsCreating(false);
                                setFolderName('');
                            }
                        }}
                        placeholder="Folder name..."
                        autoFocus
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="flex gap-1 mt-1">
                        <button
                            onClick={createFolder}
                            className="flex-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-500"
                        >
                            Create
                        </button>
                        <button
                            onClick={() => {
                                setIsCreating(false);
                                setFolderName('');
                            }}
                            className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Folder List */}
            <div className="space-y-1">
                {folders.map((folder) => (
                    <div key={folder._id}>
                        {isEditing === folder._id ? (
                            <div className="p-2 bg-slate-800/50 rounded-lg">
                                <input
                                    type="text"
                                    value={folderName}
                                    onChange={(e) => setFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') renameFolder(folder._id);
                                        if (e.key === 'Escape') {
                                            setIsEditing(null);
                                            setFolderName('');
                                        }
                                    }}
                                    autoFocus
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <div className="flex gap-1 mt-1">
                                    <button
                                        onClick={() => renameFolder(folder._id)}
                                        className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(null);
                                            setFolderName('');
                                        }}
                                        className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${selectedFolder === folder._id
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                            >
                                <button
                                    onClick={() => onSelectFolder(folder._id)}
                                    className="flex-1 flex items-center gap-2"
                                >
                                    <FolderIcon className="h-4 w-4" />
                                    <span className="text-sm truncate">{folder.name}</span>
                                </button>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setIsEditing(folder._id);
                                            setFolderName(folder.name);
                                        }}
                                        className="p-1 rounded hover:bg-blue-500/20 text-blue-400"
                                        title="Rename"
                                    >
                                        <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => deleteFolder(folder._id)}
                                        className="p-1 rounded hover:bg-red-500/20 text-red-400"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
