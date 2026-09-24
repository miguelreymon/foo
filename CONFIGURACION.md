# 🔧 Guía de Configuración - Social Hate Analyzer

Esta guía te ayudará a configurar todas las variables de entorno necesarias para ejecutar el proyecto en tu propia cuenta.

---

## 📋 **Pasos Rápidos**

1. Copia el archivo de ejemplo:
```bash
cp /app/backend/.env.example /app/backend/.env
```

2. Edita `/app/backend/.env` con tus credenciales reales

3. Reinicia el backend:
```bash
sudo supervisorctl restart backend
```

---

## 🔑 **Credenciales Necesarias**

### 1. **YouTube Data API v3** (OBLIGATORIO)

**¿Para qué?** Obtener videos y comentarios de YouTube

**Cómo obtenerla:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo o selecciona uno existente
3. Habilita "YouTube Data API v3"
4. Ve a "Credentials" > "Create Credentials" > "API Key"
5. Copia la API key a `YOUTUBE_API_KEY` en tu `.env`

**Límites:**
- Free: 10,000 unidades/día (~3,333 videos)
- Costo por video: ~3 unidades

---

### 2. **Gemini AI API** (OBLIGATORIO)

**¿Para qué?** Análisis de sentimiento y detección de hate con IA

**Cómo obtenerla:**
1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Clic en "Get API Key" o "Create API Key"
4. Copia la key a `GEMINI_API_KEY` en tu `.env`

**Keys de Respaldo (Opcional):**
- `GEMINI_API_KEY_BACKUP`: Segunda key para failover automático
- `GEMINI_API_KEY_BACKUP2`: Tercera key para máxima disponibilidad

**Límites Free:**
- 15 requests/minuto (RPM)
- 1,500 requests/día (RPD)
- ~375 videos/día

**Plan de Pago:**
- 360 requests/minuto
- 30,000 requests/día
- ~7,500 videos/día

---

### 3. **Firebase / Firestore** (OBLIGATORIO)

**¿Para qué?** Base de datos principal para almacenar análisis

**Cómo obtener credenciales:**

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un proyecto nuevo (o usa uno existente)
3. Ve a **Project Settings** (⚙️) > **Service Accounts**
4. Clic en **"Generate New Private Key"**
5. Se descargará un archivo JSON
6. Abre el JSON y copia los valores a tu `.env`:

```env
FIREBASE_PROJECT_ID="valor-de-project_id"
FIREBASE_PRIVATE_KEY_ID="valor-de-private_key_id"
FIREBASE_PRIVATE_KEY="valor-completo-de-private_key-con-\n"
FIREBASE_CLIENT_EMAIL="valor-de-client_email"
FIREBASE_CLIENT_ID="valor-de-client_id"
FIREBASE_CLIENT_CERT_URL="valor-de-client_x509_cert_url"
```

**⚠️ IMPORTANTE sobre FIREBASE_PRIVATE_KEY:**
- Debe incluir los `\n` (saltos de línea)
- Debe estar entre comillas
- Ejemplo correcto:
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----\n"
```

---

### 4. **Instagram API (RapidAPI)** (OPCIONAL)

**¿Para qué?** Analizar posts de Instagram (opcional)

**Cómo obtenerla:**
1. Ve a [RapidAPI - Instagram Looter](https://rapidapi.com/irrors-apis/api/instagram-looter2)
2. Suscríbete al plan (hay opciones gratuitas)
3. Copia la API key a `RAPIDAPI_KEY` en tu `.env`

**Si no vas a usar Instagram:**
- Déjalo vacío: `RAPIDAPI_KEY=""`

---

## 🔒 **Seguridad**

### Buenas Prácticas:

✅ **NUNCA** subas tu archivo `.env` a Git (ya está en `.gitignore`)
✅ **Rota** tus API keys cada 3-6 meses
✅ **Usa** diferentes keys para desarrollo y producción
✅ **Monitorea** el uso de cuota en Google Cloud Console
✅ **Restringe** tus API keys por IP o dominio en producción

### Si tu `.env` se expone:

1. **Revoca inmediatamente** todas las keys en Google Cloud Console
2. **Genera nuevas** API keys
3. **Actualiza** tu archivo `.env`
4. **Reinicia** el backend

---

## ✅ **Verificar Configuración**

Después de configurar tu `.env`, verifica que todo funcione:

### 1. Reiniciar Backend:
```bash
sudo supervisorctl restart backend
```

### 2. Ver Logs:
```bash
tail -f /var/log/supervisor/backend.err.log
```

Deberías ver:
```
🔥 Firebase credentials loaded from environment variables
INFO: Application startup complete
```

### 3. Probar Endpoints:
```bash
# API principal
curl http://localhost:8001/api/

# Estadísticas
curl http://localhost:8001/api/stats/global
```

---

## 🆘 **Problemas Comunes**

### Error: "Firebase credentials not found"
**Solución:** Verifica que todas las variables `FIREBASE_*` estén en tu `.env`

### Error: "YouTube API quota exceeded"
**Solución:** Espera a que se reinicie la cuota (medianoche PST) o solicita aumento

### Error: "Gemini API 429 Too Many Requests"
**Solución:** Espera unos minutos o usa una API key de respaldo

### Error: "Invalid Firebase private key"
**Solución:** Asegúrate de que `FIREBASE_PRIVATE_KEY` incluya los `\n`

---

## 📞 **Soporte**

Si tienes problemas con la configuración:

1. Revisa los logs: `tail -n 100 /var/log/supervisor/backend.err.log`
2. Verifica que todas las variables obligatorias estén en `.env`
3. Confirma que las API keys sean válidas en sus respectivas consolas

---

## 🎉 **¡Listo!**

Una vez configurado correctamente, tu aplicación estará lista para:
- ✅ Analizar videos de YouTube
- ✅ Detectar hate speech con IA
- ✅ Almacenar resultados en Firestore
- ✅ Generar estadísticas y rankings

**¡Disfruta analizando toxicidad en redes sociales!** 🔥
