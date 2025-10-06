export function buildLines(words: string[], limit: number): string[] {
  if (limit <= 0) {
    return words.length > 0 ? [...words] : [''];
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (word.length === 0) {
      continue;
    }

    if (word.length > limit) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      lines.push(word);
      continue;
    }

    if (!currentLine) {
      currentLine = word;
      continue;
    }

    const nextLength = currentLine.length + 1 + word.length;
    if (nextLength <= limit) {
      currentLine = `${currentLine} ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [''];
  }

  return lines;
}
