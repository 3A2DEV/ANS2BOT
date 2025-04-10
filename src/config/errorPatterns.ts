export interface ErrorPattern {
  pattern: RegExp;
  description: string;
  category?: string;
  multiline?: boolean;
  startPattern?: RegExp;
  endPattern?: RegExp;
}

export const commonPatterns: ErrorPattern[] = [
  {
    pattern: /error\s*[:!]/i,
    description: "General error detected",
    category: "common"
  },
  {
    pattern: /failed\s*[:!]/i,
    description: "Failure detected",
    category: "common"
  },
  {
    pattern: /fatal\s*[:!]/i,
    description: "Fatal error detected",
    category: "common"
  }
];

export const pythonPatterns: ErrorPattern[] = [
  {
    pattern: /Traceback \(most recent call last\):/,
    description: "Python traceback",
    category: "python"
  },
  {
    pattern: /^\s*File "(.+)", line (\d+)/m,
    description: "Python file location",
    category: "python"
  },
  {
    pattern: /ImportError: No module named/i,
    description: "Python import error",
    category: "python"
  },
  {
    pattern: /IndentationError:/i,
    description: "Python indentation error",
    category: "python"
  },
  {
    pattern: /SyntaxError:/i,
    description: "Python syntax error",
    category: "python"
  },
  {
    pattern: /NameError:/i,
    description: "Python name error",
    category: "python"
  },
  {
    pattern: /TypeError:/i,
    description: "Python type error",
    category: "python"
  },
  {
    pattern: /ValueError:/i,
    description: "Python value error",
    category: "python"
  },
  {
    pattern: /AttributeError:/i,
    description: "Python attribute error",
    category: "python"
  }
];

export const yamlPatterns: ErrorPattern[] = [
  {
    pattern: /yaml\.(?:parser|scanner|reader)\.(?:Parser|Scanner|Reader)Error/i,
    description: "YAML parsing error",
    category: "yaml"
  },
  {
    pattern: /mapping values are not allowed here/i,
    description: "YAML mapping error",
    category: "yaml"
  },
  {
    pattern: /found character '\\t' that cannot start any token/i,
    description: "YAML tab character error",
    category: "yaml"
  },
  {
    pattern: /found unexpected end of stream/i,
    description: "YAML unexpected end",
    category: "yaml"
  },
  {
    pattern: /expected <?[^>]+>, but found/i,
    description: "YAML unexpected token",
    category: "yaml"
  },
  {
    pattern: /block sequence entries are not allowed here/i,
    description: "YAML block sequence error",
    category: "yaml"
  }
];

export const ansiblePatterns: ErrorPattern[] = [
  {
    pattern: /fatal:\s*\[.*?\]:\s*FAILED!/i,
    description: "Ansible Task Failure",
    multiline: true,
    startPattern: /fatal:\s*\[.*?\]:\s*FAILED!\s*=>\s*{/i,
    endPattern: /}\s*$/
  },
  {
    pattern: /ERROR!\s*(.*)/i,
    description: "Ansible Error"
  }
];

// Combine all patterns
export const allPatterns: ErrorPattern[] = [
  ...commonPatterns,
  ...pythonPatterns,
  ...yamlPatterns,
  ...ansiblePatterns
];