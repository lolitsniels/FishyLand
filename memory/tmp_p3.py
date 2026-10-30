s = open('/app/frontend/public/ui.css').read()
a = s.index('/* player card */'); b = s.index('.fight-msg')
s = s[:a] + '''/* player card */
.pcard { position: relative; width: 360px; height: 177px; background: url(/art/hud/card2.webp) 0 0 / 100% 100% no-repeat; filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .7)); }
.pcard-face { position: absolute; left: 43px; top: 39px; width: 94px; height: 94px; border-radius: 50%; overflow: hidden; background: radial-gradient(circle, #1c5f78, #08202c); z-index: -1; }
.pcard-face img { width: 100%; height: 100%; object-fit: cover; }
.pcard-lv { position: absolute; left: 70px; top: 142px; width: 40px; text-align: center; font: 800 13px var(--ui-font); color: #2a1503; padding: 1px 0; border-radius: 10px; background: linear-gradient(180deg, #ffe7a0, #d39a2c); border: 1px solid #fff2c4; box-shadow: 0 2px 4px rgba(0, 0, 0, .6); }
.pcard-name { position: absolute; left: 170px; top: 50px; width: 148px; font: 800 15px var(--ui-font); color: #fff3cf; text-shadow: 0 1px 2px #000, 0 0 8px rgba(255, 200, 80, .4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcard-place { position: absolute; left: 170px; top: 69px; width: 148px; font: 600 10.5px var(--ui-font); color: #9fe9c0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px #000; }
.pcard-bars { position: absolute; left: 170px; top: 85px; width: 146px; display: flex; flex-direction: column; gap: 2px; }
.pcard-bar { position: relative; height: 9px; border-radius: 5px; background: rgba(0, 0, 0, .65); box-shadow: inset 0 1px 2px #000; overflow: hidden; }
.pcard-bar i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #2bc9ff, #8ff4ff); border-radius: 5px; }
.pcard-bar span { position: absolute; inset: 0; font: 800 8px/9px var(--ui-font); color: #fff; text-align: center; text-shadow: 0 1px 1px #000; }
.pcard-bar.xp { height: 4px; } .pcard-bar.xp i { background: linear-gradient(90deg, #b44dff, #ff8af0); }
.pcard-ic { position: absolute; top: 125px; } .pcard-ic.gold { left: 179px; } .pcard-ic.pearl { left: 287px; }
.pcard-v { position: absolute; top: 123px; font: 800 13px var(--ui-font); color: #fff3cf; text-shadow: 0 1px 2px #000; white-space: nowrap; }
.pcard-v.gold { left: 205px; width: 70px; } .pcard-v.pearl { left: 312px; }

/* quick tackle (right edge) */
.qt { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 6; }
.qt-slot { position: relative; width: 62px; height: 62px; display: grid; place-items: center; background: url(/art/hud/tile.webp) center / 100% 100% no-repeat; transition: transform .15s, filter .2s; }
.qt-slot:hover, .qt-slot.on { transform: scale(1.07); filter: drop-shadow(0 0 8px rgba(255, 210, 110, .6)); }
.qt-slot img { width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 2px 2px #000); }
.qt-none { color: #a8987a; }
.qt-cap { position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); font: 800 9.5px var(--ui-font); color: #fff1c9; white-space: nowrap; padding: 0 5px; border-radius: 6px; background: rgba(0, 0, 0, .75); text-shadow: 0 1px 1px #000; }
.qt-pop { position: absolute; right: 72px; top: 50%; transform: translateY(-50%); width: 230px; max-height: 300px; overflow-y: auto; padding: 6px; border: 16px solid transparent; border-image: url(/art/hud/panel.webp) 175 fill / 16px / 0 stretch; }
.qt-pop-h { font: 800 12px var(--ui-font); color: #ffe08a; padding: 0 2px 5px; text-shadow: 0 1px 2px #000; }
.qt-empty { font-size: 12px; color: #a8987a; padding: 4px; }
.qt-row { width: 100%; display: flex; align-items: center; gap: 7px; padding: 4px 5px; border-radius: 4px; font: 700 12px var(--ui-font); color: #f4e6c4; text-align: left; border: 1px solid transparent; transition: background-color .15s; }
.qt-row:hover:not(:disabled) { background: rgba(214, 172, 92, .15); border-color: rgba(214, 172, 92, .4); }
.qt-row.on { color: #ffe08a; } .qt-row img { width: 26px; height: 26px; object-fit: contain; }
.qt-n { font-size: 10.5px; color: #a8987a; }
@media (max-width: 640px) { .qt { top: 40%; gap: 6px; } .qt-slot { width: 46px; height: 46px; } .qt-slot img { width: 30px; height: 30px; } .qt-pop { right: 54px; width: 200px; } }

/* chat */
.chatbox { position: absolute; left: 8px; bottom: 120px; width: 340px; z-index: 6; border: 16px solid transparent; border-image: url(/art/hud/panel.webp) 175 fill / 16px / 0 stretch; padding: 0 2px; }
.chat-tabs { display: flex; gap: 3px; align-items: center; }
.chat-tab { font: 800 11.5px var(--ui-font); color: #cbbd9e; padding: 3px 10px; border-radius: 4px 4px 0 0; border-bottom: 2px solid transparent; transition: color .15s; }
.chat-tab.on { color: #ffe08a; border-bottom-color: #e2bb6a; } .chat-tab:hover { color: #fff1c9; }
.chat-toggle { margin-left: auto; color: #e8d6ae; }
.chat-list { height: 150px; overflow-y: auto; margin-top: 4px; padding: 4px 2px; font: 600 12.5px/1.35 var(--ui-font); color: #efe6d2; }
.chat-line { word-break: break-word; padding: 1px 0; } .chat-line b { color: #8fd0f0; } .chat-line b.me { color: #ffe08a; } .chat-line b.sys { color: #9fe9c0; } .chat-line .lv { font-size: 10px; color: #a8987a; }
.chat-empty { color: #a8987a; font-size: 12px; padding: 6px 2px; }
.chat-input { display: flex; gap: 4px; margin-top: 4px; }
.chat-input input { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border-radius: 4px; background: rgba(0, 0, 0, .55); border: 1px solid rgba(214, 172, 92, .35); color: #fff3cf; font: 600 12.5px var(--ui-font); outline: none; }
.chat-input input:focus { border-color: #e2bb6a; }
.chat-input button { width: 34px; border-radius: 4px; display: grid; place-items: center; color: #2a1503; background: linear-gradient(180deg, #ffe7a0, #c7963c); }
@media (max-width: 640px) { .chatbox { width: 250px; bottom: 96px; } .chat-list { height: 100px; } }

/* big action button */
.fish-btn.fish-btn-img { background: none center / contain no-repeat !important; border: 0 !important; box-shadow: none !important; border-radius: 50% !important; filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .7)); transition: transform .15s, filter .2s; }
.fish-btn.fish-btn-img:hover:not(:disabled) { transform: scale(1.06); filter: drop-shadow(0 0 14px rgba(255, 210, 110, .7)); }
.fish-btn-label { align-self: end; margin-bottom: -6px; font: 900 13px var(--ui-font); letter-spacing: .06em; color: #2a1503; padding: 1px 10px; border-radius: 10px; background: linear-gradient(180deg, #ffe7a0, #d39a2c); border: 1px solid #fff2c4; box-shadow: 0 2px 4px rgba(0, 0, 0, .6); white-space: nowrap; }

/* travel map extras */
.wm-exp { font: 800 9px var(--ui-font); color: #08202c; background: #7ff3ff; padding: 0 5px; border-radius: 6px; margin-bottom: 1px; box-shadow: 0 0 10px #7ff3ff; }
.wm-banner:empty { display: none; }
.wm-banner > * { border: 18px solid transparent !important; border-image: url(/art/hud/panel.webp) 175 fill / 18px / 0 stretch !important; background: none !important; box-shadow: none !important; }

''' + s[b:]
open('/app/frontend/public/ui.css', 'w').write(s)
print('ok')
