# ⚠ 이 저장소는 "광고용" 랜딩입니다

- 광고용(이 저장소) : leaders-remote-ad
- 안내용(별도 저장소): leaders-remote-closing — **절대 건드리지 말 것**

두 저장소는 같은 번들 구조를 쓰지만 **내용은 서로 다르게 관리**됩니다.
한쪽 수정을 다른 쪽에 자동으로 반영하지 마세요.

# 리더스원격 랜딩페이지 — 저장소 규칙

## index.html 구조 (23MB 단일 파일, 405줄)

- 1~388줄: 번들 해제 부트스트랩 JS
- 390줄: `__bundler/manifest` — base64 에셋(폰트·이미지), 약 23.19MB
- 394줄: `ext_resources` — React 18.3.1 CDN 참조
- **402줄: `__bundler/template` — 화면에 보이는 모든 텍스트. 실제 편집 대상은 여기뿐.**

402줄은 JSON 문자열로 인코딩되어 있고, 디코딩하면 1,068줄짜리 HTML이 된다.

- 1~739줄: HTML 마크업 + `{{ }}` 바인딩 + `<sc-if>` / `<sc-for>`
- 740~1065줄: `<script type="text/x-dc">` 안의 `class Component extends DCLogic`
  (`courses[]`, `compareRows[]`, `reviews[]`, `faqData[]` 실데이터)

## index.html을 직접 편집하지 말 것

파일을 직접 열어 문자열 치환하거나 포매터를 돌리면 깨진다. 반드시 `tools/bundle.ps1`로
402줄만 추출(`build/template.html`)해서 그 파일만 수정하고, 다시 조립한다.

```
powershell -ExecutionPolicy Bypass -File tools\bundle.ps1 extract   # index.html -> build/template.html
# build/template.html 만 수정
powershell -ExecutionPolicy Bypass -File tools\bundle.ps1 rebuild   # build/template.html -> index.html
powershell -ExecutionPolicy Bypass -File tools\bundle.ps1 check     # 무변경 자체검증 (편집 전 원본 무결성 확인용)
```

깨지는 두 가지 원인 (스크립트가 자동 처리, 직접 손대지 말 것):

1. 개행은 CRLF(`\r\n`). `\n`으로 저장하면 404곳이 어긋난다.
2. 템플릿 JSON 안의 `</`는 `</`로 이스케이프해야 한다. 안 하면 문자열 속
   `</script>`가 바깥 `<script>` 태그를 조기 종료시켜 페이지가 백지가 된다.

## 템플릿 문법

- `{{ expr }}` — 값 바인딩 (속성값 안에서도 동작)
- `<sc-if value="{{ flag }}" hint-placeholder-val="{{ true }}">` — 조건부 렌더
- `<sc-for list="{{ items }}" as="x" ...>` — 반복
- `sc-camel-on-click="{{ handler }}"` — 이벤트
- `sc-if`에 부정(`!`) 문법은 없다. 반대 조건은 `renderVals()`에서 불리언을 따로 만들 것.

## 브랜드 색

배경 `#0A0B0D` / 카드 `#121316` / 포인트 `#CCFF00` / 긴급 `#FF6B3D`
본문 `#D3D6DC`·`#C7CBD2` / 보조 `#8A8F98`·`#6B7078` / 제목 `#F5F6F7`

## 배포

GitHub 푸시 → Vercel 자동 배포가 정해진 경로. Vercel CLI로 직접 배포하지 않는다.
index.html이 23MB라 커밋 한 번마다 git 히스토리가 약 17MB 늘어난다. 한 작업 안에서
여러 번 고치게 되면 `git commit --amend`로 커밋을 하나로 유지한다.
