const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testHandoff() {
  try {
    console.log("Searching for sample data...");
    
    // Find an order to test
    const order = await prisma.productionOrder.findFirst({
      where: { status: 'APPROVED' },
      include: { 
        design: { 
          include: { stages: { orderBy: { sequence: 'asc' } } } 
        } 
      }
    });

    if (!order) {
      console.log("No approved orders found to test.");
      return;
    }

    // Find an operator
    const operator = await prisma.user.findFirst({ where: { role: 'OPERATOR' } });
    if (!operator) {
      console.log("No operators found to test.");
      return;
    }

    console.log(`Found Order: ${order.orderNumber} (ID: ${order.id})`);
    console.log(`Current Dept: ${order.currentDept}`);

    // Mock the handoff request
    const payload = {
      orderId: order.id,
      kgIn: order.targetKg,
      kgOut: order.targetKg - 0.5,
      kgScrap: 0.5,
      scrapReason: "Off-cut",
      notes: "Test automatic handoff",
      currentSequence: order.currentStage,
      stageName: order.currentDept || "Initial Stage",
      operatorId: operator.id
    };

    console.log("Sending handoff request...");
    
    // We'll call the logic directly since we're in a node script
    // (Mimicking the API route logic)
    
    const log = await prisma.stageLog.create({
      data: {
        orderId: payload.orderId,
        kgIn: payload.kgIn,
        kgOut: payload.kgOut,
        kgScrap: payload.kgScrap,
        scrapReason: payload.scrapReason,
        notes: payload.notes,
        stageName: payload.stageName,
        sequence: payload.currentSequence,
        operatorId: payload.operatorId,
      }
    });

    const currentStageIndex = order.design.stages.findIndex(s => s.sequence === payload.currentSequence);
    const nextStage = order.design.stages[currentStageIndex + 1];

    let nextDept = "Completed";
    let finalStatus = "COMPLETED";
    let nextSeq = payload.currentSequence + 1;

    if (nextStage) {
      nextDept = nextStage.department;
      finalStatus = "IN_PRODUCTION";
      nextSeq = nextStage.sequence;
    }

    const updatedOrder = await prisma.productionOrder.update({
      where: { id: payload.orderId },
      data: {
        currentStage: nextSeq,
        currentDept: nextDept,
        status: finalStatus,
        targetKg: payload.kgOut 
      }
    });

    console.log("Handoff Success!");
    console.log(`Transitioned to: ${nextDept} (Sequence: ${nextSeq})`);
    console.log(`Order Status: ${finalStatus}`);
    
  } catch (error) {
    console.error("Test Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testHandoff();
