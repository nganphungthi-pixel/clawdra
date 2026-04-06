/**
 * Multi-Model Ensemble Routing
 * Routes tasks to optimal models based on complexity assessment
 * Uses ensemble voting for critical decisions
 */

import { Provider, Message, Response, createProvider } from '../providers/mod.js';

export interface TaskAnalysis {
  query: string;
  complexity: number; // 0-100
  category: TaskCategory;
  requiresReasoning: boolean;
  requiresCreativity: boolean;
  requiresCodeGeneration: boolean;
  estimatedTokens: number;
}

export type TaskCategory = 
  | 'simple'        // 0-30: Basic edits, read operations
  | 'medium'        // 31-70: Feature implementation, debugging
  | 'complex'       // 71-100: Architecture, full-stack, multi-file
  | 'reasoning';    // Complex logic, planning

export interface ModelRouter {
  id: string;
  provider: Provider;
  model: string;
  strengths: TaskCategory[];
  costPer1KTokens: {
    input: number;
    output: number;
  };
  contextWindow: number;
  performanceScore: number; // 0-100
}

export interface EnsembleConfig {
  models: ModelRouter[];
  votingStrategy: 'majority' | 'weighted' | 'best-of-n';
  minAgreement: number; // 0-1, minimum agreement threshold
  useEnsemble: boolean;
}

export interface EnsembleVote {
  model: string;
  response: string;
  confidence: number;
}

export interface EnsembleResult {
  finalResponse: string;
  votes: EnsembleVote[];
  agreement: number;
  selectedModel: string;
}

const DEFAULT_MODELS: ModelRouter[] = [
  {
    id: 'gpt-4o-mini',
    provider: createProvider({}),
    model: 'gpt-4o-mini',
    strengths: ['simple'],
    costPer1KTokens: { input: 0.00015, output: 0.0006 },
    contextWindow: 128000,
    performanceScore: 75,
  },
  {
    id: 'claude-haiku',
    provider: createProvider({}),
    model: 'claude-3-haiku-20240307',
    strengths: ['simple', 'medium'],
    costPer1KTokens: { input: 0.00025, output: 0.00125 },
    contextWindow: 200000,
    performanceScore: 78,
  },
  {
    id: 'gpt-4o',
    provider: createProvider({}),
    model: 'gpt-4o',
    strengths: ['medium', 'complex'],
    costPer1KTokens: { input: 0.005, output: 0.015 },
    contextWindow: 128000,
    performanceScore: 90,
  },
  {
    id: 'claude-sonnet',
    provider: createProvider({}),
    model: 'claude-sonnet-4-20250514',
    strengths: ['medium', 'complex', 'reasoning'],
    costPer1KTokens: { input: 0.003, output: 0.015 },
    contextWindow: 200000,
    performanceScore: 92,
  },
  {
    id: 'claude-opus',
    provider: createProvider({}),
    model: 'claude-opus-4-20250514',
    strengths: ['complex', 'reasoning'],
    costPer1KTokens: { input: 0.015, output: 0.075 },
    contextWindow: 200000,
    performanceScore: 96,
  },
  {
    id: 'o1',
    provider: createProvider({}),
    model: 'o1',
    strengths: ['reasoning'],
    costPer1KTokens: { input: 0.015, output: 0.06 },
    contextWindow: 200000,
    performanceScore: 95,
  },
];

export class TaskAnalyzer {
  /**
   * Analyze task complexity (0-100)
   */
  analyzeComplexity(query: string): TaskAnalysis {
    const lowerQuery = query.toLowerCase();
    let complexity = 0;
    let category: TaskCategory = 'simple';
    let requiresReasoning = false;
    let requiresCreativity = false;
    let requiresCodeGeneration = false;

    // Count complexity indicators
    const lengthScore = Math.min(query.length / 100, 30);
    complexity += lengthScore;

    // Check for multi-file operations
    if (lowerQuery.includes('file') || lowerQuery.includes('create') || lowerQuery.includes('write')) {
      complexity += 10;
      requiresCodeGeneration = true;
    }

    // Check for architecture/design
    if (lowerQuery.includes('architecture') || lowerQuery.includes('design') || lowerQuery.includes('structure')) {
      complexity += 30;
      category = 'complex';
      requiresReasoning = true;
    }

    // Check for debugging
    if (lowerQuery.includes('bug') || lowerQuery.includes('fix') || lowerQuery.includes('error')) {
      complexity += 20;
      category = category === 'simple' ? 'medium' : category;
    }

    // Check for complex logic
    if (lowerQuery.includes('algorithm') || lowerQuery.includes('optimize') || lowerQuery.includes('performance')) {
      complexity += 25;
      requiresReasoning = true;
      category = 'reasoning';
    }

    // Check for creative tasks
    if (lowerQuery.includes('creative') || lowerQuery.includes('design') || lowerQuery.includes('ui') || lowerQuery.includes('ux')) {
      requiresCreativity = true;
      complexity += 15;
    }

    // Check for simple operations
    if (lowerQuery.includes('read') || lowerQuery.includes('show') || lowerQuery.includes('what')) {
      complexity = Math.max(0, complexity - 10);
    }

    // Clamp complexity
    complexity = Math.max(0, Math.min(100, complexity));

    // Determine category
    if (complexity <= 30) {
      category = 'simple';
    } else if (complexity <= 70) {
      category = 'medium';
    } else {
      category = complexity > 85 && requiresReasoning ? 'reasoning' : 'complex';
    }

    return {
      query,
      complexity,
      category,
      requiresReasoning,
      requiresCreativity,
      requiresCodeGeneration,
      estimatedTokens: Math.ceil(query.length / 4),
    };
  }

  /**
   * Select optimal model(s) for task
   */
  selectModels(analysis: TaskAnalysis, availableModels: ModelRouter[] = DEFAULT_MODELS): ModelRouter[] {
    // Filter models that are strong in this category
    const suitableModels = availableModels
      .filter(m => m.strengths.includes(analysis.category))
      .sort((a, b) => {
        // Score by performance and cost efficiency
        const scoreA = a.performanceScore / (a.costPer1KTokens.output * 100);
        const scoreB = b.performanceScore / (b.costPer1KTokens.output * 100);
        return scoreB - scoreA;
      });

    // Return top models for ensemble (if needed)
    return suitableModels.slice(0, 3);
  }
}

export class EnsembleRouter {
  private config: EnsembleConfig;
  private taskAnalyzer: TaskAnalyzer;
  private performanceHistory: Map<string, number> = new Map();

  constructor(config?: Partial<EnsembleConfig>) {
    this.config = {
      models: DEFAULT_MODELS,
      votingStrategy: config?.votingStrategy || 'weighted',
      minAgreement: config?.minAgreement || 0.7,
      useEnsemble: config?.useEnsemble ?? false, // Disabled by default for speed
    };
    this.taskAnalyzer = new TaskAnalyzer();
  }

  /**
   * Route task to optimal model
   */
  async routeTask(query: string): Promise<{
    analysis: TaskAnalysis;
    selectedModel: ModelRouter;
    shouldUseEnsemble: boolean;
  }> {
    const analysis = this.taskAnalyzer.analyzeComplexity(query);
    const suitableModels = this.taskAnalyzer.selectModels(analysis, this.config.models);

    if (suitableModels.length === 0) {
      throw new Error('No suitable models found for this task');
    }

    const selectedModel = suitableModels[0];
    const shouldUseEnsemble = this.config.useEnsemble && 
                              suitableModels.length > 1 && 
                              analysis.complexity > 70;

    return {
      analysis,
      selectedModel,
      shouldUseEnsemble,
    };
  }

  /**
   * Execute with ensemble voting
   */
  async executeWithEnsemble(
    messages: Message[],
    models: ModelRouter[]
  ): Promise<EnsembleResult> {
    const votes: EnsembleVote[] = [];

    // Query each model in parallel
    const promises = models.map(async (modelRouter) => {
      try {
        const response = await modelRouter.provider.chat(messages);
        votes.push({
          model: modelRouter.model,
          response: response.content,
          confidence: modelRouter.performanceScore / 100,
        });
      } catch (error) {
        votes.push({
          model: modelRouter.model,
          response: '',
          confidence: 0,
        });
      }
    });

    await Promise.all(promises);

    // Calculate agreement
    const agreement = this.calculateAgreement(votes);

    // Select best response based on voting strategy
    const selectedVote = this.selectBestVote(votes, this.config.votingStrategy);

    return {
      finalResponse: selectedVote.response,
      votes,
      agreement,
      selectedModel: selectedVote.model,
    };
  }

  private calculateAgreement(votes: EnsembleVote[]): number {
    if (votes.length < 2) return 1.0;

    // Simple similarity based on response length and key phrases
    const responses = votes.map(v => v.response.toLowerCase());
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateTextSimilarity(responses[i], responses[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity on words
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private selectBestVote(votes: EnsembleVote[], strategy: string): EnsembleVote {
    switch (strategy) {
      case 'majority':
        // Return vote with highest confidence
        return votes.reduce((best, vote) => 
          vote.confidence > best.confidence ? vote : best
        );

      case 'weighted':
        // Weight by confidence and return best
        return votes.reduce((best, vote) => 
          (vote.confidence * vote.response.length) > (best.confidence * best.response.length) 
            ? vote 
            : best
        );

      case 'best-of-n':
        // Return response from highest-performing model
        return votes.reduce((best, vote) => {
          const model = this.config.models.find(m => m.model === vote.model);
          const bestModel = this.config.models.find(m => m.model === best.model);
          return model && model.performanceScore > (bestModel?.performanceScore || 0) 
            ? vote 
            : best;
        });

      default:
        return votes[0];
    }
  }

  /**
   * Update model performance based on feedback
   */
  updateModelPerformance(modelId: string, success: boolean): void {
    const currentScore = this.performanceHistory.get(modelId) || 0;
    const newScore = success ? currentScore + 1 : currentScore - 0.5;
    this.performanceHistory.set(modelId, Math.max(0, newScore));
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalRoutes: number;
    ensembleUses: number;
    averageAgreement: number;
  } {
    return {
      totalRoutes: 0, // Would track this in production
      ensembleUses: 0,
      averageAgreement: 0,
    };
  }
}

// Export convenience functions
export const taskAnalyzer = new TaskAnalyzer();
export const ensembleRouter = new EnsembleRouter();
