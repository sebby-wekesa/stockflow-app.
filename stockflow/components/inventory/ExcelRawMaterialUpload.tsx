"use client";

import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { receiveRawMaterialsBatch } from "@/actions/raw-materials";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";

export default function ExcelRawMaterialUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      setParsedData(jsonData);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!parsedData || parsedData.length === 0) return;
    setIsUploading(true);
    setUploadResult(null);
    try {
      const result = await receiveRawMaterialsBatch(parsedData);
      setUploadResult(result);
    } catch (error: any) {
      setUploadResult({ success: false, error: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setParsedData(null);
    setUploadResult(null);
  };

  return (
    <>
      <button className="btn btn-primary flex items-center gap-2" onClick={() => setIsOpen(true)}>
        <Upload size={18} />
        Bulk Intake (Excel)
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-[#1e2330] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <h2 className="text-xl font-semibold text-white">Upload Material Receipts</h2>
                <p className="text-sm text-gray-400 mt-1">Upload an Excel (.xlsx) file to receive stock in bulk.</p>
              </div>
              <button 
                onClick={() => { setIsOpen(false); reset(); }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {uploadResult ? (
                <div className={`p-6 rounded-xl border ${uploadResult.success ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    {uploadResult.success ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                    <h3 className="text-lg font-medium">
                      {uploadResult.success ? 'Upload Complete' : 'Upload Failed'}
                    </h3>
                  </div>
                  {uploadResult.results && (
                    <div className="space-y-2 text-sm text-gray-300">
                      <p><span className="text-white font-medium">Success:</span> {uploadResult.results.success} rows processed</p>
                      <p><span className="text-white font-medium">Failed:</span> {uploadResult.results.failed} rows</p>
                      {uploadResult.results.errors.length > 0 && (
                        <div className="mt-4 p-4 bg-black/20 rounded-lg text-red-400/80 max-h-40 overflow-y-auto text-xs">
                          {uploadResult.results.errors.map((err: string, i: number) => (
                            <div key={i} className="mb-1">{err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {uploadResult.error && <p className="text-sm mt-2">{uploadResult.error}</p>}
                </div>
              ) : !file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
                    <FileSpreadsheet size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Click or drag Excel file here</h3>
                  <p className="text-sm text-gray-400 max-w-sm">
                    Ensure your file contains SKU, Material Name, Diameter, Kg Received, and Reference columns.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={(e) => e.target.files && processFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="text-blue-400" size={24} />
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB • {parsedData?.length || 0} rows</p>
                      </div>
                    </div>
                    <button onClick={reset} className="text-sm text-red-400 hover:text-red-300 px-3 py-1 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors">
                      Remove
                    </button>
                  </div>

                  {parsedData && parsedData.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Preview (First 3 rows)</h4>
                      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white/5 text-gray-300">
                            <tr>
                              {Object.keys(parsedData[0]).map((key) => (
                                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {parsedData.slice(0, 3).map((row, i) => (
                              <tr key={i} className="hover:bg-white/[0.02]">
                                {Object.values(row).map((val: any, j) => (
                                  <td key={j} className="px-4 py-3 text-gray-300 whitespace-nowrap">{val}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {parsedData.length > 3 && (
                        <div className="text-center text-xs text-gray-500 mt-2">
                          + {parsedData.length - 3} more rows
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-3">
              {uploadResult ? (
                <button
                  className="btn bg-white/10 hover:bg-white/20 text-white"
                  onClick={() => { setIsOpen(false); reset(); }}
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    className="btn bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    onClick={() => { setIsOpen(false); reset(); }}
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-2"
                    onClick={handleUpload}
                    disabled={!file || !parsedData || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Import Data
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
