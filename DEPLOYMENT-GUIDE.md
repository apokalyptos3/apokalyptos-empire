# 🚀 APOKALYPTOS - QUICK DEPLOYMENT GUIDE

This is a condensed deployment guide. For complete step-by-step instructions with screenshots, see `docs/APOKALYPTOS-COMPLETE-BEGINNERS-GUIDE.md`.

---

## ⚡ QUICK START (30 Minutes)

If you already have all accounts and API keys:

### 1. Upload to GitHub (5 minutes)
```bash
# Create new repository on github.com
# Upload the 'apokalyptos-empire' folder
# Make it private (recommended)
```

### 2. Deploy Database (5 minutes)
```bash
# Go to supabase.com
# Create new project
# Copy database URL
# In SQL Editor, paste contents of database-schema.sql
# Run the SQL
```

### 3. Deploy Backend (10 minutes)
```bash
# Go to railway.app
# New Project → Deploy from GitHub
# Select your repository
# Add environment variables from backend/.env.example
# Set root directory: backend
# Deploy
# Copy the Railway URL
```

### 4. Deploy Frontend (10 minutes)
```bash
# Go to vercel.com
# New Project → Import from GitHub
# Select your repository
# Root directory: frontend
# Add environment variables from frontend/.env.example
# Use your Railway URL for NEXT_PUBLIC_API_URL
# Deploy
# Copy the Vercel URL
```

### 5. Update Environment Variables
```bash
# Go back to Vercel
# Settings → Environment Variables
# Update NEXT_PUBLIC_API_URL with Railway URL
# Redeploy

# Go back to Railway
# Variables
# Update FRONTEND_URL with Vercel URL
# Redeploy
```

### 6. Done! 🎉
```bash
# Open your Vercel URL
# Create account
# Add your API keys
# Start creating!
```

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before deploying, ensure you have:

### Accounts Created
- [ ] GitHub account
- [ ] Vercel account
- [ ] Railway account
- [ ] Supabase account

### API Keys Ready
- [ ] Anthropic Claude API key
- [ ] OpenAI API key
- [ ] Google Gemini API key
- [ ] YouTube API credentials (optional - can add later)
- [ ] TikTok API credentials (optional - can add later)

### Files Prepared
- [ ] All files from apokalyptos-empire folder
- [ ] Backend .env.example reviewed
- [ ] Frontend .env.example reviewed
- [ ] Database schema SQL file ready

---

## 🔧 ENVIRONMENT VARIABLES REFERENCE

### Backend (Railway)

**Required:**
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST].supabase.co:5432/postgres
JWT_SECRET=[Generate random 32-char string]
ENCRYPTION_KEY=[Generate random 32-char string]
FRONTEND_URL=https://your-app.vercel.app
NODE_ENV=production
```

**Optional (users add via UI):**
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...
```

### Frontend (Vercel)

**Required:**
```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## 🗄️ DATABASE SETUP

### Supabase Setup

1. **Create Project**
   - Name: apokalyptos-db
   - Strong password (save it!)
   - Region: Closest to you

2. **Run Schema**
   - Go to SQL Editor
   - Copy all content from `database-schema.sql`
   - Paste and run
   - Verify tables created (Table Editor)

3. **Get Connection String**
   - Settings → Database
   - Copy Connection String
   - Replace [YOUR-PASSWORD] with your password

4. **Enable Row Level Security**
   - Already enabled via schema
   - Policies created automatically

---

## 🚂 RAILWAY DEPLOYMENT

### Initial Setup

1. **Create Project**
   - Deploy from GitHub repo
   - Select apokalyptos-empire

2. **Configure Service**
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

3. **Add Variables**
   - Use backend/.env.example as template
   - Add all required variables

4. **Generate Domain**
   - Settings → Generate Domain
   - Copy the URL (you'll need it for Vercel)

### Troubleshooting Railway

**Service won't start?**
- Check logs for errors
- Verify all environment variables are set
- Ensure DATABASE_URL is correct
- Check Node.js version (should be 20)

**Out of credits?**
- Add payment method
- Railway charges $5/month after free tier

---

## ▲ VERCEL DEPLOYMENT

### Initial Setup

1. **Import Project**
   - New Project → Import
   - Select GitHub repository

2. **Configure Project**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `frontend`
   - Build Command: Default
   - Output Directory: Default

3. **Add Environment Variables**
   - Use frontend/.env.example as template
   - Use your Railway URL for API_URL
   - Add variables

4. **Deploy**
   - Click Deploy
   - Wait 2-3 minutes
   - Copy the Vercel URL

### Update API URLs

**After First Deploy:**
1. Go to Vercel Settings → Environment Variables
2. Update `NEXT_PUBLIC_API_URL` with Railway URL
3. Update `NEXT_PUBLIC_WS_URL` with Railway URL
4. Redeploy (Deployments → ... → Redeploy)

### Troubleshooting Vercel

**Build failed?**
- Check build logs
- Ensure all dependencies in package.json
- Verify Next.js version

**App loads but API doesn't work?**
- Check NEXT_PUBLIC_API_URL is correct
- Verify Railway backend is running
- Check browser console for CORS errors

---

## 🔐 SECURITY SETUP

### Generate Secure Keys

**JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### API Key Security

**Best Practices:**
- Never commit .env files
- Use different keys for dev/prod
- Rotate keys regularly
- Monitor usage and costs
- Enable rate limiting

---

## 🧪 TESTING YOUR DEPLOYMENT

### 1. Check Backend Health
```bash
curl https://your-backend.up.railway.app/health

# Should return: {"status": "ok", "version": "1.0.0"}
```

### 2. Check Frontend Loads
```bash
# Open your Vercel URL in browser
# Should see login/register page
```

### 3. Create Test Account
```bash
# Go to your Vercel URL
# Click "Register"
# Enter email, password, name
# Should receive verification email
```

### 4. Verify Database Connection
```bash
# After registration, go to Supabase
# Table Editor → users
# Should see your new user
```

### 5. Test API Keys
```bash
# Log in to your app
# Go to Settings → API Keys
# Add a test API key
# Should save without errors
```

---

## 🐛 COMMON ISSUES & FIXES

### "Database connection failed"
**Fix:** Verify DATABASE_URL in Railway environment variables

### "CORS error" in browser
**Fix:** Ensure FRONTEND_URL in Railway matches your Vercel URL exactly

### "API keys not saving"
**Fix:** Check ENCRYPTION_KEY is set in Railway

### "Agents not working"
**Fix:** Verify API keys added in UI settings, check Railway logs

### "Build failed on Vercel"
**Fix:** Check package.json, ensure all dependencies listed

### "Railway out of credits"
**Fix:** Add payment method, Railway charges $5/month

---

## 📊 MONITORING

### Railway Logs
```bash
# Go to Railway dashboard
# Your project → Deployments
# Click on latest deployment
# View logs for errors
```

### Vercel Logs
```bash
# Go to Vercel dashboard
# Your project → Deployments
# Click on deployment
# Functions → View logs
```

### Supabase Logs
```bash
# Supabase dashboard
# Logs → Postgres Logs
# Check for query errors
```

---

## 🔄 UPDATES & REDEPLOYMENT

### Update Code
```bash
# 1. Make changes locally
# 2. Commit to GitHub
# 3. Railway and Vercel auto-deploy
```

### Update Database Schema
```bash
# 1. Go to Supabase SQL Editor
# 2. Run new migration SQL
# 3. Redeploy backend if needed
```

### Update Environment Variables
```bash
# Railway: Variables → Edit → Save → Redeploy
# Vercel: Settings → Env Vars → Edit → Redeploy
```

---

## 💰 COST TRACKING

### Monthly Costs
- Vercel: $0 (free tier)
- Railway: $5
- Supabase: $0 (free tier)
- Domain: ~$1/month
- **Total Infrastructure: ~$6/month**

### AI Service Costs (Your Budget)
- Claude API: ~$50/month
- OpenAI API: ~$40/month
- Gemini: $0 (free tier)
- Other: Variable (Agent 9 finds free options)
- **Total AI: ~$90/month**

**Total: ~$96/month** (well within $200 budget)

---

## 📞 GET HELP

### Documentation
- Complete guide: `docs/APOKALYPTOS-COMPLETE-BEGINNERS-GUIDE.md`
- Architecture: `docs/APOKALYPTOS-MASTER-ARCHITECTURE.md`
- Database: `database-schema.sql`

### Support
- Email: support@apokalyptos.com
- Discord: [Server Link]
- GitHub Issues: [Link]

---

## ✅ POST-DEPLOYMENT CHECKLIST

After successful deployment:

- [ ] Can access your Vercel URL
- [ ] Can register a new account
- [ ] Can verify email
- [ ] Can log in
- [ ] Can add API keys in settings
- [ ] Can see dashboard
- [ ] Can access Creative Studio
- [ ] Can view Agents page
- [ ] No console errors in browser
- [ ] Backend logs show no errors
- [ ] Database contains your user data

**If all checked: Congratulations! Your empire is live! 🎉**

---

## 🎯 NEXT STEPS

1. **Add Your API Keys** (Settings → API Keys)
2. **Connect Your First Channel** (Channels → Add Channel)
3. **Meet ATOPIA** (Creative Studio)
4. **Upload Your First Story**
5. **Create Your First Content**
6. **Monitor Agent 9** for tool discoveries
7. **Track Your Budget** (Analytics → Budget)
8. **Watch Your Revenue Grow**

---

*For detailed instructions with screenshots, see the complete beginner's guide.*
*For technical deep-dive, see the master architecture document.*

**Welcome to your APOKALYPTOS Empire!** 👑
