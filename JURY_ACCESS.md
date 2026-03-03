# FakeNewsOff - Jury Access Guide

## 🌐 Live Deployment URLs

- **Web UI**: https://d1bfsru3sckwq1.cloudfront.net
- **API Base URL**: https://fnd9pknygc.execute-api.us-east-1.amazonaws.com
- **Extension Download**: https://d1bfsru3sckwq1.cloudfront.net/downloads/fakenewsoff-extension.zip

## 🚀 Quick Start (90-Second Demo)

### Option A: Web UI (Fastest)

1. Open https://d1bfsru3sckwq1.cloudfront.net in your browser
2. Toggle "Demo Mode" ON (for instant responses)
3. Enter any text claim (e.g., "Climate change is a hoax")
4. Click "Analyze" and see results in ~2 seconds

### Option B: Chrome Extension

#### Method 1: Load Unpacked (Recommended for Testing)

1. Download and extract: https://d1bfsru3sckwq1.cloudfront.net/downloads/fakenewsoff-extension.zip
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the extracted folder containing `manifest.json`
6. Extension icon should appear in your toolbar

#### Method 2: Install from ZIP

1. Download: https://d1bfsru3sckwq1.cloudfront.net/downloads/fakenewsoff-extension.zip
2. Extract the ZIP file to a folder
3. Follow steps 2-6 from Method 1 above

#### Using the Extension

1. Navigate to any webpage with text
2. Select any text on the page
3. Right-click and choose "Analyze with FakeNewsOff"
4. A notification will appear with the analysis result
5. Click the notification to view full details in the Web UI

## 🎯 Demo Mode

**Demo Mode** provides instant responses (~1.5s) using pre-configured mock data:
- Perfect for jury demonstrations
- No AWS Bedrock API calls
- Consistent, predictable results
- Toggle ON in both Web UI and Extension popup

**Production Mode** (Demo Mode OFF):
- Real AWS Bedrock Nova 2 Lite analysis
- Takes 20-40 seconds per request
- Actual web search and fact-checking
- Real confidence scores and evidence

## 📊 What You'll See

Each analysis provides:
- **Status Label**: Supported, Disputed, Unverified, Manipulated, or Biased framing
- **Confidence Score**: 0-100% confidence in the assessment
- **Recommendation**: Action guidance for the user
- **Evidence**: Supporting sources and reasoning (Production mode only)
- **Misinformation Type**: Classification if problematic content detected

## 🔧 Troubleshooting

### Web UI Issues

**Problem**: "Unable to connect to API"
- **Check**: Open browser DevTools (F12) → Console tab
- **Look for**: `[API Client] Using API base URL: https://fnd9pknygc.execute-api.us-east-1.amazonaws.com`
- **If missing**: Clear browser cache and hard reload (Ctrl+Shift+R)

**Problem**: Requests timeout
- **Solution**: Enable Demo Mode for instant responses
- **Note**: Production mode takes 20-40s due to real AI analysis

### Extension Issues

**Problem**: Context menu doesn't appear
- **Check**: Extension is enabled in `chrome://extensions/`
- **Check**: You've selected text before right-clicking
- **Solution**: Reload the extension or restart Chrome

**Problem**: Notification shows error
- **Check**: Demo Mode setting in extension popup
- **Check**: Internet connection is active
- **Solution**: Try with Demo Mode enabled first

**Problem**: Notification click doesn't open Web UI
- **Check**: Pop-up blocker settings
- **Solution**: Allow pop-ups from the extension

## 🏗️ Architecture Overview

- **Frontend**: React + TypeScript + Vite
- **Backend**: AWS Lambda + API Gateway
- **AI Model**: AWS Bedrock Nova 2 Lite
- **Hosting**: CloudFront (Web) + S3 (Static Assets)
- **Extension**: Chrome Manifest V3

## 📝 API Endpoints

### Health Check
```bash
GET https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/health
```

Response:
```json
{
  "status": "ok",
  "demo_mode": true
}
```

### Analyze Content
```bash
POST https://fnd9pknygc.execute-api.us-east-1.amazonaws.com/analyze
Content-Type: application/json

{
  "text": "Your claim to analyze",
  "demo_mode": true
}
```

Response:
```json
{
  "request_id": "uuid",
  "status_label": "Unverified",
  "confidence_score": 30,
  "recommendation": "Exercise caution...",
  "evidence": [...],
  "misinformation_type": null
}
```

## 🎓 For Jurors

This project demonstrates:
1. **Real-time misinformation detection** using AWS Bedrock Nova 2 Lite
2. **Multi-platform deployment** (Web UI + Chrome Extension)
3. **Production-grade architecture** with proper error handling, retries, and validation
4. **Dual-mode operation** (Demo for testing, Production for real analysis)
5. **User-friendly interfaces** with clear status indicators and recommendations

All code is open source and available in the repository. The deployment is fully automated using AWS SAM and CloudFormation.

## 📞 Support

For technical issues or questions:
- Check the browser console for detailed error messages
- Verify all URLs are accessible
- Ensure Demo Mode is enabled for quick testing
- Review the troubleshooting section above

---

**Deployment Date**: March 2, 2026  
**Stack Names**: `fakenewsoff-backend`, `fakenewsoff-web`  
**Region**: us-east-1  
**Account**: 794289527784
