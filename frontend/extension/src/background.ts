/**
 * Background Service Worker
 *
 * Handles context menu integration and notifications for the browser extension.
 * Runs as a Manifest V3 service worker in the background.
 *
 * Features:
 * - Registers "Analyze with FakeNewsOff" context menu item
 * - Handles context menu clicks with selected text
 * - Calls API_Client.analyzeContent() with demo mode from storage
 * - Displays notification with status label and confidence
 * - Opens Web UI with request_id on notification click
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4
 */

import { analyzeContent } from '../../shared/api/client.js';
import type { AnalysisResponse } from '../../shared/schemas/index.js';

console.log('FakeNewsOff background service worker loaded');

// ============================================================================
// Context Menu Registration
// ============================================================================

/**
 * Register context menu on installation
 * Requirement 9.1: Display "Analyze with FakeNewsOff" context menu item
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'analyze-selection',
    title: 'Analyze with FakeNewsOff',
    contexts: ['selection'],
  });
  console.log('Context menu registered');
});

// ============================================================================
// Context Menu Click Handler
// ============================================================================

/**
 * Handle context menu clicks
 * Requirements 9.2, 9.3, 9.4: Analyze selected text, display notification, open Web UI
 */
chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === 'analyze-selection' && info.selectionText) {
    console.log('Context menu clicked with text:', info.selectionText);

    try {
      // Get demo mode preference from storage
      const storage = await chrome.storage.local.get(['demoMode']);
      const demoMode = storage.demoMode ?? false;

      console.log('Analyzing with demo mode:', demoMode);

      // Call API_Client.analyzeContent()
      const result = await analyzeContent({
        text: info.selectionText,
        demoMode,
      });

      if (result.success) {
        // Display notification with status label and confidence
        await displaySuccessNotification(result.data);
      } else {
        // Display error notification
        await displayErrorNotification(result.error.message);
      }
    } catch (error) {
      console.error('Error analyzing content:', error);
      await displayErrorNotification('An unexpected error occurred');
    }
  }
});

// ============================================================================
// Notification Handlers
// ============================================================================

/**
 * Display success notification with analysis results
 * Requirement 9.3: Display notification with status label and confidence
 */
async function displaySuccessNotification(
  response: AnalysisResponse
): Promise<void> {
  const notificationId = `analysis-${response.request_id}`;

  // Get status label emoji for visual appeal
  const statusEmoji = getStatusEmoji(response.status_label);

  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: `${statusEmoji} ${response.status_label}`,
    message: `Confidence: ${response.confidence_score}%\n\nClick to view full analysis`,
    priority: 2,
    requireInteraction: false,
  });

  // Store request_id for notification click handler
  await chrome.storage.local.set({
    [`notification_${notificationId}`]: response.request_id,
  });

  console.log('Notification displayed:', notificationId);
}

/**
 * Display error notification
 */
async function displayErrorNotification(message: string): Promise<void> {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: '❌ Analysis Failed',
    message: message,
    priority: 1,
    requireInteraction: false,
  });
}

/**
 * Get emoji for status label
 */
function getStatusEmoji(statusLabel: string): string {
  switch (statusLabel) {
    case 'Supported':
      return '✅';
    case 'Disputed':
      return '❌';
    case 'Unverified':
      return '⚠️';
    case 'Manipulated':
      return '🚫';
    case 'Biased framing':
      return '⚖️';
    default:
      return '📊';
  }
}

// ============================================================================
// Notification Click Handler
// ============================================================================

/**
 * Handle notification clicks
 * Requirement 9.4: Open Web UI with request_id on notification click
 */
chrome.notifications.onClicked.addListener(async (notificationId) => {
  console.log('Notification clicked:', notificationId);

  // Get request_id from storage
  const storage = await chrome.storage.local.get([
    `notification_${notificationId}`,
  ]);
  const requestId = storage[`notification_${notificationId}`];

  if (requestId) {
    // Load runtime config to get Web UI URL
    let webUiUrl = 'https://d1bfsru3sckwq1.cloudfront.net';
    try {
      const configResponse = await fetch(chrome.runtime.getURL('config.json'));
      if (configResponse.ok) {
        const config = await configResponse.json();
        if (config.webUiUrl) {
          webUiUrl = config.webUiUrl;
        }
      }
    } catch (error) {
      console.warn('Failed to load config.json, using default Web UI URL:', error);
    }

    // Open Web UI with request_id
    const url = `${webUiUrl}/results?request_id=${requestId}`;
    await chrome.tabs.create({ url });

    // Clean up storage
    await chrome.storage.local.remove([`notification_${notificationId}`]);

    console.log('Opened Web UI with request_id:', requestId);
  } else {
    console.warn('No request_id found for notification:', notificationId);
  }

  // Clear the notification
  await chrome.notifications.clear(notificationId);
});
