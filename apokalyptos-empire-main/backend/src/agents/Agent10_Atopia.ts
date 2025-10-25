import BaseAgent, { AgentTask, AgentDecision } from './BaseAgent';
import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';

interface StyleProfile {
  storiesAnalyzed: number;
  confidenceLevel: number;
  writingStyle: {
    tone: string;
    pace: string;
    vocabularyLevel: string;
    avgSentenceLength: number;
    themes: string[];
  };
  examplePhrases: string[];
  preferredThemes: string[];
  vocabularyProfile: any;
}

interface StoryAnalysis {
  tone: string;
  themes: string[];
  vocabulary: string[];
  sentenceStructure: any;
  characteristicPhrases: string[];
  pacing: string;
}

export class AtopiaAgent extends BaseAgent {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private styleProfile: StyleProfile | null = null;

  constructor(userId: string) {
    super({
      agentId: 10,
      agentName: 'ATOPIA',
      userId
    });

    this.anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.loadStyleProfile();
  }

  async execute(task: AgentTask): Promise<any> {
    await this.updateStatus('working', 'Processing your request', 10);

    try {
      switch (task.type) {
        case 'analyze_story':
          return await this.analyzeStory(task.data.text);
        
        case 'continue_story':
          return await this.continueStory(task.data.text);
        
        case 'generate_inspiration':
          return await this.generateInspiration();
        
        case 'assist_writing':
          return await this.assistWriting(task.data.context, task.data.request);
        
        case 'philosophical_discussion':
          return await this.philosophicalDiscussion(task.data.topic, task.data.message);
        
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error: any) {
      await this.handleError(error, 'execute');
      throw error;
    }
  }

  async analyze(data: any): Promise<AgentDecision> {
    const analysis = await this.analyzeStory(data.text);
    
    return {
      decision: 'story_analyzed',
      reasoning: `Analyzed story: ${analysis.tone} tone, themes: ${analysis.themes.join(', ')}`,
      confidence: this.styleProfile?.confidenceLevel || 0
    };
  }

  // Analyze a story to learn the user's style
  private async analyzeStory(text: string): Promise<StoryAnalysis> {
    await this.updateStatus('thinking', 'Analyzing your writing style', 30);

    const prompt = `Analyze this story in detail. Provide:
1. Overall tone (mysterious, dramatic, philosophical, etc.)
2. Main themes (quantum mechanics, consciousness, reality, etc.)
3. Unique vocabulary choices (10 characteristic words)
4. Sentence structure patterns
5. Characteristic phrases (5 phrases that define the style)
6. Pacing (slow/deliberate, fast/energetic, varied)

Story:
${text}

Respond in JSON format.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const content = response.content[0];
    const analysisText = content.type === 'text' ? content.text : '';
    const analysis = this.parseAnalysis(analysisText);

    // Update style profile
    await this.updateStyleProfile(analysis);

    await this.updateStatus('idle');

    return analysis;
  }

  private parseAnalysis(text: string): StoryAnalysis {
    try {
      // Try to parse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback parsing
    }

    // Fallback: extract from text
    return {
      tone: this.extractValue(text, 'tone') || 'neutral',
      themes: this.extractArray(text, 'themes') || [],
      vocabulary: this.extractArray(text, 'vocabulary') || [],
      sentenceStructure: {},
      characteristicPhrases: this.extractArray(text, 'phrases') || [],
      pacing: this.extractValue(text, 'pacing') || 'moderate'
    };
  }

  // Update user's style profile
  private async updateStyleProfile(analysis: StoryAnalysis): Promise<void> {
    let profile = this.styleProfile;

    if (!profile) {
      // Create new profile
      profile = {
        storiesAnalyzed: 0,
        confidenceLevel: 0,
        writingStyle: {
          tone: analysis.tone,
          pace: analysis.pacing,
          vocabularyLevel: 'intermediate',
          avgSentenceLength: 20,
          themes: analysis.themes
        },
        examplePhrases: analysis.characteristicPhrases,
        preferredThemes: analysis.themes,
        vocabularyProfile: {}
      };
    }

    // Update with new analysis
    profile.storiesAnalyzed += 1;
    profile.confidenceLevel = Math.min(100, profile.storiesAnalyzed * 15);
    profile.writingStyle.themes = [
      ...new Set([...profile.writingStyle.themes, ...analysis.themes])
    ].slice(0, 10);
    profile.examplePhrases = [
      ...new Set([...profile.examplePhrases, ...analysis.characteristicPhrases])
    ].slice(0, 20);

    // Save to database
    await this.supabase
      .from('style_profiles')
      .upsert({
        user_id: this.userId,
        stories_analyzed: profile.storiesAnalyzed,
        confidence_level: profile.confidenceLevel,
        writing_style: profile.writingStyle,
        example_phrases: profile.examplePhrases,
        preferred_themes: profile.preferredThemes,
        vocabulary_profile: profile.vocabularyProfile,
        last_analysis: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    this.styleProfile = profile;

    this.logger.info('Style profile updated', {
      storiesAnalyzed: profile.storiesAnalyzed,
      confidence: profile.confidenceLevel
    });
  }

  // Load existing style profile
  private async loadStyleProfile(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('style_profiles')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (data && !error) {
        this.styleProfile = {
          storiesAnalyzed: data.stories_analyzed,
          confidenceLevel: data.confidence_level,
          writingStyle: data.writing_style,
          examplePhrases: data.example_phrases || [],
          preferredThemes: data.preferred_themes || [],
          vocabularyProfile: data.vocabulary_profile || {}
        };

        this.logger.info('Style profile loaded', {
          confidence: this.styleProfile.confidenceLevel
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to load style profile', { error });
    }
  }

  // Continue a story in the user's style
  private async continueStory(existingText: string): Promise<string> {
    await this.updateStatus('working', 'Continuing your story', 50);

    if (!this.styleProfile || this.styleProfile.confidenceLevel < 30) {
      // Not enough data - use general continuation
      return await this.genericContinuation(existingText);
    }

    // Use style-aware continuation
    const prompt = this.buildStyleAwarePrompt(
      `Continue this story in the exact same style as the author. The author's style is:
- Tone: ${this.styleProfile.writingStyle.tone}
- Pacing: ${this.styleProfile.writingStyle.pace}
- Themes: ${this.styleProfile.writingStyle.themes.join(', ')}
- Characteristic phrases to use naturally: ${this.styleProfile.examplePhrases.slice(0, 5).join('; ')}

Continue this story (write 2-3 paragraphs):
${existingText}

Write as if YOU are the original author. Match their voice exactly.`
    );

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const continuation = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    await this.updateStatus('idle');

    return continuation;
  }

  // Generate inspiration in user's style
  private async generateInspiration(): Promise<string> {
    await this.updateStatus('working', 'Generating inspiration', 40);

    if (!this.styleProfile || this.styleProfile.storiesAnalyzed < 1) {
      return await this.genericInspiration();
    }

    const prompt = `Generate a story opening (3-4 sentences) that:
- Uses themes: ${this.styleProfile.writingStyle.themes.join(', ')}
- Matches tone: ${this.styleProfile.writingStyle.tone}
- Has a mysterious hook that makes readers want more
- Feels like it was written by the original author

Style characteristics to match:
${this.styleProfile.examplePhrases.slice(0, 3).join('\n')}

Write ONLY the story opening, nothing else.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const inspiration = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Save as inspiration
    await this.supabase
      .from('atopia_inspirations')
      .insert({
        user_id: this.userId,
        inspiration_text: inspiration,
        style_match_score: this.styleProfile.confidenceLevel,
        themes: this.styleProfile.writingStyle.themes
      });

    await this.updateStatus('idle');

    return inspiration;
  }

  // Real-time writing assistance
  private async assistWriting(context: string, request: string): Promise<string> {
    await this.updateStatus('thinking', 'Assisting your writing', 30);

    const prompt = this.styleProfile && this.styleProfile.confidenceLevel > 50
      ? this.buildStyleAwarePrompt(
          `The author is writing and needs help. Their writing style:
- ${this.styleProfile.writingStyle.tone} tone
- Themes: ${this.styleProfile.writingStyle.themes.join(', ')}

Current context:
${context}

They asked: "${request}"

Provide a brief, helpful suggestion that matches their style.`
        )
      : `Context: ${context}\n\nRequest: ${request}\n\nProvide a brief, helpful writing suggestion.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const suggestion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    await this.updateStatus('idle');

    return suggestion;
  }

  // Philosophical discussion
  private async philosophicalDiscussion(topic: string, userMessage: string): Promise<string> {
    await this.updateStatus('thinking', 'Contemplating deeply', 40);

    const systemPrompt = `You are ATOPIA, a philosopher with deep expertise in:
- Quantum mechanics and its philosophical implications
- The nature of reality and perception
- Consciousness and existence
- Metaphysics and ontology
- The intersection of science and philosophy

Engage in thoughtful, deep discussion. Reference relevant theories and thinkers when appropriate. Help explore ideas that could inspire stories.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Topic: ${topic}\n\n${userMessage}`
      }]
    });

    const discussion = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    await this.updateStatus('idle');

    return discussion;
  }

  // Helper functions
  private buildStyleAwarePrompt(basePrompt: string): string {
    if (!this.styleProfile) return basePrompt;

    return `${basePrompt}

IMPORTANT STYLE REQUIREMENTS:
- Confidence in style: ${this.styleProfile.confidenceLevel}%
- Must match: ${this.styleProfile.writingStyle.tone} tone
- Must incorporate themes: ${this.styleProfile.writingStyle.themes.slice(0, 3).join(', ')}
- Sentence pacing: ${this.styleProfile.writingStyle.pace}`;
  }

  private async genericContinuation(text: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Continue this story naturally (2-3 paragraphs):\n\n${text}`
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async genericInspiration(): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: 'Write a mysterious story opening (3-4 sentences) that hooks the reader.'
      }]
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private extractValue(text: string, key: string): string | null {
    const patterns = [
      new RegExp(`${key}[:\\s]+([^\\n]+)`, 'i'),
      new RegExp(`"${key}"[:\\s]+"([^"]+)"`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  private extractArray(text: string, key: string): string[] {
    const value = this.extractValue(text, key);
    if (!value) return [];
    
    return value
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // Get style confidence level
  getStyleConfidence(): number {
    return this.styleProfile?.confidenceLevel || 0;
  }

  // Get style profile summary
  getStyleSummary(): any {
    if (!this.styleProfile) {
      return {
        ready: false,
        message: 'Upload stories to help me learn your style'
      };
    }

    return {
      ready: this.styleProfile.confidenceLevel >= 50,
      confidence: this.styleProfile.confidenceLevel,
      storiesAnalyzed: this.styleProfile.storiesAnalyzed,
      tone: this.styleProfile.writingStyle.tone,
      themes: this.styleProfile.writingStyle.themes,
      message: this.styleProfile.confidenceLevel >= 50
        ? `I understand your style with ${this.styleProfile.confidenceLevel}% confidence!`
        : `Learning your style... ${this.styleProfile.storiesAnalyzed} stories analyzed. Upload more to improve!`
    };
  }
}

export default AtopiaAgent;
