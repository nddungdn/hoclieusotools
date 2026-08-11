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
  buildInitiativeScoringPrompt,
  buildQuickPrompt,
  buildSynthesisPrompt,
  type DocumentContext,
  type InitiativeScoringContext,
  type ReviewDepth,
  type ReviewMode,
} from "./lib/review-prompts";

type Provider = "gemini" | "openai" | "anthropic" | "openrouter";
type WorkspaceMode = "review" | "initiative";

type JudgeScores = {
  novelty: string;
  applicability: string;
  benefit: string;
};

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

function scoreValue(value: string, maximum: number) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(maximum, Math.max(0, parsed));
}

function classifyJudgeScores(scores: JudgeScores) {
  const novelty = scoreValue(scores.novelty, 40);
  const applicability = scoreValue(scores.applicability, 30);
  const benefit = scoreValue(scores.benefit, 30);
  if (novelty === null || applicability === null || benefit === null) {
    return { complete: false, total: null, label: "Chưa nhập đủ điểm", status: "pending" as const };
  }
  const total = novelty + applicability + benefit;
  if (novelty < 10 || applicability < 10 || benefit < 10 || total < 50) {
    return {
      complete: true,
      total,
      label: "Chưa đủ điều kiện công nhận",
      status: "failed" as const,
    };
  }
  if (total >= 85) {
    return novelty >= 30
      ? { complete: true, total, label: "Đủ điều kiện xếp loại A", status: "passed" as const }
      : { complete: true, total, label: "Chưa đủ điều kiện loại A: tính mới dưới 30", status: "warning" as const };
  }
  if (total >= 70) {
    return novelty >= 20
      ? { complete: true, total, label: "Đủ điều kiện xếp loại B", status: "passed" as const }
      : { complete: true, total, label: "Chưa đủ điều kiện loại B: tính mới dưới 20", status: "warning" as const };
  }
  return novelty >= 10
    ? { complete: true, total, label: "Đủ điều kiện xếp loại C", status: "passed" as const }
    : { complete: true, total, label: "Chưa đủ điều kiện loại C: tính mới dưới 10", status: "warning" as const };
}

function checkOneYearLimit(firstAppliedDate: string, applicationDate: string) {
  if (!firstAppliedDate || !applicationDate) return null;
  const first = new Date(`${firstAppliedDate}T00:00:00`);
  const submitted = new Date(`${applicationDate}T00:00:00`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(submitted.getTime())) return null;
  const deadline = new Date(first);
  deadline.setFullYear(deadline.getFullYear() + 1);
  if (submitted < first) return { valid: false, message: "Ngày nộp đang sớm hơn ngày áp dụng lần đầu. Hãy kiểm tra lại." };
  if (submitted > deadline) return { valid: false, message: "Thời gian từ ngày áp dụng lần đầu đến ngày nộp đã vượt quá 01 năm." };
  return { valid: true, message: "Thời gian nộp nằm trong giới hạn 01 năm kể từ ngày áp dụng lần đầu." };
}

export default function ReviewApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("review");
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
  const [authorName, setAuthorName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [judgeName, setJudgeName] = useState("");
  const [firstAppliedDate, setFirstAppliedDate] = useState("");
  const [applicationDate, setApplicationDate] = useState("");
  const [scoringConnectionId, setScoringConnectionId] = useState("");
  const [judgeScores, setJudgeScores] = useState<JudgeScores>({ novelty: "", applicability: "", benefit: "" });
  const [judgeNotes, setJudgeNotes] = useState("");

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
  const resolvedScoringId = scoringConnectionId || defaultConnectionId;
  const selectedDefinitions = EXPERTS.filter((expert) => selectedExperts.includes(expert.id));
  const estimatedCalls = workspaceMode === "initiative" ? 1 : depth === "quick" ? 1 : selectedDefinitions.length + 1;
  const judgeClassification = useMemo(() => classifyJudgeScores(judgeScores), [judgeScores]);
  const oneYearCheck = useMemo(
    () => checkOneYearLimit(firstAppliedDate, applicationDate),
    [firstAppliedDate, applicationDate],
  );
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

  function buildInitiativeContext(): InitiativeScoringContext {
    return {
      ...buildContext(),
      documentType: "Sáng kiến",
      purpose: "Hỗ trợ một giám khảo chấm theo Quyết định 465/QĐ-SGDĐT ngày 06/03/2026",
      audience: "Giám khảo chấm sáng kiến",
      scope: "Toàn bộ hồ sơ sáng kiến",
      authorName,
      unitName,
      judgeName,
      firstAppliedDate,
      applicationDate,
    };
  }

  function switchWorkspaceMode(mode: WorkspaceMode) {
    setWorkspaceMode(mode);
    setFinalReport("");
    setExpertReports([]);
    setGlobalError("");
    setProgress(0);
    setProgressLabel(mode === "initiative" ? "Sẵn sàng hỗ trợ chấm" : "Sẵn sàng phân tích");
    setActiveTab("report");
  }

  function updateJudgeScore(key: keyof JudgeScores, value: string, maximum: number) {
    if (value === "") {
      setJudgeScores((current) => ({ ...current, [key]: "" }));
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) return;
    setJudgeScores((current) => ({ ...current, [key]: value }));
  }

  function validateReview() {
    if (!documentText.trim() && !images.length) {
      return workspaceMode === "initiative"
        ? "Hãy tải hồ sơ sáng kiến, ảnh hoặc dán nội dung cần chấm."
        : "Hãy tải tài liệu, ảnh hoặc dán nội dung cần phản biện.";
    }
    if (workspaceMode === "initiative") {
      const connection = getConnection(resolvedScoringId);
      if (!connection?.apiKey.trim()) return `Hãy nhập API key cho kết nối “${connection?.label || "AI"}”.`;
      if (!connection.model.trim()) return `Hãy nhập mã mô hình cho kết nối “${connection.label}”.`;
      return "";
    }
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
    if (workspaceMode === "initiative") {
      const connection = getConnection(resolvedScoringId);
      try {
        setProgressLabel("AI đang đối chiếu hồ sơ với Quyết định 465…");
        setProgress(32);
        const result = await callApi(
          connection,
          buildInitiativeScoringPrompt(buildInitiativeContext(), reviewMode),
          images,
          reviewMode === "verified",
        );
        const reportText = appendSources(result.text, result.sources);
        setExpertReports([
          {
            expertId: "initiative-assistant",
            expertName: "Trợ lý hỗ trợ giám khảo",
            connectionLabel: connection.label,
            text: reportText,
            sources: result.sources || [],
          },
        ]);
        setFinalReport(reportText);
        setProgress(100);
        setProgressLabel("Đã hoàn thành phiếu hỗ trợ chấm");
      } catch (error) {
        setGlobalError(error instanceof Error ? error.message : "Chưa thể hoàn thành phân tích hồ sơ sáng kiến.");
        setProgressLabel("Chưa thể hoàn thành phiếu hỗ trợ");
      } finally {
        setRunning(false);
      }
      return;
    }
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

  function reportForExport() {
    if (workspaceMode !== "initiative") return finalReport;
    const novelty = scoreValue(judgeScores.novelty, 40);
    const applicability = scoreValue(judgeScores.applicability, 30);
    const benefit = scoreValue(judgeScores.benefit, 30);
    const manualSection = `

# PHẦN ĐIỂM DO GIÁM KHẢO NHẬP

| Tiêu chí | Điểm giám khảo | Điểm tối đa |
|---|---:|---:|
| Tính mới | ${novelty ?? "Chưa nhập"} | 40 |
| Khả năng áp dụng | ${applicability ?? "Chưa nhập"} | 30 |
| Lợi ích thiết thực | ${benefit ?? "Chưa nhập"} | 30 |
| **Tổng** | **${judgeClassification.total ?? "Chưa đủ điểm"}** | **100** |

**Kết quả đối chiếu tự động:** ${judgeClassification.label}

**Ghi chú của giám khảo:** ${judgeNotes.trim() || "Chưa ghi"}

> Điểm và nhận xét cuối cùng do giám khảo quyết định. Phần phân tích AI chỉ mang tính hỗ trợ tham khảo.
`;
    return `${finalReport}${manualSection}`;
  }

  async function copyReport() {
    if (!finalReport) return;
    await navigator.clipboard.writeText(reportForExport());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadWord() {
    if (!finalReport) return;
    const heading = workspaceMode === "initiative" ? "Phiếu hỗ trợ giám khảo chấm sáng kiến" : "Báo cáo Hội đồng phản biện AI 360°";
    const suffix = workspaceMode === "initiative" ? "phieu-ho-tro-cham" : "phan-bien";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${heading}</title><style>body{font-family:Arial,sans-serif;line-height:1.65;margin:42px;color:#172033}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${heading}</h1><pre>${escapeHtml(reportForExport())}</pre><p><em>Kết quả AI chỉ mang tính hỗ trợ tham khảo; điểm cuối cùng do giám khảo quyết định.</em></p></body></html>`;
    downloadBlob(new Blob([html], { type: "application/msword;charset=utf-8" }), `${slugFilename(title)}-${suffix}.doc`);
  }

  function downloadMarkdown() {
    if (!finalReport) return;
    const suffix = workspaceMode === "initiative" ? "phieu-ho-tro-cham" : "phan-bien";
    downloadBlob(new Blob([reportForExport()], { type: "text/markdown;charset=utf-8" }), `${slugFilename(title)}-${suffix}.md`);
  }

  function resetResults() {
    setFinalReport("");
    setExpertReports([]);
    setProgress(0);
    setProgressLabel(workspaceMode === "initiative" ? "Sẵn sàng hỗ trợ chấm" : "Sẵn sàng phân tích");
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
          <div className="hero-kicker"><Scale size={16} /> {workspaceMode === "initiative" ? "Hỗ trợ một giám khảo chấm sáng kiến" : "Phản biện đa góc nhìn bằng AI"}</div>
          <h1>HỘI ĐỒNG PHẢN BIỆN AI 360°</h1>
          <p>
            {workspaceMode === "initiative"
              ? "Đối chiếu hồ sơ và hỗ trợ giám khảo chấm theo Quyết định 465/QĐ-SGDĐT của Sở GDĐT Đà Nẵng năm 2026."
              : "Phân tích sáng kiến, giải pháp, bài luận và báo cáo từ nhiều góc nhìn; chỉ rõ căn cứ, mức độ tin cậy và hướng cải thiện."}
          </p>
          <div className="hero-trust-row">
            <span><ShieldCheck size={16} /> API cá nhân</span>
            <span><Users size={16} /> {workspaceMode === "initiative" ? "Một giám khảo sử dụng" : "Hội đồng đa mô hình"}</span>
            <span><FileText size={16} /> {workspaceMode === "initiative" ? "Thang điểm 40–30–30" : "Báo cáo có căn cứ"}</span>
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
                <h2 id="guide-title">{workspaceMode === "initiative" ? "Hỗ trợ một giám khảo chấm sáng kiến" : "Sử dụng Hội đồng phản biện AI 360°"}</h2>
                <p>{workspaceMode === "initiative" ? "AI đối chiếu hồ sơ; giám khảo tự quyết định điểm và nhận xét cuối cùng." : "Hoàn thành sáu bước dưới đây để nhận báo cáo phản biện đa góc nhìn."}</p>
              </div>
              <button className="guide-close" type="button" onClick={() => setGuideOpen(false)} aria-label="Đóng hướng dẫn">
                <X size={20} />
              </button>
            </header>

            <div className="guide-body">
              {workspaceMode === "initiative" ? (
              <ol className="guide-steps">
                <li>
                  <span className="guide-step-number">1</span>
                  <div><h3>Kết nối một nền tảng AI</h3><p>Nhập API key cá nhân, kiểm tra kết nối và chọn mô hình sẽ hỗ trợ đọc hồ sơ.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">2</span>
                  <div><h3>Cung cấp hồ sơ sáng kiến</h3><p>Nhập thông tin cơ bản, ngày áp dụng lần đầu, ngày nộp; tải PDF, DOCX, TXT, Markdown hoặc ảnh. PDF scan nên được OCR trước.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">3</span>
                  <div><h3>Đọc thang điểm áp dụng</h3><p>Tiện ích dùng Quyết định 465/QĐ-SGDĐT ngày 06/03/2026: tính mới 40 điểm, khả năng áp dụng 30 điểm và lợi ích thiết thực 30 điểm.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">4</span>
                  <div><h3>Nhận phân tích hỗ trợ</h3><p>AI kiểm tra bố cục, điều kiện, trích dẫn minh chứng và đề xuất điểm. Kết quả này không phải điểm chính thức.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">5</span>
                  <div><h3>Giám khảo tự nhập điểm</h3><p>Đọc lại hồ sơ, tự nhập ba điểm thành phần và ghi nhận xét. Tiện ích chỉ cộng điểm, kiểm tra điều kiện và gợi ý xếp loại.</p></div>
                </li>
                <li>
                  <span className="guide-step-number">6</span>
                  <div><h3>Lưu phiếu hỗ trợ</h3><p>Tải Word/Markdown hoặc in PDF. Kiểm tra lại mọi trích dẫn và không dùng kết quả AI thay cho quyết định chuyên môn.</p></div>
                </li>
              </ol>
              ) : (
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
              )}

              <div className="guide-notes">
                <article>
                  <ShieldCheck size={20} />
                  <div><h3>Bảo mật khóa API</h3><p>Không gửi khóa cho người khác và không dán khóa vào tài liệu. Khóa chỉ giữ trong bộ nhớ tab, không ghi vào cơ sở dữ liệu; đóng hoặc tải lại tab sẽ xóa khóa đã nhập.</p></div>
                </article>
                <article>
                  <AlertCircle size={20} />
                  <div><h3>Chi phí và giới hạn</h3><p>{workspaceMode === "initiative" ? "Mỗi lần hỗ trợ chấm tạo một lượt gọi AI. Phí, hạn mức và khả năng tìm kiếm phụ thuộc tài khoản cùng mô hình bạn chọn." : "Mỗi chuyên gia và Chủ tịch hội đồng tạo một lượt gọi AI. Phí, hạn mức và khả năng tìm kiếm phụ thuộc tài khoản cùng mô hình bạn chọn."}</p></div>
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

        <section className="workspace-mode-card" aria-label="Chọn chức năng">
          <div className="mode-card-copy">
            <span className="eyebrow">Chọn chức năng</span>
            <strong>{workspaceMode === "initiative" ? "Hỗ trợ giám khảo chấm sáng kiến" : "Phản biện tài liệu đa góc nhìn"}</strong>
            <small>{workspaceMode === "initiative" ? "Theo Quyết định 465/QĐ-SGDĐT ngày 06/03/2026 của Sở GDĐT Đà Nẵng." : "Phù hợp với sáng kiến, giải pháp, bài luận, nghiên cứu, báo cáo và đề án."}</small>
          </div>
          <div className="mode-switch" role="tablist" aria-label="Chế độ làm việc">
            <button type="button" role="tab" aria-selected={workspaceMode === "review"} className={workspaceMode === "review" ? "active" : ""} onClick={() => switchWorkspaceMode("review")}>
              Phản biện AI 360°
            </button>
            <button type="button" role="tab" aria-selected={workspaceMode === "initiative"} className={workspaceMode === "initiative" ? "active" : ""} onClick={() => switchWorkspaceMode("initiative")}>
              Chấm sáng kiến Đà Nẵng 2026
            </button>
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
                <div><h2>{workspaceMode === "initiative" ? "Cung cấp hồ sơ sáng kiến" : "Cung cấp tài liệu"}</h2><p>Tệp được đọc ngay trong trình duyệt.</p></div>
              </div>
              {workspaceMode === "initiative" ? (
                <>
                  <div className="field-grid two-columns">
                    <label><span>Tên sáng kiến</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tên sáng kiến…" /></label>
                    <label><span>Lĩnh vực áp dụng</span><input value={field} onChange={(event) => setField(event.target.value)} placeholder="Dạy học, quản lí giáo dục…" /></label>
                  </div>
                  <div className="field-grid two-columns">
                    <label><span>Tác giả/nhóm tác giả</span><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="Có thể để trống để AI đọc từ hồ sơ" /></label>
                    <label><span>Đơn vị</span><input value={unitName} onChange={(event) => setUnitName(event.target.value)} placeholder="Trường hoặc đơn vị công tác" /></label>
                  </div>
                  <div className="field-grid two-columns">
                    <label><span>Ngày áp dụng lần đầu</span><input type="date" value={firstAppliedDate} onChange={(event) => setFirstAppliedDate(event.target.value)} /></label>
                    <label><span>Ngày nộp hồ sơ</span><input type="date" value={applicationDate} onChange={(event) => setApplicationDate(event.target.value)} /></label>
                  </div>
                  <label className="full-width-field"><span>Tên giám khảo <small>(không bắt buộc)</small></span><input value={judgeName} onChange={(event) => setJudgeName(event.target.value)} placeholder="Chỉ dùng để điền vào phiếu hỗ trợ xuất ra" /></label>
                  {oneYearCheck && (
                    <p className={`date-check ${oneYearCheck.valid ? "valid" : "invalid"}`}>
                      {oneYearCheck.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                      {oneYearCheck.message}
                    </p>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}

              <button className="upload-zone" type="button" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={28} />
                <strong>{workspaceMode === "initiative" ? "Chọn hồ sơ sáng kiến hoặc ảnh minh chứng" : "Chọn tài liệu hoặc ảnh"}</strong>
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
                  placeholder={workspaceMode === "initiative" ? "Dán nội dung hồ sơ sáng kiến hoặc tải tệp ở phía trên…" : "Dán toàn bộ bài viết vào đây hoặc tải tệp ở phía trên…"}
                  rows={10}
                />
                <small>{documentText.length.toLocaleString("vi-VN")} / 180.000 ký tự · {images.length} ảnh</small>
              </label>
            </section>
          </aside>

          <section className="main-column">
            {workspaceMode === "review" ? (
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
            ) : (
            <section className="panel-card initiative-standard-panel">
              <div className="section-heading wide-heading">
                <span className="step-number">3</span>
                <div><h2>Tiêu chuẩn chấm áp dụng</h2><p>Quyết định 465/QĐ-SGDĐT ngày 06/03/2026.</p></div>
                <span className="standard-badge">Đà Nẵng · 2026</span>
              </div>
              <div className="single-judge-notice">
                <Scale size={21} />
                <div><strong>Dành cho một giám khảo sử dụng</strong><span>AI hỗ trợ đọc, tìm căn cứ và đề xuất điểm. Tiện ích không phải Hội đồng sáng kiến và không quyết định điểm thay giám khảo.</span></div>
              </div>
              <div className="initiative-privacy-notice">
                <AlertCircle size={18} />
                <span>Hồ sơ được gửi đến nhà cung cấp AI mà giám khảo chọn. Nên ẩn ngày sinh, địa chỉ, số điện thoại, chữ ký và thông tin mật trước khi phân tích.</span>
              </div>
              <div className="rubric-table-wrap">
                <table className="rubric-table">
                  <thead><tr><th>Tiêu chí</th><th>Điểm tối đa</th><th>Các mức điểm</th></tr></thead>
                  <tbody>
                    <tr><td><strong>1. Tính mới</strong></td><td>40</td><td>31–40 · 21–30 · 0–20</td></tr>
                    <tr><td><strong>2. Khả năng áp dụng</strong></td><td>30</td><td>16–30 · 0–15</td></tr>
                    <tr><td><strong>3. Lợi ích thiết thực</strong></td><td>30</td><td>21–30 · 0–20</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="classification-grid">
                <span><strong>Loại A</strong><small>≥85 điểm; tính mới ≥30</small></span>
                <span><strong>Loại B</strong><small>70–&lt;85; tính mới ≥20</small></span>
                <span><strong>Loại C</strong><small>50–&lt;70; tính mới ≥10</small></span>
                <span><strong>Điều kiện chung</strong><small>Mỗi tiêu chí phải ≥10</small></span>
              </div>
            </section>
            )}

            <section className="panel-card analysis-panel">
              <div className="section-heading wide-heading">
                <span className="step-number">4</span>
                <div><h2>{workspaceMode === "initiative" ? "Thiết lập hỗ trợ chấm" : "Thiết lập phản biện"}</h2><p>{workspaceMode === "initiative" ? "Chọn mô hình và phạm vi kiểm chứng." : "Chọn phạm vi kiểm chứng và độ sâu."}</p></div>
              </div>

              <div className="analysis-options-grid">
                <fieldset>
                  <legend>{workspaceMode === "initiative" ? "Phạm vi đối chiếu" : "Chế độ phản biện"}</legend>
                  <label className={`choice-card ${reviewMode === "internal" ? "active" : ""}`}>
                    <input type="radio" name="mode" value="internal" checked={reviewMode === "internal"} onChange={() => setReviewMode("internal")} />
                    <span><strong>Nội tại</strong><small>{workspaceMode === "initiative" ? "Chỉ dùng hồ sơ đã tải." : "Chỉ dùng nội dung tài liệu."}</small></span>
                  </label>
                  <label className={`choice-card ${reviewMode === "verified" ? "active" : ""}`}>
                    <input type="radio" name="mode" value="verified" checked={reviewMode === "verified"} onChange={() => setReviewMode("verified")} />
                    <span><strong>Có kiểm chứng</strong><small>Tìm nguồn khi mô hình hỗ trợ.</small></span>
                  </label>
                </fieldset>
                {workspaceMode === "review" ? (
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
                ) : (
                <div className="initiative-check-list">
                  <strong>AI sẽ hỗ trợ kiểm tra</strong>
                  <span><Check size={14} /> Bố cục 11 phần của Bản mô tả</span>
                  <span><Check size={14} /> Điều kiện, thời hạn và minh chứng</span>
                  <span><Check size={14} /> Ba tiêu chí theo thang 40–30–30</span>
                  <span><Check size={14} /> Trích dẫn và nội dung cần xác minh</span>
                </div>
                )}
                <label className="chair-select">
                  <span>{workspaceMode === "initiative" ? "Mô hình hỗ trợ giám khảo" : "Chủ tịch hội đồng"}</span>
                  <select value={workspaceMode === "initiative" ? resolvedScoringId : resolvedChairId} onChange={(event) => workspaceMode === "initiative" ? setScoringConnectionId(event.target.value) : setChairConnectionId(event.target.value)}>
                    {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.label}</option>)}
                  </select>
                  <small>{workspaceMode === "initiative" ? "Chỉ một kết nối AI được dùng cho mỗi lần hỗ trợ chấm." : "Chủ tịch đối chiếu và lập báo cáo cuối."}</small>
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
                  {running ? (workspaceMode === "initiative" ? "AI đang đọc hồ sơ…" : "Hội đồng đang làm việc…") : (workspaceMode === "initiative" ? "Phân tích hỗ trợ chấm" : "Bắt đầu phản biện")}
                </button>
              </div>
              {globalError && <div className="global-error"><AlertCircle size={19} /><span>{globalError}</span></div>}
            </section>

            {(running || finalReport || expertReports.length > 0) && (
              <section className="panel-card results-panel" id="ket-qua">
                <div className="results-header">
                  <div>
                    <span className="eyebrow">{workspaceMode === "initiative" ? "Phiếu hỗ trợ một giám khảo" : "Kết quả hội đồng"}</span>
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
                      <button className={activeTab === "report" ? "active" : ""} onClick={() => setActiveTab("report")} type="button">{workspaceMode === "initiative" ? "Phân tích hỗ trợ" : "Báo cáo tổng hợp"}</button>
                      {workspaceMode === "review" && <button className={activeTab === "experts" ? "active" : ""} onClick={() => setActiveTab("experts")} type="button">Ý kiến chuyên gia <span>{expertReports.length}</span></button>}
                      <button className={activeTab === "sources" ? "active" : ""} onClick={() => setActiveTab("sources")} type="button">Nguồn và giới hạn <span>{allSources.length}</span></button>
                    </div>

                    {activeTab === "report" && (
                      <>
                      <article className="markdown-report printable-report">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>{finalReport}</ReactMarkdown>
                      </article>
                      {workspaceMode === "initiative" && (
                        <section className="judge-scorecard printable-report" aria-labelledby="judge-score-title">
                          <div className="judge-score-heading">
                            <div><span className="eyebrow">Giám khảo quyết định</span><h3 id="judge-score-title">Nhập điểm chính thức của bạn</h3><p>Đọc lại hồ sơ và phân tích AI trước khi nhập điểm. Tiện ích chỉ cộng và đối chiếu điều kiện.</p></div>
                            <span className={`classification-result result-${judgeClassification.status}`}>
                              <strong>{judgeClassification.total === null ? "—" : judgeClassification.total}</strong>
                              <small>{judgeClassification.label}</small>
                            </span>
                          </div>
                          <div className="judge-score-grid">
                            <label><span>Tính mới <small>0–40 điểm</small></span><input type="number" min="0" max="40" step="0.5" value={judgeScores.novelty} onChange={(event) => updateJudgeScore("novelty", event.target.value, 40)} placeholder="/40" /></label>
                            <label><span>Khả năng áp dụng <small>0–30 điểm</small></span><input type="number" min="0" max="30" step="0.5" value={judgeScores.applicability} onChange={(event) => updateJudgeScore("applicability", event.target.value, 30)} placeholder="/30" /></label>
                            <label><span>Lợi ích thiết thực <small>0–30 điểm</small></span><input type="number" min="0" max="30" step="0.5" value={judgeScores.benefit} onChange={(event) => updateJudgeScore("benefit", event.target.value, 30)} placeholder="/30" /></label>
                          </div>
                          <label className="judge-notes"><span>Ghi chú/nhận xét của giám khảo</span><textarea rows={4} value={judgeNotes} onChange={(event) => setJudgeNotes(event.target.value)} placeholder="Ghi nhận xét hoặc nội dung cần tiếp tục xác minh…" /></label>
                          <div className="scorecard-warning"><AlertCircle size={17} /><span>AI không phải giám khảo và không có quyền quyết định công nhận sáng kiến. Điểm cuối cùng do người sử dụng tự chịu trách nhiệm.</span></div>
                        </section>
                      )}
                      </>
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
                      <p><AlertCircle size={15} /> {workspaceMode === "initiative" ? "Phân tích AI chỉ hỗ trợ giám khảo; không phải kết luận hoặc điểm của Hội đồng sáng kiến." : "Kết quả AI chỉ mang tính tham khảo; cần chuyên gia con người xem xét quyết định quan trọng."}</p>
                      <button type="button" onClick={resetResults}><RefreshCw size={15} /> {workspaceMode === "initiative" ? "Phân tích lại" : "Phản biện lại"}</button>
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
