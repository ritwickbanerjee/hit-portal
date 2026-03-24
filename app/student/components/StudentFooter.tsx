"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const facultyEmails = [
    { name: "Ashesh Paul", email: "ashesh.paul@heritageit.edu" },
    { name: "Dipankar Chakraborty", email: "dipankar.chakraborty@heritageit.edu" },
    { name: "Moulipriya Sarkar", email: "moulipriya.sarkar@heritageit.edu" },
    { name: "Moumita Pramanik", email: "moumita.pramanik@heritageit.edu" },
    { name: "Ritwick Banerjee", email: "ritwick.banerjee@heritageit.edu" },
    { name: "Samarpita Bhattacharya", email: "samarpita.bhattacharya@heritageit.edu" },
    { name: "Sandip Chatterjee", email: "sandip.chatterjee@heritageit.edu" },
    { name: "Somjit Datta", email: "somjit.datta@heritageit.edu" },
    { name: "Souvik Ghosh", email: "souvikghosh@heritageit.edu" },
    { name: "Souvik Kundu", email: "souvik.kundu@heritageit.edu" },
    { name: "Sudipta Roy", email: "sudipta.roy@tha.edu.in" },
    { name: "Sudipta Sarkar", email: "sudipta.sarkar@heritageit.edu" },
    { name: "Venu Bihani", email: "venu.bihani@heritageit.edu" }
];

export default function StudentFooter() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isModalOpen]);

    return (
        <footer className="py-4 text-center text-gray-500 border-t border-white/5 mt-auto z-10 relative flex flex-col items-center gap-2 w-full">
            <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs transition-colors bg-white/5 px-4 py-2 rounded-md border-2 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] text-blue-400 font-bold hover:bg-blue-500/10 hover:text-blue-300"
            >
                Math Faculty Email id's
            </button>
            <p className="text-[10px]">&copy; {new Date().getFullYear()} Dept. of Mathematics, HIT</p>

            {isModalOpen && mounted && createPortal(
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overscroll-none" 
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="bg-[#111827] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                            <h2 className="text-white font-medium text-lg">Faculty Emails</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-white transition-colors bg-white/5 p-1 rounded-md"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto overscroll-none flex-1 custom-scrollbar">
                            <ul className="space-y-3">
                                {facultyEmails.map((faculty, index) => (
                                    <li key={index} className="flex flex-col items-start bg-white/5 p-3 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                        <span className="text-gray-200 text-sm font-medium">{faculty.name}</span>
                                        <a href={`mailto:${faculty.email}`} className="text-[#3b82f6] hover:text-[#60a5fa] text-xs transition-colors mt-1">
                                            {faculty.email}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </footer>
    );
}
