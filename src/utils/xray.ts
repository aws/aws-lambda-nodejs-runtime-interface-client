interface XRayFormattedError {
  working_directory: string;
  exceptions: Array<{
    type: string;
    message: string;
    stack: Array<{
      path: string;
      line: number;
      label: string;
    }>;
  }>;
  paths: string[];
}

export function formatXRayError(error: Error): string {
  try {
    const formatted: XRayFormattedError = {
      working_directory: process.cwd(),
      exceptions: [
        {
          type: error.name?.replaceAll("\x7F", "%7F"),
          message: error.message?.replaceAll("\x7F", "%7F"),
          stack: parseStackTrace(error.stack),
        },
      ],
      paths: [],
    };

    // Collect unique paths
    formatted.paths = formatted.exceptions[0].stack
      .map((entry) => entry.path)
      .filter((value, index, self) => self.indexOf(value) === index);

    return JSON.stringify(formatted);
  } catch {
    return "";
  }
}

function parseStackTrace(
  stack?: string,
): Array<{ path: string; line: number; label: string }> {
  if (!stack) return [];

  const lines = stack.replaceAll("\x7F", "%7F").split("\n");
  lines.shift(); // Remove the first line (error message)

  return lines.map((line) => {
    const trimmed = line
      .trim()
      .replace(/[()]/g, "")
      .replace(/^[^\s]*\s/, "");
    const lastSpaceIndex = trimmed.lastIndexOf(" ");

    const label =
      lastSpaceIndex >= 0 ? trimmed.slice(0, lastSpaceIndex) : "anonymous";
    const pathParts = (
      lastSpaceIndex >= 0 ? trimmed.slice(lastSpaceIndex + 1) : trimmed
    ).split(":");

    return {
      path: pathParts[0],
      line: parseInt(pathParts[1]),
      label,
    };
  });
}
