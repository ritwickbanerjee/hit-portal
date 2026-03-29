import StudentFooter from "./components/StudentFooter";

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-[#0a0f1a]">
            <div className="flex-1 w-full pb-8">
                {children}
            </div>
            <div className="sticky bottom-0 z-40 w-full bg-[#0a0f1a]/95 backdrop-blur-sm">
                <StudentFooter />
            </div>
        </div>
    );
}
