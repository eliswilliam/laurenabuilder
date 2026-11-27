const logger = console;

export interface ClarifyQuestion {
  id: string;
  label: string;
  options: string[];
}

export interface ClarifyData {
  question?: string;
  questions: ClarifyQuestion[];
}

export const parseClarifyTag = (fullResponse: string): ClarifyData | null => {
  const match = /<laurenaClarify>([\s\S]*?)<\/laurenaClarify>/i.exec(fullResponse);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed as ClarifyData;
    }
  } catch {}
  return null;
};

// This function performs a regex search for <laurenaAction type="file">
// tags in the fullResponse string.
// Returns an array of objects containing the filePath, content, and optional description.
/**
 * Parse <laurenaAction type="file"> tags from the AI response and return their filePath, content, and optional description.
 */
export const getWriteTags = (fullResponse: string) : {
  path: string;
  content: string;
  description?: string;
}[] => {
  const laurenaActionRegex = /<laurenaAction\s+type="file"([^>]*)>([\s\S]*?)<\/laurenaAction>/gi;
  const pathRegex = /filePath="([^"]+)"/;
  const descriptionRegex = /description="([^"]+)"/;
  
  let match;                   
  const tags: { path: string; content: string; description?: string }[] = [];
  
  while ((match = laurenaActionRegex.exec(fullResponse)) !== null) {
    const attributesString = match[1];
    let content = match[2].trim();
    
    const pathMatch = pathRegex.exec(attributesString);
    const descriptionMatch = descriptionRegex.exec(attributesString);

    if (pathMatch && pathMatch[1]) {
      const path = pathMatch[1];
      const description = descriptionMatch?.[1];
  
      const contentLines = content.split("\n");
      if (contentLines[0]?.startsWith("```")) {
        contentLines.shift();  
      }
      if (contentLines[contentLines.length - 1]?.startsWith("```")) {
        contentLines.pop();    
      }
      content = contentLines.join("\n");
  
      tags.push({ path, content, description });
    } else {
    logger.warn(
      "Found <laurenaAction type=\"file\"> tag without a valid 'filePath' attribute:",
      match[0]
    );
    }
  }
  return tags;
}




export const processResponse = (fullResponse: string) => {
  const clarifyData = parseClarifyTag(fullResponse);
  const writeTags = getWriteTags(fullResponse);
  const filesToCreate: Record<string, string> = {};

  for (const tag of writeTags) {
    filesToCreate[tag.path] = tag.content;
    console.log("Creating file:", tag.path);
  }

  return { filesToCreate, clarifyData };
}
