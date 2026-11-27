'use client';
import { useEffect, useState } from 'react';
import { isSaved, save, unsave } from './shelf-store';

export default function SaveButton({ id }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(isSaved(id)); }, [id]);
  return (
    <button type="button" className={'lb-save' + (on ? ' on' : '')} aria-pressed={on}
            onClick={() => { if (on) unsave(id); else save(id); setOn(!on); }}>
      {on ? 'On My Shelf ✓' : 'Save to My Shelf'}
    </button>
  );
}
