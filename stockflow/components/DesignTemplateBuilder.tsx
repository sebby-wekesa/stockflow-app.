"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createDesign } from '@/app/actions/designs';
import { getRawMaterials } from '@/app/actions/materials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, X, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { designSchema } from '@/lib/schemas';

interface Stage {
  id: string;
  name: string;
  department: string;
  sequence: number;
  specifications?: Record<string, string>;
  specificationText?: string;
}

interface DesignTemplateBuilderProps {
  onComplete?: (design: any) => void;
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

const AVAILABLE_STAGES = [
  { name: 'Cutting', department: 'Cutting' },
  { name: 'Chamfering', department: 'Cutting' },
  { name: 'Forging', department: 'Forging' },
  { name: 'Skimming', department: 'Forging' },
  { name: 'Threading', department: 'Threading' },
  { name: 'Locking', department: 'Threading' },
  { name: 'Electroplating', department: 'Electroplating' },
  { name: 'Drilling', department: 'Drilling' },
  { name: 'Grinding', department: 'Grinding' },
  { name: 'Heat Treatment', department: 'Heat Treatment' },
  { name: 'Quality Control', department: 'Quality Control' },
  { name: 'Packaging', department: 'Packaging' }
];

export function DesignTemplateBuilder({ onComplete, initialData }: DesignTemplateBuilderProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);

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

  const loadRawMaterials = async () => {
    try {
      setLoading(true);
      const materials = await getRawMaterials();
      setRawMaterials(materials);
    } catch (err: any) {
      setError('Failed to load raw materials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRawMaterials();
  }, []);

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
    } catch (err: any) {
      setError(err.message || 'Failed to create design template');
    } finally {
      setSaving(false);
    }
  };

  const availableStages = AVAILABLE_STAGES.filter(
    template => !formData.stages.some(s => s.name === template.name && s.department === template.department)
  );

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Design Template Builder</CardTitle>
        <CardDescription>
          Create standardized product designs with sequential production stages and material requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Design Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Hex Bolt M12"
                required
              />
            </div>
            <div>
              <Label htmlFor="code">Design Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. HB-M12"
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g. Bolt"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of the design..."
              rows={2}
            />
          </div>

          {/* Material Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="rawMaterial">Raw Material</Label>
              <Select
                value={formData.rawMaterialId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, rawMaterialId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select raw material" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific material</SelectItem>
                  {rawMaterials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.materialName} ({material.diameter}, {material.length || '—'} L / {material.width || '—'} W/D / {material.height || '—'} H)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="targetDimensions">Target Dimensions</Label>
              <Input
                id="targetDimensions"
                value={formData.targetDimensions}
                onChange={(e) => setFormData(prev => ({ ...prev, targetDimensions: e.target.value }))}
                placeholder="e.g. M12 × 70mm"
              />
            </div>
            <div>
              <Label htmlFor="targetWeight">Target Weight (kg)</Label>
              <Input
                id="targetWeight"
                type="number"
                step="0.001"
                value={formData.targetWeight}
                onChange={(e) => setFormData(prev => ({ ...prev, targetWeight: parseFloat(e.target.value) || 0 }))}
                placeholder="0.000"
              />
            </div>
          </div>

          {/* Product Specifications */}
          <div>
            <Label>Product Specifications</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <Label htmlFor="rodDiameter" className="text-xs text-gray-600">Rod Diameter</Label>
                <Input
                  id="rodDiameter"
                  value={formData.rodDiameter}
                  onChange={(e) => setFormData(prev => ({ ...prev, rodDiameter: e.target.value }))}
                  placeholder="e.g. 12 mm"
                />
              </div>
              <div>
                <Label htmlFor="length" className="text-xs text-gray-600">Length</Label>
                <Input
                  id="length"
                  value={formData.length}
                  onChange={(e) => setFormData(prev => ({ ...prev, length: e.target.value }))}
                  placeholder="e.g. 70 mm"
                />
              </div>
              <div>
                <Label htmlFor="threadSize" className="text-xs text-gray-600">Thread Size</Label>
                <Input
                  id="threadSize"
                  value={formData.threadSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, threadSize: e.target.value }))}
                  placeholder="e.g. M12"
                />
              </div>
              <div>
                <Label htmlFor="headType" className="text-xs text-gray-600">Head Type</Label>
                <Input
                  id="headType"
                  value={formData.headType}
                  onChange={(e) => setFormData(prev => ({ ...prev, headType: e.target.value }))}
                  placeholder="e.g. Hex"
                />
              </div>
              <div>
                <Label htmlFor="finish" className="text-xs text-gray-600">Finish</Label>
                <Input
                  id="finish"
                  value={formData.finish}
                  onChange={(e) => setFormData(prev => ({ ...prev, finish: e.target.value }))}
                  placeholder="e.g. Hot Dip Galvanized"
                />
              </div>
              <div>
                <Label htmlFor="expectedYield" className="text-xs text-gray-600">Expected Yield (%)</Label>
                <Input
                  id="expectedYield"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.expectedYield}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedYield: parseFloat(e.target.value) || 0 }))}
                  placeholder="88"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="kgPerUnit">Kg per Finished Unit *</Label>
            <Input
              id="kgPerUnit"
              type="number"
              step="0.001"
              value={formData.kgPerUnit}
              onChange={(e) => setFormData(prev => ({ ...prev, kgPerUnit: parseFloat(e.target.value) || 0 }))}
              placeholder="0.000"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The material consumption rate for producing one finished unit
            </p>
          </div>

          {/* Production Stages */}
          <div>
            <Label>Production Stages *</Label>
            <p className="text-xs text-gray-500 mb-3">
              Define the sequential production stages required for this design
            </p>

            {/* Current Stages */}
            <div className="space-y-2 mb-4">
              {formData.stages.map((stage, index) => (
                <div key={stage.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <Badge variant="outline">{stage.sequence}</Badge>
                    <div className="flex-1">
                      <span className="font-medium">{stage.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({stage.department})</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStage(stage.id, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveStage(stage.id, 'down')}
                        disabled={index === formData.stages.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStage(stage.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    className="mt-3"
                    value={stage.specificationText || ''}
                    onChange={(e) => updateStageSpecificationText(stage.id, e.target.value)}
                    placeholder={`Stage specifications, one per line. Example:\nInput Diameter: 12 mm\nOutput Length: 70 mm`}
                    rows={2}
                  />
                </div>
              ))}
            </div>

            {/* Available Stages */}
            <div>
              <Label className="text-sm text-gray-600">Available Stages</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableStages.map((stage) => (
                  <Button
                    key={`${stage.name}-${stage.department}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStage(stage)}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {stage.name}
                  </Button>
                ))}
              </div>
              {availableStages.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">All available stages have been added</p>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={saving || formData.stages.length === 0}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Design...
                </>
              ) : (
                'Create Design Template'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
