'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Plus, X, Save, Upload, Copy, Download, Settings, Users, AlertTriangle, CheckCircle2, LayoutGrid, FileSpreadsheet,
    Lock, Unlock, Shield, Trash2, Printer, Play, History
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
    GridState, FacultyData, checkConstraints, ConstraintViolation, Slot
} from './constraintUtils';
import { 
    exportMasterCSV, exportDeptCourseCSV, exportLoadMatrixCSV, exportFacultyPDFs
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
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    // History (Undo/Redo)
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Context Menu & Modals
    const [contextMenu, setContextMenu] = useState<{x: number, y: number, day: string, rowId: string, pIdx: number} | null>(null);
    const [cellModal, setCellModal] = useState<{day: string, rowId: string, pIdx: number} | null>(null);
    const [clipboardCell, setClipboardCell] = useState<Slot | null>(null);
    
    const gridRef = useRef<HTMLDivElement>(null);

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

    // Live Constraints
    useEffect(() => {
        setViolations(checkConstraints(grid, faculties));
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
            
            // Init history
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
            const newIdx = historyIndex - 1;
            setGrid(JSON.parse(history[newIdx]));
            setHistoryIndex(newIdx);
            setHasUnsavedChanges(true);
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
        }
    };

    const addRow = (day: string) => {
        const newGrid = { ...grid };
        newGrid[day] = [...(newGrid[day]||[]), { id: Math.random().toString(36).substr(2,9), slots: Array(9).fill(null) }];
        setGrid(newGrid);
        pushHistory(newGrid);
    };

    const removeRow = (day: string, rowId: string) => {
        const newGrid = { ...grid };
        newGrid[day] = newGrid[day].filter(r => r.id !== rowId);
        if (newGrid[day].length === 0) {
            newGrid[day].push({ id: Math.random().toString(36).substr(2,9), slots: Array(9).fill(null) });
        }
        setGrid(newGrid);
        pushHistory(newGrid);
    };

    const handleDragStart = (e: React.DragEvent, day: string, rowId: string, pIdx: number, slot: Slot) => {
        if (!slot || isLocked(day, rowId, pIdx)) { e.preventDefault(); return; }
        e.dataTransfer.setData('application/json', JSON.stringify({ day, rowId, pIdx, slot }));
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

    // RENDER COMPONENTS
    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans" onClick={() => setContextMenu(null)}>
            {/* TOP BAR */}
            <header className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <LayoutGrid className="w-6 h-6 text-indigo-400" />
                    <div>
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            Routine Maker
                            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">Enterprise</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select 
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                        value={currentRoutineId}
                        onChange={(e) => loadRoutine(e.target.value)}
                    >
                        {routines.map(r => (
                            <option key={r._id} value={r._id}>{r.name} {r.isArchived ? '(Archived)' : ''}</option>
                        ))}
                    </select>
                    
                    <button onClick={createNewRoutine} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded tooltip" title="New Routine">
                        <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={duplicateRoutine} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded tooltip" title="Duplicate">
                        <Copy className="w-4 h-4" />
                    </button>
                    
                    <input 
                        className="bg-transparent border-b border-gray-600 focus:border-indigo-400 outline-none px-2 py-1 mx-2"
                        value={routineName}
                        onChange={(e) => { setRoutineName(e.target.value); setHasUnsavedChanges(true); }}
                    />

                    <div className="flex items-center gap-2 ml-4">
                        <span className={`text-xs ${hasUnsavedChanges ? 'text-amber-400' : 'text-gray-400'}`}>
                            {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Unsaved changes...' : 'Saved ✓'}
                        </span>
                        <button onClick={saveRoutine} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors">
                            <Save className="w-4 h-4" /> Save
                        </button>
                        
                        <div className="h-6 w-px bg-gray-700 mx-1"></div>
                        
                        <button onClick={publishRoutine} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-colors shadow-lg shadow-green-900/20">
                            <Upload className="w-4 h-4" /> Publish
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: MAIN WORKSPACE */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* TABS */}
                    <div className="flex bg-gray-900 border-b border-gray-800 px-4">
                        <button className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'grid' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('grid')}>Grid Editor</button>
                        <button className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'faculty' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('faculty')}>Faculty Manager</button>
                        <button className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('rules')}>Mapping Rules</button>
                        {isSuperAdmin && (
                            <button className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'access' ? 'border-red-500 text-red-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`} onClick={() => setActiveTab('access')}>Access Control (RB)</button>
                        )}
                        <div className="flex-1"></div>
                        
                        {/* EXPORT SUITE */}
                        <div className="flex items-center group relative">
                            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 rounded hover:bg-gray-700">
                                <Download className="w-4 h-4" /> Export
                            </button>
                            <div className="absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-xl hidden group-hover:block z-50">
                                <button onClick={() => exportMasterCSV(grid)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">Master CSV</button>
                                <button onClick={() => exportDeptCourseCSV(grid)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">Dept & Course View</button>
                                <button onClick={() => exportLoadMatrixCSV(grid, faculties, mappingRules)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">Load Matrix CSV</button>
                                <button onClick={exportFacultyPDFs} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">Faculty PDFs (Print)</button>
                            </div>
                        </div>
                    </div>

                    {/* TAB CONTENT */}
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#0a0a0a]">
                        
                        {activeTab === 'grid' && (
                            <div className="flex flex-col gap-4 min-w-[1200px]">
                                {/* FILTER & STATS BAR */}
                                <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Quick View:</span>
                                        <button 
                                            onClick={() => setSelectedFacultyFilter(null)}
                                            className={`px-3 py-1 text-xs rounded-full transition-all ${!selectedFacultyFilter ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                        >
                                            All Faculties
                                        </button>
                                        <div className="w-px h-4 bg-gray-700"></div>
                                        {faculties.map(fac => (
                                            <button 
                                                key={fac.code}
                                                onClick={() => setSelectedFacultyFilter(fac.code)}
                                                className={`px-3 py-1 text-xs rounded-full font-medium transition-all flex items-center gap-1.5`}
                                                style={{
                                                    backgroundColor: selectedFacultyFilter === fac.code ? fac.color : `${fac.color}20`,
                                                    color: selectedFacultyFilter === fac.code ? '#fff' : fac.color,
                                                    border: `1px solid ${fac.color}40`
                                                }}
                                            >
                                                {fac.code} <span className="bg-black/20 px-1.5 rounded">{facultyLoadMap[fac.code] || 0}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* THE GRID */}
                                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden shadow-2xl printable-grid">
                                    {/* Header */}
                                    <div className="flex border-b border-gray-800 bg-gray-950/50">
                                        <div className="w-24 shrink-0 p-3 flex items-center justify-center font-bold text-gray-500 text-xs tracking-wider">DAY</div>
                                        <div className="flex-1 grid grid-cols-9 divide-x divide-gray-800">
                                            {TIME_LABELS.map((t, i) => (
                                                <div key={i} className="p-2 text-center">
                                                    <div className="text-xs font-bold text-gray-400">P{i+1}</div>
                                                    <div className="text-[10px] text-gray-600">{t}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="divide-y divide-gray-800">
                                        {DAYS.map(day => (
                                            <div key={day} className="flex relative">
                                                <div className="w-24 shrink-0 p-3 flex flex-col items-center justify-center border-r border-gray-800 bg-gray-900/50">
                                                    <span className="font-bold text-sm tracking-widest -rotate-90 uppercase text-gray-500 mt-6">{day}</span>
                                                    <button onClick={() => addRow(day)} className="mt-auto p-1 bg-gray-800 hover:bg-gray-700 rounded tooltip" title="Add Parallel Row">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                
                                                <div className="flex-1 flex flex-col divide-y divide-gray-800/50">
                                                    {(grid[day]||[]).map((row, rIdx) => (
                                                        <div key={row.id} className="grid grid-cols-9 divide-x divide-gray-800 group">
                                                            {row.slots.map((slot, pIdx) => {
                                                                const isFilteredOut = selectedFacultyFilter && slot?.faculty !== selectedFacultyFilter;
                                                                const locked = isLocked(day, row.id, pIdx);
                                                                const facColor = slot ? getFacColor(slot.faculty) : '';
                                                                
                                                                return (
                                                                    <div 
                                                                        key={pIdx}
                                                                        className={`min-h-[80px] p-1 relative transition-all ${isFilteredOut ? 'opacity-10 grayscale' : 'opacity-100'}`}
                                                                        onDragOver={(e) => e.preventDefault()}
                                                                        onDrop={(e) => handleDrop(e, day, row.id, pIdx)}
                                                                        onContextMenu={(e) => handleContextMenu(e, day, row.id, pIdx)}
                                                                        onClick={() => {
                                                                            if (!locked && !slot) setCellModal({day, rowId: row.id, pIdx});
                                                                        }}
                                                                    >
                                                                        {slot ? (
                                                                            <div 
                                                                                draggable={!locked}
                                                                                onDragStart={(e) => handleDragStart(e, day, row.id, pIdx, slot)}
                                                                                onClick={() => { if(!locked) setCellModal({day, rowId: row.id, pIdx}); }}
                                                                                className={`w-full h-full p-1.5 rounded flex flex-col justify-between cursor-grab active:cursor-grabbing border-l-4 overflow-hidden relative group/cell`}
                                                                                style={{
                                                                                    backgroundColor: `${facColor}15`,
                                                                                    borderLeftColor: facColor,
                                                                                    borderRight: `1px solid ${facColor}20`,
                                                                                    borderTop: `1px solid ${facColor}20`,
                                                                                    borderBottom: `1px solid ${facColor}20`,
                                                                                }}
                                                                            >
                                                                                <div className="flex justify-between items-start">
                                                                                    <span className="font-bold text-sm" style={{color: facColor}}>{slot.faculty}</span>
                                                                                    <span className="text-[10px] font-mono px-1 rounded" style={{backgroundColor: `${facColor}30`, color: facColor}}>{slot.type}</span>
                                                                                </div>
                                                                                <div className="text-xs font-medium truncate mt-1">{slot.course}</div>
                                                                                <div className="flex justify-between items-end mt-auto pt-1">
                                                                                    <span className="text-[10px] text-gray-500 truncate">{slot.dept}</span>
                                                                                    <span className="text-[10px] text-gray-400 font-mono bg-black/40 px-1 rounded">{slot.room}</span>
                                                                                </div>
                                                                                
                                                                                {locked && <Lock className="w-3 h-3 text-gray-400 absolute bottom-1 right-1 opacity-50" />}
                                                                                
                                                                                {/* Delete button hover */}
                                                                                {!locked && (
                                                                                    <button 
                                                                                        className="absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 p-0.5 bg-red-500/80 rounded text-white"
                                                                                        onClick={(e) => { e.stopPropagation(); updateCell(day, row.id, pIdx, null); }}
                                                                                    >
                                                                                        <X className="w-3 h-3" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-full h-full rounded hover:bg-gray-800/50 transition-colors flex items-center justify-center group-hover:bg-gray-800/30 cursor-pointer">
                                                                                <Plus className="w-4 h-4 text-gray-700 opacity-0 group-hover:opacity-100" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            
                                                            {/* Row delete button */}
                                                            {rIdx > 0 && (
                                                                <div className="absolute right-full mr-2 inset-y-0 flex items-center opacity-0 group-hover:opacity-100">
                                                                    <button onClick={() => removeRow(day, row.id)} className="p-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-full">
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'faculty' && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="text-indigo-400"/> Manage Faculties</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                                        }} className="bg-transparent font-bold text-lg w-16 outline-none" />
                                                    </div>
                                                    <button onClick={() => {
                                                        setFaculties(faculties.filter((_, i) => i !== idx)); setHasUnsavedChanges(true);
                                                    }} className="text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                                <input value={fac.name} placeholder="Full Name" onChange={(e) => {
                                                    const newF = [...faculties];
                                                    newF[idx].name = e.target.value;
                                                    setFaculties(newF); setHasUnsavedChanges(true);
                                                }} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full outline-none mb-3" />
                                                
                                                {/* Mini Availability Matrix */}
                                                <div className="text-xs text-gray-400 mb-1">Availability (Mon-Fri)</div>
                                                <div className="grid grid-cols-5 gap-1">
                                                    {DAYS.map(d => (
                                                        <div key={d} className="flex flex-col gap-0.5">
                                                            {(fac.availability?.[d] || Array(9).fill(true)).map((av, p) => (
                                                                <button key={p} onClick={() => {
                                                                    const newF = [...faculties];
                                                                    if(!newF[idx].availability) newF[idx].availability = {};
                                                                    if(!newF[idx].availability[d]) newF[idx].availability[d] = Array(9).fill(true);
                                                                    newF[idx].availability[d][p] = !av;
                                                                    setFaculties(newF); setHasUnsavedChanges(true);
                                                                }} className={`w-full h-1.5 rounded-sm ${av ? 'bg-green-500' : 'bg-red-500'}`} title={`${d} P${p+1}`}></button>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => {
                                            setFaculties([...faculties, { code: 'NEW', name: '', color: '#3b82f6', availability: {} }]);
                                            setHasUnsavedChanges(true);
                                        }} className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg flex flex-col items-center justify-center p-6 text-gray-500 hover:text-gray-300 transition-colors">
                                            <Plus className="w-8 h-8 mb-2" />
                                            <span>Add Faculty</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rules' && (
                            <div className="max-w-3xl mx-auto space-y-6">
                                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="text-indigo-400"/> Load Matrix Mapping Rules</h2>
                                    <p className="text-sm text-gray-400 mb-6">Rules are evaluated top to bottom. First match applies. If no match, defaults to 1L.</p>
                                    
                                    <div className="space-y-2 mb-6">
                                        {mappingRules.map((rule, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="text-sm text-gray-500 w-24 text-right">If starts with</div>
                                                <input value={rule.startsWith} onChange={(e) => {
                                                    const nr = [...mappingRules]; nr[idx].startsWith = e.target.value;
                                                    setMappingRules(nr); setHasUnsavedChanges(true);
                                                }} className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 flex-1 outline-none font-mono text-sm" />
                                                <div className="text-sm text-gray-500">→ map to</div>
                                                <input value={rule.mapsTo} onChange={(e) => {
                                                    const nr = [...mappingRules]; nr[idx].mapsTo = e.target.value;
                                                    setMappingRules(nr); setHasUnsavedChanges(true);
                                                }} className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 w-24 outline-none font-bold text-center" />
                                                <button onClick={() => {
                                                    setMappingRules(mappingRules.filter((_, i) => i !== idx)); setHasUnsavedChanges(true);
                                                }} className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => {
                                        setMappingRules([...mappingRules, { startsWith: 'NEW', mapsTo: '1L' }]); setHasUnsavedChanges(true);
                                    }} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm w-full justify-center">
                                        <Plus className="w-4 h-4" /> Add Rule
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'access' && isSuperAdmin && (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Shield className="text-red-400"/> Access Control</h2>
                                    <p className="text-sm text-gray-400 mb-6">Only users checked below can see and use the Routine Maker. You (RB) always have access.</p>
                                    
                                    <div className="space-y-1">
                                        <AccessControlList />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* RIGHT SIDEBAR: CONSTRAINTS */}
                {activeTab === 'grid' && (
                    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
                        <div className="p-4 border-b border-gray-800 bg-gray-950/50">
                            <h2 className="font-bold flex items-center gap-2">
                                <AlertTriangle className={`w-5 h-5 ${violations.length > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                                Live Engine
                            </h2>
                            <div className="text-xs text-gray-400 mt-1">{violations.length} active flags</div>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
                            {violations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-6 text-gray-500 h-full">
                                    <CheckCircle2 className="w-12 h-12 text-green-500/20 mb-3" />
                                    <p>No constraint violations!</p>
                                </div>
                            ) : (
                                violations.map(v => (
                                    <div key={v.id} className={`p-3 rounded-lg border text-sm cursor-pointer transition-all hover:scale-[1.02] ${v.type === 'error' ? 'bg-red-950/30 border-red-900/50' : 'bg-amber-950/30 border-amber-900/50'}`}>
                                        <div className="flex items-start gap-2">
                                            {v.type === 'error' ? <X className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                                            <div>
                                                <div className={`font-bold ${v.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>{v.title}</div>
                                                <div className="text-gray-300 mt-1 text-xs">{v.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
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
                    {faculties.map((f:any) => <option key={f.code} value={f.code}>{f.code} - {f.name}</option>)}
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
                        <div className="font-bold">{a.name}</div>
                        <div className="text-sm text-gray-500">{a.email}</div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={a.hasAccess} 
                            disabled={a.isSuperAdmin}
                            onChange={(e) => toggle(a.email, e.target.checked)}
                            className="w-5 h-5 accent-indigo-500"
                        />
                        <span className="text-sm">{a.isSuperAdmin ? '(Always On)' : 'Allow Access'}</span>
                    </label>
                </div>
            ))}
        </div>
    );
}
