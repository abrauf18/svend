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
