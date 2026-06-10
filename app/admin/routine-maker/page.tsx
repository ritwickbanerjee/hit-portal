'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Plus, X, Save, Upload, Copy, Download, Settings, Users, AlertTriangle, CheckCircle2, LayoutGrid, FileSpreadsheet,
    Lock, Unlock, Shield, Trash2, Printer, Play, History, RefreshCw, ChevronRight, ChevronLeft, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
    GridState, FacultyData, checkConstraints, ConstraintViolation, Slot
} from './constraintUtils';
import { 
    exportMasterCSV, exportDeptCourseCSV, exportLoadMatrixExcel, exportFacultyExcel
} from './exportUtils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TIME_LABELS = ['9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4', '4-5', '5-6'];

const DEFAULT_RULES = [
    { startsWith: 'MTH1101', mapsTo: '1L' },
    { startsWith: 'MTH1201', mapsTo: '2L' },
    { startsWith: 'T1/MTH', mapsTo: '2T' },
    { startsWith: 'T2/MTH', mapsTo: '2T' },
    { startsWith: 'MTH5', mapsTo: 'M1' },
    { startsWith: 'MATH5', mapsTo: 'M1' },
    { startsWith: 'MATH6', mapsTo: 'M2' },
    { startsWith: 'BTC', mapsTo: 'M2' },
    { startsWith: 'MTH2', mapsTo: '4L' },
    { startsWith: 'MTH3', mapsTo: '6L' },
    { startsWith: 'MATH4', mapsTo: '8L' },
    { startsWith: 'CBS', mapsTo: '3P' },
    { startsWith: 'P/MTH2252', mapsTo: '4P' },
];

const FACULTY_COLORS_14 = [
    '#E6194B', '#3CB44B', '#9A6324', '#4363D8', '#F58231',
    '#911EB4', '#008080', '#F032E6', '#808000', '#000075',
    '#E11D48', '#0E7490', '#800000', '#469990'
];

export default function RoutineMakerPage() {
    const [activeTab, setActiveTab] = useState<'grid'|'faculty'|'rules'|'access'>('grid');
    const [userEmail, setUserEmail] = useState('');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    
    // Data State
    const [routines, setRoutines] = useState<any[]>([]);
    const [currentRoutineId, setCurrentRoutineId] = useState<string>('');
    const [routineName, setRoutineName] = useState('Untitled Routine');
    
    const [grid, setGrid] = useState<GridState>({});
    const [faculties, setFaculties] = useState<FacultyData[]>([]);
    const [mappingRules, setMappingRules] = useState(DEFAULT_RULES);
    const [lockedCells, setLockedCells] = useState<any[]>([]);
    
    // UI State
    const [selectedFacultyFilter, setSelectedFacultyFilter] = useState<string | null>(null);
    const [violations, setViolations] = useState<ConstraintViolation[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [engineExpanded, setEngineExpanded] = useState(true);
    const [glowingViolations, setGlowingViolations] = useState<string[]>([]);
    const [swapAnimation, setSwapAnimation] = useState<{ day: string, pIdx: number, rowId: string }[]>([]);
    const [actionLog, setActionLog] = useState<{msg: string, time: Date}[]>([]);
    
    const [exportOpen, setExportOpen] = useState(false);
    
    // History (Undo/Redo)
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Context Menu & Modals
    const [contextMenu, setContextMenu] = useState<{x: number, y: number, day: string, rowId: string, pIdx: number} | null>(null);
    const [cellModal, setCellModal] = useState<{day: string, rowId: string, pIdx: number} | null>(null);
    const [clipboardCell, setClipboardCell] = useState<Slot | null>(null);
    
    const gridRef = useRef<HTMLDivElement>(null);
    const topScrollRef = useRef<HTMLDivElement>(null);

    const logAction = (msg: string) => {
        setActionLog(prev => [{msg, time: new Date()}, ...prev].slice(0, 5));
    };

    // Initial Load
    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        if (u.email) {
            setUserEmail(u.email);
            setIsSuperAdmin(u.email.toLowerCase() === 'ritwick92@gmail.com');
        }
        fetchRoutines();
    }, []);

    const fetchRoutines = async () => {
        const res = await fetch('/api/admin/routine-maker', { headers: getHeaders() });
        if (res.ok) {
            const data = await res.json();
            setRoutines(data);
            if (data.length > 0 && !currentRoutineId) {
                loadRoutine(data[0]._id);
            } else if (data.length === 0) {
                createNewRoutine();
            }
        }
    };

    const getHeaders = () => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const h: any = { 'Content-Type': 'application/json' };
        if (u.email) h['X-User-Email'] = u.email;
        if (localStorage.getItem('globalAdminActive') === 'true') {
            h['X-Global-Admin-Key'] = 'globaladmin_25';
        }
        return h;
    };

    // Auto-Save
    useEffect(() => {
        if (!hasUnsavedChanges || !currentRoutineId) return;
        const timer = setTimeout(() => {
            saveRoutine();
        }, 30000); // 30s
        return () => clearTimeout(timer);
    }, [grid, faculties, mappingRules, hasUnsavedChanges]);

    // Live Constraints & Auto Expand
    useEffect(() => {
        const newViolations = checkConstraints(grid, faculties);
        if (newViolations.length > violations.length) {
            setEngineExpanded(true); // Auto expand on new conflict
        }
        setViolations(newViolations);
        // Clean up resolved glowing violations
        setGlowingViolations(prev => prev.filter(vId => newViolations.some(nv => nv.id === vId)));
    }, [grid, faculties]);

    const loadRoutine = async (id: string) => {
        const res = await fetch(`/api/admin/routine-maker/${id}`, { headers: getHeaders() });
        if (res.ok) {
            const data = await res.json();
            setCurrentRoutineId(data._id);
            setRoutineName(data.name);
            setGrid(data.grid || initEmptyGrid());
            setFaculties(data.faculties || []);
            setMappingRules(data.mappingRules || DEFAULT_RULES);
            setLockedCells(data.lockedCells || []);
            setHasUnsavedChanges(false);
            setGlowingViolations([]);
            
            const snap = JSON.stringify(data.grid || initEmptyGrid());
            setHistory([snap]);
            setHistoryIndex(0);
        }
    };

    const initEmptyGrid = () => {
        const g: any = {};
        DAYS.forEach(d => {
            g[d] = [{ id: Math.random().toString(36).substr(2,9), slots: Array(9).fill(null) }];
        });
        return g;
    };

    const createNewRoutine = async () => {
        const res = await fetch('/api/admin/routine-maker', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name: 'New Routine', grid: initEmptyGrid() })
        });
        if (res.ok) {
            const data = await res.json();
            await fetchRoutines();
            loadRoutine(data._id);
            toast.success('Routine created');
        }
    };

    const deleteRoutine = async () => {
        if (!currentRoutineId) return;
        if (!confirm("Are you sure you want to permanently delete this routine?")) return;
        
        const res = await fetch(`/api/admin/routine-maker/${currentRoutineId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (res.ok) {
            toast.success('Routine deleted');
            setCurrentRoutineId('');
            await fetchRoutines();
        }
    };

    const saveRoutine = async () => {
        if (!currentRoutineId) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/routine-maker/${currentRoutineId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({
                    name: routineName,
                    grid, faculties, mappingRules, lockedCells
                })
            });
            if (res.ok) {
                setHasUnsavedChanges(false);
                toast.success('Saved');
            } else {
                toast.error('Failed to save');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const duplicateRoutine = async () => {
        if (!currentRoutineId) return;
        const res = await fetch(`/api/admin/routine-maker/${currentRoutineId}/duplicate`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            await fetchRoutines();
            loadRoutine(data._id);
            toast.success('Duplicated successfully');
        }
    };

    const syncWithSheet = async () => {
        if (!currentRoutineId) return;
        if (!confirm("This will pull the latest data from the Live Google Sheet and overwrite the current routine. Proceed?")) return;
        
        setIsSyncing(true);
        const toastId = toast.loading('Syncing with Google Sheets...');
        try {
            const res = await fetch(`/api/admin/routine-maker/${currentRoutineId}/sync`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setGrid(data.grid);
                setFaculties(data.faculties);
                setHasUnsavedChanges(false);
                setGlowingViolations([]);
                
                const snap = JSON.stringify(data.grid);
                setHistory([snap]);
                setHistoryIndex(0);
                
                toast.success('Synced successfully', { id: toastId });
            } else {
                toast.error('Sync failed', { id: toastId });
            }
        } finally {
            setIsSyncing(false);
        }
    };

    const publishRoutine = async () => {
        if (!currentRoutineId) return;
        if (hasUnsavedChanges) await saveRoutine();
        
        const toastId = toast.loading('Publishing routine...');
        const res = await fetch(`/api/admin/routine-maker/${currentRoutineId}/publish`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (res.ok) {
            const data = await res.json();
            toast.success(data.message, { id: toastId });
        } else {
            toast.error('Failed to publish', { id: toastId });
        }
    };

    // --- GRID OPERATIONS ---
    
    const pushHistory = (newGrid: GridState) => {
        const snap = JSON.stringify(newGrid);
        const newHist = history.slice(0, historyIndex + 1);
        newHist.push(snap);
        if (newHist.length > 50) newHist.shift(); // keep 50
        setHistory(newHist);
        setHistoryIndex(newHist.length - 1);
        setHasUnsavedChanges(true);
    };

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setGrid(JSON.parse(history[newIndex]));
            setHistoryIndex(newIndex);
            setHasUnsavedChanges(true);
            setActionLog(prev => prev.slice(1));
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIdx = historyIndex + 1;
            setGrid(JSON.parse(history[newIdx]));
            setHistoryIndex(newIdx);
            setHasUnsavedChanges(true);
        }
    }, [history, historyIndex]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleUndo, handleRedo]);

    const updateCell = (day: string, rowId: string, pIdx: number, slotData: Slot) => {
        const newGrid = { ...grid };
        const row = newGrid[day].find(r => r.id === rowId);
        if (row) {
            row.slots[pIdx] = slotData;
            setGrid(newGrid);
            pushHistory(newGrid);
            
            if (slotData) {
                logAction(`Assigned ${slotData.faculty} to ${day} P${pIdx + 1}`);
            } else {
                logAction(`Cleared cell on ${day} P${pIdx + 1}`);
            }
        }
    };

    const addRow = (day: string) => {
        const newGrid = { ...grid };
        newGrid[day].push({ id: Math.random().toString(36).substr(2, 9), slots: Array(9).fill(null) });
        setGrid(newGrid);
        pushHistory(newGrid);
        logAction(`Added parallel row to ${day}`);
    };

    const removeRow = (day: string, rowId: string) => {
        const newGrid = { ...grid };
        if (newGrid[day].length > 1) {
            newGrid[day] = newGrid[day].filter(r => r.id !== rowId);
            setGrid(newGrid);
            pushHistory(newGrid);
            logAction(`Removed parallel row from ${day}`);
        }
    };

    const handleDragStart = (e: React.DragEvent | React.TouchEvent, day: string, rowId: string, pIdx: number, slot: Slot) => {
        if (!slot || isLocked(day, rowId, pIdx)) { 
            if ('preventDefault' in e && e.type === 'dragstart') e.preventDefault(); 
            return; 
        }
        if ('dataTransfer' in e) {
            e.dataTransfer.setData('application/json', JSON.stringify({ day, rowId, pIdx, slot }));
        }
    };

    const handleDrop = (e: React.DragEvent, targetDay: string, targetRowId: string, targetPIdx: number) => {
        e.preventDefault();
        if (isLocked(targetDay, targetRowId, targetPIdx)) { toast.error("Cell is locked"); return; }
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { day: srcDay, rowId: srcRowId, pIdx: srcPIdx, slot: srcSlot } = data;
            
            const newGrid = { ...grid };
            
            // Get target slot
            const targetRow = newGrid[targetDay].find(r => r.id === targetRowId);
            const targetSlot = targetRow?.slots[targetPIdx] || null;

            // Swap
            const srcRow = newGrid[srcDay].find(r => r.id === srcRowId);
            if (srcRow && targetRow) {
                srcRow.slots[srcPIdx] = targetSlot;
                targetRow.slots[targetPIdx] = srcSlot;
                setGrid(newGrid);
                pushHistory(newGrid);
                logAction(`Swapped cells between ${srcDay} P${srcPIdx+1} and ${targetDay} P${targetPIdx+1}`);
                
                // Animation
                setSwapAnimation([
                    { day: srcDay, rowId: srcRowId, pIdx: srcPIdx },
                    { day: targetDay, rowId: targetRowId, pIdx: targetPIdx }
                ]);
                setTimeout(() => setSwapAnimation([]), 600);
            }
        } catch (e) {}
    };

    // Context Menu Actions
    const isLocked = (day: string, rowId: string, pIdx: number) => {
        return lockedCells.some(c => c.day === day && c.rowId === rowId && c.periodIndex === pIdx);
    };

    const toggleLock = () => {
        if (!contextMenu) return;
        const { day, rowId, pIdx } = contextMenu;
        if (isLocked(day, rowId, pIdx)) {
            setLockedCells(lockedCells.filter(c => !(c.day === day && c.rowId === rowId && c.periodIndex === pIdx)));
        } else {
            setLockedCells([...lockedCells, { day, rowId, periodIndex: pIdx }]);
        }
        setHasUnsavedChanges(true);
        setContextMenu(null);
    };

    const handleContextMenu = (e: React.MouseEvent, day: string, rowId: string, pIdx: number) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, day, rowId, pIdx });
    };

    // RENDER HELPERS
    const getFacColor = (code: string) => {
        const f = faculties.find(f => f.code === code);
        return f ? f.color : '#4b5563';
    };

    const facultyLoadMap = React.useMemo(() => {
        const counts: Record<string, number> = {};
        DAYS.forEach(day => {
            (grid[day]||[]).forEach(row => {
                row.slots.forEach(s => {
                    if (s && s.faculty) {
                        counts[s.faculty] = (counts[s.faculty] || 0) + 1;
                    }
                });
            });
        });
        return counts;
    }, [grid]);

    const isCellGlowing = (day: string, pIdx: number, fac: string, room: string) => {
        if (glowingViolations.length === 0) return false;
        
        return violations.some(v => {
            if (!glowingViolations.includes(v.id)) return false;
            
            // Check if this cell matches the violation context
            if (v.day === day) {
                if (v.periodIndex === pIdx) {
                    if (v.faculty === fac || v.title === 'Room Conflict' && room && v.description.includes(room)) return true;
                }
                if (v.title === 'Daily Overload' && v.faculty === fac) return true;
                if ((v.title === '3 Consecutive Classes' || v.title === '2-1-2 Fatigue Pattern') && v.faculty === fac) {
                    // For patterns, glow the whole day for that faculty for simplicity, or specific periods
                    // Since specific periods are not explicitly listed in an array format easily parseable, 
                    // we'll glow all classes for that faculty on that day.
                    return true;
                }
            }
            if (v.title === 'Max 1st-Period Classes' && v.faculty === fac && pIdx === 0) return true;
            return false;
        });
    };

    const handleScrollSync = (e: any) => {
        if (topScrollRef.current && gridRef.current) {
            if (e.target === topScrollRef.current) gridRef.current.scrollLeft = e.target.scrollLeft;
            else topScrollRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    // RENDER COMPONENTS
    return (
        <div className="h-[calc(100vh)] bg-gray-950 text-white flex flex-col font-sans overflow-hidden" onClick={() => setContextMenu(null)}>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes swapFlash {
                    0% { background-color: rgba(34, 197, 94, 0.4); transform: scale(0.95); }
                    50% { background-color: rgba(34, 197, 94, 0.8); transform: scale(1.02); }
                    100% { background-color: transparent; transform: scale(1); }
                }
                .swapping {
                    animation: swapFlash 0.6s ease-out;
                    border-radius: 4px;
                    z-index: 10;
                }
            `}} />
            
            {/* TOP BAR */}
            <header className="bg-gray-900 border-b border-gray-800 p-2 md:p-4 flex flex-wrap justify-between items-center z-10 sticky top-0 shrink-0 gap-2">
                <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
                    <button className="p-1.5 bg-gray-800 rounded hover:bg-gray-700 tooltip" title="Back to Admin Dashboard" onClick={() => window.location.href = '/admin/dashboard'}>
                        <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <LayoutGrid className="w-5 h-5 md:w-6 md:h-6 text-indigo-400 shrink-0" />
                    <h1 className="text-base md:text-lg font-bold flex items-center gap-2 truncate">
                        Routine Maker
                    </h1>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
                    <select 
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs md:text-sm max-w-[120px] md:max-w-[200px] truncate"
                        value={currentRoutineId}
                        onChange={(e) => loadRoutine(e.target.value)}
                    >
                        {routines.map(r => (
                            <option key={r._id} value={r._id}>{r.name} {r.isArchived ? '(Archived)' : ''}</option>
                        ))}
                    </select>
                    
                    <button onClick={createNewRoutine} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded tooltip shrink-0" title="New Routine">
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={duplicateRoutine} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded tooltip shrink-0" title="Duplicate">
                        <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={deleteRoutine} className="p-1.5 bg-red-900/40 text-red-400 hover:bg-red-900/80 rounded tooltip shrink-0" title="Delete Routine">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <input 
                        className="bg-transparent border-b border-gray-600 focus:border-indigo-400 outline-none px-2 py-1 mx-1 text-xs md:text-sm w-24 md:w-40"
                        value={routineName}
                        onChange={(e) => { setRoutineName(e.target.value); setHasUnsavedChanges(true); }}
                    />

                    <div className="flex items-center gap-2 ml-1 md:ml-4 shrink-0">
                        <span className={`text-[10px] md:text-xs hidden sm:block ${hasUnsavedChanges ? 'text-amber-400' : 'text-gray-400'}`}>
                            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Unsaved changes' : 'Saved ✓'}
                        </span>
                        <button onClick={saveRoutine} className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs md:text-sm transition-colors">
                            <Save className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden md:inline">Save</span>
                        </button>
                        
                        <div className="h-4 md:h-6 w-px bg-gray-700 mx-0.5 md:mx-1"></div>
                        
                        <button 
                            onClick={syncWithSheet} 
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded font-medium transition-colors text-xs md:text-sm"
                        >
                            <RefreshCw className={`w-3 h-3 md:w-4 md:h-4 ${isSyncing ? 'animate-spin' : ''}`} /> <span className="hidden lg:inline">Sync</span>
                        </button>
                        
                        <button onClick={publishRoutine} className="flex items-center gap-1.5 px-3 md:px-4 py-1 md:py-1.5 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-colors shadow-lg shadow-green-900/20 text-xs md:text-sm">
                            <Upload className="w-3 h-3 md:w-4 md:h-4" /> <span className="hidden md:inline">Publish</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* LEFT: MAIN WORKSPACE */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* TABS */}
                    <div className="flex bg-gray-900 border-b border-gray-800 px-2 md:px-4 overflow-x-auto shrink-0 custom-scrollbar">
                        <button className={`px-3 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'grid' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('grid')}>Grid Editor</button>
                        <button className={`px-3 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'faculty' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('faculty')}>Faculty Manager</button>
                        <button className={`px-3 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'rules' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('rules')}>Mapping Rules</button>
                        {isSuperAdmin && (
                            <button className={`px-3 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'access' ? 'border-red-500 text-red-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('access')}>Access Control</button>
                        )}
                        <div className="flex-1"></div>
                        
                        {/* EXPORT SUITE */}
                        <div className="flex items-center group relative z-50">
                            <button 
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm bg-gray-800 rounded hover:bg-gray-700 whitespace-nowrap"
                                onClick={() => setExportOpen(true)}
                            >
                                <Download className="w-3 h-3 md:w-4 md:h-4" /> Export
                            </button>
                        </div>
                    </div>

                    {/* TAB CONTENT */}
                    <div className="flex-1 overflow-auto p-2 md:p-4 custom-scrollbar bg-[#0a0a0a] relative">
                        
                        {activeTab === 'grid' && (
                            <div className="flex flex-col gap-3 h-full">
                                {/* FILTER & STATS BAR */}
                                <div className="bg-gray-900 rounded-lg p-2 md:p-3 border border-gray-800 shrink-0">
                                    <div className="flex items-center gap-2 flex-wrap max-h-32 overflow-y-auto custom-scrollbar">
                                        <span className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider font-semibold">Quick View:</span>
                                        <button 
                                            onClick={() => setSelectedFacultyFilter(null)}
                                            className={`px-2 py-1 text-[10px] md:text-xs rounded-full transition-all ${!selectedFacultyFilter ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                        >
                                            All
                                        </button>
                                        <div className="w-px h-3 bg-gray-700"></div>
                                        {faculties.map(fac => (
                                            <button 
                                                key={fac.code}
                                                onClick={() => setSelectedFacultyFilter(fac.code)}
                                                className={`px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded-full font-medium transition-all flex items-center gap-1 md:gap-1.5`}
                                                style={{
                                                    backgroundColor: selectedFacultyFilter === fac.code ? fac.color : `${fac.color}20`,
                                                    color: selectedFacultyFilter === fac.code ? '#fff' : fac.color,
                                                    border: `1px solid ${fac.color}40`
                                                }}
                                            >
                                                {fac.code} <span className="bg-black/20 px-1 rounded">{facultyLoadMap[fac.code] || 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* THE GRID */}
                                <div className="flex-1 min-h-0 flex flex-col bg-gray-900 rounded-lg border border-gray-800 shadow-2xl relative">
                                    {/* Top Scrollbar Mock */}
                                    <div 
                                        className="h-2 overflow-x-auto overflow-y-hidden shrink-0 custom-scrollbar opacity-50 hover:opacity-100"
                                        ref={topScrollRef}
                                        onScroll={handleScrollSync}
                                    >
                                        <div className="h-full" style={{ width: '1200px' }}></div>
                                    </div>

                                    {/* Scrollable grid area */}
                                    <div 
                                        className="flex-1 overflow-auto custom-scrollbar printable-grid"
                                        ref={gridRef}
                                        onScroll={handleScrollSync}
                                    >
                                        <div className="min-w-[1000px] lg:min-w-[1200px]">
                                            {/* Header */}
                                            <div className="flex border-b border-gray-800 bg-gray-950 sticky top-0 z-20 shadow-md">
                                                <div className="w-14 md:w-24 shrink-0 p-2 border-r border-gray-800 flex items-center justify-center font-bold text-gray-500 text-[10px] md:text-xs tracking-wider bg-gray-950 sticky left-0 z-20">DAY</div>
                                                <div className="flex-1 grid grid-cols-9 divide-x divide-gray-800">
                                                    {TIME_LABELS.map((t, i) => (
                                                        <div key={i} className="p-1 md:p-2 text-center bg-gray-950">
                                                            <div className="text-[10px] md:text-xs font-bold text-gray-400">P{i+1}</div>
                                                            <div className="text-[8px] md:text-[10px] text-gray-600 hidden sm:block">{t}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Body */}
                                            <div className="pb-20">
                                                {DAYS.map((day, dIdx) => {
                                                    const isAlternate = dIdx % 2 !== 0;
                                                    const bgTint = isAlternate ? 'bg-gray-800/30' : 'bg-gray-900/50';
                                                    let rowsToRender = grid[day] || [];
                                                    
                                                    // Condense view for selected faculty
                                                    if (selectedFacultyFilter) {
                                                        const condensedRow = { id: `condensed-${day}`, slots: Array(9).fill(null) };
                                                        rowsToRender.forEach(r => {
                                                            r.slots.forEach((s, i) => {
                                                                if (s && s.faculty === selectedFacultyFilter) {
                                                                    condensedRow.slots[i] = s;
                                                                }
                                                            });
                                                        });
                                                        rowsToRender = [condensedRow];
                                                    }

                                                    return (
                                                        <div key={day} className={`flex relative ${bgTint} ${dIdx > 0 ? 'border-t-[3px] border-t-indigo-500/40' : ''}`}>
                                                            <div className="w-14 md:w-24 shrink-0 p-1 md:p-3 flex flex-col items-center justify-start border-r border-gray-800 bg-black/20 relative sticky left-0 z-10">
                                                                <div className="sticky top-[40vh] transform flex flex-col items-center gap-4">
                                                                    <span className="font-bold text-[9px] md:text-sm tracking-widest -rotate-90 uppercase text-gray-400 whitespace-nowrap mt-10 md:mt-16">{day.slice(0,3)}</span>
                                                                    {!selectedFacultyFilter && (
                                                                        <button onClick={() => addRow(day)} className="p-1 bg-gray-800 hover:bg-gray-700 rounded tooltip opacity-50 hover:opacity-100" title="Add Parallel Row">
                                                                            <Plus className="w-3 h-3 md:w-4 md:h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex-1 flex flex-col divide-y divide-gray-800/50">
                                                                {rowsToRender.map((row, rIdx) => (
                                                                    <div key={row.id} className="grid grid-cols-9 divide-x divide-gray-800 group relative">
                                                                        {row.slots.map((slot, pIdx) => {
                                                                            const locked = !selectedFacultyFilter && isLocked(day, row.id, pIdx);
                                                                            const facColor = slot ? getFacColor(slot.faculty) : '';
                                                                            const glowing = slot && isCellGlowing(day, pIdx, slot.faculty, slot.room);
                                                                            const isSwapping = swapAnimation.some(a => a.day === day && a.rowId === row.id && a.pIdx === pIdx);
                                                                            
                                                                            return (
                                                                                <div 
                                                                                    key={pIdx}
                                                                                    className={`min-h-[50px] md:min-h-[85px] p-0.5 md:p-1 relative transition-all ${isSwapping ? 'swapping' : ''}`}
                                                                                    onDragOver={(e) => e.preventDefault()}
                                                                                    onDrop={(e) => handleDrop(e, day, row.id, pIdx)}
                                                                                    onContextMenu={(e) => handleContextMenu(e, day, row.id, pIdx)}
                                                                                    onClick={() => {
                                                                                        if (!locked && !slot && !selectedFacultyFilter) setCellModal({day, rowId: row.id, pIdx});
                                                                                    }}
                                                                                >
                                                                                    {slot ? (
                                                                                        <div 
                                                                                            draggable={!locked && !selectedFacultyFilter}
                                                                                            onDragStart={(e) => handleDragStart(e, day, row.id, pIdx, slot)}
                                                                                            onClick={() => { if(!locked && !selectedFacultyFilter) setCellModal({day, rowId: row.id, pIdx}); }}
                                                                                            className={`w-full h-full p-1 border-l-4 overflow-hidden relative group/cell transition-shadow duration-300 ${!selectedFacultyFilter && !locked ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${glowing ? `ring-2 ring-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.7)]` : ''}`}
                                                                                            style={{
                                                                                                backgroundColor: `${facColor}15`,
                                                                                                borderLeftColor: facColor,
                                                                                                borderRight: `1px solid ${facColor}30`,
                                                                                                borderTop: `1px solid ${facColor}30`,
                                                                                                borderBottom: `1px solid ${facColor}30`,
                                                                                                borderRadius: '4px'
                                                                                            }}
                                                                                        >
                                                                                            <div className="flex justify-between items-start leading-none mb-1">
                                                                                                <span className="font-bold text-[10px] md:text-sm" style={{color: facColor}}>{slot.faculty}</span>
                                                                                                <span className="text-[8px] md:text-[10px] font-mono px-1 rounded bg-black/30" style={{color: facColor}}>{slot.type}</span>
                                                                                            </div>
                                                                                            <div className="text-[9px] md:text-xs font-medium truncate leading-tight">{slot.course}</div>
                                                                                            <div className="flex justify-between items-end mt-1 pt-1 md:mt-auto">
                                                                                                <span className="text-[8px] md:text-[10px] text-gray-500 truncate max-w-[50%]">{slot.dept}</span>
                                                                                                <span className="text-[8px] md:text-[10px] text-gray-300 font-mono bg-black/50 px-1 rounded">{slot.room}</span>
                                                                                            </div>
                                                                                            
                                                                                            {locked && <Lock className="w-3 h-3 text-gray-400 absolute bottom-1 right-1 opacity-50" />}
                                                                                            
                                                                                            {!locked && !selectedFacultyFilter && (
                                                                                                <button 
                                                                                                    className="absolute top-0 right-0 md:top-1 md:right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 bg-red-500/80 rounded text-white z-10"
                                                                                                    onClick={(e) => { e.stopPropagation(); updateCell(day, row.id, pIdx, null); }}
                                                                                                >
                                                                                                    <X className="w-2 h-2 md:w-3 md:h-3" />
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className={`w-full h-full rounded transition-colors flex items-center justify-center ${selectedFacultyFilter ? 'bg-transparent' : 'hover:bg-gray-800/50 cursor-pointer group-hover:bg-gray-800/20'}`}>
                                                                                            {!selectedFacultyFilter && <Plus className="w-3 h-3 md:w-4 md:h-4 text-gray-700 opacity-0 group-hover:opacity-100" />}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        
                                                                        {/* Row delete button */}
                                                                        {!selectedFacultyFilter && (
                                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 z-10">
                                                                                <button onClick={() => removeRow(day, row.id)} className="p-1 bg-red-500/80 text-white hover:bg-red-500 hover:scale-110 shadow shadow-black/50 rounded-full transition-all">
                                                                                    <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'faculty' && (
                            <div className="max-w-6xl mx-auto space-y-6">
                                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="text-indigo-400"/> Manage Faculties</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                                        {faculties.map((fac, idx) => (
                                            <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-4 relative group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={fac.color} onChange={(e) => {
                                                            const newF = [...faculties];
                                                            newF[idx].color = e.target.value;
                                                            setFaculties(newF); setHasUnsavedChanges(true);
                                                        }} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                                                        <input value={fac.code} onChange={(e) => {
                                                            const newF = [...faculties];
                                                            newF[idx].code = e.target.value.toUpperCase();
                                                            setFaculties(newF); setHasUnsavedChanges(true);
                                                        }} className="bg-transparent font-bold text-lg w-20 outline-none" placeholder="CODE" />
                                                    </div>
                                                    <button onClick={() => {
                                                        setFaculties(faculties.filter((_, i) => i !== idx)); setHasUnsavedChanges(true);
                                                    }} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                                <input value={fac.name} placeholder="Full Name" onChange={(e) => {
                                                    const newF = [...faculties];
                                                    newF[idx].name = e.target.value;
                                                    setFaculties(newF); setHasUnsavedChanges(true);
                                                }} className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-full outline-none mb-2" />
                                                <div className="flex gap-2 mb-4">
                                                    <input value={fac.designation || ''} placeholder="Designation" onChange={(e) => {
                                                        const newF = [...faculties];
                                                        newF[idx].designation = e.target.value;
                                                        setFaculties(newF); setHasUnsavedChanges(true);
                                                    }} className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm flex-1 min-w-0 outline-none" />
                                                    <input value={fac.employeeCode || ''} placeholder="Emp. Code" onChange={(e) => {
                                                        const newF = [...faculties];
                                                        newF[idx].employeeCode = e.target.value;
                                                        setFaculties(newF); setHasUnsavedChanges(true);
                                                    }} className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm w-24 shrink-0 outline-none" />
                                                </div>
                                                
                                                {/* Mini Availability Matrix (Days=Rows, Periods=Cols) */}
                                                <div className="text-xs text-gray-400 mb-2 font-semibold">Availability</div>
                                                <div className="flex flex-col gap-1">
                                                    {DAYS.map(d => (
                                                        <div key={d} className="flex items-center gap-1">
                                                            <div className="w-6 text-[9px] text-gray-500 font-bold uppercase">{d.slice(0,2)}</div>
                                                            <div className="flex-1 grid grid-cols-9 gap-0.5">
                                                                {(fac.availability?.[d] || Array(9).fill(true)).map((av, p) => (
                                                                    <button key={p} onClick={() => {
                                                                        const newF = [...faculties];
                                                                        if(!newF[idx].availability) newF[idx].availability = {};
                                                                        if(!newF[idx].availability[d]) newF[idx].availability[d] = Array(9).fill(true);
                                                                        newF[idx].availability[d][p] = !av;
                                                                        setFaculties(newF); setHasUnsavedChanges(true);
                                                                    }} className={`h-3 md:h-4 rounded-sm transition-colors ${av ? 'bg-green-500/80 hover:bg-green-500' : 'bg-red-500/80 hover:bg-red-500'}`} title={`${d} P${p+1}`}></button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => {
                                            const newColor = FACULTY_COLORS_14[faculties.length % 14];
                                            setFaculties([...faculties, { code: 'NEW', name: '', color: newColor, availability: {} }]);
                                            setHasUnsavedChanges(true);
                                        }} className="min-h-[200px] border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg flex flex-col items-center justify-center p-6 text-gray-500 hover:text-gray-300 transition-colors">
                                            <Plus className="w-8 h-8 mb-2" />
                                            <span>Add Faculty</span>
                                        </button>
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <button onClick={() => {
                                            const newF = faculties.map((f, i) => ({...f, color: FACULTY_COLORS_14[i % 14]}));
                                            setFaculties(newF);
                                            setHasUnsavedChanges(true);
                                        }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
                                            Auto-Assign 14 Unique Colors
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rules' && (
                            <div className="max-w-3xl mx-auto space-y-6">
                                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="text-indigo-400"/> Load Matrix Mapping Rules</h2>
                                    <p className="text-sm text-gray-400 mb-4">Rules are evaluated top to bottom. First match applies. If no match, defaults to <span className="font-mono font-bold text-white bg-gray-800 px-1 rounded">1L</span>.</p>
                                    
                                    {/* Examples / Help Section */}
                                    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4 mb-6">
                                        <h3 className="text-sm font-bold text-indigo-400 mb-3">📖 How Mapping Rules Work</h3>
                                        <p className="text-xs text-gray-400 mb-3">Each rule matches the <span className="font-mono text-white">"starts with"</span> field against the raw course string from the routine. The raw string is built as: <span className="font-mono text-amber-300">TYPE/COURSE_CODE</span> (e.g., <span className="font-mono text-green-400">T1/MTH1201</span>, <span className="font-mono text-green-400">P/MTH2252</span>, <span className="font-mono text-green-400">MTH2202</span>).</p>
                                        <div className="text-xs font-bold text-gray-300 mb-2">Example Mappings:</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                                                <span className="font-mono text-cyan-400 w-28 shrink-0">MTH1101</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="font-mono font-bold text-white">1L</span>
                                                <span className="text-gray-500 ml-auto">(1st yr Lecture)</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                                                <span className="font-mono text-cyan-400 w-28 shrink-0">MTH1201</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="font-mono font-bold text-white">2L</span>
                                                <span className="text-gray-500 ml-auto">(2nd yr Lecture)</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                                                <span className="font-mono text-cyan-400 w-28 shrink-0">T1/MTH</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="font-mono font-bold text-white">2T</span>
                                                <span className="text-gray-500 ml-auto">(Tutorial group)</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                                                <span className="font-mono text-cyan-400 w-28 shrink-0">P/MTH2252</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="font-mono font-bold text-white">4P</span>
                                                <span className="text-gray-500 ml-auto">(Practical, 0.5 load)</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                                                <span className="font-mono text-cyan-400 w-28 shrink-0">MTH5</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="font-mono font-bold text-white">M1</span>
                                                <span className="text-gray-500 ml-auto">(M.Tech 1st yr)</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2">
                                                <span className="font-mono text-cyan-400 w-28 shrink-0">CBS</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="font-mono font-bold text-white">3P</span>
                                                <span className="text-gray-500 ml-auto">(Practical, 0.5 load)</span>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-[10px] text-gray-500 border-t border-gray-700 pt-2">
                                            <strong>Load Calculation:</strong> 2L/4L/6L/8L/M1/M2/1L = <span className="text-green-400">+1 load</span> each  •  4P/3P = <span className="text-amber-400">+0.5 load</span> each  •  2T = <span className="text-blue-400">counted as tutorial</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        {mappingRules.map((rule, idx) => (
                                            <div key={idx} className="flex items-center gap-2 md:gap-3">
                                                <div className="text-xs md:text-sm text-gray-500 w-16 md:w-24 text-right shrink-0">If starts</div>
                                                <input value={rule.startsWith} onChange={(e) => {
                                                    const nr = [...mappingRules]; nr[idx].startsWith = e.target.value;
                                                    setMappingRules(nr); setHasUnsavedChanges(true);
                                                }} className="bg-gray-800 border border-gray-700 rounded px-2 md:px-3 py-1.5 flex-1 outline-none font-mono text-sm w-full min-w-0" placeholder="e.g. MTH1201 or T1/MTH" />
                                                <div className="text-xs md:text-sm text-gray-500 shrink-0">→ map</div>
                                                <input value={rule.mapsTo} onChange={(e) => {
                                                    const nr = [...mappingRules]; nr[idx].mapsTo = e.target.value;
                                                    setMappingRules(nr); setHasUnsavedChanges(true);
                                                }} className="bg-gray-800 border border-gray-700 rounded px-2 md:px-3 py-1.5 w-16 md:w-24 outline-none font-bold text-center shrink-0" placeholder="e.g. 2L" />
                                                <button onClick={() => {
                                                    setMappingRules(mappingRules.filter((_, i) => i !== idx)); setHasUnsavedChanges(true);
                                                }} className="p-1.5 text-gray-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => {
                                        setMappingRules([...mappingRules, { startsWith: '', mapsTo: '1L' }]); setHasUnsavedChanges(true);
                                    }} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm w-full justify-center">
                                        <Plus className="w-4 h-4" /> Add Rule
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'access' && isSuperAdmin && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="text-red-400"/> Access Control</h2>
                                    <p className="text-sm text-gray-400 mb-6">Only users checked below can see and use the Routine Maker. You (RB) always have access.</p>
                                    <AccessControlList />
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* RIGHT SIDEBAR: CONSTRAINTS */}
                {activeTab === 'grid' && (
                    <div className={`${engineExpanded ? 'w-64 md:w-80' : 'w-10'} transition-all duration-300 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 overflow-hidden relative`}>
                        <div className={`p-3 md:p-4 border-b border-gray-800 bg-gray-950/50 flex justify-between items-center h-14 ${engineExpanded ? '' : ''}`}>
                            <div className={`flex flex-col ${engineExpanded ? '' : 'hidden'}`}>
                                <h2 className="font-bold flex items-center gap-2 whitespace-nowrap">
                                    <AlertTriangle className={`w-4 h-4 md:w-5 md:h-5 ${violations.length > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                                    Live Engine
                                </h2>
                                <div className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{violations.length} active flags</div>
                            </div>
                            
                            <button 
                                onClick={() => setEngineExpanded(!engineExpanded)}
                                className={`bg-gray-800 border border-gray-700 rounded-full p-1.5 hover:bg-gray-700 text-gray-400 hover:text-white ${engineExpanded ? '' : 'absolute right-1 top-3'}`}
                                title={engineExpanded ? "Minimize Live Engine" : "Expand Live Engine"}
                            >
                                {engineExpanded ? <ChevronRight className="w-4 h-4" /> : <AlertTriangle className={`w-4 h-4 ${violations.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />}
                            </button>
                        </div>
                        
                        <div className={`flex-1 overflow-auto p-2 md:p-4 space-y-2 md:space-y-3 custom-scrollbar ${engineExpanded ? '' : 'invisible'}`}>
                            {violations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-6 text-gray-500 h-full">
                                    <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-green-500/20 mb-3" />
                                    <p className="text-sm">No constraint violations!</p>
                                </div>
                            ) : (
                                violations.map(v => {
                                    const isGlowing = glowingViolations.includes(v.id);
                                    return (
                                        <div 
                                            key={v.id} 
                                            onClick={() => {
                                                if (isGlowing) setGlowingViolations(glowingViolations.filter(id => id !== v.id));
                                                else setGlowingViolations([...glowingViolations, v.id]);
                                            }}
                                            className={`p-2 md:p-3 rounded-lg border text-xs md:text-sm cursor-pointer transition-all hover:scale-[1.02] ${isGlowing ? 'ring-2 ring-indigo-500 bg-indigo-900/20' : v.type === 'error' ? 'bg-red-950/30 border-red-900/50' : 'bg-amber-950/30 border-amber-900/50'}`}
                                        >
                                            <div className="flex items-start gap-2">
                                                {v.type === 'error' ? <X className="w-3 h-3 md:w-4 md:h-4 text-red-500 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3 h-3 md:w-4 md:h-4 text-amber-500 mt-0.5 shrink-0" />}
                                                <div>
                                                    <div className={`font-bold ${v.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{v.title}</div>
                                                    <div className="text-gray-300 mt-0.5 md:mt-1 text-[10px] md:text-xs leading-tight">{v.description}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Recent Changes Log */}
                        <div className={`border-t border-gray-800 bg-gray-950/50 flex flex-col shrink-0 overflow-hidden transition-all duration-300 ${engineExpanded ? 'h-48' : 'h-0 border-transparent'}`}>
                            <div className="px-3 py-2 border-b border-gray-800 flex justify-between items-center">
                                <h3 className="text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
                                    <History className="w-3 h-3" /> Recent Changes
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto p-2 custom-scrollbar space-y-1.5">
                                {actionLog.length === 0 ? (
                                    <div className="text-center text-[10px] text-gray-600 italic py-4">No recent changes</div>
                                ) : (
                                    actionLog.map((log, i) => (
                                        <div key={i} className="text-[10px] md:text-xs text-gray-400 bg-gray-900/50 rounded px-2 py-1.5 border border-gray-800/50 flex items-start gap-2">
                                            <span className="text-gray-600 shrink-0 mt-0.5">{log.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                            <span className="leading-tight">{log.msg}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <div 
                    className="fixed bg-gray-800 border border-gray-700 rounded shadow-2xl py-1 z-50 text-sm w-48"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <div className="px-3 py-1 text-xs text-gray-500 font-bold border-b border-gray-700 mb-1">
                        {contextMenu.day} Period {contextMenu.pIdx + 1}
                    </div>
                    <button 
                        className="w-full text-left px-4 py-1.5 hover:bg-gray-700 flex items-center gap-2"
                        onClick={() => {
                            const r = grid[contextMenu.day]?.find(rx => rx.id === contextMenu.rowId);
                            if(r) setClipboardCell(r.slots[contextMenu.pIdx]);
                            setContextMenu(null);
                            toast.success('Copied');
                        }}
                    >
                        <Copy className="w-4 h-4" /> Copy Cell
                    </button>
                    <button 
                        className="w-full text-left px-4 py-1.5 hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                        disabled={!clipboardCell || isLocked(contextMenu.day, contextMenu.rowId, contextMenu.pIdx)}
                        onClick={() => {
                            if(clipboardCell) updateCell(contextMenu.day, contextMenu.rowId, contextMenu.pIdx, {...clipboardCell});
                            setContextMenu(null);
                        }}
                    >
                        <Download className="w-4 h-4 rotate-180" /> Paste Cell
                    </button>
                    <button 
                        className="w-full text-left px-4 py-1.5 hover:bg-gray-700 flex items-center gap-2"
                        onClick={() => {
                            updateCell(contextMenu.day, contextMenu.rowId, contextMenu.pIdx, null);
                            setContextMenu(null);
                        }}
                        disabled={isLocked(contextMenu.day, contextMenu.rowId, contextMenu.pIdx)}
                    >
                        <Trash2 className="w-4 h-4" /> Clear
                    </button>
                    <div className="h-px bg-gray-700 my-1"></div>
                    <button 
                        className="w-full text-left px-4 py-1.5 hover:bg-gray-700 flex items-center gap-2"
                        onClick={toggleLock}
                    >
                        {isLocked(contextMenu.day, contextMenu.rowId, contextMenu.pIdx) ? <><Unlock className="w-4 h-4" /> Unlock</> : <><Lock className="w-4 h-4" /> Lock</>}
                    </button>
                </div>
            )}

            {/* CELL EDITOR MODAL */}
            {cellModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
                        <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="font-bold">Assign Class</h3>
                            <button onClick={() => setCellModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <CellEditorForm 
                                faculties={faculties}
                                initialData={grid[cellModal.day]?.find(r=>r.id===cellModal.rowId)?.slots[cellModal.pIdx] || { faculty: faculties[0]?.code||'', type: 'L', course: '', dept: '', room: '' }}
                                onSave={(data: any) => {
                                    updateCell(cellModal.day, cellModal.rowId, cellModal.pIdx, data);
                                    setCellModal(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* EXPORT MODAL */}
            {exportOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
                            <h3 className="font-bold flex items-center gap-2"><Download className="w-4 h-4 text-indigo-400" /> Export Options</h3>
                            <button onClick={() => setExportOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <button onClick={() => { exportMasterCSV(grid); setExportOpen(false); }} className="w-full text-left px-4 py-3 text-sm rounded hover:bg-gray-800 transition-colors flex items-center gap-3">
                                <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded"><Download className="w-4 h-4" /></span> Master CSV
                            </button>
                            <button onClick={() => { exportDeptCourseCSV(grid); setExportOpen(false); }} className="w-full text-left px-4 py-3 text-sm rounded hover:bg-gray-800 transition-colors flex items-center gap-3">
                                <span className="p-1.5 bg-purple-500/20 text-purple-400 rounded"><Download className="w-4 h-4" /></span> Dept & Course Excel
                            </button>
                            <button onClick={() => { exportLoadMatrixExcel(grid, faculties, mappingRules); setExportOpen(false); }} className="w-full text-left px-4 py-3 text-sm rounded hover:bg-gray-800 transition-colors flex items-center gap-3">
                                <span className="p-1.5 bg-green-500/20 text-green-400 rounded"><Download className="w-4 h-4" /></span> Load Matrix Excel
                            </button>
                            <button onClick={() => { exportFacultyExcel(grid, faculties); setExportOpen(false); }} className="w-full text-left px-4 py-3 text-sm rounded hover:bg-gray-800 transition-colors flex items-center gap-3">
                                <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded"><Download className="w-4 h-4" /></span> Faculty Excel (Tabs)
                            </button>
                            
                            {currentRoutineId && (
                                <div className="mt-4 p-3 bg-indigo-900/20 border border-indigo-800 rounded text-xs">
                                    <div className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                                        Google Sheets Apps Script URL:
                                    </div>
                                    <div className="text-gray-400 mb-2">Use this link in the Apps Script prompt to auto-sync this routine:</div>
                                    <div className="flex gap-2">
                                        <input 
                                            readOnly
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/admin/routine-maker/${currentRoutineId}/export/master`}
                                            className="bg-black/50 border border-indigo-900 rounded p-1.5 w-full text-indigo-200"
                                        />
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/api/admin/routine-maker/${currentRoutineId}/export/master`);
                                                toast.success("URL Copied!");
                                            }}
                                            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 px-3 rounded text-white font-bold"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <div className="mt-3">
                                        <a 
                                            href="https://docs.google.com/spreadsheets/d/1KwiRB4aGNhrSstNtuCuHUUQC_Zh2Ja1QIfP1zIHHDFM/edit?gid=0#gid=0" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block w-full text-center py-2 bg-green-600 hover:bg-green-500 rounded text-white font-semibold transition-colors flex items-center justify-center gap-2"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open Master Google Sheet
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// Mini Component for Cell Form
function CellEditorForm({ faculties, initialData, onSave }: any) {
    const [data, setData] = useState(initialData);
    return (
        <>
            <div>
                <label className="block text-xs text-gray-400 mb-1">Faculty</label>
                <select value={data.faculty} onChange={e=>setData({...data, faculty: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 outline-none">
                    {faculties.map((f:any) => <option key={f.code} value={f.code}>{f.name && f.name !== f.code ? `${f.code} - ${f.name}` : f.code}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Type</label>
                    <select value={data.type} onChange={e=>setData({...data, type: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 outline-none">
                        <option value="L">L (Lecture)</option>
                        <option value="T1">T1 (Tutorial)</option>
                        <option value="T2">T2 (Tutorial)</option>
                        <option value="P">P (Practical)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Room</label>
                    <input value={data.room} onChange={e=>setData({...data, room: e.target.value})} placeholder="e.g. 301" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 outline-none uppercase" />
                </div>
            </div>
            <div>
                <label className="block text-xs text-gray-400 mb-1">Course Code</label>
                <input value={data.course} onChange={e=>setData({...data, course: e.target.value})} placeholder="e.g. MTH1101" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 outline-none uppercase font-mono" />
            </div>
            <div>
                <label className="block text-xs text-gray-400 mb-1">Department/Group</label>
                <input value={data.dept} onChange={e=>setData({...data, dept: e.target.value})} placeholder="e.g. ECEC" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 outline-none uppercase font-mono" />
            </div>
            <button onClick={() => onSave(data)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded mt-2">Save Assignment</button>
        </>
    );
}

// Mini Component for Access Control
function AccessControlList() {
    const [admins, setAdmins] = useState<any[]>([]);
    
    useEffect(() => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const h: any = {};
        if (u.email) h['X-User-Email'] = u.email;
        if (localStorage.getItem('globalAdminActive') === 'true') {
            h['X-Global-Admin-Key'] = 'globaladmin_25';
        }
        
        fetch('/api/admin/routine-maker/access', { headers: h })
            .then(r => r.json())
            .then(data => { if(Array.isArray(data)) setAdmins(data); })
            .catch(()=>{});
    }, []);

    const toggle = async (email: string, grant: boolean) => {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const h: any = { 'Content-Type': 'application/json' };
        if (u.email) h['X-User-Email'] = u.email;
        if (localStorage.getItem('globalAdminActive') === 'true') {
            h['X-Global-Admin-Key'] = 'globaladmin_25';
        }
        
        await fetch('/api/admin/routine-maker/access', {
            method: 'POST', headers: h, body: JSON.stringify({ targetEmail: email, grant })
        });
        
        setAdmins(admins.map(a => a.email === email ? {...a, hasAccess: grant} : a));
    };

    return (
        <div className="divide-y divide-gray-800 border border-gray-800 rounded bg-gray-900/50">
            {admins.map(a => (
                <div key={a.email} className="flex justify-between items-center p-3">
                    <div>
                        <div className="font-bold text-sm">{a.name}</div>
                        <div className="text-xs text-gray-500">{a.email}</div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={a.hasAccess} 
                            disabled={a.isSuperAdmin}
                            onChange={(e) => toggle(a.email, e.target.checked)}
                            className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-xs">{a.isSuperAdmin ? '(Always)' : 'Allow'}</span>
                    </label>
                </div>
            ))}
        </div>
    );
}
