'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { getStagesForCategory } from '@/lib/production'
import type { ProductCategory } from '@prisma/client'

async function requireUser() {
  const supabase = createServerSupabase()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')
  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) throw new Error('User not provisioned')
  return user
}

async function requireProductionAccess() {
  const user = await requireUser()
  if (!['admin', 'manager', 'warehouse'].includes(user.role)) {
    throw new Error('Only admins, managers, and warehouse staff can manage production')
  }
  return user
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE JOB CARD
// Picks a manufactured product, sets target qty, optionally pre-issues raw material.
// All stages are created up front so the workflow knows what's coming.
// ─────────────────────────────────────────────────────────────────────────────

const createJobSchema = z.object({
  product_id: z.string().min(1),
  qty_ordered: z.coerce.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
  raw_material_id: z.string().optional().nullable(),
  qty_bars: z.coerce.number().int().nonnegative().optional().nullable(),
  qty_kg: z.coerce.number().nonnegative().optional().nullable(),
})

export async function createJobCard(formData: FormData) {
  const user = await requireProductionAccess()

  const raw = {
    product_id: formData.get('product_id'),
    qty_ordered: formData.get('qty_ordered'),
    notes: formData.get('notes') || null,
    raw_material_id: formData.get('raw_material_id') || null,
    qty_bars: formData.get('qty_bars') || null,
    qty_kg: formData.get('qty_kg') || null,
  }
  const parsed = createJobSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const data = parsed.data

  const product = await prisma.product.findUnique({
    where: { id: data.product_id },
    select: { id: true, product_code: true, category: true },
  })
  if (!product) throw new Error('Product not found')
  if (!['manufactured_spring', 'manufactured_ubolt'].includes(product.category)) {
    throw new Error('Job cards can only be created for manufactured products')
  }

  const stages = getStagesForCategory(product.category as ProductCategory)
  if (stages.length === 0) throw new Error('No stages defined for this product type')

  // If raw material was provided, validate availability before starting
  if (data.raw_material_id && data.qty_bars && data.qty_kg) {
    const balance = await prisma.rawMaterialBalance.findUnique({
      where: { raw_material_id: data.raw_material_id },
    })
    if (!balance || balance.qty_bars < data.qty_bars || Number(balance.qty_kg) < data.qty_kg) {
      throw new Error(
        `Insufficient raw material: have ${balance?.qty_bars ?? 0} bars / ${balance?.qty_kg ?? 0}kg, need ${data.qty_bars}/${data.qty_kg}kg`
      )
    }
  }

  // Create everything in a transaction
  const job = await prisma.$transaction(async (tx) => {
    const j = await tx.jobCard.create({
      data: {
        product_id: data.product_id,
        qty_ordered: data.qty_ordered,
        opened_date: new Date(),
        status: 'open',
        notes: data.notes,
        created_by: user.id,
      },
    })

    // Create all stages with stage 1 as "open" (qty_in = qty_ordered, qty_out unset)
    for (const stage of stages) {
      await tx.jobCardStage.create({
        data: {
          job_card_id: j.id,
          stage_number: stage.number,
          stage_name: stage.key,
          qty_in: stage.number === 1 ? data.qty_ordered : 0, // first stage starts with full qty
        },
      })
    }

    // If raw material specified, issue it now
    if (data.raw_material_id && data.qty_bars && data.qty_kg) {
      await tx.jobCardRawMaterial.create({
        data: {
          job_card_id: j.id,
          raw_material_id: data.raw_material_id,
          qty_bars: data.qty_bars,
          qty_kg: data.qty_kg,
          issued_date: new Date(),
        },
      })

      await tx.rawMaterialMovement.create({
        data: {
          raw_material_id: data.raw_material_id,
          movement_type: 'issued_to_production',
          qty_bars: -data.qty_bars,
          qty_kg: -data.qty_kg,
          reference: `JC-${j.job_card_number}`,
          movement_date: new Date(),
          created_by: user.id,
        },
      })

      await tx.rawMaterialBalance.update({
        where: { raw_material_id: data.raw_material_id },
        data: {
          qty_bars: { decrement: data.qty_bars },
          qty_kg: { decrement: data.qty_kg },
        },
      })
    }

    return j
  })

  revalidatePath('/production')
  redirect(`/production/${job.id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE STAGE
// Operator marks a stage as complete with qty_out and qty_rejected.
// Validates: qty_out + qty_rejected ≤ qty_in.
// On completion, the next stage's qty_in is set to this stage's qty_out.
// If this is the LAST stage, the JobCard is marked complete and FG stock is updated.
// ─────────────────────────────────────────────────────────────────────────────

const completeStageSchema = z.object({
  stage_id: z.string().min(1),
  qty_out: z.coerce.number().int().nonnegative(),
  qty_rejected: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().max(500).optional().nullable(),
})

export async function completeStage(formData: FormData) {
  const user = await requireProductionAccess()

  const raw = {
    stage_id: formData.get('stage_id'),
    qty_out: formData.get('qty_out'),
    qty_rejected: formData.get('qty_rejected') || 0,
    notes: formData.get('notes') || null,
  }
  const parsed = completeStageSchema.safeParse(raw)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)
  const data = parsed.data

  const stage = await prisma.jobCardStage.findUnique({
    where: { id: data.stage_id },
    include: {
      job_card: {
        include: {
          product: true,
          stages: { orderBy: { stage_number: 'asc' } },
        },
      },
    },
  })
  if (!stage) throw new Error('Stage not found')
  if (stage.completed_at) throw new Error('Stage already completed')
  if (stage.qty_in === 0) throw new Error('Stage has not received any input yet')

  // Validate: qty_out + rejected must not exceed qty_in
  if (data.qty_out + data.qty_rejected > stage.qty_in) {
    throw new Error(
      `Cannot output ${data.qty_out} + reject ${data.qty_rejected} = ${data.qty_out + data.qty_rejected} from ${stage.qty_in} input`
    )
  }

  const isLastStage = stage.stage_number === stage.job_card.stages.length
  const nextStage = stage.job_card.stages.find(
    (s) => s.stage_number === stage.stage_number + 1
  )

  await prisma.$transaction(async (tx) => {
    // Mark stage complete
    await tx.jobCardStage.update({
      where: { id: stage.id },
      data: {
        qty_out: data.qty_out,
        qty_rejected: data.qty_rejected,
        completed_at: new Date(),
        notes: data.notes,
      },
    })

    if (nextStage) {
      // Pass qty_out to next stage's qty_in, mark it as started
      await tx.jobCardStage.update({
        where: { id: nextStage.id },
        data: {
          qty_in: data.qty_out,
          started_at: new Date(),
        },
      })
    }

    // If this was the first stage being completed, transition to in_progress
    if (stage.stage_number === 1 && stage.job_card.status === 'open') {
      await tx.jobCard.update({
        where: { id: stage.job_card.id },
        data: { status: 'in_progress' },
      })
    }

    // Last stage complete → finalize job card and add to FG stock at Mombasa
    if (isLastStage) {
      await tx.jobCard.update({
        where: { id: stage.job_card.id },
        data: {
          status: 'complete',
          completed_date: new Date(),
          qty_produced: data.qty_out,
        },
      })

      // Increment finished goods stock at Mombasa (production happens at HQ)
      if (data.qty_out > 0) {
        await tx.stockMovement.create({
          data: {
            product_id: stage.job_card.product_id,
            movement_type: 'production_output',
            branch: 'mombasa',
            qty: data.qty_out,
            reference: `JC-${stage.job_card.job_card_number}`,
            movement_date: new Date(),
            notes: `Production output from job card ${stage.job_card.job_card_number}`,
            created_by: user.id,
          },
        })

        await tx.branchStock.upsert({
          where: {
            product_id_branch: {
              product_id: stage.job_card.product_id,
              branch: 'mombasa',
            },
          },
          update: { qty: { increment: data.qty_out } },
          create: {
            product_id: stage.job_card.product_id,
            branch: 'mombasa',
            qty: data.qty_out,
          },
        })
      }
    }
  })

  revalidatePath('/production')
  revalidatePath(`/production/${stage.job_card.id}`)
  if (isLastStage) revalidatePath('/stock')
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL JOB
// Cancels an open job. Returns issued raw material to stock.
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelJobCard(jobId: string, reason: string) {
  if (!reason || reason.trim().length < 3) {
    throw new Error('Cancellation reason is required (at least 3 characters)')
  }

  const user = await requireProductionAccess()
  const job = await prisma.jobCard.findUnique({
    where: { id: jobId },
    include: { raw_materials: true },
  })
  if (!job) throw new Error('Job not found')
  if (job.status === 'complete') throw new Error('Cannot cancel completed job')
  if (job.status === 'cancelled') throw new Error('Already cancelled')

  await prisma.$transaction(async (tx) => {
    // Return issued raw material
    for (const issued of job.raw_materials) {
      await tx.rawMaterialMovement.create({
        data: {
          raw_material_id: issued.raw_material_id,
          movement_type: 'adjustment_in',
          qty_bars: issued.qty_bars,
          qty_kg: issued.qty_kg,
          reference: `JC-${job.job_card_number}-CANCEL`,
          notes: `Job cancelled: ${reason}`,
          movement_date: new Date(),
          created_by: user.id,
        },
      })
      await tx.rawMaterialBalance.update({
        where: { raw_material_id: issued.raw_material_id },
        data: {
          qty_bars: { increment: issued.qty_bars },
          qty_kg: { increment: Number(issued.qty_kg) },
        },
      })
    }

    await tx.jobCard.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        notes: job.notes ? `${job.notes}\n\n[Cancelled] ${reason}` : `[Cancelled] ${reason}`,
      },
    })
  })

  revalidatePath('/production')
  revalidatePath(`/production/${jobId}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH — manufactured products only (springs and U-bolts)
// ─────────────────────────────────────────────────────────────────────────────

export async function searchManufacturedProducts(query: string) {
  await requireUser()
  if (!query || query.length < 1) {
    return prisma.product.findMany({
      where: {
        is_active: true,
        category: { in: ['manufactured_spring', 'manufactured_ubolt'] },
      },
      orderBy: { product_code: 'asc' },
      take: 20,
      select: { id: true, product_code: true, canonical_name: true, category: true },
    })
  }

  return prisma.product.findMany({
    where: {
      is_active: true,
      category: { in: ['manufactured_spring', 'manufactured_ubolt'] },
      OR: [
        { product_code: { contains: query, mode: 'insensitive' } },
        { canonical_name: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { product_code: 'asc' },
    take: 10,
    select: { id: true, product_code: true, canonical_name: true, category: true },
  })
}
