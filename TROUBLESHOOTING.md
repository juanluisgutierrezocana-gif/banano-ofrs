# 🔧 TROUBLESHOOTING - SOLUCIÓN DE PROBLEMAS

---

## 📊 MATRIZ DE DIAGNÓSTICO

### ❌ Problema: "npm install" falla

**Síntomas:**
```
npm ERR! code E... 
npm ERR! ...
```

**Solución:**
```powershell
# 1. Limpia caché de npm
npm cache clean --force

# 2. Elimina carpetas problemáticas
rm -r node_modules
rm package-lock.json

# 3. Reintentar
npm install
```

---

### ❌ Problema: "Cannot find module '@supabase/supabase-js'"

**Síntomas:**
```
Error: Failed to resolve import "@supabase/supabase-js"
```

**Causa:** Dependencia no instalada  
**Solución:**
```powershell
npm install @supabase/supabase-js @supabase/auth-helpers-react
npm run dev
```

---

### ❌ Problema: "Vite error" o "Module not found"

**Síntomas:**
```
X [ERROR] Expected ":" but found ")"
```

**Causa:** Error de sintaxis en archivos  
**Solución:**
- Si ves línea específica (ej: "StepConteo.jsx:25"), contacta soporte
- Generalmente ya está arreglado en esta versión

---

### ❌ Problema: ".env.local not found" o variables vacías

**Síntomas:**
```
console.error: ❌ ERROR: Variables de entorno SUPABASE no configuradas
```

**Causa:** Archivo `.env.local` no existe o PowerShell no lo lee  
**Solución:**

```powershell
# 1. Verifica que existe
Test-Path .env.local
# Debe responder: True

# 2. Si es False, créalo:
New-Item .env.local
# Luego edítalo en Notepad y pega:
VITE_SUPABASE_URL=https://uugsapqjlbrbexzjvuwo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 3. Guarda el archivo

# 4. Cierra PowerShell completamente (no minimices)

# 5. Abre PowerShell de nuevo

# 6. Navega al proyecto
cd D:\BananoOFRS\banano-track-osmanruano

# 7. Intenta de nuevo
npm run dev
```

**⚠️ Nota:** PowerShell a veces cachea variables. Ciérralo completamente y abre uno nuevo.

---

### ❌ Problema: "Cannot POST /api/*" o "Supabase connection failed"

**Síntomas:**
```
Error connecting to Supabase
SUPABASE_URL is undefined
```

**Causa:** Variables de entorno incorrectas o Supabase sin schema  
**Solución:**

```powershell
# 1. Verifica el contenido de .env.local:
Get-Content .env.local

# 2. Asegúrate que:
#    - VITE_SUPABASE_URL = https://xxxxx.supabase.co (SIN /rest/v1/)
#    - VITE_SUPABASE_ANON_KEY = eyJ... (la anon key, no service_role)

# 3. Si algo está mal, edita el archivo:
# (Click derecho → Editar con Bloc de Notas)

# 4. Reinicia PowerShell
# 5. Ejecuta npm run dev de nuevo
```

**Verificar en Supabase:**
```
1. Ve a https://supabase.com
2. Login en tu proyecto
3. Arriba a la derecha: "Project Settings"
4. Busca "API"
5. Copia el Project URL (sin /rest/v1/)
6. Copia la Anon Public Key
7. Pega en .env.local
```

---

### ❌ Problema: "Uncaught Error: base44 is not defined"

**Síntomas:**
```
ReferenceError: base44 is not defined
at Object.<anonymous> (...component.jsx)
```

**Causa:** Todavía hay referencias a Base44 en el código  
**Solución:**

Este error **no debe ocurrir** en esta versión. Si ocurre:

```powershell
# 1. Busca el archivo en el error
# 2. Contacta soporte con el nombre exacto del archivo
```

---

### ❌ Problema: "Port 5173 already in use"

**Síntomas:**
```
Error: listen EADDRINUSE :::5173
```

**Causa:** Otro proceso está usando el puerto  
**Solución:**

```powershell
# Opción 1: Cambiar puerto
npm run dev -- --port 5174

# Opción 2: Matar el proceso
# En Windows, encuentra qué está usando el puerto:
netstat -ano | findstr :5173
# Luego termina el proceso por ID

# Opción 3: Reiniciar la computadora
```

---

### ❌ Problema: "ENOENT: no such file or directory"

**Síntomas:**
```
Error: ENOENT: no such file or directory, open 'C:\...\src\pages\...'
```

**Causa:** Faltan archivos en la carpeta  
**Solución:**

```powershell
# 1. Verifica que extraíste TODO el ZIP:
Get-ChildItem -Recurse src/ | Measure-Object

# 2. Si faltan archivos, descarga nuevamente el ZIP
# 3. Extrae completamente

# 4. En caso de duda:
rm -r .
# Y extrae el ZIP de nuevo desde cero
```

---

### ❌ Problema: "npm run build" falla

**Síntomas:**
```
error during build...
```

**Nota:** Esto ocurre al subir a producción (Vercel), no en desarrollo  
**Solución:** Contacta soporte con el error exacto

---

## 🔍 DIAGNÓSTICO RÁPIDO

Ejecuta esto en PowerShell:

```powershell
# Crear un diagnóstico
@"
=== DIAGNÓSTICO BANANO OFRS ===
PWD: $PWD
Node: $(node --version)
NPM: $(npm --version)
.env.local exists: $(Test-Path .env.local)
node_modules exists: $(Test-Path node_modules)
=== FIN ===
"@
```

Copia la salida y envíala si necesitas soporte.

---

## 📞 CUÁNDO CONTACTAR SOPORTE

Contacta a Claude si:

1. **El error persiste** después de seguir estas soluciones
2. **El error es diferente** a los listados
3. **npm install falla** de forma consistente
4. **Los archivos se ven corrompidos** (caracteres raros)

Cuando contactes, proporciona:
- ✅ El error **exacto** (copia-pega)
- ✅ La línea de código problemática
- ✅ El nombre del archivo
- ✅ Los pasos que hiciste

---

## ✅ VERIFICACIÓN FINAL

Cuando `npm run dev` funcione, deberías ver:

```
✅ http://localhost:5173 abre sin errores
✅ Console del navegador: 0 errores rojos
✅ Página de login visible
✅ No hay mensajes de "base44" o "undefined"
```

Si ves todo eso, **¡la migración está lista!** 🎉

