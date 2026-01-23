#!/bin/bash

# Apply CRM accounting integration migration
echo "🚀 Aplicando migraciones a la base de datos..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL no está configurada"
  exit 1
fi

# Using drizzle-kit to push migrations
npx drizzle-kit push:pg

if [ $? -eq 0 ]; then
  echo "✅ Migraciones aplicadas correctamente"
else
  echo "❌ Error al aplicar migraciones"
  exit 1
fi
