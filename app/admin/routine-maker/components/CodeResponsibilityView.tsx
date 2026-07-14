import React, { useState, useMemo } from 'react';
import { Download, Search, CheckCircle2 } from 'lucide-react';
import { GridState, FacultyData } from '../constraintUtils';

interface CodeResponsibility {
    course: string;
    dept: string;
    faculty: string;
}

interface Props {
    grid: GridState;
    faculties: FacultyData[];
    codeResponsibilities: CodeResponsibility[];
    onChange: (crs: CodeResponsibility[]) => void;
    onDownload: () => void;
}

export default function CodeResponsibilityView({ grid, faculties, codeResponsibilities, onChange, onDownload }: Props) {
    const [deptFilter, setDeptFilter] = useState<string>('');
    const [searchCourse, setSearchCourse] = useState<string>('');

    // Extract unique (course, dept) combinations from the grid
    const uniquePairs = useMemo(() => {
        const pairs = new Set<string>();
        Object.values(grid).forEach(dayRows => {
            dayRows.forEach(row => {
                row.slots.forEach(slot => {
                    if (slot && slot.course && slot.dept) {
                        pairs.add(JSON.stringify({ course: slot.course, dept: slot.dept }));
                    }
                });
            });
        });
        
        return Array.from(pairs).map(p => JSON.parse(p) as { course: string, dept: string })
            .sort((a, b) => a.course.localeCompare(b.course) || a.dept.localeCompare(b.dept));
    }, [grid]);

    // Unique departments for filter
    const departments = useMemo(() => Array.from(new Set(uniquePairs.map(p => p.dept))).sort(), [uniquePairs]);

    // Filtered pairs
    const filteredPairs = useMemo(() => {
        return uniquePairs.filter(p => {
            const matchDept = deptFilter ? p.dept === deptFilter : true;
            const matchCourse = searchCourse ? p.course.toLowerCase().includes(searchCourse.toLowerCase()) : true;
            return matchDept && matchCourse;
        });
    }, [uniquePairs, deptFilter, searchCourse]);

    const handleFacultyChange = (course: string, dept: string, faculty: string) => {
        const existing = [...codeResponsibilities];
        const index = existing.findIndex(cr => cr.course === course && cr.dept === dept);
        if (index >= 0) {
            existing[index].faculty = faculty;
        } else {
            existing.push({ course, dept, faculty });
        }
        onChange(existing);
    };

    const getAssignedFaculty = (course: string, dept: string) => {
        return codeResponsibilities.find(cr => cr.course === course && cr.dept === dept)?.faculty || '';
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden shadow-lg">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-gray-800 bg-gray-900/50 shrink-0">
                <div className="flex items-center gap-4 flex-wrap flex-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="text-indigo-400 w-5 h-5" />
                        Code Responsibility
                    </h2>
                    
                    <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                    
                    <select
                        value={deptFilter}
                        onChange={e => setDeptFilter(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 min-w-[120px]"
                    >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Course Code..."
                            value={searchCourse}
                            onChange={e => setSearchCourse(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-white rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 w-[200px]"
                        />
                    </div>
                </div>

                <button 
                    onClick={onDownload}
                    className="flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-md transition-colors shadow-sm shadow-green-900/20"
                >
                    <Download className="w-4 h-4" />
                    Download Excel
                </button>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr>
                            <th className="bg-gray-800/80 font-semibold text-gray-300 py-3 px-4 border-b border-gray-700 rounded-tl-lg sticky top-0">Course Code</th>
                            <th className="bg-gray-800/80 font-semibold text-gray-300 py-3 px-4 border-b border-gray-700 sticky top-0">Department / Stream</th>
                            <th className="bg-gray-800/80 font-semibold text-gray-300 py-3 px-4 border-b border-gray-700 rounded-tr-lg sticky top-0 w-64">Assigned Faculty</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPairs.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="text-center py-8 text-gray-500">No courses found matching the filters. Note: Courses must be placed in the grid to appear here.</td>
                            </tr>
                        ) : (
                            filteredPairs.map((p, idx) => {
                                const assigned = getAssignedFaculty(p.course, p.dept);
                                return (
                                    <tr key={`${p.course}-${p.dept}`} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                                        <td className="py-2.5 px-4 font-mono text-indigo-300">{p.course}</td>
                                        <td className="py-2.5 px-4 text-gray-300">{p.dept}</td>
                                        <td className="py-2.5 px-4">
                                            <select
                                                value={assigned}
                                                onChange={e => handleFacultyChange(p.course, p.dept, e.target.value)}
                                                className={`w-full bg-gray-950 border rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500 transition-colors ${assigned ? 'border-indigo-500/50 text-indigo-300' : 'border-gray-700 text-gray-400'}`}
                                            >
                                                <option value="">-- Unassigned --</option>
                                                {faculties.map(f => (
                                                    <option key={f.code} value={f.code}>{f.name || f.code} ({f.code})</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
