# On-prem deploy (scripts + config templates)

Скрипты и шаблоны для установки у заказчика. Документация: [`docs/on-prem/`](../docs/on-prem/README.md).

## Файлы

| Путь | Назначение |
|------|------------|
| `scripts/install.sh` | Первая установка |
| `scripts/update.sh` | Обновление + бэкап БД/uploads |
| `scripts/rollback.sh` | Откат symlink + pm2 restart |
| `scripts/common.sh` | Общая логика (не запускать напрямую) |
| `shared/backend.env.example` | Шаблон `.env` backend |
| `shared/build.env.example` | Шаблон `VITE_*` для сборки frontend |

## На сервере заказчика

```bash
sudo cp -r deploy/on-prem/scripts/* /opt/legal-boards/scripts/
sudo chmod +x /opt/legal-boards/scripts/*.sh

sudo cp deploy/on-prem/shared/backend.env.example /opt/legal-boards/shared/backend.env
sudo cp deploy/on-prem/shared/build.env.example /opt/legal-boards/shared/build.env
# отредактировать оба файла
```

## Релизный tarball

При сборке релиза включите файл `VERSION` в корень архива:

```text
legal-boards-v1.0.0.tar.gz
└── legal-boards-v1.0.0/
    ├── VERSION          # одна строка: v1.0.0
    ├── package.json
    ├── backend/
    └── ...
```

Пример упаковки (на машине поставщика):

```bash
VERSION=v1.0.0
echo "$VERSION" > VERSION
tar -czf "legal-boards-${VERSION}.tar.gz" \
  --exclude node_modules --exclude dist --exclude backend/node_modules \
  --exclude backend/dist --exclude .env --exclude backend/uploads \
  --transform "s,^,legal-boards-${VERSION}/," .
```

Имя архива для скриптов: `/opt/legal-boards/incoming/legal-boards-v1.0.0.tar.gz`
