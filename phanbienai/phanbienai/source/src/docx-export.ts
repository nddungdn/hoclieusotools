import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

export type ReviewDocxMetadata = {
  mode: "review" | "initiative";
  title: string;
  field?: string;
  authorName?: string;
  unitName?: string;
  judgeName?: string;
  firstAppliedDate?: string;
  applicationDate?: string;
  standardTitle?: string;
  noveltyScope?: string;
};

const FONT = "Times New Roman";
const BODY_SIZE = 26; // 13 pt, docx dùng đơn vị half-point.
const SMALL_SIZE = 24;
const A4_WIDTH = 11_906;
const A4_HEIGHT = 16_838;
const MARGIN_TOP_BOTTOM = 1_134; // 20 mm.
const MARGIN_LEFT = 1_701; // 30 mm.
const MARGIN_RIGHT = 850; // 15 mm.
const FIRST_LINE = 567; // 1 cm.
const AFTER_6_PT = 120;
const LINE_115 = 276;

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "B7BEC9" } as const;
const cellBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

function cleanMarkdown(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function inlineRuns(value: string, options?: { bold?: boolean; italics?: boolean }) {
  const normalized = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  const tokens = normalized.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);

  return tokens.map((token) => {
    const bold = token.startsWith("**") && token.endsWith("**");
    const italic = !bold && token.startsWith("*") && token.endsWith("*");
    const code = token.startsWith("`") && token.endsWith("`");
    const text = bold ? token.slice(2, -2) : (italic || code ? token.slice(1, -1) : token);
    return new TextRun({
      text,
      font: code ? "Courier New" : FONT,
      size: BODY_SIZE,
      color: "000000",
      bold: options?.bold || bold,
      italics: options?.italics || italic,
    });
  });
}

function bodyParagraph(text: string, options?: { bold?: boolean; italics?: boolean; indent?: boolean }) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: options?.indent === false ? undefined : { firstLine: FIRST_LINE },
    spacing: { after: AFTER_6_PT, line: LINE_115 },
    children: inlineRuns(cleanMarkdown(text), options),
  });
}

function headingParagraph(text: string, level: 1 | 2 | 3) {
  const heading = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  return new Paragraph({
    heading,
    alignment: AlignmentType.LEFT,
    spacing: { before: level === 1 ? 240 : 180, after: 120 },
    keepNext: true,
    children: [new TextRun({
      text: cleanMarkdown(text),
      font: FONT,
      size: level === 1 ? 28 : 26,
      bold: true,
      color: "000000",
    })],
  });
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cleanMarkdown(cell));
}

function isTableDivider(cells: string[]) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function markdownTable(lines: string[]) {
  const parsed = lines.map(tableCells);
  const usable = parsed.filter((cells) => !isTableDivider(cells));
  const columnCount = Math.max(1, ...usable.map((row) => row.length));
  const equalColumnWidth = Math.max(1, Math.floor(100 / columnCount));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: cellBorders,
    margins: { top: 80, bottom: 80, left: 90, right: 90 },
    rows: usable.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      children: Array.from({ length: columnCount }, (_, columnIndex) => new TableCell({
        width: { size: equalColumnWidth, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: cellBorders,
        shading: rowIndex === 0 ? { fill: "EDEFF4", type: ShadingType.CLEAR, color: "auto" } : undefined,
        children: [new Paragraph({
          alignment: columnIndex === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          spacing: { after: 0, line: 240 },
          children: inlineRuns(row[columnIndex] || "", { bold: rowIndex === 0 }),
        })],
      })),
    })),
  });
}

function markdownToDocx(markdown: string) {
  const output: Array<Paragraph | Table> = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length;) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|") && lines[index].trim().endsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      output.push(markdownTable(tableLines));
      output.push(new Paragraph({ spacing: { after: AFTER_6_PT } }));
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      output.push(headingParagraph(headingMatch[2], headingMatch[1].length as 1 | 2 | 3));
      index += 1;
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      output.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60, line: LINE_115 },
        children: inlineRuns(bulletMatch[1]),
      }));
      index += 1;
      continue;
    }

    const numberMatch = line.match(/^(\d+[.)])\s+(.+)$/);
    if (numberMatch) {
      output.push(new Paragraph({
        indent: { left: 567, hanging: 283 },
        spacing: { after: 60, line: LINE_115 },
        children: [
          new TextRun({ text: `${numberMatch[1]} `, font: FONT, size: BODY_SIZE, bold: true }),
          ...inlineRuns(numberMatch[2]),
        ],
      }));
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      output.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { left: 567 },
        border: { left: { style: BorderStyle.SINGLE, size: 10, color: "7377B8", space: 8 } },
        spacing: { after: AFTER_6_PT, line: LINE_115 },
        children: inlineRuns(line.replace(/^>\s?/, ""), { italics: true }),
      }));
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^(#{1,3})\s+/.test(next) || /^[-*+]\s+/.test(next) || /^(\d+[.)])\s+/.test(next) || next.startsWith(">") || (next.startsWith("|") && next.endsWith("|"))) break;
      paragraphLines.push(next);
      index += 1;
    }
    output.push(bodyParagraph(paragraphLines.join(" ")));
  }

  return output;
}

function metadataParagraph(label: string, value?: string) {
  if (!value?.trim()) return null;
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 80, line: 240 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, size: BODY_SIZE, bold: true }),
      new TextRun({ text: value.trim(), font: FONT, size: BODY_SIZE }),
    ],
  });
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export async function createReviewDocxBlob(markdown: string, metadata: ReviewDocxMetadata) {
  const initiative = metadata.mode === "initiative";
  const documentTitle = initiative
    ? "PHIẾU HỖ TRỢ GIÁM KHẢO CHẤM SÁNG KIẾN"
    : "BÁO CÁO PHẢN BIỆN AI 360°";
  const metadataRows = initiative
    ? [
      metadataParagraph("Tên sáng kiến/giải pháp", metadata.title),
      metadataParagraph("Lĩnh vực", metadata.field),
      metadataParagraph("Tác giả", metadata.authorName),
      metadataParagraph("Đơn vị", metadata.unitName),
      metadataParagraph("Giám khảo sử dụng phiếu", metadata.judgeName),
      metadataParagraph("Ngày áp dụng lần đầu", formatDate(metadata.firstAppliedDate)),
      metadataParagraph("Ngày nộp hồ sơ", formatDate(metadata.applicationDate)),
      metadataParagraph("Văn bản/tiêu chuẩn chấm", metadata.standardTitle),
      metadataParagraph("Phạm vi đánh giá tính mới", metadata.noveltyScope),
    ].filter((item): item is Paragraph => item !== null)
    : [metadataParagraph("Tài liệu được phản biện", metadata.title)].filter((item): item is Paragraph => item !== null);

  const firstPageHeader = new Header({ children: [new Paragraph({ children: [] })] });
  const pageNumberHeader = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: BODY_SIZE, color: "000000" })],
    })],
  });

  const document = new Document({
    creator: "Học liệu số",
    title: documentTitle,
    subject: initiative ? "Phiếu hỗ trợ một giám khảo chấm sáng kiến" : "Báo cáo phản biện có hỗ trợ bởi AI",
    description: "Tài liệu hỗ trợ tham khảo; không thay thế quyết định chuyên môn của người sử dụng.",
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: AFTER_6_PT, line: LINE_115 } },
        },
        heading1: { run: { font: FONT, size: 28, bold: true, color: "000000" } },
        heading2: { run: { font: FONT, size: BODY_SIZE, bold: true, color: "000000" } },
        heading3: { run: { font: FONT, size: BODY_SIZE, bold: true, italics: true, color: "000000" } },
      },
    },
    sections: [{
      properties: {
        titlePage: true,
        page: {
          size: { width: A4_WIDTH, height: A4_HEIGHT },
          margin: {
            top: MARGIN_TOP_BOTTOM,
            bottom: MARGIN_TOP_BOTTOM,
            left: MARGIN_LEFT,
            right: MARGIN_RIGHT,
            header: 567,
            footer: 567,
          },
        },
      },
      headers: { first: firstPageHeader, default: pageNumberHeader },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120, line: 300 },
          keepNext: true,
          children: [new TextRun({ text: documentTitle, font: FONT, size: 28, bold: true, color: "000000" })],
        }),
        ...(initiative ? [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240, line: 240 },
          children: [new TextRun({
            text: metadata.standardTitle
              ? `Đối chiếu theo ${metadata.standardTitle}`
              : "Đối chiếu theo văn bản và tiêu chí chấm do người sử dụng lựa chọn",
            font: FONT,
            size: SMALL_SIZE,
            italics: true,
          })],
        })] : []),
        ...metadataRows,
        new Paragraph({ spacing: { after: 120 }, border: { bottom: thinBorder } }),
        ...markdownToDocx(markdown),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 240, after: 0, line: 240 },
          children: [new TextRun({
            text: initiative
              ? "Lưu ý: Đây là phiếu hỗ trợ một giám khảo. Phân tích AI chỉ mang tính tham khảo; điểm và nhận xét cuối cùng do giám khảo quyết định và chịu trách nhiệm."
              : "Lưu ý: Kết quả AI chỉ mang tính hỗ trợ tham khảo. Người sử dụng cần kiểm tra lại nguồn, dữ kiện và kết luận trước khi sử dụng.",
            font: FONT,
            size: SMALL_SIZE,
            italics: true,
          })],
        }),
      ],
    }],
  });

  return Packer.toBlob(document);
}
