s = open('/app/frontend/public/ui.css').read()
s = s.replace('.fish-btn.fish-btn-img { background: none center / contain no-repeat !important;', '.fish-btn.fish-btn-img { background-color: transparent !important; background-position: center !important; background-size: contain !important; background-repeat: no-repeat !important;')
s = s.replace('.chat-list { height: 150px;', '.chat-list { height: 118px;')
s += '''
/* Tackle-shop look for every menu panel: framed dark card, painted header ribbon, framed rows */
html body .fr-modal .panel { background: linear-gradient(180deg, rgba(48, 36, 24, .55), rgba(10, 8, 6, .78)) !important; border: 1px solid rgba(214, 172, 92, .5) !important; border-radius: 4px !important;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 230, 180, .08), 0 6px 16px rgba(0, 0, 0, .45) !important; }
html body .fr-modal .panel-head { border: 10px solid transparent !important; border-image: url(/art/hud/btn_dark.webp) 90 110 fill / 10px 16px / 0 stretch !important; background: none !important; margin: -1px -1px 4px; padding: 0 8px !important; min-height: 40px; }
html body .fr-modal .panel .panel { background: rgba(0, 0, 0, .32) !important; box-shadow: none !important; }
.fr-modal .panel > div > .flex.gap-3:not(.panel-head), .fr-modal [data-testid^="quest-"], .fr-modal [data-testid^="story-"], .fr-modal [data-testid^="crew-row"], .fr-modal [data-testid^="ach-"] {
  border-radius: 4px; }
.fr-modal [data-testid^="quest-"]:not(button), .fr-modal [data-testid^="story-"]:not(button) { background: linear-gradient(180deg, rgba(255, 248, 235, .05), rgba(0, 0, 0, .25)); border: 1px solid rgba(214, 172, 92, .3); padding: 8px; margin-bottom: 6px; }
html body .fr-modal .label, html body .fr-modal .tag { color: #e2bb6a !important; }
html body .fr-modal select { background: rgba(0, 0, 0, .5) !important; border: 1px solid rgba(214, 172, 92, .4) !important; color: #f4e6c4 !important; border-radius: 4px !important; }
.fr-modal .bar, .fr-modal [class*="progress"] { border-radius: 4px; }
html body .btn-sm { padding: 0 6px !important; }
'''
open('/app/frontend/public/ui.css', 'w').write(s)
print('ok')
