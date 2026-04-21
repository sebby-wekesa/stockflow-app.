// components/operator/QRScanner.tsx
"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect } from "react";
import { handleScan } from "@/lib/actions/scanning";

export default function QRScanner() {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader", 
      { fps: 10, qrbox: { width: 250, height: 250 } }, 
      /* verbose= */ false
    );

    scanner.render(
      async (decodedText) => {
        scanner.clear(); // Stop scanning once found
        await handleScan(decodedText);
      },
      (error) => {
        // Silent error for continuous scanning
      }
    );

    return () => scanner.clear();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-2xl shadow-lg">
      <h2 className="text-center font-bold text-lg mb-4">Scan Job Card</h2>
      <div id="reader" className="overflow-hidden rounded-xl"></div>
      <p className="mt-4 text-center text-sm text-gray-500 italic">
        Point the camera at the QR code on the production order sheet.
      </p>
    </div>
  );
}