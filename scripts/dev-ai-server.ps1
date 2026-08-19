# apps/ai-server(FastAPI)를 venv 활성화 + uvicorn 실행까지 한 번에 처리한다.
# apps/ai-server는 pnpm workspace 멤버가 아니므로(package.json 없음, CLAUDE.md 참고)
# turbo run dev에 묶이지 않는다 - 그래서 별도 스크립트로 감싼다.
$ErrorActionPreference = "Stop"

$aiServerDir = Join-Path $PSScriptRoot "..\apps\ai-server"
$venvActivate = Join-Path $aiServerDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
    Write-Host "apps/ai-server/.venv가 없습니다. 먼저 아래로 venv를 만들어주세요:" -ForegroundColor Yellow
    Write-Host "  cd apps/ai-server"
    Write-Host "  py -3.11 -m venv .venv"
    Write-Host "  .\.venv\Scripts\Activate.ps1"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

Set-Location $aiServerDir
& $venvActivate

# PATH에 다른 venv가 먼저 잡혀 엉뚱한 uvicorn이 실행되는 걸 막기 위해
# 항상 현재 활성화된 venv의 python -m uvicorn으로 띄운다.
python -m uvicorn app.main:app --reload --port 8000
