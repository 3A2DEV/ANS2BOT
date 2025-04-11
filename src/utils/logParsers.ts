import { ErrorPattern, allPatterns } from '../config/errorPatterns';

interface ParsedError {
  jobName: string;
  errors: string[];
}

function isUnitTestError(line: string): boolean {
  const unitTestPatterns = [
    /E\s+assert/i,
    /E\s+AssertionError/i,
    /E\s+TypeError/i,
    /E\s+ValueError/i,
    /FAILED\s+tests\/unit/i,
    /FAIL:/i
  ];
  return unitTestPatterns.some(pattern => pattern.test(line));
}

function cleanLogLine(line: string): string {
  return line
    // Remove timestamp
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '')
    
    // Remove ANSI escape sequences and common artifacts
    .replace(/(?:\x1B|\uFFFD|\x9B)\[[0-9;]*[mK]/g, '')
    .replace(/â�|�|�\[\d+(?:;\d+)*m|�\[0m|\x00/g, '')
    
    // Remove checkmark/x characters
    .replace(/[\u2714\u2716\u2718\u2713\u2717\u2718]/g, '')
    
    // Remove emoji
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    
    // Remove other problematic characters
    .replace(/[â�|ð�|�]/g, '')
    .replace(/â�/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

function isRelevantErrorLine(line: string): boolean {
  // Lines to include (positive patterns)
  const relevantPatterns = [
    /^ERROR:/,
    /^FATAL:/,
    /fatal:\s*\[.*?\]:\s*FAILED!/i,
    /failed!/i
  ];

  // Lines to exclude (negative patterns)
  const irrelevantPatterns = [
    /^::/,
    /integration-continue-on-error/,
    /integration-retry-on-error/,
    /GHA_INTEGRATION/,
    /if gha_integration/,
    /^\s*$/,
    /'::error/
  ];

  // Include line only if it matches a relevant pattern and doesn't match any irrelevant pattern
  return relevantPatterns.some(pattern => pattern.test(line)) && 
         !irrelevantPatterns.some(pattern => pattern.test(line));
}

function isAnsibleIntegrationError(line: string): boolean {
  return /fatal:\s*\[.*?\]:\s*FAILED!\s*=>\s*{/.test(line);
}

export function defaultParser(logs: string, jobName: string): ParsedError {
  const errors: string[] = [];
  const lines = logs.split('\n');
  let inErrorBlock = false;
  let currentError: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = cleanLogLine(lines[i]);
    
    if (!line) continue;

    // Special handling for unit tests
    if (jobName.includes('Units')) {
      if (isUnitTestError(line)) {
        inErrorBlock = true;
        currentError = [line];
      } else if (inErrorBlock) {
        if (line.startsWith('E ') || line.startsWith('> ')) {
          currentError.push(line);
        } else if (currentError.length > 0) {
          errors.push(currentError.join('\n'));
          currentError = [];
          inErrorBlock = false;
        }
      }
      continue;
    }

    // Normal handling for other error types
    for (const pattern of allPatterns) {
      if (pattern.pattern.test(line)) {
        errors.push(line);
        break;
      }
    }
  }

  // Add the last error block if present
  if (currentError.length > 0) {
    errors.push(currentError.join('\n'));
  }

  return { jobName, errors };
}

export function ansibleIntegrationParser(logs: string, jobName: string): ParsedError {
  const errors: string[] = [];
  const lines = logs.split('\n');
  let isCollectingError = false;
  let currentError: string[] = [];
  let bracesCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = cleanLogLine(lines[i]);
    
    if (!line) continue;

    // Start collecting error when finding pattern "fatal: [host]: FAILED! => {"
    if (isAnsibleIntegrationError(line)) {
      isCollectingError = true;
      bracesCount = 1; // First brace found
      currentError = [line];
      continue;
    }

    if (isCollectingError) {
      currentError.push(line);
      
      // Count braces to handle nested JSON
      bracesCount += (line.match(/{/g) || []).length;
      bracesCount -= (line.match(/}/g) || []).length;

      // If we reached the same number of open and closed braces
      if (bracesCount === 0) {
        errors.push(currentError.join('\n'));
        isCollectingError = false;
        currentError = [];
      }
    }
  }

  // If there's an incomplete error at the end, add it anyway
  if (currentError.length > 0) {
    errors.push(currentError.join('\n'));
  }

  return { jobName, errors };
}

export function selectParser(jobName: string): (logs: string, jobName: string) => ParsedError {
  // Use specific parser for integration tests
  if (jobName.toLowerCase().includes('integration')) {
    return ansibleIntegrationParser;
  }
  return defaultParser;
}