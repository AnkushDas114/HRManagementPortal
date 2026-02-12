
import type { LeaveRequest, Employee } from '../types';

export const generateLeaveSummaryReport = async (requests: LeaveRequest[]): Promise<string> => {
  // Fallback implementation when AI service is not available.
  if (requests.length === 0) {
    return "No leave requests to summarize.";
  }

  const approved = requests.filter(r => r.status === 'Approved');
  const pending = requests.filter(r => r.status === 'Pending');
  const rejected = requests.filter(r => r.status === 'Rejected');

  const byDept: Record<string, number> = {};
  approved.forEach(r => {
    byDept[r.employee.department] = (byDept[r.employee.department] || 0) + r.days;
  });

  const deptLines = Object.entries(byDept)
    .sort((a, b) => b[1] - a[1])
    .map(([dept, days]) => `- ${dept}: ${days} days`)
    .join('\n');

  return [
    "## Leave Summary",
    `- Total requests: ${requests.length}`,
    `- Approved: ${approved.length}`,
    `- Pending: ${pending.length}`,
    `- Rejected: ${rejected.length}`,
    "",
    "## Approved Leave by Department",
    deptLines || "- No approved leaves yet"
  ].join('\n');
};

export const fetchLatestUsersFromAI = async (): Promise<Partial<Employee>[]> => {
  // AI service not configured: return empty list.
  return [];
};
