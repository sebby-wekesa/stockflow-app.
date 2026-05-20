"use client";

import { useState } from "react";
import { importSalesData } from "@/app/actions/import-sales";

export default function SalesImportPage() {
  const [rawData, setRawData] = useState("");
  const [branch, setBranch] = useState("Nairobi");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!rawData.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await importSalesData(rawData, branch);
      setResult(res);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Import Sales Data</h1>

      <div className="mb-4">
        <label className="block mb-1 font-medium">Branch</label>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="Nairobi">Nairobi</option>
          <option value="Mombasa">Mombasa</option>
        </select>
      </div>

      <textarea
        className="w-full h-96 border p-3 font-mono text-sm"
        placeholder="Paste CSV sales data here (Date,Num,Name,...)"
        value={rawData}
        onChange={(e) => setRawData(e.target.value)}
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !rawData.trim()}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Importing..." : "Import Sales"}
      </button>

      {result && (
        <div className="mt-6 p-4 border rounded bg-gray-50">
          {result.error ? (
            <p className="text-red-600">Error: {result.error}</p>
          ) : (
            <p className="text-green-600">✅ Successfully imported {result.imported} sales records.</p>
          )}
        </div>
      )}
    </div>
  );
}
