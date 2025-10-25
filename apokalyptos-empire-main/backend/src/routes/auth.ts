import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, language } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert({ email, password_hash: passwordHash, full_name: fullName, language: language || 'en' })
      .select()
      .single();
    
    if (error) throw error;
    
    const token = jwt.sign({ userId: data.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ token, user: { id: data.id, email: data.email } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
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
    res.json({ token, user: { id: data.id, email: data.email } });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

export default router;
