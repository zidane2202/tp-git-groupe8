#!/bin/bash

# Crée le dossier hooks s'il n'existe pas
mkdir -p .git/hooks

# Copie le hook pre-push
cp hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push

echo "✅ Hook pre-push installé !"
