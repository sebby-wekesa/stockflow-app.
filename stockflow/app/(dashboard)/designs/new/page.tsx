import { createDesign } from "@/actions/design";
import { StageInput } from "@/components/StageInput";

export const dynamic = "force-dynamic";

export default function NewDesignPage() {
  return (
    <div className="max-w-2xl">
      <div className="section-header mb-8">
        <div>
          <h1 className="section-title">Create Design Template</h1>
          <p className="section-sub">Define a new product design with production stages and specifications</p>
        </div>
      </div>

      <form action={createDesign} className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#7a8090] mb-1">
              Design Name *
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full bg-[#1e2023] border border-[#2a2d32] rounded-lg p-3 text-[#e8eaed] outline-none focus:border-[#f0c040] transition-all"
              placeholder="e.g., Hex Bolt M12"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#7a8090] mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full bg-[#1e2023] border border-[#2a2d32] rounded-lg p-3 text-[#e8eaed] outline-none focus:border-[#f0c040] transition-all resize-none"
              placeholder="Product description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#7a8090] mb-1">
                Target Dimensions
              </label>
              <input
                type="text"
                name="targetDimensions"
                className="w-full bg-[#1e2023] border border-[#2a2d32] rounded-lg p-3 text-[#e8eaed] outline-none focus:border-[#f0c040] transition-all"
                placeholder="e.g., 12mm x 50mm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#7a8090] mb-1">
                Target Weight (kg)
              </label>
              <input
                type="number"
                name="targetWeight"
                step="0.01"
                className="w-full bg-[#1e2023] border border-[#2a2d32] rounded-lg p-3 text-[#e8eaed] outline-none focus:border-[#f0c040] transition-all"
                placeholder="0.05"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-[#e8eaed] mb-4">Production Stages</h2>
          <p className="text-sm text-[#7a8090] mb-4">Define the sequence of production stages</p>

          <StageInput />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="px-6 py-2 bg-[#f0c040] text-black font-medium rounded-lg hover:bg-[#f5d060] transition-all"
          >
            Create Design
          </button>
          <a
            href="/designs"
            className="px-6 py-2 border border-[#2a2d32] text-[#7a8090] font-medium rounded-lg hover:bg-[#1e2023] transition-all"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}