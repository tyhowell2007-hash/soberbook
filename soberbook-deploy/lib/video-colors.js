/* Our own card colours for a video, picked from the post id so a video
   always gets the same card. Nothing about the video itself is read.
   31 Oct 2026 (0197). Shared by the player and the profile Videos tab. */
const CARDS = [['#3B1D4A', '#E97B3B'], ['#1B2833', '#4D6C7E'], ['#0F1420', '#B8862B'], ['#2A1208', '#D2601E'], ['#0B1E2A', '#3E7E86'], ['#0F3D2A', '#5FA37E']];
export function cardColors(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARDS[h % CARDS.length];
}
