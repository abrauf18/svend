export const sanitizeFileName = (fileName: string) => {
  // Replace spaces with underscores and remove other non-alphanumeric characters
  return fileName.replace(/\s+/g, '_').replace(/[^\w.-]+/g, '');
};
