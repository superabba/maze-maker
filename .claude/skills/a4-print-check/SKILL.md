---
name: a4-print-check
description: 숫자 미로 문제지가 인쇄할 때 한 장당 A4 한 장에 들어가는지 Edge 헤드리스 PDF 인쇄로 확인한다. 설명칸(참고표), 문구, 미로 크기, style.css를 바꾼 뒤나 커밋 전에 사용.
---

# A4 한 장 인쇄 확인

`check.ps1`이 수열마다 "전체 모양 한꺼번에 보기"(모양 11가지)로 문제지를 만들어
Microsoft Edge 헤드리스로 PDF 인쇄한 뒤, PDF 쪽 수가 문제지 장 수와 같은지 본다.

## 실행

PowerShell 도구로 실행한다(몇 분 걸리므로 timeout을 넉넉히).

```powershell
& ".claude/skills/a4-print-check/check.ps1"                       # 설명칸이 긴 수열 기본 묶음
& ".claude/skills/a4-print-check/check.ps1" -Seqs square,triangle  # 원하는 수열만
& ".claude/skills/a4-print-check/check.ps1" -Answers               # 정답지까지 함께 인쇄
```

수열 id는 `maze.js`의 `SEQUENCES`에 있다(one, two, five, down, abc, kor, prime, square, triangle, fib, pow2, pi, e, fact).

## 결과 읽기

- 수열마다 `OK 11/11쪽` 또는 `FAIL`이 나온다. 하나라도 FAIL이면 스크립트가 종료 코드 1로 끝난다.
- FAIL이면 넘친 쪽이 있다는 뜻: 설명칸 높이(`.hint`, `.hint.many`)나 `.page` 인쇄 높이(`@media print`)를 고친다.
- 눈으로 보고 싶으면 출력된 PDF 경로를 사용자에게 알려 주거나, `-Screenshot`으로 첫 장 PNG를 만들어 Read 도구로 본다.

## 주의

- 화면 크기를 잴 때 창 폭이 800px 이하면 휴대폰용 규칙이 적용되어 결과가 달라진다. 스크립트는 1400px로 연다.
- 결과 파일은 `%TEMP%\maze-a4-check`에 저장된다(프로젝트 폴더에 남기지 않음).
