#!/bin/bash
echo "🚀 Installation du projet..."

# Installe les dépendances
npm install

# Configure les hooks Git
git config core.hooksPath scripts/hooks
chmod +x scripts/hooks/*

echo "✅ Configuration terminée !"
