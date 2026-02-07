import { NextResponse } from 'next/server';
import { clearAccessLogs } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/logs/clear - Clear all logs
export async function DELETE() {
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
