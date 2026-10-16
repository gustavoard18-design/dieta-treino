#!/usr/bin/env bash
# Publica uma nova versão: grava a versão no app e em version.json (os apps abertos mostram "Atualizar"), faz commit e push.
# Uso: ./publicar.sh "mensagem do commit"
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d-%H%M%S)
sed -i -E "s/const VERSAO='[^']*'/const VERSAO='$V'/; s/alimentos\.js\?v=[^\"]*/alimentos.js?v=$V/" index.html
sed -i -E "s/const CACHE='[^']*'/const CACHE='dieta-$V'/" sw.js
printf '{"versao":"%s"}\n' "$V" > version.json
git add -A docs supabase supabase.sql privacidade.html index.html sw.js version.json alimentos.js manifest.json icon*.png apple-touch-icon.png publicar.sh
git commit -q -m "$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
echo "Publicado: versão $V"
