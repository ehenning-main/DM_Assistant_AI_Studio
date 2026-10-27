import React, { useState, useEffect } from "react";
import { Key, Eye, EyeOff, LogIn, LogOut, CheckCircle2, AlertCircle, ExternalLink, X, Shield, Sparkles, Loader2, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AiAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountChange?: (newKey: string) => void;
}

export function AiAccountModal({ isOpen, onClose, onAccountChange }: AiAccountModalProps) {
  const [currentKey, setCurrentKey] = useState<string>(() => {
    try {
      return localStorage.getItem("dma_custom_ai_key") || "";
    } catch {
      return "";
    }
  });

  const [inputKey, setInputKey] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Sync state whenever modal opens or storage changes
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem("dma_custom_ai_key") || "";
        setCurrentKey(stored);
        setInputKey(stored);
        setFeedback(null);
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Verify and save key
  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      setFeedback({ type: "error", text: "Please enter your Gemini / Google AI Studio API key." });
      return;
    }

    setIsVerifying(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/verify-ai-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: cleanKey }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        try {
          localStorage.setItem("dma_custom_ai_key", cleanKey);
          window.dispatchEvent(new Event("storage"));
        } catch {
          // ignore
        }
        setCurrentKey(cleanKey);
        setFeedback({
          type: "success",
          text: "✓ Account successfully authenticated and linked! Your personal quota and 1K chronicle art generation are now active.",
        });
        if (onAccountChange) {
          onAccountChange(cleanKey);
        }
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Failed to authenticate key with Gemini AI service. Please verify the key and try again.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Network error connecting to verification server.",
      });
    } finally {
      setIsVerifying(false);
    }
  }

  // Disconnect / Log out
  function handleLogout() {
    try {
      localStorage.removeItem("dma_custom_ai_key");
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
    setCurrentKey("");
    setInputKey("");
    setFeedback({
      type: "success",
      text: "Account disconnected. Chronicle art generation has reverted to the default shared app quota.",
    });
    if (onAccountChange) {
      onAccountChange("");
    }
  }

  const maskedKey = currentKey
    ? `${currentKey.substring(0, 6)}••••••••••••${currentKey.substring(Math.max(0, currentKey.length - 4))}`
    : "";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={onClose}
          id="ai-account-modal-overlay"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-950 border border-amber-500/40 rounded-xl max-w-lg w-full p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative cursor-default space-y-5"
            id="ai-account-modal-content"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-fantasy font-bold text-zinc-100 text-base tracking-wider uppercase flex items-center gap-2">
                    Separate AI Account Login
                  </h3>
                  <p className="text-zinc-400 text-xs font-sans mt-0.5">
                    Connect your personal Google AI Studio / Gemini account for Chronicle Art
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 rounded-md transition cursor-pointer"
                id="btn-close-ai-account-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Account Status Indicator */}
            <div
              className={`p-3.5 rounded-lg border flex flex-col gap-2 ${
                currentKey
                  ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
                  : "bg-zinc-900 border-zinc-800 text-zinc-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentKey ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-xs font-bold text-emerald-300 uppercase tracking-wide">
                        Personal AI Account Active
                      </span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="font-mono text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                        Using Default App Quota
                      </span>
                    </>
                  )}
                </div>
                {currentKey && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-[11px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline cursor-pointer"
                    id="btn-disconnect-ai-account"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Log Out</span>
                  </button>
                )}
              </div>

              {currentKey ? (
                <div className="text-[11px] font-mono text-emerald-400/80 bg-emerald-950/50 px-2.5 py-1.5 rounded border border-emerald-500/20 flex items-center justify-between">
                  <span>Key: {maskedKey}</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded uppercase">
                    1K Art Enabled
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  The app is currently using shared project quotas. If the shared quota hits limits, chronicle art automatically falls back to thematic vector renderings. Log into your own account below to generate unconstrained 1K concept art.
                </p>
              )}
            </div>

            {/* Login / Connect Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider font-mono">
                    Google AI Studio / Gemini API Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{showGuide ? "Hide Guide" : "How to get a key?"}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="AIzaSy..."
                    disabled={isVerifying}
                    className="w-full bg-zinc-900 border border-zinc-750 focus:border-amber-500 rounded-lg pl-3 pr-20 py-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition"
                    id="input-ai-account-key"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {inputKey && (
                      <button
                        type="button"
                        onClick={() => setInputKey("")}
                        className="p-1 text-zinc-500 hover:text-zinc-300 text-xs font-mono"
                        title="Clear"
                      >
                        ✕
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                      title={showPassword ? "Hide key" : "Show key"}
                      id="btn-toggle-key-visibility"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Guide Accordion */}
              {showGuide && (
                <div className="p-3 bg-zinc-900/90 border border-amber-500/20 rounded-lg text-xs space-y-2 text-zinc-300 animation-fadeIn">
                  <span className="font-semibold text-amber-300 font-fantasy block tracking-wide">
                    📜 How to acquire your Gemini key in 1 minute:
                  </span>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-400 leading-relaxed font-sans">
                    <li>Visit Google AI Studio with your Google account.</li>
                    <li>Click the blue <strong>"Get API key"</strong> button in the top left.</li>
                    <li>Create or copy a key and paste it into the field above.</li>
                  </ol>
                  <div className="pt-1">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-sans font-medium transition"
                      id="link-open-ai-studio"
                    >
                      <span>Open Google AI Studio Keys</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 leading-relaxed ${
                    feedback.type === "success"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                  }`}
                  id="ai-account-feedback-alert"
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  id="btn-cancel-ai-account"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !inputKey.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-850 disabled:text-zinc-600 text-zinc-950 font-bold rounded-lg text-xs uppercase tracking-wider shadow-md hover:shadow-amber-500/10 active:scale-98 transition flex items-center gap-1.5 cursor-pointer border border-amber-300/20"
                  id="btn-save-ai-account"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Verify &amp; Log In</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
