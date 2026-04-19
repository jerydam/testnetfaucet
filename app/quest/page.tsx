"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Settings, ArrowRight, Coins, Loader2,
    Calendar, Users, LayoutGrid, List,
    Clock, CalendarClock, Zap, Hourglass, CheckCircle2, Filter,
    Trash2, AlertTriangle, X, Sparkles,
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { Header } from "@/components/header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Loading from '../loading/page';

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app";

interface QuestOverview {
    faucetAddress: string;
    slug: string;
    title: string;
    description: string;
    isActive: boolean;
    isFunded: boolean;
    rewardPool: string;
    tokenSymbol?: string;
    creatorAddress: string;
    startDate: string;
    endDate: string;
    tasksCount: number;
    totalParticipants: number;
    imageUrl?: string;
    hasJoined?: boolean;
}

interface QuestsResponse {
    success: boolean;
    quests: QuestOverview[];
    count: number;
    message?: string;
}

type FilterType = 'all' | 'active' | 'upcoming' | 'ended' | 'joined';

const useCountdown = (targetDate: string | null): string => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    useEffect(() => {
        if (!targetDate) return;
        const tick = () => {
            const diff = new Date(targetDate).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft("Starting soon..."); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [targetDate]);
    return timeLeft;
};

const getQuestStatus = (quest: QuestOverview) => {
    const now = new Date();
    const startDate = new Date(quest.startDate);
    const endDate = new Date(quest.endDate);
    if (now < startDate) return { label: "Upcoming", color: "bg-blue-100 text-blue-800 border-blue-200" };
    if (now > endDate)   return { label: "Ended",    color: "bg-gray-100 text-gray-600 border-gray-200" };
    return { label: "Active", color: "bg-green-100 text-green-800 border-green-200" };
};

const FILTER_TABS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all',      label: 'All',        icon: <Filter    className="h-3.5 w-3.5" /> },
    { key: 'active',   label: 'Active',     icon: <Zap       className="h-3.5 w-3.5" /> },
    { key: 'upcoming', label: 'Upcoming',   icon: <Hourglass className="h-3.5 w-3.5" /> },
    { key: 'ended',    label: 'Ended',      icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { key: 'joined',   label: 'My Quests',  icon: <Sparkles  className="h-3.5 w-3.5" /> },
];

// ── Delete Confirmation Modal (unchanged) ──────────────────────────────────
function DeleteQuestModal({
    quest,
    walletAddress,
    onClose,
    onDeleted,
}: {
    quest: QuestOverview;
    walletAddress: string;
    onClose: () => void;
    onDeleted: (faucetAddress: string) => void;
}) {
    const [inputValue, setInputValue] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const isConfirmed = inputValue.trim().toLowerCase() === quest.title.trim().toLowerCase();

    const handleDelete = async () => {
        if (!isConfirmed) { 
            setError("Quest name does not match. Please type the exact name."); 
            return; 
        }
        setIsDeleting(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE_URL}/api/quest/${quest.faucetAddress}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress, questTitle: quest.title }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.detail || data.message || "Failed to delete quest");
            toast.success(`"${quest.title}" has been deleted.`);
            onDeleted(quest.faucetAddress);
            onClose();
        } catch (e: any) {
            setError(e.message || "Failed to delete quest");
        } finally {
            setIsDeleting(false);
        }
    };

     return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/50 px-5 py-4 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-slate-900 dark:text-white">Delete Quest</h2>
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">This action cannot be undone</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="px-5 py-5 space-y-4">
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                            {quest.imageUrl && (
                                <img src={quest.imageUrl} alt={quest.title} className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700" />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-slate-900 dark:text-white font-bold text-sm truncate">{quest.title}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                                    {quest.rewardPool} {quest.tokenSymbol || "tokens"} · {quest.totalParticipants} participants
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 space-y-1.5">
                            <p className="text-amber-800 dark:text-amber-400 text-xs font-bold uppercase tracking-wide">The following will be permanently deleted:</p>
                            <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-500">
                                <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />All quest tasks and configurations</li>
                                <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />All participant records and submissions</li>
                                <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />All reward distribution data</li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">Type the quest name to confirm:</label>
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 mb-2">
                                <p className="text-sm font-mono font-bold text-red-600 dark:text-red-400 break-all">{quest.title}</p>
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => { setInputValue(e.target.value); setError(""); }}
                                onKeyDown={(e) => { if (e.key === "Enter" && isConfirmed) handleDelete(); }}
                                placeholder="Type quest name here..."
                                className={cn(
                                    "w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none",
                                    "bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500",
                                    error
                                        ? "border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-900/50"
                                        : isConfirmed
                                            ? "border-green-400 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-900/50"
                                            : "border-slate-300 dark:border-slate-600 focus:border-slate-400 dark:focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
                                )}
                            />
                            {error && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3 shrink-0" />{error}
                                </p>
                            )}
                            {isConfirmed && !error && (
                                <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3 w-3 shrink-0" />Name confirmed — you can now delete this quest
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="px-5 pb-5 flex gap-3">
                        <Button variant="outline" className="flex-1 h-11 border-slate-200 dark:border-slate-700" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                        <Button
                            className={cn("flex-1 h-11 font-bold border-0 transition-all", isConfirmed && !isDeleting ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed")}
                            onClick={handleDelete}
                            disabled={!isConfirmed || isDeleting}
                        >
                            {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="mr-2 h-4 w-4" />Delete Quest</>}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }


// ── Quest Card with Updated CTA Logic ─────────────────────────────────
function QuestCard({ 
    quest, 
    isOwner, 
    viewMode, 
    onNavigate, 
    onDeleteClick 
}: {
    quest: QuestOverview;
    isOwner: boolean;
    viewMode: 'list' | 'grid';
    onNavigate: (slug: string) => void;
    onDeleteClick: (quest: QuestOverview) => void;
}) {
    const status = getQuestStatus(quest);
    const now = new Date();
    const isUpcoming = now < new Date(quest.startDate);
    const isEnded = now > new Date(quest.endDate);
    const hasJoined = quest.hasJoined ?? false;

    const startCountdown = useCountdown(isUpcoming ? quest.startDate : null);
    const endCountdown = useCountdown(!isEnded && !isUpcoming ? quest.endDate : null);

    // Updated CTA Button Logic (as per your request)
    const renderCta = () => {
        if (isOwner) {
            return (
                <Button
                    size={viewMode === 'grid' ? 'default' : 'sm'}
                    className="w-full font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-black"
                    onClick={() => onNavigate(quest.slug || quest.faucetAddress)}
                >
                    <Settings className="h-4 w-4 mr-2" /> Manage
                </Button>
            );
        }

        if (hasJoined) {
            return (
                <Button
                    size={viewMode === 'grid' ? 'default' : 'sm'}
                    className="w-full font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onNavigate(quest.slug || quest.faucetAddress)}
                >
                    
                    {isEnded ? "View Details" : "Welcome Back"}
                </Button>
            );
        }

        // Not joined
        if (isEnded) {
            return (
                <Button
                    size={viewMode === 'grid' ? 'default' : 'sm'}
                    disabled
                    className="w-full font-semibold bg-gray-200 text-gray-500 cursor-not-allowed"
                >
                    Ended
                </Button>
            );
        }

        // Not joined + active/upcoming
        return (
            <Button
                size={viewMode === 'grid' ? 'default' : 'sm'}
                className="w-full font-semibold bg-primary text-white hover:bg-primary/90"
                onClick={() => onNavigate(quest.slug || quest.faucetAddress)}
            >
                Join Quest
                <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
        );
    };

    return (
        <Card className={cn(
            "group hover:shadow-lg transition-all duration-300 border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col bg-white dark:bg-slate-950",
            hasJoined && !isOwner && "ring-1 ring-emerald-400/40 dark:ring-emerald-500/30"
        )}>
            <div className={`flex flex-1 ${viewMode === 'list' ? 'flex-col md:flex-row' : 'flex-col'}`}>
                {quest.imageUrl && (
                    <div className={`shrink-0 bg-slate-100 dark:bg-slate-900 border-b md:border-b-0 ${viewMode === 'list' ? 'md:border-r border-slate-200 dark:border-slate-800 w-full md:w-48' : 'w-full'}`}>
                        <div className="aspect-square w-full overflow-hidden">
                            <img src={quest.imageUrl} alt={quest.title} className="w-full h-full object-cover" />
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col p-5 md:p-6">
                    <div className={`flex mb-4 gap-4 ${viewMode === 'list' ? 'flex-col sm:flex-row sm:items-start justify-between' : 'flex-col'}`}>
                        <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                                <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-1 flex-1 min-w-0">
                                    {quest.title}
                                </h3>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {hasJoined && !isOwner && (
                                        <span className="px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Joined
                                        </span>
                                    )}
                                    <span className={`px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-full border ${status.color}`}>
                                        {status.label}
                                    </span>
                                    {isOwner && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteClick(quest); }}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-all"
                                            title="Delete quest"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <p className={`text-sm text-muted-foreground ${viewMode === 'grid' ? 'line-clamp-3' : 'line-clamp-2'}`}>
                                {quest.description}
                            </p>

                            {isUpcoming && startCountdown && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                                    <CalendarClock className="h-4 w-4 shrink-0" />
                                    <span className="text-xs font-semibold">Starts in: <span className="font-mono">{startCountdown}</span></span>
                                </div>
                            )}
                            {!isEnded && !isUpcoming && endCountdown && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
                                    <Clock className="h-4 w-4 shrink-0" />
                                    <span className="text-xs font-semibold">Ends in: <span className="font-mono">{endCountdown}</span></span>
                                </div>
                            )}
                        </div>

                        <div className={`shrink-0 ${viewMode === 'grid' ? 'w-full mt-2' : 'w-full sm:w-auto'}`}>
                            {renderCta()}
                        </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-6 gap-y-3 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-50 text-blue-600 rounded"><Coins className="h-4 w-4" /></div>
                            <span>Pool: <span className="font-bold text-foreground">{quest.rewardPool} {quest.tokenSymbol || "Tokens"}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-purple-50 text-purple-600 rounded"><Users className="h-4 w-4" /></div>
                            <span><span className="font-bold text-foreground">{quest.totalParticipants ?? 0}</span> Participants</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-orange-50 text-orange-600 rounded"><Calendar className="h-4 w-4" /></div>
                            <span className="truncate">
                                {isUpcoming
                                    ? `Starts: ${new Date(quest.startDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                                    : isEnded
                                        ? `Ended: ${new Date(quest.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                                        : `Ends: ${new Date(quest.endDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                                }
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

// ── Main Page ──────────────────────────────────────────────────
export default function QuestHomePage() {
    const router = useRouter();
    const { address } = useWallet();
    const [quests, setQuests] = useState<QuestOverview[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [questToDelete, setQuestToDelete] = useState<QuestOverview | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        if (typeof window === 'undefined') return 'grid';
        return (localStorage.getItem('questViewMode') as 'grid' | 'list') || 'grid';
    });

    useEffect(() => { localStorage.setItem('questViewMode', viewMode); }, [viewMode]);

    const fetchQuests = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const url = address
                ? `${API_BASE_URL}/api/quests?walletAddress=${address}&cache_bust=${Date.now()}`
                : `${API_BASE_URL}/api/quests?cache_bust=${Date.now()}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data: QuestsResponse = await response.json();
            if (!data.success) throw new Error(data.message || 'Failed to retrieve quests.');
            setQuests(data.quests || []);
        } catch (err: any) {
            setError(err.message || "Could not connect to the Quest API.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchQuests(); }, [address]);

    const handleQuestDeleted = (faucetAddress: string) => {
        setQuests(prev => prev.filter(q => q.faucetAddress !== faucetAddress));
    };

    const validQuests = useMemo(() =>
        quests.filter(q => q.faucetAddress?.startsWith("0x") && q.isActive === true),
    [quests]);

    const filterCounts = useMemo(() => {
        const now = new Date();
        return {
            all:      validQuests.length,
            active:   validQuests.filter(q => new Date(q.startDate) <= now && new Date(q.endDate) >= now).length,
            upcoming: validQuests.filter(q => new Date(q.startDate) > now).length,
            ended:    validQuests.filter(q => new Date(q.endDate) < now).length,
            joined:   validQuests.filter(q => q.hasJoined).length,
        };
    }, [validQuests]);

    const filteredQuests = useMemo(() => {
        const now = new Date();
        const getPriority = (q: QuestOverview) => {
            const s = new Date(q.startDate), e = new Date(q.endDate);
            if (now >= s && now <= e) return 0;
            if (now < s) return 1;
            return 2;
        };
        const sorted = [...validQuests].sort((a, b) => {
            const pa = getPriority(a), pb = getPriority(b);
            if (pa !== pb) return pa - pb;
            if (pa === 0) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            if (pa === 1) return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
        });

        if (activeFilter === 'all') return sorted;
        if (activeFilter === 'joined') return sorted.filter(q => q.hasJoined);
        return sorted.filter(q => {
            const s = new Date(q.startDate), e = new Date(q.endDate);
            if (activeFilter === 'active')   return s <= now && e >= now;
            if (activeFilter === 'upcoming') return s > now;
            if (activeFilter === 'ended')    return e < now;
            return true;
        });
    }, [validQuests, activeFilter]);

    return (
        <>
            <Header pageTitle='Quest Hub' />

            {questToDelete && address && (
                <DeleteQuestModal
                    quest={questToDelete}
                    walletAddress={address}
                    onClose={() => setQuestToDelete(null)}
                    onDeleted={handleQuestDeleted}
                />
            )}

            <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
                {/* Page header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Explore Quests</h2>
                        <p className="text-muted-foreground mt-1">Participate in active campaigns to earn crypto rewards.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 hidden sm:flex">
                            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="h-8 px-2.5 shadow-none" onClick={() => setViewMode('list')} title="List View">
                                <List className="h-4 w-4" />
                            </Button>
                            <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" className="h-8 px-2.5 shadow-none" onClick={() => setViewMode('grid')} title="Grid View">
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button variant="outline" onClick={() => router.push(address ? `/dashboard/${address}` : '/')} className="flex-1 md:flex-none">
                            My Dashboard
                        </Button>
                    </div>
                </div>

                {/* Filter tabs */}
                {!isLoading && !error && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {FILTER_TABS.map(tab => {
                            const isSelected = activeFilter === tab.key;
                            if (tab.key === 'joined' && !address) return null;

                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveFilter(tab.key)}
                                    className={cn(
                                        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200",
                                        isSelected
                                            ? tab.key === 'joined'
                                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                                : "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:text-primary"
                                    )}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    <span className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                        isSelected
                                            ? "bg-white/20 text-white"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                    )}>
                                        {filterCounts[tab.key]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Content */}
                {isLoading ? (
                    <Loading />
                ) : error ? (
                    <Card className="p-6 border-red-200 bg-red-50 text-red-800 flex flex-col items-center text-center">
                        <p className="font-semibold text-lg mb-2">Unable to load quests</p>
                        <p className="text-sm mb-4">{error}</p>
                        <Button onClick={fetchQuests} variant="outline" className="border-red-300 hover:bg-red-100">Retry</Button>
                    </Card>
                ) : filteredQuests.length === 0 ? (
                    <Card className="py-20 text-center text-muted-foreground border-dashed">
                        <p className="text-lg">
                            {activeFilter === 'joined'
                                ? "You haven't joined any quests yet."
                                : activeFilter === 'all'
                                    ? 'No active quests found.'
                                    : `No ${activeFilter} quests found.`}
                        </p>
                        {activeFilter === 'joined' ? (
                            <Button variant="link" onClick={() => setActiveFilter('all')}>Explore quests to join</Button>
                        ) : activeFilter === 'all' ? (
                            <Button variant="link" onClick={() => router.push('/quest/create-quest')}>Be the first to create one!</Button>
                        ) : (
                            <Button variant="link" onClick={() => setActiveFilter('all')}>View all quests</Button>
                        )}
                    </Card>
                ) : (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {filteredQuests.map(quest => (
                            <QuestCard
                                key={quest.faucetAddress}
                                quest={quest}
                                isOwner={!!(address && quest.creatorAddress.toLowerCase() === address.toLowerCase())}
                                viewMode={viewMode}
                                onNavigate={(slug) => router.push(`/quest/${slug}`)}
                                onDeleteClick={(q) => setQuestToDelete(q)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}