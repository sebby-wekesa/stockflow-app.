"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createDesign } from '@/app/actions/designs';
import { getRawMaterials } from '@/app/actions/materials';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { designSchema } from '@/lib/schemas';

type RawMaterialOption = Awaited<ReturnType<typeof getRawMaterials>>[number];
type CreatedDesign = Awaited<ReturnType<typeof createDesign>>;

interface Stage {
  id: string;
  name: string;
  department: string;
  sequence: number;
  specifications?: Record<string, string>;
  specificationText?: string;
}

interface DesignTemplateBuilderProps {
  onComplete?: (design: CreatedDesign) => void;
  initialData?: Partial<{
    name: string;
    code: string;
    category: string;
    description: string;
    targetDimensions: string;
    targetWeight: number;
    expectedYield: number;
    specifications: Record<string, string>;
    rawMaterialId: string;
    kgPerUnit: number;
    stages: Stage[];
  }>;
}

const NO_RAW_MATERIAL_VALUE = 'none';

export function DesignTemplateBuilder({ onComplete, initialData }: DesignTemplateBuilderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialOption[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    code: initialData?.code || '',
    category: initialData?.category || '',
    description: initialData?.description || '',
    targetDimensions: initialData?.targetDimensions || '',
    targetWeight: initialData?.targetWeight || 0,
    expectedYield: initialData?.expectedYield || 88,
    rodDiameter: initialData?.specifications?.rodDiameter || '',
    length: initialData?.specifications?.length || '',
    threadSize: initialData?.specifications?.threadSize || '',
    headType: initialData?.specifications?.headType || '',
    finish: initialData?.specifications?.finish || '',
    rawMaterialId: initialData?.rawMaterialId || '',
    kgPerUnit: initialData?.kgPerUnit || 0,
    stages: initialData?.stages || [] as Stage[]
  });

  const loadRawMaterials = useCallback(async () => {
    try {
      const materials = await getRawMaterials();
      setRawMaterials(materials);
      const departmentsResponse = await fetch('/api/admin/departments');
      if (departmentsResponse.ok) {
        const departmentsJson = await departmentsResponse.json();
        setDepartments(Array.isArray(departmentsJson.departments) ? departmentsJson.departments : []);
      }
    } catch {
      setError('Failed to load design options');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRawMaterials(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRawMaterials]);

  const addStage = (stageTemplate: { name: string; department: string }) => {
    const newStage: Stage = {
      id: crypto.randomUUID(),
      name: stageTemplate.name,
      department: stageTemplate.department,
      sequence: formData.stages.length + 1,
      specificationText: ''
    };

    setFormData(prev => ({
      ...prev,
      stages: [...prev.stages, newStage].map((s, i) => ({ ...s, sequence: i + 1 }))
    }));
  };

  const parseSpecificationText = (text?: string) => {
    const specs: Record<string, string> = {};
    for (const line of (text || '').split('\n')) {
      const [rawKey, ...rawValue] = line.split(':');
      const key = rawKey?.trim();
      const value = rawValue.join(':').trim();
      if (key && value) specs[key] = value;
    }
    return specs;
  };

  const updateStageSpecificationText = (stageId: string, specificationText: string) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages.map(stage =>
        stage.id === stageId ? { ...stage, specificationText } : stage
      )
    }));
  };

  const removeStage = (stageId: string) => {
    setFormData(prev => ({
      ...prev,
      stages: prev.stages
        .filter(s => s.id !== stageId)
        .map((s, i) => ({ ...s, sequence: i + 1 }))
    }));
  };

  const moveStage = (stageId: string, direction: 'up' | 'down') => {
    const currentIndex = formData.stages.findIndex(s => s.id === stageId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= formData.stages.length) return;

    const newStages = [...formData.stages];
    [newStages[currentIndex], newStages[newIndex]] = [newStages[newIndex], newStages[currentIndex]];

    setFormData(prev => ({
      ...prev,
      stages: newStages.map((s, i) => ({ ...s, sequence: i + 1 }))
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form data
    if (formData.stages.length === 0) {
      setError('At least one production stage is required');
      return;
    }

    try {
      setSaving(true);

      const designData = {
        name: formData.name,
        code: formData.code,
        category: formData.category || undefined,
        description: formData.description || undefined,
        targetDimensions: formData.targetDimensions || undefined,
        targetWeight: formData.targetWeight || undefined,
        expectedYield: formData.expectedYield || undefined,
        specifications: {
          rodDiameter: formData.rodDiameter,
          length: formData.length,
          threadSize: formData.threadSize,
          headType: formData.headType,
          finish: formData.finish
        },
        rawMaterialId: formData.rawMaterialId || undefined,
        kgPerUnit: formData.kgPerUnit,
        bomItems: formData.rawMaterialId && formData.kgPerUnit > 0
          ? [{
              rawMaterialId: formData.rawMaterialId,
              quantity: formData.kgPerUnit,
              unitOfMeasure: 'kg'
            }]
          : [],
        stages: formData.stages.map(s => ({
          name: s.name,
          department: s.department,
          sequence: s.sequence,
          specifications: parseSpecificationText(s.specificationText)
        }))
      };

      // Validate with Zod schema
      designSchema.parse(designData);

      const result = await createDesign(designData);

      if (onComplete) {
        onComplete(result);
      } else {
        router.push('/designs');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create design template');
    } finally {
      setSaving(false);
    }
  };

  const availableStages = departments
    .map((department) => ({ name: department, department }))
    .filter(
      template => !formData.stages.some(s => s.name === template.name && s.department === template.department)
    );

  return (
    <form onSubmit={handleSubmit} className="design-builder">
      {error && (
        <div className="design-error">
          {error}
        </div>
      )}

      <div className="card design-card">
        <div className="design-card-header">
          <div>
            <div className="section-title">Template details</div>
            <div className="section-sub">Product identity, dimensions, yield, and material consumption</div>
          </div>
        </div>

        <div className="design-form-grid two">
          <div className="form-group">
            <Label htmlFor="name" className="form-label">Design name *</Label>
              <Input
                id="name"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Design name"
                required
              />
          </div>
          <div className="form-group">
            <Label htmlFor="code" className="form-label">Design code *</Label>
              <Input
                id="code"
                className="form-input"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Design code"
                required
              />
          </div>
          <div className="form-group">
            <Label htmlFor="category" className="form-label">Category</Label>
              <Input
                id="category"
                className="form-input"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Category"
              />
          </div>
          <div className="form-group">
            <Label htmlFor="rawMaterial" className="form-label">Raw material</Label>
            <Select
              value={formData.rawMaterialId || NO_RAW_MATERIAL_VALUE}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                rawMaterialId: value === NO_RAW_MATERIAL_VALUE ? '' : value
              }))}
            >
              <SelectTrigger className="form-input design-select-trigger">
                <SelectValue placeholder={loading ? "Loading materials..." : "Select raw material"} />
              </SelectTrigger>
              <SelectContent className="design-select-content">
                <SelectItem className="design-select-item" value={NO_RAW_MATERIAL_VALUE}>No specific material</SelectItem>
                {rawMaterials.map((material) => (
                  <SelectItem className="design-select-item" key={material.id} value={material.id}>
                    {material.materialName} ({material.diameter}, {material.length || '—'} L / {material.width || '—'} W/D / {material.height || '—'} H)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="form-group">
          <Label htmlFor="description" className="form-label">Description</Label>
            <Textarea
              id="description"
              className="form-input design-textarea"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of the design..."
              rows={2}
            />
        </div>

        <div className="design-form-grid three">
          <div className="form-group">
            <Label htmlFor="targetDimensions" className="form-label">Target dimensions</Label>
              <Input
                id="targetDimensions"
                className="form-input"
                value={formData.targetDimensions}
                onChange={(e) => setFormData(prev => ({ ...prev, targetDimensions: e.target.value }))}
                placeholder="Target dimensions"
              />
          </div>
          <div className="form-group">
            <Label htmlFor="targetWeight" className="form-label">Target weight (kg)</Label>
              <Input
                id="targetWeight"
                type="number"
                step="0.001"
                className="form-input"
                value={formData.targetWeight}
                onChange={(e) => setFormData(prev => ({ ...prev, targetWeight: parseFloat(e.target.value) || 0 }))}
                placeholder="0.000"
              />
          </div>
          <div className="form-group">
            <Label htmlFor="kgPerUnit" className="form-label">Kg per finished unit *</Label>
            <Input
              id="kgPerUnit"
              type="number"
              step="0.001"
              className="form-input"
              value={formData.kgPerUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, kgPerUnit: parseFloat(e.target.value) || 0 }))}
              placeholder="0.000"
              required
            />
          </div>
        </div>
      </div>

      <div className="card design-card">
        <div className="design-card-header">
          <div>
            <div className="section-title">Product specifications</div>
            <div className="section-sub">Optional attributes used by production and reporting</div>
          </div>
        </div>

        <div className="design-form-grid three">
          <div className="form-group">
            <Label htmlFor="rodDiameter" className="form-label">Rod diameter</Label>
            <Input
              id="rodDiameter"
              className="form-input"
              value={formData.rodDiameter}
              onChange={(e) => setFormData(prev => ({ ...prev, rodDiameter: e.target.value }))}
              placeholder="Rod diameter"
            />
          </div>
          <div className="form-group">
            <Label htmlFor="length" className="form-label">Length</Label>
            <Input
              id="length"
              className="form-input"
              value={formData.length}
              onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))}
              placeholder="Length"
            />
          </div>
          <div className="form-group">
            <Label htmlFor="threadSize" className="form-label">Thread size</Label>
            <Input
              id="threadSize"
              className="form-input"
              value={formData.threadSize}
              onChange={(e) => setFormData(prev => ({ ...prev, threadSize: e.target.value }))}
              placeholder="Thread size"
            />
          </div>
          <div className="form-group">
            <Label htmlFor="headType" className="form-label">Head type</Label>
            <Input
              id="headType"
              className="form-input"
              value={formData.headType}
              onChange={(e) => setFormData(prev => ({ ...prev, headType: e.target.value }))}
              placeholder="Head type"
            />
          </div>
          <div className="form-group">
            <Label htmlFor="finish" className="form-label">Finish</Label>
            <Input
              id="finish"
              className="form-input"
              value={formData.finish}
              onChange={(e) => setFormData(prev => ({ ...prev, finish: e.target.value }))}
              placeholder="Finish"
            />
          </div>
          <div className="form-group">
            <Label htmlFor="expectedYield" className="form-label">Expected yield (%)</Label>
            <Input
              id="expectedYield"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="form-input"
              value={formData.expectedYield}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedYield: parseFloat(e.target.value) || 0 }))}
              placeholder="88"
            />
          </div>
        </div>
      </div>

      <div className="card design-card">
        <div className="design-card-header">
          <div>
            <div className="section-title">Production stages *</div>
            <div className="section-sub">Add stages in the sequence operators should follow</div>
          </div>
          <span className="badge badge-purple">{formData.stages.length} selected</span>
        </div>

        <div className="design-stage-list">
          {formData.stages.length === 0 ? (
            <div className="design-empty-stage">No stages selected yet.</div>
          ) : (
            formData.stages.map((stage, index) => (
              <div key={stage.id} className="design-stage-row">
                <div className="design-stage-main">
                  <GripVertical className="design-stage-grip" />
                  <span className="chip-num">{stage.sequence}</span>
                  <div className="design-stage-copy">
                    <div className="design-stage-name">{stage.name}</div>
                    <div className="design-stage-dept">{stage.department}</div>
                  </div>
                  <div className="design-stage-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => moveStage(stage.id, 'up')}
                      disabled={index === 0}
                      aria-label={`Move ${stage.name} up`}
                    >
                      <ArrowUp />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => moveStage(stage.id, 'down')}
                      disabled={index === formData.stages.length - 1}
                      aria-label={`Move ${stage.name} down`}
                    >
                      <ArrowDown />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => removeStage(stage.id)}
                      aria-label={`Remove ${stage.name}`}
                    >
                      <X />
                    </button>
                  </div>
                </div>
                <Textarea
                  className="form-input design-textarea"
                  value={stage.specificationText || ''}
                  onChange={(e) => updateStageSpecificationText(stage.id, e.target.value)}
                  placeholder="Stage specifications, one per line"
                  rows={2}
                />
              </div>
            ))
          )}
        </div>

        <div className="design-available">
          <div className="form-label">Available stages</div>
          <div className="stage-builder">
            {availableStages.map((stage) => (
              <button
                key={`${stage.name}-${stage.department}`}
                type="button"
                className="stage-chip off"
                onClick={() => addStage(stage)}
              >
                <Plus />
                {stage.name}
              </button>
            ))}
            {availableStages.length === 0 && (
              <span className="design-muted">All available stages have been added</span>
            )}
          </div>
        </div>
      </div>

      <div className="design-actions">
        <button type="button" className="btn btn-ghost" onClick={() => router.push('/designs')}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || formData.stages.length === 0}>
          {saving ? (
            <>
              <Loader2 className="spin-icon" />
              Creating design
            </>
          ) : (
            'Create design template'
          )}
        </button>
      </div>
    </form>
  );
}
