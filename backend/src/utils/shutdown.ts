/**
 * Graceful Shutdown Utilities
 * 
 * Provides clean shutdown coordination for future server deployment
 */

export interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

class ShutdownCoordinator {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  
  register(handler: ShutdownHandler): void {
    this.handlers.push(handler);
  }
  
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log(`Received ${signal}, starting graceful shutdown...`);
    
    const graceMs = parseInt(process.env.SHUTDOWN_GRACE_MS || '8000', 10);
    
    for (const { name, handler, timeout = graceMs } of this.handlers) {
      try {
        await Promise.race([
          handler(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${name} shutdown timeout`)), timeout)
          )
        ]);
        console.log(`✓ ${name} shutdown complete`);
      } catch (error) {
        console.error(`✗ ${name} shutdown failed:`, error);
      }
    }
    
    console.log('Graceful shutdown complete');
    process.exit(0);
  }
}

export const shutdownCoordinator = new ShutdownCoordinator();

/**
 * Setup shutdown handlers
 */
export function setupShutdownHandlers(): void {
  process.on('SIGINT', () => shutdownCoordinator.shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdownCoordinator.shutdown('SIGTERM'));
}
