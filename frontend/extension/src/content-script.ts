// Content script for capturing page content and selected text
// This script runs in the context of web pages

console.log('FakeNewsOff content script loaded');

/**
 * Get selected text from the page, handling edge cases like iframes and shadow DOM
 */
function getSelectedText(): string {
  // First try to get selection from main document
  let selectedText = window.getSelection()?.toString() || '';

  // If no selection in main document, check active element for shadow DOM
  if (!selectedText && document.activeElement?.shadowRoot) {
    // Shadow DOM doesn't have its own getSelection, use window.getSelection
    // but check if the selection is within the shadow root
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      const root = selection.anchorNode.getRootNode();
      if (root === document.activeElement.shadowRoot) {
        selectedText = selection.toString();
      }
    }
  }

  // Check iframes if still no selection (requires same-origin)
  if (!selectedText) {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeSelection = iframeDoc.getSelection();
          selectedText = iframeSelection?.toString() || '';
          if (selectedText) break;
        }
      } catch (e) {
        // Cross-origin iframe, skip silently
        continue;
      }
    }
  }

  return selectedText.trim();
}

/**
 * Get page snippet (first 500 characters), handling dynamic content and edge cases
 */
function getPageSnippet(): string {
  let text = '';

  // Try to get text from body
  if (document.body) {
    text = document.body.innerText;
  }

  // If body is empty or very short, try to get text from main content areas
  if (text.length < 100) {
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '#content',
      '.post',
      '.article',
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const elementText = element.textContent.trim();
        if (elementText.length > text.length) {
          text = elementText;
        }
      }
    }
  }

  // Handle shadow DOM content
  const shadowHosts = document.querySelectorAll('*');
  for (const host of shadowHosts) {
    if (host.shadowRoot) {
      const shadowText = host.shadowRoot.textContent?.trim() || '';
      if (shadowText.length > 100 && text.length < 100) {
        text = shadowText;
        break;
      }
    }
  }

  // Clean up whitespace and return first 500 characters
  text = text.replace(/\s+/g, ' ').trim();
  return text.substring(0, 500);
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const selectedText = getSelectedText();
    sendResponse({ text: selectedText });
  } else if (message.type === 'GET_PAGE_SNIPPET') {
    const snippet = getPageSnippet();
    sendResponse({ text: snippet });
  }
  return true; // Keep message channel open for async response
});
