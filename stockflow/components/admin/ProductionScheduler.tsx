"use client";

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, AlertTriangle, CheckCircle, Play, Pause } from 'lucide-react';
import { updateOrderPriority } from '@/app/actions/production';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  designName: string;
  status: string;
  priority: string;
  quantity: number;
  currentStage: number;
  currentDept: string | null;
  estimatedCompletion: Date | null;
  createdAt: Date;
  targetKg: number;
}

interface ProductionSchedulerProps {
  initialOrders: ProductionOrder[];
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-500',
  APPROVED: 'bg-blue-500',
  IN_PRODUCTION: 'bg-green-500',
  COMPLETED: 'bg-gray-500',
  REJECTED: 'bg-red-500',
  CANCELLED: 'bg-gray-500'
};

const PRIORITY_COLORS = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500'
};

export function ProductionScheduler({ initialOrders }: ProductionSchedulerProps) {
  const [orders, setOrders] = useState<ProductionOrder[]>(initialOrders);
  const [draggedOrder, setDraggedOrder] = useState<ProductionOrder | null>(null);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) {
      // Reordering within the same status
      const statusOrders = orders.filter(o => o.status === source.droppableId);
      const [removed] = statusOrders.splice(source.index, 1);
      statusOrders.splice(destination.index, 0, removed);

      // Update priorities based on new order
      const updatedOrders = statusOrders.map((order, index) => ({
        ...order,
        priority: calculatePriorityFromPosition(index)
      }));

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          updatedOrders.find(u => u.id === order.id) || order
        )
      );

      // Update server
      for (const order of updatedOrders) {
        try {
          await updateOrderPriority(order.id, order.priority);
        } catch (error) {
          console.error('Failed to update order priority:', error);
        }
      }
    }
  };

  const calculatePriorityFromPosition = (position: number): string => {
    if (position === 0) return 'URGENT';
    if (position < 3) return 'HIGH';
    if (position < 6) return 'MEDIUM';
    return 'LOW';
  };

  const groupedOrders = orders.reduce((acc, order) => {
    if (!acc[order.status]) acc[order.status] = [];
    acc[order.status].push(order);
    return acc;
  }, {} as Record<string, ProductionOrder[]>);

  const statusColumns = [
    { id: 'PENDING', title: 'Pending Approval', icon: Pause },
    { id: 'APPROVED', title: 'Approved', icon: CheckCircle },
    { id: 'IN_PRODUCTION', title: 'In Production', icon: Play },
    { id: 'COMPLETED', title: 'Completed', icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="h-6 w-6 text-[#f0c040]" />
          <div>
            <h2 className="text-xl font-bold text-white">Production Timeline</h2>
            <p className="text-sm text-[#7a8090]">Drag orders to reprioritize production queue</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            {orders.filter(o => o.status === 'IN_PRODUCTION').length} In Production
          </Badge>
          <Badge variant="outline" className="text-xs">
            {orders.filter(o => o.status === 'PENDING').length} Pending
          </Badge>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statusColumns.map(({ id, title, icon: Icon }) => (
            <div key={id} className="space-y-4">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-[#f0c040]" />
                <h3 className="font-semibold text-white">{title}</h3>
                <Badge variant="secondary" className="text-xs">
                  {groupedOrders[id]?.length || 0}
                </Badge>
              </div>

              <Droppable droppableId={id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-3 min-h-[400px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                      snapshot.isDraggingOver
                        ? 'border-[#f0c040] bg-[#f0c040]/10'
                        : 'border-[#2a2d32] bg-[#1e2023]'
                    }`}
                  >
                    {groupedOrders[id]?.map((order, index) => (
                      <Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`cursor-move transition-transform ${
                              snapshot.isDragging ? 'rotate-2 shadow-lg' : ''
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-white text-sm">
                                    {order.orderNumber}
                                  </span>
                                  <Badge
                                    className={`${PRIORITY_COLORS[order.priority as keyof typeof PRIORITY_COLORS]} text-white text-xs`}
                                  >
                                    {order.priority}
                                  </Badge>
                                </div>

                                <p className="text-xs text-[#7a8090] truncate">
                                  {order.designName}
                                </p>

                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-[#7a8090]">
                                    Qty: {order.quantity}
                                  </span>
                                  {order.currentDept && (
                                    <span className="text-[#f0c040]">
                                      {order.currentDept}
                                    </span>
                                  )}
                                </div>

                                {order.estimatedCompletion && (
                                  <div className="flex items-center gap-1 text-xs text-[#7a8090]">
                                    <Clock className="h-3 w-3" />
                                    {order.estimatedCompletion.toLocaleDateString()}
                                  </div>
                                )}

                                <div className="w-full bg-[#2a2d32] rounded-full h-2">
                                  <div
                                    className="bg-[#f0c040] h-2 rounded-full transition-all"
                                    style={{
                                      width: `${order.status === 'COMPLETED' ? 100 : (order.currentStage / 5) * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}