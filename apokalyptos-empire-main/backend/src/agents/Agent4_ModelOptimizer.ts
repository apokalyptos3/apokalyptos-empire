import BaseAgent, { AgentTask, AgentDecision } from './BaseAgent';

interface AIModel {
  name: string;
  provider: string;
  category: 'text' | 'image' | 'video' | 'voice' | 'music';
  quality: number; // 0-10
  costPer1kTokens?: number;
  costPerSecond?: number;
  costPerImage?: number;
  freeTier?: {
    limit: number;
    used: number;
    remaining: number;
    resetsAt?: Date;
  };
  bestFor: string[];
  apiKey: string;
}

export class ModelOptimizerAgent extends BaseAgent {
  private models: Map<string, AIModel>;
  private usageTracking: Map<string, number>;

  constructor(userId: string) {
    super({
      agentId: 4,
      agentName: 'ModelOptimizer',
      userId
    });

    this.usageTracking = new Map();
    this.models = new Map();
    this.initializeModels();
  }

  private initializeModels() {
    // Text Generation Models
    this.models.set('claude-opus-4', {
      name: 'Claude Opus 4',
      provider: 'Anthropic',
      category: 'text',
      quality: 10,
      costPer1kTokens: 0.015,
      freeTier: undefined,
      bestFor: ['complex_reasoning', 'code', 'analysis', 'atopia'],
      apiKey: process.env.CLAUDE_API_KEY || ''
    });

    this.models.set('claude-sonnet-4', {
      name: 'Claude Sonnet 4',
      provider: 'Anthropic',
      category: 'text',
      quality: 9.5,
      costPer1kTokens: 0.003,
      freeTier: undefined,
      bestFor: ['scripts', 'content', 'general'],
      apiKey: process.env.CLAUDE_API_KEY || ''
    });

    this.models.set('gpt-4o', {
      name: 'GPT-4o',
      provider: 'OpenAI',
      category: 'text',
      quality: 9,
      costPer1kTokens: 0.0025,
      freeTier: undefined,
      bestFor: ['chat', 'creative', 'analysis'],
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    this.models.set('gpt-4o-mini', {
      name: 'GPT-4o Mini',
      provider: 'OpenAI',
      category: 'text',
      quality: 7.5,
      costPer1kTokens: 0.00015,
      freeTier: undefined,
      bestFor: ['simple_tasks', 'scripts', 'summaries'],
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    this.models.set('gemini-pro', {
      name: 'Gemini Pro',
      provider: 'Google',
      category: 'text',
      quality: 8,
      costPer1kTokens: 0,
      freeTier: {
        limit: 1000000,
        used: 0,
        remaining: 1000000
      },
      bestFor: ['research', 'simple_tasks', 'free_option'],
      apiKey: process.env.GOOGLE_API_KEY || ''
    });

    // Video Generation Models
    this.models.set('sora-2', {
      name: 'Sora 2',
      provider: 'OpenAI',
      category: 'video',
      quality: 9.5,
      costPerSecond: 0,
      freeTier: {
        limit: 50,
        used: 0,
        remaining: 50
      },
      bestFor: ['cinematic', 'short_form', 'high_quality'],
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    this.models.set('runway-gen3', {
      name: 'Runway Gen-3',
      provider: 'Runway',
      category: 'video',
      quality: 8.5,
      costPerSecond: 0.05,
      freeTier: undefined,
      bestFor: ['professional', 'editing', 'effects'],
      apiKey: process.env.RUNWAY_API_KEY || ''
    });

    this.models.set('kling-ai', {
      name: 'Kling AI',
      provider: 'Kling',
      category: 'video',
      quality: 9,
      costPerSecond: 0,
      freeTier: {
        limit: 50,
        used: 0,
        remaining: 50
      },
      bestFor: ['cinematic', 'high_quality', 'free_option'],
      apiKey: process.env.KLING_API_KEY || ''
    });

    // Image Generation Models
    this.models.set('dall-e-3', {
      name: 'DALL-E 3',
      provider: 'OpenAI',
      category: 'image',
      quality: 9,
      costPerImage: 0.04,
      freeTier: undefined,
      bestFor: ['detailed', 'realistic', 'complex'],
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    this.models.set('ideogram', {
      name: 'Ideogram',
      provider: 'Ideogram',
      category: 'image',
      quality: 8.5,
      costPerImage: 0,
      freeTier: {
        limit: 100,
        used: 0,
        remaining: 100
      },
      bestFor: ['text_in_images', 'free_option', 'quick'],
      apiKey: process.env.IDEOGRAM_API_KEY || ''
    });

    this.models.set('grok-image', {
      name: 'Grok Image Gen',
      provider: 'xAI',
      category: 'image',
      quality: 8,
      costPerImage: 0,
      freeTier: {
        limit: 1000,
        used: 0,
        remaining: 1000
      },
      bestFor: ['free_option', 'fast', 'x_premium'],
      apiKey: process.env.GROK_API_KEY || ''
    });

    // Voice Generation
    this.models.set('elevenlabs', {
      name: 'ElevenLabs',
      provider: 'ElevenLabs',
      category: 'voice',
      quality: 9.5,
      costPerSecond: 0.003,
      freeTier: {
        limit: 10000,
        used: 0,
        remaining: 10000
      },
      bestFor: ['natural', 'multilingual', 'high_quality'],
      apiKey: process.env.ELEVENLABS_API_KEY || ''
    });
  }

  async execute(task: AgentTask): Promise<any> {
    await this.updateStatus('working', 'Optimizing model selection', 10);

    try {
      const bestModel = await this.chooseOptimalModel(task.data);
      
      await this.updateStatus('working', 'Calculating cost savings', 50);
      const savings = await this.calculateSavings(bestModel, task.data);

      await this.updateStatus('idle');

      return {
        selectedModel: bestModel,
        savings: savings,
        reasoning: this.explainDecision(bestModel, task.data)
      };
    } catch (error: any) {
      await this.handleError(error, 'execute');
      throw error;
    }
  }

  async analyze(data: any): Promise<AgentDecision> {
    const model = await this.chooseOptimalModel(data);
    
    return {
      decision: `use_${model.name}`,
      reasoning: this.explainDecision(model, data),
      confidence: 0.95,
      cost: this.estimateCost(model, data),
      alternatives: await this.getAlternatives(model, data)
    };
  }

  // Main decision-making function
  async chooseOptimalModel(task: any): Promise<AIModel> {
    const {
      type, // 'text', 'image', 'video', 'voice'
      quality_required = 7, // 0-10
      priority = 'normal', // 'low', 'normal', 'high', 'critical'
      use_case = 'general',
      budget_available = 1000
    } = task;

    // Get models for this category
    const availableModels = Array.from(this.models.values())
      .filter(m => m.category === type);

    // Filter by minimum quality
    const qualityFiltered = availableModels
      .filter(m => m.quality >= quality_required);

    if (qualityFiltered.length === 0) {
      throw new Error(`No models meet quality requirement of ${quality_required}`);
    }

    // Update free tier usage from database
    await this.updateFreeTierUsage();

    // Check for free tier options first
    const freeTierAvailable = qualityFiltered.filter(m => {
      return m.freeTier && m.freeTier.remaining > 0;
    });

    if (freeTierAvailable.length > 0) {
      // Use highest quality free option
      const bestFree = freeTierAvailable.sort((a, b) => b.quality - a.quality)[0];
      
      await this.communicate(
        [8], // Notify Agent 8 (Tycoon)
        `Using ${bestFree.name} (free tier) - saving ${this.estimateCost(qualityFiltered[0], task)} USD`
      );

      return bestFree;
    }

    // If critical priority, use best model regardless of cost
    if (priority === 'critical') {
      const bestModel = qualityFiltered.sort((a, b) => b.quality - a.quality)[0];
      
      await this.communicate(
        [8],
        `Critical task - using best model: ${bestModel.name}`
      );

      return bestModel;
    }

    // For owner's creative work, prioritize quality
    if (task.is_owner_creative_work) {
      const topQuality = qualityFiltered
        .filter(m => m.quality >= 9)
        .sort((a, b) => b.quality - a.quality)[0];
      
      if (topQuality) {
        await this.communicate(
          [8],
          `Owner's creative work - using premium: ${topQuality.name}`
        );

        return topQuality;
      }
    }

    // Optimize for cost/quality ratio
    const costEffective = qualityFiltered
      .map(m => ({
        model: m,
        ratio: m.quality / this.estimateCost(m, task)
      }))
      .sort((a, b) => b.ratio - a.ratio)[0];

    if (costEffective) {
      const savings = this.estimateCost(qualityFiltered[0], task) - 
                     this.estimateCost(costEffective.model, task);
      
      if (savings > 0) {
        await this.communicate(
          [8],
          `Optimized selection: ${costEffective.model.name} saves $${savings.toFixed(2)}`
        );
      }

      return costEffective.model;
    }

    // Fallback to highest quality
    return qualityFiltered.sort((a, b) => b.quality - a.quality)[0];
  }

  private estimateCost(model: AIModel, task: any): number {
    if (model.freeTier && model.freeTier.remaining > 0) {
      return 0;
    }

    switch (model.category) {
      case 'text':
        const tokens = task.estimated_tokens || 1000;
        return ((tokens / 1000) * (model.costPer1kTokens || 0));
      
      case 'video':
        const seconds = task.duration_seconds || 60;
        return (seconds * (model.costPerSecond || 0));
      
      case 'image':
        const images = task.image_count || 1;
        return (images * (model.costPerImage || 0));
      
      case 'voice':
        const voiceSeconds = task.duration_seconds || 60;
        return (voiceSeconds * (model.costPerSecond || 0));
      
      default:
        return 0;
    }
  }

  private explainDecision(model: AIModel, task: any): string {
    const cost = this.estimateCost(model, task);
    const isFree = model.freeTier && model.freeTier.remaining > 0;

    let reasoning = `Selected ${model.name} (quality: ${model.quality}/10)`;
    
    if (isFree) {
      reasoning += ` - FREE TIER available (${model.freeTier!.remaining} remaining)`;
    } else {
      reasoning += ` - Estimated cost: $${cost.toFixed(4)}`;
    }

    reasoning += `. Best for: ${model.bestFor.join(', ')}`;

    return reasoning;
  }

  private async calculateSavings(selectedModel: AIModel, task: any): Promise<number> {
    // Compare to most expensive option
    const allModels = Array.from(this.models.values())
      .filter(m => m.category === selectedModel.category);
    
    const mostExpensive = allModels
      .sort((a, b) => this.estimateCost(b, task) - this.estimateCost(a, task))[0];

    const maxCost = this.estimateCost(mostExpensive, task);
    const actualCost = this.estimateCost(selectedModel, task);

    return Math.max(0, maxCost - actualCost);
  }

  private async getAlternatives(model: AIModel, task: any): Promise<any[]> {
    const alternatives = Array.from(this.models.values())
      .filter(m => m.category === model.category && m.name !== model.name)
      .slice(0, 3)
      .map(m => ({
        name: m.name,
        quality: m.quality,
        cost: this.estimateCost(m, task),
        freeTier: m.freeTier?.remaining || 0
      }));

    return alternatives;
  }

  private async updateFreeTierUsage(): Promise<void> {
    // Update usage from database tracking
    const { data: transactions } = await this.supabase
      .from('budget_transactions')
      .select('service_name, was_free_tier')
      .eq('user_id', this.userId)
      .eq('was_free_tier', true)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (transactions) {
      // Count usage per service
      const usage = new Map<string, number>();
      transactions.forEach((t: any) => {
        usage.set(t.service_name, (usage.get(t.service_name) || 0) + 1);
      });

      // Update models
      this.models.forEach((model, key) => {
        if (model.freeTier) {
          const used = usage.get(model.name) || 0;
          model.freeTier.used = used;
          model.freeTier.remaining = Math.max(0, model.freeTier.limit - used);
        }
      });
    }
  }

  // Get report of today's savings
  async getDailySavingsReport(): Promise<any> {
    const { data: transactions } = await this.supabase
      .from('budget_transactions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('agent_id', 4)
      .gte('created_at', new Date().toISOString().split('T')[0]);

    const totalSaved = transactions?.reduce((sum: number, t: any) => {
      return sum + (t.was_free_tier ? t.alternatives_considered?.max_cost || 0 : 0);
    }, 0) || 0;

    return {
      date: new Date().toISOString().split('T')[0],
      totalSaved: totalSaved,
      freeToolsUsed: transactions?.filter((t: any) => t.was_free_tier).length || 0,
      optimizationsMade: transactions?.length || 0
    };
  }
}

export default ModelOptimizerAgent;
