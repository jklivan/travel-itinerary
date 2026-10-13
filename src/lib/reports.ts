// What can be reported, and the reasons offered (App Store guideline 1.2).
export type ReportKind = 'trip' | 'comment' | 'message' | 'snapshot' | 'question' | 'user'
export const REPORT_KINDS: ReportKind[] = ['trip', 'comment', 'message', 'snapshot', 'question', 'user']
export const REPORT_REASONS = ['Spam', 'Inappropriate or offensive', 'Harassment or bullying', 'False or misleading', 'Something else'] as const
