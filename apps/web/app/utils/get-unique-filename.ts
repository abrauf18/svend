import { getFileNameFromUrl } from './get-filename-from-url';

export const getUniqueFileName = (
  fileName: string,
  existingFiles: (File | string)[],
): string => {
  const extension = fileName.match(/\.[^/.]+$/)?.[0] || '';
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  let newFileName = fileName;
  let counter = 1;

  // Check against both current Files and existing storage paths
  const existingNames = existingFiles.map((file) =>
    file instanceof File ? file.name : getFileNameFromUrl(file as string),
  );

  while (existingNames.includes(newFileName)) {
    newFileName = `${nameWithoutExt}_${String(counter).padStart(2, '0')}${extension}`;
    counter++;
  }

  return newFileName;
};
