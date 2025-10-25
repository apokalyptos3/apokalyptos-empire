import { createClient } from '@supabase/supabase-js';
import winston from 'winston';

// Base Agent Interface
export interface AgentConfig {
  agentId: number;
  agentName: string;
  userId: string;
}

export interface AgentTask {
  taskId: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  data: any;
}

export interface AgentDecision {
  decision: string;
  reasoning: string;
  confidence: number;
  alternatives?: any[];
  cost?: number;
}

// Base Agent Class
export abstract class BaseAgent {
  protected agentId: number;
  protected agentName: string;
  protected userId: string;
  protected supabase: any;
  protected logger: winston.Logger;
  protected status: 'idle' | 'working' | 'thinking' | 'error';
  protected currentTask: string | null;

  constructor(config: AgentConfig) {
    this.agentId = config.agentId;
    this.agentName = config.agentName;
    this.userId = config.userId;
    
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { 
        agentId: this.agentId, 
        agentName: this.agentName,
        userId: this.userId 
      },
      transports: [
        new winston.transports.File({ 
          filename: `logs/agent-${this.agentId}-error.log`, 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: `logs/agent-${this.agentId}.log` 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.status = 'idle';
    this.currentTask = null;
  }

  // Abstract methods that each agent must implement
  abstract execute(task: AgentTask): Promise<any>;
  abstract analyze(data: any): Promise<AgentDecision>;

  // Update agent status in database
  async updateStatus(status: string, task?: string, progress?: number): Promise<void> {
    this.status = status as any;
    this.currentTask = task || null;

    try {
      await this.supabase
        .from('agent_status')
        .upsert({
          user_id: this.userId,
          agent_id: this.agentId,
          agent_name: this.agentName,
          status: status,
          current_task: task || null,
          progress: progress || 0,
          last_activity: new Date().toISOString()
        }, {
          onConflict: 'user_id,agent_id'
        });
    } catch (error) {
      this.logger.error('Failed to update status', { error });
    }
  }

  // Save learning from this task
  async saveLearning(
    learningType: string, 
    learningData: any, 
    confidence: number
  ): Promise<void> {
    try {
      await this.supabase
        .from('agent_learnings')
        .insert({
          user_id: this.userId,
          agent_id: this.agentId,
          agent_name: this.agentName,
          learning_type: learningType,
          learning_data: learningData,
          confidence_score: confidence
        });

      this.logger.info('Learning saved', { learningType, confidence });
    } catch (error) {
      this.logger.error('Failed to save learning', { error });
    }
  }

  // Get previous learnings for this type of task
  async getLearnings(learningType?: string): Promise<any[]> {
    try {
      let query = this.supabase
        .from('agent_learnings')
        .select('*')
        .eq('user_id', this.userId)
        .eq('agent_id', this.agentId)
        .order('confidence_score', { ascending: false });

      if (learningType) {
        query = query.eq('learning_type', learningType);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get learnings', { error });
      return [];
    }
  }

  // Communicate with other agents
  async communicate(
    participants: number[], 
    message: string, 
    decisions?: any
  ): Promise<void> {
    try {
      await this.supabase
        .from('agent_communications')
        .insert({
          user_id: this.userId,
          communication_type: 'discussion',
          participants: participants,
          conversation: message,
          decisions_made: decisions || {}
        });

      this.logger.info('Communication logged', { participants, message });
    } catch (error) {
      this.logger.error('Failed to log communication', { error });
    }
  }

  // Track costs
  async trackCost(
    contentId: string | null,
    service: string,
    amount: number,
    reasoning: string,
    wasFreeTier: boolean = false
  ): Promise<void> {
    try {
      await this.supabase
        .from('budget_transactions')
        .insert({
          user_id: this.userId,
          content_id: contentId,
          transaction_type: this.getTransactionType(service),
          service_name: service,
          amount: amount,
          agent_id: this.agentId,
          decision_reasoning: reasoning,
          was_free_tier: wasFreeTier
        });

      this.logger.info('Cost tracked', { service, amount, wasFreeTier });
    } catch (error) {
      this.logger.error('Failed to track cost', { error });
    }
  }

  private getTransactionType(service: string): string {
    if (service.includes('claude') || service.includes('gpt') || service.includes('gemini')) {
      return 'ai_call';
    } else if (service.includes('sora') || service.includes('runway') || service.includes('kling')) {
      return 'video_gen';
    } else if (service.includes('elevenlabs')) {
      return 'voice_gen';
    } else if (service.includes('dall-e') || service.includes('midjourney')) {
      return 'image_gen';
    }
    return 'other';
  }

  // Get user's budget
  async getBudget(): Promise<{ available: number; monthly: number; spent: number }> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('monthly_budget, current_month_spent')
        .eq('id', this.userId)
        .single();

      if (error) throw error;

      return {
        available: data.monthly_budget - data.current_month_spent,
        monthly: data.monthly_budget,
        spent: data.current_month_spent
      };
    } catch (error) {
      this.logger.error('Failed to get budget', { error });
      return { available: 0, monthly: 0, spent: 0 };
    }
  }

  // Check if budget allows this expense
  async checkBudget(amount: number): Promise<boolean> {
    const budget = await this.getBudget();
    return budget.available >= amount;
  }

  // Error handling
  protected async handleError(error: any, context: string): Promise<void> {
    this.logger.error(`Error in ${context}`, { 
      error: error.message, 
      stack: error.stack 
    });
    
    await this.updateStatus('error', `Error: ${context}`);
    
    // Could send notification to user here
  }

  // Success logging
  protected logSuccess(message: string, data?: any): void {
    this.logger.info(message, data);
  }
}

export default BaseAgent;
