/**
 * API Status Component
 *
 * Displays backend API status, grounding configuration, and debug information.
 * Helps diagnose production issues with grounding.
 */

import { useState, useEffect } from 'react';
import {
  getApiConfig,
  checkHealth,
  checkGroundingHealth,
  type HealthResponse,
  type GroundingHealthResponse,
} from '../../../shared/api/client.js';
import './ApiStatus.css';

interface ApiStatusProps {
  lastGroundingMetadata?: {
    providerUsed?: string;
    sources_count?: number;
    latencyMs?: number;
    errors?: string[];
    attemptedProviders?: string[];
    sourcesCountRaw?: number;
    sourcesCountReturned?: number;
    cacheHit?: boolean;
  };
}

function ApiStatus({ lastGroundingMetadata }: ApiStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [groundingHealth, setGroundingHealth] =
    useState<GroundingHealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const apiConfig = getApiConfig();
  
  // Safely extract host from API base URL
  let apiHost = 'unknown';
  try {
    apiHost = new URL(apiConfig.baseUrl).host;
  } catch (error) {
    console.error('[ApiStatus] Invalid API base URL:', apiConfig.baseUrl, error);
    apiHost = apiConfig.baseUrl || 'not configured';
  }

  useEffect(() => {
    // Auto-check health on mount
    checkAllHealth();
  }, []);

  const checkAllHealth = async () => {
    setIsChecking(true);
    setHealthError(null);
    setGroundingError(null);

    // Check basic health
    const healthResult = await checkHealth();
    if (healthResult.success) {
      setHealth(healthResult.data);
    } else {
      setHealthError(healthResult.error.message);
    }

    // Check grounding health
    const groundingResult = await checkGroundingHealth();
    if (groundingResult.success) {
      setGroundingHealth(groundingResult.data);
    } else {
      setGroundingError(groundingResult.error.message);
    }

    setIsChecking(false);
  };

  const copyDebugInfo = () => {
    const debugInfo = {
      api_base_url: apiConfig.baseUrl,
      api_host: apiHost,
      health: health || { error: healthError },
      grounding_health: groundingHealth || { error: groundingError },
      last_grounding_metadata: lastGroundingMetadata || null,
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    alert('Debug info copied to clipboard!');
  };

  const getHealthStatusIcon = () => {
    if (isChecking) return '⏳';
    if (healthError) return '❌';
    if (health?.status === 'ok') return '✅';
    return '❓';
  };

  const getGroundingStatusIcon = () => {
    if (isChecking) return '⏳';
    if (groundingError) return '❌';
    if (groundingHealth?.ok) return '✅';
    if (groundingHealth?.ok === false) return '⚠️';
    return '❓';
  };

  return (
    <div className="api-status">
      <div
        className="api-status-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="api-status-summary">
          <span className="api-status-icon">{getHealthStatusIcon()}</span>
          <span className="api-status-text">API: {apiHost}</span>
          <span className="api-status-icon">{getGroundingStatusIcon()}</span>
          <span className="api-status-text">
            Grounding: {groundingHealth?.ok ? 'Enabled' : 'Disabled/Unknown'}
          </span>
        </div>
        <button
          className="api-status-toggle"
          aria-label="Toggle API status details"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="api-status-details">
          <div className="api-status-section">
            <h4>Backend Health</h4>
            {healthError ? (
              <div className="api-status-error">❌ {healthError}</div>
            ) : health ? (
              <div className="api-status-info">
                <div>✅ Status: {health.status}</div>
                {health.demo_mode !== undefined && (
                  <div>Demo Mode: {health.demo_mode ? 'Yes' : 'No'}</div>
                )}
              </div>
            ) : (
              <div>Checking...</div>
            )}
          </div>

          <div className="api-status-section">
            <h4>Grounding Configuration</h4>
            {groundingError ? (
              <div className="api-status-error">
                ❌ {groundingError}
                {groundingError.includes('404') && (
                  <div className="api-status-hint">
                    Backend missing diagnostics endpoints (old backend deploy)
                  </div>
                )}
              </div>
            ) : groundingHealth ? (
              <div className="api-status-info">
                <div>
                  {groundingHealth.ok ? '✅' : '⚠️'} Provider Enabled:{' '}
                  {groundingHealth.provider_enabled ? 'Yes' : 'No'}
                </div>
                <div>
                  Bing Configured:{' '}
                  {groundingHealth.bing_configured ? '✅ Yes' : '❌ No'}
                </div>
                <div>
                  GDELT Configured:{' '}
                  {groundingHealth.gdelt_configured ? '✅ Yes' : '❌ No'}
                </div>
                <div>
                  Provider Order: {groundingHealth.provider_order.join(', ')}
                </div>
                <div>Timeout: {groundingHealth.timeout_ms}ms</div>
                <div>Cache TTL: {groundingHealth.cache_ttl_seconds}s</div>
              </div>
            ) : (
              <div>Checking...</div>
            )}
          </div>

          {lastGroundingMetadata && (
            <div className="api-status-section">
              <h4>Last Grounding Result</h4>
              <div className="api-status-info">
                <div>
                  Provider Used: {lastGroundingMetadata.providerUsed || 'none'}
                </div>
                {lastGroundingMetadata.attemptedProviders && (
                  <div>
                    Attempted:{' '}
                    {lastGroundingMetadata.attemptedProviders.join(', ')}
                  </div>
                )}
                {lastGroundingMetadata.sourcesCountRaw !== undefined && (
                  <div>
                    Sources (Raw): {lastGroundingMetadata.sourcesCountRaw}
                  </div>
                )}
                {lastGroundingMetadata.sourcesCountReturned !== undefined && (
                  <div>
                    Sources (Returned):{' '}
                    {lastGroundingMetadata.sourcesCountReturned}
                  </div>
                )}
                {lastGroundingMetadata.cacheHit !== undefined && (
                  <div>
                    Cache Hit: {lastGroundingMetadata.cacheHit ? 'Yes' : 'No'}
                  </div>
                )}
                {lastGroundingMetadata.latencyMs !== undefined && (
                  <div>Latency: {lastGroundingMetadata.latencyMs}ms</div>
                )}
                {lastGroundingMetadata.errors &&
                  lastGroundingMetadata.errors.length > 0 && (
                    <div className="api-status-error">
                      Errors: {lastGroundingMetadata.errors.join('; ')}
                    </div>
                  )}
              </div>
            </div>
          )}

          <div className="api-status-actions">
            <button onClick={checkAllHealth} disabled={isChecking}>
              {isChecking ? 'Checking...' : 'Refresh Status'}
            </button>
            <button onClick={copyDebugInfo}>Copy Debug Info</button>
          </div>

          <div className="api-status-hint">
            💡 Tip: Open DevTools → Network → analyze → Request URL to see full
            backend URL
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiStatus;
