// Debug utility for tracking authentication issues
// Add this to components that are having auth problems

export class AuthDebugger {
  private logs: string[] = [];
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    // Enable in development or when localStorage has debug flag
    this.enabled = enabled || this.hasDebugFlag();
  }

  private hasDebugFlag(): boolean {
    try {
      return localStorage.getItem('auth_debug') === 'true';
    } catch {
      return false;
    }
  }

  log(category: string, message: string, data?: any) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${category}] ${message}`;
    
    this.logs.push(logEntry);
    
    console.log(`🔍 ${logEntry}`, data || '');
    
    if (data) {
      this.logs.push(JSON.stringify(data, null, 2));
    }
  }

  logRequest(method: string, url: string, headers: any, body?: any) {
    this.log('REQUEST', `${method} ${url}`, {
      headers: this.sanitizeHeaders(headers),
      body
    });
  }

  logResponse(status: number, data: any, error?: any) {
    const category = status >= 400 ? 'ERROR' : 'SUCCESS';
    this.log(category, `Response ${status}`, {
      data,
      error
    });
  }

  logBrowserInfo() {
    const info = {
      userAgent: navigator.userAgent,
      localStorage: this.testLocalStorage(),
      cookies: navigator.cookieEnabled,
      online: navigator.onLine,
      timestamp: new Date().toISOString()
    };
    
    this.log('BROWSER', 'Browser environment', info);
  }

  private testLocalStorage(): string {
    try {
      localStorage.setItem('__test__', 'test');
      localStorage.removeItem('__test__');
      return 'Available';
    } catch {
      return 'Blocked';
    }
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Hide sensitive data but show it's present
    if (sanitized.Authorization) {
      sanitized.Authorization = `Bearer ${sanitized.Authorization.substring(7, 27)}...`;
    }
    if (sanitized.apikey) {
      sanitized.apikey = `${sanitized.apikey.substring(0, 20)}...`;
    }
    
    return sanitized;
  }

  getLogs(): string[] {
    return this.logs;
  }

  downloadLogs() {
    const logText = this.logs.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-debug-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clear() {
    this.logs = [];
  }

  // Enable/disable debugging
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem('auth_debug', enabled ? 'true' : 'false');
    } catch {
      // localStorage blocked, can't save preference
    }
  }
}

// Create a singleton instance
export const authDebugger = new AuthDebugger();

// Enable debugging from browser console:
// window.enableAuthDebug = () => authDebugger.setEnabled(true);
// window.disableAuthDebug = () => authDebugger.setEnabled(false);
// window.downloadAuthLogs = () => authDebugger.downloadLogs();

if (typeof window !== 'undefined') {
  (window as any).enableAuthDebug = () => authDebugger.setEnabled(true);
  (window as any).disableAuthDebug = () => authDebugger.setEnabled(false);
  (window as any).downloadAuthLogs = () => authDebugger.downloadLogs();
}
