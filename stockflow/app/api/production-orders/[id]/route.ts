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
    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch order for logging:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}