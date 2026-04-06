/**
 * Advanced Learning System with Pattern Extraction
 * Learns from every interaction and improves over time
 */

import { getMemorySystem, MemoryType, PatternEntry } from '../memory/mod.js';

export interface Interaction {
  id: string;
  timestamp: number;
  query: string;
  response: string;
  toolsUsed: string[];
  iterations: number;
  success: boolean;
  duration: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

export interface FailureAnalysis {
  interactionId: string;
  errorType: string;
  errorMessage: string;
  rootCause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  correctiveActions: string[];
  lessons: string[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: string;
  applicableContexts: string[];
  successRate: number;
  timesApplied: number;
  createdAt: number;
}

export interface LearningMetrics {
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  successRate: number;
  averageIterations: number;
  averageDuration: number;
  patternsExtracted: number;
  lessonsLearned: number;
  improvementRate: number;
}

export class LearningEngine {
  private interactions: Interaction[] = [];
  private lessons: Lesson[] = [];
  private failurePatterns: Map<string, number> = new Map();
  private successPatterns: Map<string, number> = new Map();
  private memory = getMemorySystem();

  /**
   * Record an interaction
   */
  async recordInteraction(interaction: Omit<Interaction, 'id' | 'timestamp'>): Promise<void> {
    const fullInteraction: Interaction = {
      ...interaction,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.interactions.push(fullInteraction);

    // Keep only last 1000 interactions in memory
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }

    // Save to memory
    await this.memory.saveMemory(
      `interaction_${fullInteraction.id}`,
      fullInteraction,
      MemoryType.Episodic
    );

    // Learn from interaction
    if (interaction.success) {
      await this.learnFromSuccess(fullInteraction);
    } else {
      await this.learnFromFailure(fullInteraction);
    }

    // Extract patterns periodically
    if (this.interactions.length % 10 === 0) {
      await this.extractPatterns();
    }
  }

  /**
   * Analyze failure and extract lessons
   */
  async analyzeFailure(interaction: Interaction, error: Error): Promise<FailureAnalysis> {
    const errorType = this.classifyError(error);
    const rootCause = await this.identifyRootCause(interaction, error);
    const correctiveActions = this.generateCorrectiveActions(errorType, interaction);
    const lessons = this.extractLessonsFromFailure(errorType, rootCause, interaction);

    const analysis: FailureAnalysis = {
      interactionId: interaction.id,
      errorType,
      errorMessage: error.message,
      rootCause,
      severity: this.assessSeverity(errorType),
      correctiveActions,
      lessons,
    };

    // Store failure pattern
    const patternKey = `${errorType}_${rootCause}`;
    this.failurePatterns.set(patternKey, 
      (this.failurePatterns.get(patternKey) || 0) + 1
    );

    // Save lessons
    for (const lesson of lessons) {
      await this.addLesson({
        id: crypto.randomUUID(),
        title: `Avoid ${errorType}`,
        description: lesson,
        category: 'failure-prevention',
        applicableContexts: [interaction.query],
        successRate: 0,
        timesApplied: 0,
        createdAt: Date.now(),
      });
    }

    return analysis;
  }

  /**
   * Learn from successful interaction
   */
  private async learnFromSuccess(interaction: Interaction): Promise<void> {
    // Identify successful patterns
    const toolsKey = interaction.toolsUsed.sort().join(',');
    if (toolsKey) {
      this.successPatterns.set(toolsKey,
        (this.successPatterns.get(toolsKey) || 0) + 1
      );
    }

    // Extract what worked
    if (interaction.iterations <= 3) {
      // Fast success - capture the approach
      await this.memory.learnPattern(
        `fast_success_${interaction.toolsUsed.join('_')}`,
        `Quick solution using ${interaction.toolsUsed.join(', ')}`,
        { tools: interaction.toolsUsed, iterations: interaction.iterations },
        undefined,
        interaction.toolsUsed
      );
    }
  }

  /**
   * Learn from failed interaction
   */
  private async learnFromFailure(interaction: Interaction): Promise<void> {
    // Track what doesn't work
    const toolsKey = interaction.toolsUsed.sort().join(',');
    if (toolsKey) {
      this.failurePatterns.set(toolsKey,
        (this.failurePatterns.get(toolsKey) || 0) + 1
      );
    }
  }

  /**
   * Extract patterns from interactions
   */
  async extractPatterns(): Promise<PatternEntry[]> {
    const patterns: PatternEntry[] = [];
    const recentInteractions = this.interactions.slice(-100);

    // Find common successful approaches
    const toolCombinations = new Map<string, { count: number; success: number }>();

    for (const interaction of recentInteractions) {
      if (!interaction.success) continue;

      const key = interaction.toolsUsed.sort().join(',');
      if (!key) continue;

      const existing = toolCombinations.get(key) || { count: 0, success: 0 };
      existing.count++;
      existing.success++;
      toolCombinations.set(key, existing);
    }

    // Create patterns from frequent combinations
    for (const [tools, stats] of toolCombinations) {
      if (stats.count >= 3) {
        const pattern = await this.memory.learnPattern(
          `tool_pattern_${tools.replace(/,/g, '_')}`,
          `Effective approach using ${tools}`,
          { tools: tools.split(','), successRate: stats.success / stats.count },
          undefined,
          tools.split(',')
        );
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Apply learned corrections to context
   */
  async applyCorrections(context: string): Promise<string> {
    let enhancedContext = context;

    // Add relevant lessons
    const relevantLessons = this.lessons.filter(lesson =>
      lesson.applicableContexts.some(ctx => 
        context.toLowerCase().includes(ctx.toLowerCase().slice(0, 30))
      )
    );

    if (relevantLessons.length > 0) {
      enhancedContext += '\n\n## Learned Lessons:\n';
      for (const lesson of relevantLessons.slice(-5)) {
        enhancedContext += `- ${lesson.description}\n`;
      }
    }

    // Add successful patterns
    const patterns = this.memory.getPatterns();
    if (patterns.length > 0) {
      enhancedContext += '\n## Successful Patterns:\n';
      for (const pattern of patterns.slice(-3)) {
        enhancedContext += `- ${pattern.name}: ${pattern.description}\n`;
      }
    }

    return enhancedContext;
  }

  /**
   * Add a lesson
   */
  async addLesson(lesson: Lesson): Promise<void> {
    this.lessons.push(lesson);

    // Keep only last 500 lessons
    if (this.lessons.length > 500) {
      this.lessons = this.lessons.slice(-500);
    }

    // Save to memory
    await this.memory.learnPattern(
      `lesson_${lesson.id}`,
      lesson.title,
      lesson.description,
      undefined,
      [lesson.description]
    );
  }

  /**
   * Get learning metrics
   */
  getMetrics(): LearningMetrics {
    const total = this.interactions.length;
    const successful = this.interactions.filter(i => i.success).length;
    const failed = total - successful;

    const avgIterations = total > 0
      ? this.interactions.reduce((sum, i) => sum + i.iterations, 0) / total
      : 0;

    const avgDuration = total > 0
      ? this.interactions.reduce((sum, i) => sum + i.duration, 0) / total
      : 0;

    // Calculate improvement rate (compare recent vs older performance)
    const recentHalf = this.interactions.slice(Math.floor(total / 2));
    const olderHalf = this.interactions.slice(0, Math.floor(total / 2));

    const recentSuccessRate = olderHalf.length > 0
      ? olderHalf.filter(i => i.success).length / olderHalf.length
      : 0;

    const currentSuccessRate = recentHalf.length > 0
      ? recentHalf.filter(i => i.success).length / recentHalf.length
      : 0;

    const improvementRate = currentSuccessRate - recentSuccessRate;

    return {
      totalInteractions: total,
      successfulInteractions: successful,
      failedInteractions: failed,
      successRate: total > 0 ? successful / total : 0,
      averageIterations: avgIterations,
      averageDuration: avgDuration,
      patternsExtracted: this.memory.getPatterns().length,
      lessonsLearned: this.lessons.length,
      improvementRate,
    };
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error): string {
    if (error.message.includes('timeout')) return 'timeout';
    if (error.message.includes('API') || error.message.includes('401') || error.message.includes('403')) {
      return 'api-auth';
    }
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return 'rate-limit';
    }
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      return 'file-not-found';
    }
    if (error.message.includes('permission') || error.message.includes('EACCES')) {
      return 'permission-denied';
    }
    if (error.message.includes('loop') || error.message.includes('recursion')) {
      return 'infinite-loop';
    }
    return 'unknown';
  }

  /**
   * Identify root cause
   */
  private async identifyRootCause(interaction: Interaction, error: Error): Promise<string> {
    if (interaction.iterations > 10) {
      return 'Excessive iterations suggest unclear task or insufficient tools';
    }
    if (interaction.duration > 60000) {
      return 'Long execution time suggests complexity or inefficiency';
    }
    if (error.message.includes('API')) {
      return 'API error - check credentials and rate limits';
    }
    return 'Unknown root cause';
  }

  /**
   * Generate corrective actions
   */
  private generateCorrectiveActions(errorType: string, interaction: Interaction): string[] {
    const actions: string[] = [];

    switch (errorType) {
      case 'timeout':
        actions.push('Increase timeout for long-running operations');
        actions.push('Break task into smaller subtasks');
        break;
      case 'api-auth':
        actions.push('Verify API key is set and valid');
        actions.push('Check provider configuration');
        break;
      case 'rate-limit':
        actions.push('Implement backoff strategy');
        actions.push('Reduce request frequency');
        break;
      case 'file-not-found':
        actions.push('Verify file path is correct');
        actions.push('Use Read tool to discover file structure first');
        break;
      case 'infinite-loop':
        actions.push('Reduce max iterations');
        actions.push('Provide clearer instructions');
        break;
    }

    return actions;
  }

  /**
   * Assess severity
   */
  private assessSeverity(errorType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (errorType) {
      case 'api-auth':
      case 'rate-limit':
        return 'high';
      case 'infinite-loop':
      case 'timeout':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Extract lessons from failure
   */
  private extractLessonsFromFailure(
    errorType: string,
    rootCause: string,
    interaction: Interaction
  ): string[] {
    const lessons: string[] = [];

    lessons.push(`Avoid ${errorType} errors by checking prerequisites`);
    lessons.push(`When ${errorType} occurs, try: ${rootCause}`);

    if (interaction.toolsUsed.length > 3) {
      lessons.push('Using many tools may indicate unclear task - simplify approach');
    }

    return lessons;
  }

  /**
   * Record user feedback
   */
  async recordFeedback(interactionId: string, feedback: 'positive' | 'negative' | 'neutral'): Promise<void> {
    const interaction = this.interactions.find(i => i.id === interactionId);
    if (interaction) {
      interaction.userFeedback = feedback;

      if (feedback === 'negative') {
        await this.analyzeFailure(interaction, new Error('User indicated dissatisfaction'));
      }
    }
  }

  /**
   * Get relevant lessons for a query
   */
  getRelevantLessons(query: string): Lesson[] {
    return this.lessons.filter(lesson =>
      lesson.applicableContexts.some(ctx =>
        query.toLowerCase().includes(ctx.toLowerCase().slice(0, 20))
      )
    );
  }
}

// Global learning engine instance
export const learningEngine = new LearningEngine();
