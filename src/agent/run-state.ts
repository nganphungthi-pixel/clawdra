/**
 * Run State Machine - OpenClaw pattern
 * Counter-based state machine for tracking active runs
 * Periodic heartbeat publish while runs are active
 * Abort signal support for graceful shutdown
 */

import { EventEmitter } from "node:events";

export type RunStatus = "idle" | "busy";

export interface RunState {
  status: RunStatus;
  activeRuns: number;
  lastHeartbeatAt: number;
  startedAt: number | null;
}

export class RunStateMachine extends EventEmitter {
  private activeRunCount = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number;
  private abortController: AbortController | null = null;

  constructor(heartbeatIntervalMs: number = 60000) {
    super();
    this.heartbeatIntervalMs = heartbeatIntervalMs;
  }

  /**
   * Mark run start - increments active run count, publishes busy status
   */
  onRunStart(): void {
    this.activeRunCount++;

    if (this.activeRunCount === 1) {
      // First run - start heartbeat
      this.startHeartbeat();
      this.abortController = new AbortController();
    }

    this.emit("status:change", {
      status: "busy" as RunStatus,
      activeRuns: this.activeRunCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Mark run end - decrements count, clears heartbeat when zero
   */
  onRunEnd(): void {
    if (this.activeRunCount > 0) {
      this.activeRunCount--;
    }

    if (this.activeRunCount === 0) {
      // All runs complete - stop heartbeat
      this.stopHeartbeat();
      this.abortController = null;

      this.emit("status:change", {
        status: "idle" as RunStatus,
        activeRuns: 0,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get current state
   */
  getState(): RunState {
    return {
      status: this.activeRunCount > 0 ? "busy" : "idle",
      activeRuns: this.activeRunCount,
      lastHeartbeatAt: this.activeRunCount > 0 ? Date.now() : 0,
      startedAt: this.activeRunCount > 0 ? Date.now() : null,
    };
  }

  /**
   * Get abort signal for graceful shutdown
   */
  getAbortSignal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  /**
   * Request abort (graceful shutdown)
   */
  requestAbort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Check if busy
   */
  isBusy(): boolean {
    return this.activeRunCount > 0;
  }

  /**
   * Get active run count
   */
  getActiveRunCount(): number {
    return this.activeRunCount;
  }

  // ============================================
  // HEARTBEAT
  // ============================================

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.activeRunCount > 0) {
        this.emit("heartbeat", {
          activeRuns: this.activeRunCount,
          timestamp: Date.now(),
          status: "busy",
        });
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopHeartbeat();
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.activeRunCount = 0;
    this.removeAllListeners();
  }
}

// Global run state machine
let runStateMachineInstance: RunStateMachine | null = null;

export function getRunStateMachine(): RunStateMachine {
  if (!runStateMachineInstance) {
    runStateMachineInstance = new RunStateMachine();
  }
  return runStateMachineInstance;
}
