# 🚀 Quick Start Guide

**Goal**: Get from fresh git clone to working application in under 5 minutes.

## Prerequisites

✅ Docker & Docker Compose installed  
✅ Git installed  

## Step-by-Step

### 1. Clone & Enter

```bash
git clone <repository-url>
cd GanttChartWebUI
```

### 2. Setup Environment Files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3. Start All Services

```bash
./scripts/docker-dev.sh start
```

**Expected output:**

```
[INFO] 開発環境を起動しています...
[SUCCESS] 開発環境が起動しました
[INFO] フロントエンド: http://localhost:3000
[INFO] API: http://localhost:3001
```

**Available commands:**

- `./scripts/docker-dev.sh start` - 開発環境を起動
- `./scripts/docker-dev.sh stop` - 開発環境を停止  
- `./scripts/docker-dev.sh restart` - 開発環境を再起動
- `./scripts/docker-dev.sh logs` - 全サービスのログを表示
- `./scripts/docker-dev.sh shell` - APIコンテナのシェルを開く
- `./scripts/docker-dev.sh db` - PostgreSQLに接続
- `./scripts/docker-dev.sh migrate` - データベースマイグレーション実行
- `./scripts/docker-dev.sh seed` - シードデータを投入
- `./scripts/docker-dev.sh clean` - 全てのコンテナとボリュームを削除
- `./scripts/docker-dev.sh status` - サービス状況を確認

### 4. Verify Everything Works

**Open in browser:**

- 🌐 **Frontend**: [http://localhost:3000](http://localhost:3000)
  - Should show: **"Gantt Chart WebUI"** landing page
- 🔧 **API**: [http://localhost:3001/health](http://localhost:3001/health)
  - Should return: JSON health status

**Or run automated verification:**

```bash
./scripts/validate-dev-workflow.sh
```

✅ **Success indicator**: All tests pass (8/8)

---

## Development Workflow

### Daily Development

```bash
# Start development
./scripts/docker-dev.sh start

# View logs
./scripts/docker-dev.sh logs

# Stop when done
./scripts/docker-dev.sh stop
```

### Hot Reload

- **Frontend**: Edit files in `apps/web/src/` → Browser auto-refreshes
- **Backend**: Edit files in `apps/api/src/` → Server auto-restarts

### Database Operations

```bash
./scripts/docker-dev.sh migrate   # Run migrations
./scripts/docker-dev.sh seed      # Add sample data
./scripts/docker-dev.sh db        # Connect to PostgreSQL
```

---

## Troubleshooting

### ❌ "Port already in use"

```bash
./scripts/docker-dev.sh stop
./scripts/docker-dev.sh start
```

### ❌ "Container failed to start"

```bash
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh start
```

### ❌ Still having issues?

```bash
# Full environment verification
./scripts/verify-docker-setup.sh

# Development workflow validation  
./scripts/validate-dev-workflow.sh
```

---

## Expected Timeline

| Step | Time | Cumulative |
|------|------|------------|
| Git clone | 30s | 30s |
| Environment setup | 10s | 40s |
| Docker build & start | 2-3m | 3-4m |
| Verification | 30s | 4-4.5m |

**Total: ~4-5 minutes** for complete setup ✅

---

## Success Checklist

- [ ] Frontend accessible at <http://localhost:3000>
- [ ] "Gantt Chart WebUI" title visible
- [ ] API accessible at <http://localhost:3001/health>
- [ ] JSON health response returned
- [ ] No error messages in `./scripts/docker-dev.sh logs`
- [ ] Hot reload working (edit a file, see changes)

**All checked? You're ready to develop! 🎉**
