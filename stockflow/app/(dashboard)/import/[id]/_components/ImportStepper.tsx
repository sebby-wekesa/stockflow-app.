import type { ImportStatus } from '@prisma/client'

interface ImportStepperProps {
  status: ImportStatus
}

const STEPS = [
  { key: 'uploaded', label: 'Upload', description: 'File uploaded' },
  { key: 'mapping', label: 'Map Columns', description: 'Configure column mappings' },
  { key: 'validating', label: 'Validate', description: 'Validate and match products' },
  { key: 'preview', label: 'Review', description: 'Review matches and conflicts' },
  { key: 'committing', label: 'Commit', description: 'Write to database' },
  { key: 'imported', label: 'Complete', description: 'Import completed' },
] as const

export function ImportStepper({ status }: ImportStepperProps) {
  const currentIndex = STEPS.findIndex(step => step.key === status)

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.key} className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-2 ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                  ? 'bg-blue-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </div>
            <div className="text-center">
              <div className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted'}`}>
                {step.label}
              </div>
              <div className="text-xs text-muted mt-1 hidden sm:block">
                {step.description}
              </div>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`absolute top-4 left-1/2 w-full h-0.5 mt-2 ${
                  isCompleted ? 'bg-green-500' : 'bg-muted'
                }`}
                style={{ transform: 'translateX(50%)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}