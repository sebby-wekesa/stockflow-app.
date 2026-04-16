"use client";

export async function addRawMaterial(formData: FormData) {
  const data = {
    materialName: formData.get("materialName"), // e.g., "High-Tensile Steel"
    diameter: formData.get("diameter"),         // e.g., "M12"
    kgReceived: parseFloat(formData.get("kg") as string),
    supplier: formData.get("supplier"),
  };

  const response = await fetch('/api/inventory/intake', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to log intake");
  return response.json();
}