import { NextRequest, NextResponse } from 'next/server';
import { clearAccessLogs } from '@/lib/db';
import { requireApiAccess } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// DELETE /api/logs/clear - Clear all logs
export async function DELETE(request: NextRequest) {
  const denied = await requireApiAccess(request);
  if (denied) return denied;
  try {
    await clearAccessLogs();
    return NextResponse.json({ success: true, message: 'All logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
