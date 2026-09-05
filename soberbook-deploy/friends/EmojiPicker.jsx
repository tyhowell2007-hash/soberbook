'use client';

import { useEffect, useRef, useState } from 'react';

/* =====================================================================
   🙂 THE EMOJI PICKER — The Front Room.

   Ty, 30 Aug: "Allow for an emoji box when you type as well. In
   community. Green room." Then: "I want all sorts of premium emojis."

   ⭐ RECOVERY IS THE FIRST TAB, AND THAT IS THE ONLY OPINION IN THIS FILE.
   Every picker on earth opens on smileys. The things people in this room
   actually reach for — a chip, a milestone, hands, a seedling, a couch —
   would otherwise be four swipes deep behind 😀. Putting them first costs
   nothing and means the app knows what room it is in.

   ⚠️ THESE ARE STANDARD UNICODE EMOJI, which is worth being straight
   about: every phone and computer already draws them, and there are
   hundreds. What this is NOT is custom animated emoji of the Discord or
   Slack kind — those are images the app would host, serve and moderate,
   which is a different feature with its own storage and licensing. Ty was
   told that plainly rather than sold this as the same thing.

   ---------------------------------------------------------------------
   ⚠️ IT INSERTS AT THE CURSOR, not at the end. Somebody typing "one year
   today 🎉 and I feel" should be able to drop one mid-sentence. Appending
   is easier to write and quietly wrong.

   ⚠️ THE PANEL SITS ABOVE THE COMPOSER AND PUSHES NOTHING OFF SCREEN —
   it does not cover the conversation. In a room where people are talking
   to each other, hiding the talk to pick a smiley is the wrong trade.

   ⚠️ NO "recently used" LIST. It would be per-device state that quietly
   records what somebody reaches for at 3am, and this app has refused
   smaller signals than that (presence dots, typing dots, seen ticks).
   The Recovery tab already does the job a recents list would.
   ===================================================================== */

const CATS = [
  ['🌱', 'Recovery',
   '🌱 🙏 💪 ⏳ 🏆 🥇 🎂 🕊️ ☕ 📖 🔑 ⚓ 🧭 🪴 🌻 🌈 ✨ 🫶 🤝 👊 ✊ 🙌 👏 💯 🛋️ 🪑 📿 🧘 🧘‍♀️ 🚶 🚶‍♀️ 🏃 🏃‍♀️ 💚 🩵 🫂 🗓️ ☀️ 🌅 🌄 🌙 ⭐ 🍀 🎗️ 🎯 🧩 🪞 🔦 🗝️ 🌤️'],
  ['😀', 'Smileys',
   '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾'],
  ['❤️', 'Hearts',
   '❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 🩷 🩵 🩶 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 🫀 ✨ 💫 ⭐ 🌟 💥 💢 💤 🔥 🎉 🎊 🎈 🎁 🏅 🥈 🥉 🔔 📣 💬 💭 🗯️ 👁️‍🗨️'],
  ['👋', 'Hands',
   '👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫰 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 👀 👁️ 🧠 🫁 🦷 🦴 👤 👥 🗣️'],
  ['🐢', 'Nature',
   '🐢 🦋 🐝 🐞 🦗 🕊️ 🐬 🐳 🐋 🦈 🐙 🦀 🐠 🐟 🐧 🦉 🦅 🦆 🦜 🐕 🐈 🐎 🦌 🐘 🦁 🐯 🐻 🐨 🐼 🦊 🐰 🐹 🐭 🐿️ 🦔 🌸 💐 🌷 🌹 🥀 🌺 🌼 🌵 🌲 🌳 🌴 🍁 🍂 🍃 🌾 🌊 🏔️ ⛰️ 🌋 🏜️ 🏝️ 🏞️ 🌅 🌄 🌠 ☀️ 🌤️ ⛅ ☁️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 🌪️ 🌫️ 🌙 🌛 🌜 🌚 🌝 🌞 🪐 ⚡ 🌍 🌎 🌏'],
  ['🍎', 'Food',
   '🍎 🍏 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🥞 🧇 🥓 🍗 🍖 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🥘 🍝 🍜 🍲 🍛 🍣 🍤 🍚 🍙 🥟 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 ☕ 🍵 🧃 🥤 🧋 🧊 🍯'],
  ['⚽', 'Activity',
   '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤸 🤼 🤽 🤾 🧗 🚴 🚵 🏇 🧘 🏊 🏄 🚣 🎯 🎮 🕹️ 🎲 🧩 ♟️ 🎭 🎨 🖼️ 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 📸 📷 🎥'],
  ['🚗', 'Travel',
   '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🚨 🚔 🚍 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🪂 💺 🚁 🛸 🚀 🛰️ ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚏 🗺️ 🧭 🏠 🏡 🏘️ 🏢 🏥 🏦 🏨 🏪 🏫 ⛪ 🕌 🛕 🕍 🗽 🗼 🏰 ⛲ 🌁 🌉 🎡 🎢 🎪 🏕️ ⛺'],
  ['💡', 'Objects',
   '💡 🔦 🕯️ 🪫 🔋 💻 🖥️ ⌨️ 🖱️ 💽 💾 📀 📱 ☎️ 📞 📟 📠 📺 📻 🎙️ ⏰ ⏱️ ⏲️ 🕰️ ⌛ ⏳ 📡 🔌 🧰 🔧 🔨 🪛 🔩 ⚙️ 🧲 🧪 🧫 🧬 🔬 🔭 💊 💉 🩺 🩹 🩼 🚪 🪟 🛏️ 🛋️ 🪑 🚿 🛁 🧴 🧻 🧼 🧽 🧹 🧺 🔑 🗝️ 🔒 🔓 📦 📫 📮 ✉️ 📝 ✏️ 🖊️ 🖍️ 📚 📖 📓 📔 📒 📕 📗 📘 📙 🔖 📎 📌 📍 ✂️ 📐 📏 🗂️ 📅 🗓️ 📇 📈 📉 📊 💰 💵 🧾 🛒 🎒 👕 👟 🧢 🕶️'],
  ['✅', 'Symbols',
   '✅ ☑️ ✔️ ❌ ⭕ 🚫 ⛔ ❗ ❓ ⚠️ 🔺 🔻 🔸 🔹 🔶 🔷 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ ♻️ ⚜️ 🔱 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ➕ ➖ ✖️ ➗ 🟰 💲 🔤 🔡 🔠 🔢 🔣 ℹ️ 🆗 🆕 🆒 🆓 🆙 🔝 🔜 ⏺️ ▶️ ⏸️ ⏹️ ⏭️ ⏮️ 🔀 🔁 🔂 🔄 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ 🔗 ♾️'],
];

export default function EmojiPicker({ open, onClose, onPick }) {
  const [cat, setCat] = useState(0);
  const ref = useRef(null);

  /* Escape closes it. A panel you cannot dismiss from the keyboard is a
     trap — the same rule the Thread modal follows. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="emp" ref={ref}>
      <div className="emp-tabs" role="tablist" aria-label="Emoji categories">
        {CATS.map((c, i) => (
          <button key={c[1]} type="button" role="tab"
                  aria-selected={i === cat} aria-label={c[1]} title={c[1]}
                  className={'emp-tab' + (i === cat ? ' on' : '')}
                  onClick={() => setCat(i)}>
            {c[0]}
          </button>
        ))}
      </div>
      <div className="emp-grid" role="tabpanel" aria-label={CATS[cat][1]}>
        {CATS[cat][2].split(' ').filter(Boolean).map((e, i) => (
          <button key={CATS[cat][1] + i} type="button" className="emp-one"
                  aria-label={`Insert ${e}`} onClick={() => onPick(e)}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
