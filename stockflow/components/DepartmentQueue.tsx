"use client";

import { Clock, Box, Scale, ChevronRight, Hash } from "lucide-react";
import { useState, useEffect } from "react";
import { StageLogForm } from './operator/StageLogForm';

// Define proper TypeScript interfaces
interface ApiOrder {
  id: string;
  code: string;
  designName: string;
  targetDimensions?: string;
  targetKg: number;
  currentStage?: number;
  status: string;
  currentStageId: string;
  currentDept: string;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  design: {
    name: string;
    targetDim: string;
  };
  inheritedKg: number;
  targetKg: number;
  currentStage: number;
  status: string;
  currentStageId: string;
  currentDept: string;
}

interface DepartmentQueueProps {
  userDept: string;
}

export function DepartmentQueue({ userDept }: DepartmentQueueProps) {
  const [jobs, setJobs] = useState<ProductionOrder[]>([]);
  const [activeJob, setActiveJob] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    if (userDept) {
      (async () => {
        try {
          const response = await fetch(`/api/production-orders?dept=${userDept}&status=IN_PRODUCTION`);
          if (response.ok) {
            const result = await response.json();
            // Transform API response to match our interface
            const transformedJobs = result.data.map((order: ApiOrder) => ({
              id: order.id,
              orderNumber: order.code,
              design: {
                name: order.designName,
                targetDim: order.targetDimensions || "Standard"
              },
              inheritedKg: order.targetKg,
              targetKg: order.targetKg,
              currentStage: order.currentStage || 1,
              status: order.status,
              currentStageId: order.currentStageId,
              currentDept: order.currentDept,
            }));
            setJobs(transformedJobs);
          }
        } catch (error) {
          console.error('Failed to fetch jobs:', error);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [userDept]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          display: 'inline-block',
          marginRight: '12px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--border2)',
            borderTop: '2px solid var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <span style={{ color: 'var(--muted)' }}>Loading jobs...</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: 'var(--font-head)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '4px'
          }}>
            {userDept} Queue
          </h3>
          <p style={{
            fontSize: '13px',
            color: 'var(--muted)'
          }}>
            Active jobs assigned to your station
          </p>
        </div>
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius)',
          padding: '8px 12px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--muted)',
            marginRight: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            LOAD:
          </span>
          <span style={{
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--blue)',
            fontWeight: 500
          }}>
            {jobs.length} Jobs
          </span>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--muted)'
        }}>
          <div style={{
            display: 'inline-block',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '16px',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius)',
              display: 'inline-block'
            }}>
              <Box size={24} style={{ color: 'var(--muted)' }} />
            </div>
          </div>
          <p style={{
            fontSize: '14px',
            color: 'var(--muted)',
            marginBottom: '4px'
          }}>
            No active jobs in queue
          </p>
          <p style={{
            fontSize: '12px',
            color: 'var(--muted)'
          }}>
            Jobs will appear here when assigned
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                cursor: 'pointer',
                transition: 'border-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              onClick={() => setActiveJob(job)}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                width: '100%'
              }}>
                <div style={{
                  padding: '12px',
                  background: 'var(--surface2)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--blue)',
                  transition: 'transform 0.15s'
                }}>
                  <Box size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    fontFamily: 'var(--font-head)',
                    marginBottom: '6px'
                  }}>
                    {job.design.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={12} />
                      Received 2h ago
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Hash size={12} />
                      {job.orderNumber}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%'
              }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '4px'
                  }}>
                    Incoming Weight
                  </p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '18px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--text)'
                  }}>
                    <Scale size={16} style={{ color: 'var(--blue)' }} />
                    {job.inheritedKg}
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 400,
                      opacity: 0.7
                    }}>
                      kg
                    </span>
                  </div>
                </div>

                <button
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  LOG PRODUCTION
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      
      {activeJob && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{ maxWidth: '800px', width: '100%' }}>
            <button
              onClick={() => setActiveJob(null)}
              style={{
                color: 'var(--text)',
                background: 'none',
                border: 'none',
                fontSize: '13px',
                marginBottom: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text)'}
            >
              ← Back to Queue
            </button>
            <StageLogForm
              order={activeJob}
              onComplete={() => {
                setActiveJob(null);
                fetchJobs();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}