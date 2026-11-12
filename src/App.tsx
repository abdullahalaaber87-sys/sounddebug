import { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import {
  FolderTree,
  FileCode2,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Terminal,
  Layers,
  Cpu,
  PlayCircle,
  BookOpen,
  Sparkles,
  PackageCheck,
  Eye,
  GitBranch,
  CheckCircle2
} from 'lucide-react';
import { ADDON_FILES, AddonFile, GITHUB_WORKFLOW_YAML } from './data/addonFiles';
import { SoundDebugSimulator } from './components/SoundDebugSimulator';

// Helper to generate a valid 64x64 PNG icon for assets/sounddebug/icon.png inside the ZIP
async function generateAddonIconPngBlob(): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark background
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, 64, 64);

    // Outer green chunk border
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 52, 52);

    // Inner radar rings
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Tall vertical pillar bar in center
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(28, 12, 8, 40);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    );
  } catch {
    return null;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<'code' | 'all-files' | 'simulator' | 'build-guide'>('code');
  const [selectedFilePath, setSelectedFilePath] = useState<string>(ADDON_FILES[0].path);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedWorkflow, setCopiedWorkflow] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [downloadTriggered, setDownloadTriggered] = useState<boolean>(false);

  const selectedFile: AddonFile =
    ADDON_FILES.find((f) => f.path === selectedFilePath) || ADDON_FILES[0];

  const handleCopyCode = async (file: AddonFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedPath(file.path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleCopyWorkflowYaml = async () => {
    try {
      await navigator.clipboard.writeText(GITHUB_WORKFLOW_YAML);
      setCopiedWorkflow(true);
      setTimeout(() => setCopiedWorkflow(false), 2500);
    } catch {
      // Ignore
    }
  };

  const handleDownloadSingleFile = (file: AddonFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZipProject = useCallback(async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const file of ADDON_FILES) {
        zip.file(file.path, file.content);
      }

      // Include valid 64x64 PNG icon at src/main/resources/assets/sounddebug/icon.png
      const iconBlob = await generateAddonIconPngBlob();
      if (iconBlob) {
        zip.file('src/main/resources/assets/sounddebug/icon.png', iconBlob);
      }

      zip.file(
        'README.md',
        `# SoundDebug Addon for Meteor Client 1.21.11 (GitHub Actions Ready)

## 1-Click Cloud Build with GitHub Actions (No Local Java/Gradle Needed)
This repository is pre-configured with **\`.github/workflows/build.yml\`** using **JDK 21** and **Gradle 9.2.0** (\`gradle/actions/setup-gradle@v4\`).

### How to Build on GitHub:
1. Create a new repository on [GitHub](https://github.com/new).
2. Upload or push all files from this ZIP (make sure the \`.github/workflows/build.yml\` file is included!).
   - *Tip if uploading via browser drag-and-drop*: Because Windows/macOS sometimes hides the \`.github\` folder, if you don't see a workflow run under the **Actions** tab after uploading, click **Actions -> New workflow -> set up a workflow yourself** and paste the contents of \`.github/workflows/build.yml\`.
3. Open the **Actions** tab in your GitHub repository.
4. Click the latest **Build SoundDebug Addon (MC 1.21.11)** workflow run.
5. Scroll down to **Artifacts** and download **\`sound-debug-addon-1.21.11\`** (which contains \`sound-debug-addon-1.0.0.jar\`), or grab it from your repo's **Releases** tab!
6. Place \`sound-debug-addon-1.0.0.jar\` in your \`.minecraft/mods/\` folder alongside \`meteor-client-1.21.11.jar\`.

## In-Game Usage
- Press **Right Shift** to open the Meteor ClickGUI.
- Find **\`sound-debug\`** under the **Render** category.
- **Left-Click** to toggle it on; **Right-Click** to adjust **\`range\`** (default 256, up to 4096), **\`tall\`** (default 150, up to 320), **\`display-duration\`**, **\`fill-color\`**, or click **\`test\`** to immediately preview the green 16x16 chunk box & tall pillar underneath your player.
`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sound-debug-meteor-1.21.11-github.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadTriggered(true);
    } finally {
      setIsZipping(false);
    }
  }, []);

  // Automatically trigger the GitHub-ready ZIP download once on mount so the user gets it immediately
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDownloadZipProject();
    }, 350);
    return () => clearTimeout(timer);
  }, [handleDownloadZipProject]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/90 bg-[#0d1322]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                Meteor Client 1.21.11 Addon
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <GitBranch className="w-3.5 h-3.5" />
                GitHub Actions Auto-Build Ready
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                100% Passive S2C (Grim / Vulcan / Matrix / NCP Safe)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              SoundDebug — GitHub-Ready Meteor 1.21.11 Addon Repository
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
              Includes <code className="text-emerald-300 font-mono">.github/workflows/build.yml</code> (JDK 21 + Gradle 9.2.0 cloud builder),{' '}
              <code className="text-emerald-300 font-mono">SoundDebug.java</code>,{' '}
              <code className="text-emerald-300 font-mono">SoundDebugAddon.java</code>,{' '}
              <code className="text-emerald-300 font-mono">build.gradle</code>, and{' '}
              <code className="text-emerald-300 font-mono">fabric.mod.json</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleDownloadZipProject}
              disabled={isZipping}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isZipping
                ? 'Packaging GitHub Repo ZIP...'
                : 'Download GitHub-Ready Repo (.ZIP)'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap gap-1 border-t border-slate-800/70 pt-2">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'code'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            Project Files &amp; GitHub Workflow
          </button>
          <button
            onClick={() => setActiveTab('all-files')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'all-files'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            All Deliverables (Single-Page View)
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            Live 3D Chunk &amp; ClickGUI Simulator
          </button>
          <button
            onClick={() => setActiveTab('build-guide')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'build-guide'
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            GitHub Actions Build Guide
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Prominent GitHub Actions Download & 3-Step Cloud Build Banner */}
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-purple-950/30 p-5 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  {downloadTriggered
                    ? 'sound-debug-meteor-1.21.11-github.zip Ready!'
                    : 'Preparing GitHub Actions Archive...'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  No local Gradle wrapper JAR or JDK installation needed — GitHub compiles it in ~2 mins
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                How to Compile <code className="text-emerald-400 font-mono">sound-debug-addon-1.0.0.jar</code> on GitHub:
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
                  <div className="font-mono font-bold text-emerald-400 mb-1">
                    Step 1 — Unzip &amp; Push / Upload
                  </div>
                  Extract <code className="text-slate-200">sound-debug-meteor-1.21.11-github.zip</code> and push or upload all files into a new GitHub repository.
                </div>
                <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
                  <div className="font-mono font-bold text-purple-300 mb-1">
                    Step 2 — Ensure Workflow Exists
                  </div>
                  Verify <code className="text-purple-300">.github/workflows/build.yml</code> is uploaded (or click <strong>Actions → New workflow → set up a workflow yourself</strong> and paste it).
                </div>
                <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800">
                  <div className="font-mono font-bold text-sky-300 mb-1">
                    Step 3 — Download JAR Artifact
                  </div>
                  Open the <strong>Actions</strong> tab, click the green workflow run, and download <strong>sound-debug-addon-1.21.11</strong> (or check <strong>Releases</strong>).
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <button
                onClick={handleDownloadZipProject}
                disabled={isZipping}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download GitHub ZIP Again
              </button>
              <button
                onClick={handleCopyWorkflowYaml}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-mono text-xs font-semibold transition cursor-pointer"
              >
                {copiedWorkflow ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Copied build.yml!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-purple-400" />
                    Copy .github/workflows/build.yml
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Requirement Verification Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">100% Passive S2C Detection</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Listens strictly to <code className="text-emerald-300">PlaySoundS2CPacket</code>,{' '}
                <code className="text-emerald-300">PlaySoundFromEntityS2CPacket</code> &amp;{' '}
                <code className="text-emerald-300">WorldEventS2CPacket</code>. Zero outgoing packets.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-start gap-3">
            <Eye className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">16×16 Chunk + Tall Pillar + 3D Tag</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Highlights the origin chunk (<code className="text-purple-300">ChunkPos</code>), extends a vertical beam up to 320 blocks, and draws <code className="text-purple-300">"Sound Detected"</code> via <code className="text-purple-300">NametagUtils</code>.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Range, Tall &amp; Instant Test</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Includes <code className="text-sky-300">range</code> (default 256, max 4096), <code className="text-sky-300">tall</code> (default 150), <code className="text-sky-300">test</code> auto-reset BoolSetting + <code className="text-sky-300">WButton</code> widget.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-start gap-3">
            <PackageCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">GitHub Actions + Gradle 9.2</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Uses <code className="text-amber-300">gradle/actions/setup-gradle@v4</code> with Gradle 9.2.0, JDK 21, and <code className="text-amber-300">meteor-client:1.21.11-SNAPSHOT</code>.
              </p>
            </div>
          </div>
        </div>

        {/* TAB 1: Interactive File Explorer + Code View */}
        {activeTab === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar: Project Structure Tree */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-emerald-400" />
                    GitHub Repo Structure (1.21.11)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{ADDON_FILES.length} files</span>
                </div>

                {/* ASCII Directory Tree Summary */}
                <div className="p-3 bg-slate-950/80 border-b border-slate-800/80 font-mono text-[11px] text-slate-400 leading-relaxed overflow-x-auto">
                  <pre>{`sound-debug-addon/
├── .github/workflows/
│   └── build.yml          <-- Auto-builds JAR on GitHub
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── build.gradle
├── gradle.properties
├── settings.gradle
├── LICENSE
├── .gitignore
└── src/main/
    ├── java/com/example/sounddebug/
    │   ├── SoundDebugAddon.java
    │   └── modules/
    │       └── SoundDebug.java
    └── resources/
        ├── fabric.mod.json
        ├── sounddebug.mixins.json
        └── assets/sounddebug/icon.png`}</pre>
                </div>

                {/* Clickable File List */}
                <div className="divide-y divide-slate-800/60">
                  {ADDON_FILES.map((file) => {
                    const isSelected = file.path === selectedFile.path;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFilePath(file.path)}
                        className={`w-full text-left px-4 py-3 transition flex items-start justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 border-l-2 border-emerald-400'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileCode2
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-emerald-400' : 'text-slate-400'
                              }`}
                            />
                            <span
                              className={`text-xs font-mono font-semibold truncate ${
                                isSelected ? 'text-emerald-300' : 'text-slate-200'
                              }`}
                            >
                              {file.name}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                            {file.path}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                          {file.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Callout to try the Live Simulator */}
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-2">
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <PlayCircle className="w-4 h-4" />
                  Preview the 3D Chunk Pillar &amp; ClickGUI
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Switch to the <strong>Live 3D Chunk &amp; ClickGUI Simulator</strong> tab to right-click{' '}
                  <code className="text-purple-300">sound-debug</code>, drag the <code className="text-emerald-300">Range</code> and <code className="text-emerald-300">Tall</code> sliders, and click <code className="text-emerald-300">Test</code> to highlight the chunk underneath the player.
                </p>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Open Interactive 3D &amp; ClickGUI Simulator →
                </button>
              </div>
            </div>

            {/* Right 8 Cols: Active File Code Viewer */}
            <div className="lg:col-span-8">
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {selectedFile.path}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {selectedFile.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedFile.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(selectedFile)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold transition cursor-pointer"
                    >
                      {copiedPath === selectedFile.path ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Code
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadSingleFile(selectedFile)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download File
                    </button>
                  </div>
                </div>

                {/* Line-numbered Code Block */}
                <div className="p-4 overflow-x-auto max-h-[720px] overflow-y-auto font-mono text-xs leading-relaxed bg-[#070a12]">
                  <table className="w-full border-collapse">
                    <tbody>
                      {selectedFile.content.split('\n').map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60">
                          <td className="select-none pr-4 text-right text-slate-600 w-10 align-top">
                            {idx + 1}
                          </td>
                          <td className="text-slate-200 whitespace-pre">{line || ' '}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: All Deliverables on a Single Page */}
        {activeTab === 'all-files' && (
          <div className="space-y-6">
            {ADDON_FILES.map((file) => (
              <div
                key={file.path}
                className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl"
              >
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-emerald-400">
                        {file.path}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {file.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{file.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(file)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-semibold transition cursor-pointer"
                    >
                      {copiedPath === file.path ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-slate-200 bg-[#070a12]">
                  <code>{file.content}</code>
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: Interactive 3D Chunk & ClickGUI Simulator */}
        {activeTab === 'simulator' && <SoundDebugSimulator />}

        {/* TAB 4: GitHub Actions Build & Anti-Cheat Architecture Guide */}
        {activeTab === 'build-guide' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                Building with GitHub Actions (Step-by-Step)
              </h2>
              <ol className="space-y-3 text-xs sm:text-sm text-slate-300 list-decimal list-inside leading-relaxed">
                <li>
                  Click <strong>Download GitHub-Ready Repo (.ZIP)</strong> above to save{' '}
                  <code className="text-emerald-300 font-mono">
                    sound-debug-meteor-1.21.11-github.zip
                  </code>{' '}
                  and extract it to a folder.
                </li>
                <li>
                  Create a new repository on GitHub and push or upload the extracted files:
                  <pre className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
{`git init
git add .
git commit -m "Add SoundDebug Meteor 1.21.11 addon"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main`}
                  </pre>
                </li>
                <li>
                  <strong>Uploading via Browser Drag-and-Drop instead of Git CLI?</strong>
                  <p className="mt-1 text-slate-400">
                    If you drag-and-drop files in your browser and your OS hides the{' '}
                    <code className="text-purple-300">.github</code> folder, simply click the{' '}
                    <strong>Actions</strong> tab in your GitHub repo →{' '}
                    <strong>set up a workflow yourself</strong>, and paste{' '}
                    <code className="text-emerald-300">.github/workflows/build.yml</code> using the{' '}
                    <strong>Copy .github/workflows/build.yml</strong> button above.
                  </p>
                </li>
                <li>
                  Wait ~2 minutes for the <strong>Build SoundDebug Addon (MC 1.21.11)</strong> workflow to finish, then download{' '}
                  <code className="text-emerald-300 font-mono">sound-debug-addon-1.0.0.jar</code> from the workflow run's <strong>Artifacts</strong> section (or from your repo's <strong>Releases</strong> page).
                </li>
                <li>
                  Drop <code className="text-emerald-300 font-mono">sound-debug-addon-1.0.0.jar</code> into{' '}
                  <code className="text-slate-200 font-mono">.minecraft/mods/</code> alongside{' '}
                  <code className="text-slate-200 font-mono">meteor-client-1.21.11.jar</code>.
                </li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Why SoundDebug is 100% Undetectable by Anti-Cheats
              </h2>
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <p>
                  Server anti-cheats such as <strong>Grim</strong>, <strong>Vulcan</strong>,{' '}
                  <strong>Matrix</strong>, and <strong>NoCheatPlus (NCP)</strong> can only analyze packets{' '}
                  <em>sent from your client to the server</em> (C2S packets like movement, rotations, block digging, or custom payloads).
                </p>
                <p>
                  <code className="text-emerald-300 font-mono">SoundDebug</code> subscribes exclusively to{' '}
                  <code className="text-emerald-300 font-mono">PacketEvent.Receive</code> (incoming S2C packets already sent by the server to your client):
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-300 font-mono text-xs">
                  <li>
                    <span className="text-emerald-400">PlaySoundS2CPacket</span> — Standard positional sounds (explosions, chests, pistons, weather).
                  </li>
                  <li>
                    <span className="text-emerald-400">PlaySoundFromEntityS2CPacket</span> — Entity-bound sounds resolved via client world entity ID.
                  </li>
                  <li>
                    <span className="text-emerald-400">WorldEventS2CPacket</span> — Global/dimension-wide sound events (ID 1023 Wither Spawn, ID 1038 End Portal Activation, ID 1028 Dragon Death).
                  </li>
                </ul>
                <p>
                  Because the module never cancels packets, never sends C2S packets, and performs all 16×16 chunk box math (<code className="text-emerald-300 font-mono">MathHelper.floor(x) &gt;&gt; 4</code>) and 3D rendering locally during <code className="text-emerald-300 font-mono">Render3DEvent</code> &amp; <code className="text-emerald-300 font-mono">Render2DEvent</code>, it is completely invisible to any server-side anti-cheat.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;
