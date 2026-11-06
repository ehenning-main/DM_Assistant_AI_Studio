import React, { useState, useRef } from "react";
import {
  Download,
  Upload,
  FileJson,
  Archive,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  X,
  Scroll,
  BookOpen,
  Users,
  Sparkles,
  Image,
  Mic,
  Loader2,
  FileText,
  HardDrive,
  RefreshCw,
  FolderDown,
  FolderUp,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Campaign, Session } from "../types";
import {
  buildCampaignArchive,
  downloadCampaignArchive,
  validateAndParseArchive,
  importCampaignArchive,
  CampaignArchiveData,
} from "../services/campaignArchiveService";

interface CampaignArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCampaign: Campaign | null;
  allSessions: Session[];
  activeUserId: string;
  onImportSuccess: (importedCampaignId: string) => Promise<void>;
  initialTab?: "export" | "import";
}

export function CampaignArchiveModal({
  isOpen,
  onClose,
  activeCampaign,
  allSessions,
  activeUserId,
  onImportSuccess,
  initialTab = "export",
}: CampaignArchiveModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import">(initialTab);
  
  // Export states
  const [copiedJson, setCopiedJson] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // Import states
  const [importJsonText, setImportJsonText] = useState("");
  const [importMode, setImportMode] = useState<"new_campaign" | "restore_ids">("new_campaign");
  const [parsedArchive, setParsedArchive] = useState<CampaignArchiveData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial tab when opening
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDownloadSuccess(null);
      setImportError(null);
      setImportSuccessMessage(null);
      setParsedArchive(null);
      setImportJsonText("");
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Active campaign sessions
  const campaignSessions = activeCampaign
    ? allSessions.filter((s) => s.campaignId === activeCampaign.id)
    : [];

  const previewArchive = activeCampaign
    ? buildCampaignArchive(activeCampaign, allSessions)
    : null;

  const jsonStringPreview = previewArchive
    ? JSON.stringify(previewArchive, null, 2)
    : "";

  // Handle Export Download
  function handleDownload() {
    if (!activeCampaign) return;
    try {
      const result = downloadCampaignArchive(activeCampaign, allSessions);
      setDownloadSuccess(`Successfully downloaded "${result.fileName}" (${Math.round(result.sizeBytes / 1024)} KB)!`);
      setTimeout(() => setDownloadSuccess(null), 6000);
    } catch (err: any) {
      console.error("Export error:", err);
    }
  }

  // Handle Copy JSON
  function handleCopyJson() {
    if (!jsonStringPreview) return;
    navigator.clipboard.writeText(jsonStringPreview);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  }

  // Handle File Upload for Import
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setParsedArchive(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      const validation = validateAndParseArchive(content);
      if (validation.valid && validation.data) {
        setParsedArchive(validation.data);
      } else {
        setImportError(validation.error || "Failed to parse campaign archive JSON.");
      }
    };
    reader.onerror = () => {
      setImportError("Failed to read the selected file.");
    };
    reader.readAsText(file);

    // Reset input value so re-selecting same file triggers change
    e.target.value = "";
  }

  // Handle Manual Text Parse
  function handleParseManualText(text: string) {
    setImportJsonText(text);
    setImportError(null);
    if (!text.trim()) {
      setParsedArchive(null);
      return;
    }
    const validation = validateAndParseArchive(text);
    if (validation.valid && validation.data) {
      setParsedArchive(validation.data);
    } else {
      setParsedArchive(null);
      setImportError(validation.error || "Invalid JSON syntax or missing campaign data.");
    }
  }

  // Execute Import
  async function handleExecuteImport() {
    if (!parsedArchive) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const result = await importCampaignArchive({
        archiveData: parsedArchive,
        activeUserId,
        mode: importMode,
      });

      setImportSuccessMessage(
        `✓ Realm "${result.importedCampaign.name}" with ${result.importedSessionsCount} chapters was successfully restored!`
      );

      // Trigger app refresh and selection
      await onImportSuccess(result.importedCampaign.id);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Import error:", err);
      setImportError(err.message || "Failed to persist imported campaign data.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
        id="campaign-archive-modal-overlay"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.85)] relative overflow-hidden"
          id="campaign-archive-modal-content"
        >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between border-b border-zinc-850 px-5 py-4 bg-zinc-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-fantasy font-extrabold text-zinc-100 text-base tracking-wider uppercase flex items-center gap-2">
                  Campaign Archive &amp; Offline Portability
                </h3>
                <p className="text-zinc-400 text-xs font-sans">
                  Export complete campaign scrolls or import backups across DM Assistant iterations
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition cursor-pointer"
              id="btn-close-archive-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-850 bg-zinc-950/80 px-5 shrink-0">
            <button
              onClick={() => setActiveTab("export")}
              className={`py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === "export"
                  ? "border-red-500 text-red-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              id="tab-archive-export"
            >
              <FolderDown className="w-4 h-4" />
              <span>Export Realm Archive</span>
            </button>

            <button
              onClick={() => setActiveTab("import")}
              className={`py-3 px-4 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === "import"
                  ? "border-red-500 text-red-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
              id="tab-archive-import"
            >
              <FolderUp className="w-4 h-4" />
              <span>Import Realm Archive</span>
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {/* EXPORT TAB */}
            {activeTab === "export" && (
              <div className="space-y-5">
                {activeCampaign ? (
                  <>
                    {/* Campaign Identity Banner */}
                    <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-fantasy font-bold text-sm text-zinc-100 tracking-wide uppercase">
                            🏰 {activeCampaign.name}
                          </span>
                          {activeCampaign.setting && (
                            <span className="text-[10px] font-sans px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-400">
                              {activeCampaign.setting}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-xs italic font-sans line-clamp-2 max-w-lg">
                          {activeCampaign.description || "No description set for this realm."}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400 bg-zinc-950/80 px-3 py-1.5 rounded border border-zinc-850 shrink-0">
                        <span><strong>{campaignSessions.length}</strong> Chapters</span>
                        <span>•</span>
                        <span><strong>{activeCampaign.heroes?.length || 0}</strong> Heroes</span>
                      </div>
                    </div>

                    {/* What's Packed in the JSON */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold block">
                        📦 Included in this Single JSON Archive File:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-850/80 rounded flex items-center gap-2 text-zinc-300">
                          <Scroll className="w-4 h-4 text-red-400 shrink-0" />
                          <span><strong>{campaignSessions.length}</strong> Full Session Scrolls &amp; Dates</span>
                        </div>
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-850/80 rounded flex items-center gap-2 text-zinc-300">
                          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>DM Scribe &amp; Player Journal Notes</span>
                        </div>
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-850/80 rounded flex items-center gap-2 text-zinc-300">
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>AI Epic Chronicles &amp; Key Themes</span>
                        </div>
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-850/80 rounded flex items-center gap-2 text-zinc-300">
                          <Users className="w-4 h-4 text-red-400 shrink-0" />
                          <span><strong>{activeCampaign.heroes?.length || 0}</strong> Heroes &amp; Progression Histories</span>
                        </div>
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-850/80 rounded flex items-center gap-2 text-zinc-300">
                          <Image className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Illustrated Highlights &amp; Vector Art</span>
                        </div>
                        <div className="p-2.5 bg-zinc-900/50 border border-zinc-850/80 rounded flex items-center gap-2 text-zinc-300">
                          <Mic className="w-4 h-4 text-red-400 shrink-0" />
                          <span>Audio Transcripts &amp; Moment Timestamps</span>
                        </div>
                      </div>
                    </div>

                    {/* Download and Copy Actions */}
                    <div className="p-4 bg-gradient-to-br from-red-950/20 via-zinc-900/40 to-zinc-950 border border-red-500/20 rounded-lg space-y-3">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div>
                          <h4 className="font-fantasy font-bold text-xs uppercase tracking-wider text-zinc-200">
                            Download Offline Backup (.JSON)
                          </h4>
                          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                            Creates a standalone portable JSON file you can archive to disk or import into another DM Assistant.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={handleCopyJson}
                            className="px-3 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 rounded-lg text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            title="Copy full JSON content to clipboard"
                            id="btn-copy-archive-json"
                          >
                            {copiedJson ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Copy JSON</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleDownload}
                            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-lg shadow-md hover:shadow-red-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer border border-red-400/20 whitespace-nowrap"
                            id="btn-download-archive-json"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download JSON File</span>
                          </button>
                        </div>
                      </div>

                      {downloadSuccess && (
                        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded text-emerald-300 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{downloadSuccess}</span>
                        </div>
                      )}
                    </div>

                    {/* Expandable JSON Preview */}
                    <div className="border border-zinc-850 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowJsonPreview(!showJsonPreview)}
                        className="w-full px-4 py-2 bg-zinc-900/50 hover:bg-zinc-900 text-left text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center justify-between transition cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileJson className="w-3.5 h-3.5 text-red-400" />
                          <span>Inspect Raw JSON Payload ({Math.round(jsonStringPreview.length / 1024)} KB)</span>
                        </span>
                        <span>{showJsonPreview ? "Hide Preview ▲" : "Show Preview ▼"}</span>
                      </button>

                      {showJsonPreview && (
                        <div className="p-3 bg-zinc-950 max-h-56 overflow-y-auto border-t border-zinc-850">
                          <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-tight">
                            {jsonStringPreview.substring(0, 3000)}
                            {jsonStringPreview.length > 3000 && "\n\n... (preview truncated for display)"}
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-zinc-500 text-xs font-mono space-y-2">
                    <p>No active campaign realm selected.</p>
                    <p>Select or create a realm first to export its data.</p>
                  </div>
                )}
              </div>
            )}

            {/* IMPORT TAB */}
            {activeTab === "import" && (
              <div className="space-y-5">
                {/* File Dropzone & Selector */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-zinc-800 hover:border-red-500/50 bg-zinc-900/20 hover:bg-zinc-900/40 rounded-xl flex flex-col items-center justify-center gap-2.5 text-center cursor-pointer transition group"
                  id="dropzone-archive-file"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".json,application/json"
                    className="hidden"
                    id="input-file-campaign-json"
                  />
                  <div className="p-3 bg-zinc-900 border border-zinc-800 group-hover:border-red-500/40 rounded-full text-zinc-400 group-hover:text-red-400 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-fantasy text-xs font-bold uppercase tracking-wider text-zinc-200 block">
                      Select or Drag Campaign JSON File
                    </span>
                    <span className="text-[11px] text-zinc-500 font-sans mt-0.5 block">
                      Accepts files exported from Dungeon Master Assistant (.json)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-1 px-3 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-mono rounded border border-zinc-700/60"
                  >
                    Browse Files
                  </button>
                </div>

                {/* Direct Text Area Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-mono text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
                      Or Paste JSON Archive String Directly:
                    </label>
                    {importJsonText && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportJsonText("");
                          setParsedArchive(null);
                          setImportError(null);
                        }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>
                  <textarea
                    value={importJsonText}
                    onChange={(e) => handleParseManualText(e.target.value)}
                    placeholder='{"schemaVersion": "dma-campaign-archive-v1", "campaign": { ... }, "sessions": [ ... ]}'
                    rows={4}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-red-500 rounded-lg p-2.5 text-xs font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none scrollbar-thin scrollbar-thumb-zinc-800 transition"
                    id="textarea-import-archive-json"
                  />
                </div>

                {/* Validation Error Alert */}
                {importError && (
                  <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-200 text-xs flex items-start gap-2.5 leading-relaxed">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Validation Success & Archive Preview */}
                {parsedArchive && (
                  <div className="p-4 bg-zinc-900/40 border border-emerald-500/30 rounded-xl space-y-4">
                    <div className="flex items-start justify-between gap-2 border-b border-zinc-800 pb-3">
                      <div>
                        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Archive Validated Successfully
                        </span>
                        <h4 className="font-fantasy font-extrabold text-sm text-zinc-100 uppercase tracking-wider">
                          🏰 {parsedArchive.campaign.name}
                        </h4>
                        <p className="text-zinc-400 text-xs italic font-sans mt-0.5">
                          {parsedArchive.campaign.setting || "Custom Fantasy Setting"}
                        </p>
                      </div>

                      <div className="text-right text-[10px] font-mono text-zinc-500">
                        <span>Exported: {parsedArchive.exportedAt.split("T")[0]}</span>
                      </div>
                    </div>

                    {/* Stats Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-zinc-950/70 border border-zinc-850 rounded">
                        <span className="text-zinc-500 block text-[10px] font-mono">Chapters</span>
                        <span className="font-bold text-red-400 text-sm">{parsedArchive.stats.totalSessions}</span>
                      </div>
                      <div className="p-2 bg-zinc-950/70 border border-zinc-850 rounded">
                        <span className="text-zinc-500 block text-[10px] font-mono">Heroes</span>
                        <span className="font-bold text-amber-400 text-sm">{parsedArchive.stats.totalHeroes}</span>
                      </div>
                      <div className="p-2 bg-zinc-950/70 border border-zinc-850 rounded">
                        <span className="text-zinc-500 block text-[10px] font-mono">Characters</span>
                        <span className="font-bold text-zinc-200 text-sm">{parsedArchive.stats.totalCharacters}</span>
                      </div>
                      <div className="p-2 bg-zinc-950/70 border border-zinc-850 rounded">
                        <span className="text-zinc-500 block text-[10px] font-mono">Art Highlights</span>
                        <span className="font-bold text-emerald-400 text-sm">{parsedArchive.stats.totalHighlights}</span>
                      </div>
                    </div>

                    {/* Import Mode Radio Options */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold block">
                        Import Destination Strategy:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <label
                          className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer transition ${
                            importMode === "new_campaign"
                              ? "bg-red-500/10 border-red-500/40 text-zinc-100"
                              : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === "new_campaign"}
                            onChange={() => setImportMode("new_campaign")}
                            className="mt-0.5 text-red-500 focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold block text-zinc-200">Import as New Realm</span>
                            <span className="text-[11px] text-zinc-500 font-sans block mt-0.5">
                              Generates fresh IDs. Keeps any existing realms safe without naming collisions.
                            </span>
                          </div>
                        </label>

                        <label
                          className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer transition ${
                            importMode === "restore_ids"
                              ? "bg-red-500/10 border-red-500/40 text-zinc-100"
                              : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === "restore_ids"}
                            onChange={() => setImportMode("restore_ids")}
                            className="mt-0.5 text-red-500 focus:ring-0"
                          />
                          <div>
                            <span className="font-semibold block text-zinc-200">Restore Original IDs</span>
                            <span className="text-[11px] text-zinc-500 font-sans block mt-0.5">
                              Exact 1:1 match of original realm and chapter identifiers.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Execute Import Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleExecuteImport}
                        disabled={isImporting}
                        className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-zinc-800 disabled:to-zinc-850 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition flex items-center gap-2 cursor-pointer border border-red-400/20"
                        id="btn-confirm-import-archive"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Inscribing Realm into Scrolls...</span>
                          </>
                        ) : (
                          <>
                            <FolderUp className="w-4 h-4" />
                            <span>Inscribe Realm into DM Assistant</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Import Success Notification */}
                {importSuccessMessage && (
                  <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{importSuccessMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="border-t border-zinc-850 px-5 py-3 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500 font-mono shrink-0">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
              <span>Offline JSON Archive Format v1</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer font-sans"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
