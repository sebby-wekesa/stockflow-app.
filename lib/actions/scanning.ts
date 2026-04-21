"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function handleScan(scannedData: string) {
  await requireRole("OPERATOR", "ADMIN");

  // Logic: Extract the orderId from the QR string
  // Format could be: stockflow://order/cluj12345...
  const orderId = scannedData.split('/').pop();
  
  if (orderId) {
    // Redirect the operator directly to the logging form for this job
    redirect(`/dashboard/operator/log/${orderId}`);
  }
  
  return { error: "Invalid QR Code" };
}