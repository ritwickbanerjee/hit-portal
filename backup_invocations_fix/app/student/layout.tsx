import ClientFooter from "./components/StudentFooter";

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
            <ClientFooter />
        </div>
    );
}
