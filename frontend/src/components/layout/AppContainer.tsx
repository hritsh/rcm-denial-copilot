import type { ReactNode } from "react";

interface AppContainerProps {
    children: ReactNode;
}

export function AppContainer({ children }: AppContainerProps) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-12">
                {children}
            </div>
        </div>
    );
}
