"use client"

import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from 'sonner'
import { Sparkles, ShieldAlert, ChevronLeft, CheckCircle2, ArrowRight, LayoutDashboard, Loader2 } from "lucide-react"
import { useSubscriptionModal } from '@/components/subscribe'
import Phase1QuestDetailsRewards, { 
    type QuestData, 
    type TokenConfiguration 
} from '@/components/quest/questBasic'

import Phase2TimingTasksFinalize, { 
    type TaskStage, 
    type QuestTask, 
    type VerificationType 
    
} from '@/components/quest/questAdvance'

import { useWallet } from "@/hooks/use-wallet"
import Loading from '@/app/loading'

interface UserProfile {
    wallet_address: string;
    username: string | null;
    avatar_url?: string;
}

const API_BASE_URL = "https://identical-vivi-faucetdrops-41e9c56b.koyeb.app"

// Helper to decode errors
const getUserFriendlyError = (error: any): string => {
    if (!error) return "An unexpected error occurred.";
    
    // Convert error to string for checking
    const msg = (typeof error === 'string' ? error : error.message || JSON.stringify(error)).toLowerCase();

    // 1. User Rejection
    if (msg.includes("rejected") || msg.includes("4001") || msg.includes("denied")) {
        return "Transaction cancelled. You declined the wallet request.";
    }

    // 2. Gas / Funds Issues
    if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
        return "Insufficient funds. You don't have enough ETH/Native Token for gas fees.";
    }
    if (msg.includes("intrinsic gas too low") || msg.includes("gas limit")) {
        return "Gas estimation failed. The network might be busy or the transaction is complex.";
    }

    // 3. Network / Connection
    if (msg.includes("network") || msg.includes("disconnected") || msg.includes("provider")) {
        return "Connection lost. Please check your internet or wallet network.";
    }

    // 4. Contract Logic
    if (msg.includes("execution reverted")) {
        return "Transaction failed on-chain. The contract rejected the request.";
    }

    // 5. Fallback: Return the raw message if it's short, otherwise generic
    return msg.length < 100 ? error.message || error : "Something went wrong. Please try again.";
};
// ==== 1. DEFINE SYSTEM TASKS HERE (Moved from Phase 2) ====
const SYSTEM_TASKS: QuestTask[] = [
    {
        id: 'sys_referral',
        title: 'Refer Friends',
        description: 'Share your unique referral link to earn points.',
        points: 200,
        required: false,
        category: 'referral',
        url: '',
        action: 'refer',
        verificationType: 'system_referral',
        stage: 'Beginner',
        isSystem: true,
        minReferrals: 1
    },
    {
        id: 'sys_share_quest_x',
        title: 'Share Quest on X',
        description: 'Share this quest page on X with @FaucetDrops and your referral link to earn points.',
        points: 100,
        required: false,
        category: 'social',
        url: '',
        action: 'share_quest',
        targetPlatform: 'Twitter',           // Good to add for UI rendering
        verificationType: 'system_x_share',  // <--- CHANGED FROM 'manual_link'
        stage: 'Beginner',
        isSystem: true,
    },
    {
        id: 'sys_daily',
        title: 'Daily Check-in',
        description: 'Return every 24 hours to claim free points.',
        points: 100,
        required: false,
        category: 'general',
        url: '',
        action: 'checkin',
        verificationType: 'system_daily',
        stage: 'Beginner',
        isSystem: true,
        isRecurring: true,
        recurrenceInterval: 24
    }
]

// Extended Interface
interface FullQuestState extends QuestData {
    tasks: QuestTask[]
    startDate?: string
    startTime?: string
    endDate?: string
    endTime?: string
    claimWindowValue: string,
  claimWindowUnit: string,
    claimWindowHours?: string
    enforceStageRules?: boolean
}

// Initial State
const initialNewQuest: FullQuestState = {
    title: "",
    description: "",
    imageUrl: "https://placehold.co/1280x1280/3b82f6/ffffff?text=Quest+Logo",
    rewardPool: "",
    distributionConfig: { model: 'equal', totalWinners: 100, tiers: [] },
    tasks: [], // Starts empty, but Effect below will fill it
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    claimWindowValue: "7",
    claimWindowUnit: "days",
    enforceStageRules: false
}

const initialNewTaskForm: Partial<QuestTask> = {
    stage: 'Beginner',
    category: 'social',
    verificationType: 'manual_link',
    points: 10,
    required: false
}

const initialStagePassRequirements = {
    Beginner: 0, Intermediate: 0, Advance: 0, Legend: 0, Ultimate: 0
}

function QuestCreatorContent() {
    const { isConnected, address } = useWallet()
    const router = useRouter()
    const searchParams = useSearchParams()
    
    // Check if we are editing a draft
    const draftId = searchParams.get('draftId')

    // ✅ State Definitions (All inside the function)
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null); // <--- FIXED
    const [isLoadingDraft, setIsLoadingDraft] = useState(false)
    const [phase, setPhase] = useState(1)
    const [error, setError] = useState<string | null>(null)
    const [newQuest, setNewQuest] = useState<FullQuestState>(initialNewQuest)
    
    // Phase 1 State
    const [selectedToken, setSelectedToken] = useState<TokenConfiguration | null>(null)
    const [nameError, setNameError] = useState<string | null>(null)
    const [isCheckingName, setIsCheckingName] = useState(false)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadImageError, setUploadImageError] = useState<string | null>(null)
    const [isSavingDraft, setIsSavingDraft] = useState(false)

    // Phase 2 State
    const [stagePassRequirements, setStagePassRequirements] = useState(initialStagePassRequirements)
    const [isFinalizing, setIsFinalizing] = useState(false)
    const [showDraftSuccessModal, setShowDraftSuccessModal] = useState(false)
    const [isDemoMode, setIsDemoMode] = useState(false)
    const [showPostPhase1Modal, setShowPostPhase1Modal] = useState(false)
    // Add this EFFECT to fetch the profile
    useEffect(() => {
        if (!address) return;

        const fetchProfile = async () => {
            try {
                // Replace this URL with your actual API endpoint for user profiles
                const res = await fetch(`${API_BASE_URL}/api/users/${address}`);
                if (res.ok) {
                    const data = await res.json();
                    setUserProfile(data); // <--- This updates the state!
                }
            } catch (e) {
                console.error("Failed to fetch user profile", e);
            }
        };

        fetchProfile();
    }, [address]);

    // Error Handling Effect
    useEffect(() => {
        if (error) {
            const friendlyMsg = getUserFriendlyError(error);
            toast.error(friendlyMsg);
            setError(null);
        }
    }, [error]);

    // ==== 2. INJECT SYSTEM TASKS ON MOUNT ====
    // This ensures they exist for Phase 1 Drafts AND Phase 2
    useEffect(() => {
        setNewQuest((prev) => {
            const currentTasks = prev.tasks || [];
            const existingIds = new Set(currentTasks.map((t) => t.id));
            
            // Only add system tasks if they are missing (prevents duplicates)
            const tasksToAdd = SYSTEM_TASKS.filter(st => !existingIds.has(st.id));

            if (tasksToAdd.length > 0) {
                return {
                    ...prev,
                    tasks: [...currentTasks, ...tasksToAdd]
                };
            }
            return prev;
        });
    }, []); 

    // --- EFFECT: Load Draft if draftId exists ---
   useEffect(() => {
        if (!draftId) return

        const fetchDraft = async () => {
            setIsLoadingDraft(true)
            try {
                const res = await fetch(`${API_BASE_URL}/api/quests/${draftId}`)
                const data = await res.json()

                if (data.success && data.quest) {
                    const q = data.quest
                    
                    const titleVal = q.title || ""
                    const descVal = q.description || ""
                    let imageVal = q.imageUrl || q.image_url || initialNewQuest.imageUrl
                    if (imageVal.startsWith('blob:')) imageVal = initialNewQuest.imageUrl 

                    const rewardPoolVal = q.rewardPool || q.reward_pool || ""
                    const startDateVal = q.startDate || q.start_date || ""
                    const endDateVal = q.endDate || q.end_date || ""
                    const claimWindowVal = q.claimWindowHours || q.claim_window_hours || "168"
                    const rulesVal = q.enforceStageRules || q.enforce_stage_rules || false
                    const tokenAddrVal = q.tokenAddress || q.token_address
                    const stageReqsVal = q.stagePassRequirements || q.stage_pass_requirements
                    const distConfigVal = q.distributionConfig || q.distribution_config || initialNewQuest.distributionConfig

                    // Ensure fetched tasks are merged with system tasks logic
                    const fetchedTasks = q.tasks || []
                    
                    // Create a Set of existing IDs to prevent duplicates
                    const existingIds = new Set(fetchedTasks.map((t: QuestTask) => t.id));
                    
                    // Find which system tasks are missing from the DB data
                    const missingSystemTasks = SYSTEM_TASKS.filter(st => !existingIds.has(st.id));
                    
                    // Combine them
                    const mergedTasks = [...fetchedTasks, ...missingSystemTasks];

                    setNewQuest({
                        title: titleVal,
                        description: descVal,
                        imageUrl: imageVal,
                        rewardPool: String(rewardPoolVal),
                        distributionConfig: distConfigVal,
                        tasks: mergedTasks, 
                        startDate: startDateVal,
                        startTime: "", 
                        endDate: endDateVal,
                        endTime: "",
                        claimWindowHours: String(claimWindowVal),
                        enforceStageRules: rulesVal,
                        faucetAddress: draftId, 
                        rewardTokenType: 'erc20', 
                        tokenAddress: tokenAddrVal,                 
                        claimWindowValue: "7",
                        claimWindowUnit: "days",
                    })

                    if (stageReqsVal) setStagePassRequirements(stageReqsVal)

                    if (tokenAddrVal) {
                         setSelectedToken({
                            address: tokenAddrVal,
                            name: "Token", 
                            symbol: "ERC20", 
                            decimals: 18
                         })
                    }

                    toast.success("Draft loaded successfully")
                    
                   try {
                    const creatorAddress = q.creatorAddress || q.creator_address
                    if (creatorAddress) {
                        const subRes = await fetch(`${API_BASE_URL}/api/users/${creatorAddress.toLowerCase()}/subscription`)
                        const subData = await subRes.json()
                        const isSubscribed = subData.success && subData.hasActiveSubscription === true
                        setIsDemoMode(!isSubscribed)
                    } else {
                        setIsDemoMode(true) // no creator address = safe default
                    }
                } catch {
                    setIsDemoMode(true) // check failed = safe default
                }

                if (titleVal) {
                    setPhase(2)
                }

                } else {
                    toast.error("Draft not found")
                }
            } catch (e) {
                console.error("Error loading draft", e)
            } finally {
                setIsLoadingDraft(false)
            }
        }

        fetchDraft()
    }, [draftId])
    // Add this function inside QuestCreatorContent
const saveDraftProgress = async (quest: any) => {
    if (!quest.faucetAddress || !address) return;

    try {
        const payload = {
            creatorAddress: address,
            faucetAddress: quest.faucetAddress,
            title: quest.title?.trim() || "",
            description: quest.description || "",
            imageUrl: quest.imageUrl || "",
            rewardPool: quest.rewardPool || "",
            rewardTokenType: quest.rewardTokenType,
            tokenAddress: quest.tokenAddress,
            distributionConfig: quest.distributionConfig,
            tasks: quest.tasks,
            // You can add more fields here later (startDate, endDate, etc.)
        };

        const res = await fetch(`${API_BASE_URL}/api/quests/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error("Auto-save failed", await res.text());
        }
    } catch (e) {
        console.error("Auto-save error:", e);
    }
};

// Updated task handlers (make them async and auto-save)
const handleAddTask = async (task: QuestTask) => {
    if (!task?.title) return;

    const newTaskWithId: QuestTask = {
        ...task,
        id: crypto.randomUUID(),
        points: Number(task.points || 0),
    };

    const updatedQuest = {
        ...newQuest,
        tasks: [...newQuest.tasks, newTaskWithId],
    };

    setNewQuest(updatedQuest);

    if (newQuest.faucetAddress) {
        await saveDraftProgress(updatedQuest);
    }
};

const handleUpdateTask = async (updatedTask: QuestTask) => {
    if (!updatedTask?.id) return; // safety check

    const updatedTasks = newQuest.tasks.map((t) =>
        t.id === updatedTask.id
            ? { ...updatedTask, points: Number(updatedTask.points || 0) }
            : t
    );

    const updatedQuest = {
        ...newQuest,
        tasks: updatedTasks,
    };

    setNewQuest(updatedQuest);

    if (newQuest.faucetAddress) {
        await saveDraftProgress(updatedQuest);
    }
};

const handleRemoveTask = async (taskId: string) => {
    const updatedQuest = {
        ...newQuest,
        tasks: newQuest.tasks.filter((t) => t.id !== taskId),
    };

    setNewQuest(updatedQuest);

    if (newQuest.faucetAddress) {
        await saveDraftProgress(updatedQuest);
    }
};
    const stageTotals = useMemo(() => {
        const totals = { Beginner: 0, Intermediate: 0, Advance: 0, Legend: 0, Ultimate: 0 }
        newQuest.tasks.forEach(task => {
            if (!task.isSystem && task.stage && totals[task.stage as TaskStage] !== undefined) {
                totals[task.stage as TaskStage] += Number(task.points) || 0
            }
        })
        return totals
    }, [newQuest.tasks])

    const stageTaskCounts = useMemo(() => {
        const counts = { Beginner: 0, Intermediate: 0, Advance: 0, Legend: 0, Ultimate: 0 }
        newQuest.tasks.forEach(task => {
            if (!task.isSystem && task.stage && counts[task.stage as TaskStage] !== undefined) {
                counts[task.stage as TaskStage]++
            }
        })
        return counts
    }, [newQuest.tasks])

    

    const handleImageUpload = async (file: File) => {
        setIsUploadingImage(true);
        setUploadImageError(null); 

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Upload failed");
            }

            const data = await response.json();

            if (data.success && data.url) {
                setNewQuest(prev => ({ ...prev, imageUrl: data.url }));
                toast.success("Image uploaded successfully");
            } else {
                throw new Error("Invalid response from server");
            }

        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadImageError(error.message || "Failed to upload image");
            toast.error("Failed to upload image");
        } finally {
            setIsUploadingImage(false);
        }
    }

    const handleDraftSaved = (faucetAddress: string) => {
        setNewQuest(prev => ({ ...prev, faucetAddress }))
        setShowPostPhase1Modal(true)
}

    const handleContinueToTasks = () => {
        setShowDraftSuccessModal(false)
        setPhase(2)
        window.scrollTo(0, 0)
    }

    const handleContinueLater = () => {
        setShowDraftSuccessModal(false)
        router.push('/dashboard/{username?}') 
    }
    // At the top of your component, add:
const { openSubscriptionModal } = useSubscriptionModal()
    const handleEditTask = (task: QuestTask) => { }
    const validateTask = () => true
    const handleUseSuggestedTask = (t: any) => { }
    const handleStagePassRequirementChange = (stage: TaskStage, val: number) => {
        setStagePassRequirements(prev => ({...prev, [stage]: val}))
    }
    const getStageColor = (s: TaskStage) => 'bg-gray-100'
    const getCategoryColor = (c: string) => 'text-blue-500'
    const getVerificationIcon = (t: VerificationType) => <CheckCircle2 className="h-4 w-4" />

    // ==== 3. SIMPLIFIED HANDLE FINALIZE ====
    // Since Phase 2 handles the API Call internally (via handleDeployAndFinalize),
    // this function is mostly a placeholder or can be used for redirection if needed.
    const handleFinalize = async (deployedAddress?: string) => {
        // If your Phase2 component calls this AFTER success, just redirect.
        // We do NOT need to fetch here if Phase2 component is doing the fetching.
        if(deployedAddress) {
             router.push('/dashboard')
        }
    }

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <ShieldAlert className="h-16 w-16 text-gray-400" />
                <h2 className="text-2xl font-bold">Wallet Disconnected</h2>
                <p className="text-muted-foreground">Please connect your wallet to create a quest campaign.</p>
            </div>
        )
    }

    if (isLoadingDraft) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loading/>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        {draftId ? "Edit Quest Draft" : "Create Quest Campaign"}
                       
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {phase === 1 ? "Step 1: Set up campaign details and token rewards" : "Step 2: Configure tasks, stages and timeline"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-12 rounded-full ${phase >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    <div className={`h-2 w-12 rounded-full ${phase >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                </div>
            </div>

            

            {phase === 1 && (
                <Phase1QuestDetailsRewards<FullQuestState>
                    newQuest={newQuest}
                    setNewQuest={setNewQuest}
                    selectedToken={selectedToken}
                    setSelectedToken={setSelectedToken}
                    nameError={nameError}
                    setNameError={setNameError}
                    isCheckingName={isCheckingName}
                    setIsCheckingName={setIsCheckingName}
                    isUploadingImage={isUploadingImage}
                    setIsUploadingImage={setIsUploadingImage}
                    uploadImageError={uploadImageError}
                    setUploadImageError={setUploadImageError}
                    handleImageUpload={handleImageUpload}
                    onDraftSaved={handleDraftSaved}
                    isSavingDraft={isSavingDraft}
                    setIsSavingDraft={setIsSavingDraft}
                    setError={setError}
                />
            )}

            {phase === 2 && (
                <div>
                    <Button 
                        variant="ghost" 
                        className="mb-4" 
                        onClick={() => setPhase(1)}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" /> Back to Details
                    </Button>
                    <Phase2TimingTasksFinalize
                        newQuest={newQuest}
                        setNewQuest={setNewQuest}
                        stagePassRequirements={stagePassRequirements}
                        setStagePassRequirements={setStagePassRequirements}
                        stageTotals={stageTotals}
                        stageTaskCounts={stageTaskCounts}
                        initialNewTaskForm={initialNewTaskForm}
                        validateTask={validateTask}
                        handleAddTask={handleAddTask}
                        handleUpdateTask={handleUpdateTask}
                        handleRemoveTask={handleRemoveTask}
                        saveDraftProgress={saveDraftProgress}
                        handleStagePassRequirementChange={handleStagePassRequirementChange}
                        getStageColor={getStageColor}
                        getCategoryColor={getCategoryColor}
                        getVerificationIcon={getVerificationIcon}
                        handleUseSuggestedTask={handleUseSuggestedTask}
                        isDemoMode={isDemoMode}
                        onSubscribed={() => setIsDemoMode(false)}
                        isFinalizing={isFinalizing}
                        setError={setError}
                        handleFinalize={handleFinalize}
                    />
                </div>
            )}

            {/* SUCCESS MODAL POPUP */}
    {showPostPhase1Modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-0 relative overflow-hidden">
            {/* Header gradient */}
            
            
            <div className="p-6 space-y-5">
                {/* Success check */}
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Quest Details Saved!</h3>
                        <p className="text-sm text-muted-foreground">Now configure tasks to activate your quest.</p>
                    </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/40 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                        Subscription required · $100 USDT to go live
                    </div>
                {/* Advantages panel */}
                <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Why subscribe?</p>
                    <ol className="space-y-2 text-sm text-blue-900 dark:text-blue-200">
                        {[
                            "- Unlimited quest campaigns with full task types",
                            "- Access to ready made task Template",
                            "- Access to our community, enabling you to scale quest seamlessly and acquire new users.",
                            "- On-chain verification engine for Blockchain Task",
                            "- Full admin dashboard & submission review",
                            "- Multi-stage quest progression system",
                            "- Reward Distribution mechanism with smart contract that handle your distribution automatically",
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span>{item}</span>
                            </li>
                        ))}
                    </ol>
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between">
                        <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">30-day full access</span>
                        <span className="text-lg font-black text-blue-700 dark:text-blue-300">$100 USDT</span>
                    </div>
                </div>

                {/* Demo mode notice */}
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <span className="shrink-0">⚡</span>
                    <span><strong>Demo Mode</strong> lets you add tasks and gives you limited access to participants and our verification engine. Create a demo quest to share with your team to test our platform.</span>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-1 gap-3 pt-1">
                    <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md h-12"
                        onClick={() => {
                                setShowPostPhase1Modal(false)
                                setPhase(2)
                                window.scrollTo(0, 0)
                            }}
                    >
                         Continue To Add Task
                    </Button>

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="w-full h-11 font-semibold border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            onClick={() => {
                                setIsDemoMode(true)
                                setShowPostPhase1Modal(false)
                                setPhase(2)
                                window.scrollTo(0, 0)
                            }}
                        >
                            ⚡ Try Demo
                        </Button>

                        <Button
    variant="outline"
    className="w-full h-11 font-semibold"
    onClick={() => {
        setShowPostPhase1Modal(false)
        openSubscriptionModal({ onSuccess: () => setIsDemoMode(false) })
    }}
>
    Subscribe Now — $100/month
</Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => {
                            setShowPostPhase1Modal(false)
                            const routeParam = userProfile?.username || address
                            if (routeParam) router.push(`/dashboard/${routeParam}`)
                        }}
                    >
                        Save & Continue Later
                    </Button>
                </div>
            </div>
        </div>
    </div>
)}
        </div>
    )
}

// Export the page wrapped in Suspense for Next.js App Router compatibility
export default function QuestCreatorPage() {
    return (
        <div className="min-h-screen pb-20 relative">
            <Header pageTitle="Quest Creator" />
            <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
                <QuestCreatorContent />
            </Suspense>
        </div>
    )
}