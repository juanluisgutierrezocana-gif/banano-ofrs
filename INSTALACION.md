# 🍌 BANANO OFRS - GUÍA DE INSTALACIÓN FINAL

**Versión:** Migración Supabase  
**Fecha:** 11 de Junio 2026  
**Estado:** PRODUCCIÓN LISTA

---

## ✅ CHECKLIST PRE-INSTALACIÓN

Antes de comenzar, asegúrate de tener:

- [ ] Node.js 18+ instalado (`node --version`)
- [ ] npm actualizado (`npm --version`)
- [ ] Credenciales de Supabase (URL y ANON_KEY)
- [ ] Proyecto Supabase con schema ya creado
- [ ] PowerShell o Terminal (NO cmd.exe)

---

## 📋 PASOS DE INSTALACIÓN (SIGUIENDO ORDEN)

### PASO 1: Preparar carpeta

```powershell
# Navega a la carpeta del proyecto
cd D:\BananoOFRS\

# Elimina la carpeta vieja (si existe)
rmdir /s /q banano-track-osmanruano

# Extrae banano-app-final.zip
# (Click derecho → Extraer aquí)
# Obtendrás una carpeta: "banano-app"

# Renómbrala
ren banano-app banano-track-osmanruano

# Entra a la carpeta
cd banano-track-osmanruano
```

### PASO 2: Crear archivo `.env.local`

En la **raíz del proyecto** (donde está `package.json`), crea un archivo llamado `.env.local`:

```
VITE_SUPABASE_URL=https://uugsapqjlbrbexzjvuwo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1Z3NhcHFqbGJyYmV4emp2dXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDc5MDcsImV4cCI6MjA5NjcyMzkwN30.E0Q8Y5KxXX76ShWv71EIHGZEedam_kObED6n45mGJt0
```

**⚠️ IMPORTANTE:**
- El archivo debe llamarse exactamente `.env.local` (punto al inicio)
- Debe estar en la **raíz** (no en `src/`)
- No borres este archivo cuando subes a producción
- El `.gitignore` ya está configurado para ignorarlo

### PASO 3: Instalar dependencias

```powershell
npm install
```

Esto descargará ~630 paquetes. Espera 2-5 minutos.

**Esperado:** Verás mensajes como:
```
added 632 packages, and audited 633 packages in 2m
```

**Si hay vulnerabilidades:** Es normal. No necesitas hacer `npm audit fix` ahora.

### PASO 4: Ejecutar en desarrollo

```powershell
npm run dev
```

**Esperado:**
```
  VITE v6.1.0  running at:
  ➜  Local:   http://localhost:5173/
```

Abre en tu navegador: **http://localhost:5173**

---

## ✨ PANTALLA ESPERADA

Deberías ver:

✅ Pantalla de login (sin errores rojos)  
✅ Interfaz completa cargando  
✅ Console del navegador sin errores de Base44  

---

## 🚨 SI ALGO FALLA

### Error: ".env.local not found" o credenciales no funcionan

```powershell
# 1. Verifica que el archivo exista:
Test-Path .env.local

# 2. Si no existe, créalo manualmente
# 3. Reinicia PowerShell (cierra y abre de nuevo)
# 4. Ejecuta npm run dev de nuevo
```

### Error: "Cannot find module @supabase/supabase-js"

```powershell
npm install @supabase/supabase-js
npm run dev
```

### Error: "VITE error" o "Module not found"

```powershell
# Limpia caché y reinstala
rm -r node_modules
rm package-lock.json
npm install
npm run dev
```

### Error: "Supabase connection failed"

Verifica que:
- ✅ `VITE_SUPABASE_URL` es correcto (sin `/rest/v1/` al final)
- ✅ `VITE_SUPABASE_ANON_KEY` es la anon key (no service_role)
- ✅ Las variables están en `.env.local`
- ✅ Reiniciaste PowerShell después de crear `.env.local`

---

## 📝 ESTRUCTURA DEL PROYECTO

```
banano-track-osmanruano/
├── src/
│   ├── api/
│   │   └── supabaseClient.js         ← Cliente Supabase
│   ├── lib/
│   │   ├── AuthContext.jsx           ← Autenticación
│   │   └── useSettings.js
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── PanelDiario.jsx
│   │   ├── Inventario.jsx
│   │   └── ... (8 páginas más)
│   ├── components/
│   │   ├── config/                   ← Configuración
│   │   ├── recepcion/                ← Recepción de fruta
│   │   ├── reportes/                 ← Reportería
│   │   └── ... (30+ componentes)
│   └── App.jsx
├── .env.local                        ← TÚ DEBES CREAR ESTO
├── .gitignore                        ← Protege .env.local
├── package.json                      ← Sin @base44, con @supabase
├── vite.config.js                    ← Limpio (sin plugin Base44)
└── index.html
```

---

## 🔄 PRÓXIMOS PASOS (DESPUÉS DE QUE npm run dev FUNCIONE)

1. **Testing:** Verifica que Login, Panel Diario y Reportes funcionan
2. **Deploy a Vercel:** Sube el código
3. **Variables en Vercel:** Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
4. **Configurar dominio:** Apunta "Finca La Gracia" a Vercel
5. **Go Live:** 23 de Junio 2026

---

## 📞 SOPORTE

Si algo no funciona:

1. Copia el **error exacto de consola**
2. Dime qué **paso falló**
3. Avísame si es **Windows/Mac/Linux**

---

**¡Éxito! 🍌** 

Si ves http://localhost:5173 cargando sin errores, la migración está completa ✅

