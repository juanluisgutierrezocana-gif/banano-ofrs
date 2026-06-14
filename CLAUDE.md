# BANANO OFRS — Instrucciones para Claude

## Stack
- React 18 + Vite + Tailwind + Shadcn/UI
- @tanstack/react-query para fetching
- Supabase (PostgreSQL) como backend
- Vercel para deploy (auto-deploy desde GitHub `main`)

## Paths
- Proyecto: `D:\BananoOFRS\banano-track-osmanruano\`
- Fuente: `D:\BananoOFRS\banano-track-osmanruano\src\`
- Bash/sandbox: `/sessions/.../mnt/banano-track-osmanruano/`

## Antes de editar un archivo
1. Leerlo completo con `Read` para conocer el estado actual
2. Nunca asumir el contenido — puede haber cambiado desde la última sesión
3. Dar cambios mínimos (find-and-replace), no reescribir archivos enteros

## Patrón obligatorio para queryFn (React Query + Supabase)
```js
// SIEMPRE async + await + destructure + throw + default
queryFn: async () => {
  const { data, error } = await entidad.method();
  if (error) throw error;
  return data ?? [];
},
```

## Variable shadowing — bug frecuente
Si un componente importa `trenadas` (entity) y también hace:
```js
const { data: trenadas = [] } = useQuery(...)
```
El import queda opacado. Renombrar el destructure: `data: trenadaRecords`.

## API de Supabase — llamadas correctas
```js
// ✅ Correcto
supabase.from('tabla').update({ campo: valor }).eq('id', id)
supabase.from('tabla').delete().eq('id', id)
supabase.from('tabla').select('*').eq('columna', valor)

// ❌ Incorrecto (patrón Base44 que no funciona en Supabase directo)
supabase.from('tabla').update(id, { campo: valor })
supabase.from('tabla').delete(id)
supabase.from('tabla').select('*').eq({ columna: valor })
supabase.from('tabla').select('*')()   // extra () = bug
```

## Tablas Supabase (nombres correctos)
| Export en supabaseClient | Tabla en Supabase |
|--------------------------|-------------------|
| `colors` | `color_configs` |
| `laborAgricola` | `tipos_labor` |
| `reports` | `registros_labor` |
| `inventory` | `inventario_embolse` |
| `losses` | `perdidas` |
| `sections` | `sections` |
| `seccionAgricola` | `seccion_agricola` |
| `trenadas` | `trenadas` |
| `ordenCalibre` | `orden_calibre` |

## Columnas importantes (diferencias Base44 → Supabase)
- `color_configs`: `active` (no `is_active`), `sort_order` renombrado a `position`
- `button_config`: `active` (no `is_enabled`), `position` (no `sort_order`)
- `inventario_embolse`: `total` (no `total_embolse`), `color_id` (sin color_name/hex directo)
- `settings`: columnas individuales (`finca_name`, etc.), NO patrón key/value. Usar `.maybeSingle()`

## Mi flujo de trabajo obligatorio (cada cambio)

### 1. Antes de editar — confirmar el archivo
- Leer el archivo completo con `Read` antes de tocar nada
- Confirmar el path exacto: `D:\BananoOFRS\banano-track-osmanruano\src\...`
- Nunca asumir el contenido; puede haber cambiado entre sesiones

### 2. Después de editar — pedir push
- Pedir al usuario que ejecute en PowerShell:
  ```
  git add -A
  git commit -m "descripción del cambio"
  git push
  ```
- Esperar ~2 minutos para que Vercel haga el deploy automático

### 3. Verificar en el navegador — YO lo hago con Chrome MCP
Usar `mcp__Claude_in_Chrome__browser_batch` para:
- Navegar a `https://banano-ofrs.vercel.app/` (o la ruta específica)
- Capturar screenshot para confirmar que cargó
- Revisar requests de Supabase: `read_network_requests` con `urlPattern: "supabase"`
- Revisar errores JS: `read_console_messages` con `pattern: "error|Error|TypeError"`

### 4. Si algo no funciona — diagnóstico antes de proponer fix
Antes de tocar código, verificar en este orden:
1. ¿El statusCode de Supabase es 200? Si no → problema de query/columna
2. ¿Hay errores en consola? Copiar el error exacto
3. ¿El archivo tiene el cambio correcto? Leerlo de nuevo con `Read`
4. Dar el fix mínimo necesario, no reescribir el archivo entero
5. Pedir otro push y volver al paso 3

**Nunca dar un cambio por bueno sin verificar el statusCode en network.**

## Supabase SQL Editor
URL: `https://supabase.com/dashboard/project/uugsapqjlbrbexzjvuwo/sql/new`
Siempre ejecutar "Run without RLS" salvo que se indique lo contrario.
