import { NextRequest, NextResponse } from "next/server";
import { getOrderForLogging } from "@/app/actions/production";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAuth();

    const order = await getOrderForLogging(id);
    return NextResponse.json({
      ...order,
      targetKg: Number(order.targetKg),
      inheritedKg: Number(order.inheritedKg),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      completedAt: order.completedAt?.toISOString() ?? null,
      approvedAt: order.approvedAt?.toISOString() ?? null,
      outputRecordedAt: order.outputRecordedAt?.toISOString() ?? null,
      actualWeightOut: order.actualWeightOut == null ? null : Number(order.actualWeightOut),
      design: order.design ? {
        ...order.design,
        targetWeight: order.design.targetWeight == null ? null : Number(order.design.targetWeight),
        createdAt: order.design.createdAt.toISOString(),
        updatedAt: order.design.updatedAt.toISOString(),
        lastSeenAt: order.design.lastSeenAt?.toISOString() ?? null,
        stages: order.design.stages.map((stage) => ({
          ...stage,
          createdAt: stage.createdAt.toISOString(),
          updatedAt: stage.updatedAt.toISOString(),
        })),
      } : null,
      StageLog: order.StageLog.map((log) => ({
        ...log,
        kgIn: Number(log.kgIn),
        kgOut: Number(log.kgOut),
        kgScrap: Number(log.kgScrap),
        piecesIn: log.piecesIn,
        piecesOut: log.piecesOut,
        completedAt: log.completedAt.toISOString(),
      })),
      materials: order.materials.map((line) => ({
        ...line,
        cutLength: line.cutLength == null ? null : Number(line.cutLength),
        totalLength: line.totalLength == null ? null : Number(line.totalLength),
        weightKg: line.weightKg == null ? null : Number(line.weightKg),
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
        RawMaterial: {
          ...line.RawMaterial,
          availableKg: Number(line.RawMaterial.availableKg),
          reservedKg: Number(line.RawMaterial.reservedKg),
          availablePieces: line.RawMaterial.availablePieces,
          createdAt: line.RawMaterial.createdAt.toISOString(),
          updatedAt: line.RawMaterial.updatedAt.toISOString(),
        },
      })),
    });
  } catch (error) {
    console.error("Failed to fetch order for logging:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}
