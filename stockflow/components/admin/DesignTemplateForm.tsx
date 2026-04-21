"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { saveDesign } from "@/actions/design";
import { useState, useEffect } from "react";

const DEPARTMENTS = ["Cutting", "Forging", "Chamfer", "Threading", "Electroplating", "Packaging"];

export default function DesignBuilder() {
  const [msg, setMsg] = useState("");
  const { register, control, handleSubmit } = useForm({
    defaultValues: {
      name: "", code: "", targetDimensions: "", targetWeight: 0, kgPerUnit: 0,
      stages: [{ name: "Cutting", department: "Cutting", sequence: 1 }]
    }
  });

  const { fields, append, remove, setValue } = useFieldArray({ control, name: "stages" });

  useEffect(() => {
    fields.forEach((field, index) => {
      setValue(`stages.${index}.sequence`, index + 1);
    });
  }, [fields, setValue]);

  const onSubmit = async (data: any) => {
    const res = await saveDesign(data);
    setMsg(res.success ? "Design saved successfully!" : res.error || "Error");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-8 p-6 bg-white rounded-xl shadow">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Product Name (e.g. Hex Bolt M12)</label>
          <input {...register("name")} className="w-full border p-2 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Product Code (Unique ID)</label>
          <input {...register("code")} className="w-full border p-2 rounded" required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Target Dimensions</label>
          <input {...register("targetDimensions")} className="w-full border p-2 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium">Target Weight (kg)</label>
          <input {...register("targetWeight", { valueAsNumber: true })} type="number" step="0.01" className="w-full border p-2 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium">KG per Unit</label>
          <input {...register("kgPerUnit", { valueAsNumber: true })} type="number" step="0.01" className="w-full border p-2 rounded" required />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold border-b pb-2">Production Workflow (Stages)</h3>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-4 items-end bg-gray-50 p-3 rounded">
            <div className="w-12 text-center font-bold text-gray-400">#{index + 1}</div>
            <div className="flex-1">
              <label className="text-xs">Stage Name</label>
              <input {...register(`stages.${index}.name`)} className="w-full border p-1 rounded" />
            </div>
            <div className="flex-1">
              <label className="text-xs">Department Responsible</label>
              <select {...register(`stages.${index}.department`)} className="w-full border p-1 rounded">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => remove(index)} className="text-red-500 mb-1 px-2">Delete</button>
          </div>
        ))}
        <button type="button" onClick={() => append({ name: "", department: "Cutting", sequence: fields.length + 1 })}
                className="text-sm text-blue-600 font-medium">+ Add Process Stage</button>
      </div>

      <button type="submit" className="w-full bg-black text-white p-3 rounded font-bold">Save Design Blueprint</button>
      {msg && <p className="text-center font-medium mt-4">{msg}</p>}
    </form>
  );
}