/* ══════════════════════════════════════════════════════════════════
   리더스원격 광고 랜딩 — 추적 · 고정바 · 상담신청 폼
   프레임워크(x-dc) 바깥에서 동작한다. 재렌더링의 영향을 받지 않는다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── 설정 — 여기 두 줄만 바꾸면 된다 ─────────────────────── */
  var CFG = {
    PIXEL_ID : '__PIXEL_ID__',     // Meta 픽셀 ID (16자리 숫자)
    ENDPOINT : '__ENDPOINT__',     // Apps Script 웹앱 URL (.../exec)
    PHONE    : '01063156050'
  };
  var HAS_PIXEL = /^\d{6,}$/.test(CFG.PIXEL_ID);
  var HAS_EP    = /^https:\/\/script\.google\.com\//.test(CFG.ENDPOINT);

  /* ─── 과정 목록 ────────────────────────────────────────────── */
  var COURSES = [
    { slug:'social-welfare', name:'사회복지사 2급',          sms:'사회복지사 2급' },
    { slug:'korean',         name:'한국어교원 2급',          sms:'한국어교원 2급' },
    { slug:'librarian',      name:'정사서 2급 (문헌정보학)', sms:'정사서 2급' },
    { slug:'beauty',         name:'종합미용면허증 (미용학)', sms:'종합미용면허증' },
    { slug:'sports',         name:'체육학',                  sms:'체육학' },
    { slug:'computer',       name:'컴퓨터공학',              sms:'컴퓨터공학' },
    { slug:'electrical',     name:'전기공학',                sms:'전기공학' },
    { slug:'cpa',            name:'CPA 응시자격',            sms:'CPA 응시자격' },
    { slug:'transfer',       name:'편입 / 경영학',           sms:'편입·경영학' },
    { slug:'childcare',      name:'보육교사 2급',            sms:'보육교사 2급' }
  ];
  function courseBySlug(sl) {
    for (var i = 0; i < COURSES.length; i++) if (COURSES[i].slug === sl) return COURSES[i];
    return null;
  }
  function curSlug() {
    var m = (location.hash || '').match(/^#\/course\/([\w-]+)/);
    return m ? m[1] : '';
  }

  /* ─── 후킹 문구 6종 ────────────────────────────────────────── */
  var HOOKS = [
    { id:'a5', axis:'망설임',     text:'검색만 반복하다 지치지 않으셨나요?' },
    { id:'a6', axis:'망설임',     text:'여기까지 보셨으면, 이미 마음은 정하신 겁니다' },
    { id:'b5', axis:'가격비교',   text:'견적 세 곳 받아보셨다면, 마지막으로 여기까지' },
    { id:'c1', axis:'시기',       text:'학점인정 신청은 1·4·7·10월,\n연 4회뿐입니다' },
    { id:'d1', axis:'이득',       text:'내 학력이면 몇 학점 인정될까요?' },
    { id:'f2', axis:'정보비대칭', text:'학점은 채웠는데 자격이 안 되는 경우가 있습니다' }
  ];
  var QS = new URLSearchParams(location.search);
  var HOOK = (function () {
    var f = QS.get('hook');
    for (var i = 0; i < HOOKS.length; i++) if (HOOKS[i].id === f) return HOOKS[i];
    var saved = null;
    try { saved = sessionStorage.getItem('lr_hook'); } catch (e) {}
    for (var j = 0; j < HOOKS.length; j++) if (HOOKS[j].id === saved) return HOOKS[j];
    var pick = HOOKS[Math.floor(Math.random() * HOOKS.length)];
    try { sessionStorage.setItem('lr_hook', pick.id); } catch (e) {}
    return pick;
  })();

  /* ─── 유입 정보 (해시 라우팅이라 반드시 ? 가 # 앞에 있어야 한다) ── */
  var SRC = {
    page         : location.origin + location.pathname,
    utm_source   : QS.get('utm_source')   || '',
    utm_medium   : QS.get('utm_medium')   || '',
    utm_campaign : QS.get('utm_campaign') || '',
    utm_term     : QS.get('utm_term')     || '',
    utm_content  : QS.get('utm_content')  || '',
    cid  : QS.get('cid')  || '',
    asid : QS.get('asid') || '',
    adid : QS.get('adid') || '',
    plat : QS.get('plat') || '',
    plc  : QS.get('plc')  || '',
    fbclid: QS.get('fbclid') || ''
  };

  /* ─── 픽셀 ─────────────────────────────────────────────────── */
  var STD = ['PageView','ViewContent','InitiateCheckout','Lead','Contact','CompleteRegistration','Search','Schedule'];
  if (HAS_PIXEL) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', CFG.PIXEL_ID);
  }
  function fire(name, params) {
    var p = params || {};
    p.hook = HOOK.id;
    if (window.fbq) fbq(STD.indexOf(name) >= 0 ? 'track' : 'trackCustom', name, p);
    if (QS.get('debug') === '1') console.log('[px]', name, JSON.stringify(p));
    (window.__lrLog = window.__lrLog || []).push([name, p]);
  }

  /* ─── 행동 상태 (Exit 이벤트에 담는다) ─────────────────────── */
  var ST = {
    t0: Date.now(), depth: 0, pdepth: 0, gateOpen: 0, lastCta: '', courses: {}, lastCourse: '',
    formStage: 'none', clicked: {}, sent: false
  };
  function dwell() { return Math.round((Date.now() - ST.t0) / 1000); }
  function keys(o) { var a = []; for (var k in o) if (o.hasOwnProperty(k)) a.push(k); return a; }

  /* ─── 문자 링크 : iOS 는 &body= , 안드로이드는 ?body= ──────── */
  function isIOS() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return /Macintosh/.test(ua) && (navigator.maxTouchPoints > 1 || 'ontouchend' in document);
  }
  function smsUrl(smsName) {
    var body = (smsName || '학점은행제') + ' 상담 문의드립니다.';
    return 'sms:' + CFG.PHONE + (isIOS() ? '&' : '?') + 'body=' + encodeURIComponent(body);
  }

  /* ─── 스타일 ───────────────────────────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '#lrBar{position:fixed;bottom:0;left:0;right:0;z-index:60;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(10,11,13,0.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid rgba(255,255,255,0.08);font-family:inherit;position:fixed}',
    '#lrBar .pg{position:absolute;left:0;top:-1px;height:2px;width:0;background:#CCFF00;box-shadow:0 0 10px rgba(204,255,0,0.6);transition:width .35s ease;opacity:0}',
    '#lrBar.gate .pg{opacity:1}',
    '#lrBar .b.lock{background:rgba(255,255,255,0.07);color:#8A8F98;box-shadow:none;border:1px solid rgba(255,255,255,0.12);cursor:default;font-size:12px;padding:11px 14px}',
    '#lrBar .t{flex:1;min-width:0;color:#8A8F98;font-size:12px;font-weight:600;line-height:1.4;white-space:pre-line}',
    '#lrBar .b{flex:0 0 auto;background:#CCFF00;color:#0A0B0D;font-family:inherit;font-size:13.5px;font-weight:900;padding:12px 16px;border-radius:11px;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(204,255,0,0.22)}',
    '#lrDim{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,0.66);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .25s}',
    '#lrDim.on{opacity:1;pointer-events:auto}',
    '#lrSheet{position:fixed;left:0;right:0;bottom:0;z-index:91;max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#101114;border-top:1px solid rgba(204,255,0,0.28);border-radius:22px 22px 0 0;transform:translateY(102%);transition:transform .3s cubic-bezier(.2,.8,.3,1);font-family:inherit;box-shadow:0 -20px 60px rgba(0,0,0,0.6)}',
    '#lrSheet.on{transform:translateY(0)}',
    '#lrSheet .in{max-width:520px;margin:0 auto;padding:20px 18px 30px}',
    '#lrSheet .grab{width:38px;height:4px;border-radius:3px;background:rgba(255,255,255,0.22);margin:0 auto 16px}',
    '#lrSheet h3{color:#F5F6F7;font-size:19px;font-weight:900;letter-spacing:-0.025em;line-height:1.35}',
    '#lrSheet h3 span{color:#CCFF00}',
    '#lrSheet .sub{color:#8A8F98;font-size:12.5px;line-height:1.65;margin-top:8px}',
    '#lrSheet .lb{color:#C7CBD2;font-size:13px;font-weight:800;margin:20px 0 9px;display:block}',
    '#lrSheet .lb i{color:#CCFF00;font-style:normal;margin-left:3px}',
    '#lrSheet .chips{display:flex;flex-wrap:wrap;gap:7px}',
    '#lrSheet .chip{background:#1a1c21;border:1px solid rgba(255,255,255,0.11);color:#A1A5AD;font-family:inherit;font-size:12.5px;font-weight:700;padding:9px 13px;border-radius:9px;cursor:pointer}',
    '#lrSheet .chip.on{background:#CCFF00;border-color:#CCFF00;color:#0A0B0D}',
    '#lrSheet input[type=text],#lrSheet input[type=tel]{width:100%;background:#1a1c21;border:1px solid rgba(255,255,255,0.11);border-radius:10px;color:#F5F6F7;font-family:inherit;font-size:15px;padding:13px 14px;outline:none}',
    '#lrSheet input:focus{border-color:rgba(204,255,0,0.5)}',
    '#lrSheet input::placeholder{color:#5b6270}',
    '#lrSheet .go{width:100%;background:#CCFF00;color:#0A0B0D;font-family:inherit;font-size:16px;font-weight:900;padding:16px;border-radius:13px;border:none;cursor:pointer;margin-top:22px;box-shadow:0 10px 30px rgba(204,255,0,0.22)}',
    '#lrSheet .go:disabled{opacity:.4;box-shadow:none;cursor:default}',
    '#lrSheet .back{background:none;border:none;color:#6B7078;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;padding:12px 0 0;width:100%}',
    '#lrSheet .agree{display:flex;gap:9px;align-items:flex-start;margin-top:18px;cursor:pointer}',
    '#lrSheet .agree input{margin-top:2px;width:17px;height:17px;accent-color:#CCFF00;flex:0 0 auto}',
    '#lrSheet .agree span{color:#8A8F98;font-size:12px;line-height:1.6}',
    '#lrSheet .err{color:#FF9A6B;font-size:12px;font-weight:700;margin-top:10px;min-height:16px}',
    '#lrSheet .x{position:absolute;top:14px;right:16px;background:none;border:none;color:#6B7078;font-size:22px;cursor:pointer;line-height:1;font-family:inherit}',
    '#lrSheet .done{text-align:center;padding:14px 0 4px}',
    '#lrSheet .done .ok{width:56px;height:56px;border-radius:50%;background:rgba(204,255,0,0.12);border:1.5px solid rgba(204,255,0,0.5);color:#CCFF00;font-size:26px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}',
    '#lrSheet .tel2{display:flex;gap:9px;margin-top:14px}',
    '#lrSheet .tel2 a{flex:1;text-align:center;text-decoration:none;font-size:14px;font-weight:800;padding:13px;border-radius:11px;border:1px solid rgba(204,255,0,0.32);background:rgba(204,255,0,0.07);color:#F5F6F7}',
    '#lrSheet .tel2 a.s{border-color:rgba(255,255,255,0.17);background:rgba(255,255,255,0.04)}',
    'body.lrLock{overflow:hidden}'
  ].join('');
  document.head.appendChild(css);

  /* ─── 하단 고정바 ──────────────────────────────────────────── */
  var bar = document.createElement('div');
  bar.id = 'lrBar';
  bar.innerHTML = '<i class="pg"></i><span class="t"></span><button class="b" data-cta="sticky">1:1 무료 상담 신청</button>';
  bar.querySelector('.t').textContent = HOOK.text;
  bar.querySelector('.b').style.transition = 'opacity .4s ease, transform .4s ease';

  /* 과정 상세에서는 「수업만 들으면 자격증이 나올까요?」 구간에 닿으면 상담 버튼을 연다 */
  var GATE_ID = 'sec-admin';
  var gateHold = 0;
  function gateRatio() {
    if (gateHold && Date.now() < gateHold) return 0;
    var el = document.getElementById(GATE_ID);
    if (!el) return 0;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var need = el.getBoundingClientRect().top + y - window.innerHeight * 0.55;
    if (need <= 0) return 1;
    return Math.min(1, y / need);
  }
  function ctaGate() {
    var b  = bar.querySelector('.b');
    var pg = bar.querySelector('.pg');
    if (!b) return;
    var gated = !!curSlug();
    if (gated && !ST.gateOpen && gateRatio() >= 1) ST.gateOpen = 1;
    var open  = !gated || !!ST.gateOpen;
    bar.className = (gated && !open) ? 'gate' : '';
    if (pg) pg.style.width = (gated && !open)
      ? Math.round(gateRatio() * 100) + '%' : '0';
    if (open) {
      b.className = 'b';
      b.textContent = '1:1 무료 상담 신청';
      b.style.pointerEvents = 'auto';
      if (!ST.clicked['gate']) { ST.clicked['gate'] = 1; fire('CTAUnlock', { depth: ST.pdepth }); }
    } else {
      b.className = 'b lock';
      b.textContent = '조금만 더 보시면 신청 가능';
      b.style.pointerEvents = 'none';
    }
  }

  /* ─── 상담희망시간 예시 (오늘 날짜) ────────────────────────── */
  function todayHint() {
    var d = new Date();
    return '예) ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 저녁 8시 이후';
  }

  /* ─── 폼 시트 ──────────────────────────────────────────────── */
  var EDUS = ['고졸', '전문대졸', '대졸', '중퇴(기타)'];
  var dim = document.createElement('div'); dim.id = 'lrDim';
  var sheet = document.createElement('div'); sheet.id = 'lrSheet';
  sheet.innerHTML =
    '<button class="x" aria-label="닫기">×</button><div class="in">' +
      '<div class="grab"></div>' +

      '<div data-step="1">' +
        '<h3>내 학력이면 몇 학점,<br><span>30초면 확인됩니다.</span></h3>' +
        '<p class="sub">이미 가지고 계신 학점부터 계산해, 남은 과목·기간·비용을 정리해 드립니다.</p>' +
        '<label class="lb">관심 과정<i>*</i></label>' +
        '<div class="chips" id="lrCourses"></div>' +
        '<label class="lb">최종 학력<i>*</i></label>' +
        '<div class="chips" id="lrEdus"></div>' +
        '<div class="err" id="lrErr1"></div>' +
        '<button class="go" id="lrNext" disabled>다음</button>' +
      '</div>' +

      '<div data-step="2" style="display:none">' +
        '<h3>어디로 연락드리면 <span>될까요?</span></h3>' +
        '<p class="sub">김주민 담당자가 작성하신 내용을 토대로 연락드립니다.<br>저녁 10시까지 실시간 문의가 가능하고, 주말에도 동일하게 운영됩니다.</p>' +
        '<label class="lb">이름<i>*</i></label>' +
        '<input type="text" id="lrName" placeholder="홍길동" autocomplete="name">' +
        '<label class="lb">연락처<i>*</i></label>' +
        '<input type="tel" id="lrPhone" placeholder="010-1234-5678" autocomplete="tel" inputmode="numeric">' +
        '<label class="lb">상담 희망 날짜 및 시간<i>*</i></label>' +
        '<input type="text" id="lrTime" placeholder="">' +
        '<label class="agree"><input type="checkbox" id="lrAgree"><span>[필수] 상담 진행을 위한 개인정보(이름·연락처) 수집·이용에 동의합니다. 수집한 정보는 상담 목적으로만 사용되며, 상담 종료 후 파기합니다.</span></label>' +
        '<div class="err" id="lrErr2"></div>' +
        '<button class="go" id="lrSubmit">상담 신청하기</button>' +
        '<button class="back" id="lrBack">← 이전으로</button>' +
      '</div>' +

      '<div data-step="3" style="display:none">' +
        '<div class="done">' +
          '<div class="ok">✓</div>' +
          '<h3>접수됐습니다.<br><span id="lrDoneName">김주민 담당자</span>가 곧 연락드립니다.</h3>' +
          '<p class="sub" style="margin-top:12px">저녁 10시까지 문의를 받습니다. 주말에도 동일합니다.<br>지금 바로 물어보고 싶으시면 아래로 연락 주세요.</p>' +
          '<div class="tel2">' +
            '<a id="lrTel" href="#">☎ 전화하기</a>' +
            '<a id="lrSms" href="#" class="s">✉ 문자하기</a>' +
          '</div>' +
          '<p class="sub" style="margin-top:11px">010-6315-6050</p>' +
        '</div>' +
      '</div>' +

    '</div>';

  function boot() {
    if (!document.body) return setTimeout(boot, 30);
    document.body.appendChild(bar);
    document.body.appendChild(dim);
    document.body.appendChild(sheet);
    buildChips();
    document.getElementById('lrTime').placeholder = todayHint();
    document.getElementById('lrTel').href = 'tel:' + CFG.PHONE;
    fire('PageView', {});
    fire('HookView', { hook_axis: HOOK.axis });
    onRoute();
  }

  /* ─── 칩 ───────────────────────────────────────────────────── */
  var sel = { course: '', edu: '' };
  function buildChips() {
    var cw = document.getElementById('lrCourses');
    COURSES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = c.name; b.dataset.slug = c.slug;
      b.onclick = function () { pickCourse(c.slug); };
      cw.appendChild(b);
    });
    var ew = document.getElementById('lrEdus');
    EDUS.forEach(function (e) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = e;
      b.onclick = function () { sel.edu = e; syncChips(); };
      ew.appendChild(b);
    });
  }
  function pickCourse(sl) { sel.course = sl; syncChips(); }
  function syncChips() {
    [].forEach.call(document.querySelectorAll('#lrCourses .chip'), function (b) {
      b.classList.toggle('on', b.dataset.slug === sel.course);
    });
    [].forEach.call(document.querySelectorAll('#lrEdus .chip'), function (b) {
      b.classList.toggle('on', b.textContent === sel.edu);
    });
    document.getElementById('lrNext').disabled = !(sel.course && sel.edu);
  }

  /* ─── 시트 열기/닫기 ───────────────────────────────────────── */
  function step(n) {
    [1, 2, 3].forEach(function (i) {
      sheet.querySelector('[data-step="' + i + '"]').style.display = (i === n ? '' : 'none');
    });
    sheet.scrollTop = 0;
  }
  function openSheet(pos) {
    ST.clicked[pos] = 1;
    ST.lastCta = pos;
    fire('CTAClick', { cta_pos: pos, content_name: nameOf(curSlug()) });
    if (!sel.course && curSlug()) pickCourse(curSlug());
    if (ST.formStage === 'none') ST.formStage = 'opened';
    step(1); syncChips();
    dim.classList.add('on'); sheet.classList.add('on');
    document.body.classList.add('lrLock');
    fire('InitiateCheckout', { cta_pos: pos, content_name: nameOf(sel.course || curSlug()) });
  }
  function closeSheet() {
    dim.classList.remove('on'); sheet.classList.remove('on');
    document.body.classList.remove('lrLock');
  }
  function nameOf(sl) { var c = courseBySlug(sl); return c ? c.name : '홈'; }

  dim.onclick = closeSheet;
  sheet.querySelector('.x').onclick = closeSheet;

  /* ─── 유효성 ───────────────────────────────────────────────── */
  function normPhone(v) { return (v || '').replace(/[^0-9]/g, ''); }
  function validPhone(v) { var d = normPhone(v); return /^01[016789]\d{7,8}$/.test(d); }
  /* 시트에는 010-1234-5678 형태로 통일해 넣는다. 나중에 정렬·중복 확인이 쉬워진다. */
  function fmtPhone(v) {
    var d = normPhone(v);
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return v;
  }

  /* ─── 제출 ─────────────────────────────────────────────────── */
  function payload() {
    var c = courseBySlug(sel.course);
    var d = {
      name  : document.getElementById('lrName').value.trim(),
      phone : fmtPhone(document.getElementById('lrPhone').value),
      course: c ? c.name : '',
      slug  : sel.course,
      edu   : sel.edu,
      time  : document.getElementById('lrTime').value.trim(),
      hook  : HOOK.id,
      depth : String(ST.depth),
      pdepth: String(ST.pdepth),
      dwell : String(dwell()),
      cta   : ST.lastCta || ''
    };
    for (var k in SRC) if (SRC.hasOwnProperty(k)) d[k] = SRC[k];
    return d;
  }
  function send(d, cb) {
    if (!HAS_EP) { cb(false, 'no-endpoint'); return; }
    var body = new URLSearchParams(d).toString();
    try {
      fetch(CFG.ENDPOINT, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body
      }).then(function () { cb(true); }).catch(function () {
        try {
          navigator.sendBeacon(CFG.ENDPOINT,
            new Blob([body], { type: 'application/x-www-form-urlencoded;charset=UTF-8' }));
        } catch (e) {}
        cb(true, 'beacon');
      });
    } catch (e) { cb(false, String(e)); }
  }

  /* ─── 단계 이동 ────────────────────────────────────────────── */
  document.addEventListener('click', function (ev) {
    var t = ev.target;

    if (t.closest && t.closest('#lrNext')) {
      if (!(sel.course && sel.edu)) return;
      ST.formStage = 'step1';
      fire('FormStep1Done', { course: nameOf(sel.course), edu: sel.edu });
      step(2);
      setTimeout(function () { document.getElementById('lrName').focus(); }, 120);
      return;
    }
    if (t.closest && t.closest('#lrBack')) { step(1); return; }

    if (t.closest && t.closest('#lrSubmit')) {
      var e2 = document.getElementById('lrErr2');
      var nm = document.getElementById('lrName').value.trim();
      var ph = document.getElementById('lrPhone').value.trim();
      var tm = document.getElementById('lrTime').value.trim();
      var ag = document.getElementById('lrAgree').checked;
      if (!nm)            { e2.textContent = '이름을 입력해 주세요.';              fire('FormError', { field: 'name' });  return; }
      if (!validPhone(ph)){ e2.textContent = '연락처를 정확히 입력해 주세요.';     fire('FormError', { field: 'phone' }); return; }
      if (!tm)            { e2.textContent = '상담 희망 날짜와 시간을 입력해 주세요.';    fire('FormError', { field: 'time' });  return; }
      if (!ag)            { e2.textContent = '개인정보 수집·이용 동의가 필요합니다.'; fire('FormError', { field: 'agree' }); return; }
      e2.textContent = '';
      var btn = document.getElementById('lrSubmit');
      btn.disabled = true; btn.textContent = '보내는 중…';
      var d = payload();
      send(d, function (ok, why) {
        ST.formStage = 'submitted'; ST.sent = true;
        fire('Lead', { content_name: d.course, content_ids: [d.slug], edu: d.edu, delivered: ok ? 1 : 0 });
        fire('CompleteRegistration', { content_name: d.course });
        var c = courseBySlug(sel.course);
        document.getElementById('lrSms').href = smsUrl(c ? c.sms : '');
        step(3);
        btn.disabled = false; btn.textContent = '상담 신청하기';
        if (!ok && why === 'no-endpoint') console.warn('[lr] ENDPOINT 미설정 — 시트 저장 안 됨');
      });
      return;
    }

    /* 완료화면 전화·문자 */
    if (t.closest && t.closest('#lrTel')) {
      fire('Contact', { method: 'phone', content_name: nameOf(sel.course || curSlug()) }); return;
    }
    if (t.closest && t.closest('#lrSms')) {
      fire('Contact', { method: 'sms', content_name: nameOf(sel.course || curSlug()) }); return;
    }

    /* 페이지 내 이동 버튼 */
    var sc = t.closest && t.closest('[data-scroll]');
    if (sc) {
      ev.preventDefault();
      var id = sc.getAttribute('data-scroll');
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      ST.clicked['nav:' + id] = 1;
      fire('NavClick', { target: id, kind: 'scroll' });
      return;
    }
    /* 같은 페이지 안내 스크롤 (네온 강조) */
    var gd = t.closest && t.closest('[data-guide]');
    if (gd) {
      ev.preventDefault();
      var gid = gd.getAttribute('data-guide');
      ST.clicked['guide:' + gid] = 1;
      fire('NavClick', { target: gid, kind: 'guide', content_name: nameOf(curSlug()) });
      guideSection(gid);
      return;
    }
    /* 홈으로 이동 */
    var hm = t.closest && t.closest('[data-home]');
    if (hm) {
      ST.clicked['home'] = 1;
      var htgt = hm.getAttribute('data-home');
      fire('NavClick', { target: htgt, kind: 'home' });
      if (GUIDE_TARGET[htgt]) {
        ev.preventDefault();
        if ((location.hash || '') !== '#/') { location.hash = '#/'; }
        guideHome(htgt);
      }
      return;
    }

    /* CTA 버튼 전부 */
    var cta = t.closest && t.closest('[data-cta]');
    if (cta) { ev.preventDefault(); openSheet(cta.getAttribute('data-cta')); return; }

    /* 과정 카드 */
    var cc = t.closest && t.closest('[data-course-card]');
    if (cc) { fire('CourseCardClick', { slug: cc.getAttribute('data-course-card'), content_name: cc.getAttribute('data-course-name') }); return; }
    var oc = t.closest && t.closest('[data-other-course]');
    if (oc) { fire('OtherCourseClick', { from: curSlug(), to: oc.getAttribute('data-other-course'), content_name: oc.getAttribute('data-course-name') }); return; }

    /* 동아일보 */
    if (t.closest && t.closest('[data-news]')) { fire('NewsClick', {}); return; }

    /* 질문 아코디언 — 열릴 때만, 위치(top/bottom/common)와 함께 기록 */
    var fq = t.closest && t.closest('[data-faq]');
    if (fq) {
      var sp = [];
      for (var ci = 0; ci < fq.children.length; ci++) {
        if (fq.children[ci].tagName === 'SPAN') sp.push(fq.children[ci]);
      }
      var opening = !(sp[1] && sp[1].textContent.trim() === '\u2212');
      if (opening) {
        var slot = fq.getAttribute('data-faq') || '';
        var fi   = Number(fq.getAttribute('data-faq-i') || 0);
        ST.clicked['faq:' + slot + fi] = 1;
        fire('CourseFAQOpen', {
          slot: slot, idx: fi,
          q: (sp[0] ? sp[0].textContent.trim() : '').slice(0, 40),
          course: curSlug(), content_name: nameOf(curSlug())
        });
      }
      return;
    }

    /* 탭 · FAQ · 후기 — 라벨만 읽어 기록 */
    var btn2 = t.closest && t.closest('button');
    if (btn2 && !btn2.closest('#lrSheet') && !btn2.closest('#lrBar')) {
      var lb = (btn2.textContent || '').trim().slice(0, 24);
      if (btn2.closest('[id^=sec-]') || btn2.parentElement && btn2.parentElement.style.overflowX === 'auto') {
        fire('TabClick', { tab: lb });
      } else if (lb.indexOf('후기') === 0 || lb === '접기') {
        fire('ReviewOpen', {});
      } else if (lb) {
        fire('FAQOpen', { q: lb });
      }
    }
  }, true);


  /* ─── 홈으로 데려가서 지정 지점까지 안내 ───────────────────── */
  function easeInOutCubic(p) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }
  function smoothTo(y, dur, done) {
    var start = window.pageYOffset || document.documentElement.scrollTop;
    var dist = y - start, t0 = null;
    if (Math.abs(dist) < 4) { if (done) done(); return; }
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      window.scrollTo(0, start + dist * easeInOutCubic(p));
      if (p < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }

  /* 안내 목적지 : data-home 값 -> 찾는 방법 */
  var GUIDE_TARGET = {
    summary       : { sel: 'button', text: '학점은행제란?', mode: 'start' },
    hero_profile  : { sel: 'p',      text: '학위를 설계하는 일입니다.', mode: 'exact' },
    profile_intro : { sel: 'p',      text: '학위를 설계하는 일입니다.', mode: 'exact' },
    all_courses   : { sel: 'p',      text: '준비하고 계신가요?', mode: 'has' }
  };
  function findTarget(cfg) {
    var els = document.querySelectorAll(cfg.sel);
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (cfg.mode === 'exact' && t === cfg.text) return els[i];
      if (cfg.mode === 'start' && t.indexOf(cfg.text) === 0) return els[i];
      if (cfg.mode === 'has' && t.indexOf(cfg.text) >= 0) return els[i];
    }
    return null;
  }

  /* 네온 강조 : 한 번만 채우고, 아무 곳이나 누르면 원래대로 */
  var neonEl = null;
  function neonOn(el) {
    if (!el || el.__neon) return;
    var cs = window.getComputedStyle(el);
    el.__neonSave = {
      raw: el.getAttribute('style') || '',
      bgi: cs.backgroundImage, bgc: cs.backgroundColor, col: cs.color,
      bdc: cs.borderColor, shd: cs.boxShadow,
      kids: []
    };
    var ds = el.querySelectorAll('span,b');
    for (var i = 0; i < ds.length; i++) {
      el.__neonSave.kids.push([ds[i], ds[i].getAttribute('style') || '', window.getComputedStyle(ds[i]).color]);
    }
    el.__neon = 1; neonEl = el;
    var TR = 'transform .55s cubic-bezier(.2,.9,.3,1),background-color .55s ease,background-image .55s ease,box-shadow .55s ease,border-color .55s ease,color .55s ease,padding .55s ease';
    el.style.transition = TR;
    el.style.backgroundImage = 'none';
    el.style.backgroundColor = '#CCFF00';
    el.style.borderColor = '#CCFF00';
    el.style.color = '#0A0B0D';
    el.style.transform = (el.tagName === 'BUTTON') ? 'scale(1.06)' : 'scale(1.03)';
    el.style.boxShadow = '0 0 0 9px rgba(204,255,0,0.14),0 18px 52px rgba(204,255,0,0.45)';
    if (el.tagName !== 'BUTTON') { el.style.padding = '12px 15px'; el.style.borderRadius = '14px'; }
    for (i = 0; i < ds.length; i++) { ds[i].style.transition = 'color .55s ease'; ds[i].style.color = '#0A0B0D'; }
    setTimeout(function () {
      document.addEventListener('click', offOnce, true);
      document.addEventListener('touchstart', offOnce, true);
    }, 60);
  }
  function offOnce() {
    document.removeEventListener('click', offOnce, true);
    document.removeEventListener('touchstart', offOnce, true);
    neonOff(neonEl);
  }
  function neonOff(el) {
    if (!el || !el.__neon) return;
    var sv = el.__neonSave;
    el.style.backgroundImage = sv.bgi;
    el.style.backgroundColor = sv.bgc;
    el.style.borderColor = sv.bdc;
    el.style.color = sv.col;
    el.style.boxShadow = sv.shd;
    el.style.transform = 'none';
    if (el.tagName !== 'BUTTON') { el.style.padding = ''; el.style.borderRadius = ''; }
    for (var i = 0; i < sv.kids.length; i++) { sv.kids[i][0].style.color = sv.kids[i][2]; }
    setTimeout(function () {
      el.setAttribute('style', sv.raw);
      for (var j = 0; j < sv.kids.length; j++) sv.kids[j][0].setAttribute('style', sv.kids[j][1]);
      el.__neon = 0;
      if (neonEl === el) neonEl = null;
    }, 620);
  }

  var guiding = false;
  function guideSection(id) {
    if (guiding) return;
    var sec = document.getElementById(id);
    if (!sec) return;
    guiding = true;
    if (neonEl) { offOnce(); }
    var hl = sec.querySelector('[data-guide-hl]');
    var hd = hl || sec.querySelector('p') || sec;
    var anchor = hl || sec;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var y = anchor.getBoundingClientRect().top + (window.pageYOffset || 0) - (hl ? 120 : 96);
    if (y < 0) y = 0;
    if (reduce) { window.scrollTo(0, y); neonOn(hd); guiding = false; return; }
    var dist = Math.abs(y - (window.pageYOffset || 0));
    var dur = Math.max(700, Math.min(2200, dist * 1.1));
    smoothTo(y, dur, function () {
      neonOn(sec.querySelector('[data-guide-hl]') || sec.querySelector('p') || hd);
      guiding = false;
    });
  }
  function guideHome(key) {
    var cfg = GUIDE_TARGET[key];
    if (!cfg || guiding) return;
    guiding = true;
    if (neonEl) { offOnce(); }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo(0, 0);
    var tries = 0;
    (function wait() {
      var el = findTarget(cfg);
      if (!el) {
        if (++tries > 30) { guiding = false; return; }
        setTimeout(wait, 70); return;
      }
      setTimeout(function () {
        var el2 = findTarget(cfg) || el;
        var y = el2.getBoundingClientRect().top + (window.pageYOffset || 0) - 130;
        if (y < 0) y = 0;
        if (reduce) { window.scrollTo(0, y); neonOn(findTarget(cfg) || el2); guiding = false; return; }
        var dist = Math.abs(y - (window.pageYOffset || 0));
        var dur = Math.max(700, Math.min(2200, dist * 1.1));
        smoothTo(y, dur, function () {
          neonOn(findTarget(cfg));
          fire('GuideHome', { target: key });
          guiding = false;
        });
      }, reduce ? 0 : 400);
    })();
  }

  /* ─── 라우트 변화 ──────────────────────────────────────────── */
  function onRoute() {
    var sl = curSlug();
    if (!sl) return;
    if (!ST.courses[sl]) { ST.courses[sl] = 1; }
    ST.lastCourse = sl;
    fire('ViewContent', {
      content_name: nameOf(sl), content_ids: [sl],
      content_type: 'product', content_category: '학점은행제'
    });
  }
  window.addEventListener('hashchange', onRoute);

  /* ─── 스크롤 깊이 · 체류 ───────────────────────────────────── */
  /* ─── 게이지 애니메이션 — 화면에 들어오면 채운다 ─────────── */
  function fillGauges() {
    var vh = window.innerHeight || 800;
    var els = document.querySelectorAll('[data-gauge]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var top = el.getBoundingClientRect().top;
      var want = (top < vh - 60 && top > -400) ? (el.getAttribute('data-gauge') + '%') : el.style.width;
      if (top < vh - 60 && el.style.width !== el.getAttribute('data-gauge') + '%') {
        el.style.width = el.getAttribute('data-gauge') + '%';
      }
    }
  }

  /* 등장 효과 — 프레임워크 재렌더링으로 노드가 갈려도 매 스크롤마다 다시 적용한다 */
  function revealTick() {
    var vh = window.innerHeight || 800;
    var els = document.querySelectorAll('[data-reveal]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.style.opacity === '1') continue;
      if (el.getBoundingClientRect().top < vh - 30) {
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.setAttribute('data-seen', '1');
      }
    }
  }

  var hitD = {}, hitT = {};
  function onScroll() {
    fillGauges();
    revealTick();
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.round((window.scrollY / h) * 100) : 0;
    if (p > ST.depth)  ST.depth  = p;
    if (p > ST.pdepth) ST.pdepth = p;
    ctaGate();
    [25, 50, 75, 90].forEach(function (d) {
      if (ST.depth >= d && !hitD[d]) { hitD[d] = 1; fire('ScrollDepth', { depth: d }); }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* 화면 전환·재렌더링 직후에도 등장 효과와 게이지를 다시 맞춘다 */
  function refreshVisual() { fillGauges(); revealTick(); ctaGate(); }
  window.addEventListener('hashchange', function () {
    ST.pdepth = 0; ST.gateOpen = 0; gateHold = Date.now() + 900; delete ST.clicked['gate']; ctaGate();
    [60, 220, 500, 900].forEach(function (t) { setTimeout(refreshVisual, t); });
  });
  [120, 400, 800, 1400].forEach(function (t) { setTimeout(refreshVisual, t); });
  setInterval(refreshVisual, 700);
  [15, 30, 60, 120].forEach(function (sec) {
    setTimeout(function () {
      if (!hitT[sec] && !document.hidden) { hitT[sec] = 1; fire('Dwell', { sec: sec }); }
    }, sec * 1000);
  });

  /* ─── 이탈 프로필 — 한 번만 발사 ───────────────────────────── */
  var exited = false;
  function onExit() {
    if (exited) return; exited = true;
    fire('Exit', {
      depth        : ST.depth,
      dwell        : dwell(),
      viewed_course: ST.lastCourse || 'none',
      course_count : keys(ST.courses).length,
      form_stage   : ST.formStage,
      clicked      : keys(ST.clicked).join(',') || 'none'
    });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) onExit(); });
  window.addEventListener('pagehide', onExit);

  boot();
})();
