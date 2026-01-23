# Integración de OficazIA (OpenAI) - Guía rápida

Esta guía describe cómo funciona el enrutado entre modelos y cómo probarlo.

## Variables de entorno relevantes
- AI_INTEGRATIONS_OPENAI_API_KEY: clave API de OpenAI
- AI_INTEGRATIONS_OPENAI_FAST_MODEL: modelo barato/rápido (por defecto `gpt-4o-mini`)
- AI_INTEGRATIONS_OPENAI_STRONG_MODEL: modelo potente (por defecto `gpt-4o`)

## Lógica de enrutado
1. El sistema usa una heurística para decidir si la petición debe ir al modelo rápido o al potente.
2. La heurística comprueba palabras clave (crear/modificar/rotación/cuadrante/json/base de datos, etc.), longitud del mensaje y presencia de fechas/horas.
3. Si el modelo rápido responde intentando ejecutar una función mutativa o mostrando incertidumbre, se realiza una escalación: se vuelve a invocar al modelo potente con contexto de escalado.

## Funcionamiento (resumen técnico)
- El endpoint `/api/ai-assistant/chat` determina `chosenModel = getPreferredModel(messages)`.
- Se solicita a OpenAI con `model: chosenModel`.
- Si la respuesta incluye una llamada de función mutativa (p.ej. `assignScheduleInRange`, `createEmployee`) o el texto sugiere que el asistente no puede concluir, el sistema hace una segunda llamada con `model: STRONG_MODEL` para confirmar o generar la acción final.

## Casos de prueba manuales recomendados
- Petición simple (esperada en modelo rápido): "¿Cuántas horas trabajó Ramírez esta semana?" → debería resolverse con el modelo rápido y devolver datos + `navigateTo`.
- Acción mutativa (debe escalar): "Crea un empleado llamado Juan Pérez, horario 8-15 del 2026-01-15 al 2026-01-31" → debería escalar a modelo potente y ejecutar `createEmployee`.
- Petición larga/compleja (debe escalar): Texto largo con varias instrucciones: crear cuadrantes, asignar rotaciones y generar reporte.

## Tips operativos
- Puedes ajustar los modelos a usar en `.env` mediante `AI_INTEGRATIONS_OPENAI_FAST_MODEL` y `AI_INTEGRATIONS_OPENAI_STRONG_MODEL`.
- `AI_INTEGRATIONS_OPENAI_BASE_URL` puede indicarse sin `/v1` (el sistema añade `/v1` automáticamente), pero si quieres forzar un endpoint concreto añádelo completo (p.ej. `https://api.openai.com/v1`).
- Si necesitas máxima seguridad, configura el modelo fuerte a uno de máxima capacidad y limita el fast model para operaciones puramente informativas.

## Tests de integración (opcional)
- Hay un test de integración que realiza llamadas reales a la API de OpenAI: `tests/ai-integration.spec.ts`.
- Por defecto este test se *salta* si no existe la variable de entorno `AI_INTEGRATIONS_OPENAI_API_KEY` (para evitar costes inesperados).
- Para ejecutar localmente los tests de integración:
  1. Exporta tu API key: `export AI_INTEGRATIONS_OPENAI_API_KEY="sk_..."` (Windows PowerShell: `$env:AI_INTEGRATIONS_OPENAI_API_KEY="sk_..."`)
  2. Ejecuta: `npx vitest run tests/ai-integration.spec.ts` (o `npm test -- tests/ai-integration.spec.ts`)
- Integración en CI: añade el secreto `AI_INTEGRATIONS_OPENAI_API_KEY` a tu repositorio (Settings → Secrets → Actions). Si quieres usar un endpoint personalizado (p.ej. proxy o staging), añade también `AI_INTEGRATIONS_OPENAI_BASE_URL` con la URL completa (se añade `/v1` automáticamente si falta).
## Seguimiento y límites
- La implementación ya registra el uso de tokens y previene exceder el límite de la suscripción.

---

Si quieres, puedo añadir tests automatizados con `vitest` para validar la heurística y la escalación. ¿Lo añado? (sí/no)