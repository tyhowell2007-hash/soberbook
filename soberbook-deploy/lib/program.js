/* =====================================================================
   PROGRAMS — 29 Oct 2026. The Illinois campaign (CRCC).

   People who sign up through soberbook.app/login?program=illinois are tagged
   (migration 0192, table program_members). For them, photos and video are
   OFF: it is a condition of CRCC's contract. Everybody else is unaffected.

   ⚠️ TOLERATES THE MIGRATION NOT BEING RUN YET. If my_program() does not
   exist, the RPC errors and this says "not in a program", so nobody loses
   uploads by accident and nothing breaks if the code ships first.

   ⚠️ Plain module, no 'use client': server routes and the client
   PhotoUpload both import from it.
   ===================================================================== */
export const PROGRAM_FROM_URL = ['illinois'];

export async function myProgram(supabase) {
  try {
    const { data, error } = await supabase.rpc('my_program');
    if (error) return null;
    return typeof data === 'string' ? data : null;
  } catch { return null; }
}

export async function uploadsOff(supabase) {
  return (await myProgram(supabase)) === 'illinois';
}

export const UPLOADS_OFF_MESSAGE = 'Photos and video are off for the Illinois program.';
