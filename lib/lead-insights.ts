// Lead Insights — NOT an agent, a deterministic data tool. You upload a
// real lead export (any columns — built against a real 600+ column
// LeadSquared export for an admissions business) and it tells you which
// NOT-YET-CONVERTED leads look like real conversion candidates, and what
// data is missing that your actually-converted leads tend to have.
//
// The ground truth for "did this lead convert" lives INSIDE the uploaded
// file itself (columns like "Application Status", "MUJ Application Fee
// Paid", "Admission Status", "Lead Stage") — not in this app's separate,
// generic CRM table, which for a real admissions export is a different,
// much smaller dataset. So the primary analysis is entirely file-native:
// split the uploaded rows into converted/not-converted using a real
// column from the file, then measure which real fields/sources correlate
// with conversion WITHIN that same file. Cross-referencing against this
// workspace's own CRM (lib/lead-quality.ts's win-rate data) is kept as a
// secondary, non-gating enrichment for workspaces that actually use the
// CRM as their system of record. No LLM call anywhere — every number is
// a real aggregate over the real uploaded rows.

import * as XLSX from "xlsx";
import { prisma } from "./prisma";

const MAX_UPLOAD_ROWS = 20000; // real exports like this run into the thousands
const MAX_UPLOAD_COLS = 400; // this real schema has 600+ columns; cap generously, not tightly
const MIN_SOURCE_SAMPLE = 5; // don't trust a conversion rate computed from fewer rows than this
const MIN_TOTAL_FOR_BASELINE = 10;
const TOP_N = 200;

export interface ParsedLeadSheet {
  headers: string[];
  rows: Record<string, string>[];
  truncated: boolean;
}

export function parseLeadSheet(buffer: Buffer): ParsedLeadSheet {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (raw.length === 0) return { headers: [], rows: [], truncated: false };

  const fullHeaderRow = raw[0].map((h) => String(h ?? "").trim());
  const truncated = raw.length - 1 > MAX_UPLOAD_ROWS || fullHeaderRow.length > MAX_UPLOAD_COLS;
  const headerRow = fullHeaderRow.slice(0, MAX_UPLOAD_COLS);
  const bodyRows = raw.slice(1, 1 + MAX_UPLOAD_ROWS);

  const rows = bodyRows.map((r) => {
    const obj: Record<string, string> = {};
    headerRow.forEach((h, i) => {
      if (h) obj[h] = String(r[i] ?? "").trim();
    });
    return obj;
  });

  return { headers: headerRow.filter(Boolean), rows, truncated };
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// --- Outcome column detection ---------------------------------------
// Priority-ordered real column names that represent a genuine "did this
// lead convert to an application" signal, most specific/reliable first.
// A fee-paid column is the strongest signal (it's a real payment event,
// not a free-text status someone may forget to update); "Lead Stage" is
// the weakest (free text, values vary per team) so it's last-resort.
const OUTCOME_COLUMN_CANDIDATES = [
  "application status",
  "muj application fee paid",
  "smu application fee paid",
  "mahe application fee paid",
  "admission status",
  "muj admission fee paid",
  "smu admission fee paid",
  "mahe admission fee paid",
  "latest portal status",
  "form status",
  "lead stage",
];

export function detectOutcomeColumn(headers: string[]): string | null {
  const normalizedMap = new Map(headers.map((h) => [normalizeHeader(h), h]));
  for (const candidate of OUTCOME_COLUMN_CANDIDATES) {
    const found = normalizedMap.get(normalizeHeader(candidate));
    if (found) return found;
  }
  return null;
}

const CONVERTED_KEYWORDS = /paid|submit|approv|admit|enroll|success|complet|\byes\b|won|join/i;
const NOT_CONVERTED_KEYWORDS = /\bno\b|not\s|pending|reject|junk|lost|invalid|fail|dnp|rnr/i;

// Classifies the DISTINCT values actually found in the outcome column —
// never assumes a fixed vocabulary, since "Lead Stage" values are whatever
// this specific team typed. A value matching neither keyword set is
// treated as "not converted" (conservative: the whole point of this tool
// is surfacing who ISN'T converted yet, so an ambiguous status belongs
// there, not silently dropped).
export function classifyOutcomeValues(values: string[]): Set<string> {
  const converted = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    if (CONVERTED_KEYWORDS.test(v) && !NOT_CONVERTED_KEYWORDS.test(v)) converted.add(v);
  }
  return converted;
}

// --- Field matching (best-effort, for display + correlation) --------
const COLUMN_ALIASES = {
  email: ["email", "emailid", "emailaddress", "mailid", "mail"],
  phone: ["phone", "mobile", "contact", "contactnumber", "phonenumber", "mobilenumber", "cell", "whatsapp"],
  name: ["firstname", "name", "fullname", "leadname", "studentname", "candidatename", "applicantname"],
  source: ["source", "leadsource", "channel", "utmsource", "campaign", "primarysource"],
  company: ["company", "organisation", "organization", "employer"],
  city: ["city"],
} as const;
export type MatchableField = keyof typeof COLUMN_ALIASES;

export function matchColumn(headers: string[], field: MatchableField): string | null {
  const aliases = COLUMN_ALIASES[field] as readonly string[];
  for (const h of headers) {
    if (aliases.includes(normalizeHeader(h))) return h;
  }
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (aliases.some((a) => norm.includes(a))) return h;
  }
  return null;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "").slice(-10);
}

// --- File-native conversion profile -----------------------------------
export interface SourceConversionStat {
  source: string;
  total: number;
  convertedCount: number;
  conversionRatePct: number;
}

export interface FieldCompletenessStat {
  field: MatchableField;
  overallFillRatePct: number;
  convertedFillRatePct: number | null;
}

export interface FileConversionProfile {
  totalRows: number;
  convertedCount: number;
  hasEnoughData: boolean;
  baselineConversionRatePct: number | null;
  bySource: SourceConversionStat[];
  fieldCompleteness: FieldCompletenessStat[];
}

export function computeFileConversionProfile(
  sheet: ParsedLeadSheet,
  outcomeColumn: string,
  convertedValues: Set<string>,
  cols: Record<MatchableField, string | null>,
): FileConversionProfile {
  const isConverted = (row: Record<string, string>) => convertedValues.has(row[outcomeColumn]?.trim() ?? "");

  let convertedCount = 0;
  const bySourceMap = new Map<string, { total: number; converted: number }>();
  const fieldFilled: Record<MatchableField, { all: number; converted: number }> = {
    email: { all: 0, converted: 0 },
    phone: { all: 0, converted: 0 },
    name: { all: 0, converted: 0 },
    source: { all: 0, converted: 0 },
    company: { all: 0, converted: 0 },
    city: { all: 0, converted: 0 },
  };

  for (const row of sheet.rows) {
    const converted = isConverted(row);
    if (converted) convertedCount++;

    (Object.keys(COLUMN_ALIASES) as MatchableField[]).forEach((f) => {
      const header = cols[f];
      if (header && row[header]?.trim()) {
        fieldFilled[f].all++;
        if (converted) fieldFilled[f].converted++;
      }
    });

    const sourceHeader = cols.source;
    const sourceVal = sourceHeader ? row[sourceHeader]?.trim() : "";
    if (sourceVal) {
      const entry = bySourceMap.get(sourceVal) ?? { total: 0, converted: 0 };
      entry.total++;
      if (converted) entry.converted++;
      bySourceMap.set(sourceVal, entry);
    }
  }

  const bySource: SourceConversionStat[] = [...bySourceMap.entries()]
    .filter(([, s]) => s.total >= MIN_SOURCE_SAMPLE)
    .map(([source, s]) => ({ source, total: s.total, convertedCount: s.converted, conversionRatePct: Math.round((s.converted / s.total) * 100) }))
    .sort((a, b) => b.conversionRatePct - a.conversionRatePct);

  const fieldCompleteness: FieldCompletenessStat[] = (Object.keys(COLUMN_ALIASES) as MatchableField[])
    .filter((f) => cols[f] !== null)
    .map((f) => ({
      field: f,
      overallFillRatePct: sheet.rows.length > 0 ? Math.round((fieldFilled[f].all / sheet.rows.length) * 100) : 0,
      convertedFillRatePct: convertedCount > 0 ? Math.round((fieldFilled[f].converted / convertedCount) * 100) : null,
    }));

  return {
    totalRows: sheet.rows.length,
    convertedCount,
    hasEnoughData: sheet.rows.length >= MIN_TOTAL_FOR_BASELINE,
    baselineConversionRatePct: sheet.rows.length > 0 ? Math.round((convertedCount / sheet.rows.length) * 100) : null,
    bySource,
    fieldCompleteness,
  };
}

// --- Optional secondary enrichment: this workspace's own CRM ----------
export interface CrmMatch {
  stageName: string | null;
  isWon: boolean;
  isLost: boolean;
}

export async function buildCrmLookup(workspaceId: string): Promise<{ byEmail: Map<string, CrmMatch>; byPhone: Map<string, CrmMatch> }> {
  const [leads, stages] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId }, select: { email: true, phone: true, stageId: true } }),
    prisma.pipelineStage.findMany({ where: { workspaceId } }),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const byEmail = new Map<string, CrmMatch>();
  const byPhone = new Map<string, CrmMatch>();
  for (const l of leads) {
    const stage = l.stageId ? stageById.get(l.stageId) : null;
    const match: CrmMatch = { stageName: stage?.name ?? null, isWon: !!stage?.isWon, isLost: !!stage?.isLost };
    if (l.email?.trim()) byEmail.set(l.email.trim().toLowerCase(), match);
    if (l.phone?.trim()) byPhone.set(normalizePhone(l.phone), match);
  }
  return { byEmail, byPhone };
}

// --- Scoring ------------------------------------------------------------
export type LeadFlag = "already-converted" | "high-potential" | "needs-more-data" | "unscored";

export interface ScoredLead {
  rowIndex: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  outcomeValue: string | null;
  crmNote: string | null; // secondary, non-gating info from this workspace's own CRM, if matched
  flag: LeadFlag;
  reasons: string[];
  completenessPct: number;
}

export interface DataGap {
  field: MatchableField;
  uploadedFillRatePct: number;
  convertedFillRatePct: number | null;
  gapPct: number | null;
}

export interface LeadInsightsResult {
  totalRows: number;
  outcomeColumn: string | null;
  convertedValues: string[];
  columnsMatched: { field: MatchableField; header: string | null }[];
  hasEnoughData: boolean;
  baselineConversionRatePct: number | null;
  alreadyConvertedCount: number;
  highPotentialCount: number;
  needsMoreDataCount: number;
  unscoredCount: number;
  dataGaps: DataGap[];
  topHighPotential: ScoredLead[];
}

function scoreRow(
  rowIndex: number,
  row: Record<string, string>,
  cols: Record<MatchableField, string | null>,
  outcomeColumn: string,
  convertedValues: Set<string>,
  profile: FileConversionProfile,
  crmLookup: { byEmail: Map<string, CrmMatch>; byPhone: Map<string, CrmMatch> } | null,
): ScoredLead {
  const get = (f: MatchableField) => (cols[f] ? row[cols[f]!]?.trim() || "" : "");
  const email = get("email");
  const phone = get("phone");
  const source = get("source");
  const name = get("name");
  const outcomeValue = row[outcomeColumn]?.trim() || "";

  const checkableFields = (Object.keys(COLUMN_ALIASES) as MatchableField[]).filter((f) => cols[f] !== null);
  const filledCount = checkableFields.filter((f) => get(f)).length;
  const completenessPct = checkableFields.length > 0 ? Math.round((filledCount / checkableFields.length) * 100) : 0;

  const crmMatch = (email && crmLookup?.byEmail.get(email.toLowerCase())) || (phone && crmLookup?.byPhone.get(normalizePhone(phone))) || null;
  const crmNote = crmMatch ? `Also in this workspace's CRM, stage "${crmMatch.stageName ?? "—"}"${crmMatch.isWon ? " (won)" : crmMatch.isLost ? " (lost)" : ""}` : null;

  const base = { rowIndex, name: name || null, email: email || null, phone: phone || null, source: source || null, outcomeValue: outcomeValue || null, crmNote, completenessPct };

  if (convertedValues.has(outcomeValue)) {
    return { ...base, flag: "already-converted", reasons: [`Outcome "${outcomeValue}" already counts as converted`] };
  }

  if (!profile.hasEnoughData) {
    return { ...base, flag: "unscored", reasons: ["Not enough rows in this upload yet to compute a real conversion pattern"] };
  }

  const stat = source ? profile.bySource.find((s) => s.source.toLowerCase() === source.toLowerCase()) : undefined;
  if (stat && profile.baselineConversionRatePct != null) {
    if (stat.conversionRatePct >= profile.baselineConversionRatePct) {
      return {
        ...base,
        flag: "high-potential",
        reasons: [`Source "${source}" converts at ${stat.conversionRatePct}% in this upload (${stat.total} leads) — at or above the ${profile.baselineConversionRatePct}% overall rate`],
      };
    }
    return {
      ...base,
      flag: "needs-more-data",
      reasons: [`Source "${source}" converts at only ${stat.conversionRatePct}% in this upload, below the ${profile.baselineConversionRatePct}% overall rate`],
    };
  }

  return { ...base, flag: "unscored", reasons: [source ? `No real conversion-rate history yet for source "${source}" (fewer than ${MIN_SOURCE_SAMPLE} leads)` : "No source column matched — nothing to score against"] };
}

export function analyzeUploadedLeads(
  sheet: ParsedLeadSheet,
  outcomeColumnOverride?: string,
  convertedValuesOverride?: string[],
  crmLookup: { byEmail: Map<string, CrmMatch>; byPhone: Map<string, CrmMatch> } | null = null,
): LeadInsightsResult {
  const outcomeColumn = outcomeColumnOverride ?? detectOutcomeColumn(sheet.headers);
  const cols = {
    email: matchColumn(sheet.headers, "email"),
    phone: matchColumn(sheet.headers, "phone"),
    name: matchColumn(sheet.headers, "name"),
    source: matchColumn(sheet.headers, "source"),
    company: matchColumn(sheet.headers, "company"),
    city: matchColumn(sheet.headers, "city"),
  } as Record<MatchableField, string | null>;
  const columnsMatched = (Object.keys(COLUMN_ALIASES) as MatchableField[]).map((field) => ({ field, header: cols[field] }));

  if (!outcomeColumn) {
    return {
      totalRows: sheet.rows.length,
      outcomeColumn: null,
      convertedValues: [],
      columnsMatched,
      hasEnoughData: false,
      baselineConversionRatePct: null,
      alreadyConvertedCount: 0,
      highPotentialCount: 0,
      needsMoreDataCount: 0,
      unscoredCount: sheet.rows.length,
      dataGaps: [],
      topHighPotential: [],
    };
  }

  const distinctValues = [...new Set(sheet.rows.map((r) => r[outcomeColumn]?.trim()).filter(Boolean))] as string[];
  const convertedValues = new Set(convertedValuesOverride ?? classifyOutcomeValues(distinctValues));

  const profile = computeFileConversionProfile(sheet, outcomeColumn, convertedValues, cols);
  const scored = sheet.rows.map((row, i) => scoreRow(i, row, cols, outcomeColumn, convertedValues, profile, crmLookup));

  const counts = { converted: 0, high: 0, needsData: 0, unscored: 0 };
  for (const s of scored) {
    if (s.flag === "already-converted") counts.converted++;
    else if (s.flag === "high-potential") counts.high++;
    else if (s.flag === "needs-more-data") counts.needsData++;
    else counts.unscored++;
  }

  const dataGaps: DataGap[] = profile.fieldCompleteness
    .map((c) => ({
      field: c.field,
      uploadedFillRatePct: c.overallFillRatePct,
      convertedFillRatePct: c.convertedFillRatePct,
      gapPct: c.convertedFillRatePct != null ? c.convertedFillRatePct - c.overallFillRatePct : null,
    }))
    .sort((a, b) => (b.gapPct ?? -Infinity) - (a.gapPct ?? -Infinity));

  const topHighPotential = scored
    .filter((s) => s.flag === "high-potential")
    .sort((a, b) => b.completenessPct - a.completenessPct)
    .slice(0, TOP_N);

  return {
    totalRows: sheet.rows.length,
    outcomeColumn,
    convertedValues: [...convertedValues],
    columnsMatched,
    hasEnoughData: profile.hasEnoughData,
    baselineConversionRatePct: profile.baselineConversionRatePct,
    alreadyConvertedCount: counts.converted,
    highPotentialCount: counts.high,
    needsMoreDataCount: counts.needsData,
    unscoredCount: counts.unscored,
    dataGaps,
    topHighPotential,
  };
}
