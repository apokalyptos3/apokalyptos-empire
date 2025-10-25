import BaseAgent, { AgentTask, AgentDecision } from './BaseAgent';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface TrendingTopic {
  topic: string;
  trendScore: number;
  estimatedLifespan: string;
  competitionLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  suggestedAngle: string;
  sources: string[];
}

interface AlgorithmChange {
  platform: string;
  changeDetected: string;
  confidence: number;
  recommendation: string;
  detectedAt: Date;
}

export class OracleAgent extends BaseAgent {
  private platformAPIs: Map<string, string>;

  constructor(userId: string) {
    super({
      agentId: 1,
      agentName: 'Oracle',
      userId
    });

    this.platformAPIs = new Map([
      ['youtube', process.env.YOUTUBE_API_KEY || ''],
      ['google_trends', process.env.GOOGLE_API_KEY || ''],
      ['reddit', process.env.REDDIT_API_KEY || '']
    ]);
  }

  async execute(task: AgentTask): Promise<any> {
    await this.updateStatus('working', 'Analyzing trends', 10);

    try {
      const trendReport = await this.generateTrendReport(task.data.platform);
      
      await this.updateStatus('working', 'Detecting algorithm changes', 70);
      const algorithmChanges = await this.detectAlgorithmChanges(task.data.platform);

      await this.saveLearning('trend_prediction', {
        trends: trendReport,
        timestamp: new Date()
      }, 85);

      await this.updateStatus('idle');

      return {
        trendReport,
        algorithmChanges,
        generatedAt: new Date()
      };
    } catch (error: any) {
      await this.handleError(error, 'execute');
      throw error;
    }
  }

  async analyze(data: any): Promise<AgentDecision> {
    // Analyze if a topic is worth creating content about
    const trends = await this.getTrendingTopics(data.platform, data.category);
    
    const matchingTrend = trends.find(t => 
      t.topic.toLowerCase().includes(data.keyword.toLowerCase())
    );

    if (matchingTrend) {
      return {
        decision: 'create_content',
        reasoning: `Topic "${matchingTrend.topic}" is trending with score ${matchingTrend.trendScore}. ${matchingTrend.recommendation}`,
        confidence: matchingTrend.trendScore / 10,
        alternatives: trends.slice(0, 3).map(t => ({
          topic: t.topic,
          score: t.trendScore
        }))
      };
    }

    return {
      decision: 'wait',
      reasoning: 'Topic not currently trending. Consider waiting or pivoting.',
      confidence: 0.3,
      alternatives: trends.slice(0, 3)
    };
  }

  // Get trending topics from YouTube
  private async getYouTubeTrending(): Promise<TrendingTopic[]> {
    try {
      const apiKey = this.platformAPIs.get('youtube');
      if (!apiKey) {
        this.logger.warn('YouTube API key not configured');
        return [];
      }

      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            part: 'snippet,statistics',
            chart: 'mostPopular',
            regionCode: 'US',
            maxResults: 50,
            key: apiKey
          }
        }
      );

      const topics: TrendingTopic[] = response.data.items.map((video: any) => {
        const views = parseInt(video.statistics.viewCount);
        const likes = parseInt(video.statistics.likeCount);
        const engagement = (likes / views) * 100;

        return {
          topic: video.snippet.title,
          trendScore: this.calculateTrendScore(views, engagement),
          estimatedLifespan: this.estimateLifespan(video.snippet.publishedAt),
          competitionLevel: this.assessCompetition(views),
          recommendation: this.generateRecommendation(views, engagement),
          suggestedAngle: this.suggestAngle(video.snippet.title),
          sources: ['YouTube Trending']
        };
      });

      return topics.sort((a, b) => b.trendScore - a.trendScore).slice(0, 10);
    } catch (error: any) {
      this.logger.error('Failed to get YouTube trending', { error: error.message });
      return [];
    }
  }

  // Get trending topics from Google Trends
  private async getGoogleTrends(): Promise<TrendingTopic[]> {
    try {
      // Note: Google Trends doesn't have official API
      // This is a simplified version - in production, use google-trends-api package
      const response = await axios.get('https://trends.google.com/trends/trendingsearches/daily/rss');
      const $ = cheerio.load(response.data, { xmlMode: true });
      
      const topics: TrendingTopic[] = [];
      
      $('item').each((_, elem) => {
        const title = $(elem).find('title').text();
        const traffic = $(elem).find('ht\\:approx_traffic').text();
        
        topics.push({
          topic: title,
          trendScore: this.parseTraffic(traffic) / 100000,
          estimatedLifespan: '3-7 days',
          competitionLevel: 'medium',
          recommendation: 'Create content within 24 hours',
          suggestedAngle: 'Explain the trend simply',
          sources: ['Google Trends']
        });
      });

      return topics.slice(0, 10);
    } catch (error: any) {
      this.logger.error('Failed to get Google Trends', { error: error.message });
      return [];
    }
  }

  // Get trending from Reddit
  private async getRedditTrending(): Promise<TrendingTopic[]> {
    try {
      const response = await axios.get('https://www.reddit.com/r/all/hot.json?limit=50');
      
      const topics: TrendingTopic[] = response.data.data.children.map((post: any) => {
        const data = post.data;
        return {
          topic: data.title,
          trendScore: this.calculateRedditScore(data.score, data.num_comments),
          estimatedLifespan: this.estimateRedditLifespan(data.created_utc),
          competitionLevel: data.num_comments > 1000 ? 'high' : 'medium',
          recommendation: data.num_comments > 500 ? 'High engagement - create now' : 'Monitor',
          suggestedAngle: `Reddit perspective: ${data.subreddit}`,
          sources: [`r/${data.subreddit}`]
        };
      });

      return topics.sort((a, b) => b.trendScore - a.trendScore).slice(0, 10);
    } catch (error: any) {
      this.logger.error('Failed to get Reddit trending', { error: error.message });
      return [];
    }
  }

  // Generate comprehensive trend report
  private async generateTrendReport(platform: string): Promise<TrendingTopic[]> {
    const allTrends: TrendingTopic[] = [];

    // Gather from all sources
    const [youtube, google, reddit] = await Promise.all([
      this.getYouTubeTrending(),
      this.getGoogleTrends(),
      this.getRedditTrending()
    ]);

    allTrends.push(...youtube, ...google, ...reddit);

    // Deduplicate and merge similar topics
    const merged = this.mergeSimilarTopics(allTrends);

    // Sort by trend score
    const sorted = merged.sort((a, b) => b.trendScore - a.trendScore);

    // Learn from these trends
    await this.saveLearning('trending_topics', {
      topics: sorted.slice(0, 5),
      platform,
      timestamp: new Date()
    }, 80);

    return sorted.slice(0, 20);
  }

  // Detect algorithm changes
  private async detectAlgorithmChanges(platform: string): Promise<AlgorithmChange[]> {
    const changes: AlgorithmChange[] = [];

    // Get historical performance data
    const { data: recentContent } = await this.supabase
      .from('content')
      .select('views, engagement_rate, published_at')
      .eq('user_id', this.userId)
      .gte('published_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: false });

    if (recentContent && recentContent.length > 5) {
      // Analyze trends in performance
      const recentAvgEngagement = this.calculateAverage(
        recentContent.slice(0, 5).map((c: any) => c.engagement_rate)
      );
      const olderAvgEngagement = this.calculateAverage(
        recentContent.slice(5, 10).map((c: any) => c.engagement_rate)
      );

      if (recentAvgEngagement < olderAvgEngagement * 0.7) {
        changes.push({
          platform,
          changeDetected: 'Engagement rate dropped significantly - possible algorithm change',
          confidence: 0.75,
          recommendation: 'Analyze top performers and adjust content strategy',
          detectedAt: new Date()
        });
      }

      // Check for watch time prioritization
      const avgViews = this.calculateAverage(
        recentContent.slice(0, 5).map((c: any) => c.views)
      );
      
      if (platform === 'youtube' && avgViews < 1000) {
        changes.push({
          platform,
          changeDetected: 'Low view counts suggest algorithm not favoring content',
          confidence: 0.65,
          recommendation: 'Focus on longer videos (12+ minutes) and improve thumbnails',
          detectedAt: new Date()
        });
      }
    }

    return changes;
  }

  // Helper functions
  private calculateTrendScore(views: number, engagement: number): number {
    return Math.min(10, (Math.log10(views) * engagement) / 10);
  }

  private assessCompetition(views: number): 'low' | 'medium' | 'high' {
    if (views > 10000000) return 'high';
    if (views > 1000000) return 'medium';
    return 'low';
  }

  private estimateLifespan(publishedAt: string): string {
    const hoursAgo = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) return '7-10 days';
    if (hoursAgo < 72) return '3-5 days';
    return '1-2 days';
  }

  private generateRecommendation(views: number, engagement: number): string {
    if (engagement > 5 && views > 1000000) {
      return 'Create content NOW - high engagement and visibility';
    }
    if (views > 5000000) {
      return 'Popular topic - add unique angle to stand out';
    }
    return 'Monitor - wait for clearer trend';
  }

  private suggestAngle(title: string): string {
    if (title.toLowerCase().includes('explained')) {
      return 'Deeper analysis with visual explanations';
    }
    if (title.toLowerCase().includes('react')) {
      return 'Expert commentary and predictions';
    }
    return 'Simplified explanation with storytelling';
  }

  private parseTraffic(traffic: string): number {
    const match = traffic.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, '')) : 0;
  }

  private calculateRedditScore(score: number, comments: number): number {
    return Math.min(10, (Math.log10(score + comments)) / 0.5);
  }

  private estimateRedditLifespan(createdUtc: number): string {
    const hoursAgo = (Date.now() / 1000 - createdUtc) / 3600;
    if (hoursAgo < 6) return '12-24 hours';
    if (hoursAgo < 12) return '6-12 hours';
    return '2-6 hours';
  }

  private mergeSimilarTopics(topics: TrendingTopic[]): TrendingTopic[] {
    // Simple merge - in production, use better similarity detection
    const merged: TrendingTopic[] = [];
    const seen = new Set<string>();

    for (const topic of topics) {
      const key = topic.topic.toLowerCase().slice(0, 20);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(topic);
      } else {
        // Merge sources
        const existing = merged.find(t => 
          t.topic.toLowerCase().slice(0, 20) === key
        );
        if (existing) {
          existing.sources.push(...topic.sources);
          existing.trendScore = Math.max(existing.trendScore, topic.trendScore);
        }
      }
    }

    return merged;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private async getTrendingTopics(platform: string, category?: string): Promise<TrendingTopic[]> {
    return await this.generateTrendReport(platform);
  }
}

export default OracleAgent;
