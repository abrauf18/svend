// Update the getFileNameFromUrl function
export const getFileNameFromUrl = (filePath: string) => {
  try {
    const pathParts = filePath.split('/');
    return decodeURIComponent(pathParts[pathParts.length - 1] ?? '');
  } catch (error: unknown) {
    console.error('Error extracting filename:', error);
    return '';
  }
};

export function getUniqueFileName(filename: string): string {
  const uniqueId = crypto.randomUUID();
  const lastDotIndex = filename.lastIndexOf('.');
  
  if (lastDotIndex === -1) {
    // No extension
    return `${filename}-${uniqueId}`;
  }
  
  // Has extension
  const name = filename.slice(0, lastDotIndex);
  const ext = filename.slice(lastDotIndex);
  return `${name}-${uniqueId}${ext}`;
}

export const sanitizeFileName = (fileName: string) => {
  // Replace spaces with underscores and remove other non-alphanumeric characters
  return fileName.replace(/\s+/g, '_').replace(/[^\w.-]+/g, '');
};
