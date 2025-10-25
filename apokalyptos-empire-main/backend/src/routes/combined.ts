// AUTH ROUTES
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, language } = req.body;
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: fullName,
        language: language || 'en'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    const token = jwt.sign({ userId: data.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    
    res.json({ token, user: { id: data.id, email: data.email, fullName: data.full_name } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) throw new Error('Invalid credentials');
    
    const valid = await bcrypt.compare(password, data.password_hash);
    if (!valid) throw new Error('Invalid credentials');
    
    const token = jwt.sign({ userId: data.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    
    res.json({ token, user: { id: data.id, email: data.email, fullName: data.full_name } });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

export default router;

// ATOPIA ROUTES
const atopiaRouter = Router();
import { AtopiaAgent } from '../agents/Agent10_Atopia';

// Auth middleware
const authMiddleware = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('No token');
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    req.body.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

atopiaRouter.use(authMiddleware);

// Analyze story
atopiaRouter.post('/analyze-story', async (req: Request, res: Response) => {
  try {
    const agent = new AtopiaAgent(req.body.userId);
    const result = await agent.execute({
      taskId: Date.now().toString(),
      type: 'analyze_story',
      priority: 'normal',
      data: { text: req.body.text }
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Continue story
atopiaRouter.post('/continue-story', async (req: Request, res: Response) => {
  try {
    const agent = new AtopiaAgent(req.body.userId);
    const result = await agent.execute({
      taskId: Date.now().toString(),
      type: 'continue_story',
      priority: 'normal',
      data: { text: req.body.text }
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get inspiration
atopiaRouter.get('/inspiration', async (req: Request, res: Response) => {
  try {
    const agent = new AtopiaAgent(req.body.userId);
    const result = await agent.execute({
      taskId: Date.now().toString(),
      type: 'generate_inspiration',
      priority: 'normal',
      data: {}
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get style profile
atopiaRouter.get('/style-profile', async (req: Request, res: Response) => {
  try {
    const agent = new AtopiaAgent(req.body.userId);
    const summary = agent.getStyleSummary();
    
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { atopiaRouter };

// AGENTS ROUTES
const agentsRouter = Router();
import { OracleAgent } from '../agents/Agent1_Oracle';
import { ModelOptimizerAgent } from '../agents/Agent4_ModelOptimizer';

agentsRouter.use(authMiddleware);

// Get all agents status
agentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { data } = await supabase
      .from('agent_status')
      .select('*')
      .eq('user_id', req.body.userId);
    
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent communications
agentsRouter.get('/communications', async (req: Request, res: Response) => {
  try {
    const { data } = await supabase
      .from('agent_communications')
      .select('*')
      .eq('user_id', req.body.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute Oracle
agentsRouter.post('/oracle/execute', async (req: Request, res: Response) => {
  try {
    const agent = new OracleAgent(req.body.userId);
    const result = await agent.execute({
      taskId: Date.now().toString(),
      type: 'analyze_trends',
      priority: 'normal',
      data: req.body
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get daily savings from Model Optimizer
agentsRouter.get('/optimizer/savings', async (req: Request, res: Response) => {
  try {
    const agent = new ModelOptimizerAgent(req.body.userId);
    const report = await agent.getDailySavingsReport();
    
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { agentsRouter };
