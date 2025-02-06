import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

type Props = {
  attachment: File | string;
};

export default function AttachmentRender({ attachment }: Props) {
  const [tableData, setTableData] = useState<any[]>([]);

  async function getTableData() {
    if (!(attachment instanceof File)) return;

    const fileText = await attachment.text();

    const parsedFile = Papa.parse(fileText, { header: true });

    if (parsedFile.data) setTableData(parsedFile.data);
  }

  useEffect(() => {
    getTableData();
  }, []);

  return tableData.length > 0 ? (
    <Table>
      <TableHeader>
        <TableRow>
          {Object.keys(tableData.at(0)).map((col) => (
            <TableHead key={col}>{col}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableData.map((row, index) => (
          <TableRow key={index}>
            {Object.values(row).map((value) => (
              <TableCell key={value as any}>{value as any}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : null;
}
