"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Language translations
const translations = {
  en: {
    all_good: "All Good",
    attention_needed: "Needs Attention",
    urgent: "Urgent",
    ask_anything: "Ask anything...",
    dashboard: "Dashboard",
    menu: "Menu",
    analytics: "Analytics",
    alerts: "Alerts",
    money: "Money",
    inventory: "Inventory",
    staff: "Staff",
    reports: "Reports",
    settings: "Settings",
  },
  hi: {
    all_good: "सब ठीक है",
    attention_needed: "ध्यान दें",
    urgent: "तत्काल",
    ask_anything: "कुछ भी पूछें...",
    dashboard: "डैशबोर्ड",
    menu: "मेन्यू",
    analytics: "विश्लेषण",
    alerts: "अलर्ट",
    money: "पैसे",
    inventory: "इन्वेंटरी",
    staff: "स्टाफ",
    reports: "रिपोर्ट",
    settings: "सेटिंग्स",
  },
  ta: {
    all_good: "நல்லது",
    attention_needed: "கவனிக்கவும்",
    urgent: "அவசரம்",
    ask_anything: "எதையும் கேளுங்கள்...",
    dashboard: "டாஷ்போர்டு",
    menu: "மெனு",
    analytics: "பகுப்பாய்வு",
    alerts: "எச்சரிக்கைகள்",
    money: "பணம்",
    inventory: "சரக்கு",
    staff: "ஊழியர்கள்",
    reports: "அறிக்கைகள்",
    settings: "அமைப்புகள்",
  },
  bn: {
    all_good: "সব ঠিক আছে",
    attention_needed: "মনোযোগ দিন",
    urgent: "জরুরি",
    ask_anything: "যেকোনো কিছু জিজ্ঞাসা করুন...",
    dashboard: "ড্যাশবোর্ড",
    menu: "মেনু",
    analytics: "বিশ্লেষণ",
    alerts: "সতর্কতা",
    money: "টাকা",
    inventory: "ইনভেন্টরি",
    staff: "কর্মচারী",
    reports: "রিপোর্ট",
    settings: "সেটিংস",
  },
}

type Language = keyof typeof translations

interface StatusCardProps {
  color: "green" | "yellow" | "red"
  icon: string
  label: string
  count?: number
  onClick?: () => void
}

function StatusCard({ color, icon, label, count, onClick }: StatusCardProps) {
  const colorClasses = {
    green: "bg-green-50 border-green-200 hover:bg-green-100",
    yellow: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    red: "bg-red-50 border-red-200 hover:bg-red-100",
  }

  return (
    <Card
      className={`cursor-pointer transition-colors ${colorClasses[color]}`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {count !== undefined && count > 0 && (
            <p className="text-2xl font-bold">{count}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface NavIconProps {
  icon: string
  label?: string
  onClick?: () => void
  active?: boolean
}

function NavIcon({ icon, label, onClick, active }: NavIconProps) {
  return (
    <button
      className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:scale-105 ${
        active
          ? "bg-primary text-primary-foreground shadow-lg"
          : "bg-muted hover:bg-muted/80"
      }`}
      onClick={onClick}
    >
      <span className="text-3xl mb-1">{icon}</span>
      {label && <span className="text-xs">{label}</span>}
    </button>
  )
}

interface VoiceInputProps {
  onCommand?: (command: string) => void
  placeholder?: string
}

function VoiceInput({ onCommand, placeholder }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")

  const handleVoiceStart = () => {
    // Check if browser supports speech recognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "hi-IN" // Support Hindi
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[0][0].transcript
      setTranscript(result)
      onCommand?.(result)
    }
    recognition.onerror = () => setListening(false)

    recognition.start()
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
        <button
          className={`p-3 rounded-full transition-all ${
            listening
              ? "bg-red-500 animate-pulse"
              : "bg-primary hover:bg-primary/90"
          }`}
          onClick={handleVoiceStart}
        >
          <span className="text-2xl text-white">🎤</span>
        </button>
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder={placeholder}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && transcript) {
              onCommand?.(transcript)
            }
          }}
        />
        {transcript && (
          <button
            className="p-2 hover:bg-muted-foreground/10 rounded"
            onClick={() => {
              onCommand?.(transcript)
              setTranscript("")
            }}
          >
            ➜
          </button>
        )}
      </div>
      {listening && (
        <p className="text-xs text-muted-foreground mt-1 animate-pulse">
          🔴 Listening...
        </p>
      )}
    </div>
  )
}

interface DesiDashboardProps {
  greenCount?: number
  yellowCount?: number
  redCount?: number
  onNavigate?: (route: string) => void
  onVoiceCommand?: (command: string) => void
}

export function DesiDashboard({
  greenCount = 0,
  yellowCount = 0,
  redCount = 0,
  onNavigate,
  onVoiceCommand,
}: DesiDashboardProps) {
  const [language, setLanguage] = useState<Language>("en")

  const t = (key: keyof (typeof translations)["en"]) => {
    return translations[language][key] || key
  }

  const goTo = (route: string) => {
    onNavigate?.(route)
  }

  const handleVoice = (command: string) => {
    onVoiceCommand?.(command)
    // Simple command parsing
    const lowerCommand = command.toLowerCase()
    if (lowerCommand.includes("menu") || lowerCommand.includes("मेन्यू")) {
      goTo("/menu")
    } else if (lowerCommand.includes("alert") || lowerCommand.includes("अलर्ट")) {
      goTo("/alerts")
    } else if (lowerCommand.includes("money") || lowerCommand.includes("पैसे")) {
      goTo("/money")
    } else if (lowerCommand.includes("analytics") || lowerCommand.includes("विश्लेषण")) {
      goTo("/analytics")
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      {/* Language Selector */}
      <div className="flex justify-end gap-2 mb-4">
        {(["en", "hi", "ta", "bn"] as Language[]).map((lang) => (
          <Button
            key={lang}
            variant={language === lang ? "default" : "outline"}
            size="sm"
            onClick={() => setLanguage(lang)}
          >
            {lang.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Traffic Light Status */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t("dashboard")}</CardTitle>
          <CardDescription>Quick status overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <StatusCard
              color="green"
              icon="🟢"
              label={t("all_good")}
              count={greenCount}
              onClick={() => goTo("/status/good")}
            />
            <StatusCard
              color="yellow"
              icon="🟡"
              label={t("attention_needed")}
              count={yellowCount}
              onClick={() => goTo("/status/attention")}
            />
            <StatusCard
              color="red"
              icon="🔴"
              label={t("urgent")}
              count={redCount}
              onClick={() => goTo("/status/urgent")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Icon Navigation - No text needed */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-3">
            <NavIcon icon="🍽️" label={t("menu")} onClick={() => goTo("/menu")} />
            <NavIcon icon="📊" label={t("analytics")} onClick={() => goTo("/analytics")} />
            <NavIcon icon="🚨" label={t("alerts")} onClick={() => goTo("/alerts")} />
            <NavIcon icon="💰" label={t("money")} onClick={() => goTo("/money")} />
            <NavIcon icon="📦" label={t("inventory")} onClick={() => goTo("/inventory")} />
            <NavIcon icon="👥" label={t("staff")} onClick={() => goTo("/staff")} />
            <NavIcon icon="📋" label={t("reports")} onClick={() => goTo("/reports")} />
            <NavIcon icon="⚙️" label={t("settings")} onClick={() => goTo("/settings")} />
          </div>
        </CardContent>
      </Card>

      {/* Voice Command */}
      <VoiceInput onCommand={handleVoice} placeholder={t("ask_anything")} />
    </div>
  )
}

export default DesiDashboard
