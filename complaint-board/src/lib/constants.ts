export const CATEGORIES = [
  "전체",
  "서비스/응대",
  "시스템/오류",
  "시설/환경",
  "제안/건의",
  "기타",
] as const;

export const POST_CATEGORIES = [
  "서비스/응대",
  "시스템/오류",
  "시설/환경",
  "제안/건의",
  "기타",
] as const;

export type Category = (typeof POST_CATEGORIES)[number];

export const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  WAITING: {
    label: "접수대기",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  PROCESSING: {
    label: "검토/처리중",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  COMPLETED: {
    label: "답변완료",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  REJECTED: {
    label: "보류/반려",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
};

export const ADMIN_COOKIE_NAME = "complaint_admin_token";

