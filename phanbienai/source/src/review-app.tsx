"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Home,
  KeyRound,
  LoaderCircle,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  EXPERTS,
  buildExpertPrompt,
  buildQuickPrompt,
  buildSynthesisPrompt,
  type DocumentContext,
  type ReviewDepth,
  type ReviewMode,
} from "./lib/review-prompts";

type Provider = "gemini" | "openai" | "anthropic" | "openrouter";

type Connection = {
  id: string;
  provider: Provider;
  label: string;
  model: string;
  apiKey: string;
  status: "untested" | "testing" | "ready" | "error";
  statusMessage: string;
};

type ImageInput = {
  name: string;
  mimeType: string;
  data: string;
};

type UploadedFile = {
  name: string;
  kind: string;
  status: "reading" | "ready" | "error";
  message?: string;
};

type ExpertReport = {
  expertId: string;
  expertName: string;
  connectionLabel: string;
  text: string;
  sources: Array<{ title: string; url: string }>;
  error?: string;
};

type ApiResult = {
  text: string;
  sources?: Array<{ title: string; url: string }>;
  usage?: unknown;
  webSearchApplied?: boolean;
  error?: string;
};

const PROVIDERS: Record<
  Provider,
  {
    name: string;
    shortName: string;
    defaultModel: string;
    keyUrl: string;
    tone: string;
    supportsWeb: boolean;
  }
> = {
  gemini: {
    name: "Google Gemini",
    shortName: "Gemini",
    defaultModel: "gemini-3.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    tone: "provider-gemini",
    supportsWeb: true,
  },
  openai: {
    name: "OpenAI",
    shortName: "OpenAI",
    defaultModel: "gpt-5-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    tone: "provider-openai",
    supportsWeb: true,
  },
  anthropic: {
    name: "Anthropic Claude",
    shortName: "Claude",
    defaultModel: "claude-sonnet-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
    tone: "provider-claude",
    supportsWeb: true,
  },
  openrouter: {
    name: "OpenRouter",
    shortName: "OpenRouter",
    defaultModel: "~openai/gpt-latest",
    keyUrl: "https://openrouter.ai/settings/keys",
    tone: "provider-openrouter",
    supportsWeb: true,
  },
};

const DOCUMENT_TYPES = [
  "Sáng kiến",
  "Giải pháp",
  "Bài luận",
  "Bài nghiên cứu",
  "Báo cáo",
  "Kế hoạch/đề án",
  "Tài liệu giáo dục",
  "Văn bản chính sách",
  "Loại khác",
];

const DEFAULT_EXPERTS = ["content", "logic", "evidence", "practice"];

const AI_GATEWAY_URL = "https://ho-tro-phan-bien-ai.nddungdn.workers.dev/api/review";

function connectionId() {
  return `connection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeConnection(provider: Provider, index = 1): Connection {
  return {
    id: connectionId(),
    provider,
    label: `${PROVIDERS[provider].shortName} ${index}`,
    model: PROVIDERS[provider].defaultModel,
    apiKey: "",
    status: "untested",
    statusMessage: "Chưa kiểm tra",
  };
}

function stripDataUrl(dataUrl: string) {
  const marker = dataUrl.indexOf(",");
  return marker >= 0 ? dataUrl.slice(marker + 1) : dataUrl;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugFilename(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "bao-cao-phan-bien"
  );
}

export default function ReviewApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connections, setConnections] = useState<Connection[]>([makeConnection("gemini")]);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("Sáng kiến");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [field, setField] = useState("");
  const [scope, setScope] = useState("Toàn bộ tài liệu");
  const [documentText, setDocumentText] = useState("");
  const [images, setImages] = useState<ImageInput[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [fileMessage, setFileMessage] = useState("");
  const [selectedExperts, setSelectedExperts] = useState<string[]>(DEFAULT_EXPERTS);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [chairConnectionId, setChairConnectionId] = useState("");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("internal");
  const [depth, setDepth] = useState<ReviewDepth>("standard");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Sẵn sàng phân tích");
  const [expertReports, setExpertReports] = useState<ExpertReport[]>([]);
  const [finalReport, setFinalReport] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [activeTab, setActiveTab] = useState<"report" | "experts" | "sources">("report");
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuideOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [guideOpen]);

  const defaultConnectionId = connections[0]?.id || "";
  const resolvedChairId = chairConnectionId || defaultConnectionId;
  const selectedDefinitions = EXPERTS.filter((expert) => selectedExperts.includes(expert.id));
  const estimatedCalls = depth === "quick" ? 1 : selectedDefinitions.length + 1;
  const allSources = useMemo(() => {
    const values = expertReports.flatMap((report) => report.sources || []);
    return Array.from(new Map(values.map((source) => [source.url, source])).values());
  }, [expertReports]);

  function updateConnection(id: string, patch: Partial<Connection>) {
    setConnections((current) =>
      current.map((connection) =>
        connection.id === id
          ? { ...connection, ...patch, ...(patch.apiKey || patch.model || patch.provider ? { status: "untested" as const, statusMessage: "Chưa kiểm tra" } : {}) }
          : connection,
      ),
    );
  }

  function changeProvider(id: string, provider: Provider) {
    const index = connections.findIndex((connection) => connection.id === id) + 1;
    updateConnection(id, {
      provider,
      label: `${PROVIDERS[provider].shortName} ${Math.max(index, 1)}`,
      model: PROVIDERS[provider].defaultModel,
      apiKey: "",
    });
  }

  function addConnection() {
    if (connections.length >= 4) return;
    const providerOrder: Provider[] = ["gemini", "openai", "anthropic", "openrouter"];
    const unused = providerOrder.find((provider) => !connections.some((connection) => connection.provider === provider));
    const provider = unused || "gemini";
    setConnections((current) => [...current, makeConnection(provider, current.length + 1)]);
  }

  function removeConnection(id: string) {
    if (connections.length === 1) return;
    setConnections((current) => current.filter((connection) => connection.id !== id));
    setAssignments((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (next[key] === id) delete next[key];
      });
      return next;
    });
    if (chairConnectionId === id) setChairConnectionId("");
  }

  async function callApi(connection: Connection, prompt: string, withImages: ImageInput[], requestWebSearch: boolean) {
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        provider: connection.provider,
        apiKey: connection.apiKey,
        model: connection.model,
        prompt,
        images: withImages,
        webSearch: requestWebSearch && PROVIDERS[connection.provider].supportsWeb,
      }),
    });
    const result = (await response.json()) as ApiResult;
    if (!response.ok || result.error) throw new Error(result.error || "Không thể kết nối AI.");
    return result;
  }

  async function testConnection(connection: Connection) {
    if (!connection.apiKey.trim() || !connection.model.trim()) {
      updateConnection(connection.id, { status: "error", statusMessage: "Nhập API key và mã mô hình" });
      return;
    }
    updateConnection(connection.id, { status: "testing", statusMessage: "Đang kiểm tra…" });
    try {
      await callApi(
        connection,
        "Đây là phép thử kết nối. Chỉ trả lời đúng một dòng: KẾT NỐI THÀNH CÔNG",
        [],
        false,
      );
      updateConnection(connection.id, { status: "ready", statusMessage: "Kết nối thành công" });
    } catch (error) {
      updateConnection(connection.id, {
        status: "error",
        statusMessage: error instanceof Error ? error.message : "Kết nối thất bại",
      });
    }
  }

  async function extractPdf(file: File) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => (item && typeof item === "object" && "str" in item ? String(item.str) : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(`[Trang ${pageNumber}]\n${text}`);
    }
    return pages.join("\n\n");
  }

  async function extractFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (file.type.startsWith("image/")) {
      if (images.length >= 4) throw new Error("Mỗi lần chỉ hỗ trợ tối đa 4 ảnh.");
      if (file.size > 5_500_000) throw new Error("Mỗi ảnh không được vượt quá 5 MB.");
      const dataUrl = await fileToDataUrl(file);
      setImages((current) => [
        ...current,
        { name: file.name, mimeType: file.type || "image/jpeg", data: stripDataUrl(dataUrl) },
      ]);
      return `[Ảnh đính kèm: ${file.name}]`;
    }
    if (extension === "txt" || extension === "md" || file.type.startsWith("text/")) {
      return file.text();
    }
    if (extension === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    }
    if (extension === "pdf" || file.type === "application/pdf") {
      return extractPdf(file);
    }
    throw new Error("Định dạng chưa hỗ trợ. Hãy dùng PDF, DOCX, TXT, MD hoặc ảnh.");
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setFileMessage("");
    const files = Array.from(fileList).slice(0, 8);
    for (const file of files) {
      if (file.size > 12_000_000) {
        setUploadedFiles((current) => [
          ...current,
          { name: file.name, kind: file.type || "Tệp", status: "error", message: "Tệp vượt quá 12 MB" },
        ]);
        continue;
      }
      setUploadedFiles((current) => [
        ...current,
        { name: file.name, kind: file.type || "Tệp", status: "reading" },
      ]);
      try {
        const extracted = await extractFile(file);
        setDocumentText((current) => {
          const next = `${current.trim()}${current.trim() ? "\n\n" : ""}===== ${file.name} =====\n${extracted}`;
          return next.slice(0, 180_000);
        });
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
        setUploadedFiles((current) =>
          current.map((item) =>
            item.name === file.name && item.status === "reading" ? { ...item, status: "ready" } : item,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể đọc tệp";
        setUploadedFiles((current) =>
          current.map((item) =>
            item.name === file.name && item.status === "reading"
              ? { ...item, status: "error", message }
              : item,
          ),
        );
        setFileMessage(message);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeUploadedFile(name: string) {
    setUploadedFiles((current) => current.filter((file) => file.name !== name));
    setImages((current) => current.filter((image) => image.name !== name));
  }

  function toggleExpert(id: string) {
    setSelectedExperts((current) =>
      current.includes(id)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function getConnection(id?: string) {
    return connections.find((connection) => connection.id === id) || connections[0];
  }

  function appendSources(text: string, sources: Array<{ title: string; url: string }> = []) {
    if (!sources.length) return text;
    const list = sources.map((source) => `- [${source.title}](${source.url})`).join("\n");
    return `${text}\n\n### Nguồn do công cụ kiểm chứng trả về\n${list}`;
  }

  function buildContext(): DocumentContext {
    return {
      title,
      documentType,
      purpose,
      audience,
      field,
      scope,
      text: documentText.slice(0, 180_000),
      imageNames: images.map((image) => image.name),
    };
  }

  function validateReview() {
    if (!documentText.trim() && !images.length) return "Hãy tải tài liệu, ảnh hoặc dán nội dung cần phản biện.";
    if (!selectedDefinitions.length) return "Hãy chọn ít nhất một thành viên hội đồng.";
    const neededIds = new Set<string>([resolvedChairId]);
    if (depth !== "quick") {
      selectedDefinitions.forEach((expert) => neededIds.add(assignments[expert.id] || defaultConnectionId));
    }
    for (const id of neededIds) {
      const connection = getConnection(id);
      if (!connection?.apiKey.trim()) return `Hãy nhập API key cho kết nối “${connection?.label || "AI"}”.`;
      if (!connection.model.trim()) return `Hãy nhập mã mô hình cho kết nối “${connection.label}”.`;
    }
    return "";
  }

  async function runReview() {
    const validation = validateReview();
    if (validation) {
      setGlobalError(validation);
      return;
    }
    setRunning(true);
    setGlobalError("");
    setFinalReport("");
    setExpertReports([]);
    setActiveTab("report");
    setProgress(3);
    const context = buildContext();
    const chairConnection = getConnection(resolvedChairId);

    try {
      if (depth === "quick") {
        setProgressLabel("Chủ tịch hội đồng đang phản biện nhanh…");
        setProgress(25);
        const result = await callApi(
          chairConnection,
          buildQuickPrompt(selectedDefinitions, context, reviewMode),
          images,
          reviewMode === "verified",
        );
        const reportText = appendSources(result.text, result.sources);
        setExpertReports([
          {
            expertId: "chair",
            expertName: "Chủ tịch hội đồng",
            connectionLabel: chairConnection.label,
            text: reportText,
            sources: result.sources || [],
          },
        ]);
        setFinalReport(reportText);
        setProgress(100);
        setProgressLabel("Đã hoàn thành báo cáo phản biện nhanh");
        return;
      }

      const reports: ExpertReport[] = [];
      for (let index = 0; index < selectedDefinitions.length; index += 1) {
        const expert = selectedDefinitions[index];
        const connection = getConnection(assignments[expert.id] || defaultConnectionId);
        setProgressLabel(`${expert.name} đang phân tích…`);
        setProgress(Math.round(5 + (index / (selectedDefinitions.length + 1)) * 78));
        try {
          const result = await callApi(
            connection,
            buildExpertPrompt(expert, context, reviewMode, depth),
            images,
            reviewMode === "verified",
          );
          reports.push({
            expertId: expert.id,
            expertName: expert.name,
            connectionLabel: connection.label,
            text: appendSources(result.text, result.sources),
            sources: result.sources || [],
          });
        } catch (error) {
          reports.push({
            expertId: expert.id,
            expertName: expert.name,
            connectionLabel: connection.label,
            text: "",
            sources: [],
            error: error instanceof Error ? error.message : "Không thể hoàn thành lượt phản biện.",
          });
        }
        setExpertReports([...reports]);
      }

      const successful = reports.filter((report) => report.text.trim());
      if (!successful.length) throw new Error("Không thành viên nào hoàn thành phản biện. Hãy kiểm tra API key và mã mô hình.");

      setProgressLabel("Chủ tịch hội đồng đang đối chiếu và tổng hợp…");
      setProgress(86);
      const synthesis = await callApi(
        chairConnection,
        buildSynthesisPrompt(
          context,
          successful.map((report) => ({ expertName: report.expertName, report: report.text })),
          reviewMode,
          depth,
        ),
        [],
        reviewMode === "verified",
      );
      setFinalReport(appendSources(synthesis.text, synthesis.sources));
      if (synthesis.sources?.length) {
        setExpertReports((current) => [
          ...current,
          {
            expertId: "chair",
            expertName: "Chủ tịch hội đồng",
            connectionLabel: chairConnection.label,
            text: appendSources(synthesis.text, synthesis.sources),
            sources: synthesis.sources || [],
          },
        ]);
      }
      setProgress(100);
      setProgressLabel("Hội đồng đã hoàn thành báo cáo");
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Quá trình phản biện gặp lỗi.");
      setProgressLabel("Chưa thể hoàn thành báo cáo");
    } finally {
      setRunning(false);
    }
  }

  async function copyReport() {
    if (!finalReport) return;
    await navigator.clipboard.writeText(finalReport);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadWord() {
    if (!finalReport) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Báo cáo phản biện</title><style>body{font-family:Arial,sans-serif;line-height:1.65;margin:42px;color:#172033}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>Báo cáo Hội đồng phản biện AI 360°</h1><pre>${escapeHtml(finalReport)}</pre><p><em>Mọi kết quả chỉ mang tính chất tham khảo.</em></p></body></html>`;
    downloadBlob(new Blob([html], { type: "application/msword;charset=utf-8" }), `${slugFilename(title)}-phan-bien.doc`);
  }

  function downloadMarkdown() {
    if (!finalReport) return;
    downloadBlob(new Blob([finalReport], { type: "text/markdown;charset=utf-8" }), `${slugFilename(title)}-phan-bien.md`);
  }

  function resetResults() {
    setFinalReport("");
    setExpertReports([]);
    setProgress(0);
    setProgressLabel("Sẵn sàng phân tích");
    setGlobalError("");
  }

  return (
    <div className="site-frame">
      <header className="site-header">
        <nav className="topbar" aria-label="Điều hướng chính">
          <a className="brand-link" href="https://www.hoclieuso.id.vn/" target="_blank" rel="noreferrer">
            <span className="brand-mark" aria-hidden="true">HLS</span>
            <span>
              <strong>Học liệu số</strong>
              <small>Chia sẻ tri thức · Kết nối học tập</small>
            </span>
          </a>
          <div className="topbar-actions">
            <button className="home-button" type="button" onClick={() => setGuideOpen(true)} title="Hướng dẫn sử dụng">
              <CircleHelp size={17} />
              <span className="nav-label">Hướng dẫn sử dụng</span>
            </button>
            <a className="home-button" href="https://www.hoclieuso.id.vn/" target="_blank" rel="noreferrer" title="Về trang chủ Học liệu số">
              <Home size={17} />
              <span className="nav-label">Về trang chủ</span>
            </a>
          </div>
        </nav>
        <div className="hero-copy">
          <div className="hero-kicker"><Scale size={16} /> Phản biện đa góc nhìn bằng AI</div>
          <h1>HỘI ĐỒNG PHẢN BIỆN AI 360°</h1>
          <p>
            Phân tích sáng kiến, giải pháp, bài luận và báo cáo từ nhiều góc nhìn; chỉ rõ căn cứ,
            mức độ tin cậy và hướng cải thiện.
          </p>
          <div className="hero-trust-row">
            <span><ShieldCheck size={16} /> API cá nhân</span>
            <span><Users size={16} /> Hội đồng đa mô hình</span>
            <span><FileText size={16} /> Báo cáo có căn cứ</span>
          </div>
        </div>
      </header>

      {guideOpen && (
        <div className="guide-overlay" role="presentation" onMouseDown={() => setGuideOpen(false)}>
          <section
            className="guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="guide-header">
              <div>
                <span className="guide-kicker"><CircleHelp size={16} /> Hướng dẫn nhanh</span>
                <h2 id="guide-title">Sử dụng Hội đồng phản biện AI 360°</h2>
                <p>Hoàn thành sáu bước dưới đây để nhận báo cáo phản biện đa góc nhìn.</p>
              </div>
              <button className="guide-close" type="button" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn">
                <X size={20} />
              </button>
            </header>

            <div className="guide-body">
              <ol className="guide-steps">
                <li>
                  <span className="guide-step-number">1</span>
                  <div><h3>Kết nối nền tảng AI</h3><p>Chọn Gemini, OpenAI, Claude hoặc OpenRouter; nhập mã mô hình và API key cá nhân rồi bấm <strong>Kiểm tra</strong>. Có thể thêm tối đa bốn kết nối để các chuyên gia dùng những mô hình khác nhau.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">2</span>
                  <div><h3>Cung cấp tài liệu</h3><p>Nhập tên, loại tài liệu và bối cảnh; sau đó dán nội dung hoặc tải PDF, DOCX, TXT, Markdown hay ảnh. Với PDF scan, nên OCR trước hoặc tải ảnh trang rõ nét.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">3</span>
                  <div><h3>Thành lập hội đồng</h3><p>Chọn ít nhất một vai trò phản biện. Nên giữ bốn vai trò mặc định; bật thêm Phương pháp, Dữ liệu, Đạo đức–pháp lý hoặc Người đọc khi phù hợp. Phân công từng vai trò cho một kết nối AI.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">4</span>
                  <div><h3>Chọn chế độ và độ sâu</h3><p><strong>Nội tại</strong> chỉ đánh giá theo tài liệu. <strong>Có kiểm chứng</strong> cho phép tìm nguồn ngoài và có thể phát sinh phí tìm kiếm. Mức Nhanh tiết kiệm lượt gọi; Tiêu chuẩn phù hợp đa số trường hợp; Chuyên sâu cho tài liệu quan trọng.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">5</span>
                  <div><h3>Chạy và đọc kết quả</h3><p>Bấm <strong>Bắt đầu phản biện</strong> và giữ tab mở đến khi hoàn tất. Đọc Báo cáo tổng hợp trước, sau đó đối chiếu Phản biện thành viên và Nguồn kiểm chứng. Ưu tiên vấn đề nghiêm trọng có căn cứ rõ và độ chắc chắn cao.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">6</span>
                  <div><h3>Lưu hoặc chia sẻ báo cáo</h3><p>Sao chép kết quả, tải Word/Markdown hoặc in thành PDF. Luôn kiểm tra lại trích dẫn, số liệu và kết luận trước khi dùng cho chấm điểm, công bố hay ra quyết định.</p></div>
                </li>
              </ol>

              <div className="guide-notes">
                <article>
                  <ShieldCheck size={20} />
                  <div><h3>Bảo mật khóa API</h3><p>Không gửi khóa cho người khác và không dán khóa vào tài liệu. Khóa chỉ giữ trong bộ nhớ tab, không ghi vào cơ sở dữ liệu; đóng hoặc tải lại tab sẽ xóa khóa đã nhập.</p></div>
                </article>
                <article>
                  <AlertCircle size={20} />
                  <div><h3>Chi phí và giới hạn</h3><p>Mỗi chuyên gia và Chủ tịch hội đồng tạo một lượt gọi AI. Phí, hạn mức và khả năng tìm kiếm phụ thuộc tài khoản cùng mô hình bạn chọn.</p></div>
                </article>
              </div>

              <div className="guide-provider-links">
                <span>Tạo hoặc quản lý API key:</span>
                {(Object.keys(PROVIDERS) as Provider[]).map((provider) => (
                  <a key={provider} href={PROVIDERS[provider].keyUrl} target="_blank" rel="noreferrer">
                    {PROVIDERS[provider].shortName} <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
            </div>

            <footer className="guide-footer">
              <p>Mọi kết quả do AI tạo chỉ mang tính chất tham khảo.</p>
              <button className="guide-done" type="button" onClick={() => setGuideOpen(false)}>Đã hiểu, bắt đầu sử dụng</button>
            </footer>
          </section>
        </div>
      )}

      <main className="workspace-shell">
        <section className="privacy-banner" aria-label="Lưu ý bảo mật">
          <ShieldCheck size={22} />
          <div>
            <strong>Khóa API không được lưu vào cơ sở dữ liệu.</strong>
            <span>Khóa chỉ tồn tại trong bộ nhớ của tab và được gửi qua cổng kết nối để thực hiện yêu cầu.</span>
          </div>
        </section>

        <div className="workspace-grid">
          <aside className="control-column">
            <section className="control-card">
              <div className="section-heading">
                <span className="step-number">1</span>
                <div><h2>Kết nối AI</h2><p>Thêm tối đa bốn nền tảng.</p></div>
              </div>

              <div className="connection-list">
                {connections.map((connection) => {
                  const config = PROVIDERS[connection.provider];
                  return (
                    <article className={`connection-card ${config.tone}`} key={connection.id}>
                      <div className="connection-topline">
                        <span className="provider-dot" />
                        <input
                          className="connection-label-input"
                          value={connection.label}
                          onChange={(event) => updateConnection(connection.id, { label: event.target.value })}
                          aria-label="Tên kết nối"
                        />
                        {connections.length > 1 && (
                          <button className="icon-button danger" onClick={() => removeConnection(connection.id)} title="Xóa kết nối" type="button">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <label>
                        <span>Nhà cung cấp</span>
                        <select value={connection.provider} onChange={(event) => changeProvider(connection.id, event.target.value as Provider)}>
                          {Object.entries(PROVIDERS).map(([id, provider]) => <option key={id} value={id}>{provider.name}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Mã mô hình</span>
                        <input value={connection.model} onChange={(event) => updateConnection(connection.id, { model: event.target.value })} spellCheck={false} />
                      </label>
                      <label>
                        <span>API key</span>
                        <div className="secret-field">
                          <KeyRound size={15} />
                          <input
                            type={visibleKeys[connection.id] ? "text" : "password"}
                            value={connection.apiKey}
                            onChange={(event) => updateConnection(connection.id, { apiKey: event.target.value })}
                            placeholder="Dán API key cá nhân"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <button type="button" onClick={() => setVisibleKeys((current) => ({ ...current, [connection.id]: !current[connection.id] }))} title="Hiện hoặc ẩn khóa">
                            {visibleKeys[connection.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </label>
                      <div className="connection-actions">
                        <button className="test-button" type="button" onClick={() => testConnection(connection)} disabled={connection.status === "testing"}>
                          {connection.status === "testing" ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}
                          Kiểm tra
                        </button>
                        <a href={config.keyUrl} target="_blank" rel="noreferrer">Tạo API key <ArrowUpRight size={13} /></a>
                      </div>
                      <p className={`connection-status status-${connection.status}`}>
                        {connection.status === "ready" && <CheckCircle2 size={14} />}
                        {connection.status === "error" && <AlertCircle size={14} />}
                        {connection.statusMessage}
                      </p>
                    </article>
                  );
                })}
              </div>
              <button className="add-connection" type="button" onClick={addConnection} disabled={connections.length >= 4}>
                <Plus size={16} /> Thêm nền tảng AI
              </button>
            </section>

            <section className="control-card">
              <div className="section-heading">
                <span className="step-number">2</span>
                <div><h2>Cung cấp tài liệu</h2><p>Tệp được đọc ngay trong trình duyệt.</p></div>
              </div>
              <div className="field-grid two-columns">
                <label><span>Tên tài liệu</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Sáng kiến nâng cao..." /></label>
                <label><span>Loại tài liệu</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{DOCUMENT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              <div className="field-grid two-columns">
                <label><span>Mục đích sử dụng</span><input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Trình hội đồng, công bố..." /></label>
                <label><span>Đối tượng đọc</span><input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Giáo viên, sinh viên..." /></label>
              </div>
              <div className="field-grid two-columns">
                <label><span>Lĩnh vực</span><input value={field} onChange={(event) => setField(event.target.value)} placeholder="Giáo dục, quản lý..." /></label>
                <label><span>Phạm vi</span><input value={scope} onChange={(event) => setScope(event.target.value)} /></label>
              </div>

              <button className="upload-zone" type="button" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={28} />
                <strong>Chọn tài liệu hoặc ảnh</strong>
                <span>PDF, DOCX, TXT, MD, PNG, JPG · tối đa 12 MB/tệp</span>
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => handleFiles(event.target.files)}
              />

              {uploadedFiles.length > 0 && (
                <div className="file-chip-list">
                  {uploadedFiles.map((file, index) => (
                    <span className={`file-chip file-${file.status}`} key={`${file.name}-${index}`} title={file.message}>
                      {file.status === "reading" ? <LoaderCircle className="spin" size={14} /> : file.status === "ready" ? <Check size={14} /> : <AlertCircle size={14} />}
                      {file.name}
                      <button type="button" onClick={() => removeUploadedFile(file.name)} aria-label={`Xóa ${file.name}`}><X size={13} /></button>
                    </span>
                  ))}
                </div>
              )}
              {fileMessage && <p className="inline-error"><AlertCircle size={15} /> {fileMessage}</p>}

              <label className="document-textarea-label">
                <span>Dán hoặc chỉnh sửa nội dung</span>
                <textarea
                  value={documentText}
                  onChange={(event) => setDocumentText(event.target.value.slice(0, 180_000))}
                  placeholder="Dán toàn bộ bài viết vào đây hoặc tải tệp ở phía trên…"
                  rows={10}
                />
                <small>{documentText.length.toLocaleString("vi-VN")} / 180.000 ký tự · {images.length} ảnh</small>
              </label>
            </section>
          </aside>

          <section className="main-column">
            <section className="panel-card council-panel">
              <div className="section-heading wide-heading">
                <span className="step-number">3</span>
                <div><h2>Thành lập hội đồng</h2><p>Chọn góc nhìn và phân công mô hình phù hợp.</p></div>
                <span className="selection-count">{selectedDefinitions.length} thành viên</span>
              </div>

              <div className="expert-grid">
                {EXPERTS.map((expert) => {
                  const selected = selectedExperts.includes(expert.id);
                  return (
                    <article className={`expert-card ${selected ? "selected" : ""}`} key={expert.id}>
                      <button className="expert-select" type="button" onClick={() => toggleExpert(expert.id)} aria-pressed={selected}>
                        <span className="expert-check">{selected ? <Check size={15} /> : null}</span>
                        <span><strong>{expert.shortName}</strong><small>{expert.description}</small></span>
                      </button>
                      {selected && depth !== "quick" && (
                        <label className="expert-assignment">
                          <span>Phân công cho</span>
                          <select value={assignments[expert.id] || defaultConnectionId} onChange={(event) => setAssignments((current) => ({ ...current, [expert.id]: event.target.value }))}>
                            {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.label}</option>)}
                          </select>
                        </label>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel-card analysis-panel">
              <div className="section-heading wide-heading">
                <span className="step-number">4</span>
                <div><h2>Thiết lập phản biện</h2><p>Chọn phạm vi kiểm chứng và độ sâu.</p></div>
              </div>

              <div className="analysis-options-grid">
                <fieldset>
                  <legend>Chế độ phản biện</legend>
                  <label className={`choice-card ${reviewMode === "internal" ? "active" : ""}`}>
                    <input type="radio" name="mode" value="internal" checked={reviewMode === "internal"} onChange={() => setReviewMode("internal")} />
                    <span><strong>Nội tại</strong><small>Chỉ dùng nội dung tài liệu.</small></span>
                  </label>
                  <label className={`choice-card ${reviewMode === "verified" ? "active" : ""}`}>
                    <input type="radio" name="mode" value="verified" checked={reviewMode === "verified"} onChange={() => setReviewMode("verified")} />
                    <span><strong>Có kiểm chứng</strong><small>Tìm nguồn khi mô hình hỗ trợ.</small></span>
                  </label>
                </fieldset>
                <fieldset>
                  <legend>Mức độ phân tích</legend>
                  {(["quick", "standard", "deep"] as ReviewDepth[]).map((item) => (
                    <label className={`choice-card compact ${depth === item ? "active" : ""}`} key={item}>
                      <input type="radio" name="depth" value={item} checked={depth === item} onChange={() => setDepth(item)} />
                      <span>
                        <strong>{item === "quick" ? "Nhanh" : item === "standard" ? "Tiêu chuẩn" : "Chuyên sâu"}</strong>
                        <small>{item === "quick" ? "Một lượt tổng hợp" : item === "standard" ? "Từng chuyên gia + tổng hợp" : "Phân tích sâu + đối chiếu"}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="chair-select">
                  <span>Chủ tịch hội đồng</span>
                  <select value={resolvedChairId} onChange={(event) => setChairConnectionId(event.target.value)}>
                    {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.label}</option>)}
                  </select>
                  <small>Chủ tịch đối chiếu và lập báo cáo cuối.</small>
                </label>
              </div>

              <div className="run-row">
                <div className="call-estimate">
                  <span>Dự kiến</span>
                  <strong>{estimatedCalls} lượt gọi AI</strong>
                  <small>Chi phí và hạn mức do tài khoản API của người dùng quyết định.</small>
                </div>
                <button className="primary-run-button" type="button" onClick={runReview} disabled={running}>
                  {running ? <LoaderCircle className="spin" size={20} /> : <Sparkles size={20} />}
                  {running ? "Hội đồng đang làm việc…" : "Bắt đầu phản biện"}
                </button>
              </div>
              {globalError && <div className="global-error"><AlertCircle size={19} /><span>{globalError}</span></div>}
            </section>

            {(running || finalReport || expertReports.length > 0) && (
              <section className="panel-card results-panel" id="ket-qua">
                <div className="results-header">
                  <div>
                    <span className="eyebrow">Kết quả hội đồng</span>
                    <h2>{progressLabel}</h2>
                  </div>
                  {finalReport && (
                    <div className="result-actions">
                      <button type="button" onClick={copyReport}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Đã sao chép" : "Sao chép"}</button>
                      <button type="button" onClick={downloadWord}><Download size={16} /> Word</button>
                      <button type="button" onClick={downloadMarkdown}><Download size={16} /> Markdown</button>
                      <button type="button" onClick={() => window.print()}><Printer size={16} /> PDF/In</button>
                    </div>
                  )}
                </div>

                <div className="progress-track" aria-label={`Tiến độ ${progress}%`}><span style={{ width: `${progress}%` }} /></div>

                {finalReport && (
                  <>
                    <div className="result-tabs" role="tablist">
                      <button className={activeTab === "report" ? "active" : ""} onClick={() => setActiveTab("report")} type="button">Báo cáo tổng hợp</button>
                      <button className={activeTab === "experts" ? "active" : ""} onClick={() => setActiveTab("experts")} type="button">Ý kiến chuyên gia <span>{expertReports.length}</span></button>
                      <button className={activeTab === "sources" ? "active" : ""} onClick={() => setActiveTab("sources")} type="button">Nguồn và giới hạn <span>{allSources.length}</span></button>
                    </div>

                    {activeTab === "report" && (
                      <article className="markdown-report printable-report">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>{finalReport}</ReactMarkdown>
                      </article>
                    )}

                    {activeTab === "experts" && (
                      <div className="expert-report-list">
                        {expertReports.map((report, index) => (
                          <details key={`${report.expertId}-${index}`} open={index === 0}>
                            <summary>
                              <span><strong>{report.expertName}</strong><small>{report.connectionLabel}</small></span>
                              {report.error ? <span className="report-error-badge">Có lỗi</span> : <span className="report-ready-badge">Hoàn thành</span>}
                              <ChevronDown size={18} />
                            </summary>
                            <div className="markdown-report compact-report">
                              {report.error ? <p className="inline-error"><AlertCircle size={16} /> {report.error}</p> : <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>{report.text}</ReactMarkdown>}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}

                    {activeTab === "sources" && (
                      <div className="sources-panel">
                        <div className="source-notice"><ShieldCheck size={19} /><p><strong>Luôn kiểm tra lại nguồn.</strong><span>Việc một liên kết được AI đưa ra không tự động bảo đảm nội dung nguồn chính xác hoặc phù hợp.</span></p></div>
                        {allSources.length ? (
                          <ol className="source-list">
                            {allSources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={14} /></a><small>{source.url}</small></li>)}
                          </ol>
                        ) : <p className="empty-state">Chưa có nguồn bên ngoài được API trả về. Những nhận xét hiện tại cần được hiểu trong phạm vi tài liệu.</p>}
                      </div>
                    )}
                    <div className="results-bottom-row">
                      <p><AlertCircle size={15} /> Kết quả AI chỉ mang tính tham khảo; cần chuyên gia con người xem xét quyết định quan trọng.</p>
                      <button type="button" onClick={resetResults}><RefreshCw size={15} /> Phản biện lại</button>
                    </div>
                  </>
                )}
              </section>
            )}
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div>
          <a href="https://www.hoclieuso.id.vn/" target="_blank" rel="noreferrer">Học liệu số</a>
          <p>Công cụ được xây dựng bởi Học liệu số. Mọi kết quả chỉ mang tính chất tham khảo. Bản quyền công cụ thuộc về Học liệu số.</p>
        </div>
        <span>© {new Date().getFullYear()} Học liệu số</span>
      </footer>
    </div>
  );
}
