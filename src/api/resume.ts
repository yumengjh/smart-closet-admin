import { http } from "@/utils/http";
import type { ApiResponse } from "./user";

export type ResumeContact = { icon?: string; label: string; text: string; href?: string };
export type ResumeSectionType = "bullet-list" | "timeline" | "projects" | "custom";
export type ResumeSection = { id: string; type: ResumeSectionType; title: string; items: unknown[]; payload?: Record<string, unknown> };
export type ResumeContent = { seo?: { title?: string; description?: string }; profile: { name: string; headline?: string; contacts: ResumeContact[] }; sections: ResumeSection[] };
type ResumeWireDocument = { content: string; schemaVersion: number; version: number };
export type ResumeDocument = Omit<ResumeWireDocument, "content"> & { content: ResumeContent };
export type ResumeFeedbackType = "REACTION" | "REVIEW";
export type ResumeReaction = "GREAT" | "GOOD" | "NEUTRAL" | "UNSURE" | "POOR";
export type ResumeFeedbackStatus = "UNREAD" | "READ" | "ARCHIVED";
export type ResumeFeedback = { id: string; type: ResumeFeedbackType; reaction?: ResumeReaction; rating?: number; suggestion?: string; ipAddress: string; userAgent?: string; status: ResumeFeedbackStatus; createdAt: string };
export type ResumeFeedbackPage = { items: ResumeFeedback[]; page: number; size: number; totalElements: number; totalPages: number };
export type ResumeFeedbackQuery = { page?: number; size?: number; type?: ResumeFeedbackType; status?: ResumeFeedbackStatus; rating?: number };

const fail = (message: string): never => { throw new Error(message); };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const parseResumeDocument = (content: string): ResumeContent => {
  let value: unknown;
  try { value = JSON.parse(content); } catch { return fail("简历内容不是有效的 JSON"); }
  if (!isRecord(value) || !isRecord(value.profile) || !Array.isArray(value.sections)) return fail("简历必须包含 profile 和 sections");
  if (typeof value.profile.name !== "string" || !Array.isArray(value.profile.contacts)) return fail("profile 必须包含姓名和联系方式数组");
  if (!value.sections.every(section => isRecord(section) && typeof section.id === "string" && typeof section.title === "string" && ["bullet-list", "timeline", "projects", "custom"].includes(String(section.type)) && Array.isArray(section.items))) return fail("每个区块必须具有 id、标题、受支持类型和 items 数组");
  return value as ResumeContent;
};
const parseWireDocument = (document: ResumeWireDocument): ResumeDocument => ({ ...document, content: parseResumeDocument(document.content) });
export const toSavePayload = (document: ResumeDocument): ResumeWireDocument => ({ content: JSON.stringify(document.content), schemaVersion: document.schemaVersion, version: document.version });
export const getManagedResume = async (): Promise<ResumeDocument> => parseWireDocument((await http.request<ApiResponse<ResumeWireDocument>>("get", "/resume/manage")).data);
export const updateManagedResume = async (document: ResumeDocument): Promise<ResumeDocument> => parseWireDocument((await http.request<ApiResponse<ResumeWireDocument>>("put", "/resume/manage", { data: toSavePayload(document) })).data);
export const getResumeFeedback = async (query: ResumeFeedbackQuery = {}): Promise<ResumeFeedbackPage> => (await http.request<ApiResponse<ResumeFeedbackPage>>("get", "/resume/feedback", { params: query })).data;
export const updateResumeFeedbackStatus = async (id: string, status: ResumeFeedbackStatus): Promise<ResumeFeedback> => (await http.request<ApiResponse<ResumeFeedback>>("patch", `/resume/feedback/${id}/status`, { data: { status } })).data;
