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
    // Rimuovi timestamp
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*/, '')
    
    // Rimuovi sequenze escape ANSI e artefatti comuni
    .replace(/(?:\x1B|\uFFFD|\x9B)\[[0-9;]*[mK]/g, '')
    .replace(/â�|�|�\[\d+(?:;\d+)*m|�\[0m|\x00/g, '')
    
    // Rimuovi caratteri di spunta/x
    .replace(/[\u2714\u2716\u2718\u2713\u2717\u2718]/g, '')
    
    // Rimuovi emoji
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    
    // Rimuovi altri caratteri problematici
    .replace(/[â�|ð�|�]/g, '')
    .replace(/â�/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

function isRelevantErrorLine(line: string): boolean {
  // Linee da includere (pattern positivi)
  const relevantPatterns = [
    /^ERROR:/,
    /^FATAL:/,
    /fatal:\s*\[.*?\]:\s*FAILED!/i,
    /failed!/i
  ];

  // Linee da escludere (pattern negativi)
  const irrelevantPatterns = [
    /^::/,
    /integration-continue-on-error/,
    /integration-retry-on-error/,
    /GHA_INTEGRATION/,
    /if gha_integration/,
    /^\s*$/,
    /'::error/
  ];

  // Includi la linea solo se matcha un pattern rilevante e non matcha nessun pattern irrilevante
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

    // Gestione speciale per test unitari
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

    // Gestione normale per altri tipi di errori
    for (const pattern of allPatterns) {
      if (pattern.pattern.test(line)) {
        errors.push(line);
        break;
      }
    }
  }

  // Aggiungi l'ultimo blocco di errore se presente
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

    // Inizia a raccogliere l'errore quando trova il pattern "fatal: [host]: FAILED! => {"
    if (isAnsibleIntegrationError(line)) {
      isCollectingError = true;
      bracesCount = 1; // Prima parentesi graffa trovata
      currentError = [line];
      continue;
    }

    if (isCollectingError) {
      currentError.push(line);
      
      // Conta le parentesi graffe per gestire JSON nidificati
      bracesCount += (line.match(/{/g) || []).length;
      bracesCount -= (line.match(/}/g) || []).length;

      // Se abbiamo raggiunto lo stesso numero di parentesi aperte e chiuse
      if (bracesCount === 0) {
        errors.push(currentError.join('\n'));
        isCollectingError = false;
        currentError = [];
      }
    }
  }

  // Se c'è un errore incompleto alla fine, aggiungilo comunque
  if (currentError.length > 0) {
    errors.push(currentError.join('\n'));
  }

  return { jobName, errors };
}

export function selectParser(jobName: string): (logs: string, jobName: string) => ParsedError {
  // Usa il parser specifico per i test di integrazione
  if (jobName.toLowerCase().includes('integration')) {
    return ansibleIntegrationParser;
  }
  return defaultParser;
}