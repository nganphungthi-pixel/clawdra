/**
 * Company Governance System - Inspired by Paperclip
 * Multi-tenant org management with budgets, approvals, and agent coordination
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";

export type CompanyStatus = "active" | "paused" | "archived";
export type AgentRole = "ceo" | "cto" | "cmo" | "cfo" | "coo" | "engineer" | "designer" | "pm" | "qa" | "devops" | "researcher" | "general";
export type AgentStatus = "active" | "paused" | "idle" | "running" | "error" | "pending_approval" | "terminated";
export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled";
export type IssuePriority = "critical" | "high" | "medium" | "low";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalType = "hire_agent" | "approve_ceo_strategy" | "budget_override_required" | "issue_approval";

export interface Company {
  id: string;
  name: string;
  description: string;
  status: CompanyStatus;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  issuePrefix: string;
  issueCounter: number;
  createdAt: number;
  pausedAt?: number;
  pauseReason?: string;
  requireBoardApprovalForNewAgents: boolean;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  principalType: "user" | "agent";
  principalId: string;
  role: AgentRole;
  status: "pending" | "active" | "suspended";
  permissions: Set<string>;
  joinedAt: number;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: AgentRole;
  title: string;
  status: AgentStatus;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  reportsTo?: string;
  lastHeartbeatAt?: number;
  createdAt: number;
  permissions: {
    canCreateAgents: boolean;
    canAssignIssues: boolean;
    canManageBudget: boolean;
  };
}

export interface Issue {
  id: string;
  companyId: string;
  number: number;
  identifier: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  parentId?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface Approval {
  id: string;
  companyId: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  payload: Record<string, unknown>;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: number;
  createdAt: number;
}

export interface BudgetPolicy {
  id: string;
  companyId: string;
  scopeType: "company" | "agent" | "project";
  scopeId: string;
  metric: "billed_cents";
  windowKind: "calendar_month_utc" | "lifetime";
  amount: number;
  warnPercent: number;
  hardStopEnabled: boolean;
  notifyEnabled: boolean;
  isActive: boolean;
}

export interface BudgetIncident {
  id: string;
  companyId: string;
  policyId: string;
  thresholdType: "soft" | "hard";
  amountLimit: number;
  amountObserved: number;
  status: "open" | "resolved" | "dismissed";
  createdAt: number;
  resolvedAt?: number;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  actorType: "user" | "agent" | "system";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface HeartbeatRun {
  id: string;
  companyId: string;
  agentId: string;
  invocationSource: "timer" | "assignment" | "on_demand" | "automation";
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "timed_out";
  startedAt: number;
  finishedAt?: number;
  error?: string;
  usageJson?: string;
  resultJson?: string;
}

export interface CompanyGovernanceConfig {
  defaultBudgetCents?: number;
  requireApprovalForNewAgents?: boolean;
  heartbeatIntervalSec?: number;
  maxConcurrentRuns?: number;
}

const DEFAULT_GOVERNANCE_CONFIG: Required<CompanyGovernanceConfig> = {
  defaultBudgetCents: 10000, // $100
  requireApprovalForNewAgents: true,
  heartbeatIntervalSec: 3600,
  maxConcurrentRuns: 3,
};

export class CompanyGovernance {
  private companies: Map<string, Company> = new Map();
  private members: Map<string, CompanyMember[]> = new Map();
  private agents: Map<string, Agent> = new Map();
  private issues: Map<string, Issue> = new Map();
  private approvals: Map<string, Approval> = new Map();
  private budgetPolicies: Map<string, BudgetPolicy> = new Map();
  private budgetIncidents: Map<string, BudgetIncident[]> = new Map();
  private activityLog: ActivityLog[] = [];
  private heartbeatRuns: Map<string, HeartbeatRun[]> = new Map();
  private config: Required<CompanyGovernanceConfig>;

  constructor(config?: CompanyGovernanceConfig) {
    this.config = { ...DEFAULT_GOVERNANCE_CONFIG, ...config };
  }

  // ============================================
  // COMPANY MANAGEMENT
  // ============================================

  async createCompany(name: string, description: string, budgetCents?: number): Promise<Company> {
    const company: Company = {
      id: randomUUID(),
      name,
      description,
      status: "active",
      budgetMonthlyCents: budgetCents || this.config.defaultBudgetCents,
      spentMonthlyCents: 0,
      issuePrefix: name.slice(0, 3).toUpperCase(),
      issueCounter: 0,
      createdAt: Date.now(),
      requireBoardApprovalForNewAgents: this.config.requireApprovalForNewAgents,
    };

    this.companies.set(company.id, company);
    this.members.set(company.id, []);
    this.issues.set(company.id, new Map() as any);
    this.budgetIncidents.set(company.id, []);
    this.heartbeatRuns.set(company.id, []);

    await this.logActivity(company.id, "system", "system", "company_created", "company", company.id, { name });

    return company;
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  async pauseCompany(id: string, reason: string): Promise<boolean> {
    const company = this.companies.get(id);
    if (!company) return false;

    company.status = "paused";
    company.pausedAt = Date.now();
    company.pauseReason = reason;

    // Pause all agents in the company
    for (const agent of this.agents.values()) {
      if (agent.companyId === id && agent.status === "active") {
        agent.status = "paused";
      }
    }

    await this.logActivity(id, "system", "system", "company_paused", "company", id, { reason });
    return true;
  }

  async resumeCompany(id: string): Promise<boolean> {
    const company = this.companies.get(id);
    if (!company || company.status !== "paused") return false;

    company.status = "active";
    company.pausedAt = undefined;
    company.pauseReason = undefined;

    await this.logActivity(id, "system", "system", "company_resumed", "company", id, {});
    return true;
  }

  // ============================================
  // AGENT MANAGEMENT
  // ============================================

  async createAgent(
    companyId: string,
    name: string,
    role: AgentRole,
    title: string,
    reportsTo?: string
  ): Promise<{ agent: Agent; approval?: Approval }> {
    const company = this.companies.get(companyId);
    if (!company) throw new Error("Company not found");

    if (company.requireBoardApprovalForNewAgents) {
      const approval: Approval = {
        id: randomUUID(),
        companyId,
        type: "hire_agent",
        status: "pending",
        requestedBy: name,
        payload: { name, role, title, reportsTo },
        createdAt: Date.now(),
      };

      this.approvals.set(approval.id, approval);

      const agent: Agent = {
        id: randomUUID(),
        companyId,
        name,
        role,
        title,
        status: "pending_approval",
        budgetMonthlyCents: company.budgetMonthlyCents / 10,
        spentMonthlyCents: 0,
        reportsTo,
        createdAt: Date.now(),
        permissions: {
          canCreateAgents: role === "ceo" || role === "cto",
          canAssignIssues: true,
          canManageBudget: role === "ceo" || role === "cfo",
        },
      };

      this.agents.set(agent.id, agent);

      await this.logActivity(companyId, "system", "system", "agent_pending", "agent", agent.id, { name, role });
      return { agent, approval };
    }

    const agent: Agent = {
      id: randomUUID(),
      companyId,
      name,
      role,
      title,
      status: "active",
      budgetMonthlyCents: company.budgetMonthlyCents / 10,
      spentMonthlyCents: 0,
      reportsTo,
      createdAt: Date.now(),
      permissions: {
        canCreateAgents: role === "ceo" || role === "cto",
        canAssignIssues: true,
        canManageBudget: role === "ceo" || role === "cfo",
      },
    };

    this.agents.set(agent.id, agent);

    await this.logActivity(companyId, "system", "system", "agent_created", "agent", agent.id, { name, role });
    return { agent };
  }

  async approveAgent(agentId: string, approvedBy: string, note?: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== "pending_approval") return false;

    agent.status = "active";

    // Approve related approval
    for (const approval of this.approvals.values()) {
      if (approval.type === "hire_agent" && approval.payload.name === agent.name && approval.status === "pending") {
        approval.status = "approved";
        approval.decidedBy = approvedBy;
        approval.decidedAt = Date.now();
        approval.decisionNote = note;
      }
    }

    await this.logActivity(agent.companyId, "user", approvedBy, "agent_approved", "agent", agentId, { note });
    return true;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getCompanyAgents(companyId: string): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.companyId === companyId);
  }

  // ============================================
  // ORG CHART
  // ============================================

  getOrgChart(companyId: string): Agent[] {
    const agents = this.getCompanyAgents(companyId);
    return agents.sort((a, b) => {
      const roleOrder: Record<AgentRole, number> = {
        ceo: 0, cto: 1, cmo: 2, cfo: 3, coo: 4,
        engineer: 5, designer: 6, pm: 7, qa: 8, devops: 9, researcher: 10, general: 11,
      };
      return (roleOrder[a.role] || 11) - (roleOrder[b.role] || 11);
    });
  }

  getChainOfCommand(agentId: string): Agent[] {
    const chain: Agent[] = [];
    let current: Agent | undefined = this.agents.get(agentId);

    while (current) {
      chain.unshift(current);
      if (current.reportsTo) {
        current = this.agents.get(current.reportsTo);
      } else {
        current = undefined;
      }
    }

    return chain;
  }

  // ============================================
  // ISSUE MANAGEMENT
  // ============================================

  async createIssue(
    companyId: string,
    title: string,
    description: string,
    priority: IssuePriority = "medium",
    assigneeAgentId?: string
  ): Promise<Issue> {
    const company = this.companies.get(companyId);
    if (!company) throw new Error("Company not found");

    company.issueCounter++;

    const issue: Issue = {
      id: randomUUID(),
      companyId,
      number: company.issueCounter,
      identifier: `${company.issuePrefix}-${company.issueCounter}`,
      title,
      description,
      status: "todo",
      priority,
      assigneeAgentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.issues.set(issue.id, issue);

    await this.logActivity(companyId, "system", "system", "issue_created", "issue", issue.id, { identifier: issue.identifier });
    return issue;
  }

  getIssue(id: string): Issue | undefined {
    return this.issues.get(id);
  }

  async updateIssueStatus(id: string, status: IssueStatus): Promise<boolean> {
    const issue = this.issues.get(id);
    if (!issue) return false;

    issue.status = status;
    issue.updatedAt = Date.now();

    if (status === "done") {
      issue.completedAt = Date.now();
    }

    await this.logActivity(issue.companyId, "system", "system", "issue_status_updated", "issue", id, { status });
    return true;
  }

  getCompanyIssues(companyId: string): Issue[] {
    return Array.from(this.issues.values()).filter(i => i.companyId === companyId);
  }

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  async setBudgetPolicy(companyId: string, policy: Omit<BudgetPolicy, "id" | "companyId">): Promise<BudgetPolicy> {
    const budgetPolicy: BudgetPolicy = {
      id: randomUUID(),
      companyId,
      ...policy,
    };

    this.budgetPolicies.set(budgetPolicy.id, budgetPolicy);

    await this.logActivity(companyId, "system", "system", "budget_policy_created", "budget_policy", budgetPolicy.id, {
      scopeType: policy.scopeType,
      amount: policy.amount,
    });

    return budgetPolicy;
  }

  async recordCost(companyId: string, agentId: string, costCents: number, inputTokens: number, outputTokens: number): Promise<{ blocked: boolean; incident?: BudgetIncident }> {
    const company = this.companies.get(companyId);
    const agent = this.agents.get(agentId);

    if (!company || !agent) {
      return { blocked: false };
    }

    // Update spent amounts
    company.spentMonthlyCents += costCents;
    agent.spentMonthlyCents += costCents;

    // Check budget policies
    const policies = Array.from(this.budgetPolicies.values()).filter(
      p => p.companyId === companyId && p.isActive
    );

    for (const policy of policies) {
      if (policy.scopeType === "company" && policy.scopeId === companyId) {
        const observed = company.spentMonthlyCents;
        const incident = await this.evaluateBudgetPolicy(policy, observed, companyId, agentId);
        if (incident) {
          return { blocked: incident.thresholdType === "hard", incident };
        }
      }

      if (policy.scopeType === "agent" && policy.scopeId === agentId) {
        const observed = agent.spentMonthlyCents;
        const incident = await this.evaluateBudgetPolicy(policy, observed, companyId, agentId);
        if (incident) {
          return { blocked: incident.thresholdType === "hard", incident };
        }
      }
    }

    return { blocked: false };
  }

  private async evaluateBudgetPolicy(
    policy: BudgetPolicy,
    observed: number,
    companyId: string,
    agentId: string
  ): Promise<BudgetIncident | undefined> {
    const warnAmount = policy.amount * (policy.warnPercent / 100);

    if (observed >= policy.amount && policy.hardStopEnabled) {
      const incident: BudgetIncident = {
        id: randomUUID(),
        companyId,
        policyId: policy.id,
        thresholdType: "hard",
        amountLimit: policy.amount,
        amountObserved: observed,
        status: "open",
        createdAt: Date.now(),
      };

      const incidents = this.budgetIncidents.get(companyId) || [];
      incidents.push(incident);
      this.budgetIncidents.set(companyId, incidents);

      // Pause the agent
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = "paused";
      }

      await this.logActivity(companyId, "system", "system", "budget_hard_stop", "budget_incident", incident.id, {
        agentId,
        amount: observed,
        limit: policy.amount,
      });

      return incident;
    }

    if (observed >= warnAmount && policy.notifyEnabled) {
      const incident: BudgetIncident = {
        id: randomUUID(),
        companyId,
        policyId: policy.id,
        thresholdType: "soft",
        amountLimit: warnAmount,
        amountObserved: observed,
        status: "open",
        createdAt: Date.now(),
      };

      const incidents = this.budgetIncidents.get(companyId) || [];
      incidents.push(incident);
      this.budgetIncidents.set(companyId, incidents);

      await this.logActivity(companyId, "system", "system", "budget_warning", "budget_incident", incident.id, {
        agentId,
        amount: observed,
        limit: warnAmount,
      });

      return incident;
    }

    return undefined;
  }

  checkInvocationBlock(companyId: string, agentId: string): { blocked: boolean; reason?: string } {
    const company = this.companies.get(companyId);
    const agent = this.agents.get(agentId);

    if (!company || !agent) {
      return { blocked: true, reason: "Company or agent not found" };
    }

    if (company.status === "paused") {
      return { blocked: true, reason: `Company paused: ${company.pauseReason}` };
    }

    if (agent.status === "paused" || agent.status === "pending_approval") {
      return { blocked: true, reason: `Agent status: ${agent.status}` };
    }

    // Check hard budget stops
    const incidents = this.budgetIncidents.get(companyId) || [];
    const hardIncident = incidents.find(i => i.thresholdType === "hard" && i.status === "open");
    if (hardIncident) {
      return { blocked: true, reason: `Budget exceeded: ${hardIncident.amountObserved} / ${hardIncident.amountLimit} cents` };
    }

    return { blocked: false };
  }

  // ============================================
  // HEARTBEAT MONITORING
  // ============================================

  async startHeartbeatRun(companyId: string, agentId: string, source: HeartbeatRun["invocationSource"]): Promise<HeartbeatRun> {
    const run: HeartbeatRun = {
      id: randomUUID(),
      companyId,
      agentId,
      invocationSource: source,
      status: "running",
      startedAt: Date.now(),
    };

    const runs = this.heartbeatRuns.get(companyId) || [];
    runs.push(run);
    this.heartbeatRuns.set(companyId, runs);

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = "running";
      agent.lastHeartbeatAt = Date.now();
    }

    return run;
  }

  async completeHeartbeatRun(runId: string, success: boolean, error?: string, usage?: unknown, result?: unknown): Promise<boolean> {
    for (const [companyId, runs] of this.heartbeatRuns) {
      const run = runs.find(r => r.id === runId);
      if (run) {
        run.status = success ? "succeeded" : "failed";
        run.finishedAt = Date.now();
        run.error = error;
        run.usageJson = JSON.stringify(usage || {});
        run.resultJson = JSON.stringify(result || {});

        const agent = this.agents.get(run.agentId);
        if (agent) {
          agent.status = success ? "active" : "error";
          agent.lastHeartbeatAt = Date.now();
        }

        return true;
      }
    }
    return false;
  }

  getActiveRuns(companyId: string): HeartbeatRun[] {
    const runs = this.heartbeatRuns.get(companyId) || [];
    return runs.filter(r => r.status === "running" || r.status === "queued");
  }

  // ============================================
  // ACTIVITY LOG
  // ============================================

  private async logActivity(
    companyId: string,
    actorType: ActivityLog["actorType"],
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    this.activityLog.push({
      id: randomUUID(),
      companyId,
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      details,
      timestamp: Date.now(),
    });
  }

  getActivityLog(companyId: string, limit: number = 50): ActivityLog[] {
    return this.activityLog
      .filter(l => l.companyId === companyId)
      .slice(-limit)
      .reverse();
  }

  // ============================================
  // APPROVALS
  // ============================================

  getPendingApprovals(companyId: string): Approval[] {
    return Array.from(this.approvals.values()).filter(
      a => a.companyId === companyId && a.status === "pending"
    );
  }

  async decideApproval(approvalId: string, status: ApprovalStatus, decidedBy: string, note?: string): Promise<boolean> {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== "pending") return false;

    approval.status = status;
    approval.decidedBy = decidedBy;
    approval.decidedAt = Date.now();
    approval.decisionNote = note;

    await this.logActivity(approval.companyId, "user", decidedBy, "approval_decided", "approval", approvalId, { status, note });
    return true;
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStats(): {
    companies: number;
    agents: number;
    issues: number;
    pendingApprovals: number;
    activeRuns: number;
    totalActivityLogs: number;
  } {
    return {
      companies: this.companies.size,
      agents: this.agents.size,
      issues: this.issues.size,
      pendingApprovals: Array.from(this.approvals.values()).filter(a => a.status === "pending").length,
      activeRuns: Array.from(this.heartbeatRuns.values()).flat().filter(r => r.status === "running").length,
      totalActivityLogs: this.activityLog.length,
    };
  }
}

// Global governance instance
let governanceInstance: CompanyGovernance | null = null;

export function getCompanyGovernance(): CompanyGovernance {
  if (!governanceInstance) {
    governanceInstance = new CompanyGovernance();
  }
  return governanceInstance;
}
