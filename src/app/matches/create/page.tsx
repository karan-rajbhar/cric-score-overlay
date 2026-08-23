"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { createMatch } from "../mutations";
import { getTeams } from "../queries";
import { createTeamQuick } from "../../teams/actions";
import { useAuth } from "~/lib/auth";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { deriveShortName } from "~/lib/utils";
import { ChevronLeft, ChevronRight, Loader2, Check, AlertCircle, Plus } from "lucide-react";

interface Team {
    id: string;
    name: string;
    short_name?: string;
    club_id?: string;
}

type MatchFormat = "T20" | "ODI" | "Custom";

interface FormData {
    title: string;
    matchFormat: MatchFormat;
    oversPerInnings: number;
    team1Id: string;
    team2Id: string;
    venue: string;
    scheduledAt: string;
    umpire1Name: string;
    umpire2Name: string;
}

export default function CreateMatchPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [step, setStep] = useState(1);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(false);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        title: "",
        matchFormat: "T20",
        oversPerInnings: 20,
        team1Id: "",
        team2Id: "",
        venue: "",
        scheduledAt: "",
        umpire1Name: "",
        umpire2Name: "",
    });

    // Inline "new team" creation from the team-selection step.
    const [newTeamFor, setNewTeamFor] = useState<"team1Id" | "team2Id" | null>(null);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamSaving, setNewTeamSaving] = useState(false);

    const loadTeams = async () => {
        const result = await getTeams();
        if (result.data) {
            setTeams(result.data);
        }
        setTeamsLoading(false);
    };

    useEffect(() => {
        let cancelled = false;

        const fetchTeams = async () => {
            const result = await getTeams();
            if (cancelled) return;
            if (result.data) {
                setTeams(result.data);
            }
            setTeamsLoading(false);
        };

        void fetchTeams();
        return () => {
            cancelled = true;
        };
    }, []);

    // Auto-set overs when format changes (derived in the change handler, not an effect)
    const handleFormatChange = (format: MatchFormat) => {
        updateField("matchFormat", format);
        if (format === "T20") {
            updateField("oversPerInnings", 20);
        } else if (format === "ODI") {
            updateField("oversPerInnings", 50);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        const result = await createMatch({
            title: formData.title,
            matchFormat: formData.matchFormat,
            oversPerInnings: formData.oversPerInnings,
            team1Id: formData.team1Id,
            team2Id: formData.team2Id,
            venue: formData.venue || undefined,
            scheduledAt: formData.scheduledAt || undefined,
            umpire1Name: formData.umpire1Name || undefined,
            umpire2Name: formData.umpire2Name || undefined,
        });

        if (result.error) {
            setError(result.error);
            setLoading(false);
        } else {
            setSuccess(true);
            setTimeout(() => {
                router.push(`/matches/${result.data?.id}`);
            }, 1500);
        }
    };

    const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const canProceedStep1 = formData.matchFormat && formData.oversPerInnings > 0;
    const canProceedStep2 = formData.team1Id && formData.team2Id && formData.team1Id !== formData.team2Id;
    const canProceedStep3 = formData.title.trim().length > 0;

    const getTeamName = (id: string) => teams.find((t) => t.id === id)?.name || "";

    const handleCreateTeamInline = async () => {
        if (!newTeamName.trim() || !newTeamFor) return;
        setNewTeamSaving(true);

        const result = await createTeamQuick(newTeamName, deriveShortName(newTeamName));
        if (result.error || !result.data) {
            toast.error(result.error ?? "Could not create team");
        } else {
            // Refresh the list and select the new team in the slot that
            // opened the dialog.
            const refreshed = await getTeams();
            setTeams((refreshed.data as Team[]) ?? []);
            updateField(newTeamFor, result.data.id);
            toast.success(`Team "${result.data.name}" created`);
            setNewTeamFor(null);
            setNewTeamName("");
        }
        setNewTeamSaving(false);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cricket-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md w-full mx-4">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
                        <p className="text-muted-foreground mb-4">
                            You need to be signed in to create a match.
                        </p>
                        <Button asChild>
                            <Link href="/auth/login">Sign In</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md w-full mx-4">
                    <CardContent className="p-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                            <Check className="h-8 w-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Match Created!</h2>
                        <p className="text-muted-foreground">Redirecting to match page...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background py-8">
            <div className="container mx-auto px-4 max-w-2xl">
                {/* Header */}
                <div className="mb-8">
                    <Button variant="ghost" asChild className="mb-4">
                        <Link href="/matches">
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Back to Matches
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-bold text-foreground">Create New Match</h1>
                    <p className="text-muted-foreground mt-2">
                        Set up a cricket match in a few simple steps
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center">
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${step >= s
                                        ? "bg-cricket-primary text-white"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                            >
                                {step > s ? <Check className="h-5 w-5" /> : s}
                            </div>
                            {s < 4 && (
                                <div
                                    className={`w-full h-1 mx-2 ${step > s ? "bg-cricket-primary" : "bg-muted"
                                        }`}
                                    style={{ width: "60px" }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Labels */}
                <div className="flex justify-between text-xs text-muted-foreground mb-8 px-2">
                    <span className={step === 1 ? "text-cricket-primary font-medium" : ""}>Format</span>
                    <span className={step === 2 ? "text-cricket-primary font-medium" : ""}>Teams</span>
                    <span className={step === 3 ? "text-cricket-primary font-medium" : ""}>Details</span>
                    <span className={step === 4 ? "text-cricket-primary font-medium" : ""}>Review</span>
                </div>

                {/* Step Content */}
                <Card>
                    <CardContent className="p-6">
                        {/* Step 1: Format */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Match Format</h2>
                                    <p className="text-muted-foreground text-sm mb-6">
                                        Choose the format and number of overs for this match
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-medium">Format</Label>
                                        <div className="grid grid-cols-3 gap-3 mt-2">
                                            {(["T20", "ODI", "Custom"] as MatchFormat[]).map((format) => (
                                                <button
                                                    key={format}
                                                    type="button"
                                                    onClick={() => handleFormatChange(format)}
                                                    className={`p-4 rounded-lg border-2 transition-colors ${formData.matchFormat === format
                                                            ? "border-cricket-primary bg-cricket-primary/10"
                                                            : "border-border hover:border-cricket-primary/50"
                                                        }`}
                                                >
                                                    <div className="text-lg font-bold">{format}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {format === "T20" && "20 overs"}
                                                        {format === "ODI" && "50 overs"}
                                                        {format === "Custom" && "Custom overs"}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="overs">Overs per Innings</Label>
                                        <Input
                                            id="overs"
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={formData.oversPerInnings}
                                            onChange={(e) =>
                                                updateField("oversPerInnings", parseInt(e.target.value) || 0)
                                            }
                                            disabled={formData.matchFormat !== "Custom"}
                                            className="mt-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Teams */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Select Teams</h2>
                                    <p className="text-muted-foreground text-sm mb-6">
                                        Choose the two teams that will be playing
                                    </p>
                                </div>

                                {teamsLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <Label>Team 1</Label>
                                            <Select
                                                value={formData.team1Id}
                                                onValueChange={(value) => updateField("team1Id", value)}
                                            >
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue placeholder="Select first team" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {teams
                                                        .filter((t) => t.id !== formData.team2Id)
                                                        .map((team) => (
                                                            <SelectItem key={team.id} value={team.id}>
                                                                {team.name}
                                                                {team.short_name && ` (${team.short_name})`}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                            {teams.length === 0 && (
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    No teams yet — create one below.
                                                </p>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="mt-1.5 h-7 px-2 text-xs text-primary"
                                                onClick={() => {
                                                    setNewTeamFor("team1Id");
                                                    setNewTeamName("");
                                                }}
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" />
                                                Create new team
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-center py-2">
                                            <Badge variant="outline">VS</Badge>
                                        </div>

                                        <div>
                                            <Label>Team 2</Label>
                                            <Select
                                                value={formData.team2Id}
                                                onValueChange={(value) => updateField("team2Id", value)}
                                            >
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue placeholder="Select second team" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {teams
                                                        .filter((t) => t.id !== formData.team1Id)
                                                        .map((team) => (
                                                            <SelectItem key={team.id} value={team.id}>
                                                                {team.name}
                                                                {team.short_name && ` (${team.short_name})`}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="mt-1.5 h-7 px-2 text-xs text-primary"
                                                onClick={() => {
                                                    setNewTeamFor("team2Id");
                                                    setNewTeamName("");
                                                }}
                                            >
                                                <Plus className="h-3.5 w-3.5 mr-1" />
                                                Create new team
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: Details */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Match Details</h2>
                                    <p className="text-muted-foreground text-sm mb-6">
                                        Add additional information about the match
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="title">Match Title *</Label>
                                        <Input
                                            id="title"
                                            placeholder="e.g., League Match - Round 1"
                                            value={formData.title}
                                            onChange={(e) => updateField("title", e.target.value)}
                                            className="mt-2"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="venue">Venue</Label>
                                        <Input
                                            id="venue"
                                            placeholder="e.g., Central Park Cricket Ground"
                                            value={formData.venue}
                                            onChange={(e) => updateField("venue", e.target.value)}
                                            className="mt-2"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="datetime">Date & Time</Label>
                                        <Input
                                            id="datetime"
                                            type="datetime-local"
                                            value={formData.scheduledAt}
                                            onChange={(e) => updateField("scheduledAt", e.target.value)}
                                            className="mt-2"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="umpire1">Umpire 1</Label>
                                            <Input
                                                id="umpire1"
                                                placeholder="Name"
                                                value={formData.umpire1Name}
                                                onChange={(e) => updateField("umpire1Name", e.target.value)}
                                                className="mt-2"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="umpire2">Umpire 2</Label>
                                            <Input
                                                id="umpire2"
                                                placeholder="Name"
                                                value={formData.umpire2Name}
                                                onChange={(e) => updateField("umpire2Name", e.target.value)}
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Review */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Review & Create</h2>
                                    <p className="text-muted-foreground text-sm mb-6">
                                        Confirm the match details before creating
                                    </p>
                                </div>

                                <div className="space-y-4 bg-muted/30 rounded-lg p-4">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Title</span>
                                        <span className="font-medium">{formData.title}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Format</span>
                                        <span className="font-medium">
                                            {formData.matchFormat} ({formData.oversPerInnings} overs)
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Team 1</span>
                                        <span className="font-medium">{getTeamName(formData.team1Id)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Team 2</span>
                                        <span className="font-medium">{getTeamName(formData.team2Id)}</span>
                                    </div>
                                    {formData.venue && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Venue</span>
                                            <span className="font-medium">{formData.venue}</span>
                                        </div>
                                    )}
                                    {formData.scheduledAt && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Date/Time</span>
                                            <span className="font-medium">
                                                {new Date(formData.scheduledAt).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5" />
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex justify-between mt-8 pt-6 border-t">
                            <Button
                                variant="outline"
                                onClick={() => setStep((s) => Math.max(1, s - 1))}
                                disabled={step === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>

                            {step < 4 ? (
                                <Button
                                    onClick={() => setStep((s) => s + 1)}
                                    disabled={
                                        (step === 1 && !canProceedStep1) ||
                                        (step === 2 && !canProceedStep2) ||
                                        (step === 3 && !canProceedStep3)
                                    }
                                    className="bg-cricket-primary hover:bg-cricket-primary/90"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="bg-cricket-primary hover:bg-cricket-primary/90"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-2" />
                                            Create Match
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Inline new-team dialog */}
                <Dialog
                    open={newTeamFor !== null}
                    onOpenChange={(open) => !open && setNewTeamFor(null)}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create New Team</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <Label htmlFor="new-team-name">Team name *</Label>
                                <Input
                                    id="new-team-name"
                                    placeholder="e.g., Riverside Warriors"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    className="mt-2"
                                    autoFocus
                                />
                                {newTeamName.trim() && (
                                    <p className="mt-1.5 text-xs text-muted-foreground">
                                        Short code:{" "}
                                        <span className="font-semibold">
                                            {deriveShortName(newTeamName)}
                                        </span>
                                    </p>
                                )}
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleCreateTeamInline}
                                disabled={!newTeamName.trim() || newTeamSaving}
                            >
                                {newTeamSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Creating…
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-1.5" />
                                        Create team
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
