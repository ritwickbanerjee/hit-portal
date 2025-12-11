export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
            <div className="flex-1 w-full">
                {children}
            </div>
            <footer className="py-4 text-center bg-[#0a0f1a] text-gray-500 border-t border-white/5 mt-auto z-10 relative">
                <p className="text-[10px]">&copy; 2025 copyright Dept. of Mathematics, HIT</p>
            </footer>
        </div>
    );
}
