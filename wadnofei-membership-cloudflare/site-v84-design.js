export const premiumCss=String.raw`/* Wad Nofei club visual system v84 — presentation only; no account or CMS changes. */
:root{--club-blue:#1048bb;--club-deep:#081d4b;--club-ink:#112349;--club-yellow:#ffde3b;--club-paper:#f5f7fc;--club-line:#dce4f2}
html{scroll-behavior:smooth}
body{background:var(--club-paper);color:var(--club-ink);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif}
body p{color:#536782}
body a:focus-visible,body button:focus-visible,body summary:focus-visible{outline:3px solid #d69400;outline-offset:4px}
header.wdn-header{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.97);border-color:#e2e8f3;box-shadow:0 4px 22px #102e6310}
.wdn-header-inner{max-width:1320px}
.wdn-header .wdn-brand{gap:11px}
.wdn-brand img{width:54px;height:54px;border-radius:14px}
.wdn-brand b{color:var(--club-deep);font-size:19px;letter-spacing:-.4px}
.wdn-brand small{color:#697d96;font-size:11px}
.wdn-header nav a,.wdn-header summary{color:#243656;border-radius:11px}
.wdn-header nav a:hover,.wdn-header summary:hover,.wdn-header [aria-current=page]{background:#eef3ff;color:#1048bb}
.wdn-header a.wdn-join{background:var(--club-yellow);color:#13234d;border-radius:12px;box-shadow:0 4px 0 #d9b800;font-weight:850;padding:11px 20px}
.wdn-header a.wdn-join:hover{background:#ffe866}
.wdn-header .wdn-group>div{border-radius:14px;border-color:#dfe6f3;box-shadow:0 20px 50px #0d235522}
.wdn-hero{position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(ellipse at 15% 8%,#235cd2 0%,transparent 40%),linear-gradient(128deg,#07183e 0%,#09265f 53%,#0b4bb7 100%);color:#fff}
.wdn-hero:before{content:"";pointer-events:none;position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(116deg,transparent 0,transparent 76px,#ffffff08 77px,#ffffff08 78px);opacity:.55}
.wdn-hero:after{content:"";position:absolute;width:520px;height:520px;left:-270px;bottom:-340px;border:85px solid #ffde3b18;border-radius:50%;pointer-events:none;z-index:-1}
.wdn-hero-inner{width:min(1240px,calc(100% - 56px));min-height:620px;grid-template-columns:minmax(0,1.22fr) minmax(290px,.78fr);gap:36px;padding:78px 0 80px}
.wdn-eyebrow{display:inline-flex;gap:9px;align-items:center;background:#ffffff18;border:1px solid #ffffff39;border-radius:100px;padding:7px 15px;color:#fff3a7;font-size:13px;font-weight:800;letter-spacing:.15px}
.wdn-eyebrow:before{content:"";height:9px;width:9px;background:var(--club-yellow);border-radius:50%;box-shadow:0 0 0 5px #ffde3b25}
.wdn-hero h1{font-size:clamp(46px,5.4vw,77px);font-weight:950;letter-spacing:-1.6px;line-height:1.17;max-width:850px;margin:25px 0 18px}
.wdn-hero h1 span{color:var(--club-yellow);font-size:clamp(29px,3.2vw,44px);line-height:1.35;margin-top:16px;letter-spacing:-.6px}
.wdn-hero p{color:#dce8ff;font-size:clamp(16px,1.5vw,19px);line-height:2.05;max-width:670px}
.wdn-hero .wdn-hero-overline{font-size:12px;color:#d2ddfa;letter-spacing:.4px;font-weight:800;display:block;margin-bottom:8px}
.wdn-hero-art{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;padding:20px;position:relative}
.wdn-crest-frame{position:relative;width:min(100%,350px);aspect-ratio:1;display:grid;place-items:center;border-radius:42px;background:linear-gradient(140deg,#ffffff29,#ffffff07);border:1px solid #ffffff42;box-shadow:0 35px 100px #03112f8c,inset 0 0 0 8px #ffffff09;transform:rotate(-5deg)}
.wdn-crest-frame:after{content:"";position:absolute;inset:-13px;border:1px dashed #ffffff45;border-radius:50px;pointer-events:none}
.wdn-hero-art .wdn-crest-frame img{width:76%;height:76%;padding:12px;border-radius:28px;background:#fff;box-shadow:0 14px 40px #00163b66;object-fit:contain;transform:rotate(5deg)}
.wdn-hero-art .wdn-year-pill{font-size:15px;font-weight:900;background:var(--club-yellow);color:#092553;border-radius:12px;padding:10px 20px;box-shadow:0 14px 30px #00173966;transform:translateY(-20px)}
.wdn-hero-art small{margin:0;color:#d7e5ff;font-size:12px;font-weight:700}
.wdn-button{border-radius:13px;background:var(--club-yellow);color:#0a2759;padding:12px 22px;min-height:54px;box-shadow:0 6px 0 #d9b900;font-size:15px;font-weight:900;transition:transform .17s,background .17s,box-shadow .17s}
.wdn-button:hover{background:#ffea74;transform:translateY(-2px);box-shadow:0 8px 0 #d9b900}
.wdn-button.secondary{background:#ffffff12;color:#fff;border:1px solid #ffffff6e;box-shadow:none}
.wdn-button.secondary:hover{background:#ffffff22;box-shadow:none}
.wdn-hero .wdn-actions{margin-top:32px;align-items:center}
.wdn-hero .wdn-actions .wdn-button{min-width:178px}
.wdn-trustbar{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;background:#fff;box-shadow:0 18px 50px #132f5b14;border:1px solid var(--club-line);border-radius:19px;margin-top:-33px;overflow:hidden;z-index:2}
.wdn-trustbar a{color:var(--club-ink);text-decoration:none;padding:22px 26px;display:flex;align-items:center;gap:15px;min-width:0;border-inline-end:1px solid #e3e9f2;transition:background .18s}
.wdn-trustbar a:last-child{border:0}
.wdn-trustbar a:hover{background:#eef4ff}
.wdn-trustbar .wdn-trust-icon{background:#edf3ff;color:#1244ab;border-radius:14px;font-size:21px;font-weight:900;width:46px;height:46px;display:grid;place-items:center;flex:0 0 auto}
.wdn-trustbar strong{display:block;font-size:16px;line-height:1.35}
.wdn-trustbar small{display:block;color:#63748e;font-size:12px;line-height:1.8;margin-top:3px}
.wdn-wrap{width:min(1240px,calc(100% - 56px));margin-top:0}
.wdn-section{margin-block:64px}
.wdn-section-head{gap:16px;margin-bottom:22px;align-items:end}
.wdn-section-head h2{font-size:clamp(25px,3vw,36px);font-weight:900;color:var(--club-deep);letter-spacing:-.7px;margin:0}
.wdn-section-head a{font-weight:800;color:#1452c5;border-bottom:1px solid #b4c8f2;padding-bottom:4px}
.wdn-kicker{display:block;font-size:12px;color:#1853be;font-weight:900;margin-bottom:6px}
.wdn-grid{gap:18px}
.wdn-card{border:1px solid #dde6f2;background:#fff;border-radius:18px;box-shadow:0 8px 22px #10285008;padding:25px;transition:transform .2s,box-shadow .2s,border-color .2s}
.wdn-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px #10285013;border-color:#bdd0ef}
.wdn-card h3{color:#102853;font-size:20px;line-height:1.5;font-weight:850}
.wdn-card p{line-height:1.9}
.wdn-label{display:inline-flex;color:#104abd;background:#edf3ff;font-size:12px;font-weight:900;border-radius:100px;padding:5px 11px}
.wdn-editorial-lead{font-size:16px;line-height:1.9;max-width:640px;color:#61738d;margin:6px 0 0}
.wdn-feature-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:18px}
.wdn-news-feature{display:flex;flex-direction:column;min-height:270px;background:linear-gradient(150deg,#0a2863,#114bbb);color:#fff;border-radius:20px;padding:34px;overflow:hidden;position:relative}
.wdn-news-feature:after{content:"";width:220px;height:220px;position:absolute;bottom:-140px;left:-75px;border:55px solid #ffffff12;border-radius:50%;pointer-events:none}
.wdn-news-feature h3{font-size:clamp(23px,2.7vw,34px);font-weight:900;line-height:1.55;position:relative;z-index:1;color:#fff}
.wdn-news-feature p{color:#e0e9fc;max-width:720px;position:relative;z-index:1}
.wdn-news-feature .wdn-label{background:#ffde3b;color:#132854;align-self:flex-start}
.wdn-news-feature small{color:#d7e2fa;font-size:12px}
.wdn-news-feature a{display:inline-block;align-self:flex-start;color:var(--club-yellow);font-weight:800;text-decoration:none;margin-top:auto}
.wdn-news-side{display:grid;gap:18px;grid-template-rows:repeat(2,minmax(0,1fr))}
.wdn-news-side .wdn-card{padding:22px}
.wdn-news-side .wdn-card h3{font-size:17px}
.wdn-news-side .wdn-card p{font-size:13px;margin-bottom:0}
.wdn-areas .wdn-card{position:relative;overflow:hidden;border-top:5px solid #1655ce}
.wdn-areas .wdn-card:nth-child(2){border-top-color:var(--club-yellow)}
.wdn-areas .wdn-card:nth-child(3){border-top-color:#0d3179}
.wdn-gallery-grid{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:13px}
.wdn-photo{position:relative;margin:0;min-height:225px;overflow:hidden;border-radius:17px;background:#102a60}
.wdn-photo img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover;display:block;transition:transform .3s}
.wdn-photo:hover img{transform:scale(1.035)}
.wdn-photo figcaption{position:absolute;inset:auto 0 0;background:linear-gradient(transparent,#061b4bd9);color:white;font-size:14px;font-weight:850;padding:50px 18px 17px}
.wdn-band{border-radius:22px;background:linear-gradient(125deg,#e7efff,#f8fbff);border:1px solid #d2def0;padding:38px;box-shadow:0 6px 28px #0d2a5410}
.wdn-band h2{color:#0d2e66;font-weight:900}
.wdn-band p{max-width:680px}
.wdn-band .wdn-button{white-space:normal;text-align:center}
.wdn-services{border-radius:18px;border-color:#dce4f2;box-shadow:0 12px 30px #1c3e710c}
.wdn-service{padding:26px}
.wdn-service small{color:#104bb6;font-weight:800}
.wdn-service strong{color:#0d2b63;font-weight:900}
.wdn-service:hover{background:#f2f6ff}
.wdn-pagehead{background:linear-gradient(120deg,#0a2457,#1249ad);border:0;color:#fff;position:relative;overflow:hidden;padding-top:55px;padding-bottom:55px}
.wdn-pagehead:after{content:"";position:absolute;left:-90px;bottom:-190px;width:330px;height:330px;border:42px solid #ffffff12;border-radius:50%}
.wdn-pagehead h1{color:#fff;font-weight:950}
.wdn-pagehead p{color:#e3ecff}
.wdn-breadcrumb,.wdn-breadcrumb a{color:#ffe773}
.wdn-empty{border-color:#cfdbeb}
footer.wdn-footer{background:#071b42;color:#e8f0fc;border-top:6px solid var(--club-yellow)}
.wdn-footer a:hover{color:#ffe86b;text-decoration:underline}
@media(max-width:1080px){
 .wdn-hero-inner{min-height:530px;gap:20px}
 .wdn-crest-frame{width:min(100%,280px)}
 .wdn-header .wdn-brand b{font-size:17px}
}
@media(max-width:760px){
 .wdn-hero-inner{grid-template-columns:1fr;min-height:unset;gap:25px;padding:52px 0 53px;width:calc(100% - 36px)}
 .wdn-hero h1{font-size:clamp(38px,9vw,52px);margin-top:22px}
 .wdn-hero h1 span{font-size:clamp(27px,6vw,36px)}
 .wdn-hero p{font-size:15px}
 .wdn-hero-art{display:flex;padding:10px;max-width:280px;margin:4px auto 0}
 .wdn-crest-frame{width:165px;border-radius:30px;box-shadow:0 15px 35px #03112f69}
 .wdn-crest-frame:after{inset:-8px;border-radius:36px}
 .wdn-hero-art .wdn-crest-frame img{border-radius:14px;padding:7px}
 .wdn-hero-art .wdn-year-pill{margin-top:-5px;font-size:12px;padding:6px 13px;transform:translateY(-7px)}
 .wdn-hero-art small{display:none}
 .wdn-trustbar{grid-template-columns:1fr;margin-top:-15px}
 .wdn-trustbar a{padding:16px 19px;border-inline-end:0;border-bottom:1px solid #e3e9f2}
 .wdn-trustbar a:last-child{border-bottom:0}
 .wdn-wrap{width:calc(100% - 32px)}
 .wdn-feature-grid{grid-template-columns:1fr}
 .wdn-news-side{grid-template-columns:1fr 1fr;grid-template-rows:auto}
 .wdn-gallery-grid{grid-template-columns:1fr 1fr}
 .wdn-photo:first-child{grid-column:1/-1;min-height:260px}
 .wdn-photo{min-height:160px}
 .wdn-section{margin-block:45px}
 .wdn-section-head{align-items:start}
 .wdn-band{padding:25px}
 .wdn-pagehead{padding:34px 18px}
}
@media(max-width:520px){
 .wdn-hero .wdn-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
 .wdn-hero .wdn-actions .wdn-button{min-width:0;font-size:12px;padding:10px 9px}
 .wdn-news-feature{padding:25px;min-height:255px}
 .wdn-news-side{grid-template-columns:1fr}
 .wdn-gallery-grid{grid-template-columns:1fr 1fr}
 .wdn-photo:first-child{grid-column:1/-1}
 .wdn-brand img{width:40px;height:40px}
 .wdn-header .wdn-brand b{font-size:15px}
 .wdn-header .wdn-brand small{font-size:10px}
 .wdn-trustbar strong{font-size:15px}
 .wdn-services .wdn-service strong{font-size:17px}
 .wdn-band .wdn-button{display:flex;width:100%}
}
@media(max-width:360px){
 .wdn-header a.wdn-join{font-size:10px;padding:10px 7px}
 .wdn-hero .wdn-actions{grid-template-columns:1fr}
 .wdn-header .wdn-brand{gap:5px}
 .wdn-header .wdn-brand b{font-size:14px}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.wdn-button,.wdn-card,.wdn-photo img{transition:none!important}}
@media print{.wdn-trustbar{box-shadow:none}.wdn-hero{background:#fff;color:#000}.wdn-hero h1,.wdn-hero h1 span,.wdn-hero p{color:#000}}
`;
