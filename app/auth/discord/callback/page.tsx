"use client"

import React, { useEffect } from 'react'
import { useSearchParams } from 'next/navigation' // Hook to read URL params
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Terminal } from "lucide-react"

export default function DiscordCallbackPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // 1. Capture everything from the URL
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // 2. Log it all to the console
    console.log("🚀 Discord Callback Data Received:", params)

    // 3. Send the signal to the main tab (Cross-tab communication)
    // We store the guild_id specifically so the other tab knows which server was joined
    if (params.guild_id) {
      localStorage.setItem('discord_bot_added', JSON.stringify({
        timestamp: Date.now(),
        guild_id: params.guild_id,
        status: 'success'
      }));
    }

    // Optional: auto-close the tab after 5 seconds so you have time to see the log
    const timer = setTimeout(() => {
      // window.close(); // Uncomment this when you are done debugging
    }, 5000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-green-500/20 bg-slate-900 shadow-2xl text-center">
        <CardHeader>
          <div className="mx-auto bg-green-500/10 p-3 rounded-full mb-4 w-fit">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Bot Authorized!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-8">
          <div className="bg-black/40 rounded-lg p-4 border border-white/5 text-left mb-4">
             <div className="flex items-center gap-2 text-blue-400 text-xs font-mono mb-2">
                <Terminal className="h-3 w-3" /> 
                <span>Incoming Logs:</span>
             </div>
             <pre className="text-[10px] text-slate-400 overflow-x-auto">
                {JSON.stringify(Object.fromEntries(searchParams.entries()), null, 2)}
             </pre>
          </div>
          
          <p className="text-slate-400 text-sm">
            The authorization data has been captured and synced with your quest editor.
          </p>
          <p className="text-xs font-medium text-slate-500 italic">
            You can now close this tab.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}