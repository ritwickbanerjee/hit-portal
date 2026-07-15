import React, { useState, useMemo } from 'react';
import { GridState, Slot } from '../constraintUtils';
import { LayoutGrid, Printer } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIME_LABELS = ['9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4', '4-5', '5-6'];

interface Props {
    grid: GridState;
    departments: string[];
}

export default function DepartmentRoutineView({ grid, departments }: Props) {
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [selectedCourse, setSelectedCourse] = useState<string>('');

    // When dept changes, reset course filter
    const handleDeptChange = (dept: string) => {
        setSelectedDept(dept);
        setSelectedCourse('');
    };

    // Unique courses available in the grid for the selected department
    const coursesForDept = useMemo(() => {
        if (!selectedDept) return [];
        const courses = new Set<string>();
        Object.values(grid).forEach(dayRows => {
            dayRows.forEach(row => {
                row.slots.forEach(slot => {
                    if (slot && slot.dept === selectedDept && slot.course) {
                        courses.add(slot.course);
                    }
                });
            });
        });
        return Array.from(courses).sort();
    }, [grid, selectedDept]);

    // Generate a 5x9 grid for the selected department
    const deptGrid = useMemo(() => {
        if (!selectedDept) return null;
        
        const result: Record<string, Slot[][]> = {};
        
        DAYS.forEach(day => {
            result[day] = Array.from({ length: 9 }, () => []);
            
            const rows = grid[day] || [];
            rows.forEach(row => {
                row.slots.forEach((slot, pIdx) => {
                    if (slot && slot.dept === selectedDept) {
                        if (!selectedCourse || slot.course === selectedCourse) {
                            result[day][pIdx].push(slot);
                        }
                    }
                });
            });
        });
        
        return result;
    }, [grid, selectedDept, selectedCourse]);

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden shadow-lg">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-800 bg-gray-900/50 shrink-0">
                <div className="flex items-center gap-4 flex-wrap flex-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <LayoutGrid className="text-indigo-400 w-5 h-5" />
                        Department View
                    </h2>
                    
                    <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                    
                    <select
                        value={selectedDept}
                        onChange={e => handleDeptChange(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 min-w-[150px]"
                    >
                        <option value="">-- Select Department --</option>
                        {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>

                    <select
                        value={selectedCourse}
                        onChange={e => setSelectedCourse(e.target.value)}
                        disabled={!selectedDept || coursesForDept.length === 0}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 min-w-[160px] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <option value="">All Courses</option>
                        {coursesForDept.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <button 
                    onClick={() => window.print()}
                    disabled={!selectedDept}
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                >
                    <Printer className="w-4 h-4" />
                    Print Routine
                </button>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-black/40">
                {!selectedDept ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Please select a department from the dropdown to view its routine.
                    </div>
                ) : (
                    <div className="min-w-[1000px]">
                        {/* Header Row */}
                        <div className="flex border-b border-gray-700 mb-2 pb-2">
                            <div className="w-24 shrink-0 font-bold text-gray-400 text-center uppercase tracking-wider text-xs">Day</div>
                            <div className="flex-1 grid grid-cols-9 gap-2">
                                {TIME_LABELS.map((t, i) => (
                                    <div key={i} className="text-center">
                                        <div className="text-xs font-bold text-gray-400">P{i+1}</div>
                                        <div className="text-[10px] text-gray-600">{t}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Days */}
                        {DAYS.map(day => (
                            <div key={day} className="flex mb-4 items-stretch border-b border-gray-800/50 pb-4">
                                <div className="w-24 shrink-0 flex items-center justify-center font-bold text-gray-300 tracking-widest uppercase text-xs border-r border-gray-800 pr-4">
                                    {day}
                                </div>
                                <div className="flex-1 grid grid-cols-9 gap-2 pl-4">
                                    {deptGrid![day].map((slots, pIdx) => (
                                        <div key={pIdx} className="min-h-[80px] bg-gray-900/50 border border-gray-800 rounded p-1 flex flex-col gap-1">
                                            {slots.length === 0 ? (
                                                <div className="flex-1 flex items-center justify-center text-gray-700 text-xs">-</div>
                                            ) : (
                                                slots.map((slot, sIdx) => (
                                                    <div key={sIdx} className="bg-gray-800 rounded p-1.5 border-l-2 border-indigo-500 shadow-sm text-xs relative overflow-hidden">
                                                        <div className="flex justify-between items-start mb-0.5">
                                                            <span className="font-bold text-indigo-300 truncate pr-1">{slot?.faculty}</span>
                                                            <span className="text-[9px] bg-black/40 text-gray-300 px-1 rounded font-mono shrink-0">{slot?.type}</span>
                                                        </div>
                                                        <div className="font-medium text-gray-200 leading-tight mb-1">{slot?.course}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono truncate">{slot?.room}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
