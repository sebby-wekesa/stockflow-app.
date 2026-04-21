// components/admin/ImportPortal.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { bulkImportDesigns } from "@/lib/actions/import";

export default function ImportPortal() {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const res = await bulkImportDesigns(data);
      alert(res.success ? `Successfully imported ${res.count} designs!` : res.error);
      setIsUploading(false);
    };
    
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 text-center">
      <h3 className="text-lg font-bold mb-2">Bulk Import Designs</h3>
      <p className="text-sm text-gray-500 mb-4">Upload your .xlsx or .csv file matching the system template.</p>
      
      <label className="inline-block cursor-pointer bg-black text-white px-6 py-2 rounded-lg font-medium">
        {isUploading ? "Processing..." : "Select File"}
        <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} disabled={isUploading} />
      </label>
      
      <div className="mt-4">
        <a href="/templates/design_import_sample.xlsx" className="text-xs text-blue-600 underline">
          Download Sample Template
        </a>
      </div>
    </div>
  );
}