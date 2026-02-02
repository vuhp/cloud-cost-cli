/**
 * Utility functions for handling analyzer errors gracefully
 */

export interface AnalyzerError {
  code?: string;
  name?: string;
  message: string;
  statusCode?: number;
}

/**
 * Check if an error is a permission/authorization error
 */
export function isPermissionError(error: AnalyzerError): boolean {
  const code = error.code || error.name || '';
  const message = error.message || '';
  
  // AWS permission error codes
  const awsPermissionCodes = [
    'AccessDeniedException',
    'UnauthorizedOperation',
    'AccessDenied',
    'UnauthorizedAccess',
    'Forbidden',
  ];
  
  if (awsPermissionCodes.includes(code)) {
    return true;
  }
  
  // Azure - 403 status code
  if (error.statusCode === 403) {
    return true;
  }
  
  // GCP - permission messages
  if (
    message.includes('Permission denied') ||
    message.includes('API not enabled') ||
    message.includes('permission') ||
    message.includes('PERMISSION_DENIED')
  ) {
    return true;
  }
  
  return false;
}

/**
 * Get a user-friendly error message for permission errors
 */
export function getPermissionErrorMessage(error: AnalyzerError, analyzerName: string): string {
  const message = error.message || '';
  
  // Try to extract the specific permission needed (AWS format)
  const match = message.match(/perform: ([a-zA-Z0-9:]+)/);
  if (match) {
    return `⚠️  Skipping ${analyzerName} - missing IAM permission: ${match[1]}`;
  }
  
  // Generic permission message
  return `⚠️  Skipping ${analyzerName} - insufficient permissions`;
}

/**
 * Wrap an analyzer function with error handling
 * Returns empty array on error instead of throwing
 */
export async function safeAnalyze<T>(
  analyzerName: string,
  analyzerFn: () => Promise<T[]>
): Promise<T[]> {
  try {
    return await analyzerFn();
  } catch (error: any) {
    if (isPermissionError(error)) {
      console.warn(getPermissionErrorMessage(error, analyzerName));
      console.warn(`   Continuing with other analyzers...`);
    } else {
      console.error(`Error analyzing ${analyzerName}:`, error.message);
    }
    return [];
  }
}
