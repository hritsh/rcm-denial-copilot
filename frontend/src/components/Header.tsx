import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";

interface HeaderProps {
    autonomousMode: boolean;
    onAutonomousModeChange: (value: boolean) => void;
}

export function Header({ autonomousMode, onAutonomousModeChange }: HeaderProps) {
    return (
        <header className="flex flex-col gap-6 border-b border-border/60 bg-background/80 px-6 py-6 backdrop-blur">
            <div className="flex flex-row items-center gap-6">
                <img src="/rcm-denial-copilot.svg" alt="RCM Denial Copilot" className="h-16 w-16" />

                <div className="flex flex-col gap-2">

                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">RCM Denial Co-pilot</h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                        Investigate claims, translate medical codes, and make denial recovery easier with an LLM-powered
                        assistant tuned for RCM.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Autonomous Mode</p>
                    <p className="text-xs text-muted-foreground">
                        When enabled, the assistant iterates through denied claims and prepares recommended actions automatically for approval/skipping.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="border border-border/60 bg-background/70 text-xs uppercase tracking-wide">
                        {autonomousMode ? "Active" : "Idle"}
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Off</span>
                        <Switch checked={autonomousMode} onCheckedChange={onAutonomousModeChange} />
                        <span>On</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
