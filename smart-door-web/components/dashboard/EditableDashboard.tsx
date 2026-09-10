'use client';

import { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { MasonryGrid } from './MasonryGrid';

interface SortableCardProps {
  id: string;
  isEditing: boolean;
  children: ReactNode;
}

function SortableCard({ id, isEditing, children }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isEditing,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="relative group cursor-grab active:cursor-grabbing"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-2 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: 'var(--primary)', color: 'var(--primary-text)', boxShadow: 'var(--shadow-md)' }}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl border-2 border-dashed" style={{ borderColor: 'var(--border-strong)' }} />
      {children}
    </div>
  );
}

interface EditableDashboardProps {
  layout: string[];
  renderCard: (id: string) => ReactNode;
  onLayoutChange: (layout: string[]) => void;
}

export function EditableDashboard({ layout, renderCard, onLayoutChange }: EditableDashboardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = layout.indexOf(active.id as string);
    const newIndex = layout.indexOf(over.id as string);
    if (oldIndex >= 0 && newIndex >= 0) onLayoutChange(arrayMove(layout, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={layout} strategy={rectSortingStrategy}>
        <MasonryGrid>
          {layout.map((id) => (
            <SortableCard key={id} id={id} isEditing>
              <div className={id === 'door-controls' || id === 'device-tools' ? 'hidden md:block' : ''}>
                {renderCard(id)}
              </div>
            </SortableCard>
          ))}
        </MasonryGrid>
      </SortableContext>
    </DndContext>
  );
}
