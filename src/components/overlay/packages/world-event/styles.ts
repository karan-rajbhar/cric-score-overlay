/**
 * World event's stylesheet: the panel materials, the type scale and the
 * entrance choreography (wipes, slides, staggered rows, a light sweep).
 * Injected once by `<WeStyles>` (React hoists and de-duplicates it).
 *
 * Plain CSS that OBS's older Chromium (CEF 103) understands: no nesting,
 * no color-mix, no :has; team colours come from the `--we-*` variables.
 */

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_SNAP = "cubic-bezier(0.65, 0, 0.35, 1)";

const MATERIALS = `
.we{font-family:var(--we-font, "Figtree"),"Helvetica Neue",Arial,system-ui,sans-serif;color:#fff;-webkit-font-smoothing:antialiased;line-height:1.1;font-feature-settings:"tnum" 1;}
.we *{box-sizing:border-box;}
.we-x{font-weight:900;text-transform:uppercase;letter-spacing:0.01em;}
.we-fig{font-weight:850;font-variant-numeric:tabular-nums;letter-spacing:-0.01em;}
.we-figl{font-weight:600;font-variant-numeric:tabular-nums;}
.we-name{font-weight:800;text-transform:uppercase;letter-spacing:0.01em;}
.we-label{font-weight:800;text-transform:uppercase;letter-spacing:0.07em;font-size:17px;}
.we-trunc{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;}

.we-night{background:linear-gradient(180deg,#2a1585 0%,#170b5c 46%,#0a0532 100%);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -1px 0 rgba(0,0,0,0.45);}
.we-night2{background:linear-gradient(180deg,#33219a 0%,#22137a 100%);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.18);}
.we-paper{background:linear-gradient(180deg,#ffffff 0%,#ffffff 50%,#ebe8f8 100%);color:#120a3d;box-shadow:inset 0 1px 0 #ffffff,inset 0 -2px 0 rgba(18,10,61,0.10);}
.we-lav{background:#f2f0fb;}
.we-accent{background:linear-gradient(100deg,#dc0078 0%,#a9108f 55%,#6a1fd0 100%);color:#fff;}
.we-mint{background:linear-gradient(180deg,#5cf0cc 0%,#19e0b4 55%,#0fbf98 100%);color:#120a3d;}
.we-gold{background:linear-gradient(180deg,#ffdc6e 0%,#ffc629 55%,#f0a800 100%);color:#120a3d;}
.we-red{background:linear-gradient(180deg,#f0384d 0%,#d4142a 60%,#a90c1f 100%);color:#fff;}
.we-team{background:linear-gradient(180deg,var(--we-side-hi,var(--we-side)) 0%,var(--we-side) 48%,var(--we-side-deep) 100%);color:var(--we-side-text);box-shadow:inset 0 1px 0 rgba(255,255,255,0.30),inset 0 -1px 0 rgba(0,0,0,0.30);}
.we-lift{box-shadow:0 22px 48px rgba(6,3,30,0.50),0 3px 8px rgba(6,3,30,0.35);}
.we-muted{color:rgba(255,255,255,0.76);}
.we-ink-muted{color:#4f4a72;}
.we-hair{border-color:rgba(255,255,255,0.16);}
.we-hair-ink{border-color:rgba(18,10,61,0.12);}
.we-seam{box-shadow:-4px 0 0 #0a0532;}

.we-cut-r{clip-path:polygon(0 0,100% 0,calc(100% - var(--we-cut,22px)) 100%,0 100%);}
.we-cut-l{clip-path:polygon(var(--we-cut,22px) 0,100% 0,100% 100%,0 100%);}
.we-trap{clip-path:polygon(var(--we-cut,26px) 0,calc(100% - var(--we-cut,26px)) 0,100% 100%,0 100%);}
.we-chev-r{clip-path:polygon(0 0,calc(100% - var(--we-cut,18px)) 0,100% 50%,calc(100% - var(--we-cut,18px)) 100%,0 100%);}
.we-chev-l{clip-path:polygon(var(--we-cut,18px) 0,100% 0,100% 100%,var(--we-cut,18px) 100%,0 50%);}

.we-crest{position:relative;display:flex;align-items:center;justify-content:center;border-radius:9999px;flex-shrink:0;overflow:hidden;background:radial-gradient(circle at 50% 28%,var(--we-side-hi,var(--we-side)) 0%,var(--we-side) 55%,var(--we-side-deep) 100%);color:var(--we-side-text);box-shadow:0 0 0 3px rgba(255,255,255,0.95),0 0 0 5px rgba(10,5,50,0.35),0 8px 18px rgba(6,3,30,0.45);}
.we-crest-logo{background:#fff;}
.we-crest img{width:74%;height:74%;object-fit:contain;}
`;

const BALLS = `
.we-ball{position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;flex-shrink:0;font-weight:850;font-variant-numeric:tabular-nums;line-height:1;}
.we-ball-dot{box-shadow:inset 0 0 0 2.5px rgba(255,255,255,0.75);}
.we-ball-dot::after{content:"";width:22%;height:22%;border-radius:9999px;background:rgba(255,255,255,0.85);}
.we-ball-run{background:#ffffff;color:#120a3d;}
.we-ball-four{background:#19e0b4;color:#120a3d;}
.we-ball-six{background:#dc0078;color:#fff;}
.we-ball-wicket{background:#d4142a;color:#fff;}
.we-ball-extra{background:#ffb020;color:#120a3d;}
.we-ball-slot{box-shadow:inset 0 0 0 2px rgba(255,255,255,0.30);}
.we-on-paper .we-ball-dot{box-shadow:inset 0 0 0 2.5px #4f4a72;}
.we-on-paper .we-ball-dot::after{background:#4f4a72;}
.we-on-paper .we-ball-run{background:#140a4f;color:#fff;}
.we-on-paper .we-ball-slot{box-shadow:inset 0 0 0 2px rgba(18,10,61,0.20);}
`;

const ROWS = `
.we-rows > *:nth-child(even){background:#f2f0fb;}
.we-row-hl{background:linear-gradient(90deg,#dc0078 0%,#a9108f 60%,#6a1fd0 100%) !important;color:#fff;}
.we-row-hl .we-ink-muted{color:rgba(255,255,255,0.82);}
.we-row-night{border-bottom:1px solid rgba(255,255,255,0.12);}
.we-row-night:last-child{border-bottom:0;}
.we-sheen{overflow:hidden;}
.we-sheen::after{content:"";position:absolute;top:-30%;bottom:-30%;left:-40%;width:24%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.42) 50%,rgba(255,255,255,0) 100%);transform:skewX(-20deg);animation:we-sheen 1200ms ${EASE_SNAP} 450ms both;pointer-events:none;}
`;

const MOTION = `
@keyframes we-sheen{from{transform:skewX(-20deg) translateX(0);opacity:1}to{transform:skewX(-20deg) translateX(780%);opacity:0.5}}
@keyframes we-wipe-r{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes we-wipe-l{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}
@keyframes we-wipe-up{from{clip-path:inset(100% 0 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes we-wipe-down{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes we-slide-r{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes we-slide-l{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes we-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@keyframes we-drop{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:none}}
@keyframes we-fade{from{opacity:0}to{opacity:1}}
@keyframes we-pop{0%{opacity:0;transform:scale(0.5)}60%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
@keyframes we-grow-x{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes we-grow-y{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes we-draw{from{stroke-dashoffset:var(--we-len,2400)}to{stroke-dashoffset:0}}
@keyframes we-flash{0%{opacity:0}15%{opacity:0.9}100%{opacity:0}}
@keyframes we-zoom{0%{opacity:0;transform:scale(1.9)}55%{opacity:1;transform:scale(0.96)}100%{opacity:1;transform:scale(1)}}
@keyframes we-sweep{from{transform:translateX(-120%) skewX(-20deg)}to{transform:translateX(130%) skewX(-20deg)}}
@keyframes we-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes we-band{0%{clip-path:polygon(0 0,0 0,0 100%,0 100%)}100%{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}}

.we-a-wipe-r{animation:we-wipe-r 560ms ${EASE_OUT} both;}
.we-a-wipe-l{animation:we-wipe-l 560ms ${EASE_OUT} both;}
.we-a-wipe-up{animation:we-wipe-up 480ms ${EASE_OUT} both;}
.we-a-wipe-down{animation:we-wipe-down 520ms ${EASE_OUT} both;}
.we-a-slide-r{animation:we-slide-r 520ms ${EASE_OUT} both;}
.we-a-slide-l{animation:we-slide-l 520ms ${EASE_OUT} both;}
.we-a-rise{animation:we-rise 500ms ${EASE_OUT} both;}
.we-a-drop{animation:we-drop 460ms ${EASE_OUT} both;}
.we-a-fade{animation:we-fade 420ms ease-out both;}
.we-a-pop{animation:we-pop 560ms ${EASE_OUT} both;}
.we-a-grow-x{transform-origin:left center;animation:we-grow-x 680ms ${EASE_OUT} both;}
.we-a-grow-xr{transform-origin:right center;animation:we-grow-x 680ms ${EASE_OUT} both;}
.we-a-grow-y{transform-origin:center bottom;animation:we-grow-y 620ms ${EASE_OUT} both;}
.we-a-draw{animation:we-draw 1400ms ${EASE_SNAP} both;}
.we-a-flash{animation:we-flash 650ms ease-out both;}
.we-a-zoom{animation:we-zoom 640ms ${EASE_OUT} both;}
.we-a-band{animation:we-band 420ms ${EASE_SNAP} both;}
.we-marquee{animation:we-marquee 38s linear infinite;}

[data-we-still] *,[data-we-still]{animation:none !important;}
[data-we-still] .we-sheen::after{display:none;}
`;

export const WORLD_EVENT_CSS = MATERIALS + BALLS + ROWS + MOTION;
