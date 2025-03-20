import { Button } from '@kit/ui/button';
import { File } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

type Props = {
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  setIsImportingFile: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function CSVUploader({ onChange, setIsImportingFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.addEventListener('cancel', () => setIsImportingFile(false));
    }

    return () => {
      if (ref.current) {
        ref.current.removeEventListener('cancel', () =>
          setIsImportingFile(false),
        );
      }
    };
  }, []);

  return (
    <Button 
      className="w-fit mt-4"
      >
      <File className="size-5 mr-2" />
      <p className="text-sm">Upload CSV</p>
      <input
        type="file"
        accept=".csv"
        onChange={onChange}
        ref={ref}
        onClick={() => setIsImportingFile(true)}
        className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
      />
    </Button>
  );
}
